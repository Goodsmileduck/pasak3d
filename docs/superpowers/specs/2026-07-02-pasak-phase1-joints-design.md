# Pasak Phase 1 — Web-Tier Joint System Design

**Date:** 2026-07-02
**Status:** Approved (ready for implementation plan)
**Strategy source:** [`../../2026-07-02-audja-comparison-strategy.md`](../../2026-07-02-audja-comparison-strategy.md),
[`../../2026-07-02-audja-teardown-capability-map.md`](../../2026-07-02-audja-teardown-capability-map.md)
**Scope:** Phase 1 only — **web tier (manifold-3d WASM, 100% client-side)**. No native/Tauri Rust work.

## Summary

Close the highest value ÷ risk portion of the Audja feature gap by generalizing Pasak's dowel code
into a full **keyed-joint system**, adding a **test-fit coupon generator**, and completing
**separate-components / watertight-cap verification / seam labels** — all on the existing
`manifold-3d` WASM engine in the web worker. No from-scratch rewrite: we extend the ~5,200 LOC in
`src/lib/cut/`, keeping the free client-side web build (`pasak.3dlab.id`) fully functional.

The native geometry tier (hollow / offset / decimate / voxel / strong repair) and the MeshLib-vs-OpenVDB
license decision are **explicitly deferred to Phase 2** and are not touched here.

## Confirmed API facts (grounded in installed packages)

Verified against the shipped type definitions, not assumed:

- **`manifold-3d@3.4.1`** (`package.json` `^3.4.1`; `node_modules/manifold-3d/package.json` `3.4.1`):
  - `static cube(size?: Vec3|number, center?: boolean): Manifold` — `manifold.d.ts:450`
  - `static cylinder(height, radiusLow, radiusHigh?, circularSegments?, center?): Manifold` — `:466-468`
    (`radiusHigh` defaults to `radiusLow` → **native taper**)
  - `static sphere(radius, circularSegments?): Manifold` — `:481`
  - `static extrude(polygons: CrossSection|Polygons, height, nDivisions?, twistDegrees?, scaleTop?: Vec2|number, center?): Manifold` — `:504-507`
  - `CrossSection`: `constructor(contours: Polygons, fillRule?)` `:45`; `static ofPolygons(...)` `:316`;
    `static circle(radius, circularSegments?)` `:68`; `static square(size?, center?)` `:58`;
    `offset(delta, joinType?, miterLimit?, circularSegments?)` `:189-191`;
    `add/union` `:218/:236`; `extrude(height, nDivisions?, twistDegrees?, scaleTop?, center?)` `:89-91`
  - Booleans: `add(other): Manifold` `:815`; `subtract` (existing usage); `static union(a,b)` `:836`
  - `transform(m: Mat4): Manifold` — column-major, `:605-613` (matches `dowel-apply.ts` convention)
  - `decompose(): Manifold[]` — `:977` (connected components; length 1 if already connected)
  - Validity: `status(): ErrorStatus` (string union incl. `'NoError'`), `isEmpty(): boolean`,
    `volume(): number`, `genus(): number`
  - `setCircularSegments(segments): void` — `:1442-1452` (default `0` = no constraint)
  - `Manifold.delete()` / `CrossSection.delete()` free WASM memory — must call on intermediates.
- **`three@0.170.0`** bundles `examples/fonts/helvetiker_regular.typeface.json` (63,182 bytes,
  MgOpen family). License (`examples/fonts/LICENSE`): redistribution allowed **with notice**;
  selling the font alone is restricted → acceptable for our bundled use.
  `FontLoader.parse(json)` is **DOM-free and worker-safe** (`FontLoader.js:33-36, 55-66, 105-180`);
  only `FontLoader.load()` uses `fetch`/DOM (`FileLoader.js`), which we avoid by prefetching the JSON.

## Design decisions (locked with user)

| # | Decision | Choice |
|---|---|---|
| 1 | Native-tier gate | Deferred to Phase 2; Phase 1 touches no `src-tauri/` |
| 2 | Type model | `Joint` as a **superset of `Dowel`**, migrated in place; old dowels ⇒ `shape:'cylinder'` |
| 3 | Clearance semantics | **Unchanged** — both halves get radial clearance, total play = 2×; per-joint override layers on top of the `TolerancePreset` map |
| 4 | Seam labels | Offer **both deboss and emboss** as user options |
| 5 | Joint shapes | **All** of cylinder / cube / cross / dovetail / puzzle + magnet socket in M1 |
| 6 | `Cut.dowels` field name | Kept (not renamed to `joints`) this phase — churn avoidance |
| 7 | Magnet socket | Blind recess on both faces, **no peg emitted** (user supplies the magnet) |
| 8 | Label content | Alphanumeric part IDs only (A, B, 1, 2…), not arbitrary text |

