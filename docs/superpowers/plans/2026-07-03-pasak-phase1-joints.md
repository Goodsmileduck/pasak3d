# Pasak Phase 1 — Joint System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generalize Pasak's dowel code into a full web-tier keyed-joint system (shapes + polarity + taper + magnet sockets), add a test-fit coupon generator, and complete separate-components / cap verification / seam labels — all on `manifold-3d` WASM, keeping the client-side web build fully functional.

**Architecture:** New geometry under `src/lib/cut/joints/` called from the existing `cut-worker.ts`. The `Dowel` type becomes a superset `Joint` (back-compat alias) so the session reducer, worker protocol, and UI keep working with defaults. No native/Tauri work — Phase 2.

**Tech Stack:** TypeScript, React 19, Three.js 0.170.0, `manifold-3d@3.4.1` (WASM), Vitest, Vite (dual `web`/desktop targets via `VITE_TARGET`).

**Spec:** [`../specs/2026-07-02-pasak-phase1-joints-design.md`](../specs/2026-07-02-pasak-phase1-joints-design.md)

## Global Constraints

- **Web must stay 100% client-side.** All Phase 1 geometry runs on `manifold-3d` WASM in the worker. No native calls, no `src-tauri/` changes.
- **Both build targets must pass** before a milestone is done: `npm run build:web` (web) AND `npm run build` (desktop). Also `npm run test` and `npm run typecheck`.
- **Back-compat is mandatory.** Existing `Dowel` data and existing `tests/cut/dowel-*.test.ts` must pass unchanged; missing `shape`/`polarity` ⇒ current cylinder behavior.
- **Clearance semantics unchanged:** hole radius = solid + radial clearance on BOTH halves (total play = 2×). Per-joint `clearance` overrides the `TolerancePreset` map value; default preset behavior identical to today.
- **Manifold memory discipline:** every intermediate `Manifold`/`CrossSection` gets `.delete()`. `setCircularSegments` set once at worker init.
- **Non-manifold guard:** composite cutters (cross/puzzle) must OVERLAP primitives before union (never union merely-touching faces). Validate `status() === 'NoError'` after each composite build.
- **Commit style:** Conventional Commits with scope, em-dash for what+why, e.g. `feat(joints): …`. End commit messages with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Naming:** `Cut.dowels` field name is KEPT this phase (not renamed to `joints`).
- **Confirmed manifold-3d@3.4.1 API** (verified in `node_modules/manifold-3d/manifold.d.ts`):
  `Manifold.cube(size?, center?)`, `Manifold.cylinder(height, rLow, rHigh?, segs?, center?)`,
  `Manifold.sphere(r, segs?)`, `Manifold.extrude(poly, height, nDiv?, twist?, scaleTop?, center?)`,
  `CrossSection.ofPolygons(contours, fillRule?)`, `CrossSection.circle(r, segs?)`,
  `CrossSection.square(size?, center?)`, `cs.offset(delta, joinType?, miterLimit?, segs?)`,
  `cs.extrude(height, nDiv?, twist?, scaleTop?, center?)`, `m.add(o)`, `m.subtract(o)`,
  `m.transform(mat)` (column-major), `m.decompose(): Manifold[]`, `m.status()`, `m.isEmpty()`, `m.volume()`,
  `setCircularSegments(n)`.

---

## Milestone execution protocol

Work milestones in order. After **each** milestone: run `npm run test`, `npm run typecheck`, `npm run build:web`, `npm run build`; write `docs/mN-<name>-smoke-test.md` in the style of existing `docs/m*-smoke-test.md`; then **STOP for user review**. M2, M3a, M3b task steps are outlined with locked interfaces here and expanded into full TDD detail (like M1 below) at the start of each, once the prior milestone is reviewed — their concrete code depends on M1's as-built signatures.

---

# MILESTONE 1 — Joint system overhaul

Deliverable: all five joint shapes + magnet socket, applied through the worker, selectable in the UI, with existing dowel behavior preserved as the default.

## File structure (M1)

- Create `src/lib/cut/joints/orient.ts` — shared `rotationMat4FromTo` + `placeSolid` (extracted from `dowel-apply.ts`).
- Create `src/lib/cut/joints/shapes.ts` — `buildJointSolid` factory (nominal + female cutter per shape).
- Create `src/lib/cut/joints/apply.ts` — `applyJoints` (replaces `applyDowels`; magnet-aware).
- Modify `src/types/index.ts` — `Joint`, `JointShape`, `JointPolarity`, `Dowel` alias, `resolveClearance`.
- Modify `src/lib/cut/dowel-apply.ts` — re-export from `joints/` for back-compat, or delete once callers migrate (Task 9).
- Modify `src/workers/cut-worker.ts` — call `applyJoints`, `setCircularSegments` once.
- Modify `src/components/CutPanel.tsx` + `src/components/DowelMarkers.tsx` — shape + polarity picker.
- Tests: `tests/cut/joints/{shapes,apply,magnet,orient}.test.ts`.

---

### Task 1: Joint type model

**Files:**
- Modify: `src/types/index.ts`
- Test: `tests/types-joint.test.ts` (create)

**Interfaces:**
- Produces: `JointShape`, `JointPolarity`, `Joint`, `Dowel` (= `Joint`), `resolveClearance(joint, preset): number`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/types-joint.test.ts
import { describe, it, expect } from "vitest";
import { resolveClearance, TOLERANCE_VALUES, type Joint } from "../src/types";

