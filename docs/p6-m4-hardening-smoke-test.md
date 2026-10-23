# Phase 6 C-M4 Auto-Split Hardening Smoke Test

## Automated Coverage

- `tests/cut/plane-util.test.ts` covers `planeSeparatesMesh` for intersecting, non-intersecting, transformed, and oblique world-space planes.
- `tests/App.autosplit.test.tsx` verifies Auto-Split shows the busy spinner immediately while segmentation is still running.
- `tests/components/StatusBar.test.tsx` verifies Auto-Split fires with a printer selected and with no printer set.

## Hardened Apply Path

1. Load a branched, limbed, or multi-feature model with at least one visible non-dowel part.
2. Click `Auto-Split`.
3. Confirm the busy spinner appears while segmentation runs.
4. Review the amber suggested-cut gizmos before applying.
5. Click `Apply`.
6. Confirm auto-split applies via `performAutoSplitCuts`, not the fit-to-printer sequential path.
7. Confirm each suggested plane is routed to the current visible leaf part it separates.
8. Confirm a non-intersecting or failed plane is skipped without discarding earlier successful cuts.
9. Confirm partial cuts remain visible if a later auto-split plane cannot be applied.

Fit-to-printer suggestions still use `performCutsSequential`; C-M4 only changes auto-split apply behavior.

## Busy Spinner

1. Load any model with a visible non-dowel part.
2. Click `Auto-Split`.
3. Confirm the top `Cutting...` spinner appears immediately while `runSegment` is pending.
4. Confirm the spinner clears after segmentation resolves or errors.

## Button Placement

1. Load a model and leave the printer unset.
2. Confirm `Auto-Split` is visible in the status bar.
3. Click `Auto-Split` and confirm segmentation starts.
4. Set a printer and confirm `Suggest cuts` remains tied to the fit indicator.

## Tracked Minor Follow-Ups

- Minor #4: dead knobs/doc cleanup for the fixed `maxParts` and `detail` auto-split controls.
- Minor #5: dowel-length cap handling for auto-split and the `safeDowelLength` `axisSnap: "free"` case.
- Minor #6: collinear-boundary orientation stability in seam-plane fitting.

## Residual Caveat

Auto-split planes are infinite. A good seam plane can still over-cut unrelated nearby features on complex geometry. The reviewable suggested-cut gizmos are the safety valve: delete or cancel a bad plane before applying.
