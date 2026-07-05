# Pasak Phase 6 (Gap C) — Auto-Split Segmentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Auto-Split — a client-side SDF region-growing segmenter (in the cut worker) that suggests geometry-aware cut planes into the existing suggested-cut preview/apply pipeline.

**Architecture:** Three pure, tested modules under `src/lib/cut/segment/` (`sdf` → `regions` → `seam-planes`) compose into `segmentCuts(geometry, opts): CutPlaneSpec[]`, run via a new `segment` worker case + a `runSegment` client call, triggered by an "Auto-Split" button that populates the existing `suggestedCuts` state. Everything downstream (Phase-3 preview, `performCutsSequential`) is reused.

**Tech Stack:** TypeScript, three.js + `three-mesh-bvh` (already a dep), Web Worker, Vitest.

**Spec:** [`../specs/2026-07-05-pasak-phase6-autosplit-design.md`](../specs/2026-07-05-pasak-phase6-autosplit-design.md)

## Global Constraints

- **Web tier, additive.** No native, no new deps, no changes to the cut/connector/apply engine — Auto-Split only *produces* `CutPlaneSpec[]`. New code under `src/lib/cut/segment/`, the worker, `cut-client.ts`, and the Toolbar/App.
- **Both build targets + suite pass** before a milestone is done: `npm run test`, `npm run typecheck`, `npm run build:web`, `npm run build`.
- **Reuse the suggested-cut flow:** the "Auto-Split" button sets `suggestedCuts: { partId, cuts: CutPlaneSpec[] }`; the existing Phase-3 `SuggestedCutPlanes` preview + the "Will add N cuts" panel + `session.performCutsSequential(partId, cuts, dowelOpts)` apply it. Do NOT build a new preview/apply path.
- **`CutPlaneSpec = { normal: [number,number,number]; constant: number; axisSnap: "x"|"y"|"z"|"free" }`** — Auto-Split emits `axisSnap: "free"`.
- **Tuple types:** every `[number,number,number]` explicitly typed/cast (repo `tsc` fails on widened `number[]`). Verify `typecheck` + both builds, not just vitest.
- **Worker convention:** extend the `CutWorkerRequest`/`CutWorkerResponse` unions in `src/workers/cut-worker.ts` with a `segment` op; add `runSegment` to `src/lib/cut/cut-client.ts` mirroring `runSeparate` (`submit<T>(req, transfer, pick)`).
- **§2 tuned constants** (defaults, only Max parts + Detail exposed): `geoConcavity 0.28`, `geoGranularity 0.45`, `geoMaxParts 64`, `geoMinRegionRatio 0.0025`.
- **Commit style:** Conventional Commits with scope (`feat(segment):`, `feat(autosplit):`, `test(...)`, `docs(...)`), em-dash for what+why. End messages with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

## Verified integration points (in the codebase)

- `three-mesh-bvh` exports `MeshBVH`; `new MeshBVH(geometry)` + `bvh.raycastFirst(ray, THREE.DoubleSide)` → hit `{ distance, ... } | null` (confirm the exact `raycastFirst` signature with the installed version — it may take `(ray, side)` or `(ray, material)`).
- `cut-worker.ts`: `CutWorkerRequest` union + `self.onmessage` dispatch; responses are transferable.
- `cut-client.ts`: `runSeparate(mesh)` is the template — serialize `mesh.geometry` → `submit(req, transfer, pick)`.
- `App.tsx`: `onSuggestCuts` sets `suggestedCuts`; the panel (~line 647) shows "Will add N cuts" + calls `session.performCutsSequential(...)`. Auto-Split reuses this verbatim.

---

# C-M1 — SDF per face

The foundation + the perf-critical step: the Shape Diameter Function (local thickness) per face, via a BVH inward ray-cone.

## File structure (C-M1)

- Create `src/lib/cut/segment/sdf.ts` — `computeSDF(geometry, opts): Float32Array` + internal `faceCount`/cone helpers.
- Test `tests/cut/segment/sdf.test.ts`.

---

### Task 1: `computeSDF`

**Files:**
- Create: `src/lib/cut/segment/sdf.ts`
- Test: `tests/cut/segment/sdf.test.ts`

**Interfaces:**
- Produces: `computeSDF(geometry: THREE.BufferGeometry, opts?: SDFOptions): Float32Array` — one value per
  triangle (median inward ray distance). `SDFOptions = { rayCount?: number; coneAngleDeg?: number }`.
  Handles indexed and non-indexed geometry.

- [ ] **Step 1: Write the failing test**

```ts
// tests/cut/segment/sdf.test.ts
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { computeSDF } from "../../../src/lib/cut/segment/sdf";

describe("computeSDF", () => {
  it("measures local thickness: a thin slab's broad faces read ~the thin dimension", () => {
    // 10 x 10 x 2 box: top/bottom faces (thin Z axis) ⇒ SDF ≈ 2; side faces ⇒ ≈ 10.
    const geom = new THREE.BoxGeometry(10, 10, 2);
    const sdf = computeSDF(geom, { rayCount: 24 });
    const min = Math.min(...sdf);
    const max = Math.max(...sdf);
    expect(min).toBeGreaterThan(1.5);
    expect(min).toBeLessThan(4);   // thin dimension ≈ 2
    expect(max).toBeGreaterThan(7); // through-faces ≈ 10
  });

  it("returns one value per triangle", () => {
    const geom = new THREE.BoxGeometry(1, 1, 1);
    const triCount = (geom.index ? geom.index.count : geom.attributes.position.count) / 3;
    expect(computeSDF(geom, { rayCount: 8 }).length).toBe(triCount);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (module not found)

Run: `npx vitest run tests/cut/segment/sdf.test.ts`

- [ ] **Step 3: Implement**

```ts
// src/lib/cut/segment/sdf.ts
import * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";

export type SDFOptions = { rayCount?: number; coneAngleDeg?: number };

