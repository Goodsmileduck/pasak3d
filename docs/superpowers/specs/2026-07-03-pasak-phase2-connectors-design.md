# Pasak Phase 2 — Connector Catalog Design

**Date:** 2026-07-03
**Status:** Approved (ready for implementation plan)
**Builds on:** Phase 1 joint system (`feat/phase1-joints`, PR #1) — `src/lib/cut/joints/`
**Motivation:** [`../../2026-07-02-audja-teardown-capability-map.md`](../../2026-07-02-audja-teardown-capability-map.md) §8 — Audja's
connector is a purpose-designed articulating key mesh, not a primitive; that (not the cut algorithm) is
the main reason its splits look different. Phase 2 closes that gap with a **parametric connector catalog**.
**Scope:** Web tier only (manifold-3d WASM, 100% client-side). No native/Tauri work; no new deps.

## Summary

Phase 1 built a joint *framework* (procedural cylinder/cube/cross/dovetail/puzzle, one solid + grow-by-
clearance). Phase 2 adds a **catalog of real articulating connectors** — a curated, named library built on
procedural geometry — including genuine **snap-fit** connectors that mechanically lock. Users pick a
connector from the catalog instead of a bare shape; each connector produces proper male/female geometry and
ships with a test-fit coupon generator for tolerance tuning. Everything runs on the existing WASM stack.

### Locked decisions (with user)

| # | Decision | Choice |
|---|---|---|
| 1 | Connector source | **Parametric catalog** (procedural), not authored STL meshes and not user-import (deferred) |
| 2 | Articulation level | **Full snap-fit set** — keyed locators *and* mechanically-locking snap connectors |
| 3 | Framework integration | Generalize to a `Connector` interface; wrap M1 shapes as "keyed" connectors (M1 unchanged) |
| 4 | Assembly models | Both **separate-piece** (pin/dovetail) and **integral** (cantilever clip) |
| 5 | Tolerance | Reuse/extend the M2 test-fit generator for connector coupons (first-class, not an afterthought) |

## Why generalize (the core architectural change)

M1's `buildJointSolid(shape,…)` returns **one** solid; the female cutter is that solid grown by `clearance`,
the male peg is the nominal solid. **Snap-fit breaks this**: a barbed pin's male (barb head + stem) and its
female (socket with an undercut catch/lip) are *different geometry*, not offsets of one shape. So a connector
must define male and female builders explicitly.

**Approaches considered:**
- **A (chosen): a `Connector` interface.** Each connector is an isolated module with explicit builders and
  metadata; `applyConnectors` (generalized `applyJoints`) consumes a `Connector`. M1 shapes are wrapped as
  keyed connectors through an adapter, so M1 behavior is byte-identical. Clean boundaries, each connector
  independently testable.
- **B (rejected): branch inside `buildJointSolid`.** Its single-solid+offset model fights snap-fit's distinct
  male/female → pervasive special-casing.
- **C (rejected): a parallel connector system.** Duplicates placement/apply/worker plumbing → two mechanisms.

## Architecture

```
src/lib/cut/connectors/
  types.ts        Connector interface, ConnectorCategory, AssemblyModel, ConnectorParams
  registry.ts     CONNECTORS: Record<ConnectorId, Connector>; getConnector(id); listByCategory()
  keyed/          dovetail-slide.ts, t-slot.ts, puzzle-tab.ts, cross-key.ts, taper-pin.ts
  snap/           snap-pin.ts, snap-dovetail.ts, cantilever-clip.ts
  m1-adapter.ts   wraps the M1 JointShape builders (buildJointSolid) as keyed Connectors (back-compat)
  apply.ts        applyConnectors(M, partA, partB, placements, preset) — generalizes joints/apply.ts
```

### The `Connector` interface

```ts
type ConnectorCategory = "keyed" | "snap";
type AssemblyModel = "separate-piece" | "integral";

type ConnectorParams = {
  size: number;        // nominal footprint (mm), from the joint diameter
  length: number;      // span across the seam (mm)
  taper?: number;      // 0..1 draft, where meaningful
  clearance: number;   // resolved radial/planar clearance (mm)
};

type ConnectorBuild = {
  // Cavity subtracted from BOTH halves (separate-piece), or from the RECEIVING half (integral).
  femaleCavity(M: any, p: ConnectorParams): any;         // Manifold, local +Z, caller places/deletes
  // The printed connector piece (separate-piece only; null for integral).
  piece(M: any, p: ConnectorParams): any | null;
  // Integral male feature fused onto the SOURCE half (integral only; null for separate-piece).
  integralMale?(M: any, p: ConnectorParams): any | null;
};

type Connector = {
  id: string;                    // "snap-pin", "dovetail-slide", …
  name: string;                  // "Snap pin"
  category: ConnectorCategory;
  assembly: AssemblyModel;
  defaults: Partial<ConnectorParams>;   // per-connector clearance/size defaults
  build: ConnectorBuild;
  describe: string;              // one-line UI hint
};
```

The M1 shapes are exposed through `m1-adapter.ts` as keyed, separate-piece connectors whose `femaleCavity` =
`buildJointSolid({grow:clearance})`, `piece` = `buildJointSolid({grow:0})`, `integralMale` = null — exactly
M1's behavior. Existing joints (no connector id) resolve to `cylinder`.

## Catalog (v1)

**Keyed** (locate + resist shear/rotation, no undercut; separate-piece):
- `dovetail-slide` — trapezoid key, tapered so it seats one way (from M1 dovetail, formalized male/female).
- `t-slot` — a T cross-section that slides in and resists pull-out laterally (new).
- `puzzle-tab` — jigsaw neck+lobe (from M1 puzzle).
- `cross-key` — plus-section (from M1 cross).
- `taper-pin` — tapered cylinder (from M1 cylinder + taper).

**Snap-fit** (mechanically lock; undercut geometry via manifold booleans):
- `snap-pin` *(separate-piece)* — a pin with a **barbed head on each end**; each half's socket has a matching
  undercut catch. Barb = cone/hemisphere wider than the stem; socket = stem bore + a relief groove for the
  catch. Print the pin separately, press into both halves.
- `snap-dovetail` *(separate-piece)* — dovetail key with a **detent bump** and matching socket dimple that
  clicks at full insertion.
- `cantilever-clip` *(integral)* — a **flexible arm with a hook** fused onto the source half (`integralMale`),
  and a **catch ledge** recessed into the receiving half (`femaleCavity`); no separate piece.

Each connector validates `status() === "NoError"` after every boolean and keeps features above a documented
min wall thickness.

## Clearance & test-fit

Snap-fit is tolerance-critical, so the M2 generator is extended:
`generateConnectorTestFit(M, connectorId, opts)` emits coupon pairs (a block carrying the connector's
male/integral feature + a block with its socket) across a clearance sweep, reusing M2's block/naming/zip
path. Per-connector `defaults.clearance` seed the sweep. This lets a user print a strip and pick the snap
that clicks without breaking.

## Apply pipeline & worker

- `applyConnectors(M, partA, partB, placements, preset)` replaces the shape switch in `joints/apply.ts`:
  for each placement resolve its `Connector` + `ConnectorParams`, then by assembly model —
  - *separate-piece:* subtract `femaleCavity` (placed on the seam) from both halves; emit `piece` into the
    pieces bucket.
  - *integral:* fuse `integralMale` onto the source half; subtract `femaleCavity` from the receiving half;
    no piece.
  Magnet sockets from M1 remain a keyed connector variant (cavity only, no piece).
- Worker/client transport is unchanged (the M3a `submit`/`serializeAll` path already carries pieces).
- `Joint`/placement type gains an optional `connectorId` (defaults to the M1 cylinder adapter), keeping the
  existing `previewDowels`/auto-manual flow intact.

## UI

The CutPanel shape+polarity picker becomes a **connector catalog picker**: a category tab (Keyed / Snap) →
connector select (names from the registry) → the connector's relevant params (size/length/clearance, and
connector-specific knobs like barb size). Filament tokens; backward-compatible default = `taper-pin`/keyed.
`DowelMarkers` shows the connector name on hover.