## Architecture

All new geometry lives under `src/lib/cut/joints/`, called from the existing `cut-worker.ts`. The React
UI and session reducer keep speaking the extended `Joint` type. Web-only; gated implicitly by running on
manifold-3d WASM (no native calls).

```
src/lib/cut/joints/
  shapes.ts     buildJointSolid(M, shape, dims, taper, clearance) → Manifold   (pure per-shape factory)
  orient.ts     shared rotationMat4FromTo + axis-place helper (deduped from dowel-apply.ts)
  apply.ts      applyJoints(...) → subtract female cutters from both halves, emit male pegs
  labels.ts     buildSeamLabel(M, font, text, depth, mode) → Manifold           (emboss/deboss solid)
  test-fit.ts   generateTestFitPairs(opts) → { meshes, names }                  (pure, no scene)
```

### Type model (`src/types/index.ts`)

`Dowel` becomes an alias/subset of `Joint`:

```ts
type JointShape = 'cylinder' | 'cube' | 'cross' | 'dovetail' | 'puzzle';
type JointPolarity = 'separate-peg' | 'male' | 'female' | 'magnet';

type Joint = {
  id: string;
  position: [number, number, number];   // world-space, on the cut plane
  axis: [number, number, number];        // unit normal of the cut plane
  diameter: number;                       // mm (nominal, drives radius / box size)
  length: number;                         // mm
  source: 'auto' | 'manual';
  shape?: JointShape;                     // default 'cylinder'
  polarity?: JointPolarity;               // default 'separate-peg'
  taper?: number;                         // 0..1 draft (0 = straight)
  clearance?: number;                     // per-joint radial clearance override (mm)
};
type Dowel = Joint;                        // back-compat alias
```

`Cut.dowels: Joint[]` (field name unchanged). Missing `shape`/`polarity` ⇒ current cylinder behavior, so
existing sessions/tests keep working.

### Per-shape construction (`shapes.ts`)

`buildJointSolid` returns the **nominal** solid; the female cutter is the nominal solid grown by
`clearance` (2D `offset(+clearance)` for extruded profiles, `+clearance` radius for cylinders). Male peg
= nominal. All confirmed against the API facts above.

- **cylinder** — `Manifold.cylinder(len, r, r*(1-taper), segs, true)`. Taper native.
- **cube** — `Manifold.cube([x, y, z], true)`; taper via `CrossSection` square + `extrude(..., scaleTop)`.
- **cross** — two boxes unioned; **overlap slightly before union** (codex flagged coincident-face
  non-manifold risk — never union merely-touching faces).
- **dovetail** — trapezoid `CrossSection.ofPolygons(contour)` → `extrude(len, 1, 0, scaleTop)` for draft.
- **puzzle** — neck rectangle ∪ lobe `CrossSection.circle`s → `extrude`.
- **magnet socket** — blind cylinder of radius `magnetR + clearance`, depth `magnetDepth`, positioned
  `seam ± depth/2` along the axis so it never perforates; subtracted from both faces; no peg.

Orientation reuses `rotationMat4FromTo([0,0,1], axis)` then `.transform(mat).translate(position)` —
extracted from `dowel-apply.ts` into `orient.ts` so both `apply.ts` and `labels.ts` share one proven
implementation. `setCircularSegments` called once at worker init; every intermediate `Manifold` /
`CrossSection` gets `.delete()`.

### Apply pipeline (`apply.ts`)

