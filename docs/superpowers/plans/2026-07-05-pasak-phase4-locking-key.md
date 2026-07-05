# Pasak Phase 4 (Gap A) — Locking Key Connector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `snap-key` connector — a separate printed key with a rounded-rectangle "paddle" cross-section and both-end snap barbs — that reassembles a split solid glue-free, locking rotation and pull-apart at once.

**Architecture:** A new procedural `separate-piece` connector built with manifold-3d, mirroring the proven `snap-pin` structure (one `keySolid` helper; `femaleCavity` = grown solid, `piece` = nominal). It drops into the Phase 2 `Connector` registry, so cut / test-fit / placement / UI are all reused unchanged.

**Tech Stack:** TypeScript, manifold-3d (WASM), Vitest, dual web/desktop Vite targets.

**Spec:** [`../specs/2026-07-05-pasak-phase4-locking-key-design.md`](../specs/2026-07-05-pasak-phase4-locking-key-design.md)

## Global Constraints

- **Web tier only.** No `src-tauri/`, no new deps, no UI changes. One new connector file + one registry line.
- **Both build targets pass** before the milestone is done: `npm run build:web` AND `npm run build`; plus `npm run test` and `npm run typecheck`.
- **Mirror `snap-pin`:** `femaleCavity(M,p) = keySolid(..., grow = p.clearance)`, `piece(M,p) = keySolid(..., grow = 0)`, `integralMale = undefined`. The grown cavity's barb flare *is* the relief chamber.
- **Manifold hygiene:** every intermediate `Manifold`/`CrossSection` must be `.delete()`d; wrap each non-trivial boolean in `assertNoError` from `src/lib/cut/manifold-assert`.
- **`JointShape` union is UNTOUCHED** — the paddle profile lives only in `snap-key.ts` (it is not an M1 keyed-joint shape and must not appear in the joint-shape picker).
- **Connector defaults:** `id: "snap-key"`, `name: "Locking key"`, `category: "snap"`, `assembly: "separate-piece"`, `defaults.clearance: 0.2`.
- **Tuple types:** any `[number, number, number]` must be explicitly typed/cast — this repo's `tsc` fails on widened `number[]` even when vitest passes. Verify with `typecheck` + both builds, not just the test runner.
- **Commit style:** Conventional Commits with scope (`feat(connectors):`, `test(...)`, `docs(...)`), em-dash for what+why. End messages with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

## Reference facts (verified in the codebase)

- **`initManifold()`** from `src/lib/cut/manifold` returns the manifold module `M`; tests `beforeAll` it.
- **manifold API used here:** `M.CrossSection.square([w,h], center)`, `cs.offset(delta, "Round", miter, segs)`,
  `cs.extrude(height, nDivisions, twistDeg, scaleTop, center)`, `M.Manifold.sphere(r, segs)`,
  `man.scale([x,y,z])`, `man.translate([x,y,z])`, `man.add/subtract/intersect`, `man.status()` (`'NoError'`),
  `man.isEmpty()`, `man.volume()`, `man.boundingBox()` (`.min[0..2]`/`.max[0..2]`), `man.decompose()` (array).
- **`snap-pin.ts` template:** a `pinSolid(M,size,length,grow)` helper unions a stem + two end spheres, then
  `femaleCavity`/`piece` call it with `grow=clearance`/`grow=0`. `snap-key` mirrors this exactly.
- **`extrudeProfile` pattern (shapes.ts):** clearance is applied by `nominal.offset(grow,"Round",2,32)`
  BEFORE extrude — uniform per-face clearance. `keySolid` reuses this technique locally.
- **`ConnectorParams`** = `{ size, length, clearance, ... }`. **`Connector`** =
  `{ id, name, category, assembly, defaults, describe, build:{femaleCavity, piece, integralMale?} }`.
- **`registry.ts`:** `ALL` array is spread into `CONNECTORS`; `listByCategory("snap")` drives the Snap
  dropdown. `applyConnectors(M, partA, partB, joints, preset)` → `{ partA, partB, jointPieces }`; a joint
  with `connectorId:"snap-key"` routes to a `separate-piece` build.

---

# P4-M1 — Locking Key connector

## File structure (P4-M1)

