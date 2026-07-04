# Pasak Phase 2 — Connector Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a parametric catalog of real articulating connectors (keyed locators + mechanically-locking snap-fit) on top of the Phase 1 joint framework, so Pasak's split parts join with proper connectors instead of bare pegs.

**Architecture:** Generalize M1's per-shape joints into a `Connector` interface + registry under `src/lib/cut/connectors/`. M1's shapes are wrapped as keyed connectors via an adapter, and `applyConnectors` dispatches: M1 connectors delegate to the proven `applyJoints` (zero behavior change), new connectors use explicit male/female builders. Web-tier only (manifold-3d WASM).

**Tech Stack:** TypeScript, React 19, Three.js 0.170.0, `manifold-3d@3.4.1` (WASM), Vitest, dual web/desktop Vite targets.

**Spec:** [`../specs/2026-07-03-pasak-phase2-connectors-design.md`](../specs/2026-07-03-pasak-phase2-connectors-design.md)

## Global Constraints

- **Web-only.** All geometry on `manifold-3d` WASM. No `src-tauri/` changes, no new deps.
- **Both build targets pass** before a milestone is done: `npm run build:web` AND `npm run build`; plus `npm run test` and `npm run typecheck`.
- **Zero behavior change in P2-M1.** Existing Phase 1 tests (`tests/cut/joints/*`, `tests/cut/dowel-*`, `tests/cut/cut-client.test.ts`, `tests/session.test.ts`) must pass unchanged; a default cut produces byte-identical geometry via the new abstraction.
- **Manifold `.delete()` discipline** for every intermediate; validate `status() === "NoError"` after each connector boolean; keep features above a documented min wall thickness.
- **Filament CSS tokens** for UI (no `bg-slate-*`); preserve the auto/manual dowel preview flow.
- **Commit style:** Conventional Commits with scope (`feat(connectors):`, `refactor(connectors):`, `docs(...)`), em-dash for what+why. End messages with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Confirmed M1 API** (in `src/lib/cut/joints/`): `buildJointSolid(M, {shape, diameter, length, taper?, grow?})`, `buildJointPiece(M, j)`, `applyJoints(M, partA, partB, joints, preset): {partA, partB, jointPieces}`. Types (`src/types/index.ts`): `Joint`, `JointShape`, `JOINT_SHAPES`, `resolveShape/resolvePolarity/resolveClearance`. Worker (`cut-worker.ts:121`) calls `applyJoints` and serializes `[partA, partB, ...jointPieces]`.

---

## Milestone protocol