`applyJoints(M, partA, partB, joints, tolerancePreset)` — for each joint:
1. Resolve clearance = `joint.clearance ?? TOLERANCE_VALUES[preset]`.
2. Build female cutter, subtract from **both** `partA` and `partB`.
3. If polarity emits a peg (`separate-peg`/`male`), build nominal solid → dowel-pieces bucket.
4. `magnet` emits no peg.
Returns `{ partA, partB, jointPieces }` (same shape as today's `ApplyDowelsResult`).

### Test-fit generator (`test-fit.ts`)

Pure function. Input: `{ count, step, cubeSize, keyDepth, keyWidth, shape, shuffleShapes? }`. Emits
`count` coupon pairs (a male block + a female block) across a clearance sweep
(`baseClearance + i*step`). Output meshes feed the existing zip/3MF exporter with descriptive names
(e.g. `testfit_cube_c0.10.stl`). No scene/session mutation; invoked from a small toolbar action.

### Separate components + caps + labels

- **Separate components** — `manifold.decompose()`; register each result as a new part via the existing
  cut result-part registration path. Component count = `decompose().length`. `.delete()` each after
  serialize.
- **Cap verification** — planar `splitByPlane` already yields watertight results (manifold guarantee).
  We add **assertion tests** (`status()==='NoError' && !isEmpty() && volume()>0`) rather than new
  geometry. Documented as verification, not a feature.
- **Seam labels** (`labels.ts`) — prefetch `helvetiker_regular.typeface.json` (shipped into
  `public/fonts/` with license notice), `new FontLoader().parse(json)` inside the worker, sample glyph
  outlines → `CrossSection.ofPolygons(contours)` → `.extrude(depth)`. **Emboss** = `part.union(label)`;
  **deboss** = `part.subtract(labelCutter)` (inward, small overlap). Alphanumeric glyphs only, low curve
  segment count, validate each label solid (`status`/`isEmpty`/bounds) before boolean. **Do NOT** route
  through `TextGeometry → meshToManifold` (that path only welds coincident verts and throws on real gaps).

### Worker / UI wiring

- `cut-worker.ts` request extends with joint params + optional label spec; response shape unchanged.
- `CutPanel` / `DowelMarkers` gain a shape + polarity picker and optional label field. The auto/manual
  dowel flow is untouched: auto joints recomputed per preview, manual survive, cut consumes
  `previewDowels` at confirm (per CLAUDE.md).

## Testing

Per-module Vitest in `tests/cut/`, matching existing conventions (volume/position asserts, 128 cylinder
facets for `toBeCloseTo(_, 0)` precision):

| Test file | Asserts |
|---|---|
| `joints/shapes.test.ts` | each shape's nominal vs female volume; female = nominal + clearance; taper direction |
| `joints/apply.test.ts` | female subtracted from both halves; peg volume = nominal; magnet emits no peg |
| `joints/magnet.test.ts` | blind recess depth never perforates part along axis |
| `joints/labels.test.ts` | emboss adds volume, deboss removes volume; label solid `status==='NoError'` |
| `test-fit.test.ts` | pair count = requested; clearance sweep monotonic; names correct |
| `cut/decompose.test.ts` | `decompose().length` = expected component count |
| `cut/caps.test.ts` | post-cut `status/isEmpty/volume` validity |
| back-compat | existing `dowel-apply`/`dowel-place` tests pass unchanged (cylinder default path) |

## Milestones

Each milestone ends with `npm run test` + `npm run typecheck` + `npm run build:web` + `npm run build`,
a `docs/mN-<name>-smoke-test.md` in the existing style, then a **pause for user review** before the next.

- **M1 — Joint system overhaul.** `Joint` types; `joints/{shapes,orient,apply}.ts`; all shapes +
  magnet socket; worker + CutPanel/DowelMarkers wiring; back-compat preserved. TDD.
- **M2 — Test-fit generator + tolerance presets.** `test-fit.ts`; export path; toolbar action.
- **M3a — Separate components + cap verification.** `decompose()` → parts; cap validity tests.
- **M3b — Seam labels.** `labels.ts` (emboss + deboss); bundle font asset + license; validate glyphs.
  Split from M3a so it can ship independently and isolate the font/glyph risk.

## Out of scope (Phase 1)

Native tier (hollow/thicken/offset/decimate/voxel/strong repair), `GeometryEngine` interface + Rust
module, MeshLib-vs-OpenVDB decision, overhang heatmap, bed-cut live preview, Auto-Split segmentation,
Mold Studio, color Painter, slicer launch. All tracked in the teardown doc for later phases.

## Risks

- **Non-manifold composite cutters** (cross/puzzle) — mitigate by overlapping primitives before union;
  validate `status()` after each build.
- **Glyph manifoldness** — mitigated by the CrossSection route (not TextGeometry); alphanumeric-only,
  low curve segments, per-label validation.
- **Font license notice** — must ship the LICENSE text alongside the bundled typeface JSON.
- **UI surface growth** in CutPanel — keep the shape/polarity picker compact; auto/manual flow unchanged.