- Create `src/lib/cut/connectors/snap/snap-key.ts` — `paddleProfile` + `keySolid` (local helpers) + `snapKeyConnector`.
- Modify `src/lib/cut/connectors/registry.ts` — import + register `snapKeyConnector` in the Snap group.
- Test `tests/cut/connectors/snap/snap-key.test.ts` — geometry (valid, anti-rotation, barb undercut, clearance).
- Test `tests/cut/connectors/apply.test.ts` — add one `snap-key` integration case (both halves socketed + one piece).
- Test `tests/cut/connectors/registry.test.ts` — add lookup + category-membership assertions.

---

### Task 1: `snap-key` geometry + connector

**Files:**
- Create: `src/lib/cut/connectors/snap/snap-key.ts`
- Test: `tests/cut/connectors/snap/snap-key.test.ts`

**Interfaces:**
- Produces: `export const snapKeyConnector: Connector` with
  `build.piece(M,p): Manifold`, `build.femaleCavity(M,p): Manifold`, `build.integralMale = undefined`.
  Local (non-exported) helpers `paddleProfile(M, size)` and `keySolid(M, size, length, grow)`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/cut/connectors/snap/snap-key.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { initManifold } from "../../../../src/lib/cut/manifold";
import { snapKeyConnector } from "../../../../src/lib/cut/connectors/snap/snap-key";

let M: any;
beforeAll(async () => { M = await initManifold(); });
const p = { size: 6, length: 16, clearance: 0.2 };

// Extent of a thin Z-slab along a chosen axis (0=X, 1=Y) at depth z.
function extentAtZ(solid: any, z: number, axis: 0 | 1): number {
  const probe = M.Manifold.cube([40, 40, 1], true).translate([0, 0, z]);
  const slice = solid.intersect(probe);
  const w = slice.isEmpty() ? 0 : slice.boundingBox().max[axis] - slice.boundingBox().min[axis];
  probe.delete(); slice.delete();
  return w;
}

