// src/lib/cut/segment/regions.ts
import * as THREE from "three";

export type SegmentOptions = { maxParts: number; detail: number };

const GEO_CONCAVITY = 0.28;
const GEO_MIN_REGION_RATIO = 0.0025;
const QUANT = 1e4; // vertex-weld precision for adjacency (coincident verts share an edge key)

function triIndices(geom: THREE.BufferGeometry, f: number): [number, number, number] {
  if (geom.index) return [geom.index.getX(f * 3), geom.index.getX(f * 3 + 1), geom.index.getX(f * 3 + 2)];
  return [f * 3, f * 3 + 1, f * 3 + 2];
}

function posKey(x: number, y: number, z: number): string {
  return `${Math.round(x * QUANT)},${Math.round(y * QUANT)},${Math.round(z * QUANT)}`;
}

class DSU {
  parent: Int32Array;
  constructor(n: number) {
    this.parent = new Int32Array(n);
    for (let i = 0; i < n; i++) this.parent[i] = i;
  }
  find(x: number): number {
    while (this.parent[x] !== x) { this.parent[x] = this.parent[this.parent[x]]; x = this.parent[x]; }
    return x;
  }
  union(a: number, b: number): void {
    const ra = this.find(a), rb = this.find(b);
    if (ra !== rb) this.parent[ra] = rb;
  }
}

