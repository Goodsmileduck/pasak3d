# Pasak Phase 3 — Orientation UX Design

**Date:** 2026-07-05
**Status:** Approved (ready for implementation plan)
**Builds on:** Phase 1 (joints) + Phase 2 (connectors) — `feat/phase2-connectors`
**Motivation:** [`../../2026-07-02-audja-teardown-capability-map.md`](../../2026-07-02-audja-teardown-capability-map.md)
§1.6 + build-order item 4 — orientation/print-prep feedback (overhang heatmap + bed-cut preview).
**Scope:** Web tier only (Three.js / R3F scene work; no geometry engine changes, no native, no new deps).

## Summary

Two print-prep feedback features, both in the R3F scene / UI layer (not the cut engine):

1. **Overhang heatmap** — color visible parts by overhang severity so the user can judge whether the
   current build orientation prints cleanly. Toggle + adjustable angle threshold.
2. **Bed-cut preview** — render the auto-suggested fit-to-printer cut planes as translucent gizmos in the
   scene before Apply (today the suggestion is text-only).

### Locked decisions (with user)

| # | Decision | Choice |
|---|---|---|
| 1 | Heatmap control | Toolbar **toggle** (off by default) + **threshold slider** (default 45°) + legend |
| 2 | Heatmap rendering | **Shader** — `MeshStandardMaterial` patched via `onBeforeCompile` (per-face, no recompute on orbit) |
| 3 | Bed-cut preview | **Read-only** translucent plane gizmos for the auto-suggested cuts (no drag) |
| 4 | Toggle placement | Toolbar, alongside the existing build-plate / exploded toggles |

## Context (existing code this builds on)

- **Z-up convention:** build plate at Z=0, up = +Z (CLAUDE.md). A face overhangs when its normal points
  downward — overhang angle = `max(angleFromUp − 90°, 0)` where `angleFromUp = acos(dot(n, +Z))`.
- **`suggestCuts(bbox, printer): CutPlaneSpec[]`** (`src/lib/cut/fit-to-printer.ts`) already computes the
  fit-to-printer planes; App stores `suggestedCuts: { partId, cuts: CutPlaneSpec[] }` and shows a text
  summary. Phase 3 adds the *visual* preview of those planes.
- **Scene:** `Viewer.tsx` (R3F canvas, `isDark` scene bg), parts rendered with `MeshStandardMaterial`
  colored from `RuntimePart.meta.color`. `CutPlane.tsx` already renders a translucent cut-plane gizmo —
  the bed-cut preview reuses that rendering approach.
- **`isDark` is for the WebGL scene only** (CLAUDE.md) — the heatmap ramp is self-colored and sits on the
  scene bg in both themes.

## Feature 1 — Overhang heatmap

### Pure core (testable)
The classification and color logic live in a pure module, independent of Three.js:

```ts
// src/lib/overhang.ts
/** Overhang severity of a face given its unit normal and the angle threshold (deg).
 *  0 = safe (face at/above threshold from horizontal-down), 1 = fully down-facing. Z is up. */
export function overhangSeverity(normal: [number, number, number], thresholdDeg: number): number;
/** Green→amber→red ramp for a 0..1 severity, as an [r,g,b] in 0..1. */
export function severityColor(t: number): [number, number, number];
```

`overhangSeverity`: compute `angleFromUp = acos(clamp(nz, -1, 1))` (nz = normal·+Z); `overhang =
angleFromUp − 90°`; faces with `overhang ≤ 0` (up/side-facing) are safe (0); faces steeper than the
threshold are severe (1); linear ramp between `0` and `(90° − threshold)` of downward tilt. Unit-tested for
down/up/side normals and the threshold boundary. The GLSL shader (below) mirrors this exact formula — a doc
comment ties them together so they can't silently drift.

### Rendering
`src/lib/heatmap-material.ts` — `makeHeatmapMaterial(threshold: number): THREE.Material`:
- Clone `MeshStandardMaterial`; in `onBeforeCompile`, inject a `uThreshold` uniform and a fragment snippet
  that computes overhang from the **world-space** normal (`vNormalW`, added via a small vertex-shader
  patch using `modelMatrix`) vs `+Z`, and sets the base color from the severity ramp. Keep the injected
  GLSL minimal and gated by clear markers. Expose `material.userData.setThreshold(deg)` to update the
  uniform without rebuilding.