describe("Joint type + resolveClearance", () => {
  const base: Joint = {
    id: "j1", position: [0, 0, 0], axis: [0, 0, 1],
    diameter: 5, length: 20, source: "auto",
  };

  it("defaults clearance to the preset value when no override", () => {
    expect(resolveClearance(base, "pla-tight")).toBe(TOLERANCE_VALUES["pla-tight"]);
  });

  it("uses the per-joint clearance override when present", () => {
    expect(resolveClearance({ ...base, clearance: 0.33 }, "pla-tight")).toBe(0.33);
  });

  it("treats a legacy dowel (no shape/polarity) as a cylinder separate-peg", () => {
    // Type-level: assignable without shape/polarity; runtime defaults live in shapes/apply.
    const legacy: Joint = base;
    expect(legacy.shape ?? "cylinder").toBe("cylinder");
    expect(legacy.polarity ?? "separate-peg").toBe("separate-peg");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/types-joint.test.ts`
Expected: FAIL — `resolveClearance` is not exported.

- [ ] **Step 3: Implement the types + helper**

In `src/types/index.ts`, replace the `Dowel` type block with:

```ts
export type JointShape = "cylinder" | "cube" | "cross" | "dovetail" | "puzzle";
export type JointPolarity = "separate-peg" | "male" | "female" | "magnet";

/**
 * A joint placed on a cut seam. Superset of the former `Dowel`.
 * Missing `shape`/`polarity` ⇒ legacy cylinder + separate-peg behavior.
 */
export type Joint = {
  id: string;
  position: [number, number, number]; // world-space, on the cut plane
  axis: [number, number, number];     // unit normal of the cut plane
  diameter: number;                    // mm (nominal; drives radius / box size)
  length: number;                      // mm
  source: "auto" | "manual";
  shape?: JointShape;                  // default "cylinder"
  polarity?: JointPolarity;            // default "separate-peg"
  taper?: number;                      // 0..1 draft (0 = straight)
  clearance?: number;                  // per-joint radial clearance override (mm)
};

/** Back-compat alias — existing code referencing `Dowel` keeps working. */
export type Dowel = Joint;

/** Radial clearance for a joint: per-joint override, else the tolerance preset. */
export function resolveClearance(joint: Joint, preset: TolerancePreset): number {
  return joint.clearance ?? TOLERANCE_VALUES[preset];
}
```

Keep the existing `TolerancePreset` and `TOLERANCE_VALUES` exactly as they are (defined above this block). Update `Cut.dowels` type to `Joint[]` (field name unchanged).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/types-joint.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify no type regressions**

Run: `npm run typecheck`
Expected: PASS (all `Dowel` references resolve via the alias).

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts tests/types-joint.test.ts
git commit -m "feat(joints): Joint type as a Dowel superset — shape/polarity/taper/clearance"
```

---

### Task 2: Extract orientation helper

**Files:**
- Create: `src/lib/cut/joints/orient.ts`
- Modify: `src/lib/cut/dowel-apply.ts:40-121` (import from `orient.ts` instead of local defs)
- Test: `tests/cut/joints/orient.test.ts` (create)

**Interfaces:**
- Produces: `rotationMat4FromTo(from, to): number[]` and `placeSolid(solid, position, axis): Manifold` (rotates local +Z to `axis`, translates to `position`).
- Consumes: nothing new.

- [ ] **Step 1: Write the failing test**

```ts
// tests/cut/joints/orient.test.ts
import { describe, it, expect } from "vitest";
import { rotationMat4FromTo } from "../../../src/lib/cut/joints/orient";

describe("rotationMat4FromTo", () => {
  it("returns identity (col-major) when from==to", () => {
    expect(rotationMat4FromTo([0, 0, 1], [0, 0, 1])).toEqual(
      [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    );
  });

  it("rotates +Z to +X (column-major: col0 becomes +Z image)", () => {
    const m = rotationMat4FromTo([0, 0, 1], [1, 0, 0]);
    // +Z maps to +X: applying rotation to (0,0,1) yields (1,0,0).
    // Column-major cols: [col0(0..3), col1, col2, col3]. z-axis image = col2 = m[8..10].
    expect(m[8]).toBeCloseTo(1, 5);  // x-component of rotated +Z
    expect(m[9]).toBeCloseTo(0, 5);
    expect(m[10]).toBeCloseTo(0, 5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cut/joints/orient.test.ts`
Expected: FAIL — module `orient.ts` does not exist.

- [ ] **Step 3: Create `orient.ts`**

Move `rotationMat4FromTo`, `normalize`, `cross` from `dowel-apply.ts` into `src/lib/cut/joints/orient.ts` verbatim (they are proven — see `dowel-apply.ts:74-133`), and add `placeSolid`:

```ts
// src/lib/cut/joints/orient.ts
export function placeSolid(
  solid: any,
  position: [number, number, number],
  axis: [number, number, number],
): any {
  const mat = rotationMat4FromTo([0, 0, 1], axis);
  return solid.transform(mat).translate(position);
}

// rotationMat4FromTo, normalize, cross moved verbatim from dowel-apply.ts:74-133
export function rotationMat4FromTo(/* …exact body from dowel-apply.ts… */) { /* … */ }
```

Then in `dowel-apply.ts`, delete the local `rotationMat4FromTo/normalize/cross` and
`import { placeSolid, rotationMat4FromTo } from "./joints/orient";`. Replace the body of
`buildCylinder` to use `placeSolid(cyl, position, axis)`.

- [ ] **Step 4: Run tests to verify pass (new + existing dowel-apply)**

Run: `npx vitest run tests/cut/joints/orient.test.ts tests/cut/dowel-apply.test.ts`
Expected: PASS (existing dowel-apply tests still green — proves the extraction is behavior-preserving).

- [ ] **Step 5: Commit**

```bash
git add src/lib/cut/joints/orient.ts src/lib/cut/dowel-apply.ts tests/cut/joints/orient.test.ts
git commit -m "refactor(joints): extract shared orient helper from dowel-apply"
```

---

### Task 3: `buildJointSolid` — cylinder + cube

**Files:**
- Create: `src/lib/cut/joints/shapes.ts`
- Test: `tests/cut/joints/shapes.test.ts` (create)

**Interfaces:**
- Produces: `buildJointSolid(M, opts): Manifold` where
  `opts = { shape: JointShape; diameter: number; length: number; taper?: number; grow?: number }`.
  `grow` is the female clearance added on all sides (0 for the nominal male solid).
- Consumes: `placeSolid` (Task 2). Caller orients/positions the returned solid.

- [ ] **Step 1: Write the failing test (cylinder + cube volumes)**

```ts
// tests/cut/joints/shapes.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { initManifold } from "../../../src/lib/cut/manifold";
import { buildJointSolid } from "../../../src/lib/cut/joints/shapes";

let M: any;
beforeAll(async () => { M = await initManifold(); });

describe("buildJointSolid", () => {
  it("cylinder nominal volume ≈ π r² h", () => {
    const s = buildJointSolid(M, { shape: "cylinder", diameter: 6, length: 10 });
    expect(s.status()).toBe("NoError");
    expect(s.volume()).toBeCloseTo(Math.PI * 3 * 3 * 10, 0);
    s.delete();
  });

  it("female cylinder grows radius by `grow`", () => {
    const male = buildJointSolid(M, { shape: "cylinder", diameter: 6, length: 10 });
    const female = buildJointSolid(M, { shape: "cylinder", diameter: 6, length: 10, grow: 0.2 });
    expect(female.volume()).toBeGreaterThan(male.volume());
    male.delete(); female.delete();
  });

  it("cube nominal volume = x*y*z", () => {
    const s = buildJointSolid(M, { shape: "cube", diameter: 6, length: 10 });
    expect(s.status()).toBe("NoError");
    // cube maps diameter→x/y footprint, length→z. Exact for a box.
    expect(s.volume()).toBeCloseTo(6 * 6 * 10, 3);
    s.delete();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cut/joints/shapes.test.ts`
Expected: FAIL — `buildJointSolid` not defined.

- [ ] **Step 3: Implement cylinder + cube branches**

```ts
// src/lib/cut/joints/shapes.ts
import type { JointShape } from "../../../types";

export type BuildJointOpts = {
  shape: JointShape;
  diameter: number;   // nominal footprint (mm)
  length: number;     // mm along local +Z
  taper?: number;     // 0..1 draft
  grow?: number;      // female clearance added per side (mm)
};

/** Build a joint solid centered on local origin, extruding along +Z. */
export function buildJointSolid(M: any, opts: BuildJointOpts): any {
  const { shape, diameter, length, taper = 0, grow = 0 } = opts;
  const r = diameter / 2 + grow;
  switch (shape) {
    case "cylinder": {
      const rTop = (diameter / 2) * (1 - taper) + grow;
      return M.Manifold.cylinder(length, r, rTop, 128, true);
    }
    case "cube": {
      const x = diameter + 2 * grow;
      return M.Manifold.cube([x, x, length], true);
    }
    default:
      throw new Error(`buildJointSolid: shape ${shape} not implemented yet`);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/cut/joints/shapes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cut/joints/shapes.ts tests/cut/joints/shapes.test.ts
git commit -m "feat(joints): buildJointSolid — cylinder + cube shapes with taper/grow"
```

---

### Task 4: `buildJointSolid` — cross

**Files:**
- Modify: `src/lib/cut/joints/shapes.ts`
- Test: `tests/cut/joints/shapes.test.ts` (add case)

**Interfaces:** extends `buildJointSolid` `shape: "cross"`.

- [ ] **Step 1: Add failing test**

```ts
it("cross is a valid manifold with volume between one and two arms", () => {
  const arm = 6 * 10; // approx single-arm cross-section×length reference
  const s = buildJointSolid(M, { shape: "cross", diameter: 6, length: 10 });
  expect(s.status()).toBe("NoError");
  expect(s.isEmpty()).toBe(false);
  // two overlapping arms: volume < 2× a single arm (overlap subtracted), > 1×
  expect(s.volume()).toBeGreaterThan(arm);
  s.delete();
});
```

- [ ] **Step 2: Run — expect FAIL** (`shape cross not implemented`)

Run: `npx vitest run tests/cut/joints/shapes.test.ts`

- [ ] **Step 3: Implement cross branch**

Two boxes, second rotated 90° about Z; overlap is inherent (both centered), union with `.add`:

```ts
case "cross": {
  const arm = diameter + 2 * grow;
  const barW = arm / 3;                       // arm thickness
  const a = M.Manifold.cube([arm, barW, length], true);
  const b = M.Manifold.cube([barW, arm, length], true);
  const out = a.add(b);                        // centered boxes overlap at core — safe union
  a.delete(); b.delete();
  return out;
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/cut/joints/shapes.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/cut/joints/shapes.ts tests/cut/joints/shapes.test.ts
git commit -m "feat(joints): cross shape — two overlapping bars unioned"
```

---

### Task 5: `buildJointSolid` — dovetail (CrossSection)

**Files:**
- Modify: `src/lib/cut/joints/shapes.ts`
- Test: `tests/cut/joints/shapes.test.ts` (add case)

**Interfaces:** extends `buildJointSolid` `shape: "dovetail"`.

- [ ] **Step 1: Add failing test**

```ts
it("dovetail is a valid manifold (trapezoid prism)", () => {
  const s = buildJointSolid(M, { shape: "dovetail", diameter: 6, length: 10 });
  expect(s.status()).toBe("NoError");
  expect(s.isEmpty()).toBe(false);
  expect(s.volume()).toBeGreaterThan(0);
  s.delete();
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement dovetail branch**

Trapezoid contour in XY (wide base, narrow top) extruded along Z via `CrossSection.ofPolygons`:

```ts
case "dovetail": {
  const half = diameter / 2 + grow;
  const narrow = half * 0.6;
  const h = diameter + 2 * grow;
  // trapezoid centered on origin: base (y=-h/2) width 2*half, top (y=+h/2) width 2*narrow
  const contour: Array<[number, number]> = [
    [-half, -h / 2], [half, -h / 2], [narrow, h / 2], [-narrow, h / 2],
  ];
  const cs = M.CrossSection.ofPolygons([contour]);
  const out = cs.extrude(length, 1, 0, undefined, true);
  cs.delete();
  return out;
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/lib/cut/joints/shapes.ts tests/cut/joints/shapes.test.ts
git commit -m "feat(joints): dovetail shape via CrossSection trapezoid extrude"
```

---

### Task 6: `buildJointSolid` — puzzle

**Files:**
- Modify: `src/lib/cut/joints/shapes.ts`
- Test: `tests/cut/joints/shapes.test.ts` (add case)

**Interfaces:** extends `buildJointSolid` `shape: "puzzle"`.

- [ ] **Step 1: Add failing test**

```ts
it("puzzle tab is a valid manifold (neck + lobe union)", () => {
  const s = buildJointSolid(M, { shape: "puzzle", diameter: 6, length: 10 });
  expect(s.status()).toBe("NoError");
  expect(s.isEmpty()).toBe(false);
  s.delete();
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement puzzle branch**

Neck square + overlapping lobe circle in 2D, unioned, extruded:

```ts
case "puzzle": {
  const r = diameter / 2 + grow;
  const neck = M.CrossSection.square([r, diameter + 2 * grow], true); // narrow stem along X
  const lobe = M.CrossSection.circle(r, 64).translate([r * 0.9, 0]);  // overlaps neck end
  const profile = neck.add(lobe);
  const out = profile.extrude(length, 1, 0, undefined, true);
  neck.delete(); lobe.delete(); profile.delete();
  return out;
}
```

- [ ] **Step 2b/4: Run — expect PASS**

Run: `npx vitest run tests/cut/joints/shapes.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/cut/joints/shapes.ts tests/cut/joints/shapes.test.ts
git commit -m "feat(joints): puzzle tab shape — neck + lobe union extrude"
```

---

### Task 7: `applyJoints` — female subtract + peg emit

**Files:**
- Create: `src/lib/cut/joints/apply.ts`
- Test: `tests/cut/joints/apply.test.ts` (create)

**Interfaces:**
- Produces: `applyJoints(M, partA, partB, joints, preset): { partA, partB, jointPieces }`.
  Mirrors the current `ApplyDowelsResult` shape so `cut-worker.ts` swaps cleanly.
- Consumes: `buildJointSolid` (Tasks 3-6), `placeSolid` (Task 2), `resolveClearance` (Task 1).

- [ ] **Step 1: Write the failing test**

```ts
// tests/cut/joints/apply.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { initManifold } from "../../../src/lib/cut/manifold";
import { applyJoints } from "../../../src/lib/cut/joints/apply";
import type { Joint } from "../../../src/types";

let M: any;
beforeAll(async () => { M = await initManifold(); });

function box(size: number) { return M.Manifold.cube([size, size, size], true); }

describe("applyJoints", () => {
  const joint: Joint = {
    id: "j", position: [0, 0, 0], axis: [0, 0, 1],
    diameter: 4, length: 20, source: "auto", shape: "cylinder", polarity: "separate-peg",
  };

  it("subtracts a hole from both halves and emits one peg", () => {
    const a = box(30), b = box(30);
    const r = applyJoints(M, a, b, [joint], "pla-tight");
    expect(r.partA.volume()).toBeLessThan(30 * 30 * 30);
    expect(r.partB.volume()).toBeLessThan(30 * 30 * 30);
    expect(r.jointPieces.length).toBe(1);
    r.partA.delete(); r.partB.delete(); r.jointPieces.forEach((p: any) => p.delete());
  });

  it("magnet polarity emits no peg", () => {
    const a = box(30), b = box(30);
    const r = applyJoints(M, a, b, [{ ...joint, polarity: "magnet" }], "pla-tight");
    expect(r.jointPieces.length).toBe(0);
    r.partA.delete(); r.partB.delete();
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`applyJoints` not defined)

Run: `npx vitest run tests/cut/joints/apply.test.ts`

- [ ] **Step 3: Implement `applyJoints`**

```ts
// src/lib/cut/joints/apply.ts
import type { Joint, TolerancePreset } from "../../../types";
import { resolveClearance } from "../../../types";
import { buildJointSolid } from "./shapes";
import { placeSolid } from "./orient";

export type ApplyJointsResult = { partA: any; partB: any; jointPieces: any[] };

export function applyJoints(
  M: any, partA: any, partB: any, joints: Joint[], preset: TolerancePreset,
): ApplyJointsResult {
  let outA = partA, outB = partB;
  const jointPieces: any[] = [];

  for (const j of joints) {
    const shape = j.shape ?? "cylinder";
    const polarity = j.polarity ?? "separate-peg";
    const clearance = resolveClearance(j, preset);

    // Female cutter (grown by clearance), oriented + positioned onto the seam.
    const cutterLocal = buildJointSolid(M, {
      shape, diameter: j.diameter, length: j.length, taper: j.taper, grow: clearance,
    });
    const cutter = placeSolid(cutterLocal, j.position, j.axis);
    cutterLocal.delete();

    const newA = outA.subtract(cutter);
    const newB = outB.subtract(cutter);
    if (outA !== partA) outA.delete();
    if (outB !== partB) outB.delete();
    outA = newA; outB = newB;
    cutter.delete();

    if (polarity === "separate-peg" || polarity === "male") {
      const pegLocal = buildJointSolid(M, {
        shape, diameter: j.diameter, length: j.length, taper: j.taper, grow: 0,
      });
      jointPieces.push(placeSolid(pegLocal, j.position, j.axis));
      pegLocal.delete();
    }
    // "female" / "magnet" emit no peg.
  }
  return { partA: outA, partB: outB, jointPieces };
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/cut/joints/apply.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/cut/joints/apply.ts tests/cut/joints/apply.test.ts
git commit -m "feat(joints): applyJoints — female subtract on both halves, polarity-aware peg emit"
```

---

### Task 8: Magnet socket — blind recess

**Files:**
- Modify: `src/lib/cut/joints/apply.ts` (magnet depth positioning)
- Test: `tests/cut/joints/magnet.test.ts` (create)

**Interfaces:** magnet joints use a blind recess of depth `min(length, safe)` positioned `seam ± depth/2`, never perforating.

- [ ] **Step 1: Write the failing test**

```ts
// tests/cut/joints/magnet.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { initManifold } from "../../../src/lib/cut/manifold";
import { applyJoints } from "../../../src/lib/cut/joints/apply";
import type { Joint } from "../../../src/types";

let M: any;
beforeAll(async () => { M = await initManifold(); });

it("magnet recess does not perforate a thick part", () => {
  // 40mm cube; magnet depth 6 → each half keeps a solid floor, volume drop is bounded.
  const a = M.Manifold.cube([40, 40, 40], true);
  const b = M.Manifold.cube([40, 40, 40], true);
  const j: Joint = {
    id: "m", position: [0, 0, 0], axis: [0, 0, 1],
    diameter: 8, length: 6, source: "auto", shape: "cylinder", polarity: "magnet",
  };
  const r = applyJoints(M, a, b, [j], "sla");
  const full = 40 * 40 * 40;
  const removed = full - r.partA.volume();
  // removed ≈ one blind cylinder (π*4²*3 per half ≈ 150), NOT a through hole (π*4²*40).
  expect(removed).toBeLessThan(400);
  expect(removed).toBeGreaterThan(50);
  r.partA.delete(); r.partB.delete();
});
```

- [ ] **Step 2: Run — expect FAIL** (magnet currently cuts a full-length through cylinder)

Run: `npx vitest run tests/cut/joints/magnet.test.ts`

- [ ] **Step 3: Implement blind-recess positioning**

In `applyJoints`, before building the cutter, special-case magnet depth + offset:

```ts
// inside the loop, replacing the single cutter build for magnets:
if (polarity === "magnet") {
  const depth = j.length; // blind depth into each half
  const axis = j.axis;
  const cutA = placeSolid(
    buildJointSolid(M, { shape, diameter: j.diameter, length: depth, taper: j.taper, grow: clearance }),
    [j.position[0] + axis[0] * depth / 2, j.position[1] + axis[1] * depth / 2, j.position[2] + axis[2] * depth / 2],
    axis,
  );
  const cutB = placeSolid(
    buildJointSolid(M, { shape, diameter: j.diameter, length: depth, taper: j.taper, grow: clearance }),
    [j.position[0] - axis[0] * depth / 2, j.position[1] - axis[1] * depth / 2, j.position[2] - axis[2] * depth / 2],
    axis,
  );
  const newA = outA.subtract(cutA);
  const newB = outB.subtract(cutB);
  if (outA !== partA) outA.delete();
  if (outB !== partB) outB.delete();
  outA = newA; outB = newB;
  cutA.delete(); cutB.delete();
  continue; // no peg
}
```

(Note: the previous through-cutter build/subtract lives in the non-magnet branch.)

- [ ] **Step 4: Run — expect PASS** (magnet + apply + shapes all green)

Run: `npx vitest run tests/cut/joints/`

- [ ] **Step 5: Commit**

```bash
git add src/lib/cut/joints/apply.ts tests/cut/joints/magnet.test.ts
git commit -m "feat(joints): magnet socket — blind recess on both faces, no through-hole"
```

---

### Task 9: Wire worker to `applyJoints`; retire `applyDowels`

**Files:**
- Modify: `src/workers/cut-worker.ts:1-56`
- Modify: `src/lib/cut/dowel-apply.ts` (re-export `buildDowelPiece` if still used, else delete after callers migrate)
- Test: `tests/cut/cut-client.test.ts` (existing — must still pass), add a shape round-trip case

**Interfaces:**
- `CutWorkerRequest.dowels: Joint[]` (field name unchanged, type widened). Worker calls `applyJoints`, and `setCircularSegments(128)` once after `initManifold`.

- [ ] **Step 1: Add a failing worker/client test (non-cylinder shape round-trips)**

```ts
// tests/cut/cut-client.test.ts — add
it("runs a cut with a cube joint and returns parts + one peg", async () => {
  // reuse the existing cube mesh fixture + plane from this file's setup
  const res = await runCut(cubeMesh, plane, [
    { id: "j", position: [0, 0, 0], axis: [0, 0, 1], diameter: 4, length: 8,
      source: "auto", shape: "cube", polarity: "separate-peg" },
  ], "pla-tight");
  expect(res.partA).toBeDefined();
  expect(res.dowelPieces.length).toBe(1);
});
```

- [ ] **Step 2: Run — expect FAIL** (worker still imports `applyDowels`; cube unsupported there)

Run: `npx vitest run tests/cut/cut-client.test.ts`

- [ ] **Step 3: Swap the worker call**

In `src/workers/cut-worker.ts`: replace `import { applyDowels }` with
`import { applyJoints } from "../lib/cut/joints/apply";`; after `const M = await initManifold();` add
`M.setCircularSegments(128);`; change the apply line to
`const result = applyJoints(M, cut.partA.manifold, cut.partB.manifold, dowels, tolerance);`
and rename `result.dowelPieces` → `result.jointPieces` throughout the cleanup + serialize block (keep the
response field name `dowelPieces` so `cut-client.ts` is unchanged). Update `CutWorkerRequest.dowels` type
to `Joint[]`.

- [ ] **Step 4: Run — expect PASS** (new + all existing cut tests)

Run: `npx vitest run tests/cut/`
Expected: PASS, including untouched `dowel-apply.test.ts` (cylinder default path) and `cut-client.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/workers/cut-worker.ts src/lib/cut/dowel-apply.ts tests/cut/cut-client.test.ts
git commit -m "feat(joints): route cut worker through applyJoints — setCircularSegments once"
```

---

### Task 10: UI — shape + polarity picker in CutPanel

**Files:**
- Modify: `src/components/CutPanel.tsx`
- Modify: `src/App.tsx` (thread `shape`/`polarity` into auto-placed joints; default cylinder/separate-peg)
- Modify: `src/components/DowelMarkers.tsx` (marker color/label by shape — optional visual)
- Test: `tests/components/CutPanel.test.tsx` (add — follow existing `PrinterPanel.test.tsx` pattern)

**Interfaces:**
- `CutPanel` gains props `jointShape: JointShape`, `onJointShapeChange`, `jointPolarity: JointPolarity`, `onJointPolarityChange`. `App` owns the state and passes `shape`/`polarity` when constructing joints in `autoPlaceCutDowels` results and manual joints.

- [ ] **Step 1: Write the failing UI test**

```tsx
// tests/components/CutPanel.test.tsx (excerpt — match existing render harness)
it("calls onJointShapeChange when a shape is selected", async () => {
  const onShape = vi.fn();
  render(<CutPanel {...baseProps} jointShape="cylinder" onJointShapeChange={onShape} />);
  await userEvent.selectOptions(screen.getByLabelText(/joint shape/i), "dovetail");
  expect(onShape).toHaveBeenCalledWith("dovetail");
});
```

- [ ] **Step 2: Run — expect FAIL** (no shape control)

Run: `npx vitest run tests/components/CutPanel.test.tsx`

- [ ] **Step 3: Add the picker (Filament tokens, no raw palette)**

Add a `<select aria-label="Joint shape">` (cylinder/cube/cross/dovetail/puzzle) and a polarity
`<select aria-label="Joint polarity">` (separate-peg/male/female/magnet) to `CutPanel`, styled with
`bg-[var(--surface)]`/`border-[var(--border)]` per the Filament rules in CLAUDE.md. Wire the new props.
In `App.tsx`, set `shape`/`polarity` on each `Joint` produced by `autoPlaceCutDowels` and on manual joints.

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/components/CutPanel.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/components/CutPanel.tsx src/components/DowelMarkers.tsx src/App.tsx tests/components/CutPanel.test.tsx
git commit -m "feat(joints): shape + polarity picker in cut panel — defaults preserve dowel behavior"
```

---

### Task 11: M1 verification + smoke test doc

- [ ] **Step 1: Full test + typecheck**

Run: `npm run test && npm run typecheck`
Expected: PASS.

- [ ] **Step 2: Both builds**

Run: `npm run build:web && npm run build`
Expected: both succeed.

- [ ] **Step 3: Write `docs/m1-joints-smoke-test.md`**

Follow the existing `docs/m*-smoke-test.md` format: load `public/sample-keycap.3mf`, make a cut with each
shape (cylinder/cube/cross/dovetail/puzzle) and each polarity, confirm parts + pegs export and open in a
slicer; magnet produces recesses with no peg; legacy behavior (default cut) unchanged.

- [ ] **Step 4: Commit**

```bash
git add docs/m1-joints-smoke-test.md
git commit -m "docs(m1): joint-system smoke test checklist"
```

- [ ] **STOP — pause for user review before M2.**

---

# MILESTONE 2 — Test-fit generator + tolerance presets

Deliverable: from a shape + clearance sweep, generate small printable coupon pairs (a block with a
protruding key + a block with the matching socket) and download them as a zip, so a user prints the
sweep and keeps the clearance that fits. Geometry runs in the worker (needs `M`); the generator returns
Manifolds the worker serializes, exactly like the cut path.

## File structure (M2)

- Create `src/lib/cut/test-fit.ts` — `generateTestFitPairs(M, opts)` (pure geometry, returns Manifolds).
- Modify `src/workers/cut-worker.ts` — add op `"testfit"`; serialize + delete the returned Manifolds.
- Modify `src/lib/cut/cut-client.ts` — add `runTestFit(opts)` (worker bridge, hydrates to `THREE.Mesh`).
- Modify `src/App.tsx` + `src/components/Toolbar.tsx` — "Test-fit coupons" action → `runTestFit` →
  `buildZipExport` → `saveBytes`.
- Tests: `tests/cut/test-fit.test.ts`, `tests/cut/cut-client.test.ts` (add a `runTestFit` case).

---

### Task 12: `generateTestFitPairs` — one coupon pair per clearance

**Files:**
- Create: `src/lib/cut/test-fit.ts`
- Test: `tests/cut/test-fit.test.ts` (create)

**Interfaces:**
- Produces:
  ```ts
  export type TestFitOpts = {
    count: number; step: number; baseClearance: number;   // clearance_i = baseClearance + i*step
    cubeSize: number; keyDepth: number; keyWidth: number;  // mm
    shape: JointShape; shuffleShapes?: boolean;
  };
  export type TestFitPair = {
    clearance: number; shape: JointShape;
    male: any; maleName: string;      // Manifolds (caller serializes + deletes)
    female: any; femaleName: string;
  };
  export function generateTestFitPairs(M: any, opts: TestFitOpts): TestFitPair[];
  ```
- Consumes: `buildJointSolid` (shapes.ts), `placeSolid` (orient.ts).

- [ ] **Step 1: Write the failing test**

```ts
// tests/cut/test-fit.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { initManifold } from "../../src/lib/cut/manifold";
import { generateTestFitPairs } from "../../src/lib/cut/test-fit";

let M: any;
beforeAll(async () => { M = await initManifold(); });

const base = { count: 1, step: 0.05, baseClearance: 0.1, cubeSize: 12, keyDepth: 5, keyWidth: 6, shape: "cylinder" as const };

describe("generateTestFitPairs", () => {
  it("emits one male+female coupon for count=1", () => {
    const pairs = generateTestFitPairs(M, base);
    expect(pairs.length).toBe(1);
    const p = pairs[0];
    expect(p.male.status()).toBe("NoError");
    expect(p.female.status()).toBe("NoError");
    // male block + protruding key ⇒ more than a bare block; female block − socket ⇒ less.
    const block = M.Manifold.cube([12, 12, 12], true);
    expect(p.male.volume()).toBeGreaterThan(block.volume());
    expect(p.female.volume()).toBeLessThan(block.volume());
    block.delete();
    p.male.delete(); p.female.delete();
  });

  it("names encode shape, clearance and A/B", () => {
    const p = generateTestFitPairs(M, base)[0];
    expect(p.maleName).toBe("testfit_cylinder_c0.10_A.stl");
    expect(p.femaleName).toBe("testfit_cylinder_c0.10_B.stl");
    p.male.delete(); p.female.delete();
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`generateTestFitPairs` not defined)

Run: `npx vitest run tests/cut/test-fit.test.ts`

- [ ] **Step 3: Implement the single-pair core**

```ts
// src/lib/cut/test-fit.ts
import type { JointShape } from "../../types";
import { buildJointSolid } from "./joints/shapes";
import { placeSolid } from "./joints/orient";

export type TestFitOpts = {
  count: number; step: number; baseClearance: number;
  cubeSize: number; keyDepth: number; keyWidth: number;
  shape: JointShape; shuffleShapes?: boolean;
};
export type TestFitPair = {
  clearance: number; shape: JointShape;
  male: any; maleName: string;
  female: any; femaleName: string;
};

const AXIS: [number, number, number] = [0, 0, 1];

/** One coupon pair: a block with a protruding key (A) and a block with the socket (B). */
function buildPair(M: any, shape: JointShape, o: TestFitOpts, clearance: number): TestFitPair {
  const top: [number, number, number] = [0, 0, o.cubeSize / 2];
  // Key spans the top face: half into the block, half proud of it.
  const keyLen = o.keyDepth * 2;

  const blockA = M.Manifold.cube([o.cubeSize, o.cubeSize, o.cubeSize], true);
  const peg = placeSolid(buildJointSolid(M, { shape, diameter: o.keyWidth, length: keyLen, grow: 0 }), top, AXIS);
  const male = blockA.add(peg);
  blockA.delete(); peg.delete();

  const blockB = M.Manifold.cube([o.cubeSize, o.cubeSize, o.cubeSize], true);
  const hole = placeSolid(buildJointSolid(M, { shape, diameter: o.keyWidth, length: keyLen, grow: clearance }), top, AXIS);
  const female = blockB.subtract(hole);
  blockB.delete(); hole.delete();

  const c = clearance.toFixed(2);
  return {
    clearance, shape, male, female,
    maleName: `testfit_${shape}_c${c}_A.stl`,
    femaleName: `testfit_${shape}_c${c}_B.stl`,
  };
}

export function generateTestFitPairs(M: any, opts: TestFitOpts): TestFitPair[] {
  const pairs: TestFitPair[] = [];
  for (let i = 0; i < opts.count; i++) {
    const clearance = opts.baseClearance + i * opts.step;
    pairs.push(buildPair(M, opts.shape, opts, clearance));
  }
  return pairs;
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/cut/test-fit.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/cut/test-fit.ts tests/cut/test-fit.test.ts
git commit -m "feat(testfit): coupon pair generator — key block + socket block per clearance"
```

---

### Task 13: Clearance sweep + shuffle

**Files:**
- Modify: `src/lib/cut/test-fit.ts`
- Test: `tests/cut/test-fit.test.ts` (add cases)

**Interfaces:** `count > 1` produces a monotonic clearance sweep; `shuffleShapes` cycles the shape per pair.

- [ ] **Step 1: Add failing tests**

```ts
it("sweeps clearance monotonically and the socket grows with clearance", () => {
  const pairs = generateTestFitPairs(M, { ...base, count: 3, step: 0.1, baseClearance: 0.1 });
  expect(pairs.map((p) => p.clearance)).toEqual([0.1, 0.2, 0.3].map((v) => expect.closeTo(v, 5)));
  // Bigger clearance ⇒ bigger socket ⇒ less material in the female block.
  expect(pairs[2].female.volume()).toBeLessThan(pairs[0].female.volume());
  pairs.forEach((p) => { p.male.delete(); p.female.delete(); });
});

it("shuffleShapes cycles through the shape catalog per pair", () => {
  const pairs = generateTestFitPairs(M, { ...base, count: 3, shuffleShapes: true });
  const shapes = new Set(pairs.map((p) => p.shape));
  expect(shapes.size).toBeGreaterThan(1);
  pairs.forEach((p) => { p.male.delete(); p.female.delete(); });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement sweep shape selection**

Replace the loop body in `generateTestFitPairs` to pick the shape per pair:

```ts
import { JOINT_SHAPES } from "../../types";
// …
export function generateTestFitPairs(M: any, opts: TestFitOpts): TestFitPair[] {
  const pairs: TestFitPair[] = [];
  for (let i = 0; i < opts.count; i++) {
    const clearance = opts.baseClearance + i * opts.step;
    const shape = opts.shuffleShapes ? JOINT_SHAPES[i % JOINT_SHAPES.length] : opts.shape;
    pairs.push(buildPair(M, shape, opts, clearance));
  }
  return pairs;
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/cut/test-fit.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/cut/test-fit.ts tests/cut/test-fit.test.ts
git commit -m "feat(testfit): clearance sweep + shuffle-shapes option"
```

---

### Task 14: Worker op + client bridge

**Files:**
- Modify: `src/workers/cut-worker.ts`
- Modify: `src/lib/cut/cut-client.ts`
- Test: `tests/cut/cut-client.test.ts` (add a `runTestFit` case)

**Interfaces:**
- Worker request gains `{ op: "testfit"; testfit: TestFitOpts }`; response
  `{ ok: true; coupons: { name: string; mesh: SerializedMesh }[] }`.
- `cut-client.ts` exports `runTestFit(opts: TestFitOpts): Promise<ExportItem[]>` (each `ExportItem` =
  `{ name, mesh: THREE.Mesh }`, matching `zip-export.ts`).

- [ ] **Step 1: Add a failing client test**

```ts
// tests/cut/cut-client.test.ts — add
it("runTestFit returns hydrated coupon meshes named A/B", async () => {
  const items = await runTestFit({
    count: 2, step: 0.05, baseClearance: 0.1, cubeSize: 12, keyDepth: 5, keyWidth: 6, shape: "cylinder",
  });
  expect(items.length).toBe(4); // 2 pairs × (A + B)
  expect(items.some((i) => i.name.endsWith("_A.stl"))).toBe(true);
  expect(items.some((i) => i.name.endsWith("_B.stl"))).toBe(true);
});
```

- [ ] **Step 2: Run — expect FAIL** (`runTestFit` not exported)

Run: `npx vitest run tests/cut/cut-client.test.ts`

- [ ] **Step 3: Implement the worker op + client bridge**

In `cut-worker.ts`: widen the request union with `{ reqId; op: "testfit"; testfit: TestFitOpts }`. In
`onmessage`, branch on `op`: for `"testfit"`, `const pairs = generateTestFitPairs(M, testfit);` then flatten
to coupons, serialize each Manifold with the existing `serialize()` helper, delete every Manifold, and post
`{ reqId, ok: true, coupons }` transferring the buffers. Import `generateTestFitPairs` + `TestFitOpts`.

In `cut-client.ts`: add `runTestFit(opts)` mirroring `runCut` — post `{ op: "testfit", testfit: opts }`,
and in the resolver map `resp.coupons` to `ExportItem[]` by hydrating each `SerializedMesh` via the existing
`deserialize` helper (unwrap the group's mesh: `deserialize(c.mesh).children[0] as THREE.Mesh`, or add a
`deserializeMesh` that returns the `THREE.Mesh` directly). Keep `runCut` unchanged.

- [ ] **Step 4: Run — expect PASS** (new + existing cut-client tests)

Run: `npx vitest run tests/cut/cut-client.test.ts tests/cut/`

- [ ] **Step 5: Commit**

```bash
git add src/workers/cut-worker.ts src/lib/cut/cut-client.ts tests/cut/cut-client.test.ts
git commit -m "feat(testfit): worker op + runTestFit client bridge"
```

---

### Task 15: Toolbar action + download wiring

**Files:**
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/App.tsx`
- Test: `tests/components/Toolbar.test.tsx` (add — follow the existing harness)

**Interfaces:** Toolbar gains `onTestFit: () => void`; App's `onTestFit` calls `runTestFit` with sensible
defaults, `buildZipExport(items, [])`, then `saveBytes(bytes, "pasak-testfit.zip")`.

- [ ] **Step 1: Add a failing Toolbar test**

```tsx
// tests/components/Toolbar.test.tsx — excerpt, match existing render harness
it("calls onTestFit when the test-fit action is clicked", async () => {
  const onTestFit = vi.fn();
  render(<Toolbar {...baseProps} onTestFit={onTestFit} />);
  await userEvent.click(screen.getByRole("button", { name: /test-fit/i }));
  expect(onTestFit).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/components/Toolbar.test.tsx`

- [ ] **Step 3: Implement the action (Filament tokens, no raw palette)**

Add a `onTestFit: () => void` prop + a toolbar button labeled "Test-fit" (aria "Generate test-fit coupons"),
styled with the existing Filament token classes used by the neighboring buttons. In `App.tsx` add
`onTestFit` that calls `runTestFit({ count: 4, step: 0.05, baseClearance: 0.1, cubeSize: 12, keyDepth: 5,
keyWidth: 6, shape: jointShape })`, then `saveBytes(buildZipExport(items, []), "pasak-testfit.zip")`; wire it
to `<Toolbar onTestFit={onTestFit} />`. Use the current `jointShape` state as the default shape.

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/components/Toolbar.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/components/Toolbar.tsx src/App.tsx tests/components/Toolbar.test.tsx
git commit -m "feat(testfit): toolbar action — generate + download coupon zip"
```

---

### Task 16: M2 verification + smoke doc

- [ ] **Step 1:** `npm run test && npm run typecheck` → PASS.
- [ ] **Step 2:** `npm run build:web && npm run build` → both succeed.
- [ ] **Step 3:** Write `docs/m2-testfit-smoke-test.md` (existing style): generate a cylinder sweep, print A/B
  coupons, confirm the labeled zip opens in a slicer and clearances increase across the set.
- [ ] **Step 4:** `git add docs/m2-testfit-smoke-test.md && git commit -m "docs(m2): test-fit smoke checklist"`
- [ ] **STOP — pause for user review before M3a.**

---

# MILESTONE 3a — Separate components + cap verification

Deliverable: split a multi-body part into its connected components (each becomes a part in the tree),
plus regression tests proving cuts stay watertight. Reuses the cut result-part registration pattern.

## File structure (M3a)

- Create `src/lib/cut/separate.ts` — `separateComponents(M, mesh) → Manifold[]` via `decompose()`.
- Modify `src/workers/cut-worker.ts` + `src/lib/cut/cut-client.ts` — add op `"separate"`; while here,
  extract the shared serialize/transfer (worker) + request-promise (client) helpers the M2 review deferred
  (this is the third op — collapse the copy-paste now, keeping `runCut`/`runTestFit` behavior identical).
- Modify `src/lib/session.ts` + `src/hooks/useCutSession.ts` — `applySeparateResult` + `performSeparate`.
- Modify `src/components/PartsTree.tsx` + `src/App.tsx` — a "Separate" action on multi-body parts.
- Tests: `tests/cut/separate.test.ts`, `tests/cut/caps.test.ts`, `tests/cut/cut-client.test.ts`,
  `tests/session.test.ts`, `tests/components/PartsTree.test.tsx`.

---

### Task 17: `separateComponents` + cap-validity tests

**Files:**
- Create: `src/lib/cut/separate.ts`
- Test: `tests/cut/separate.test.ts`, `tests/cut/caps.test.ts` (both create)

**Interfaces:**
- Produces: `separateComponents(M: any, mesh: THREE.Mesh): any[]` — converts the mesh to a manifold
  (reuse `meshToManifold` from `convert.ts`), calls `.decompose()`, returns the component Manifolds
  (caller serializes + deletes). Returns `[single]` when already connected.
- Consumes: `meshToManifold` (`src/lib/cut/convert.ts`).

- [ ] **Step 1: Write the failing tests**

```ts
// tests/cut/separate.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import { initManifold } from "../../src/lib/cut/manifold";
import { separateComponents } from "../../src/lib/cut/separate";
import { manifoldToMesh } from "../../src/lib/cut/convert";

let M: any;
beforeAll(async () => { M = await initManifold(); });

// Build a THREE.Mesh holding two disjoint cubes (one body at x=0, one at x=20).
function twoCubeMesh(): THREE.Mesh {
  const a = new THREE.BoxGeometry(4, 4, 4);
  const b = new THREE.BoxGeometry(4, 4, 4).translate(20, 0, 0);
  const merged = THREE.BufferGeometryUtils.mergeGeometries([a, b]);
  return new THREE.Mesh(merged);
}

describe("separateComponents", () => {
  it("splits two disjoint bodies into two components", () => {
    const comps = separateComponents(M, twoCubeMesh());
    expect(comps.length).toBe(2);
    for (const c of comps) {
      expect(c.status()).toBe("NoError");
      expect(c.volume()).toBeCloseTo(64, 0);
      c.delete();
    }
  });

  it("returns a single component for a connected body", () => {
    const cube = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4));
    const comps = separateComponents(M, cube);
    expect(comps.length).toBe(1);
    comps.forEach((c) => c.delete());
  });
});
```

```ts
// tests/cut/caps.test.ts — cuts must stay watertight (planar caps are closed)
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import { initManifold } from "../../src/lib/cut/manifold";
import { planeCutMesh } from "../../src/lib/cut/plane-cut";

let M: any;
beforeAll(async () => { M = await initManifold(); });

it("both halves of a plane cut are valid closed manifolds", async () => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10));
  const { partA, partB } = await planeCutMesh(M, mesh, { normal: [1, 0, 0], constant: 0, axisSnap: "x" });
  for (const p of [partA.manifold, partB.manifold]) {
    expect(p.status()).toBe("NoError");
    expect(p.isEmpty()).toBe(false);
    expect(p.volume()).toBeGreaterThan(0);
  }
  partA.manifold.delete(); partB.manifold.delete();
});
```

If `manifoldToMesh`/`BufferGeometryUtils` import paths differ, adapt to the real exports (check
`src/lib/cut/convert.ts` and `three/examples/jsm/utils/BufferGeometryUtils.js`).

- [ ] **Step 2: Run — expect FAIL** (`separateComponents` not defined)

Run: `npx vitest run tests/cut/separate.test.ts tests/cut/caps.test.ts`

- [ ] **Step 3: Implement `separateComponents`**

```ts
// src/lib/cut/separate.ts
import * as THREE from "three";
import { meshToManifold } from "./convert";

/** Split a mesh into its connected-component manifolds. Caller serializes + deletes. */
export function separateComponents(M: any, mesh: THREE.Mesh): any[] {
  const man = meshToManifold(M, mesh);
  const parts = man.decompose();   // Manifold[]; length 1 if already connected
  man.delete();
  return parts;
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/cut/separate.test.ts tests/cut/caps.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/cut/separate.ts tests/cut/separate.test.ts tests/cut/caps.test.ts
git commit -m "feat(separate): separateComponents via decompose + cap-validity regression tests"
```

---

### Task 18: Worker `"separate"` op + shared op helpers

**Files:**
- Modify: `src/workers/cut-worker.ts`, `src/lib/cut/cut-client.ts`
- Test: `tests/cut/cut-client.test.ts` (add a `runSeparate` case)

**Interfaces:**
- Worker: request `{ reqId; op: "separate"; meshGeometry }`; response `{ ok: true; components: SerializedMesh[] }`.
- Client: `runSeparate(mesh: THREE.Mesh): Promise<THREE.Group[]>` (one Group per component).
- Refactor (M2 debt): add a worker helper `serializeAll(manifolds): { meshes: SerializedMesh[]; transfer: ArrayBuffer[] }`
  and a client helper `submit<T>(req, transfer, pick): Promise<T>` owning the pending-map + reject-on-`!ok`.
  Re-express the existing `cut`/`testfit` handlers through them **without changing their behavior** (all
  existing cut/testfit tests must stay green).

- [ ] **Step 1: Add a failing client test**

```ts
// tests/cut/cut-client.test.ts — add
it("runSeparate returns one group per connected component", async () => {
  const a = new THREE.BoxGeometry(4, 4, 4);
  const b = new THREE.BoxGeometry(4, 4, 4).translate(20, 0, 0);
  const mesh = new THREE.Mesh(THREE.BufferGeometryUtils.mergeGeometries([a, b]));
  const groups = await runSeparate(mesh);
  expect(groups.length).toBe(2);
});
```

- [ ] **Step 2: Run — expect FAIL** (`runSeparate` not exported)

Run: `npx vitest run tests/cut/cut-client.test.ts`

- [ ] **Step 3: Implement the op + helpers**

Widen the worker request union with the `"separate"` variant; in `onmessage`, branch: convert
`meshGeometry` to a `THREE.Mesh` (same as the cut path), `separateComponents(M, mesh)`, `serializeAll(comps)`,
delete every component, post `{ reqId, ok: true, components }` with the transfer list. Extract `serializeAll`
and re-express the `cut`/`testfit` responses through it. In `cut-client.ts`, add `runSeparate` and the
`submit` helper; re-express `runCut`/`runTestFit` through `submit`, mapping components via `deserialize`.
Keep behavior identical.

- [ ] **Step 4: Run — expect PASS** (new + all existing cut/cut-client tests)

Run: `npx vitest run tests/cut/`

- [ ] **Step 5: Commit**

```bash
git add src/workers/cut-worker.ts src/lib/cut/cut-client.ts tests/cut/cut-client.test.ts
git commit -m "feat(separate): worker separate op + runSeparate — extract shared op serialize/submit helpers"
```

---

### Task 19: Session reducer + `performSeparate`

**Files:**
- Modify: `src/lib/session.ts`, `src/hooks/useCutSession.ts`
- Test: `tests/session.test.ts` (add)

**Interfaces:**
- `applySeparateResult(s, parentId, components: Array<{mesh; group}>, parentName): Session` — hides the
  parent, adds one child part per component (`<parent>-1`, `<parent>-2`, …, `source: "cut"`, `parentId`,
  fresh palette colors, `isDowel: false`), selects the first. Mirrors `applyCutResult` (session.ts:58) but
  for N children and no dowels.
- `performSeparate(partId)` in `useCutSession` — calls `runSeparate(part.mesh)`, then `push(applySeparateResult(...))`
  with the same busy/error/history handling as `performCut` (useCutSession.ts:66).

- [ ] **Step 1: Add a failing session test**

```ts
// tests/session.test.ts — add (follow the existing applyCutResult test style)
it("applySeparateResult hides parent and adds one child per component", () => {
  const s0 = /* import a part → session with parentId 'p0' (reuse the file's helper) */;
  const comp = (v: number) => ({ mesh: new THREE.Mesh(new THREE.BoxGeometry(v, v, v)), group: new THREE.Group() });
  const s1 = applySeparateResult(s0, "p0", [comp(2), comp(3)], "Body");
  expect(s1.parts.get("p0")!.meta.visible).toBe(false);
  const kids = [...s1.parts.values()].filter((p) => p.meta.parentId === "p0");
  expect(kids.length).toBe(2);
  expect(kids.map((k) => k.meta.name)).toEqual(["Body-1", "Body-2"]);
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/session.test.ts`

- [ ] **Step 3: Implement `applySeparateResult` + `performSeparate`**

Model `applySeparateResult` on `applyCutResult` (clone session, hide parent, loop components adding
`${parentId}_c${i}` parts named `${parentName}-${i+1}`, `pickColor(next.parts.size)`, `countTris`). Add
`performSeparate` to `useCutSession` mirroring `performCut`'s structure, returning early if the part has
only one component (surface a friendly "already a single body" via the existing error/toast path).

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/session.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/session.ts src/hooks/useCutSession.ts tests/session.test.ts
git commit -m "feat(separate): applySeparateResult reducer + performSeparate session action"
```

---

### Task 20: PartsTree action + App wiring

**Files:**
- Modify: `src/components/PartsTree.tsx`, `src/App.tsx`
- Test: `tests/components/PartsTree.test.tsx` (add)

**Interfaces:** PartsTree rows gain an optional `onSeparate?: (partId) => void`; App passes
`session.performSeparate`. Show the action on non-dowel parts.

- [ ] **Step 1: Add a failing UI test**

```tsx
// tests/components/PartsTree.test.tsx — excerpt, match existing harness
it("calls onSeparate when the separate action is clicked", async () => {
  const onSeparate = vi.fn();
  render(<PartsTree {...baseProps} onSeparate={onSeparate} />);
  await userEvent.click(screen.getAllByRole("button", { name: /separate/i })[0]);
  expect(onSeparate).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/components/PartsTree.test.tsx`

- [ ] **Step 3: Implement the action (Filament tokens)**

Add an `onSeparate?: (partId: string) => void` prop and a small "Separate" button on each non-dowel row,
styled with the existing PartsTree Filament token classes. Wire `onSeparate={session.performSeparate}` in
`App.tsx`.

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/components/PartsTree.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/components/PartsTree.tsx src/App.tsx tests/components/PartsTree.test.tsx
git commit -m "feat(separate): PartsTree separate action wired to performSeparate"
```

---

### Task 21: M3a verification + smoke doc

- [ ] **Step 1:** `npm run test && npm run typecheck` → PASS.
- [ ] **Step 2:** `npm run build:web && npm run build` → both succeed.
- [ ] **Step 3:** Write `docs/m3a-separate-caps-smoke-test.md` (existing style): import a multi-body STL,
  Separate → N parts in the tree; confirm a plane cut's halves export watertight (open cleanly in a slicer).
- [ ] **Step 4:** `git add docs/m3a-separate-caps-smoke-test.md && git commit -m "docs(m3a): separate + caps smoke checklist"`
- [ ] **STOP — pause for user review before M3b.**

---

# MILESTONE 3b — Seam labels

Deliverable: emboss (raised) or deboss (engraved) a short alphanumeric ID onto a part as real geometry,
so assembled pieces are identifiable. Glyph outlines come from a bundled typeface parsed by three's
`FontLoader`, fed to `manifold-3d`'s `CrossSection` (NOT through `meshToManifold`).

## File structure (M3b)

- Add `src/lib/cut/joints/helvetiker_regular.typeface.json` (copied from `three/examples/fonts/`, imported at
  build time so it works offline in both targets and in vitest) + `public/fonts/HELVETIKER-LICENSE.txt` (the
  three `examples/fonts/LICENSE` text, for attribution).
- Create `src/lib/cut/joints/labels.ts` — `buildSeamLabel` + `applySeamLabel`.
- Modify `src/workers/cut-worker.ts` + `src/lib/cut/cut-client.ts` — op `"label"` + `runLabel`.
- Modify `src/lib/session.ts` + `src/hooks/useCutSession.ts` — `applyLabelResult` (swap a part's geometry
  in place) + `performLabel`.
- Modify `src/components/PartsTree.tsx` (or CutPanel) + `src/App.tsx` — a "Label" action.
- Tests: `tests/cut/joints/labels.test.ts`, `tests/cut/cut-client.test.ts`, `tests/session.test.ts`.

---

### Task 22: Font asset + `buildSeamLabel`

**Files:**
- Add: `src/lib/cut/joints/helvetiker_regular.typeface.json`, `public/fonts/HELVETIKER-LICENSE.txt`
- Create: `src/lib/cut/joints/labels.ts`
- Test: `tests/cut/joints/labels.test.ts`

**Interfaces:**
- Produces: `buildSeamLabel(M: any, text: string, opts?: { size?: number; depth?: number }): any` — a solid
  extruded from local z=0 to z=depth, centered in XY, representing `text`. Returns a Manifold (caller deletes).
- Font parsing memoized via `new FontLoader().parse(fontJson)` on the build-time JSON import (DOM-free,
  worker-safe). Glyph outlines → `CrossSection.ofPolygons(contours, fillRule)` → `.extrude(depth)`.

Copy the asset first:
```bash
cp node_modules/three/examples/fonts/helvetiker_regular.typeface.json src/lib/cut/joints/helvetiker_regular.typeface.json
cp node_modules/three/examples/fonts/LICENSE public/fonts/HELVETIKER-LICENSE.txt
```

- [ ] **Step 1: Write the failing test**

```ts
// tests/cut/joints/labels.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { initManifold } from "../../../src/lib/cut/manifold";
import { buildSeamLabel } from "../../../src/lib/cut/joints/labels";

let M: any;
beforeAll(async () => { M = await initManifold(); });

describe("buildSeamLabel", () => {
  it("builds a valid solid for an alphanumeric id", () => {
    const s = buildSeamLabel(M, "A", { size: 6, depth: 1 });
    expect(s.status()).toBe("NoError");
    expect(s.isEmpty()).toBe(false);
    expect(s.volume()).toBeGreaterThan(0);
    s.delete();
  });

  it("multi-char labels have more volume than a single char", () => {
    const a = buildSeamLabel(M, "A", { size: 6, depth: 1 });
    const ab = buildSeamLabel(M, "AB", { size: 6, depth: 1 });
    expect(ab.volume()).toBeGreaterThan(a.volume());
    a.delete(); ab.delete();
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`buildSeamLabel` not defined)

Run: `npx vitest run tests/cut/joints/labels.test.ts`

- [ ] **Step 3: Implement `buildSeamLabel`**

```ts
// src/lib/cut/joints/labels.ts
import { FontLoader, type Font } from "three/examples/jsm/loaders/FontLoader.js";
import fontJson from "./helvetiker_regular.typeface.json";

let cachedFont: Font | null = null;
function getFont(): Font {
  if (!cachedFont) cachedFont = new FontLoader().parse(fontJson as any);
  return cachedFont;
}

/** A raised solid of `text`, extruded from z=0..depth, centered on the XY origin. */
export function buildSeamLabel(M: any, text: string, opts?: { size?: number; depth?: number }): any {
  const size = opts?.size ?? 6;
  const depth = opts?.depth ?? 1;
  const shapes = getFont().generateShapes(text, size); // THREE.Shape[]

  // Collect every contour (glyph outers + holes) as manifold [x,y] polygons.
  // EvenOdd fill treats holes correctly regardless of winding.
  const contours: Array<Array<[number, number]>> = [];
  for (const shape of shapes) {
    const { shape: outer, holes } = shape.extractPoints(6);
    contours.push(outer.map((p) => [p.x, p.y] as [number, number]));
    for (const h of holes) contours.push(h.map((p) => [p.x, p.y] as [number, number]));
  }

  const cs = M.CrossSection.ofPolygons(contours, "EvenOdd");
  // Center the text on the origin using its 2D bounds.
  const b = cs.bounds(); // { min:[x,y], max:[x,y] } — verify method name in manifold.d.ts
  const cx = (b.min[0] + b.max[0]) / 2;
  const cy = (b.min[1] + b.max[1]) / 2;
  const centered = cs.translate([-cx, -cy]);
  cs.delete();
  const out = centered.extrude(depth, 1, 0, undefined, false); // z: 0..depth
  centered.delete();
  return out;
}
```

Verify against `node_modules/manifold-3d/manifold.d.ts`: the `FillRule` literal accepted by
`CrossSection.ofPolygons` (likely `"EvenOdd"`/`"NonZero"`/`"Positive"`), and the CrossSection bounds accessor
(`bounds()` vs `.bounds` property) — adapt if the names differ. If `generateShapes` returns clockwise
outers that manifold rejects, keep `"EvenOdd"` (winding-agnostic).

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/cut/joints/labels.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/cut/joints/labels.ts src/lib/cut/joints/helvetiker_regular.typeface.json public/fonts/HELVETIKER-LICENSE.txt tests/cut/joints/labels.test.ts
git commit -m "feat(labels): buildSeamLabel — typeface glyphs to manifold via CrossSection extrude"
```

---

### Task 23: `applySeamLabel` — emboss / deboss

**Files:**
- Modify: `src/lib/cut/joints/labels.ts`
- Test: `tests/cut/joints/labels.test.ts` (add)

**Interfaces:**
- Produces: `applySeamLabel(M, part, text, opts, position, axis): any` where
  `opts = { mode: 'emboss' | 'deboss'; size?: number; depth?: number }`. Emboss unions the label onto the
  surface (protruding along `axis`); deboss subtracts it (engraved, placed `axis*-depth` so the recess ends
  at the surface). Reuses `placeSolid` + `shiftAlong`.

- [ ] **Step 1: Add failing tests**

```ts
import { applySeamLabel } from "../../../src/lib/cut/joints/labels";

it("emboss adds volume, deboss removes volume on the top face", () => {
  const mk = () => M.Manifold.cube([30, 30, 30], true);
  const top: [number, number, number] = [0, 0, 15];
  const up: [number, number, number] = [0, 0, 1];
  const base = mk().volume();

  const cube1 = mk();
  const embossed = applySeamLabel(M, cube1, "A", { mode: "emboss", size: 8, depth: 1 }, top, up);
  expect(embossed.volume()).toBeGreaterThan(base);
  cube1.delete(); embossed.delete();

  const cube2 = mk();
  const debossed = applySeamLabel(M, cube2, "A", { mode: "deboss", size: 8, depth: 1 }, top, up);
  expect(debossed.volume()).toBeLessThan(base);
  cube2.delete(); debossed.delete();
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `applySeamLabel`**

```ts
import { placeSolid } from "./orient";

function shiftAlong(p: [number, number, number], a: [number, number, number], d: number): [number, number, number] {
  return [p[0] + a[0] * d, p[1] + a[1] * d, p[2] + a[2] * d];
}

export function applySeamLabel(
  M: any, part: any, text: string,
  opts: { mode: "emboss" | "deboss"; size?: number; depth?: number },
  position: [number, number, number], axis: [number, number, number],
): any {
  const depth = opts.depth ?? 1;
  const label = buildSeamLabel(M, text, { size: opts.size, depth });
  // Deboss: sink the recess so it ends flush at the surface. Emboss: protrude outward.
  const pos = opts.mode === "deboss" ? shiftAlong(position, axis, -depth) : position;
  const placed = placeSolid(label, pos, axis);
  label.delete();
  const out = opts.mode === "emboss" ? part.union(placed) : part.subtract(placed);
  placed.delete();
  return out;
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/cut/joints/labels.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/cut/joints/labels.ts tests/cut/joints/labels.test.ts
git commit -m "feat(labels): applySeamLabel — emboss (union) / deboss (subtract)"
```

---

### Task 24: Worker `"label"` op + client bridge

**Files:**
- Modify: `src/workers/cut-worker.ts`, `src/lib/cut/cut-client.ts`
- Test: `tests/cut/cut-client.test.ts` (add a `runLabel` case)

**Interfaces:**
- Worker: request `{ reqId; op: "label"; meshGeometry; label: { text; mode; size?; depth?; position; axis } }`;
  response `{ ok: true; labeled: SerializedMesh }`.
- Client: `runLabel(mesh, spec): Promise<THREE.Group>` via the existing `submit` helper.
- Worker handler: reconstruct the mesh → `meshToManifold` → `applySeamLabel(M, man, …)` → serialize via
  `serializeAll` → delete all → post.

- [ ] **Step 1: Add a failing client test**

```ts
it("runLabel returns a labeled mesh group", async () => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(30, 30, 30));
  const g = await runLabel(mesh, {
    text: "A", mode: "emboss", size: 8, depth: 1, position: [0, 0, 15], axis: [0, 0, 1],
  });
  expect(g).toBeDefined();
  expect(g.children.length).toBe(1);
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement the op + `runLabel`**

Widen the request union with the `"label"` variant; handler mirrors the `separate` path (mesh→manifold,
apply, serializeAll, delete, post `{ labeled }`). `runLabel` mirrors `runSeparate` through `submit`,
mapping `resp.labeled` via `deserialize`. Import `applySeamLabel` in the worker. Keep other ops unchanged.

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/cut/`

- [ ] **Step 5: Commit**

```bash
git add src/workers/cut-worker.ts src/lib/cut/cut-client.ts tests/cut/cut-client.test.ts
git commit -m "feat(labels): worker label op + runLabel client bridge"
```

---

### Task 25: Session swap + UI action

**Files:**
- Modify: `src/lib/session.ts`, `src/hooks/useCutSession.ts`, `src/components/PartsTree.tsx`, `src/App.tsx`
- Test: `tests/session.test.ts`, `tests/components/PartsTree.test.tsx` (add)

**Interfaces:**
- `applyLabelResult(s, partId, out: {mesh; group}): Session` — swaps the part's `mesh`/`group` in place
  (keeps id/name/color/parentId; updates `triCount`).
- `performLabel(partId, text, mode)` in `useCutSession` — labels the part at the top-center of its bbox
  (`axis = +Z`, `position = bbox top center`), `runLabel` → `applyLabelResult`. Same busy/error/push shell.
- PartsTree gains a "Label" action (prompts/uses the part's short id as default text, emboss default).

- [ ] **Step 1: Add a failing session test**

```ts
it("applyLabelResult swaps a part's geometry in place, keeping its identity", () => {
  const s0 = /* session with a part 'p0' (reuse file helper) */;
  const before = s0.parts.get("p0")!;
  const out = { mesh: new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2)), group: new THREE.Group() };
  const s1 = applyLabelResult(s0, "p0", out);
  const after = s1.parts.get("p0")!;
  expect(after.meta.name).toBe(before.meta.name);
  expect(after.mesh).toBe(out.mesh);
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement reducer + hook + UI**

`applyLabelResult` clones, replaces the target part's `mesh`/`group`, recomputes `triCount`, keeps meta.
`performLabel` mirrors `performSeparate` (compute bbox top-center from the part group, call `runLabel`,
`applyLabelResult`, push). PartsTree "Label" button (Filament tokens) calls `onLabel(partId)`; App wires it
to a handler that reads a short id/text and `mode` (default emboss) and calls `session.performLabel`.

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/session.test.ts tests/components/PartsTree.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/lib/session.ts src/hooks/useCutSession.ts src/components/PartsTree.tsx src/App.tsx tests/session.test.ts tests/components/PartsTree.test.tsx
git commit -m "feat(labels): applyLabelResult + performLabel + PartsTree label action"
```

---

### Task 26: M3b verification + smoke doc

- [ ] **Step 1:** `npm run test && npm run typecheck` → PASS.
- [ ] **Step 2:** `npm run build:web && npm run build` → both succeed (confirm the typeface JSON bundles and
  the worker still initializes on both targets).
- [ ] **Step 3:** Write `docs/m3b-labels-smoke-test.md` (existing style): emboss "A"/"B" on two cut halves,
  deboss a number, confirm the raised/engraved text is legible in a slicer preview.
- [ ] **Step 4:** `git add docs/m3b-labels-smoke-test.md && git commit -m "docs(m3b): seam-label smoke checklist"`
- [ ] **STOP — Phase 1 complete; pause for user review.**

---

## Self-review (spec coverage)

- Joint shapes (all 5) → Tasks 3-6 ✅; magnet socket → Task 8 ✅; polarity/taper/clearance → Tasks 1,7 ✅;
  back-compat → Tasks 1,2,9 (existing tests must pass) ✅; worker/UI → Tasks 9,10 ✅.
- Test-fit generator → M2 ✅; separate-components → M3a ✅; cap verification → M3a ✅; seam labels
  (emboss+deboss) → M3b ✅; font license → M3b ✅.
- Clearance semantics unchanged → `resolveClearance` + `grow` per-side, default preset path identical ✅.
- Web-only / no `src-tauri` → all tasks WASM-side ✅. Both-build gate → each milestone verify step ✅.
