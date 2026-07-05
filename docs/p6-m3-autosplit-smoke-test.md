# Phase 6 C-M3 Auto-Split Smoke Test

## Automated Coverage

- `tests/cut/segment/seam-planes.test.ts` covers seam boundary detection, PCA free-plane fitting, dedupe behavior, and the full `segmentCuts` composition path.
- `tests/cut/segment/run-segment.test.ts` verifies `runSegment` posts `op: "segment"` with `{ maxParts, detail }` and resolves the worker's suggested `CutPlaneSpec[]`.
- `tests/cut/segment/free-plane-cut.test.ts` guards the open risk that an oblique `axisSnap: "free"` plane cuts a box into two non-empty Manifold parts.
- `tests/components/StatusBar.test.tsx` verifies the Auto-Split button invokes its handler from the status bar.

## Round Trip

1. Load a mesh with at least one visible non-dowel part.
2. Click `Auto-Split` in the status bar.
3. App selects the first visible non-dowel part and calls `runSegment(part.mesh, { maxParts: 8, detail: 0.45 })`.
4. The cut worker runs `segmentCuts`, which computes SDF, grows regions, fits seam planes, and returns `CutPlaneSpec[]` with `axisSnap: "free"`.
5. App stores the result in `suggestedCuts`.
6. The existing suggested-cuts modal opens with "Will add N cuts"; the amber Phase-3 gizmos preview the proposed planes.
7. Clicking `Apply` uses the existing `performCutsSequential(partId, cuts, { count: 4, diameter: 5, length: 20, tolerance: "pla-tight" })` path.

No new preview or apply engine is introduced. Auto-Split only produces suggested planes and reuses the existing review/apply path.

## Manual GUI Checklist

1. Load a limbed or multi-feature model.
2. Confirm a printer is selected.
3. Click `Auto-Split`.
4. Review the amber suggested-cut gizmos in the viewer.
5. Cancel and retry with another model if no planes are suggested.
6. Click `Apply`.
7. Confirm the result creates multiple visible non-dowel parts.
8. Confirm generated dowel pieces are present where cuts were applied.
9. Confirm exported parts remain printable after the existing auto-orient/export flow.

## Caveat

Seam quality is intentionally reviewable, not guaranteed. SDF segmentation and PCA seam planes can produce imperfect cuts on noisy, thin, non-manifold, or highly organic meshes. The safety net is the existing suggested-cuts preview: users should inspect and reject weak planes before applying.
