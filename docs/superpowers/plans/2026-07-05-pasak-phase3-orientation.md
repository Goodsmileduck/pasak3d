# Pasak Phase 3 — Orientation UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add print-prep feedback to the scene — an overhang heatmap (toggle + threshold slider) and a read-only preview of the fit-to-printer suggested cut planes.

**Architecture:** Pure, testable core (`overhang.ts` severity + color ramp) drives a shader-patched material (`heatmap-material.ts`); a small apply/restore helper swaps it onto visible part meshes. The bed-cut preview is a declarative R3F component reusing `CutPlane`'s rendering. No cut-engine or geometry changes.

**Tech Stack:** React 19, Three.js 0.170.0 + @react-three/fiber, Vitest, dual web/desktop Vite targets.

**Spec:** [`../specs/2026-07-05-pasak-phase3-orientation-design.md`](../specs/2026-07-05-pasak-phase3-orientation-design.md)

## Global Constraints

- **Web-only scene/UI work.** No `src-tauri/`, no cut-engine (`src/lib/cut/*`) changes, no new deps.
- **Both build targets pass** before a milestone is done: `npm run build:web` AND `npm run build`; plus `npm run test` and `npm run typecheck`.
- **Z-up:** build plate Z=0, up = +Z. Overhang angle = `max(angleFromUp − 90°, 0)`, `angleFromUp = acos(dot(n, +Z))`.
- **Heatmap default off; threshold default 45° (range 15–89°).**
- **Non-destructive material swap:** save each mesh's original material before applying the heatmap; restore it exactly on toggle-off (never lose the palette color from `RuntimePart.meta.color`).
- **Filament CSS tokens** for DOM UI (no `bg-slate-*`); `isDark` is for the WebGL scene only.
- **The GLSL severity ramp MUST mirror the TS `severityColor`** (same colors + breakpoints) — a doc comment ties them so they can't drift.
- **Commit style:** Conventional Commits with scope (`feat(overhang):`, `feat(preview):`, `docs(...)`), em-dash for what+why. End messages with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Existing seams:** `Viewer.tsx` adds `cutParts: {id, group, visible, isDowel}[]` groups to the scene imperatively (cut-parts effect ~line 123) and renders `CutPlane`/dowels declaratively inside `SceneInner`. `ExplodedView.tsx` is the slider component pattern; App owns `explodeFactor` and renders it. `suggestCuts(bbox, printer): CutPlaneSpec[]` + App's `suggestedCuts: {partId, cuts}` already exist.

---

## Milestone protocol

Work milestones in order. After **each**: `npm run test`, `typecheck`, `build:web`, `build`; write `docs/p3-mN-<name>-smoke-test.md`; **STOP for review**. P3-M2 is outlined with locked interfaces here and expanded to full TDD detail after P3-M1 review.

---

# P3-M1 — Overhang heatmap

Deliverable: an "Overhang" toolbar toggle that colors visible parts by overhang severity, with a live threshold slider + legend, restoring the palette colors when turned off.

## File structure (P3-M1)

- Create `src/lib/overhang.ts` — `overhangSeverity` + `severityColor` (pure).
- Create `src/lib/heatmap-material.ts` — `makeHeatmapMaterial` (shader patch) + threshold setter.
- Create `src/lib/heatmap-apply.ts` — `applyHeatmap`/`clearHeatmap` (traverse a group, swap/restore materials).
- Create `src/components/HeatmapControls.tsx` — threshold slider + legend (DOM).
- Modify `src/components/Toolbar.tsx` — "Overhang" toggle prop + button.
- Modify `src/App.tsx` — `overhangOn`/`overhangThreshold` state; render controls; keyboard shortcut.
- Modify `src/components/Viewer.tsx` — effect that applies/clears the heatmap on visible cut parts.
- Tests: `tests/overhang.test.ts`, `tests/heatmap-material.test.ts`, `tests/heatmap-apply.test.ts`, `tests/components/Toolbar.test.tsx`, `tests/components/HeatmapControls.test.tsx`.

---

### Task 1: Pure overhang severity + color ramp

**Files:**
- Create: `src/lib/overhang.ts`
- Test: `tests/overhang.test.ts`

**Interfaces:**
- Produces: `overhangSeverity(normal: [number,number,number], thresholdDeg: number): number` (0..1) and
  `severityColor(t: number): [number, number, number]` (r,g,b in 0..1).

- [ ] **Step 1: Write the failing test**

