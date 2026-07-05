# P6-M2 — Region segmentation smoke checklist

**Milestone:** C-M2 — `segmentFaces(geometry, sdf, opts): Int32Array` (`src/lib/cut/segment/regions.ts`).
Connected-component segmentation over the welded face-adjacency graph, cut at SDF-band boundaries and strong
concave creases, then sub-threshold merge + cap at `maxParts`.

## What is unit-tested (the tested core)

`tests/cut/segment/regions.test.ts` — deterministic, no RNG, small hand-authored meshes:

- [x] **Barbell strip** (thick–thin–thick along X) → **3 regions**: two ends + the bar land in distinct labels,
      driven purely by SDF band. Both triangles of a quad share a label.
- [x] **`maxParts: 2`** on the same strip → merges down to exactly **2 regions** (cap pass).
- [x] **Tiny crumb** (sub-`geoMinRegionRatio` triangle, its own band) → **absorbed** into its neighbor
      (distinct count returns to 3; crumb's label == neighbor's).
- [x] **Concave vs convex fold** (same SDF band, only the crease sign differs): a strong **concave** crease
      splits into **2 regions**; a **convex** fold stays **1**. Confirms the concavity sign convention
      `(cG−cF)·nF > 0 ⇒ concave` and the `1 − nF·nG > geoConcavity(0.28)` magnitude gate.

## Tuned constants (not exposed; §2 defaults)

`geoConcavity 0.28` · `geoMinRegionRatio 0.0025` · band count `= clamp(round(2 + detail·10), 2, 12)`.
Only **Max parts** (`maxParts`) and **Detail** (`detail`, default `geoGranularity 0.45`) are user knobs (wired in C-M3).

## Deferred scope (documented, intentional)

- **Dominant-region split is NOT implemented in v1.** Auto-split suggests seams at **geometric features**
  (SDF/concavity changes). A single **convex, featureless blob** has no such features → **one region → no
  suggested seams**. For pure size reduction of a featureless oversized part, use **fit-to-printer** (grid cuts).
  The reviewable-gizmo UX (accept/adjust/delete) plus fit-to-printer cover this case; a feature-agnostic
  volumetric splitter is a possible follow-up.

## Notes / behavior

- **Adjacency is by welded vertex position** (`posKey`, round to `1e4`), so non-indexed geometry
  (loaders/primitives duplicate verts per face) and touching parts are handled uniformly. To be re-confirmed
  against a real imported mesh in C-M3.
- **`sdf = 0` faces** (no ray hit in C-M1) land in band 0 — tolerated, not special-cased.
- **Merge/cap is recompute-per-pass** (`aggregate()` re-scans faces + edges each merge). Region counts after
  banding are small, so the pass count is small; acceptable for v1. A mesh that banding shatters into very many
  tiny regions would make this slower — revisit if it shows up in C-M3 profiling on large meshes.

## Manual GUI check (deferred to C-M3)

Segmentation has no UI yet — it becomes visible/inspectable only once C-M3 wires the `segment` worker case, the
`runSegment` client call, and the Auto-Split button feeding the existing suggested-cut preview. The
end-to-end button→suggestion→apply round-trip is smoke-tested there.