## Testing

Per-connector Vitest in `tests/cut/connectors/` (matching Phase 1 conventions, 128-facet precision):
- Each connector: `femaleCavity`/`piece`/`integralMale` are valid manifolds (`status NoError`, `volume>0`).
- Snap connectors: the **piece fits into the socket with clearance** (piece shifted by ~clearance still
  `subtract(socket).isEmpty()`), and the barb/detent is actually an undercut (socket has a relief wider than
  the bore at depth — a cross-section assertion).
- `applyConnectors`: separate-piece subtracts from both halves + emits one piece; integral fuses male on
  source, cavity on receiver, no piece; magnet emits no piece.
- M1 back-compat: existing `joints/*` and `dowel-*` tests pass unchanged via the adapter.
- Connector test-fit generator: coupon count, clearance sweep monotonic, socket grows with clearance.

## Milestones

Each ends with `npm run test` + `typecheck` + `build:web` + `build`, a `docs/p2-mN-*-smoke-test.md`, and a
pause for review (per the Phase 1 cadence).

- **P2-M1 — Connector framework.** `types.ts` + `registry.ts` + `m1-adapter.ts` (wraps M1 shapes, zero
  behavior change), `applyConnectors`, worker/apply wiring, connector-picker UI. Ships identical output to
  M1 through the new abstraction. TDD.
- **P2-M2 — Keyed catalog.** `t-slot` (new) + formalize dovetail-slide/puzzle-tab/cross-key/taper-pin as
  first-class keyed connectors with explicit male/female roles.
- **P2-M3 — Snap-fit set.** `snap-pin`, `snap-dovetail`, `cantilever-clip` (undercut geometry + both
  assembly models). Highest geometry risk — extra review on undercut manifoldness + printability.
- **P2-M4 — Connector test-fit + tolerance presets.** Extend the M2 generator to connector coupons;
  per-connector clearance defaults surfaced in the UI.

## Out of scope (Phase 2)

- Authored/imported connector STL meshes (deferred; needs a native mesh-offset story for clearance).
- Native heavy geometry (Phase 3), auto-split segmentation (Phase 4).
- Automatic connector selection / placement heuristics (user picks per cut).

## Risks

- **Undercut printability** — snap barbs overhang; success depends on orientation + material flex. Mitigated
  by the test-fit coupons and a documented recommended print orientation. Not solvable by geometry alone.
- **Manifold robustness on thin undercut features** — validate `status()` after every boolean; enforce a min
  wall/feature thickness; escalate weld tolerance as M1's `convert.ts` does.
- **UI surface growth** — the catalog picker adds controls; keep it compact (category → connector → a few
  params) and preserve the auto/manual dowel flow unchanged.
- **Assembly-model split** — integral (cantilever) is a genuinely different apply path from separate-piece;
  isolate it behind the `assembly` field so `applyConnectors` stays readable.