Work milestones in order. After **each**: `npm run test`, `typecheck`, `build:web`, `build`; write `docs/p2-mN-<name>-smoke-test.md`; **STOP for review**. M2/M3/M4 are outlined with locked interfaces here and expanded into full TDD detail at the start of each (their geometry depends on M1's as-built `Connector` interface).

---

# P2-M1 — Connector framework (zero behavior change)

Deliverable: the `Connector` interface + registry + M1 adapter + `applyConnectors` dispatcher + connector-picker UI, producing identical output to Phase 1 through the new abstraction.

## File structure (P2-M1)

- Create `src/lib/cut/connectors/types.ts` — `Connector`, `ConnectorCategory`, `AssemblyModel`, `ConnectorParams`, `ConnectorBuild`, `resolveConnectorParams`.
- Create `src/lib/cut/connectors/m1-adapter.ts` — build keyed connectors from `JOINT_SHAPES`.
- Create `src/lib/cut/connectors/registry.ts` — `CONNECTORS`, `getConnector`, `listByCategory`.
- Create `src/lib/cut/connectors/apply.ts` — `applyConnectors` dispatcher.
- Modify `src/types/index.ts` — add optional `connectorId` to `Joint`.
- Modify `src/workers/cut-worker.ts` — call `applyConnectors` instead of `applyJoints`.
- Modify `src/components/CutPanel.tsx` + `src/App.tsx` — connector-catalog picker.
- Tests: `tests/cut/connectors/{types,adapter,registry,apply}.test.ts`, plus a CutPanel test.

---

### Task 1: Connector types

**Files:**
- Create: `src/lib/cut/connectors/types.ts`
- Test: `tests/cut/connectors/types.test.ts`

**Interfaces:**
- Produces: `ConnectorCategory`, `AssemblyModel`, `ConnectorParams`, `ConnectorBuild`, `Connector`,
  `resolveConnectorParams(joint, preset): ConnectorParams`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/cut/connectors/types.test.ts
import { describe, it, expect } from "vitest";
import { resolveConnectorParams } from "../../../src/lib/cut/connectors/types";
import type { Joint } from "../../../src/types";

const j: Joint = { id: "j", position: [0,0,0], axis: [0,0,1], diameter: 6, length: 12, source: "auto" };

describe("resolveConnectorParams", () => {
  it("maps a Joint + preset to ConnectorParams (diameter→size, preset clearance)", () => {
    const p = resolveConnectorParams(j, "pla-tight");
    expect(p.size).toBe(6);
    expect(p.length).toBe(12);
    expect(p.clearance).toBe(0.10); // TOLERANCE_VALUES["pla-tight"]
  });
  it("honors a per-joint clearance override", () => {
    expect(resolveConnectorParams({ ...j, clearance: 0.33 }, "pla-tight").clearance).toBe(0.33);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`resolveConnectorParams` not defined)

Run: `npx vitest run tests/cut/connectors/types.test.ts`

- [ ] **Step 3: Implement the types**

```ts
// src/lib/cut/connectors/types.ts
import type { Joint, TolerancePreset } from "../../../types";
import { resolveClearance } from "../../../types";

export type ConnectorCategory = "keyed" | "snap";
export type AssemblyModel = "separate-piece" | "integral";

export type ConnectorParams = {
  size: number;       // nominal footprint (mm) — from Joint.diameter
  length: number;     // span across the seam (mm)
  taper?: number;     // 0..1 draft
  clearance: number;  // resolved planar/radial clearance (mm)
};

export type ConnectorBuild = {
  /** Cavity subtracted from both halves (separate-piece) or the receiving half (integral). +Z local. */
  femaleCavity(M: any, p: ConnectorParams): any;
  /** Printed connector piece (separate-piece); null for integral. +Z local. */
  piece(M: any, p: ConnectorParams): any | null;
  /** Male feature fused onto the source half (integral only); null for separate-piece. +Z local. */
  integralMale?(M: any, p: ConnectorParams): any | null;
};

export type Connector = {
  id: string;
  name: string;
  category: ConnectorCategory;
  assembly: AssemblyModel;
  defaults: Partial<ConnectorParams>;
  build: ConnectorBuild;
  describe: string;
};

/** Map a placed Joint + tolerance preset to the connector's build params. */
export function resolveConnectorParams(joint: Joint, preset: TolerancePreset): ConnectorParams {
  return {
    size: joint.diameter,
    length: joint.length,
    taper: joint.taper,
    clearance: resolveClearance(joint, preset),
  };
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/cut/connectors/types.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/cut/connectors/types.ts tests/cut/connectors/types.test.ts
git commit -m "feat(connectors): Connector interface + resolveConnectorParams"
```

---

### Task 2: M1 adapter — keyed connectors from JOINT_SHAPES

**Files:**
- Create: `src/lib/cut/connectors/m1-adapter.ts`
- Test: `tests/cut/connectors/adapter.test.ts`

**Interfaces:**
- Produces: `m1KeyedConnectors(): Connector[]` — one keyed, separate-piece `Connector` per `JointShape`,
  whose `femaleCavity` = `buildJointSolid({grow:clearance})`, `piece` = `buildJointSolid({grow:0})`,
  `integralMale` = null.
- Consumes: `buildJointSolid` (shapes.ts), `JOINT_SHAPES`, `Connector` (Task 1).

- [ ] **Step 1: Write the failing test**

```ts
// tests/cut/connectors/adapter.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { initManifold } from "../../../src/lib/cut/manifold";
import { m1KeyedConnectors } from "../../../src/lib/cut/connectors/m1-adapter";

let M: any;
beforeAll(async () => { M = await initManifold(); });

describe("m1KeyedConnectors", () => {
  it("exposes one keyed separate-piece connector per M1 shape", () => {
    const cs = m1KeyedConnectors();
    expect(cs.map((c) => c.id).sort()).toEqual(["cross", "cube", "cylinder", "dovetail", "puzzle"]);
    expect(cs.every((c) => c.category === "keyed" && c.assembly === "separate-piece")).toBe(true);
  });

  it("female cavity is larger than the piece by the clearance", () => {
    const cyl = m1KeyedConnectors().find((c) => c.id === "cylinder")!;
    const p = { size: 6, length: 12, clearance: 0.3 };
    const cavity = cyl.build.femaleCavity(M, p);
    const piece = cyl.build.piece(M, p)!;
    expect(cavity.volume()).toBeGreaterThan(piece.volume());
    expect(cyl.build.integralMale).toBeUndefined();
    cavity.delete(); piece.delete();
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`m1KeyedConnectors` not defined)

Run: `npx vitest run tests/cut/connectors/adapter.test.ts`

- [ ] **Step 3: Implement the adapter**

```ts
// src/lib/cut/connectors/m1-adapter.ts
import type { JointShape } from "../../../types";
import { JOINT_SHAPES } from "../../../types";
import { buildJointSolid } from "../joints/shapes";
import type { Connector } from "./types";

const TITLE: Record<JointShape, string> = {
  cylinder: "Cylinder", cube: "Cube", cross: "Cross", dovetail: "Dovetail", puzzle: "Puzzle",
};

export function m1KeyedConnectors(): Connector[] {
  return JOINT_SHAPES.map((shape) => ({
    id: shape,
    name: TITLE[shape],
    category: "keyed" as const,
    assembly: "separate-piece" as const,
    defaults: {},
    describe: `${TITLE[shape]} key`,
    build: {
      femaleCavity: (M: any, p) =>
        buildJointSolid(M, { shape, diameter: p.size, length: p.length, taper: p.taper, grow: p.clearance }),
      piece: (M: any, p) =>
        buildJointSolid(M, { shape, diameter: p.size, length: p.length, taper: p.taper, grow: 0 }),
      integralMale: undefined,
    },
  }));
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/cut/connectors/adapter.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/cut/connectors/m1-adapter.ts tests/cut/connectors/adapter.test.ts
git commit -m "feat(connectors): m1-adapter — M1 shapes as keyed separate-piece connectors"
```

---

### Task 3: Registry

**Files:**
- Create: `src/lib/cut/connectors/registry.ts`
- Test: `tests/cut/connectors/registry.test.ts`

**Interfaces:**
- Produces: `CONNECTORS: Record<string, Connector>`, `getConnector(id): Connector | undefined`,
  `listByCategory(cat): Connector[]`, `DEFAULT_CONNECTOR_ID = "cylinder"`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/cut/connectors/registry.test.ts
import { describe, it, expect } from "vitest";
import { getConnector, listByCategory, DEFAULT_CONNECTOR_ID } from "../../../src/lib/cut/connectors/registry";

describe("connector registry", () => {
  it("resolves the M1 keyed connectors by id", () => {
    expect(getConnector("cylinder")?.category).toBe("keyed");
    expect(getConnector("nope")).toBeUndefined();
    expect(getConnector(DEFAULT_CONNECTOR_ID)).toBeDefined();
  });
  it("lists keyed connectors (>= the 5 M1 shapes)", () => {
    expect(listByCategory("keyed").length).toBeGreaterThanOrEqual(5);
    expect(listByCategory("snap")).toEqual([]); // none until P2-M3
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/cut/connectors/registry.test.ts`

- [ ] **Step 3: Implement the registry**

```ts
// src/lib/cut/connectors/registry.ts
import type { Connector, ConnectorCategory } from "./types";
import { m1KeyedConnectors } from "./m1-adapter";

export const DEFAULT_CONNECTOR_ID = "cylinder";

const ALL: Connector[] = [...m1KeyedConnectors()];

export const CONNECTORS: Record<string, Connector> = Object.fromEntries(ALL.map((c) => [c.id, c]));

export function getConnector(id: string): Connector | undefined {
  return CONNECTORS[id];
}

export function listByCategory(cat: ConnectorCategory): Connector[] {
  return ALL.filter((c) => c.category === cat);
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/cut/connectors/registry.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/cut/connectors/registry.ts tests/cut/connectors/registry.test.ts
git commit -m "feat(connectors): registry — CONNECTORS, getConnector, listByCategory"
```

---

### Task 4: `applyConnectors` dispatcher (delegates M1 → applyJoints)

**Files:**
- Create: `src/lib/cut/connectors/apply.ts`
- Test: `tests/cut/connectors/apply.test.ts`

**Interfaces:**
- Produces: `applyConnectors(M, partA, partB, joints, preset): { partA, partB, jointPieces }` — same shape as
  `ApplyJointsResult`. For M1 keyed connectors it maps `connectorId → joint.shape` and delegates to
  `applyJoints` (exact M1 behavior). New (non-M1) connectors will branch here in P2-M2+.
- Consumes: `applyJoints` (joints/apply.ts), `getConnector` (Task 3), `JOINT_SHAPES`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/cut/connectors/apply.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { initManifold } from "../../../src/lib/cut/manifold";
import { applyConnectors } from "../../../src/lib/cut/connectors/apply";
import { applyJoints } from "../../../src/lib/cut/joints/apply";
import type { Joint } from "../../../src/types";

let M: any;
beforeAll(async () => { M = await initManifold(); });
const box = () => M.Manifold.cube([30, 30, 30], true);
const joint: Joint = { id: "j", position: [0,0,0], axis: [0,0,1], diameter: 4, length: 20, source: "auto" };

describe("applyConnectors", () => {
  it("matches applyJoints for a default (cylinder) placement", () => {
    const r1 = applyConnectors(M, box(), box(), [joint], "pla-tight");
    const r2 = applyJoints(M, box(), box(), [joint], "pla-tight");
    expect(r1.partA.volume()).toBeCloseTo(r2.partA.volume(), 3);
    expect(r1.jointPieces.length).toBe(r2.jointPieces.length);
    [r1, r2].forEach((r) => { r.partA.delete(); r.partB.delete(); r.jointPieces.forEach((p: any) => p.delete()); });
  });

  it("maps connectorId 'dovetail' onto the dovetail shape", () => {
    const r = applyConnectors(M, box(), box(), [{ ...joint, connectorId: "dovetail" }], "pla-tight");
    expect(r.partA.status()).toBe("NoError");
    expect(r.jointPieces.length).toBe(1);
    r.partA.delete(); r.partB.delete(); r.jointPieces.forEach((p: any) => p.delete());
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/cut/connectors/apply.test.ts`

- [ ] **Step 3: Implement the dispatcher**

```ts
// src/lib/cut/connectors/apply.ts
import type { Joint, JointShape, TolerancePreset } from "../../../types";
import { JOINT_SHAPES } from "../../../types";
import { applyJoints, type ApplyJointsResult } from "../joints/apply";
import { getConnector } from "./registry";

export function applyConnectors(
  M: any, partA: any, partB: any, joints: Joint[], preset: TolerancePreset,
): ApplyJointsResult {
  // P2-M1: every placement resolves to an M1 keyed connector. Map its id onto the
  // legacy `shape` and delegate to the proven applyJoints (exact M1 behavior incl.
  // polarity/magnet). New non-M1 connectors branch here starting P2-M2.
  const mapped = joints.map((j) => {
    if (!j.connectorId) return j;
    const c = getConnector(j.connectorId);
    if (c && JOINT_SHAPES.includes(c.id as JointShape)) {
      return { ...j, shape: c.id as JointShape };
    }
    return j;
  });
  return applyJoints(M, partA, partB, mapped, preset);
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/cut/connectors/apply.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/cut/connectors/apply.ts tests/cut/connectors/apply.test.ts
git commit -m "feat(connectors): applyConnectors dispatcher — delegates M1 connectors to applyJoints"
```

---

### Task 5: Add `connectorId` to Joint + route the worker through `applyConnectors`

**Files:**
- Modify: `src/types/index.ts` (add `connectorId?: string` to `Joint`)
- Modify: `src/workers/cut-worker.ts:6,121` (import + call `applyConnectors`)
- Test: `tests/cut/cut-client.test.ts` (add a connectorId round-trip; existing tests must pass)

**Interfaces:**
- `Joint` gains `connectorId?: string` (defaults to the M1 cylinder path when absent).
- The worker's cut handler calls `applyConnectors(M, …, dowels, tolerance)`; response unchanged.

- [ ] **Step 1: Add a failing worker/client test**

```ts
// tests/cut/cut-client.test.ts — add (reuse the file's cube mesh + plane setup)
it("runs a cut with a connectorId and returns parts + one piece", async () => {
  const res = await runCut(cubeMesh, plane, [
    { id: "j", position: [0,0,0], axis: [0,0,1], diameter: 4, length: 8, source: "auto", connectorId: "cube" },
  ], "pla-tight");
  expect(res.partA).toBeDefined();
  expect(res.dowelPieces.length).toBe(1);
});
```

- [ ] **Step 2: Run — expect FAIL** (worker still calls `applyJoints`; `connectorId` not on `Joint`)

Run: `npx vitest run tests/cut/cut-client.test.ts`

- [ ] **Step 3: Implement**

In `src/types/index.ts`, add to `Joint`: `connectorId?: string; // catalog connector; absent ⇒ M1 shape`.
In `src/workers/cut-worker.ts`: replace `import { applyJoints } from "../lib/cut/joints/apply";` with
`import { applyConnectors } from "../lib/cut/connectors/apply";` and change the call at ~line 121 to
`const result = applyConnectors(M, cut.partA.manifold, cut.partB.manifold, dowels, tolerance);` (leave the
serialize/cleanup of `[partA, partB, ...jointPieces]` unchanged).

- [ ] **Step 4: Run — expect PASS** (new + all existing cut tests)

Run: `npx vitest run tests/cut/`
Expected: PASS, including the untouched `joints/*` and `dowel-*` back-compat tests.

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/workers/cut-worker.ts tests/cut/cut-client.test.ts
git commit -m "feat(connectors): Joint.connectorId + route cut worker through applyConnectors"
```

---

### Task 6: Connector-catalog picker in CutPanel

**Files:**
- Modify: `src/components/CutPanel.tsx`
- Modify: `src/App.tsx` (own `connectorId` state; set it on auto/manual joints)
- Test: `tests/components/CutPanel.test.tsx` (add)

**Interfaces:**
- `CutPanel` gains props `connectorId: string`, `onConnectorChange: (id: string) => void`. Renders a category
  segment (Keyed / Snap) + a connector `<select>` from `listByCategory`. `App` sets `connectorId` on each
  `Joint` it builds. Default `connectorId = DEFAULT_CONNECTOR_ID` ("cylinder") — behavior unchanged.

- [ ] **Step 1: Write the failing UI test**

```tsx
// tests/components/CutPanel.test.tsx — excerpt, match existing harness
it("calls onConnectorChange when a connector is selected", async () => {
  const onConnector = vi.fn();
  render(<CutPanel {...baseProps} connectorId="cylinder" onConnectorChange={onConnector} />);
  await userEvent.selectOptions(screen.getByLabelText(/connector/i), "dovetail");
  expect(onConnector).toHaveBeenCalledWith("dovetail");
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/components/CutPanel.test.tsx`

- [ ] **Step 3: Implement the picker (Filament tokens)**

Replace (or augment) the M1 shape `<select>` with a connector `<select aria-label="Connector">` whose
options come from `listByCategory(category)` (a small Keyed/Snap segment control drives `category`; Snap is
empty until P2-M3, so default to Keyed). Wire the new props; in `App.tsx` add `connectorId` state (default
`DEFAULT_CONNECTOR_ID`) and set `connectorId` on the joints produced by `autoPlaceCutDowels` and manual adds.
Keep the existing `jointShape` state as a fallback or remove it if fully superseded (the connector id carries
the shape for keyed connectors).

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/components/CutPanel.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/components/CutPanel.tsx src/App.tsx tests/components/CutPanel.test.tsx
git commit -m "feat(connectors): catalog picker in cut panel — category + connector select"
```

---

### Task 7: P2-M1 verification + smoke doc

- [ ] **Step 1:** `npm run test && npm run typecheck` → PASS (all Phase 1 tests still green).
- [ ] **Step 2:** `npm run build:web && npm run build` → both succeed.
- [ ] **Step 3:** Write `docs/p2-m1-connector-framework-smoke-test.md` (existing style): pick each keyed
  connector from the catalog, cut, confirm output matches the Phase 1 shape output and parts/pieces export.
- [ ] **Step 4:** `git add docs/p2-m1-connector-framework-smoke-test.md && git commit -m "docs(p2-m1): connector-framework smoke checklist"`
- [ ] **STOP — pause for user review before P2-M2.**

---

# P2-M2 — Keyed catalog (outline)

Expand to full TDD detail after P2-M1 review. Locked interfaces:

- **New `t-slot` connector** (`src/lib/cut/connectors/keyed/t-slot.ts`): a T cross-section built via two
  `CrossSection` rectangles unioned (stem + cap), extruded; `femaleCavity` = profile `offset(clearance)`;
  `piece` = nominal; separate-piece. Resists lateral pull-out.
- **Formalize** dovetail-slide / puzzle-tab / cross-key / taper-pin as first-class keyed connectors (own
  modules with tuned defaults + `describe`), replacing the generic m1-adapter entries for those ids while the
  adapter keeps `cylinder`/`cube`. `applyConnectors` routes these through the generic separate-piece path
  (subtract `femaleCavity` both halves, emit `piece`) instead of delegating to `applyJoints`.
- **Generic separate-piece apply path** in `connectors/apply.ts`: for a non-delegated connector, subtract
  `build.femaleCavity` (placed via `placeSolid`) from both halves and emit `build.piece`. Reuses
  `orient.ts` `placeSolid`/`shiftAlong`.
- Tests `tests/cut/connectors/keyed/*`: each connector's cavity > piece by clearance; t-slot resists a
  lateral shift (piece shifted along the slot still `subtract(cavity).isEmpty()`, shifted across does not).
- Tasks: (1) generic separate-piece path in applyConnectors + test; (2) t-slot + test; (3) dovetail-slide
  module + test; (4) puzzle-tab/cross-key/taper-pin modules + tests; (5) registry wiring + UI options;
  (6) verify + `docs/p2-m2-keyed-catalog-smoke-test.md`; STOP.

---

# P2-M3 — Snap-fit set (outline)

Highest geometry risk — extra review on undercut manifoldness + printability. Locked interfaces:

- **`snap-pin`** (`connectors/snap/snap-pin.ts`, separate-piece): `piece` = stem cylinder + a barb (cone/
  hemisphere wider than the stem) at each end; `femaleCavity` = stem bore + a relief groove (torus/step)
  wider than the bore at barb depth so the barb catches. Undercut = the relief is wider than the mouth.
- **`snap-dovetail`** (separate-piece): dovetail key + a detent bump; cavity has a matching dimple that
  clicks at full insertion.
- **`cantilever-clip`** (`integral`): `integralMale` = a flexible arm with a hook fused onto the source half;
  `femaleCavity` = a catch ledge recessed into the receiving half; `piece` = null.
- **Integral apply path** in `connectors/apply.ts`: for `assembly === "integral"`, `union` `integralMale`
  onto the source half (which half = the placement's side; default partA) and `subtract` `femaleCavity` from
  the receiving half; emit no piece.
- Tests `tests/cut/connectors/snap/*`: each build is a valid manifold (`status NoError`); **undercut check**
  — the cavity cross-section is wider at barb depth than at the mouth; **snap fit** — piece shifted by
  ~clearance still fits the cavity; integral: source half gains volume (male fused), receiver loses volume
  (catch), no piece emitted.
- Tasks: (1) integral apply path + test; (2) snap-pin + undercut/fit tests; (3) snap-dovetail + tests;
  (4) cantilever-clip + integral tests; (5) registry+UI (Snap category populated); (6) verify +
  `docs/p2-m3-snapfit-smoke-test.md`; STOP.

---

# P2-M4 — Connector test-fit + tolerance presets (outline)

- **Extend the M2 generator** (`src/lib/cut/test-fit.ts`): `generateConnectorTestFit(M, connectorId, opts)`
  emits coupon pairs (a block carrying the connector's male/integral feature + a block with its
  `femaleCavity`) across a clearance sweep, reusing the block/naming/zip path. Per-connector
  `defaults.clearance` seed the sweep.
- **Worker op + client**: extend the `testfit` op (or add `connector-testfit`) + a `runConnectorTestFit`
  bridge through `submit`; UI action "Test-fit this connector".
- **Per-connector clearance defaults** surfaced in the CutPanel picker.
- Tests: coupon count, clearance sweep monotonic, socket grows with clearance, snap coupon piece fits the
  swept sockets at/after its default clearance.
- Tasks: (1) generateConnectorTestFit + test; (2) worker/client bridge + test; (3) UI action + defaults;
  (4) verify + `docs/p2-m4-connector-testfit-smoke-test.md`; STOP.

---

## Self-review (spec coverage)

- Connector interface + registry + M1 adapter → Tasks 1-3 ✅; `applyConnectors` dispatcher → Task 4 ✅;
  `connectorId` + worker wiring → Task 5 ✅; catalog picker UI → Task 6 ✅; zero-behavior-change gate →
  Tasks 4-5 (delegation) + Task 7 ✅.
- Keyed catalog (t-slot + formalized shapes) → P2-M2 ✅; snap-fit set (snap-pin/snap-dovetail/cantilever) +
  both assembly models → P2-M3 ✅; connector test-fit + tolerance presets → P2-M4 ✅.
- Web-only / no src-tauri → all tasks WASM-side ✅. Both-build gate → each milestone verify ✅. Manifold
  status validation + `.delete()` → per-connector tests + apply paths ✅.
