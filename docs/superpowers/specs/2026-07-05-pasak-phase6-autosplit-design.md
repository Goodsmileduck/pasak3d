# Pasak Phase 6 (Gap C) — Auto-Split Segmentation Design

**Date:** 2026-07-05
**Status:** Approved (ready for implementation plans)
**Builds on:** Phases 1–3 on `main` (v0.3.0) — the joint/connector cut pipeline + the fit-to-printer
suggested-cut preview/apply flow. Independent of Gap B (branches off `main`).
**Motivation:** [`../../2026-07-02-audja-teardown-capability-map.md`](../../2026-07-02-audja-teardown-capability-map.md)
§2 + §8.5 item 2 — Audja's headline "Auto-Split" segmenter (the geometric "where to cut" algorithm).
This is **Gap C**, the final gap of the roadmap (A locking key ✅ → B native geometry ✅ → **C auto-split**).
**Scope:** Web tier — a client-side SDF region-growing segmenter in the cut worker that emits geometry-aware
**suggested cut planes** into the existing preview/apply pipeline. No native, no new deps, no cut-engine rewrite.

## Summary

Add **Auto-Split**: an analysis that finds where a model naturally divides (limbs, protrusions, thin necks)
and **suggests cut planes** at those seams — a geometry-aware replacement for today's grid-based fit-to-printer
suggestion. It runs 100% client-side in a Web Worker, BVH-accelerated, and feeds the **existing**
`suggestedCuts` → bed-cut-preview (Phase 3) → `performCutsSequential` apply flow. The user reviews the
suggested planes as editable gizmos and applies them through the proven plane-cut + connector pipeline.

### Locked decisions (with user)

| # | Decision | Choice |
|---|---|---|
| 1 | Tier | **Web** — SDF ray-casts use the existing `three-mesh-bvh` BVH; runs in the cut worker with a progress UI. Keeps the headline feature in the free funnel + 100% client-side. |
| 2 | Output/integration | **Suggested cut PLANES** (Option A) — fit a best-plane per region seam → `CutPlaneSpec[]` into the existing `suggestedCuts` flow. Reuses Phases 1–3 entirely. True non-planar region extraction is deferred. |
| 3 | Review UX | **Reviewable** — suggested planes render as the Phase-3 bed-cut gizmos the user accepts/adjusts/deletes before applying. Human-in-the-loop safety net for imperfect seams. |
| 4 | Knobs (v1) | **Max parts** + a **Detail** (granularity) slider. `geoConcavity` + merge thresholds are tuned constants (the §2 defaults). YAGNI on the full 15-param set. |

## Context (existing code this builds on)

- **`src/lib/bvh.ts`** — `attachBVH(group)` patches `three-mesh-bvh` (`computeBoundsTree`, `acceleratedRaycast`)
  onto meshes. SDF = cast a cone of inward rays per face and measure the distance to the far surface; the BVH
  makes the millions of casts tractable.
- **`src/workers/cut-worker.ts`** — a `CutWorkerRequest` discriminated union (`cut`/`separate`/`label`/`testfit`
  cases) with `self.onmessage` dispatch + transferable responses. Auto-split adds a `segment` case.
- **`suggestCuts(bbox, printer): CutPlaneSpec[]`** (`src/lib/cut/fit-to-printer.ts`) + App's
  `suggestedCuts: { partId, cuts: CutPlaneSpec[] }` state + `onSuggestCuts` + the "Will add N cuts" panel +
  **`session.performCutsSequential(partId, cuts, dowelOpts)`** already applies an array of planes sequentially.
  Auto-split is a second suggestion **source** feeding the identical state and apply path.
- **`CutPlaneSpec = { normal: [number,number,number]; constant: number; axisSnap: "x"|"y"|"z"|"free" }`** — auto-split
  emits `axisSnap: "free"` planes (arbitrary orientation, not axis-aligned).
- **Phase 3 `SuggestedCutPlanes`** renders any `CutPlaneSpec[]` as translucent gizmos — the review UI is done.
- **Worker/large-mesh conventions** — parsers run sync; the app warns on `>1M tris` / `>100MB` (web). Auto-split
  is a one-time analysis in the worker with a progress bar, subject to the same memory reality.

## The algorithm (§2, reverse-engineered)

A **geometric region-growing segmenter** (not ML — see §2). Pipeline, all in the worker:

1. **SDF per face** — for each face centroid, cast a cone of rays (~30, half-angle ~30°) around the **inward**
   normal; via the BVH, take the median hit distance = local object diameter (thickness). Pose-invariant.
   Normalize + smooth SDF across adjacent faces.
2. **Seed + region-grow** — seed regions from SDF clusters (seed density ← `Detail`/`geoGranularity` 0.45);
   grow across the face adjacency graph, with boundary cost weighted by **concavity** (`geoConcavity` 0.28) so
   region borders prefer concave creases (dihedral angle) — the natural cut lines.
3. **Merge + cap** — iteratively merge regions below `geoMinRegionRatio` / crumb thresholds into their best
   neighbor (the "small regions merge into a neighbor" pass), split any dominant oversized region, smooth the
   seams, and cap the count at **Max parts** (`geoMaxParts` 64). Output = a **face→region label** array.