export function segmentFaces(
  geometry: THREE.BufferGeometry,
  sdf: Float32Array,
  opts: SegmentOptions,
): Int32Array {
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const faceCount = (geometry.index ? geometry.index.count : pos.count) / 3;

  // --- 1. per-face centroid / normal / area / band ---
  const cx = new Float32Array(faceCount), cy = new Float32Array(faceCount), cz = new Float32Array(faceCount);
  const nx = new Float32Array(faceCount), ny = new Float32Array(faceCount), nz = new Float32Array(faceCount);
  const area = new Float32Array(faceCount);
  const band = new Int32Array(faceCount);
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), nrm = new THREE.Vector3();
  let maxSdf = 0;
  for (let f = 0; f < faceCount; f++) if (sdf[f] > maxSdf) maxSdf = sdf[f];
  if (maxSdf <= 0) maxSdf = 1;
  const bandCount = Math.min(12, Math.max(2, Math.round(2 + opts.detail * 10)));

  for (let f = 0; f < faceCount; f++) {
    const [i0, i1, i2] = triIndices(geometry, f);
    va.fromBufferAttribute(pos, i0); vb.fromBufferAttribute(pos, i1); vc.fromBufferAttribute(pos, i2);
    e1.subVectors(vb, va); e2.subVectors(vc, va);
    nrm.crossVectors(e1, e2);
    area[f] = 0.5 * nrm.length();
    nrm.normalize();
    nx[f] = nrm.x; ny[f] = nrm.y; nz[f] = nrm.z;
    cx[f] = (va.x + vb.x + vc.x) / 3; cy[f] = (va.y + vb.y + vc.y) / 3; cz[f] = (va.z + vb.z + vc.z) / 3;
    band[f] = Math.min(bandCount - 1, Math.max(0, Math.floor((sdf[f] / maxSdf) * bandCount)));
  }

  // --- 2. welded edge → faces (+ edge length) ---
  const edgeMap = new Map<string, { faces: number[]; len: number }>();
  for (let f = 0; f < faceCount; f++) {
    const [i0, i1, i2] = triIndices(geometry, f);
    va.fromBufferAttribute(pos, i0); vb.fromBufferAttribute(pos, i1); vc.fromBufferAttribute(pos, i2);
    const ka = posKey(va.x, va.y, va.z), kb = posKey(vb.x, vb.y, vb.z), kc = posKey(vc.x, vc.y, vc.z);
    const edges: Array<[string, string, number]> = [
      [ka, kb, va.distanceTo(vb)],
      [kb, kc, vb.distanceTo(vc)],
      [kc, ka, vc.distanceTo(va)],
    ];
    for (const [k1, k2, len] of edges) {
      const ek = k1 < k2 ? `${k1}#${k2}` : `${k2}#${k1}`;
      let rec = edgeMap.get(ek);
      if (!rec) { rec = { faces: [], len }; edgeMap.set(ek, rec); }
      rec.faces.push(f);
    }
  }

  // --- 3. union across non-breaking interior edges ---
  const dsu = new DSU(faceCount);
  for (const rec of edgeMap.values()) {
    if (rec.faces.length !== 2) continue; // boundary / non-manifold
    const [f, g] = rec.faces;
    if (band[f] !== band[g]) continue;
    const concave = (cx[g] - cx[f]) * nx[f] + (cy[g] - cy[f]) * ny[f] + (cz[g] - cz[f]) * nz[f] > 0;
    const dot = Math.max(-1, Math.min(1, nx[f] * nx[g] + ny[f] * ny[g] + nz[f] * nz[g]));
    const magnitude = 1 - dot;
    if (concave && magnitude > GEO_CONCAVITY) continue; // strong concave crease ⇒ seam
    dsu.union(f, g);
  }

  // initial contiguous labels
  let labels = new Int32Array(faceCount);
  const rootToId = new Map<number, number>();
  let nextId = 0;
  for (let f = 0; f < faceCount; f++) {
    const r = dsu.find(f);
    let id = rootToId.get(r);
    if (id === undefined) { id = nextId++; rootToId.set(r, id); }
    labels[f] = id;
  }

  // --- 4. merge sub-threshold + cap (recompute each pass; region counts are small) ---
  const aggregate = () => {
    const ids = new Set<number>();
    for (let f = 0; f < faceCount; f++) ids.add(labels[f]);
    const regionArea = new Map<number, number>();
    for (const id of ids) regionArea.set(id, 0);
    let total = 0;
    for (let f = 0; f < faceCount; f++) { regionArea.set(labels[f], regionArea.get(labels[f])! + area[f]); total += area[f]; }
    // region adjacency with shared boundary length
    const adj = new Map<number, Map<number, number>>();
    for (const id of ids) adj.set(id, new Map());
    for (const rec of edgeMap.values()) {
      if (rec.faces.length !== 2) continue;
      const [f, g] = rec.faces;
      const rf = labels[f], rg = labels[g];
      if (rf === rg) continue;
      adj.get(rf)!.set(rg, (adj.get(rf)!.get(rg) ?? 0) + rec.len);
      adj.get(rg)!.set(rf, (adj.get(rg)!.get(rf) ?? 0) + rec.len);
    }
    return { ids, regionArea, total, adj };
  };
  const bestNeighbor = (adj: Map<number, Map<number, number>>, r: number): number | null => {
    const nbrs = adj.get(r);
    if (!nbrs || nbrs.size === 0) return null;
    let best = -1, bestLen = -Infinity;
    for (const [n, len] of nbrs) if (len > bestLen || (len === bestLen && n < best)) { best = n; bestLen = len; }
    return best;
  };
  const mergeInto = (src: number, dst: number) => {
    for (let f = 0; f < faceCount; f++) if (labels[f] === src) labels[f] = dst;
  };

  for (let guard = 0; guard < faceCount + 8; guard++) {
    const { ids, regionArea, total, adj } = aggregate();
    // sub-threshold: smallest region below the ratio that has a neighbor
    let target = -1, targetArea = Infinity;
    for (const id of ids) {
      const frac = total > 0 ? regionArea.get(id)! / total : 0;
      if (frac < GEO_MIN_REGION_RATIO && bestNeighbor(adj, id) !== null) {
        const aVal = regionArea.get(id)!;
        if (aVal < targetArea || (aVal === targetArea && id < target)) { target = id; targetArea = aVal; }
      }
    }
    if (target !== -1) { mergeInto(target, bestNeighbor(adj, target)!); continue; }
    // cap: while too many regions, merge the smallest region that has a neighbor
    if (ids.size > opts.maxParts) {
      let smallest = -1, smallestArea = Infinity;
      for (const id of ids) {
        if (bestNeighbor(adj, id) === null) continue;
        const aVal = regionArea.get(id)!;
        if (aVal < smallestArea || (aVal === smallestArea && id < smallest)) { smallest = id; smallestArea = aVal; }
      }
      if (smallest !== -1) { mergeInto(smallest, bestNeighbor(adj, smallest)!); continue; }
    }
    break;
  }

  // compact labels to 0..k-1
  const compact = new Map<number, number>();
  let cNext = 0;
  const out = new Int32Array(faceCount);
  for (let f = 0; f < faceCount; f++) {
    let id = compact.get(labels[f]);
    if (id === undefined) { id = cNext++; compact.set(labels[f], id); }
    out[f] = id;
  }
  return out;
}
