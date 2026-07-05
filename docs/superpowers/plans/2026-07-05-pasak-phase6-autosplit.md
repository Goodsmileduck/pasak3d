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

# C-M2 — Region growing + merge (outline)

Expand to full TDD after C-M1 review. Locked interfaces:

- **Create `src/lib/cut/segment/regions.ts`**: `segmentFaces(geometry, sdf, opts): Int32Array` (per-face region
  label). Build face adjacency (shared edges); seed regions from SDF clusters (seed density ← `detail`/`geoGranularity`);
  region-grow across adjacency with boundary cost weighted by dihedral **concavity** (`geoConcavity`); iteratively
  merge regions below `geoMinRegionRatio`/crumb into their best neighbor; split a dominant oversized region; cap at
  `maxParts` (`geoMaxParts`). `opts = { maxParts: number; detail: number }`.
- **Tests** `tests/cut/segment/regions.test.ts`: a dumbbell/barbell mesh (two blocks joined by a thin bar) →
  the bar and the two ends land in **distinct** labels; `maxParts` respected; a tiny appended crumb merges away.
- Tasks: (1) face adjacency + `segmentFaces` seed/grow + test; (2) merge/cap/dominant-split + test; (3) verify + smoke doc; STOP.

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