4. **Seams → planes** — for each pair of adjacent regions sharing a boundary edge-loop, fit a **best plane**
   (PCA / least-squares on the loop vertices) → a `CutPlaneSpec` (`normal`, `constant`, `axisSnap:"free"`).
   Dedupe near-coincident planes; drop planes that don't actually separate the mesh.

## Architecture

```
Auto-Split button (Toolbar / near "Suggest cuts")
        │  active part's geometry (verts + indices, transferable)
        ▼
cut-worker  →  new "segment" case
        │  segmentCuts(geometry, { maxParts, detail }): CutPlaneSpec[]
        │    src/lib/cut/segment/sdf.ts          (SDF per face — BVH ray cone)
        │    src/lib/cut/segment/regions.ts      (seed → grow → merge → labels)
        │    src/lib/cut/segment/seam-planes.ts  (region boundaries → best-fit CutPlaneSpec[])
        ▼  postMessage(CutPlaneSpec[]) + progress messages
App: setSuggestedCuts({ partId, cuts })   ──→  EXISTING Phase-3 preview + "Will add N cuts" panel
                                                 + session.performCutsSequential(...)   [all reused]
```

New pure modules under `src/lib/cut/segment/`; a `segment` worker case + client call; one Toolbar button +
a small params popover (Max parts + Detail). Zero changes to the cut/connector/apply pipeline.

## Milestones

Each ends with `npm run test` + `typecheck` + `build:web` + `build`, a `docs/p6-mN-<name>-smoke-test.md`,
and a pause for review. The pure algorithm modules are the tested core; the worker/UI wiring is smoke-tested.

- **C-M1 — SDF per face.** `src/lib/cut/segment/sdf.ts`: `computeSDF(geometry, opts): Float32Array` (one value
  per face) via a BVH inward ray-cone. Unit-tested: a thin slab gives small SDF, a thick block large; a known
  cylinder's SDF ≈ its diameter. The foundation + the perf-critical step.
- **C-M2 — Region growing + merge.** `src/lib/cut/segment/regions.ts`: `segmentFaces(geometry, sdf, opts):
  Int32Array` (face→region label). Seed by SDF, grow with concavity-weighted adjacency, merge sub-threshold
  regions, cap at `maxParts`. Unit-tested: a dumbbell/barbell mesh → the bar and two ends land in distinct
  regions; `maxParts` is respected; tiny regions get merged.
- **C-M3 — Seam planes + worker + UI.** `src/lib/cut/segment/seam-planes.ts`: `seamPlanes(geometry, labels):
  CutPlaneSpec[]` (best-fit plane per region boundary). Add the `segment` worker case + client call; an
  "Auto-Split" button + Max-parts/Detail control that runs it and calls `setSuggestedCuts`. Reuses the existing
  preview + `performCutsSequential`. Unit-test `seamPlanes` (two stacked boxes → one horizontal plane);
  smoke-test the button→suggestion→apply round-trip.

## Testing

- **Pure modules** (`sdf.ts`, `regions.ts`, `seam-planes.ts`) — fully unit-tested with small constructed
  geometries (slab, cylinder, dumbbell, stacked boxes), asserting SDF magnitudes, region counts/labels, and
  fitted-plane normal/constant. This is where correctness lives.
- **Worker `segment` case** — a client test mirroring the existing worker-op tests (mock/roundtrip), asserting
  it returns `CutPlaneSpec[]`.
- **UI** — the Auto-Split button fires its handler; params thread through (Toolbar/panel test harness).
- Full suite + `typecheck` + **both builds**. No cut-engine regressions (auto-split only *produces* planes).

## Out of scope (Phase 6 / Gap C)

- **True non-planar region extraction** (curved seams / `cloneRegion`) — deferred; v1 approximates seams as planes.
- **Auto-placed joints per seam** beyond what `performCutsSequential`'s dowel options already do (Audja's
  per-seam key params) — the applied cuts use the existing dowel/connector defaults; per-seam connector tuning is future.
- Full §2 parameter surface (only Max parts + Detail exposed); ML segmentation (Audja's is geometric — not needed).
- Desktop-native reimplementation for speed (web-worker is the v1 home; a native port is a possible follow-up).

## Risks

- **Seam quality / tuning is the real risk** — SDF + concavity thresholds producing *good, printable* seams is
  iterative and model-dependent. Mitigation: the reviewable-gizmo UX (accept/adjust/delete before applying) makes
  even imperfect suggestions useful; tune the constants against a few representative models in C-M2/C-M3; keep
  Max parts + Detail as escape hatches.
- **Performance on large meshes** — millions of BVH ray casts + adjacency passes in JS. Mitigation: worker +
  progress bar + the existing large-mesh warning; cap ray count; decimate-then-segment is a possible speedup
  (and Gap B's decimate exists on desktop). Document expected seconds-per-analysis.
- **Web memory** — very large meshes may OOM (existing constraint). The warning already fires; auto-split adds
  transient adjacency/SDF arrays (O(faces)).
- **Planar approximation** — a strongly non-planar natural seam yields a mediocre plane. Acceptable for v1
  (the user can reject/adjust); the honest limitation of Option A, documented in the smoke test.
- **`axisSnap:"free"` planes** through the cut pipeline — verify the plane-cut + cut-polygon + dowel placement
  handle arbitrary (non-axis-aligned) normals (they should — `CutPlaneSpec.normal` is already a free vector; the
  manual-cut path uses axis snaps but the geometry math is general). Confirm in C-M3.
