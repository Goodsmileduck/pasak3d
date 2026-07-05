import * as THREE from "three";
import type { CutPlaneSpec } from "../../../types";
import { computeSDF } from "./sdf";
import { segmentFaces, type SegmentOptions } from "./regions";

const QUANT = 1e4;         // vertex weld precision (match regions.ts)
const PARALLEL_DOT = 0.999; // |n1·n2| above this ⇒ same orientation (for dedupe)
const COINCIDENT_C = 1e-2;  // constant closeness for dedupe (model units)

function triIndices(geom: THREE.BufferGeometry, f: number): [number, number, number] {
  if (geom.index) return [geom.index.getX(f * 3), geom.index.getX(f * 3 + 1), geom.index.getX(f * 3 + 2)];
  return [f * 3, f * 3 + 1, f * 3 + 2];
}
function posKey(x: number, y: number, z: number): string {
  return `${Math.round(x * QUANT)},${Math.round(y * QUANT)},${Math.round(z * QUANT)}`;
}

/** Largest-eigenvector power iteration on a symmetric 3×3 (row-major m[9]). Deterministic seed. */
function powerIter(m: number[], sx: number, sy: number, sz: number): THREE.Vector3 {
  const x = new THREE.Vector3(sx, sy, sz).normalize();
  const t = new THREE.Vector3();
  for (let k = 0; k < 48; k++) {
    t.set(
      m[0] * x.x + m[1] * x.y + m[2] * x.z,
      m[3] * x.x + m[4] * x.y + m[5] * x.z,
      m[6] * x.x + m[7] * x.y + m[8] * x.z,
    );
    const len = t.length();
    if (len < 1e-12) break;
    x.copy(t).multiplyScalar(1 / len);
  }
  return x.clone();
}

/** Best-fit plane normal (smallest principal axis) = cross of the two largest via power iteration + deflation. */
function fitNormal(pts: THREE.Vector3[], centroid: THREE.Vector3): THREE.Vector3 | null {
  if (pts.length < 3) return null;
  let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0;
  const d = new THREE.Vector3();
  for (const p of pts) {
    d.subVectors(p, centroid);
    xx += d.x * d.x; xy += d.x * d.y; xz += d.x * d.z; yy += d.y * d.y; yz += d.y * d.z; zz += d.z * d.z;
  }
  const M = [xx, xy, xz, xy, yy, yz, xz, yz, zz];
  const u = powerIter(M, 1, 0.37, 0.57);
  const lu =
    u.x * (M[0] * u.x + M[1] * u.y + M[2] * u.z) +
    u.y * (M[3] * u.x + M[4] * u.y + M[5] * u.z) +
    u.z * (M[6] * u.x + M[7] * u.y + M[8] * u.z);
  const Md = [
    M[0] - lu * u.x * u.x, M[1] - lu * u.x * u.y, M[2] - lu * u.x * u.z,
    M[3] - lu * u.y * u.x, M[4] - lu * u.y * u.y, M[5] - lu * u.y * u.z,
    M[6] - lu * u.z * u.x, M[7] - lu * u.z * u.y, M[8] - lu * u.z * u.z,
  ];
  const v = powerIter(Md, 0.31, 1, 0.13);
  const n = new THREE.Vector3().crossVectors(u, v);
  if (n.length() < 1e-9) return null; // collinear boundary ⇒ no unique plane
  return n.normalize();
}

/** True if the mesh has vertices on both sides of the plane (i.e. the plane actually separates it). */
function separatesMesh(pos: THREE.BufferAttribute, n: THREE.Vector3, constant: number): boolean {
  let hasPos = false, hasNeg = false;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const s = n.dot(v) - constant;
    if (s > 1e-4) hasPos = true;
    else if (s < -1e-4) hasNeg = true;
    if (hasPos && hasNeg) return true;
  }
  return false;
}

export function seamPlanes(geometry: THREE.BufferGeometry, labels: Int32Array): CutPlaneSpec[] {
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const faceCount = (geometry.index ? geometry.index.count : pos.count) / 3;

  // welded edge → faces, remembering the edge endpoints
  type Edge = { faces: number[]; a: THREE.Vector3; b: THREE.Vector3 };
  const edgeMap = new Map<string, Edge>();
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
  for (let f = 0; f < faceCount; f++) {
    const [i0, i1, i2] = triIndices(geometry, f);
    va.fromBufferAttribute(pos, i0); vb.fromBufferAttribute(pos, i1); vc.fromBufferAttribute(pos, i2);
    const trio: Array<[THREE.Vector3, string]> = [
      [va, posKey(va.x, va.y, va.z)], [vb, posKey(vb.x, vb.y, vb.z)], [vc, posKey(vc.x, vc.y, vc.z)],
    ];
    for (let e = 0; e < 3; e++) {
      const [p1, k1] = trio[e], [p2, k2] = trio[(e + 1) % 3];
      const ek = k1 < k2 ? `${k1}#${k2}` : `${k2}#${k1}`;
      let rec = edgeMap.get(ek);
      if (!rec) { rec = { faces: [], a: p1.clone(), b: p2.clone() }; edgeMap.set(ek, rec); }
      rec.faces.push(f);
    }
  }

  // collect boundary-edge endpoints per unordered region pair
  const pairPts = new Map<string, THREE.Vector3[]>();
  for (const rec of edgeMap.values()) {
    if (rec.faces.length !== 2) continue;
    const [f, g] = rec.faces;
    const rf = labels[f], rg = labels[g];
    if (rf === rg) continue;
    const key = rf < rg ? `${rf}-${rg}` : `${rg}-${rf}`;
    let arr = pairPts.get(key);
    if (!arr) { arr = []; pairPts.set(key, arr); }
    arr.push(rec.a, rec.b);
  }

  // fit + filter
  const planes: CutPlaneSpec[] = [];
  for (const pts of pairPts.values()) {
    const centroid = new THREE.Vector3();
    for (const p of pts) centroid.add(p);
    centroid.multiplyScalar(1 / pts.length);
    const n = fitNormal(pts, centroid);
    if (!n) continue;
    const constant = n.dot(centroid);
    if (!separatesMesh(pos, n, constant)) continue;
    planes.push({ normal: [n.x, n.y, n.z], constant, axisSnap: "free" });
  }

  // dedupe near-coincident planes (parallel + same offset, allowing sign flip)
  const out: CutPlaneSpec[] = [];
  for (const pl of planes) {
    const dup = out.some((q) => {
      const dot = pl.normal[0] * q.normal[0] + pl.normal[1] * q.normal[1] + pl.normal[2] * q.normal[2];
      if (Math.abs(dot) < PARALLEL_DOT) return false;
      const cAligned = dot >= 0 ? q.constant : -q.constant;
      return Math.abs(pl.constant - cAligned) < COINCIDENT_C;
    });
    if (!dup) out.push(pl);
  }
  return out;
}

export function segmentCuts(geometry: THREE.BufferGeometry, opts: SegmentOptions): CutPlaneSpec[] {
  const sdf = computeSDF(geometry);
  const labels = segmentFaces(geometry, sdf, opts);
  return seamPlanes(geometry, labels);
}
