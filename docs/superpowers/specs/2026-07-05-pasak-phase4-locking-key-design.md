# Pasak Phase 4 (Gap A) — Locking Key Connector Design

**Date:** 2026-07-05
**Status:** Approved (ready for implementation plan)
**Builds on:** Phase 2 connector framework (`src/lib/cut/connectors/`) — now on `main` (v0.2.0)
**Motivation:** [`../../2026-07-02-audja-teardown-capability-map.md`](../../2026-07-02-audja-teardown-capability-map.md)
§8.1 + §8.5 item 1 — "a real articulated connector (designed key instanced on the seam)", flagged the
highest-value near-term add. This is **Gap A** of the three-gap roadmap (A locking key → B native geometry
→ C auto-split).
**Scope:** Web tier only — one new `separate-piece` connector in the existing registry. No cut-engine
restructuring, no native, no new deps, no UI changes.

## Summary

Add a **Locking Key** — a separate printed key that reassembles a split solid **glue-free** by locking in
**both** directions at once:

- **Anti-rotation / anti-shear** via a **non-round rounded-rectangle "paddle" cross-section**.
- **Anti-pull-apart** via **snap barbs at both ends** (the `snap-pin` technique) so it **pushes straight in**.

It is built **procedurally** with manifold-3d (exact clearance per print, scales to any seam, no bundled
asset), and drops into the Phase 2 `Connector` interface as a new `snap`-category connector, so cut,
test-fit, placement, and UI are all reused unchanged.

### Why this connector (the gap it fills)

Our Phase 2 snap connectors each miss one axis of the splitter use case:

| Connector | Push-together insertion | Anti-rotation | Anti-pull-apart |
|---|---|---|---|
| `snap-pin` (round barbed pin) | ✅ | ❌ (round) | ✅ (barbs) |
| `snap-dovetail` (dovetail + detent) | ❌ (slides in laterally) | ✅ | ✅ |
| `cantilever-clip` (integral hook) | ✅ | partial | ✅ (one side) |
| **`snap-key` (this)** | ✅ | ✅ (paddle) | ✅ (both-end barbs) |

When you reassemble a split solid the two halves can usually only come **straight together**
(perpendicular to the seam) — a lateral slide collides with the rest of the form. `snap-key` is the only
connector that gives a compound, glue-free, no-slide lock. It is Audja's designed-key mechanics
(§8.1: "flared dovetail base + rectangular socket + prongs") adapted to a procedural, splitter-practical key.

### Locked decisions (with user)

| # | Decision | Choice |
|---|---|---|
| 1 | Geometry source | **Procedural parametric** (manifold-3d) — no bundled STL, exact clearance |
| 2 | Target behavior | **Self-locking snap key** (push-together, two-direction lock, glue-free) |
| 3 | Cross-section | **Rounded-rectangle "paddle"** (fixed for v1, no picker — YAGNI) |
| 4 | Build home | **Local to `snap-key.ts`** — do NOT add "paddle" to the `JointShape` union (it is not an M1 keyed-joint shape and must not appear in the joint-shape picker) |

## Context (existing code this builds on)

- **`Connector` interface** (`src/lib/cut/connectors/types.ts`): `{ id, name, category, assembly, defaults,
  describe, build }` where `build = { femaleCavity(M,p), piece(M,p), integralMale? }` and
  `p: ConnectorParams` carries `size`, `length`, `clearance`. `ConnectorCategory = "keyed" | "snap"`,
  `AssemblyModel = "separate-piece" | "integral"`.
- **`snap-pin.ts`** is the exact structural template: one helper builds a barbed solid; `femaleCavity`
  calls it with `grow = clearance`, `piece` with `grow = 0`, `integralMale = undefined`. The barb flare in
  the grown cavity *is* the relief chamber. `snap-key` mirrors this precisely.
- **`shapes.ts`** `extrudeProfile(nominal, length, grow)`: offsets a nominal 2D `CrossSection` outward by
  `grow` (`offset(grow,"Round",2,32)`) then `extrude` — the established **uniform per-face clearance**
  pattern. `snap-key` reuses the same technique for its paddle (building the profile locally).
- **`registry.ts`**: `ALL` array → `CONNECTORS` record; `listByCategory("snap")` already drives the Cut
  panel's Snap dropdown. Adding `snap-key` to `ALL` surfaces it in the UI and in Phase 2 test-fit with **no
  UI code**.
- **`apply.ts`** (`applyConnectors`) + **`test-fit.ts`** dispatch any `separate-piece` connector via its
  `build.femaleCavity`/`build.piece` — no changes needed.
- **Manifold hygiene** (Phase 1/2 rule): every intermediate Manifold/CrossSection must be `.delete()`d;
  wrap non-trivial booleans in `assertNoError` (`../../manifold-assert`).

## Geometry (procedural build)

The key is centered on the seam at local origin, extruded along local **+Z** (the cut normal); half seats
in each part's socket.

