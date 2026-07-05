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
    expect(distinct(segmentFaces(foldPair(1), new Float32Array([1, 1]), { maxParts: 64, detail: 0.45 }))).toBe(1);
    expect(distinct(segmentFaces(foldPair(-1), new Float32Array([1, 1]), { maxParts: 64, detail: 0.45 }))).toBe(2);
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

# C-M3 — Seam planes + worker + UI (outline)

Expand after C-M2 review. Locked interfaces:

- **Create `src/lib/cut/segment/seam-planes.ts`**: `seamPlanes(geometry, labels): CutPlaneSpec[]` — for each pair
  of adjacent regions, collect the shared boundary-edge vertices, fit a **best plane** (PCA / least-squares) →
  `{ normal, constant, axisSnap: "free" }`; dedupe near-coincident planes; drop planes that don't separate the mesh.
  Plus `segmentCuts(geometry, opts) = seamPlanes(geometry, segmentFaces(geometry, computeSDF(geometry), opts))`.
- **Worker/client:** add a `segment` case to `CutWorkerRequest`/`CutWorkerResponse` (`{ op:"segment", meshGeometry,
  opts } → { ok, planes: CutPlaneSpec[] }`) and `runSegment(mesh, opts): Promise<CutPlaneSpec[]>` in `cut-client.ts`
  (mirror `runSeparate`).
- **UI:** an "Auto-Split" Toolbar button + a Max-parts/Detail control; `onAutoSplit` runs `runSegment(activePart, opts)`
  and `setSuggestedCuts({ partId, cuts })` — the existing preview + "Will add N cuts" + `performCutsSequential` do the rest.
- **Verify** `axisSnap:"free"` planes cut cleanly through `planeCutMesh` + dowel placement (the spec's open risk).
- **Tests:** `seamPlanes` (two stacked boxes → one ~horizontal plane; empty for a single convex blob); worker `segment`
  roundtrip; Toolbar button fires its handler. Tasks: (1) `seamPlanes` + `segmentCuts` + tests; (2) worker case + `runSegment` + test;
  (3) Auto-Split button + App wiring + free-plane cut verification; (4) verify + `docs/p6-m3-*-smoke-test.md`; STOP.

---

## Self-review (spec coverage)

- SDF per face (BVH ray-cone) → C-M1 ✅. Region-grow + concavity + merge/cap → C-M2 ✅. Seam→plane fit + worker + UI → C-M3 ✅.
- Web-tier, worker, no cut-engine change → all modules pure + one worker case ✅. Reuse `suggestedCuts`/`performCutsSequential` → C-M3 ✅.
- Knobs = Max parts + Detail; concavity/thresholds constants → Global Constraints + C-M2/M3 ✅.
- Reviewable gizmos (risk mitigation) = existing Phase-3 preview → C-M3 ✅. `axisSnap:"free"` verification → C-M3 explicit ✅.
- Both builds + tuple discipline → Global Constraints ✅.