describe("snapKeyConnector", () => {
  it("is a snap separate-piece connector with a snap-fit clearance default", () => {
    expect(snapKeyConnector.id).toBe("snap-key");
    expect(snapKeyConnector.category).toBe("snap");
    expect(snapKeyConnector.assembly).toBe("separate-piece");
    expect(snapKeyConnector.defaults.clearance).toBe(0.2);
  });

  it("piece and cavity are valid single-body manifolds", () => {
    const piece = snapKeyConnector.build.piece(M, p)!;
    const cavity = snapKeyConnector.build.femaleCavity(M, p);
    expect(piece.status()).toBe("NoError");
    expect(cavity.status()).toBe("NoError");
    expect(piece.volume()).toBeGreaterThan(0);
    expect(piece.decompose().length).toBe(1);
    piece.delete(); cavity.delete();
  });

  it("paddle cross-section is non-round (anti-rotation): X much wider than Y at mid", () => {
    const piece = snapKeyConnector.build.piece(M, p)!;
    const xW = extentAtZ(piece, 0, 0);
    const yW = extentAtZ(piece, 0, 1);
    expect(xW).toBeGreaterThan(yW * 1.4);
    piece.delete();
  });

  it("has both-end barb undercuts: end X-extent wider than the mid bore", () => {
    const piece = snapKeyConnector.build.piece(M, p)!;
    const midW = extentAtZ(piece, 0, 0);
    const topW = extentAtZ(piece, p.length / 2 - 0.5, 0);
    const botW = extentAtZ(piece, -(p.length / 2 - 0.5), 0);
    expect(topW).toBeGreaterThan(midW + 0.5);
    expect(botW).toBeGreaterThan(midW + 0.5);
    piece.delete();
  });

  it("cavity clears the piece — piece fits inside the grown cavity", () => {
    const piece = snapKeyConnector.build.piece(M, p)!;
    const cavity = snapKeyConnector.build.femaleCavity(M, p);
    const protrusion = piece.subtract(cavity); // piece ⊆ cavity ⇒ empty
    const shell = cavity.subtract(piece);       // clearance gap ⇒ non-empty
    expect(protrusion.isEmpty()).toBe(true);
    expect(shell.isEmpty()).toBe(false);
    piece.delete(); cavity.delete(); protrusion.delete(); shell.delete();
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (module not found)

Run: `npx vitest run tests/cut/connectors/snap/snap-key.test.ts`

- [ ] **Step 3: Implement**

```ts
// src/lib/cut/connectors/snap/snap-key.ts
import type { Connector, ConnectorParams } from "../types";
import { assertNoError } from "../../manifold-assert";

/** Nominal rounded-rectangle "paddle" cross-section: wide + flat → strong anti-rotation.
 *  width ≈ size, height ≈ size*0.5, corner radius ≈ height*0.35. */
function paddleProfile(M: any, size: number): any {
  const w = size;
  const h = size * 0.5;
  const r = h * 0.35;
  const inner = M.CrossSection.square([w - 2 * r, h - 2 * r], true);
  const rounded = inner.offset(r, "Round", 2, 32); // grow corners back out to w×h, rounded
  inner.delete();
  return rounded;
}

/** A paddle key centered on the seam (local Z), with a flattened-ellipsoid snap barb at each end.
 *  `grow` adds uniform clearance for the female cavity (mirrors extrudeProfile in shapes.ts). */
function keySolid(M: any, size: number, length: number, grow: number): any {
  const nominal = paddleProfile(M, size);
  const profile = grow > 0 ? nominal.offset(grow, "Round", 2, 32) : nominal;
  const body = profile.extrude(length, 1, 0, undefined, true); // centered: z ∈ [-L/2, +L/2]
  if (profile !== nominal) profile.delete();
  nominal.delete();

  // Barbs: a sphere flattened to the paddle aspect → smooth (self-inserting) undercut at each end.
  const rBarb = size * 0.6 + grow;
  const barb = () => M.Manifold.sphere(rBarb, 48).scale([1, 0.55, 1] as [number, number, number]);
  const top = barb().translate([0, 0, length / 2] as [number, number, number]);
  const bot = barb().translate([0, 0, -length / 2] as [number, number, number]);

  const withTop = body.add(top);
  assertNoError(withTop, "snap-key body+top barb");
  const out = withTop.add(bot);
  assertNoError(out, "snap-key body+barbs");

  body.delete(); top.delete(); bot.delete(); withTop.delete();
  return out;
}

export const snapKeyConnector: Connector = {
  id: "snap-key",
  name: "Locking key",
  category: "snap",
  assembly: "separate-piece",
  defaults: { clearance: 0.2 },
  describe: "Locking key - paddle key with both-end barbs, pushes in and locks rotation + pull-apart",
  build: {
    femaleCavity: (M: any, p: ConnectorParams) => keySolid(M, p.size, p.length, p.clearance),
    piece: (M: any, p: ConnectorParams) => keySolid(M, p.size, p.length, 0),
    integralMale: undefined,
  },
};
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/cut/connectors/snap/snap-key.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/cut/connectors/snap/snap-key.ts tests/cut/connectors/snap/snap-key.test.ts
git commit -m "feat(connectors): snap-key — procedural locking key (paddle + both-end barbs)"
```

---

### Task 2: Register `snap-key` + integration/registry tests

**Files:**
- Modify: `src/lib/cut/connectors/registry.ts` (import + add to `ALL`)
- Test: `tests/cut/connectors/registry.test.ts` (add lookup + category membership)
- Test: `tests/cut/connectors/apply.test.ts` (add one `snap-key` integration case)

**Interfaces:**
- Consumes: `snapKeyConnector` (Task 1); `applyConnectors(M, partA, partB, joints, preset)` →
  `{ partA, partB, jointPieces }` (existing).
- Produces: `getConnector("snap-key")` defined; `listByCategory("snap")` includes it.

- [ ] **Step 1: Write the failing registry test**

```ts
// tests/cut/connectors/registry.test.ts — ADD these cases (match the file's existing imports/harness)
it("registers snap-key in the snap category", () => {
  expect(getConnector("snap-key")?.id).toBe("snap-key");
  expect(listByCategory("snap").map((c) => c.id)).toContain("snap-key");
});
```
(If `getConnector`/`listByCategory` are not yet imported in this test file, add
`import { getConnector, listByCategory } from "../../../src/lib/cut/connectors/registry";`.)

- [ ] **Step 2: Write the failing integration test**

```ts
// tests/cut/connectors/apply.test.ts — ADD inside describe("applyConnectors", ...)
it("snap-key subtracts a socket from both halves and emits one key piece", () => {
  const j = {
    id: "j",
    position: [0, 0, 0] as [number, number, number],
    axis: [0, 0, 1] as [number, number, number],
    diameter: 8,
    length: 12,
    source: "auto" as const,
    connectorId: "snap-key",
  };
  const a = box();
  const b = box();
  const r = applyConnectors(M, a, b, [j], "pla-tight");
  expect(r.partA.status()).toBe("NoError");
  expect(r.partA.volume()).toBeLessThan(30 * 30 * 30);
  expect(r.partB.volume()).toBeLessThan(30 * 30 * 30);
  expect(r.jointPieces.length).toBe(1);       // separate-piece → one printed key
  expect(r.jointPieces[0].volume()).toBeGreaterThan(0);
  r.partA.delete(); r.partB.delete();
  r.jointPieces.forEach((pc: any) => pc.delete());
  a.delete(); b.delete();
});
```

- [ ] **Step 3: Run — expect FAIL** (`getConnector("snap-key")` undefined → both tests fail)

Run: `npx vitest run tests/cut/connectors/registry.test.ts tests/cut/connectors/apply.test.ts`

- [ ] **Step 4: Register the connector**

In `src/lib/cut/connectors/registry.ts`: add the import beside the other snap imports and add
`snapKeyConnector` to the `ALL` array (in the snap group, next to `snapPinConnector`/`snapDovetailConnector`):
```ts
import { snapKeyConnector } from "./snap/snap-key";
// ...in the ALL array, snap group:
  snapPinConnector,
  snapDovetailConnector,
  snapKeyConnector,
```

- [ ] **Step 5: Run — expect PASS**

Run: `npx vitest run tests/cut/connectors/registry.test.ts tests/cut/connectors/apply.test.ts`

- [ ] **Step 6: Commit**

```bash
git add src/lib/cut/connectors/registry.ts tests/cut/connectors/registry.test.ts tests/cut/connectors/apply.test.ts
git commit -m "feat(connectors): register snap-key + socket/piece integration coverage"
```

---

### Task 3: P4-M1 verification + smoke doc

- [ ] **Step 1:** `npm run test && npm run typecheck` → PASS.
- [ ] **Step 2:** `npm run build:web && npm run build` → both succeed.
- [ ] **Step 3:** Write `docs/p4-m1-locking-key-smoke-test.md` (existing style, e.g. `docs/p2-m3-snapfit-smoke-test.md`):
  load a model → start a cut → open the **Snap** connector group → pick **Locking key** → confirm the cyan
  preview + cut proceed; after cutting, both halves show the paddle socket and one key piece is emitted in
  the parts tree; **Test-fit** sweeps the locking key across the clearance ladder; export includes the key.
  Note that FDM barb stiffness should be dialed in via Test-fit before trusting a single clearance.
- [ ] **Step 4:** `git add docs/p4-m1-locking-key-smoke-test.md && git commit -m "docs(p4-m1): locking-key smoke checklist"`
- [ ] **STOP — pause for user review. P4-M1 completes Gap A; Gap B (native geometry) is next.**

---

## Self-review (spec coverage)

- Procedural paddle + both-end barbs, exact clearance → Task 1 (`keySolid`, `paddleProfile`) ✅.
- Two-direction lock: anti-rotation (paddle X≫Y) + barb undercut (end X-extent > mid) → Task 1 tests ✅.
- Mirror snap-pin (femaleCavity=grown, piece=nominal, integralMale=undefined) → Task 1 ✅.
- `separate-piece` in Snap category, `defaults.clearance 0.2`, no UI change (registry surfaces it) → Task 2 ✅.
- Clearance precedence honored (joint→connector→preset) → covered by the Phase 2 `resolveConnectorParams`
  path exercised in Task 2's `applyConnectors` integration test ✅.
- `JointShape` untouched (paddle local to `snap-key.ts`) → Task 1 imports only `Connector`/`ConnectorParams` ✅.
- Web-only, both builds, manifold `.delete()` hygiene + `assertNoError` → Global Constraints + Task 3 gate ✅.
- Test-fit works automatically → Phase 2 sweep, confirmed in the smoke doc (Task 3) ✅.