```
paddleProfile(M, size):
  // Rounded-rectangle: a wide-but-flat footprint gives strong anti-rotation and prints flat.
  // width  ≈ size, height ≈ size * 0.5 (flattened), corner radius ≈ height * 0.4.
  rect = M.CrossSection.square([w, h], true)          // centered
  return rect.offset(r, "Round", 2, 32)               // rounded corners (delete rect)

keySolid(M, size, length, grow):
  nominal = paddleProfile(M, size)
  profile = grow > 0 ? nominal.offset(grow, "Round", 2, 32) : nominal   // uniform clearance
  body    = profile.extrude(length, 1, 0, undefined, true)              // centered z: −L/2..+L/2
  // Barbs: a flared collar near each end creates the pull-out undercut; chamfered lead-in makes it
  // push-insertable. Built as a short wider paddle slab unioned at each tip.
  collarTop = paddleCollar(M, size, grow).translate([0, 0,  length/2 - collarInset])
  collarBot = paddleCollar(M, size, grow).translate([0, 0, -length/2 + collarInset])
  out = body.add(collarTop).add(collarBot)            // assertNoError each union
  // delete all intermediates
  return out
```

- `paddleCollar` = a thin paddle slab scaled ~1.4–1.6× the body footprint with a lead-in chamfer on the
  outward face (so insertion compresses the socket lips, then the collar springs into the relief chamber).
- **Connector build wiring** (mirrors `snap-pin`):
  - `femaleCavity(M,p) = keySolid(M, p.size, p.length, p.clearance)` — grown solid; the collar flare forms
    the catch/relief chamber automatically.
  - `piece(M,p) = keySolid(M, p.size, p.length, 0)` — the printed key.
  - `integralMale = undefined`.
- **Defaults:** `category: "snap"`, `assembly: "separate-piece"`, `defaults.clearance: 0.2`
  (snap-fit range, precedence still joint → connector → preset per Phase 2 `resolveConnectorParams`).

## Integration (minimal surface)

- **Create** `src/lib/cut/connectors/snap/snap-key.ts` — the connector + its local `paddleProfile` /
  `paddleCollar` / `keySolid` helpers.
- **Modify** `src/lib/cut/connectors/registry.ts` — import `snapKeyConnector`, add to `ALL` (Snap group).
- **No UI change** — appears in the Cut panel Snap dropdown via `listByCategory`; Phase 2 connector test-fit
  sweeps it automatically.
- **No param/type change** — reuses `ConnectorParams`; the paddle cross-section is fixed for v1 (no picker).
- `JointShape` union is **untouched** — the paddle lives only in `snap-key.ts`.

## Testing

Same conventions + undercut-probe style as Phase 2 (`tests/cut/connectors/*`):

- **Clearance:** `femaleCavity` fully contains `piece` — `cavity.subtract(piece)` is non-empty (a shell),
  and `piece.subtract(cavity)` is empty (piece fits inside the grown cavity).
- **Anti-pull-apart (barb undercut exists):** slab-intersect width at the collar-Z is **greater** than the
  body width at mid-Z (a straight prism would be equal). Probe via an axis-aligned thin slab
  `intersect` + `boundingBox` at the two Z bands.
- **Anti-rotation (non-round):** at mid-Z the footprint width along local X **differs** from along Y
  (paddle is flattened) — a round pin would be equal. Probe via slab bounding-box extents.
- **Manifold validity:** `status()==='NoError'`, `volume()>0`, `decompose().length===1` (single fused key).
- **Integration:** `applyConnectors(M, partA, partB, joints, preset)` with `connectorId:"snap-key"` yields
  both halves socketed + one emitted key piece; connector `defaults.clearance` honored when the joint
  doesn't override (regression from Phase 2's clearance-precedence bug).
- **Registry:** `getConnector("snap-key")` defined; `listByCategory("snap")` includes it.
- Full suite + `typecheck` + `build:web` + `build` green.

## Milestones

Single milestone (small, additive). Ends with `npm run test` + `typecheck` + `build:web` + `build`, a
`docs/p4-m1-locking-key-smoke-test.md`, and a pause for review.

- **P4-M1 — Locking Key connector.** `paddleProfile`/`keySolid` (pure geometry, tested undercut +
  anti-rotation) → `snapKeyConnector` (femaleCavity/piece) → registry wire → verify. Manual smoke: cut a
  model, pick **Locking key** in the Snap dropdown, cut, print/inspect that the key + both sockets emit and
  the key seats with the expected clearance; Test-fit sweeps it.

## Out of scope (Phase 4 / Gap A)

- Audja's organic **depth-varying forked-prong** mesh richness (procedural constant/tapered profile only —
  the accepted tradeoff of choosing procedural).
- A cross-section **picker** for the key (fixed paddle in v1).
- **Articulated / hinge** (poseable) joints — noted as a possible future connector, not this phase.
- Gap B (native geometry) and Gap C (auto-split) — their own specs, next in sequence.

## Risks

- **Barb printability / over-stiff snap:** collar flare + chamfer geometry must compress enough to insert
  without shearing on FDM. Mitigate by deriving collar flare from `size` conservatively and validating with
  the existing Test-fit coupon sweep (prints a clearance ladder) before trusting a single value.
- **Thin paddle weakness:** a too-flat paddle can snap under load. Keep height ≥ ~0.5× width and validate
  `decompose().length===1` + a minimum wall in the collar.
- **Manifold leaks:** the multi-union build has several intermediates — follow the Phase 1/2 `.delete()`
  discipline; `assertNoError` each union (non-manifold collars would otherwise fail silently downstream).