```ts
// tests/overhang.test.ts
import { describe, it, expect } from "vitest";
import { overhangSeverity, severityColor } from "../src/lib/overhang";

describe("overhangSeverity (Z up)", () => {
  it("up-facing and side-facing are safe (0)", () => {
    expect(overhangSeverity([0, 0, 1], 45)).toBe(0);   // up
    expect(overhangSeverity([1, 0, 0], 45)).toBe(0);   // side (angleFromUp = 90 → overhang 0)
  });
  it("fully down-facing is severe (1)", () => {
    expect(overhangSeverity([0, 0, -1], 45)).toBe(1);
  });
  it("ramps between the threshold and vertical-down", () => {
    // overhang = angleFromUp - 90; severity = overhang / (90 - threshold).
    // nz = cos(112.5°) ≈ -0.3827 → angleFromUp 112.5 → overhang 22.5 → /45 = 0.5
    expect(overhangSeverity([0, 0, Math.cos((112.5 * Math.PI) / 180)], 45)).toBeCloseTo(0.5, 2);
  });
  it("normalizes the input normal", () => {
    expect(overhangSeverity([0, 0, -2], 45)).toBe(1);
  });
});

describe("severityColor", () => {
  it("green at 0, red at 1, amber-ish in the middle", () => {
    expect(severityColor(0)[1]).toBeGreaterThan(severityColor(0)[0]); // green: g > r
    expect(severityColor(1)[0]).toBeGreaterThan(severityColor(1)[1]); // red: r > g
    const mid = severityColor(0.5);
    expect(mid[0]).toBeGreaterThan(0.5); // amber has high red
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (module not found)

Run: `npx vitest run tests/overhang.test.ts`

- [ ] **Step 3: Implement**

```ts
// src/lib/overhang.ts
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Overhang severity (0 safe … 1 severe) of a face with unit-ish `normal`, Z up. */
export function overhangSeverity(normal: [number, number, number], thresholdDeg: number): number {
  const [x, y, z] = normal;
  const len = Math.hypot(x, y, z) || 1;
  const nz = z / len;
  const angleFromUp = (Math.acos(clamp(nz, -1, 1)) * 180) / Math.PI;
  const overhang = angleFromUp - 90; // >0 ⇒ down-facing
  if (overhang <= 0) return 0;
  return clamp(overhang / Math.max(90 - thresholdDeg, 1), 0, 1);
}