/** Read triangle `f` vertex indices from indexed or non-indexed geometry. */
function triIndices(geom: THREE.BufferGeometry, f: number): [number, number, number] {
  if (geom.index) return [geom.index.getX(f * 3), geom.index.getX(f * 3 + 1), geom.index.getX(f * 3 + 2)];
  return [f * 3, f * 3 + 1, f * 3 + 2];
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** A direction inside the cone around `axis` (half-angle `angle`), sample `i` of `n`. */
function coneDir(axis: THREE.Vector3, angle: number, i: number, n: number, out: THREE.Vector3): THREE.Vector3 {
  if (i === 0 || angle <= 0) return out.copy(axis);
  // deterministic spiral over the cap (no rng — reproducible)
  const t = i / n;
  const theta = t * angle;                 // polar from axis
  const phi = i * 2.399963;                // golden-angle azimuth
  // build a basis around axis
  const up = Math.abs(axis.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(axis, up).normalize();
  const v = new THREE.Vector3().crossVectors(axis, u);
  const sin = Math.sin(theta);
  return out.copy(axis).multiplyScalar(Math.cos(theta))
    .addScaledVector(u, sin * Math.cos(phi))
    .addScaledVector(v, sin * Math.sin(phi))
    .normalize();
}

/** Shape Diameter Function per triangle: median inward ray-cone hit distance (local thickness). */
export function computeSDF(geometry: THREE.BufferGeometry, opts: SDFOptions = {}): Float32Array {
  const rayCount = opts.rayCount ?? 30;
  const coneAngle = ((opts.coneAngleDeg ?? 30) * Math.PI) / 180;
  const bvh = new MeshBVH(geometry);
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const faceCount = (geometry.index ? geometry.index.count : pos.count) / 3;
  const sdf = new Float32Array(faceCount);

  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const centroid = new THREE.Vector3(), normal = new THREE.Vector3(), inward = new THREE.Vector3();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), dir = new THREE.Vector3();

  for (let f = 0; f < faceCount; f++) {
    const [i0, i1, i2] = triIndices(geometry, f);
    a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
    centroid.copy(a).add(b).add(c).multiplyScalar(1 / 3);
    normal.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a)).normalize();
    inward.copy(normal).negate();

    const dists: number[] = [];
    for (let r = 0; r < rayCount; r++) {
      coneDir(inward, coneAngle, r, rayCount, dir);
      // Reject rays that flip to the outward hemisphere.
      if (dir.dot(inward) <= 0) continue;
      const origin = centroid.clone().addScaledVector(dir, 1e-4); // nudge off the face to skip self-hit
      const ray = new THREE.Ray(origin, dir);
      const hit = bvh.raycastFirst(ray, THREE.DoubleSide);
      if (hit && hit.distance > 1e-3) dists.push(hit.distance);
    }
    sdf[f] = median(dists);
  }
  return sdf;
}
```

> **Spike note:** confirm `bvh.raycastFirst(ray, side)` against the installed `three-mesh-bvh` — some versions
> want `raycastFirst(ray, THREE.DoubleSide)`, others a material. The hit exposes `.distance`. Do NOT change the
> `computeSDF` signature.

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/cut/segment/sdf.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/cut/segment/sdf.ts tests/cut/segment/sdf.test.ts
git commit -m "feat(segment): computeSDF — per-face shape diameter via BVH inward ray-cone"
```

- [ ] **Step 6: Verify + smoke doc**

Run: `npm run test && npm run typecheck && npm run build:web && npm run build` → all PASS.
Write `docs/p6-m1-sdf-smoke-test.md` (existing style): the SDF core is unit-tested; note ray-count vs
speed/quality and that it handles indexed + non-indexed geometry. Commit:
```bash
git add docs/p6-m1-sdf-smoke-test.md
git commit -m "docs(p6-m1): SDF smoke checklist"
```

- [ ] **STOP — pause for user review before C-M2.**

---

# C-M2 — Region growing + merge

`segmentFaces(geometry, sdf, opts): Int32Array` — a per-face region label. The algorithm is a
**connected-component segmentation over the welded face-adjacency graph**, cutting the graph at (a) SDF-band
boundaries and (b) strong concave creases, then **merging sub-threshold regions and capping at `maxParts`**.

## Algorithm (precise)

All indices are triangle (face) indices `0..faceCount-1`.

1. **Per-face attributes.** For each face compute centroid, unit normal (`(b−a)×(c−a)` normalized — the
   winding-derived outward normal), and area (`0.5·|(b−a)×(c−a)|`). Compute `maxSdf = max(sdf)` (guard `≤0 → 1`).
   `bandCount = clamp(round(2 + detail·10), 2, 12)`. `band[f] = clamp(floor((sdf[f]/maxSdf)·bandCount), 0, bandCount−1)`.
   (Higher `detail` ⇒ more bands ⇒ finer segmentation; a face with `sdf=0` — no ray hit in C-M1 — lands in band 0.)
