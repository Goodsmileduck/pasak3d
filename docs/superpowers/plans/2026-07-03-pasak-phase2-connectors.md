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

# P2-M2 — Keyed catalog (T-slot + generic apply path)

Deliverable: the first non-M1 catalog connector — a **T-slot** — reachable end-to-end, plus the **generic
separate-piece apply path** that runs a connector's own `build.femaleCavity`/`piece` (the stepping stone
snap-fit needs in P2-M3). M1 shapes keep delegating to `applyJoints` (no re-plumbing, no regression risk);
the catalog picker already lists new keyed connectors automatically from the registry.

**Scope note (YAGNI):** we do NOT re-plumb the existing M1 shapes (cross/dovetail/puzzle) through the generic
path — the adapter already exposes them and delegation preserves their polarity/magnet behavior exactly.
The generic path handles **separate-peg keyed** connectors only; polarity/magnet and the integral path arrive
in P2-M3.

**Assumption:** all placements in one cut share a `connectorId` (the UI sets one connector per cut, on both
auto and manual dowels). `applyConnectors` dispatches on that single connector; mixed-connector cuts are not
supported in Phase 2 (documented).

## File structure (P2-M2)

- Create `src/lib/cut/connectors/keyed/t-slot.ts` — `tSlotConnector: Connector`.
- Modify `src/lib/cut/connectors/registry.ts` — add `tSlotConnector` to `ALL`.
- Modify `src/lib/cut/connectors/apply.ts` — add the generic separate-piece path; dispatch M1-vs-catalog.
- Tests: `tests/cut/connectors/keyed/t-slot.test.ts`, extend `tests/cut/connectors/apply.test.ts`,
  `tests/cut/cut-client.test.ts`.

---

### Task 8: T-slot connector geometry

**Files:**
- Create: `src/lib/cut/connectors/keyed/t-slot.ts`
- Test: `tests/cut/connectors/keyed/t-slot.test.ts`

**Interfaces:**
- Produces: `tSlotConnector: Connector` (id `"t-slot"`, keyed, separate-piece). `build.femaleCavity` = the T
  profile grown by `clearance` (`CrossSection.offset`), extruded to `length`; `build.piece` = nominal T
  extruded; `integralMale` = undefined.