// Ramp stops — MUST match the GLSL ramp in heatmap-material.ts.
const SAFE: [number, number, number] = [0.20, 0.72, 0.36]; // green
const MID: [number, number, number] = [0.96, 0.62, 0.10];  // amber
const HOT: [number, number, number] = [0.90, 0.15, 0.15];  // red
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] =>
  [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** Green→amber→red ramp for severity 0..1. */
export function severityColor(t: number): [number, number, number] {
  const c = clamp(t, 0, 1);
  return c < 0.5 ? mix(SAFE, MID, c * 2) : mix(MID, HOT, (c - 0.5) * 2);
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/overhang.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/overhang.ts tests/overhang.test.ts
git commit -m "feat(overhang): pure overhangSeverity + severityColor ramp"
```

---

### Task 2: Shader-patched heatmap material

**Files:**
- Create: `src/lib/heatmap-material.ts`
- Test: `tests/heatmap-material.test.ts`

**Interfaces:**
- Produces: `makeHeatmapMaterial(thresholdDeg: number): THREE.MeshStandardMaterial` whose
  `userData.setThreshold(deg: number): void` updates the live `uThreshold` uniform. The fragment shader
  computes overhang from the **world normal** vs +Z and applies the same ramp as `severityColor`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/heatmap-material.test.ts
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { makeHeatmapMaterial } from "../src/lib/heatmap-material";

describe("makeHeatmapMaterial", () => {
  it("is a MeshStandardMaterial carrying a live threshold uniform", () => {
    const m = makeHeatmapMaterial(45);
    expect(m).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(m.userData.uniforms.uThreshold.value).toBe(45);
    (m.userData.setThreshold as (d: number) => void)(30);
    expect(m.userData.uniforms.uThreshold.value).toBe(30);
  });
  it("patches the shaders on compile (injects vNormalW + uThreshold)", () => {
    const m = makeHeatmapMaterial(45);
    const shader: any = { uniforms: {}, vertexShader: "#include <begin_vertex>", fragmentShader: "#include <color_fragment>" };
    (m.onBeforeCompile as any)(shader);
    expect(shader.vertexShader).toContain("vNormalW");
    expect(shader.fragmentShader).toContain("uThreshold");
    expect(shader.uniforms.uThreshold).toBe(m.userData.uniforms.uThreshold);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/heatmap-material.test.ts`

- [ ] **Step 3: Implement**

```ts
// src/lib/heatmap-material.ts
import * as THREE from "three";

/**
 * A MeshStandardMaterial that colors each fragment by overhang severity (Z up).
 * The GLSL ramp MUST match `severityColor` in overhang.ts (green→amber→red).
 */
export function makeHeatmapMaterial(thresholdDeg: number): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0 });
  const uniforms = { uThreshold: { value: thresholdDeg } };

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uThreshold = uniforms.uThreshold;
    shader.vertexShader = "varying vec3 vNormalW;\n" + shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\n  vNormalW = normalize(mat3(modelMatrix) * normal);",
    );
    shader.fragmentShader = "uniform float uThreshold;\nvarying vec3 vNormalW;\n" + shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      float angFromUp = degrees(acos(clamp(vNormalW.z, -1.0, 1.0)));
      float overhang = angFromUp - 90.0;                 // >0 ⇒ down-facing
      float sev = clamp(overhang / max(90.0 - uThreshold, 1.0), 0.0, 1.0);
      vec3 safeCol = vec3(0.20, 0.72, 0.36);
      vec3 midCol  = vec3(0.96, 0.62, 0.10);
      vec3 hotCol  = vec3(0.90, 0.15, 0.15);
      vec3 ramp = sev < 0.5 ? mix(safeCol, midCol, sev * 2.0) : mix(midCol, hotCol, (sev - 0.5) * 2.0);
      diffuseColor.rgb = ramp;`,
    );
  };

  mat.userData.uniforms = uniforms;
  mat.userData.setThreshold = (deg: number) => { uniforms.uThreshold.value = deg; };
  return mat;
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/heatmap-material.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/heatmap-material.ts tests/heatmap-material.test.ts
git commit -m "feat(overhang): shader-patched heatmap material with live threshold uniform"
```

---

### Task 3: Apply / restore materials on a group

**Files:**
- Create: `src/lib/heatmap-apply.ts`
- Test: `tests/heatmap-apply.test.ts`

**Interfaces:**
- Produces: `applyHeatmap(group: THREE.Object3D, material: THREE.Material): void` — for each descendant
  `Mesh`, save its current material to `mesh.userData.origMaterial` (once) and set `mesh.material` to the
  shared heatmap material. `clearHeatmap(group: THREE.Object3D): void` — restore `origMaterial` and clear
  the marker. Idempotent (double-apply doesn't overwrite the saved original).

- [ ] **Step 1: Write the failing test**

```ts
// tests/heatmap-apply.test.ts
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { applyHeatmap, clearHeatmap } from "../src/lib/heatmap-apply";

function meshGroup(): { group: THREE.Group; mesh: THREE.Mesh; orig: THREE.Material } {
  const orig = new THREE.MeshStandardMaterial({ color: 0x3b82f6 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), orig);
  const group = new THREE.Group();
  group.add(mesh);
  return { group, mesh, orig };
}

describe("applyHeatmap / clearHeatmap", () => {
  it("swaps to the heatmap material and restores the original", () => {
    const { group, mesh, orig } = meshGroup();
    const heat = new THREE.MeshStandardMaterial();
    applyHeatmap(group, heat);
    expect(mesh.material).toBe(heat);
    clearHeatmap(group);
    expect(mesh.material).toBe(orig);
  });
  it("double-apply keeps the true original", () => {
    const { group, mesh, orig } = meshGroup();
    applyHeatmap(group, new THREE.MeshStandardMaterial());
    applyHeatmap(group, new THREE.MeshStandardMaterial());
    clearHeatmap(group);
    expect(mesh.material).toBe(orig);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/heatmap-apply.test.ts`

- [ ] **Step 3: Implement**

```ts
// src/lib/heatmap-apply.ts
import * as THREE from "three";

export function applyHeatmap(group: THREE.Object3D, material: THREE.Material): void {
  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!(mesh as any).isMesh) return;
    if (mesh.userData.origMaterial === undefined) mesh.userData.origMaterial = mesh.material;
    mesh.material = material;
  });
}

export function clearHeatmap(group: THREE.Object3D): void {
  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!(mesh as any).isMesh) return;
    if (mesh.userData.origMaterial !== undefined) {
      mesh.material = mesh.userData.origMaterial as THREE.Material | THREE.Material[];
      delete mesh.userData.origMaterial;
    }
  });
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/heatmap-apply.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/heatmap-apply.ts tests/heatmap-apply.test.ts
git commit -m "feat(overhang): non-destructive material apply/restore helper"
```

---

### Task 4: Toolbar toggle + threshold slider/legend

**Files:**
- Create: `src/components/HeatmapControls.tsx`
- Modify: `src/components/Toolbar.tsx` (add `overhangOn`/`onToggleOverhang` prop + button)
- Test: `tests/components/HeatmapControls.test.tsx`, `tests/components/Toolbar.test.tsx` (add)

**Interfaces:**
- `HeatmapControls` props: `threshold: number; onThresholdChange: (deg: number) => void`. Renders a range
  input (15–89, aria-label "Overhang threshold") + a legend swatch and the current angle.
- `Toolbar` gains `overhangOn?: boolean; onToggleOverhang?: () => void` and an "Overhang" button styled
  like the other toolbar toggles, `aria-pressed={overhangOn}`.

- [ ] **Step 1: Write the failing tests**

```tsx
// tests/components/HeatmapControls.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HeatmapControls } from "../../src/components/HeatmapControls";