2. **Welded edge→faces map.** Quantize each vertex position to a string key `posKey` (round to `1e4`), so
   coincident vertices from primitives/loaders (which duplicate per-face) and touching parts are treated as shared.
   For each face, its 3 edges become an unordered key `min|max` of the two endpoint pos-keys; accumulate
   `edgeMap: key → { faces: number[], len: number }` (`len` = the edge's world length, computed once).
3. **Union across non-breaking interior edges.** Union-Find over faces. For each edge shared by **exactly two**
   faces `f,g` (skip boundary/non-manifold edges where `faces.length ≠ 2`): **skip** (do not union) if
   `band[f] ≠ band[g]`; else compute `concave = (centroidG − centroidF)·normalF > 0` and
   `magnitude = 1 − clamp(normalF·normalG, −1, 1)`, and **skip** if `concave && magnitude > GEO_CONCAVITY` (a strong
   concave crease is a natural seam); otherwise `union(f,g)`. Connected components = initial regions, relabeled to
   contiguous ids `0..R−1` (`regionOfFace: Int32Array`).
4. **Merge sub-threshold + cap** (iterative, recomputed each pass — region counts are small):
   - `area[r] = Σ face areas`; `total = Σ area`. Region adjacency `adj: Map<r, Map<r, boundaryLen>>` from
     cross-region interior edges (accumulate `edge.len` per region pair, both directions).
   - **Sub-threshold pass:** if any region has `area[r]/total < GEO_MIN_REGION_RATIO` **and** has ≥1 neighbor,
     take the smallest such (tie → lowest id) and merge it into its **best neighbor** (largest shared boundary
     length; tie → lowest id), i.e. rewrite `regionOfFace[f] === r → dst`. Recompute and repeat.
   - **Cap pass:** while active-region count `> maxParts`, merge the smallest-area region that has ≥1 neighbor
     into its best neighbor. Recompute and repeat.
   - Compact labels to `0..k−1` and return `Int32Array`.

**Deferred (documented):** the outline's "split a dominant oversized region" is **not** implemented in v1 — it is
fuzzy to specify and to test honestly, and the reviewable-gizmo UX plus fit-to-printer's grid cuts cover the
"featureless oversized part" case. Auto-split v1 suggests seams at **geometric features** (SDF/concavity changes);
a single convex blob with no features yields one region and therefore no seams (use fit-to-printer for pure size
reduction). This scope is stated in the C-M2 smoke doc.

## File structure (C-M2)

- Create `src/lib/cut/segment/regions.ts` — `segmentFaces` + internal `SegmentOptions`, `posKey`, `DSU`, `triIndices`.
- Test `tests/cut/segment/regions.test.ts`.

---

### Task 1: `segmentFaces` — bands + concavity → components + merge/cap

**Files:**
- Create: `src/lib/cut/segment/regions.ts`
- Test: `tests/cut/segment/regions.test.ts`

**Interfaces:**
- Consumes: `computeSDF`'s `Float32Array` (one value per face; may contain `0` for no-hit faces).
- Produces: `segmentFaces(geometry: THREE.BufferGeometry, sdf: Float32Array, opts: SegmentOptions): Int32Array`
  (one contiguous region label `0..k−1` per face). `SegmentOptions = { maxParts: number; detail: number }`.
  Adjacency is by **welded vertex position**, so non-indexed geometry (per-face-duplicated verts) works.

- [ ] **Step 1: Write the failing test**

```ts
// tests/cut/segment/regions.test.ts
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { segmentFaces } from "../../../src/lib/cut/segment/regions";

/**
 * A flat "barbell strip" of `cols-1` quads along X (each quad = 2 triangles), sharing welded edges.
 * `sdfPerQuad[q]` is the synthetic SDF applied to both triangles of quad q. Returns { geometry, sdf }.
 * Optional `crumb`: appends one tiny triangle on quad 0's left edge with its own sdf (its own band).
 */
function barbellStrip(sdfPerQuad: number[], crumb?: { sdf: number; width: number }) {
  const cols = sdfPerQuad.length + 1;
  const verts: number[] = [];
  const sdf: number[] = [];
  const tri = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => {
    verts.push(ax, ay, 0, bx, by, 0, cx, cy, 0);
  };
  for (let q = 0; q < sdfPerQuad.length; q++) {
    // quad q spans x=q..q+1, y=0..1; CCW from +Z ⇒ normal +Z
    tri(q, 0, q + 1, 0, q + 1, 1);
    tri(q, 0, q + 1, 1, q, 1);
    sdf.push(sdfPerQuad[q], sdfPerQuad[q]);
  }
  if (crumb) {
    // tiny triangle sharing quad-0's left edge (0,0)-(0,1), apex at x=-width
    tri(0, 0, 0, 1, -crumb.width, 0.5);
    sdf.push(crumb.sdf);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  return { geometry: geom, sdf: new Float32Array(sdf), cols };
}

/** Two triangles sharing edge (0,0,0)-(0,1,0); ridge at z=dir. dir=+1 convex fold, dir=-1 concave valley. */
function foldPair(dir: 1 | -1) {
  const R0 = [0, 0, dir], R1 = [0, 1, dir];
  const L0 = [-1, 0, 0], Rr0 = [1, 0, 0];
  const verts = [
    ...L0, ...R0, ...R1,      // left tri
    ...R1, ...R0, ...Rr0,     // right tri
  ];
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  return { geometry: geom, sdf: new Float32Array([1, 1]) }; // same band ⇒ only concavity can split
}

const distinct = (labels: Int32Array) => new Set(Array.from(labels)).size;

describe("segmentFaces", () => {
  it("splits a thin-middle barbell into 3 regions (two ends + bar), by SDF band", () => {
    const { geometry, sdf } = barbellStrip([1, 1, 0.1, 0.1, 1, 1]); // ends thick, middle thin
    const labels = segmentFaces(geometry, sdf, { maxParts: 64, detail: 0.45 });
    expect(distinct(labels)).toBe(3);
    // both triangles of quad 0 share a label; quad 0 (left end) differs from quad 2 (bar) and quad 5 (right end)
    expect(labels[0]).toBe(labels[1]);
    expect(labels[0]).not.toBe(labels[4]);  // quad 2 (bar) tri
    expect(labels[0]).not.toBe(labels[10]); // quad 5 (right end) tri
  });

  it("respects maxParts by merging down to the cap", () => {
    const { geometry, sdf } = barbellStrip([1, 1, 0.1, 0.1, 1, 1]);
    const labels = segmentFaces(geometry, sdf, { maxParts: 2, detail: 0.45 });
    expect(distinct(labels)).toBe(2);
  });

  it("merges a tiny sub-threshold crumb into its neighbor", () => {
    const { geometry, sdf } = barbellStrip([1, 1, 0.1, 0.1, 1, 1], { sdf: 0.5, width: 0.02 });
    const labels = segmentFaces(geometry, sdf, { maxParts: 64, detail: 0.45 });
    const crumbFace = labels.length - 1; // appended last
    expect(distinct(labels)).toBe(3);        // crumb absorbed ⇒ back to the 3 natural regions
    expect(labels[crumbFace]).toBe(labels[0]); // merged into quad-0's region
  });

  it("cuts a region at a strong concave crease, not at a convex fold", () => {
    expect(distinct(segmentFaces(foldPair(1).geometry, new Float32Array([1, 1]), { maxParts: 64, detail: 0.45 }))).toBe(1);
    expect(distinct(segmentFaces(foldPair(-1).geometry, new Float32Array([1, 1]), { maxParts: 64, detail: 0.45 }))).toBe(2);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (module not found)

Run: `npx vitest run tests/cut/segment/regions.test.ts`

- [ ] **Step 3: Implement**

```ts
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
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/cut/segment/regions.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/cut/segment/regions.ts tests/cut/segment/regions.test.ts
git commit -m "feat(segment): segmentFaces — SDF-band + concavity region segmentation with merge/cap"
```

- [ ] **Step 6: Verify + smoke doc**

Run: `npm run test && npm run typecheck && npm run build:web && npm run build` → all PASS.
Write `docs/p6-m2-regions-smoke-test.md`: the region core is unit-tested (barbell → 3 regions, `maxParts` cap,
crumb merge, concave-vs-convex crease). Document the **deferred dominant-split** scope note (auto-split suggests
seams at geometric features; featureless oversized parts use fit-to-printer). Commit:
```bash
git add docs/p6-m2-regions-smoke-test.md
git commit -m "docs(p6-m2): regions smoke checklist + deferred dominant-split scope note"
```

- [ ] **STOP — pause for user review before C-M3.**

# C-M3 — Seam planes + worker + UI

The integration milestone: fit a **cut plane per region boundary** (`seamPlanes`), compose the full
`segmentCuts` pipeline, expose it through a `segment` worker case + `runSegment` client, and wire an **Auto-Split**
button into the **existing** suggested-cut modal (`setSuggestedCuts` → the "Will add N cuts" panel →
`performCutsSequential`). Nothing in the cut/connector/apply engine changes.

## Verified integration points (read before starting)

- **`CutPlaneSpec = { normal: [number,number,number]; constant: number; axisSnap: "x"|"y"|"z"|"free" }`**
  (`src/types/index.ts:94`). Auto-split emits `axisSnap: "free"`; `constant = normal · pointOnPlane`.
- **Worker** (`src/workers/cut-worker.ts`): `CutWorkerRequest`/`CutWorkerResponse` unions + `self.onmessage`.
  Line 88 builds `const mesh = meshFromSerializedGeometry(e.data.meshGeometry)` for every non-`testfit` op; the
  `separate` branch (lines 90–99) is the template. Manifold (`getWorkerManifold`) is already awaited at the top —
  `segment` doesn't need it but the await is harmless.
- **Client** (`src/lib/cut/cut-client.ts`): `runSeparate(mesh)` (lines 82–93) is the exact template —
  `serializeMeshForWorker(mesh)` → `submit(req, transfer, pick)`. `submit`'s `pick` receives the `ok:true` response.
- **App** (`src/App.tsx`): `suggestedCuts` state (line 62: `{ partId: PartId; cuts: CutPlaneSpec[] } | null`),
  `onSuggestCuts` (lines 328–342) sets it, and the modal (lines 587–604) renders "Will add N cuts" + Apply →
  `session.performCutsSequential(partId, cuts, { count: 4, diameter: 5, length: 20, tolerance: "pla-tight" })`.
  Auto-split calls the identical `setSuggestedCuts(...)` — do NOT build a new modal/apply path.

## File structure (C-M3)

- Create `src/lib/cut/segment/seam-planes.ts` — `seamPlanes` + `segmentCuts` (+ internal `triIndices`, `posKey`, PCA).
- Test `tests/cut/segment/seam-planes.test.ts`.
- Modify `src/workers/cut-worker.ts` — add the `segment` request/response variants + dispatch branch.
- Modify `src/lib/cut/cut-client.ts` — add `runSegment`.
- Test `tests/cut/segment/free-plane-cut.test.ts` — the spec's open risk (a `"free"` plane cuts cleanly).
- Modify `src/components/StatusBar.tsx` + `src/App.tsx` — Auto-Split button + `onAutoSplit` + Max-parts/Detail knobs.

---

### Task 1: `seamPlanes` + `segmentCuts`

**Files:**
- Create: `src/lib/cut/segment/seam-planes.ts`
- Test: `tests/cut/segment/seam-planes.test.ts`

**Interfaces:**
- Consumes: `segmentFaces` + `computeSDF` (this package), `CutPlaneSpec` (`../../../types`), `SegmentOptions`.
- Produces:
  - `seamPlanes(geometry: THREE.BufferGeometry, labels: Int32Array): CutPlaneSpec[]` — one best-fit plane per
    adjacent region pair (`axisSnap: "free"`), near-coincident planes deduped, non-separating planes dropped.
  - `segmentCuts(geometry: THREE.BufferGeometry, opts: SegmentOptions): CutPlaneSpec[]` =
    `seamPlanes(geometry, segmentFaces(geometry, computeSDF(geometry), opts))`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/cut/segment/seam-planes.test.ts
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { seamPlanes, segmentCuts } from "../../../src/lib/cut/segment/seam-planes";

/** Per-face labels from face-centroid Z against ascending thresholds (0,1,2,... by band). */
function labelByZ(geom: THREE.BufferGeometry, thresholds: number[]): Int32Array {
  const pos = geom.attributes.position as THREE.BufferAttribute;
  const idx = geom.index!;
  const faceCount = idx.count / 3;
  const labels = new Int32Array(faceCount);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let f = 0; f < faceCount; f++) {
    a.fromBufferAttribute(pos, idx.getX(f * 3));
    b.fromBufferAttribute(pos, idx.getX(f * 3 + 1));
    c.fromBufferAttribute(pos, idx.getX(f * 3 + 2));
    const cz = (a.z + b.z + c.z) / 3;
    let band = 0;
    for (const t of thresholds) if (cz > t) band++;
    labels[f] = band;
  }
  return labels;
}

describe("seamPlanes", () => {
  it("fits one horizontal plane to a box split at z=0", () => {
    const geom = new THREE.BoxGeometry(2, 2, 2, 1, 1, 2); // faces above/below z=0 on the walls
    const labels = labelByZ(geom, [0]);
    const planes = seamPlanes(geom, labels);
    expect(planes.length).toBe(1);
    expect(Math.abs(planes[0].normal[2])).toBeGreaterThan(0.99); // normal ≈ ±Z
    expect(Math.abs(planes[0].constant)).toBeLessThan(0.05);     // passes through z≈0
    expect(planes[0].axisSnap).toBe("free");
  });

  it("returns no planes for a single-region (uniform label) mesh", () => {
    const geom = new THREE.BoxGeometry(2, 2, 2, 1, 1, 2);
    const labels = new Int32Array((geom.index!.count / 3)).fill(0);
    expect(seamPlanes(geom, labels)).toEqual([]);
  });

  it("keeps two parallel seams distinct (no over-dedupe)", () => {
    const geom = new THREE.BoxGeometry(2, 2, 3, 1, 1, 3); // walls split at z=-0.5 and z=+0.5
    const labels = labelByZ(geom, [-0.5, 0.5]);
    const planes = seamPlanes(geom, labels);
    expect(planes.length).toBe(2);
    for (const p of planes) expect(Math.abs(p.normal[2])).toBeGreaterThan(0.99);
  });

  it("fits an oblique plane (validates free-orientation PCA, not just axis-aligned)", () => {
    const geom = new THREE.BoxGeometry(2, 2, 2, 1, 1, 2);
    const labels = labelByZ(geom, [0]);          // label BEFORE rotating
    const R = new THREE.Matrix4().makeRotationX(Math.PI / 6);
    geom.applyMatrix4(R);                          // seam ring z=0 → rotated plane
    const planes = seamPlanes(geom, labels);
    expect(planes.length).toBe(1);
    const expected = new THREE.Vector3(0, 0, 1).applyMatrix4(R).normalize(); // (0,-0.5,0.866)
    const n = new THREE.Vector3(...planes[0].normal);
    expect(Math.abs(n.dot(expected))).toBeGreaterThan(0.99); // aligned up to sign
  });
});

describe("segmentCuts", () => {
  it("composes SDF → regions → planes and returns a CutPlaneSpec[] without throwing", () => {
    const geom = new THREE.BoxGeometry(4, 4, 4);
    const planes = segmentCuts(geom, { maxParts: 8, detail: 0.45 });
    expect(Array.isArray(planes)).toBe(true);
    for (const p of planes) {
      expect(p.axisSnap).toBe("free");
      expect(p.normal).toHaveLength(3);
    }
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (module not found)

Run: `npx vitest run tests/cut/segment/seam-planes.test.ts`

- [ ] **Step 3: Implement**

```ts
// src/lib/cut/segment/seam-planes.ts
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
```

- [ ] **Step 4: Run — expect PASS**  ·  `npx vitest run tests/cut/segment/seam-planes.test.ts`
- [ ] **Step 5: Commit** — `git add src/lib/cut/segment/seam-planes.ts tests/cut/segment/seam-planes.test.ts && git commit` with
  `feat(segment): seamPlanes + segmentCuts — fit a cut plane per region boundary (free orientation)`
- [ ] **STOP is at the end of C-M3, not here — continue to Task 2.**

---

### Task 2: `segment` worker case + `runSegment` client

**Files:**
- Modify: `src/workers/cut-worker.ts`, `src/lib/cut/cut-client.ts`
- Test: `tests/cut/segment/run-segment.test.ts`

**Interfaces:**
- Produces: `runSegment(mesh: THREE.Mesh, opts: { maxParts: number; detail: number }): Promise<CutPlaneSpec[]>`.
- Worker: `CutWorkerRequest` gains `{ reqId; op: "segment"; meshGeometry; opts: { maxParts: number; detail: number } }`;
  `CutWorkerResponse` gains `{ reqId; ok: true; planes: CutPlaneSpec[] }`.

- [ ] **Step 1: Write the failing test** — mock the worker at the module boundary the same way existing
  `cut-client` tests do (check `tests/` for the pattern: the worker is replaced so `submit` resolves a canned
  response). Assert `runSegment` posts an `op:"segment"` request and resolves the response's `planes`.

```ts
// tests/cut/segment/run-segment.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as THREE from "three";

// Mirror the existing cut-client worker mock (see tests/**/cut-client*.test.ts for the exact shape).
// The mock Worker captures the posted request and replies with a canned { ok, planes }.
let lastReq: any = null;
class MockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  postMessage(req: any) {
    lastReq = req;
    queueMicrotask(() =>
      this.onmessage?.({ data: { reqId: req.reqId, ok: true, planes: [{ normal: [0, 0, 1], constant: 0, axisSnap: "free" }] } } as MessageEvent),
    );
  }
  terminate() {}
}
vi.stubGlobal("Worker", MockWorker as any);