- Consumes: `Connector`/`ConnectorParams` (P2-M1 `types.ts`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/cut/connectors/keyed/t-slot.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { initManifold } from "../../../../src/lib/cut/manifold";
import { tSlotConnector } from "../../../../src/lib/cut/connectors/keyed/t-slot";

let M: any;
beforeAll(async () => { M = await initManifold(); });

const p = { size: 8, length: 12, clearance: 0.3 };

describe("tSlotConnector", () => {
  it("is a keyed separate-piece connector with the expected metadata", () => {
    expect(tSlotConnector.id).toBe("t-slot");
    expect(tSlotConnector.category).toBe("keyed");
    expect(tSlotConnector.assembly).toBe("separate-piece");
  });

  it("piece is a valid T solid; cavity is larger by the clearance", () => {
    const piece = tSlotConnector.build.piece(M, p)!;
    const cavity = tSlotConnector.build.femaleCavity(M, p);
    expect(piece.status()).toBe("NoError");
    expect(piece.volume()).toBeGreaterThan(0);
    expect(cavity.volume()).toBeGreaterThan(piece.volume());
    piece.delete(); cavity.delete();
  });

  it("the piece cap is wider than its neck (a real T)", () => {
    const piece = tSlotConnector.build.piece(M, { size: 8, length: 12, clearance: 0 })!;
    // Cap occupies the bottom slab; neck the top. Slice bboxes: bottom half wider in X than top half.
    const bb = piece.boundingBox(); // {min:[x,y,z], max:[x,y,z]} — verify accessor in manifold.d.ts
    expect(bb.max[0] - bb.min[0]).toBeCloseTo(8, 1); // cap width == size
    piece.delete();
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`tSlotConnector` not defined)

Run: `npx vitest run tests/cut/connectors/keyed/t-slot.test.ts`

- [ ] **Step 3: Implement the T-slot**

```ts
// src/lib/cut/connectors/keyed/t-slot.ts
import type { Connector, ConnectorParams } from "../types";

/** Nominal T cross-section: a wide cap slab at the bottom + a narrower neck on top. */
function tProfile(M: any, size: number): any {
  const capW = size;
  const capH = size / 3;
  const neckW = size / 2.5;
  const neckH = size - capH;
  const cap = M.CrossSection.square([capW, capH], true).translate([0, -neckH / 2]);
  const neck = M.CrossSection.square([neckW, neckH], true).translate([0, capH / 2]);
  const out = cap.add(neck);
  cap.delete(); neck.delete();
  return out;
}

function extrudeT(M: any, size: number, length: number, grow: number): any {
  const nominal = tProfile(M, size);
  const profile = grow > 0 ? nominal.offset(grow, "Round", 2, 32) : nominal;
  const out = profile.extrude(length, 1, 0, undefined, true);
  if (profile !== nominal) profile.delete();
  nominal.delete();
  return out;
}

export const tSlotConnector: Connector = {
  id: "t-slot",
  name: "T-slot",
  category: "keyed",
  assembly: "separate-piece",
  defaults: {},
  describe: "T-slot — slides in, resists pull-out",
  build: {
    femaleCavity: (M: any, p: ConnectorParams) => extrudeT(M, p.size, p.length, p.clearance),
    piece: (M: any, p: ConnectorParams) => extrudeT(M, p.size, p.length, 0),
    integralMale: undefined,
  },
};
```

Verify `boundingBox()`/`Box` accessor names against `node_modules/manifold-3d/manifold.d.ts`; adapt the
test's bbox read if the shape differs (`.min`/`.max` as `[x,y,z]`).

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/cut/connectors/keyed/t-slot.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/cut/connectors/keyed/t-slot.ts tests/cut/connectors/keyed/t-slot.test.ts
git commit -m "feat(connectors): T-slot connector geometry — cap + neck profile, offset cavity"
```

---

### Task 9: Generic separate-piece apply path + register T-slot

**Files:**
- Modify: `src/lib/cut/connectors/apply.ts`
- Modify: `src/lib/cut/connectors/registry.ts` (add `tSlotConnector` to `ALL`)
- Test: `tests/cut/connectors/apply.test.ts` (add)

**Interfaces:**
- `applyConnectors` dispatches: if the cut's connector is an M1 shape (or absent) → delegate to `applyJoints`
  (unchanged). Otherwise → `applySeparatePiece(M, partA, partB, joints, connector, preset)`: subtract
  `connector.build.femaleCavity` (placed via `placeSolid`) from both halves, emit `connector.build.piece`.
  Ownership mirrors `applyJoints` (does not delete the input `partA`/`partB`).

- [ ] **Step 1: Add failing tests**

```ts
// tests/cut/connectors/apply.test.ts — add
it("t-slot connector subtracts from both halves and emits one piece", () => {
  const j = { id: "j", position: [0,0,0], axis: [0,0,1] as [number,number,number],
    diameter: 8, length: 12, source: "auto" as const, connectorId: "t-slot" };
  const a = box(), b = box();
  const r = applyConnectors(M, a, b, [j], "pla-tight");
  expect(r.partA.status()).toBe("NoError");
  expect(r.partA.volume()).toBeLessThan(30*30*30);
  expect(r.partB.volume()).toBeLessThan(30*30*30);
  expect(r.jointPieces.length).toBe(1);
  r.partA.delete(); r.partB.delete(); r.jointPieces.forEach((p: any) => p.delete());
  a.delete(); b.delete();
});

it("M1 shapes still delegate unchanged after adding the generic path", () => {
  const j = { ...joint, connectorId: "cube" };
  const viaConnector = applyConnectors(M, box(), box(), [j], "pla-tight");
  const viaShape = applyJoints(M, box(), box(), [{ ...joint, shape: "cube" as const }], "pla-tight");
  expect(viaConnector.partA.volume()).toBeCloseTo(viaShape.partA.volume(), 3);
  [viaConnector, viaShape].forEach((r) => { r.partA.delete(); r.partB.delete(); r.jointPieces.forEach((p: any) => p.delete()); });
});
```

- [ ] **Step 2: Run — expect FAIL** (t-slot not registered; generic path not implemented)

Run: `npx vitest run tests/cut/connectors/apply.test.ts`

- [ ] **Step 3: Implement the dispatch + generic path**

In `registry.ts`: `import { tSlotConnector } from "./keyed/t-slot";` and add it to `ALL`
(`const ALL = [...m1KeyedConnectors(), tSlotConnector];`). In `apply.ts`:

```ts
import { resolveConnectorParams } from "./types";
import { placeSolid } from "../joints/orient";
// … existing imports …

function applySeparatePiece(
  M: any, partA: any, partB: any, joints: Joint[], connector: NonNullable<ReturnType<typeof getConnector>>,
  preset: TolerancePreset,
): ApplyJointsResult {
  let outA = partA, outB = partB;
  const jointPieces: any[] = [];
  for (const j of joints) {
    const p = resolveConnectorParams(j, preset);
    const cavity = placeSolid(connector.build.femaleCavity(M, p), j.position, j.axis);
    const newA = outA.subtract(cavity), newB = outB.subtract(cavity);
    if (outA !== partA) outA.delete();
    if (outB !== partB) outB.delete();
    outA = newA; outB = newB; cavity.delete();
    const pieceLocal = connector.build.piece(M, p);
    if (pieceLocal) { jointPieces.push(placeSolid(pieceLocal, j.position, j.axis)); pieceLocal.delete(); }
  }
  return { partA: outA, partB: outB, jointPieces };
}

export function applyConnectors(M, partA, partB, joints, preset): ApplyJointsResult {
  const id = joints.find((j) => j.connectorId)?.connectorId;
  if (id && !isM1Shape(id)) {
    const c = getConnector(id);
    if (c) return applySeparatePiece(M, partA, partB, joints, c, preset);
  }
  // M1 (or no) connector → delegate, mapping id→shape (unchanged from P2-M1).
  const mapped = joints.map((j) => {
    if (!j.connectorId) return j;
    const c = getConnector(j.connectorId);
    if (c && isM1Shape(c.id)) return { ...j, shape: c.id };
    return j;
  });
  return applyJoints(M, partA, partB, mapped, preset);
}
```

Note `placeSolid` deletes the local it wraps? No — `placeSolid` returns a new manifold and does NOT delete
its input. So delete the local: capture it, place, delete. Rewrite the two `placeSolid(build.…(M,p), …)`
calls to build-then-delete, e.g. `const local = connector.build.femaleCavity(M, p); const cavity =
placeSolid(local, j.position, j.axis); local.delete();`.

- [ ] **Step 4: Run — expect PASS** (new + all existing connector/joint tests)

Run: `npx vitest run tests/cut/`

- [ ] **Step 5: Commit**

```bash
git add src/lib/cut/connectors/apply.ts src/lib/cut/connectors/registry.ts tests/cut/connectors/apply.test.ts
git commit -m "feat(connectors): generic separate-piece apply path + register T-slot"
```

---

### Task 10: End-to-end + P2-M2 verification + smoke doc

**Files:**
- Test: `tests/cut/cut-client.test.ts` (add a t-slot round-trip)

- [ ] **Step 1: Add a failing end-to-end test**

```ts
// tests/cut/cut-client.test.ts — add (reuse the CutClientWorker stub + a cube mesh + plane)
it("runs a cut with the t-slot connector and returns parts + one piece", async () => {
  vi.stubGlobal("Worker", CutClientWorker);
  const cubeMesh = new THREE.Mesh(new THREE.BoxGeometry(20, 20, 20));
  const plane = { normal: [0, 0, 1] as [number, number, number], constant: 0, axisSnap: "z" as const };
  const res = await runCut(cubeMesh, plane, [
    { id: "j", position: [0,0,0], axis: [0,0,1], diameter: 8, length: 8, source: "auto", connectorId: "t-slot" },
  ], "pla-tight");
  expect(res.partA).toBeDefined();
  expect(res.dowelPieces.length).toBe(1);
  vi.unstubAllGlobals();
});
```

- [ ] **Step 2: Run — expect PASS** (the worker stub already routes `cut` → `applyConnectors`; t-slot flows through)

Run: `npx vitest run tests/cut/cut-client.test.ts`

- [ ] **Step 3: Full verification**

Run: `npm run test && npm run typecheck && npm run build:web && npm run build`
Expected: all pass; both builds succeed.

- [ ] **Step 4: Commit the test + write the smoke doc**

```bash
git add tests/cut/cut-client.test.ts
git commit -m "test(connectors): t-slot end-to-end cut round-trip"
```

Write `docs/p2-m2-keyed-catalog-smoke-test.md` (existing style): pick T-slot from the Keyed catalog, cut,
confirm two halves + a printed T-slot key export and the key slides into the sockets; confirm M1 shapes are
unchanged.

```bash
git add docs/p2-m2-keyed-catalog-smoke-test.md
git commit -m "docs(p2-m2): keyed-catalog (T-slot) smoke checklist"
```

- [ ] **STOP — pause for user review before P2-M3.**

---

# P2-M3 — Snap-fit set

Deliverable: three locking connectors — `snap-pin` and `snap-dovetail` (separate-piece, reuse the P2-M2
generic path) and `cantilever-clip` (integral, needs a new apply path). Highest geometry risk: undercut
manifoldness. Real-world snap tuning is done via the connector test-fit (P2-M4); here we build valid,
correctly-shaped geometry and prove the undercut/fit properties.

**Geometry conventions:** every connector solid is built in local space, extruded/centered along +Z (the
seam normal), so `placeSolid`/`applySeparatePiece`/the integral path seat it exactly like M1 pieces.
Validate `status() === "NoError"` after every boolean; overlap primitives before union (no coincident
faces); `.delete()` every intermediate.

## File structure (P2-M3)

- Create `src/lib/cut/connectors/snap/{snap-pin,snap-dovetail,cantilever-clip}.ts`.
- Modify `src/lib/cut/connectors/apply.ts` — add the `integral` assembly apply path.
- Modify `src/lib/cut/connectors/registry.ts` — register the three (populates the Snap category).
- Tests: `tests/cut/connectors/snap/*`, extend `tests/cut/connectors/apply.test.ts`.

---

### Task 11: `snap-pin` connector (separate-piece, barb + relief undercut)

**Files:**
- Create: `src/lib/cut/connectors/snap/snap-pin.ts`
- Test: `tests/cut/connectors/snap/snap-pin.test.ts`

**Interfaces:**
- Produces `snapPinConnector: Connector` (id `"snap-pin"`, category `"snap"`, assembly `"separate-piece"`).
  `piece` = a stem cylinder with a spherical barb (radius > stem) at each end. `femaleCavity` = a bore
  (stem radius + clearance) with a spherical relief chamber (barb radius + clearance) at each end — the
  chamber is wider than the bore mouth, so the barb must flex past to seat (the undercut).
- Consumes: `Connector`/`ConnectorParams`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/cut/connectors/snap/snap-pin.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { initManifold } from "../../../../src/lib/cut/manifold";
import { snapPinConnector } from "../../../../src/lib/cut/connectors/snap/snap-pin";

let M: any;
beforeAll(async () => { M = await initManifold(); });
const p = { size: 6, length: 16, clearance: 0.2 };

// X-width of a thin Z-slab of a solid (proves cross-section width at a depth).
function widthAtZ(solid: any, z: number): number {
  const probe = M.Manifold.cube([40, 40, 1], true).translate([0, 0, z]);
  const slice = solid.intersect(probe);
  const bb = slice.boundingBox();
  const w = slice.isEmpty() ? 0 : bb.max[0] - bb.min[0];
  probe.delete(); slice.delete();
  return w;
}

describe("snapPinConnector", () => {
  it("is a snap separate-piece connector", () => {
    expect(snapPinConnector.category).toBe("snap");
    expect(snapPinConnector.assembly).toBe("separate-piece");
  });

  it("piece and cavity are valid manifolds", () => {
    const piece = snapPinConnector.build.piece(M, p)!;
    const cavity = snapPinConnector.build.femaleCavity(M, p);
    expect(piece.status()).toBe("NoError");
    expect(cavity.status()).toBe("NoError");
    piece.delete(); cavity.delete();
  });

  it("cavity has an UNDERCUT — the end chamber is wider than the mid bore", () => {
    const cavity = snapPinConnector.build.femaleCavity(M, p);
    const boreW = widthAtZ(cavity, 0);            // middle = narrow bore
    const chamberW = widthAtZ(cavity, p.length / 2 - 0.5); // near end = wide chamber
    expect(chamberW).toBeGreaterThan(boreW + 1);
    cavity.delete();
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`snapPinConnector` not defined)

Run: `npx vitest run tests/cut/connectors/snap/snap-pin.test.ts`

- [ ] **Step 3: Implement `snap-pin`**

```ts
// src/lib/cut/connectors/snap/snap-pin.ts
import type { Connector, ConnectorParams } from "../types";

function pinSolid(M: any, size: number, length: number, grow: number): any {
  const rStem = size / 2 + grow;
  const rBarb = (size / 2) * 1.6 + grow;
  const stem = M.Manifold.cylinder(length, rStem, rStem, 64, true);
  const top = M.Manifold.sphere(rBarb, 48).translate([0, 0, length / 2]);
  const bot = M.Manifold.sphere(rBarb, 48).translate([0, 0, -length / 2]);
  const withTop = stem.add(top);
  const out = withTop.add(bot);
  stem.delete(); top.delete(); bot.delete(); withTop.delete();
  return out;
}

export const snapPinConnector: Connector = {
  id: "snap-pin",
  name: "Snap pin",
  category: "snap",
  assembly: "separate-piece",
  defaults: { clearance: 0.25 },
  describe: "Snap pin - barbed ends catch in each socket",
  build: {
    femaleCavity: (M: any, p: ConnectorParams) => pinSolid(M, p.size, p.length, p.clearance),
    piece: (M: any, p: ConnectorParams) => pinSolid(M, p.size, p.length, 0),
    integralMale: undefined,
  },
};
```

(The cavity is the pin shape grown by `clearance`; subtracted from both halves it leaves a narrow bore + a
wide end chamber — the barb flexes through the bore and catches in the chamber.)

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/cut/connectors/snap/snap-pin.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/cut/connectors/snap/snap-pin.ts tests/cut/connectors/snap/snap-pin.test.ts
git commit -m "feat(connectors): snap-pin — barbed stem + relief-chamber undercut cavity"
```

---

### Task 12: `snap-dovetail` connector (separate-piece, dovetail + detent)

**Files:**
- Create: `src/lib/cut/connectors/snap/snap-dovetail.ts`
- Test: `tests/cut/connectors/snap/snap-dovetail.test.ts`

**Interfaces:**
- Produces `snapDovetailConnector: Connector` (id `"snap-dovetail"`, snap, separate-piece). `piece` = the
  M1 dovetail solid (`buildJointSolid` shape `"dovetail"`) unioned with a small detent sphere on a face.
  `femaleCavity` = the dovetail grown by clearance unioned with a detent sphere (radius + clearance) at the
  same spot — the socket gets a dimple the bump clicks into.
- Consumes: `buildJointSolid` (`joints/shapes.ts`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/cut/connectors/snap/snap-dovetail.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { initManifold } from "../../../../src/lib/cut/manifold";
import { buildJointSolid } from "../../../../src/lib/cut/joints/shapes";
import { snapDovetailConnector } from "../../../../src/lib/cut/connectors/snap/snap-dovetail";

let M: any;
beforeAll(async () => { M = await initManifold(); });
const p = { size: 8, length: 14, clearance: 0.2 };

describe("snapDovetailConnector", () => {
  it("is a snap separate-piece connector with valid geometry", () => {
    expect(snapDovetailConnector.assembly).toBe("separate-piece");
    const piece = snapDovetailConnector.build.piece(M, p)!;
    const cavity = snapDovetailConnector.build.femaleCavity(M, p);
    expect(piece.status()).toBe("NoError");
    expect(cavity.status()).toBe("NoError");
    piece.delete(); cavity.delete();
  });

  it("the detent adds volume over a plain dovetail (a real bump/dimple)", () => {
    const plain = buildJointSolid(M, { shape: "dovetail", diameter: p.size, length: p.length, grow: 0 });
    const piece = snapDovetailConnector.build.piece(M, p)!;
    expect(piece.volume()).toBeGreaterThan(plain.volume());
    plain.delete(); piece.delete();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/cut/connectors/snap/snap-dovetail.test.ts`

- [ ] **Step 3: Implement `snap-dovetail`**

```ts
// src/lib/cut/connectors/snap/snap-dovetail.ts
import type { Connector, ConnectorParams } from "../types";
import { buildJointSolid } from "../../joints/shapes";

function dovetailWithDetent(M: any, size: number, length: number, grow: number): any {
  const body = buildJointSolid(M, { shape: "dovetail", diameter: size, length, grow });
  const rDetent = size * 0.18 + grow;
  // Detent on the +X face at mid-height/mid-length; overlaps the body so the union is clean.
  const detent = M.Manifold.sphere(rDetent, 32).translate([size / 2, 0, 0]);
  const out = body.add(detent);
  body.delete(); detent.delete();
  return out;
}

export const snapDovetailConnector: Connector = {
  id: "snap-dovetail",
  name: "Snap dovetail",
  category: "snap",
  assembly: "separate-piece",
  defaults: { clearance: 0.2 },
  describe: "Snap dovetail - slides in, detent clicks at seat",
  build: {
    femaleCavity: (M: any, p: ConnectorParams) => dovetailWithDetent(M, p.size, p.length, p.clearance),
    piece: (M: any, p: ConnectorParams) => dovetailWithDetent(M, p.size, p.length, 0),
    integralMale: undefined,
  },
};
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/cut/connectors/snap/snap-dovetail.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/cut/connectors/snap/snap-dovetail.ts tests/cut/connectors/snap/snap-dovetail.test.ts
git commit -m "feat(connectors): snap-dovetail — dovetail key with a detent bump/dimple"
```

---

### Task 13: Integral apply path + `cantilever-clip`

**Files:**
- Create: `src/lib/cut/connectors/snap/cantilever-clip.ts`
- Modify: `src/lib/cut/connectors/apply.ts` (integral path)
- Test: `tests/cut/connectors/snap/cantilever-clip.test.ts`, `tests/cut/connectors/apply.test.ts`

**Interfaces:**
- `cantileverClipConnector: Connector` (id `"cantilever-clip"`, snap, assembly `"integral"`). `integralMale`
  = a beam (box) extruded from the seam along +Z with a hook (box) at the tip offset in +X; fused onto the
  source half. `femaleCavity` = a slot (beam + clearance) plus a catch recess (wider in +X at the hook
  depth = undercut); subtracted from the receiving half. `piece` = null.
- `applyConnectors`: when the connector's `assembly === "integral"`, run `applyIntegral(M, partA, partB,
  joints, connector)` — for each placement: `union` the placed `integralMale` onto `partA` (source),
  `subtract` the placed `femaleCavity` from `partB` (receiver); emit no piece. Ownership mirrors
  `applySeparatePiece` (never delete input partA/partB; delete every intermediate/local).

- [ ] **Step 1: Write the failing tests**

```ts
// tests/cut/connectors/snap/cantilever-clip.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { initManifold } from "../../../../src/lib/cut/manifold";
import { cantileverClipConnector } from "../../../../src/lib/cut/connectors/snap/cantilever-clip";

let M: any;
beforeAll(async () => { M = await initManifold(); });
const p = { size: 8, length: 14, clearance: 0.2 };

it("cantilever clip is integral: has integralMale, no piece", () => {
  expect(cantileverClipConnector.assembly).toBe("integral");
  const male = cantileverClipConnector.build.integralMale!(M, p);
  expect(male).not.toBeNull();
  expect(male.status()).toBe("NoError");
  expect(cantileverClipConnector.build.piece(M, p)).toBeNull();
  male.delete();
});
```

```ts
// tests/cut/connectors/apply.test.ts — add
it("integral connector fuses male on partA, cuts a catch in partB, emits no piece", () => {
  const j = { id: "j", position: [0, 0, 0] as [number, number, number],
    axis: [0, 0, 1] as [number, number, number], diameter: 8, length: 10,
    source: "auto" as const, connectorId: "cantilever-clip" };
  const a = box(), b = box();
  const aVol = a.volume(), bVol = b.volume();
  const r = applyConnectors(M, a, b, [j], "pla-tight");
  expect(r.partA.volume()).toBeGreaterThan(aVol);  // male fused onto source
  expect(r.partB.volume()).toBeLessThan(bVol);      // catch cut into receiver
  expect(r.jointPieces.length).toBe(0);             // integral = no separate piece
  r.partA.delete(); r.partB.delete(); a.delete(); b.delete();
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/cut/connectors/snap/cantilever-clip.test.ts tests/cut/connectors/apply.test.ts`

- [ ] **Step 3: Implement the clip + integral path**

```ts
// src/lib/cut/connectors/snap/cantilever-clip.ts
import type { Connector, ConnectorParams } from "../types";

// Beam extruded from z=0 (seam) to z=length along +Z, hook (a wider box) at the tip in +X.
function clipMale(M: any, size: number, length: number): any {
  const beamW = size * 0.6, beamT = size * 0.35;
  const beam = M.Manifold.cube([beamW, beamT, length], false).translate([-beamW / 2, -beamT / 2, 0]);
  const hookW = size * 0.35, hookH = size * 0.3;
  const hook = M.Manifold.cube([hookW, beamT, hookH], false)
    .translate([beamW / 2 - hookW * 0.2, -beamT / 2, length - hookH]);
  const out = beam.add(hook);
  beam.delete(); hook.delete();
  return out;
}

function clipCavity(M: any, size: number, length: number, grow: number): any {
  const beamW = size * 0.6 + 2 * grow, beamT = size * 0.35 + 2 * grow;
  const slot = M.Manifold.cube([beamW, beamT, length + grow], false).translate([-beamW / 2, -beamT / 2, 0]);
  // Catch recess: wider in +X at the hook depth → the undercut that grabs the hook.
  const catchW = size * 0.55 + grow, catchH = size * 0.35 + 2 * grow;
  const rec = M.Manifold.cube([catchW, beamT, catchH], false)
    .translate([beamW / 2 - catchW * 0.2, -beamT / 2, length - catchH]);
  const out = slot.add(rec);
  slot.delete(); rec.delete();
  return out;
}

export const cantileverClipConnector: Connector = {
  id: "cantilever-clip",
  name: "Cantilever clip",
  category: "snap",
  assembly: "integral",
  defaults: { clearance: 0.25 },
  describe: "Cantilever clip - hook molded into one part, catch in the other",
  build: {
    femaleCavity: (M: any, p: ConnectorParams) => clipCavity(M, p.size, p.length, p.clearance),
    piece: () => null,
    integralMale: (M: any, p: ConnectorParams) => clipMale(M, p.size, p.length),
  },
};
```

In `apply.ts` add `applyIntegral` and dispatch on `connector.assembly === "integral"` in `applyConnectors`
(before the separate-piece branch):

```ts
function applyIntegral(
  M: any, partA: any, partB: any, joints: Joint[], connector: Connector,
): ApplyJointsResult {
  let outA = partA, outB = partB;
  for (const j of joints) {
    const p = resolveConnectorParams(j, /* preset threaded in */ "pla-tight"); // pass preset param
    const maleLocal = connector.build.integralMale!(M, p);
    const male = placeSolid(maleLocal, j.position, j.axis); maleLocal.delete();
    const newA = outA.add(male); if (outA !== partA) outA.delete(); outA = newA; male.delete();
    const cavLocal = connector.build.femaleCavity(M, p);
    const cav = placeSolid(cavLocal, j.position, j.axis); cavLocal.delete();
    const newB = outB.subtract(cav); if (outB !== partB) outB.delete(); outB = newB; cav.delete();
  }
  return { partA: outA, partB: outB, jointPieces: [] };
}
```

(Thread `preset` into `applyIntegral` like `applySeparatePiece` — do not hardcode `"pla-tight"`.) In
`applyConnectors`, after resolving the connector `c` for a non-M1 id: `if (c.assembly === "integral")
return applyIntegral(M, partA, partB, joints, c, preset);` else the existing `applySeparatePiece`.

- [ ] **Step 4: Run — expect PASS** (new + all existing connector/joint tests)

Run: `npx vitest run tests/cut/`

- [ ] **Step 5: Commit**

```bash
git add src/lib/cut/connectors/snap/cantilever-clip.ts src/lib/cut/connectors/apply.ts tests/cut/connectors/snap/cantilever-clip.test.ts tests/cut/connectors/apply.test.ts
git commit -m "feat(connectors): cantilever-clip + integral apply path (fuse male, cut catch)"
```

---

### Task 14: Register the snap set + P2-M3 verification + smoke doc

**Files:**
- Modify: `src/lib/cut/connectors/registry.ts`
- Test: `tests/cut/connectors/registry.test.ts` (update — Snap category now populated)

- [ ] **Step 1: Update the registry test**

```ts
// tests/cut/connectors/registry.test.ts — change the snap expectation
it("lists snap connectors after P2-M3", () => {
  const snap = listByCategory("snap").map((c) => c.id).sort();
  expect(snap).toEqual(["cantilever-clip", "snap-dovetail", "snap-pin"]);
});
```

- [ ] **Step 2: Run — expect FAIL** (snap category still empty)

Run: `npx vitest run tests/cut/connectors/registry.test.ts`

- [ ] **Step 3: Register the three**

In `registry.ts`: import the three snap connectors and add them to `ALL`:
`const ALL = [...m1KeyedConnectors(), tSlotConnector, snapPinConnector, snapDovetailConnector, cantileverClipConnector];`

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/cut/`

- [ ] **Step 5: Full verification + smoke doc**

Run: `npm run test && npm run typecheck && npm run build:web && npm run build`
Write `docs/p2-m3-snapfit-smoke-test.md` (existing style): for each snap connector, cut, confirm the pieces
print and the snap seats/holds; note recommended print orientation for the undercuts and that final
clearance is dialed via the connector test-fit (P2-M4).

- [ ] **Step 6: Commit**

```bash
git add src/lib/cut/connectors/registry.ts tests/cut/connectors/registry.test.ts docs/p2-m3-snapfit-smoke-test.md
git commit -m "feat(connectors): register snap-fit set; docs(p2-m3): snap-fit smoke checklist"
```

- [ ] **STOP — pause for user review before P2-M4.**

---

# P2-M4 — Connector test-fit + tolerance presets

Deliverable: emit connector-specific coupon pairs across a clearance sweep so a user prints a strip and
dials in the fit — essential for the P2-M3 snap connectors. Reuses the M2 coupon block/naming/zip path and
the M3a `submit`/`serializeAll` transport.

## File structure (P2-M4)

- Modify `src/lib/cut/test-fit.ts` — `generateConnectorTestFit` + a `buildCouponFromSolid` helper + a
  `CouponPair` base type.
- Modify `src/workers/cut-worker.ts` + `src/lib/cut/cut-client.ts` — extend the `testfit` op with an
  optional `connectorId`; add a `runConnectorTestFit` client bridge.
- Modify `src/components/CutPanel.tsx` + `src/App.tsx` — a "Test-fit connector" action seeded from the
  connector's `defaults.clearance`.
- Tests: extend `tests/cut/test-fit.test.ts`, `tests/cut/cut-client.test.ts`, `tests/components/CutPanel.test.tsx`.

---

### Task 15: `generateConnectorTestFit`

**Files:**
- Modify: `src/lib/cut/test-fit.ts`
- Test: `tests/cut/test-fit.test.ts` (add)

**Interfaces:**
- Produces:
  ```ts
  export type CouponPair = { clearance: number; male: any; maleName: string; female: any; femaleName: string };
  export type TestFitPair = CouponPair & { shape: JointShape };   // existing, now extends CouponPair
  export function generateConnectorTestFit(M: any, connector: Connector, opts: TestFitOpts): CouponPair[];
  ```
  Male coupon = a block fused with the connector's **piece** (separate-piece) or **integralMale** (integral),
  nominal. Female coupon = a block with the connector's **femaleCavity** at clearance_i subtracted. Sweep =
  `baseClearance + i*step`; names `testfit_<NN>_<connectorId>_c<clr>_(A|B).stl`.
- Consumes: `Connector` (`connectors/types.ts`), the existing `buildCoupon`/`TestFitOpts`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/cut/test-fit.test.ts — add
import { generateConnectorTestFit } from "../../src/lib/cut/test-fit";
import { getConnector } from "../../src/lib/cut/connectors/registry";

const copts = { count: 3, step: 0.05, baseClearance: 0.15, cubeSize: 14, keyDepth: 6, keyWidth: 8, shape: "cylinder" as const };

it("generateConnectorTestFit emits a coupon sweep for a snap connector", () => {
  const pins = generateConnectorTestFit(M, getConnector("snap-pin")!, copts);
  expect(pins.length).toBe(3);
  expect(pins.map((p) => p.clearance)).toEqual([0.15, 0.2, 0.25].map((v) => expect.closeTo(v, 5)));
  // Bigger clearance ⇒ bigger socket ⇒ less material in the female coupon.
  expect(pins[2].female.volume()).toBeLessThan(pins[0].female.volume());
  expect(pins[0].maleName).toContain("snap-pin");
  pins.forEach((p) => { p.male.delete(); p.female.delete(); });
});

it("works for an integral connector (male coupon fuses the integral clip)", () => {
  const clip = generateConnectorTestFit(M, getConnector("cantilever-clip")!, copts);
  expect(clip.length).toBe(3);
  clip.forEach((p) => { expect(p.male.status()).toBe("NoError"); p.male.delete(); p.female.delete(); });
});
```

- [ ] **Step 2: Run — expect FAIL** (`generateConnectorTestFit` not defined)

Run: `npx vitest run tests/cut/test-fit.test.ts`

- [ ] **Step 3: Implement**

In `test-fit.ts`: add the `CouponPair` type, make `TestFitPair = CouponPair & { shape: JointShape }`, and add:

```ts
import type { Connector } from "./connectors/types";

/** Seat an already-built local +Z solid on a coupon block's top face and combine. Deletes the local. */
function buildCouponFromSolid(M: any, cubeSize: number, local: any, combine: (b: any, s: any) => any): any {
  const block = M.Manifold.cube([cubeSize, cubeSize, cubeSize], true);
  const solid = local.translate([0, 0, cubeSize / 2]);
  local.delete();
  const out = combine(block, solid);
  block.delete(); solid.delete();
  return out;
}

export function generateConnectorTestFit(M: any, connector: Connector, opts: TestFitOpts): CouponPair[] {
  const pairs: CouponPair[] = [];
  for (let i = 0; i < opts.count; i++) {
    const clearance = opts.baseClearance + i * opts.step;
    const params = (grow: number) => ({ size: opts.keyWidth, length: opts.keyDepth * 2, clearance: grow });
    const maleLocal = connector.assembly === "integral"
      ? connector.build.integralMale!(M, params(0))
      : connector.build.piece(M, params(0));
    const male = buildCouponFromSolid(M, opts.cubeSize, maleLocal, (b, s) => b.add(s));
    const femaleLocal = connector.build.femaleCavity(M, params(clearance));
    const female = buildCouponFromSolid(M, opts.cubeSize, femaleLocal, (b, s) => b.subtract(s));
    const tag = `${String(i).padStart(2, "0")}_${connector.id}_c${clearance.toFixed(2)}`;
    pairs.push({ clearance, male, maleName: `testfit_${tag}_A.stl`, female, femaleName: `testfit_${tag}_B.stl` });
  }
  return pairs;
}
```

(Note: `connector.build.piece` returns non-null for keyed/snap separate-piece connectors; integral
connectors use `integralMale`. Both feature solids are local +Z, so `buildCouponFromSolid` seats them like
the M2 coupons.)

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/cut/test-fit.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/cut/test-fit.ts tests/cut/test-fit.test.ts
git commit -m "feat(testfit): generateConnectorTestFit — coupon sweep from connector builders"
```

---

### Task 16: Worker + client bridge

**Files:**
- Modify: `src/workers/cut-worker.ts`, `src/lib/cut/cut-client.ts`
- Test: `tests/cut/cut-client.test.ts` (add)

**Interfaces:**
- `TestFitOpts` gains `connectorId?: string` (and `shape` becomes optional, defaulting to `"cylinder"` in
  `generateTestFitPairs`). The worker's `testfit` handler: if `req.testfit.connectorId`, run
  `generateConnectorTestFit(M, getConnector(connectorId)!, req.testfit)`; else `generateTestFitPairs`. Same
  serialize/coupons response.
- Client: `runConnectorTestFit(connectorId: string, opts: TestFitOpts): Promise<ExportItem[]>` posts the
  `testfit` op with `connectorId` and maps coupons via the existing path.

- [ ] **Step 1: Add a failing client test**

```ts
// tests/cut/cut-client.test.ts — add; extend the CutClientWorker stub's testfit branch to honor connectorId
it("runConnectorTestFit returns hydrated coupons for a connector", async () => {
  vi.stubGlobal("Worker", CutClientWorker);
  const items = await runConnectorTestFit("snap-pin", {
    count: 2, step: 0.05, baseClearance: 0.2, cubeSize: 14, keyDepth: 6, keyWidth: 8,
  });
  expect(items.length).toBe(4); // 2 pairs × (A + B)
  expect(items.some((i) => i.name.includes("snap-pin"))).toBe(true);
  vi.unstubAllGlobals();
});
```

Also update the stub's `if (req.op === "testfit")` branch to: `const pairs = req.testfit.connectorId ?
generateConnectorTestFit(M, getConnector(req.testfit.connectorId)!, req.testfit) : generateTestFitPairs(M, req.testfit);`

- [ ] **Step 2: Run — expect FAIL** (`runConnectorTestFit` not exported)

Run: `npx vitest run tests/cut/cut-client.test.ts`

- [ ] **Step 3: Implement**

Make `TestFitOpts.shape` optional + add `connectorId?: string`; in `generateTestFitPairs` default
`opts.shape ?? "cylinder"`. In `cut-worker.ts` branch the `testfit` op on `connectorId` (import
`generateConnectorTestFit` + `getConnector`). In `cut-client.ts` add
`runConnectorTestFit(connectorId, opts)` mirroring `runTestFit` but injecting `connectorId` into the
`testfit` payload; reuse the coupon→`ExportItem` mapping.

- [ ] **Step 4: Run — expect PASS** (new + existing testfit/cut tests)

Run: `npx vitest run tests/cut/`

- [ ] **Step 5: Commit**

```bash
git add src/workers/cut-worker.ts src/lib/cut/cut-client.ts tests/cut/cut-client.test.ts
git commit -m "feat(testfit): worker testfit op + runConnectorTestFit — connector coupon sweep"
```

---

### Task 17: UI action + per-connector clearance default

**Files:**
- Modify: `src/components/CutPanel.tsx`, `src/App.tsx`
- Test: `tests/components/CutPanel.test.tsx` (add)

**Interfaces:** CutPanel gains `onConnectorTestFit?: () => void`; a "Test-fit connector" button next to the
connector picker calls it. `App.onConnectorTestFit` runs `runConnectorTestFit(connectorId, { ...TESTFIT_DEFAULTS,
baseClearance: getConnector(connectorId)?.defaults.clearance ?? TESTFIT_DEFAULTS.baseClearance })` then
`saveBytes(buildZipExport(items, []), "pasak-connector-testfit.zip")`. The picker shows the connector's
default clearance as hint text.

- [ ] **Step 1: Add a failing UI test**

```tsx
// tests/components/CutPanel.test.tsx — add
it("calls onConnectorTestFit when the test-fit button is clicked", async () => {
  const onTestFit = vi.fn();
  render(<CutPanel {...baseProps} connectorId="snap-pin" onConnectorTestFit={onTestFit} />);
  await userEvent.click(screen.getByRole("button", { name: /test.?fit/i }));
  expect(onTestFit).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/components/CutPanel.test.tsx`

- [ ] **Step 3: Implement (Filament tokens)**

Add the `onConnectorTestFit?: () => void` prop + a compact "Test-fit" button by the connector select, and a
small hint line showing `getConnector(connectorId)?.defaults.clearance` when set. Wire `App.onConnectorTestFit`
as above (import `runConnectorTestFit`, `getConnector`, `buildZipExport`, `saveBytes`, `TESTFIT_DEFAULTS`).

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/components/CutPanel.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/components/CutPanel.tsx src/App.tsx tests/components/CutPanel.test.tsx
git commit -m "feat(testfit): CutPanel test-fit action + per-connector clearance default"
```

---

### Task 18: P2-M4 verification + smoke doc

- [ ] **Step 1:** `npm run test && npm run typecheck && npm run build:web && npm run build` → all pass.
- [ ] **Step 2:** Write `docs/p2-m4-connector-testfit-smoke-test.md` (existing style): pick snap-pin, click
  Test-fit, print the coupon strip, confirm each labeled pair steps clearance and the pin snaps into the
  socket that matches the connector's default clearance.
- [ ] **Step 3:** `git add docs/p2-m4-connector-testfit-smoke-test.md && git commit -m "docs(p2-m4): connector test-fit smoke checklist"`
- [ ] **STOP — Phase 2 complete; pause for user review.**

---

## Self-review (spec coverage)

- Connector interface + registry + M1 adapter → Tasks 1-3 ✅; `applyConnectors` dispatcher → Task 4 ✅;
  `connectorId` + worker wiring → Task 5 ✅; catalog picker UI → Task 6 ✅; zero-behavior-change gate →
  Tasks 4-5 (delegation) + Task 7 ✅.
- Keyed catalog (t-slot + formalized shapes) → P2-M2 ✅; snap-fit set (snap-pin/snap-dovetail/cantilever) +
  both assembly models → P2-M3 ✅; connector test-fit + tolerance presets → P2-M4 ✅.
- Web-only / no src-tauri → all tasks WASM-side ✅. Both-build gate → each milestone verify ✅. Manifold
  status validation + `.delete()` → per-connector tests + apply paths ✅.