it("reports threshold changes", () => {
  const onChange = vi.fn();
  render(<HeatmapControls threshold={45} onThresholdChange={onChange} />);
  fireEvent.change(screen.getByLabelText(/overhang threshold/i), { target: { value: "30" } });
  expect(onChange).toHaveBeenCalledWith(30);
});
```

```tsx
// tests/components/Toolbar.test.tsx — add (match existing harness)
it("calls onToggleOverhang when the Overhang button is clicked", async () => {
  const onToggle = vi.fn();
  render(<Toolbar {...baseProps} onToggleOverhang={onToggle} />);
  await userEvent.click(screen.getByRole("button", { name: /overhang/i }));
  expect(onToggle).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/components/HeatmapControls.test.tsx tests/components/Toolbar.test.tsx`

- [ ] **Step 3: Implement (Filament tokens)**

Create `HeatmapControls` modeled on `ExplodedView.tsx` — a `<span>Overhang</span>`, a `<input type="range"
min={15} max={89} step={1} aria-label="Overhang threshold">`, the `{threshold}°`, and a small legend (a
gradient swatch `linear-gradient` green→amber→red with "Safe"/"Steep" labels) using `var(--ink-muted)`. In
`Toolbar.tsx` add the `overhangOn`/`onToggleOverhang` props + an "Overhang" button beside the other toggles
(`aria-pressed={overhangOn}`, active style using `var(--ink)`/`var(--surface)` like the exploded/plate toggles).

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/components/HeatmapControls.test.tsx tests/components/Toolbar.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/components/HeatmapControls.tsx src/components/Toolbar.tsx tests/components/HeatmapControls.test.tsx tests/components/Toolbar.test.tsx
git commit -m "feat(overhang): toolbar toggle + threshold slider & legend"
```

---

### Task 5: Wire the heatmap into the scene + App state

**Files:**
- Modify: `src/App.tsx` (state `overhangOn`/`overhangThreshold`; render `HeatmapControls`; pass to Toolbar + Viewer; keyboard shortcut)
- Modify: `src/components/Viewer.tsx` (effect: apply/clear the heatmap material on visible cut parts; update threshold)
- Test: covered by Tasks 1–4 units + the manual smoke doc (no new automated test; the wiring is integration)

**Interfaces:**
- `Viewer` gains `overhangOn?: boolean; overhangThreshold?: number`. An effect memoizes one
  `makeHeatmapMaterial(overhangThreshold)`; when `overhangOn`, `applyHeatmap` to each visible non-dowel
  `cutParts` group (and the `rootGroup` in single-model mode); when off (or on cleanup), `clearHeatmap`.
  A second effect calls `material.userData.setThreshold(overhangThreshold)` when the threshold changes.

- [ ] **Step 1: Implement App state + wiring**

In `App.tsx`: add `const [overhangOn, setOverhangOn] = useState(false);` and
`const [overhangThreshold, setOverhangThreshold] = useState(45);`. Pass `overhangOn={overhangOn}` +
`onToggleOverhang={() => setOverhangOn((v) => !v)}` to `<Toolbar>`; pass `overhangOn` + `overhangThreshold`
to `<Viewer>`; render `{overhangOn && <HeatmapControls threshold={overhangThreshold} onThresholdChange={setOverhangThreshold} />}`
near the `<ExplodedView>`. Add a keyboard shortcut (e.g. `V`) in the existing `useKeyboard` map to toggle it.

- [ ] **Step 2: Implement the Viewer effect**

In `Viewer.tsx`'s `SceneInner`, add:
```ts
const heatMat = useMemo(() => makeHeatmapMaterial(overhangThreshold ?? 45), []); // eslint-disable-line
useEffect(() => { (heatMat.userData.setThreshold as (d: number) => void)(overhangThreshold ?? 45); }, [overhangThreshold, heatMat]);
useEffect(() => {
  const groups = (cutParts ?? []).filter((p) => p.visible && !p.isDowel).map((p) => p.group);
  const all = rootGroup && !hasCutParts ? [rootGroup] : groups;
  if (overhangOn) all.forEach((g) => applyHeatmap(g, heatMat));
  else all.forEach((g) => clearHeatmap(g));
  return () => all.forEach((g) => clearHeatmap(g));
}, [overhangOn, cutParts, rootGroup, hasCutParts, heatMat]);
```
Import `makeHeatmapMaterial`, `applyHeatmap`, `clearHeatmap`. (The threshold-setter effect updates the
uniform live; the shared material recompiles once.)

- [ ] **Step 3: Verify manually + run the suite**

Run: `npm run dev:web` — load `public/sample-keycap.3mf`, toggle Overhang: the model recolors (down-faces
red), the slider changes the threshold live, toggling off restores the palette color. Then:
Run: `npm run test`
Expected: all pass (no regressions).

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/Viewer.tsx
git commit -m "feat(overhang): wire heatmap toggle/threshold into scene with restore-on-off"
```

---

### Task 6: P3-M1 verification + smoke doc

- [ ] **Step 1:** `npm run test && npm run typecheck` → PASS.
- [ ] **Step 2:** `npm run build:web && npm run build` → both succeed.
- [ ] **Step 3:** Write `docs/p3-m1-overhang-smoke-test.md` (existing style): toggle Overhang on a loaded
  model + on cut parts; confirm down-faces read red, slider retunes live, toggle-off restores palette
  colors, dowels/plate unaffected, legible in light+dark scene.
- [ ] **Step 4:** `git add docs/p3-m1-overhang-smoke-test.md && git commit -m "docs(p3-m1): overhang heatmap smoke checklist"`
- [ ] **STOP — pause for user review before P3-M2.**

---

# P3-M2 — Bed-cut preview (outline)

Expand to full TDD detail after P3-M1 review. Locked interfaces:

- **Create `src/components/SuggestedCutPlanes.tsx`**: props `{ cuts: CutPlaneSpec[]; bbox: THREE.Box3 }`;
  renders one translucent, non-interactive plane per cut, reusing `CutPlane`'s position/quaternion/size
  math (extract that into a shared `planeTransform(plane, bbox)` helper in `CutPlane.tsx` so both use it —
  DRY). Distinct color from the active cut gizmo (e.g. amber) + `depthWrite={false}`, no `onClick`.
- **Modify `Viewer.tsx`**: add `suggestedCuts?: CutPlaneSpec[]` + reuse the active part's bbox; render
  `<SuggestedCutPlanes>` inside `SceneInner` when present.
- **Modify `App.tsx`**: pass `suggestedCuts?.cuts` (the pending `{ partId, cuts }`) + the part bbox to the
  Viewer; clears when the suggestion is applied/cancelled (existing flow).
- **Tests** `tests/components/SuggestedCutPlanes.test.tsx`: renders N plane meshes for N cuts, 0 for empty;
  `tests/cut/…` none (no geometry change); `planeTransform` unit test if extracted.
- Tasks: (1) extract `planeTransform` + test; (2) `SuggestedCutPlanes` component + test; (3) Viewer + App
  wiring; (4) verify + `docs/p3-m2-bedcut-preview-smoke-test.md`; STOP.

---

## Self-review (spec coverage)

- Overhang heatmap: pure severity/ramp → Task 1 ✅; shader material → Task 2 ✅; apply/restore → Task 3 ✅;
  toggle + slider + legend → Task 4 ✅; scene wiring + threshold live + restore-on-off + shortcut → Task 5 ✅.
- Bed-cut preview (read-only planes) → P3-M2 ✅.
- Web-only / no cut-engine → all tasks scene/UI ✅. Both-build gate → each milestone verify ✅. GLSL-mirrors-TS
  ramp → Tasks 1+2 use the identical stops, tied by comment ✅. Non-destructive restore → Task 3 + Task 5 ✅.