import { runSegment } from "../../../src/lib/cut/cut-client";

beforeEach(() => { lastReq = null; });

describe("runSegment", () => {
  it("posts an op:segment request and resolves planes", async () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const planes = await runSegment(mesh, { maxParts: 8, detail: 0.45 });
    expect(lastReq.op).toBe("segment");
    expect(lastReq.opts).toEqual({ maxParts: 8, detail: 0.45 });
    expect(planes).toEqual([{ normal: [0, 0, 1], constant: 0, axisSnap: "free" }]);
  });
});
```

> **Spike note:** confirm the ACTUAL existing worker-mock pattern in the repo's cut-client tests and mirror it
> exactly (global stub vs. `vi.mock` of the worker URL). Do not invent a new harness.

- [ ] **Step 2: Run — expect FAIL** (`runSegment` not exported)
- [ ] **Step 3: Implement**
  - In `cut-worker.ts`: add the two union variants; add a dispatch branch after `const mesh = meshFromSerializedGeometry(...)`
    (mirror `separate`): `if (e.data.op === "segment") { const planes = segmentCuts(mesh.geometry as THREE.BufferGeometry, e.data.opts); (self as any).postMessage({ reqId, ok: true, planes } satisfies CutWorkerResponse); return; }` and
    `import { segmentCuts } from "../lib/cut/segment/seam-planes";`. Planes are plain objects — no transferables.
  - In `cut-client.ts`: add
    ```ts
    export async function runSegment(mesh: THREE.Mesh, opts: { maxParts: number; detail: number }): Promise<CutPlaneSpec[]> {
      const reqId = nextReqId++;
      const { meshGeometry, transfer } = serializeMeshForWorker(mesh);
      const req: CutWorkerRequest = { reqId, op: "segment", meshGeometry, opts };
      return submit(req, transfer, (resp) => {
        if ("planes" in resp) return resp.planes;
        throw new Error("Unexpected response for segment request");
      });
    }
    ```
- [ ] **Step 4: Run — expect PASS**
- [ ] **Step 5: Commit** — `feat(segment): segment worker case + runSegment client bridge`

---

### Task 3: Free-plane cut verification (the spec's open risk)

**Files:**
- Test: `tests/cut/segment/free-plane-cut.test.ts`

**Interfaces:** Consumes the existing worker `cut` op via `runCut(mesh, plane, dowels, tolerance)` — NO new code.
This task is a pure regression guard proving an `axisSnap:"free"` (non-axis-aligned) plane cuts cleanly through
`planeCutMesh` + dowel placement, since every prior cut used axis snaps.

- [ ] **Step 1: Write the test** — cut a box with an oblique plane (`normal` a normalized non-axis vector, e.g.
  `(1,1,1)/√3`, `constant: 0`) plus one auto dowel; assert two non-empty parts come back and (if a dowel was
  requested and fits) a dowel piece. Use the SAME worker-integration test style as the existing `runCut` tests —
  if those run against the real Manifold worker they may be slow/gated; if the repo has a Manifold-in-worker test
  already, mirror its setup. If real-worker cuts are not unit-testable in this repo, instead unit-test
  `planeCutMesh` (`src/lib/cut/plane-cut.ts`) directly with an oblique `CutPlaneSpec` and assert both output
  manifolds are non-empty (`!isEmpty()`), matching that module's existing tests.

> **Spike note:** FIRST inspect how `plane-cut.ts` / `runCut` are currently tested. Reuse that harness (real
> Manifold vs. mock). The assertion that matters: an oblique plane yields two valid, non-empty parts. Do not add a
> slow real-Manifold test if the repo keeps those out of the default suite — prefer the `planeCutMesh` unit level.

- [ ] **Step 2–4:** Run (expect FAIL if a helper is missing, else it may pass immediately — that's fine, it's a
  guard), keep the assertion meaningful (non-empty parts), PASS.
- [ ] **Step 5: Commit** — `test(segment): oblique free-plane cut produces two valid parts (Gap C open risk)`

---

### Task 4: Auto-Split button + App wiring

**Files:**
- Modify: `src/components/StatusBar.tsx` (add the button next to "Suggest cuts"), `src/App.tsx` (`onAutoSplit` + knobs state).
- Test: extend a Toolbar/StatusBar test (or add `tests/components/auto-split-button.test.tsx`) asserting the button
  invokes its handler.

**Interfaces:**
- `StatusBarProps` gains `onAutoSplit?: () => void;` rendered as an "Auto-Split" button in `FitIndicator`
  alongside the existing `Suggest cuts` button (same styling).
- `App.tsx` gains `onAutoSplit` (a `useCallback`) + two knob states `autoSplitMaxParts` (default 8) and
  `autoSplitDetail` (default 0.45). It picks the target part (the first visible non-dowel part — reuse the
  `onSuggestCuts` selection loop, but WITHOUT the `fitsInPrinter` gate, since a user may auto-split a fitting
  model), calls `runSegment(mesh, { maxParts, detail })`, and on success `setSuggestedCuts({ partId, cuts: planes })`.
  The existing modal + `performCutsSequential` apply the result unchanged.

- [ ] **Step 1: Write the failing test** — render `StatusBar` (or the extracted `FitIndicator`) with an
  `onAutoSplit` spy and `parts`/`printer` that surface the control; fire a click; assert the spy ran. Follow the
  existing StatusBar/component test pattern in `tests/`.
- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement**
  - `StatusBar.tsx`: add `onAutoSplit?: () => void` to `StatusBarProps` and `FitIndicator`'s props; render a second
    button `Auto-Split` next to `Suggest cuts` (guard `onAutoSplit &&`). Keep it visible whenever `onAutoSplit` is
    passed (not only when parts are too big).
  - `App.tsx`: add
    ```ts
    const [autoSplitMaxParts] = useState(8);
    const [autoSplitDetail] = useState(0.45);
    const onAutoSplit = useCallback(async () => {
      const target = session.partsArray.find((p) => p.meta.visible && !p.isDowel);
      if (!target) return;
      const mesh = target.group.children.find((c): c is THREE.Mesh => (c as THREE.Mesh).isMesh);
      if (!mesh) return;
      const planes = await runSegment(mesh, { maxParts: autoSplitMaxParts, detail: autoSplitDetail });
      if (planes.length > 0) setSuggestedCuts({ partId: target.id, cuts: planes });
    }, [session.partsArray, autoSplitMaxParts, autoSplitDetail]);
    ```
    Wire `onAutoSplit={onAutoSplit}` into the `<StatusBar .../>` render. Import `runSegment` from `cut-client`.
    (Confirm the actual way to get a part's `THREE.Mesh` from `RuntimePart` — inspect `partsArray[i].group`
    structure; `serializeMeshForWorker` needs the mesh with its `matrixWorld`. Match how `onSuggestCuts`/other
    handlers reach part geometry.) Max-parts/Detail sliders are optional polish — a default-valued `useState` is
    enough for v1; only add slider inputs if the existing modal has an obvious place for them.
- [ ] **Step 4: Run — expect PASS** (the click test)
- [ ] **Step 5: Commit** — `feat(autosplit): Auto-Split button → runSegment → suggested-cut preview`

---

### Task 5: Verify + smoke doc

- [ ] **Step 1:** `npm run test && npm run typecheck && npm run build:web && npm run build` → all PASS.
- [ ] **Step 2:** Write `docs/p6-m3-autosplit-smoke-test.md`: the button→`runSegment`→suggested-planes→apply
  round-trip; that suggested planes render as the existing Phase-3 gizmos and apply via `performCutsSequential`;
  the oblique free-plane cut guard; and a **manual GUI checklist** (load a limbed model, Auto-Split, review/adjust
  the amber gizmos, Apply, confirm printable parts + dowels) — the honest seam-quality caveat from the spec
  (imperfect seams are expected; the reviewable gizmos are the safety net).
- [ ] **Step 3: Commit** — `docs(p6-m3): auto-split smoke checklist + manual GUI review steps`
- [ ] **STOP — pause for user review before landing the Gap C PR.**

---

# C-M4 — Hardening (from final whole-branch review)

The final review found three Important integration/UX defects the single-plane tests missed. This milestone
fixes them **additively** — a dedicated auto-split apply path (the existing `performCutsSequential` for
fit-to-printer is left untouched), a segmentation busy state, and a printer-independent button.

## Verified problem (in the code)

`performCutsSequential` (`src/hooks/useCutSession.ts:177-208`) was built for fit-to-printer grid cuts: it cuts,
then **follows only the larger child** (`target = sizeA >= sizeB ? …`), and calls `push(working)` **only after
the whole loop succeeds**. Auto-split emits N **independent infinite planes** (one per region boundary, fitted in
the whole-mesh frame). On a branched/limbed model a later plane may not intersect the followed child →
`planeCutMesh` throws "does not intersect" → the `catch` discards **all** partial cuts. Auto-split needs its own
apply that (a) routes each plane to the leaf part it actually separates and (b) tolerates a plane that cuts
nothing (skip it, keep the rest).

---

### Task 1: tolerant, leaf-assigning auto-split apply

**Files:**
- Create: `src/lib/cut/plane-util.ts` — pure `planeSeparatesMesh`.
- Test: `tests/cut/plane-util.test.ts`.
- Modify: `src/hooks/useCutSession.ts` — add `performAutoSplitCuts` (expose it from the hook's return).
- Modify: `src/App.tsx` — the suggested-cut modal's Apply routes auto-split suggestions to the new method.

**Interfaces:**
- Produces: `planeSeparatesMesh(mesh: THREE.Mesh, plane: CutPlaneSpec): boolean` — true iff the mesh, in **world
  space** (`mesh.matrixWorld`), has vertices on both sides of the plane.
- Produces: `performAutoSplitCuts(rootPartId: PartId, planes: CutPlaneSpec[], dowelOpts): Promise<void>` on the
  `useCutSession` return, alongside `performCutsSequential`.
- `App.tsx` `suggestedCuts` state gains `source: "fit" | "autosplit"`; `onSuggestCuts` sets `"fit"`, `onAutoSplit`
  sets `"autosplit"`; the modal Apply calls `performAutoSplitCuts` when `source === "autosplit"`, else
  `performCutsSequential` (unchanged behavior for fit-to-printer).

- [ ] **Step 1: Write the failing test** (the pure decision helper — the apply loop itself is smoke-tested,
  it needs the real Manifold worker)

```ts
// tests/cut/plane-util.test.ts
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { planeSeparatesMesh } from "../../src/lib/cut/plane-util";