- Rationale for shader over vertex-colors: overhang depends on the part's **world orientation**, not the
  camera, so it is stable during orbit and needs no recompute; per-fragment gives crisp faces on CAD
  geometry. (Vertex-colors would need non-indexed geometry + recompute on every re-orient.)

### UI + wiring
- **Toolbar toggle** "Overhang" (off by default), keyboard shortcut, styled like the existing
  build-plate/exploded toggles (Filament tokens). App owns `overhangOn: boolean` + `overhangThreshold: number`.
- When **on**: a compact **threshold slider** (15–89°, default 45°) + a **legend** (ramp swatch: Safe→Steep
  with the current angle) appear near the exploded-view slider. Visible non-dowel parts swap to the heatmap
  material; `setThreshold` updates live on slider drag.
- When **off**: restore each part's original `MeshStandardMaterial` (palette color from `meta.color`).
  Save/restore is explicit — the heatmap material is applied non-destructively (keep the original material
  reference; never lose the palette color).
- Dowels and the build plate are unaffected.

## Feature 2 — Bed-cut preview (read-only)

`src/components/SuggestedCutPlanes.tsx` — given the pending `{ partId, cuts: CutPlaneSpec[] }` and the
part's bbox, render each `CutPlaneSpec` as a **translucent plane** sized to the bbox cross-section, reusing
`CutPlane`'s plane material/rendering. Shown only while a suggestion is pending (between "Suggest cuts" and
Apply/Cancel). No interaction — purely a visual of where the splits land. App wires it into the Viewer when
`suggestedCuts` is set; clearing/Apply/Cancel removes it. `suggestCuts` and the apply flow are unchanged.

## Testing

Per existing conventions:
- `src/lib/overhang.ts` — `overhangSeverity` (down-facing = 1, up/side = 0, boundary at threshold,
  clamp behavior) + `severityColor` (endpoints + midpoint ordering). Pure, fully unit-tested.
- `heatmap-material.ts` — factory returns a material carrying the `uThreshold` uniform and a working
  `setThreshold` (assert the uniform value updates); no pixel testing.
- `SuggestedCutPlanes` — renders N plane meshes for N suggested cuts; none when empty (component test,
  existing R3F test harness style).
- Toolbar — "Overhang" toggle fires its handler (existing Toolbar test harness).
- Full suite + `typecheck` + both builds green.

## Milestones

Each ends with `npm run test` + `typecheck` + `build:web` + `build`, a `docs/p3-mN-<name>-smoke-test.md`,
and a pause for review.

- **P3-M1 — Overhang heatmap.** `overhang.ts` (pure, tested) → `heatmap-material.ts` (shader factory) →
  toolbar toggle + threshold slider + legend → wire to visible parts with explicit restore-on-off.
- **P3-M2 — Bed-cut preview.** `SuggestedCutPlanes` scene component → render pending suggested planes →
  wire into App/Viewer around the existing suggest flow.

## Out of scope (Phase 3)

- Interactive dragging of suggested planes (read-only only), manual part-rotation gizmo, arrange/spacing
  on the plate, wall-thickness heatmap (needs native thickness analysis → Phase 3-native/beyond).
- Native heavy geometry (later phase), auto-split segmentation (later phase).

## Risks

- **`onBeforeCompile` fragility** across three.js versions — keep the injected GLSL minimal and marker-gated;
  test the factory/uniform, not rendered pixels; verify visually in both builds.
- **Material restore** — toggling the heatmap off must restore the exact palette material; apply
  non-destructively (swap `mesh.material`, keep the original reference) so `meta.color` is never lost.
- **Theme legibility** — the ramp is self-colored; verify Safe/Steep swatches read clearly on both the
  paper (`0xf8f6f0`) and charcoal (`0x15130d`) scene backgrounds.
- **World-normal in shader** — must transform the normal by the model matrix (not view) so overhang tracks
  the part's build orientation, not the camera; unit-test the pure formula and eyeball the shader.