describe("planeSeparatesMesh", () => {
  const box = () => new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10));

  it("true when the plane passes through the mesh", () => {
    expect(planeSeparatesMesh(box(), { normal: [0, 0, 1], constant: 0, axisSnap: "free" })).toBe(true);
  });
  it("false when the mesh is entirely on one side", () => {
    expect(planeSeparatesMesh(box(), { normal: [0, 0, 1], constant: 100, axisSnap: "free" })).toBe(false);
  });
  it("respects world transform (offset mesh)", () => {
    const m = box();
    m.position.set(0, 0, 100);
    m.updateMatrixWorld(true);
    // plane at z=0 no longer cuts a box centred at z=100 (spans 95..105)
    expect(planeSeparatesMesh(m, { normal: [0, 0, 1], constant: 0, axisSnap: "free" })).toBe(false);
    // plane at z=100 does
    expect(planeSeparatesMesh(m, { normal: [0, 0, 1], constant: 100, axisSnap: "free" })).toBe(true);
  });
  it("handles an oblique plane through the centre", () => {
    const s = 1 / Math.sqrt(3);
    expect(planeSeparatesMesh(box(), { normal: [s, s, s], constant: 0, axisSnap: "free" })).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**  ·  `npx vitest run tests/cut/plane-util.test.ts`
- [ ] **Step 3: Implement**

```ts
// src/lib/cut/plane-util.ts
import * as THREE from "three";
import type { CutPlaneSpec } from "../../types";

/** True if the mesh (world space) has vertices on both sides of the plane — i.e. the plane would cut it. */
export function planeSeparatesMesh(mesh: THREE.Mesh, plane: CutPlaneSpec): boolean {
  const geom = mesh.geometry as THREE.BufferGeometry;
  const pos = geom.attributes.position as THREE.BufferAttribute;
  mesh.updateMatrixWorld(true);
  const n = new THREE.Vector3(plane.normal[0], plane.normal[1], plane.normal[2]);
  const v = new THREE.Vector3();
  let hasPos = false, hasNeg = false;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    const s = n.dot(v) - plane.constant;
    if (s > 1e-4) hasPos = true;
    else if (s < -1e-4) hasNeg = true;
    if (hasPos && hasNeg) return true;
  }
  return false;
}
```

  Then add `performAutoSplitCuts` to `useCutSession` (mirror `performCutsSequential` at lines 166-216, but with
  leaf routing + per-plane tolerance; child ids follow the existing `${target}_a`/`${target}_b` convention):

```ts
const performAutoSplitCuts = useCallback(
  async (
    rootPartId: PartId,
    planes: CutPlaneSpec[],
    defaultDowelOpts: { count: number; diameter: number; length: number; tolerance: TolerancePreset },
  ) => {
    if (planes.length === 0) return;
    setBusy(true);
    setError(null);
    let working = session;
    let leaves: PartId[] = [rootPartId];
    let applied = 0;
    try {
      for (const plane of planes) {
        const targetId = leaves.find((id) => {
          const p = working.parts.get(id);
          return p ? planeSeparatesMesh(p.mesh, plane) : false;
        });
        if (!targetId) continue; // no current leaf this plane cuts — skip it, keep the rest
        const part = working.parts.get(targetId)!;
        try {
          const dowels = autoPlaceCutDowels(part.mesh, plane, {
            count: defaultDowelOpts.count,
            dowelDiameter: defaultDowelOpts.diameter,
            length: defaultDowelOpts.length,
            minSpacing: 2,
          });
          const result = await runCut(part.mesh, plane, dowels, defaultDowelOpts.tolerance);
          const a = firstMeshAndGroup(result.partA);
          const b = firstMeshAndGroup(result.partB);
          if (!a || !b) continue;
          const dps = result.dowelPieces
            .map(firstMeshAndGroup)
            .filter((x): x is { mesh: THREE.Mesh; group: THREE.Group } => !!x);
          working = applyCutResult(working, targetId, `c${working.cuts.length + 1}`,
            { partA: a, partB: b, dowelPieces: dps }, part.meta.name);
          leaves = leaves.filter((id) => id !== targetId).concat([`${targetId}_a` as PartId, `${targetId}_b` as PartId]);
          applied++;
        } catch {
          // this plane failed to cut its leaf — skip it, preserve prior cuts
        }
      }
      if (applied > 0) {
        syncSessionColors(working);
        push(working);
      }
    } finally {
      setBusy(false);
    }
  },
  [session, push],
);
```

  Return `performAutoSplitCuts` from the hook. In `App.tsx`: add `source` to `suggestedCuts` state
  (`{ partId; cuts; source: "fit" | "autosplit" }`); `onSuggestCuts` → `source: "fit"`, `onAutoSplit` →
  `source: "autosplit"`; the modal Apply (lines 587-604) branches:
  `suggestedCuts.source === "autosplit" ? session.performAutoSplitCuts(...) : session.performCutsSequential(...)`.

- [ ] **Step 4: Run — expect PASS** (plane-util test) + full suite green.
- [ ] **Step 5: Commit** — `fix(autosplit): dedicated tolerant leaf-assigning apply — skip non-intersecting planes`

---

### Task 2: busy state during segmentation

**Files:** Modify `src/App.tsx` (+ the spinner condition).

- [ ] Add `const [segmenting, setSegmenting] = useState(false)` in `App`; in `onAutoSplit`, wrap the `runSegment`
  call: `setSegmenting(true)` before, `setSegmenting(false)` in a `finally`. OR the segmentation apply guard shows a spinner.
- [ ] Include `segmenting` in whatever drives the "Cutting…"/busy spinner (currently `session.busy`, ~App.tsx:545) —
  e.g. `const busy = session.busy || segmenting;` so the user gets immediate feedback on click.
- [ ] Verify + commit — `feat(autosplit): busy spinner while segmenting`

---

### Task 3: printer-independent Auto-Split button

**Files:** Modify `src/components/StatusBar.tsx`.

- [ ] Move the Auto-Split button OUT of `FitIndicator` (which early-returns when `!printer`). Render it in the main
  `StatusBar` row whenever `onAutoSplit` is set **and** there is a visible non-dowel part
  (`parts?.some((p) => p.visible && !p.isDowel)`), independent of printer state. Keep "Suggest cuts" inside
  `FitIndicator` (it genuinely needs a printer).
- [ ] Extend `tests/components/StatusBar.test.tsx`: Auto-Split fires its handler **with no printer set**.
- [ ] Verify + commit — `fix(autosplit): surface Auto-Split without a printer (segmentation is printer-independent)`

---

### Task 4: verify + smoke doc update

- [ ] `npm run test && npm run typecheck && npm run build:web && npm run build` → all PASS.
- [ ] Update `docs/p6-m3-autosplit-smoke-test.md` (or add `docs/p6-m4-hardening-smoke-test.md`): the tolerant apply
  (branched model → partial cuts preserved, non-intersecting planes skipped, no total abort); busy spinner on click;
  printer-independent button. Note the remaining **Minor** follow-ups (#4 dead knobs/doc, #5 dowel-length cap +
  `safeDowelLength` "free" axis, #6 collinear-boundary orientation) and the residual **over-cut** caveat (infinite
  planes can clip other features — the reviewable gizmos let the user delete a bad plane before applying).
- [ ] Commit — `docs(p6-m4): hardening smoke checklist + tracked minor follow-ups`
- [ ] **STOP — pause for user review before landing the Gap C PR.**

---

## Self-review (spec coverage)

- SDF per face (BVH ray-cone) → C-M1 ✅. Region-grow + concavity + merge/cap → C-M2 ✅. Seam→plane fit + worker + UI → C-M3 ✅.
- Web-tier, worker, no cut-engine change → all modules pure + one worker case ✅. Reuse `suggestedCuts`/`performCutsSequential` → C-M3 ✅.
- Knobs = Max parts + Detail; concavity/thresholds constants → Global Constraints + C-M2/M3 ✅.
- Reviewable gizmos (risk mitigation) = existing Phase-3 preview → C-M3 ✅. `axisSnap:"free"` verification → C-M3 explicit ✅.
- Both builds + tuple discipline → Global Constraints ✅.
