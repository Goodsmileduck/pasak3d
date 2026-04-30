# Pasak M3 — Full v1 Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Prerequisite:** M2 complete (single-cut MVP working end-to-end).

**Goal:** Promote the single-cut MVP into a feature-complete v1 web app: multi-cut sessions with a parts tree, undo/redo, auto-orient, printer presets with fit-to-printer suggestions, exploded view, 3MF multi-object export, keyboard shortcuts, help overlay, and polished error states.

**Architecture:** `useCutSession` is upgraded into a real session store with parts indexed by id, an ordered cuts history, and immutable undo/redo. Cuts apply to any selected non-hidden part. Auto-orient runs after every cut. PrinterPanel is a new sidebar widget; fit-to-printer logic lives in pure functions tested in Node.

**Tech Stack:** Same as M2.

**Working directory:** `/home/goodsmileduck/local/personal/3dlab/pasak/`

---

## Task 1: Refactor session state to support multi-cut

**Files:**
- Modify: `src/hooks/useCutSession.ts`
- Create: `src/lib/session.ts`
- Create: `tests/session.test.ts`

- [ ] **Step 1: Extract pure session reducer to `src/lib/session.ts`**

```ts
import * as THREE from "three";
import type { Part, PartId, Cut, CutId } from "../types";

export type RuntimePart = {
  id: PartId;
  meta: Part;
  mesh: THREE.Mesh;
  group: THREE.Group;
  isDowel: boolean;
};

export type Session = {
  parts: Map<PartId, RuntimePart>;
  cuts: Cut[];
  selectedPartId: PartId | null;
};

export function emptySession(): Session {
  return { parts: new Map(), cuts: [], selectedPartId: null };
}

export function importPart(s: Session, mesh: THREE.Mesh, group: THREE.Group, name: string): { session: Session; partId: PartId } {
  const id = `p_${Math.random().toString(36).slice(2, 8)}`;
  const next = cloneSession(s);
  const tri = countTris(mesh);
  next.parts.set(id, {
    id, mesh, group, isDowel: false,
    meta: { id, name, source: "import", parentId: null, cutId: null, visible: true, color: pickColor(next.parts.size), triCount: tri },
  });
  next.selectedPartId = id;
  return { session: next, partId: id };
}

export type CutOutput = {
  partA: { mesh: THREE.Mesh; group: THREE.Group };
  partB: { mesh: THREE.Mesh; group: THREE.Group };
  dowelPieces: Array<{ mesh: THREE.Mesh; group: THREE.Group }>;
};

export function applyCutResult(s: Session, parentId: PartId, cutId: CutId, output: CutOutput, parentName: string): Session {
  const next = cloneSession(s);
  const parent = next.parts.get(parentId);
  if (!parent) throw new Error("Parent part missing");
  parent.meta = { ...parent.meta, visible: false };

  const aId = `${parentId}_a`;
  const bId = `${parentId}_b`;
  next.parts.set(aId, {
    id: aId, mesh: output.partA.mesh, group: output.partA.group, isDowel: false,
    meta: { id: aId, name: `${parentName}-A`, source: "cut", parentId, cutId, visible: true, color: pickColor(next.parts.size), triCount: countTris(output.partA.mesh) },
  });
  next.parts.set(bId, {
    id: bId, mesh: output.partB.mesh, group: output.partB.group, isDowel: false,
    meta: { id: bId, name: `${parentName}-B`, source: "cut", parentId, cutId, visible: true, color: pickColor(next.parts.size), triCount: countTris(output.partB.mesh) },
  });
  output.dowelPieces.forEach((dp, i) => {
    const id = `${cutId}_d${i}`;
    next.parts.set(id, {
      id, mesh: dp.mesh, group: dp.group, isDowel: true,
      meta: { id, name: `Dowel ${cutId}-${i + 1}`, source: "cut", parentId: null, cutId, visible: true, color: "#a3a3a3", triCount: countTris(dp.mesh) },
    });
  });
  next.selectedPartId = aId;
  return next;
}

export function setVisible(s: Session, partId: PartId, visible: boolean): Session {
  const next = cloneSession(s);
  const part = next.parts.get(partId);
  if (part) part.meta = { ...part.meta, visible };
  return next;
}

export function selectPart(s: Session, partId: PartId | null): Session {
  return { ...s, parts: new Map(s.parts), selectedPartId: partId };
}

function cloneSession(s: Session): Session {
  return { parts: new Map(Array.from(s.parts.entries()).map(([k, v]) => [k, { ...v, meta: { ...v.meta } }])), cuts: [...s.cuts], selectedPartId: s.selectedPartId };
}

function countTris(mesh: THREE.Mesh): number {
  const idx = (mesh.geometry as THREE.BufferGeometry).index;
  return idx ? idx.count / 3 : (mesh.geometry as THREE.BufferGeometry).attributes.position.count / 3;
}

const PALETTE = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];
function pickColor(n: number): string {
  return PALETTE[n % PALETTE.length];
}
```

- [ ] **Step 2: Write tests**

```ts
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { emptySession, importPart, applyCutResult, setVisible, selectPart } from "../src/lib/session";

function makeMesh(): { mesh: THREE.Mesh; group: THREE.Group } {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10));
  const group = new THREE.Group();
  group.add(mesh);
  return { mesh, group };
}

describe("session", () => {
  it("imports a part and selects it", () => {
    let s = emptySession();
    const { mesh, group } = makeMesh();
    const r = importPart(s, mesh, group, "Cube");
    s = r.session;
    expect(s.parts.size).toBe(1);
    expect(s.selectedPartId).toBe(r.partId);
    expect(s.parts.get(r.partId)?.meta.name).toBe("Cube");
  });

  it("applyCutResult hides parent and adds A, B, and dowel pieces", () => {
    let s = emptySession();
    const root = makeMesh();
    const r = importPart(s, root.mesh, root.group, "Cube");
    s = r.session;
    const a = makeMesh(); const b = makeMesh(); const d = makeMesh();
    s = applyCutResult(s, r.partId, "c1", { partA: a, partB: b, dowelPieces: [d] }, "Cube");
    expect(s.parts.get(r.partId)?.meta.visible).toBe(false);
    expect(s.parts.size).toBe(4); // root + A + B + dowel
    expect(s.selectedPartId).toBe(`${r.partId}_a`);
  });

  it("setVisible toggles", () => {
    let s = emptySession();
    const r = importPart(s, makeMesh().mesh, makeMesh().group, "X");
    s = r.session;
    s = setVisible(s, r.partId, false);
    expect(s.parts.get(r.partId)?.meta.visible).toBe(false);
  });

  it("selectPart updates selection", () => {
    let s = emptySession();
    const r = importPart(s, makeMesh().mesh, makeMesh().group, "X");
    s = r.session;
    s = selectPart(s, null);
    expect(s.selectedPartId).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npm run test -- session.test.ts`
Expected: 4 passed.

- [ ] **Step 4: Replace `useCutSession` to delegate to the reducer**

Replace `src/hooks/useCutSession.ts`:
```ts
import { useCallback, useState } from "react";
import * as THREE from "three";
import type { Dowel, CutPlaneSpec, TolerancePreset, ModelData, PartId } from "../types";
import { runCut } from "../lib/cut/cut-client";
import { emptySession, importPart, applyCutResult, setVisible, selectPart, type Session, type RuntimePart } from "../lib/session";

export function useCutSession() {
  const [session, setSession] = useState<Session>(emptySession());
  const [history, setHistory] = useState<Session[]>([]);
  const [future, setFuture] = useState<Session[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const push = (next: Session) => {
    setHistory((h) => [...h, session]);
    setFuture([]);
    setSession(next);
  };

  const loadModel = useCallback((data: ModelData) => {
    let mesh: THREE.Mesh | null = null;
    data.group.traverse((o) => { if ((o as any).isMesh && !mesh) mesh = o as THREE.Mesh; });
    if (!mesh) throw new Error("Model has no mesh");
    const fresh = emptySession();
    const { session: next } = importPart(fresh, mesh, data.group, "Body");
    setHistory([]); setFuture([]); setSession(next); setError(null);
  }, []);

  const performCut = useCallback(async (partId: PartId, plane: CutPlaneSpec, dowels: Dowel[], tolerance: TolerancePreset) => {
    const target = session.parts.get(partId);
    if (!target) return;
    setBusy(true); setError(null);
    try {
      const result = await runCut(target.mesh, plane, dowels, tolerance);
      const a = firstMeshAndGroup(result.partA);
      const b = firstMeshAndGroup(result.partB);
      if (!a || !b) throw new Error("Cut produced empty parts");
      const dps = result.dowelPieces.map(firstMeshAndGroup).filter((x): x is { mesh: THREE.Mesh; group: THREE.Group } => !!x);
      const next = applyCutResult(session, partId, `c${session.cuts.length + 1}`, { partA: a, partB: b, dowelPieces: dps }, target.meta.name);
      push(next);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally { setBusy(false); }
  }, [session]);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setFuture((f) => [session, ...f]);
    setSession(prev);
  }, [history, session]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture((f) => f.slice(1));
    setHistory((h) => [...h, session]);
    setSession(next);
  }, [future, session]);

  const selectPartId = useCallback((id: PartId | null) => setSession((s) => selectPart(s, id)), []);
  const togglePartVisible = useCallback((id: PartId, visible: boolean) => setSession((s) => setVisible(s, id, visible)), []);

  const partsArray: RuntimePart[] = Array.from(session.parts.values());
  return { session, partsArray, busy, error, loadModel, performCut, undo, redo, canUndo: history.length > 0, canRedo: future.length > 0, selectPartId, togglePartVisible };
}

function firstMeshAndGroup(group: THREE.Group): { mesh: THREE.Mesh; group: THREE.Group } | null {
  let mesh: THREE.Mesh | null = null;
  group.traverse((o) => { if ((o as any).isMesh && !mesh) mesh = o as THREE.Mesh; });
  return mesh ? { mesh, group } : null;
}
```

- [ ] **Step 5: Verify typecheck and existing M2 flow still works**

Run: `npm run typecheck`. Run app: cube cut still produces two halves + dowels.

- [ ] **Step 6: Commit**

```bash
git add src/lib/session.ts src/hooks/useCutSession.ts tests/session.test.ts
git commit -m "refactor(m3): extract pure session reducer with multi-cut support"
```

---

## Task 2: Parts tree component

**Files:**
- Create: `src/components/PartsTree.tsx`

- [ ] **Step 1: Implement**

```tsx
import type { RuntimePart } from "../lib/session";
import type { PartId } from "../types";

type Props = {
  parts: RuntimePart[];
  selectedId: PartId | null;
  onSelect: (id: PartId) => void;
  onToggleVisible: (id: PartId, visible: boolean) => void;
};

export function PartsTree({ parts, selectedId, onSelect, onToggleVisible }: Props) {
  const roots = parts.filter((p) => p.meta.parentId === null && !p.isDowel);
  const dowels = parts.filter((p) => p.isDowel);

  const renderNode = (part: RuntimePart, depth = 0) => {
    const children = parts.filter((p) => p.meta.parentId === part.id && !p.isDowel);
    return (
      <div key={part.id}>
        <div
          className={`flex items-center gap-1 px-1 py-0.5 cursor-pointer rounded ${selectedId === part.id ? "bg-blue-100" : "hover:bg-slate-100"}`}
          style={{ paddingLeft: depth * 12 + 4 }}
          onClick={() => onSelect(part.id)}
        >
          <input
            type="checkbox"
            checked={part.meta.visible}
            onChange={(e) => { e.stopPropagation(); onToggleVisible(part.id, e.target.checked); }}
            onClick={(e) => e.stopPropagation()}
          />
          <span className="w-2 h-2 rounded-full" style={{ background: part.meta.color }} />
          <span className="text-sm">{part.meta.name}</span>
          <span className="text-xs text-slate-400 ml-auto">{Math.round(part.meta.triCount)}</span>
        </div>
        {children.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  };

  return (
    <div className="bg-white border-r border-slate-200 w-56 flex flex-col text-sm">
      <div className="px-2 py-1 font-semibold border-b border-slate-100">Parts</div>
      <div className="flex-1 overflow-auto">{roots.map((r) => renderNode(r))}</div>
      {dowels.length > 0 && (
        <>
          <div className="px-2 py-1 font-semibold border-y border-slate-100">Dowels ({dowels.length})</div>
          <div className="overflow-auto max-h-40">
            {dowels.map((d) => (
              <div key={d.id} className="flex items-center gap-1 px-2 py-0.5">
                <input type="checkbox" checked={d.meta.visible} onChange={(e) => onToggleVisible(d.id, e.target.checked)} />
                <span className="text-xs">{d.meta.name}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/PartsTree.tsx
git commit -m "feat(m3): PartsTree component with visibility toggles"
```

---

## Task 3: Auto-orient

**Files:**
- Create: `src/lib/cut/auto-orient.ts`
- Create: `tests/cut/auto-orient.test.ts`

- [ ] **Step 1: Write test**

```ts
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { computeAutoOrientRotation, applyAutoOrient } from "../../src/lib/cut/auto-orient";

describe("auto-orient", () => {
  it("rotates an L-bracket so its largest face is on Z=0", () => {
    // L-bracket: long base (50x10x2), short upright (10x10x20)
    const base = new THREE.BoxGeometry(50, 10, 2).translate(0, 0, -19);
    const upright = new THREE.BoxGeometry(10, 10, 20).translate(20, 0, -10);
    const merged = new THREE.BoxGeometry(); // placeholder; not actually merging in this test
    const mesh = new THREE.Mesh(base);
    const rot = computeAutoOrientRotation(mesh);
    expect(rot).toBeInstanceOf(THREE.Quaternion);
    applyAutoOrient(mesh);
    const bbox = new THREE.Box3().setFromObject(mesh);
    // After auto-orient, the part should sit on Z=0
    expect(bbox.min.z).toBeCloseTo(0, 1);
  });

  it("leaves a cube alone (any face is the largest)", () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10));
    applyAutoOrient(mesh);
    const bbox = new THREE.Box3().setFromObject(mesh);
    expect(bbox.max.z - bbox.min.z).toBeCloseTo(10, 1);
  });
});
```

- [ ] **Step 2: Implement**

```ts
import * as THREE from "three";

/**
 * Find the rotation that places the largest planar face cluster downward (-Z).
 * Strategy: cluster triangles by face normal (round to 5° buckets), sum area per bucket,
 * pick the bucket with the largest summed area, then rotate so that normal → -Z.
 */
export function computeAutoOrientRotation(mesh: THREE.Mesh): THREE.Quaternion {
  const geom = mesh.geometry as THREE.BufferGeometry;
  const pos = geom.attributes.position.array as Float32Array;
  const idx = geom.index?.array;
  const triCount = idx ? idx.length / 3 : pos.length / 9;

  const buckets = new Map<string, { normal: THREE.Vector3; area: number }>();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3();

  for (let t = 0; t < triCount; t++) {
    const ia = idx ? idx[t * 3] : t * 3;
    const ib = idx ? idx[t * 3 + 1] : t * 3 + 1;
    const ic = idx ? idx[t * 3 + 2] : t * 3 + 2;
    a.fromArray(pos, ia * 3); b.fromArray(pos, ib * 3); c.fromArray(pos, ic * 3);
    ab.subVectors(b, a); ac.subVectors(c, a);
    const cross = new THREE.Vector3().crossVectors(ab, ac);
    const area = cross.length() / 2;
    if (area < 1e-6) continue;
    const n = cross.normalize();
    const key = bucketKey(n);
    const existing = buckets.get(key);
    if (existing) existing.area += area;
    else buckets.set(key, { normal: n.clone(), area });
  }

  let best: { normal: THREE.Vector3; area: number } | null = null;
  for (const v of buckets.values()) {
    if (!best || v.area > best.area) best = v;
  }
  if (!best) return new THREE.Quaternion();
  return new THREE.Quaternion().setFromUnitVectors(best.normal, new THREE.Vector3(0, 0, -1));
}

function bucketKey(n: THREE.Vector3, stepDeg = 5): string {
  const stepRad = (stepDeg * Math.PI) / 180;
  const round = (v: number) => Math.round(v / stepRad) * stepRad;
  return `${round(n.x)},${round(n.y)},${round(n.z)}`;
}

/**
 * Rotate the mesh in place to its auto-orient orientation, then translate so the lowest
 * point of the rotated bbox sits on Z=0.
 */
export function applyAutoOrient(mesh: THREE.Mesh): void {
  const rot = computeAutoOrientRotation(mesh);
  mesh.quaternion.copy(rot);
  mesh.updateMatrix();
  mesh.geometry.applyMatrix4(mesh.matrix);
  mesh.position.set(0, 0, 0);
  mesh.quaternion.identity();
  mesh.updateMatrix();
  const bbox = new THREE.Box3().setFromObject(mesh);
  const center = bbox.getCenter(new THREE.Vector3());
  mesh.position.set(-center.x, -center.y, -bbox.min.z);
}
```

- [ ] **Step 3: Run test**

Run: `npm run test -- cut/auto-orient.test.ts`
Expected: 2 passed.

- [ ] **Step 4: Apply auto-orient after each cut in the session**

Edit `src/hooks/useCutSession.ts` `performCut`. After receiving the worker result, call `applyAutoOrient(a.mesh)` and `applyAutoOrient(b.mesh)` and `applyAutoOrient` on each dowel piece BEFORE invoking `applyCutResult`.

```ts
import { applyAutoOrient } from "../lib/cut/auto-orient";
// ... inside performCut, after firstMeshAndGroup:
applyAutoOrient(a.mesh);
applyAutoOrient(b.mesh);
dps.forEach((d) => applyAutoOrient(d.mesh));
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/cut/auto-orient.ts tests/cut/auto-orient.test.ts src/hooks/useCutSession.ts
git commit -m "feat(m3): auto-orient parts so largest face sits on Z=0"
```

---

## Task 4: Printer presets

**Files:**
- Create: `src/lib/printer-presets.ts`
- Create: `tests/printer-presets.test.ts`

- [ ] **Step 1: Write test**

```ts
import { describe, it, expect } from "vitest";
import { PRINTER_PRESETS, fitsInPrinter, dimensionsFromBBox } from "../src/lib/printer-presets";
import * as THREE from "three";

describe("printer presets", () => {
  it("includes Bambu A1, X1, Prusa MK4, Ender 3", () => {
    const ids = PRINTER_PRESETS.map((p) => p.id);
    expect(ids).toContain("bambu-a1");
    expect(ids).toContain("bambu-x1");
    expect(ids).toContain("prusa-mk4");
    expect(ids).toContain("ender-3");
  });

  it("dimensionsFromBBox returns x/y/z size", () => {
    const bb = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(10, 20, 30));
    expect(dimensionsFromBBox(bb)).toEqual({ x: 10, y: 20, z: 30 });
  });

  it("fitsInPrinter respects rotation = false", () => {
    const p = { id: "x", name: "X", buildVolume: { x: 100, y: 100, z: 100 } };
    expect(fitsInPrinter({ x: 90, y: 90, z: 90 }, p)).toBe(true);
    expect(fitsInPrinter({ x: 110, y: 90, z: 90 }, p)).toBe(false);
  });
});
```

- [ ] **Step 2: Implement**

```ts
import * as THREE from "three";
import type { PrinterPreset } from "../types";

export const PRINTER_PRESETS: PrinterPreset[] = [
  { id: "bambu-a1",   name: "Bambu Lab A1",        buildVolume: { x: 256, y: 256, z: 256 } },
  { id: "bambu-a1m",  name: "Bambu Lab A1 mini",   buildVolume: { x: 180, y: 180, z: 180 } },
  { id: "bambu-x1",   name: "Bambu Lab X1 / P1",   buildVolume: { x: 256, y: 256, z: 256 } },
  { id: "bambu-h2d",  name: "Bambu Lab H2D",       buildVolume: { x: 320, y: 320, z: 325 } },
  { id: "prusa-mk4",  name: "Prusa MK4 / MK4S",    buildVolume: { x: 250, y: 210, z: 220 } },
  { id: "prusa-core", name: "Prusa Core One",      buildVolume: { x: 250, y: 220, z: 270 } },
  { id: "ender-3",    name: "Creality Ender 3",    buildVolume: { x: 220, y: 220, z: 250 } },
  { id: "voron-2.4",  name: "Voron 2.4 (350mm)",   buildVolume: { x: 350, y: 350, z: 350 } },
];

export function dimensionsFromBBox(bb: THREE.Box3): { x: number; y: number; z: number } {
  const s = bb.getSize(new THREE.Vector3());
  return { x: s.x, y: s.y, z: s.z };
}

export function fitsInPrinter(dim: { x: number; y: number; z: number }, p: PrinterPreset): boolean {
  return dim.x <= p.buildVolume.x && dim.y <= p.buildVolume.y && dim.z <= p.buildVolume.z;
}
```

- [ ] **Step 3: Run test**

Run: `npm run test -- printer-presets.test.ts`
Expected: 3 passed.

- [ ] **Step 4: Commit**

```bash
git add src/lib/printer-presets.ts tests/printer-presets.test.ts
git commit -m "feat(m3): printer presets and fit math"
```

---

## Task 5: Printer panel and per-part fit status

**Files:**
- Create: `src/components/PrinterPanel.tsx`
- Modify: `src/lib/session.ts` (add `printer` to Session)
- Modify: `src/hooks/useCutSession.ts` (expose `setPrinter`)

- [ ] **Step 1: Extend Session**

Edit `src/lib/session.ts`:
```ts
import type { PrinterPreset } from "../types";
// in Session type:
//   printer: PrinterPreset | null
// in emptySession():
//   printer: null
// add export:
export function setPrinter(s: Session, p: PrinterPreset | null): Session {
  return { ...s, parts: new Map(s.parts), printer: p };
}
```

Update `cloneSession` to include the printer field.

- [ ] **Step 2: Expose `setPrinter` from the hook**

Edit `src/hooks/useCutSession.ts`:
```ts
import { setPrinter as setPrinterReducer } from "../lib/session";
// inside hook:
const setPrinter = useCallback((p: PrinterPreset | null) => setSession((s) => setPrinterReducer(s, p)), []);
return { ..., setPrinter };
```

- [ ] **Step 3: Implement PrinterPanel**

```tsx
import { PRINTER_PRESETS } from "../lib/printer-presets";
import type { PrinterPreset } from "../types";

type Props = {
  selected: PrinterPreset | null;
  onChange: (p: PrinterPreset | null) => void;
};

export function PrinterPanel({ selected, onChange }: Props) {
  return (
    <select
      className="border border-slate-300 rounded px-2 py-1 text-sm"
      value={selected?.id ?? ""}
      onChange={(e) => {
        const id = e.target.value;
        onChange(id === "" ? null : PRINTER_PRESETS.find((p) => p.id === id) ?? null);
      }}
    >
      <option value="">No printer</option>
      {PRINTER_PRESETS.map((p) => (
        <option key={p.id} value={p.id}>{p.name} ({p.buildVolume.x}×{p.buildVolume.y}×{p.buildVolume.z})</option>
      ))}
    </select>
  );
}
```

- [ ] **Step 4: Compute per-part fit status in StatusBar**

Edit `src/components/StatusBar.tsx`. Accept new optional props `parts`, `printer`. Compute how many visible non-dowel parts don't fit. Show: "All parts fit Bambu A1" green / "2 parts too big — Suggest cuts" amber-and-clickable / "Add a printer to check fit" gray. Wire the click to a callback prop `onSuggestCuts?` (filled in Task 6).

- [ ] **Step 5: Wire PrinterPanel into App.tsx Toolbar**

Add the PrinterPanel to the right side of the Toolbar. Pass `setPrinter`/`session.printer`.

- [ ] **Step 6: Verify typecheck and visual smoke**

Run: `npm run typecheck`. Run dev server. Load a model, switch printer in toolbar, verify status updates accordingly.

- [ ] **Step 7: Commit**

```bash
git add src/components/PrinterPanel.tsx src/components/StatusBar.tsx src/lib/session.ts src/hooks/useCutSession.ts src/App.tsx
git commit -m "feat(m3): printer panel and status bar fit indicator"
```

---

## Task 6: Fit-to-printer suggest

**Files:**
- Create: `src/lib/cut/fit-to-printer.ts`
- Create: `tests/cut/fit-to-printer.test.ts`

- [ ] **Step 1: Write test**

```ts
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { suggestCuts } from "../../src/lib/cut/fit-to-printer";

describe("suggestCuts", () => {
  it("returns one cut for a part that's 1.5× build volume on its longest axis", () => {
    const bb = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(300, 100, 100));
    const printer = { id: "p", name: "P", buildVolume: { x: 200, y: 200, z: 200 } };
    const cuts = suggestCuts(bb, printer);
    expect(cuts.length).toBe(1);
    expect(cuts[0].axisSnap).toBe("x");
    // Cut at midpoint of x extent
    expect(cuts[0].constant).toBeCloseTo(150, 1);
  });

  it("returns two cuts for a part 2.5× build volume", () => {
    const bb = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(500, 100, 100));
    const printer = { id: "p", name: "P", buildVolume: { x: 200, y: 200, z: 200 } };
    const cuts = suggestCuts(bb, printer);
    expect(cuts.length).toBe(2);
    expect(cuts[0].constant).toBeCloseTo(500 / 3, 1);
    expect(cuts[1].constant).toBeCloseTo((500 / 3) * 2, 1);
  });

  it("returns empty if part already fits", () => {
    const bb = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(100, 100, 100));
    const printer = { id: "p", name: "P", buildVolume: { x: 200, y: 200, z: 200 } };
    expect(suggestCuts(bb, printer)).toEqual([]);
  });
});
```

- [ ] **Step 2: Implement**

```ts
import * as THREE from "three";
import type { CutPlaneSpec, PrinterPreset } from "../../types";

/**
 * Given a part bbox and a printer, suggest a sequence of axis-aligned cuts that produce
 * pieces fitting within the build volume. Picks the longest axis, divides into N equal
 * slabs (N = ceil(extent / printerSize)).
 */
export function suggestCuts(bbox: THREE.Box3, printer: PrinterPreset): CutPlaneSpec[] {
  const size = bbox.getSize(new THREE.Vector3());
  const ratios: Array<{ axis: "x" | "y" | "z"; ratio: number; extent: number; min: number }> = [
    { axis: "x", ratio: size.x / printer.buildVolume.x, extent: size.x, min: bbox.min.x },
    { axis: "y", ratio: size.y / printer.buildVolume.y, extent: size.y, min: bbox.min.y },
    { axis: "z", ratio: size.z / printer.buildVolume.z, extent: size.z, min: bbox.min.z },
  ].sort((a, b) => b.ratio - a.ratio);

  const worst = ratios[0];
  if (worst.ratio <= 1) return [];

  const slabs = Math.ceil(worst.ratio);
  const cuts: CutPlaneSpec[] = [];
  const normal: [number, number, number] = worst.axis === "x" ? [1, 0, 0] : worst.axis === "y" ? [0, 1, 0] : [0, 0, 1];
  for (let i = 1; i < slabs; i++) {
    const constant = worst.min + (worst.extent * i) / slabs;
    cuts.push({ normal, constant, axisSnap: worst.axis });
  }
  return cuts;
}
```

- [ ] **Step 3: Run test**

Run: `npm run test -- cut/fit-to-printer.test.ts`
Expected: 3 passed.

- [ ] **Step 4: Add `performCutsSequential` to the session hook**

Sequential cuts can't use a `for` loop calling `performCut` — each `performCut` returns after a state update, and the next iteration would still see stale `session`. Add a dedicated method that runs the worker calls in series, applying each result before invoking the next:

Edit `src/hooks/useCutSession.ts` — add:

```ts
const performCutsSequential = useCallback(async (
  rootPartId: PartId,
  planes: CutPlaneSpec[],
  defaultDowelOpts: { count: number; diameter: number; length: number; tolerance: TolerancePreset },
) => {
  if (planes.length === 0) return;
  setBusy(true); setError(null);
  let working = session;
  let target = rootPartId;
  try {
    for (const plane of planes) {
      const part = working.parts.get(target);
      if (!part) throw new Error("Target part missing during sequential cuts");
      const dowels = autoPlaceCutDowels(part.mesh, plane, {
        count: defaultDowelOpts.count,
        dowelDiameter: defaultDowelOpts.diameter,
        length: defaultDowelOpts.length,
        minSpacing: 2,
      });
      const result = await runCut(part.mesh, plane, dowels, defaultDowelOpts.tolerance);
      const a = firstMeshAndGroup(result.partA);
      const b = firstMeshAndGroup(result.partB);
      if (!a || !b) throw new Error("Cut produced empty parts");
      const dps = result.dowelPieces.map(firstMeshAndGroup).filter((x): x is { mesh: THREE.Mesh; group: THREE.Group } => !!x);
      applyAutoOrient(a.mesh); applyAutoOrient(b.mesh); dps.forEach((d) => applyAutoOrient(d.mesh));
      working = applyCutResult(working, target, `c${working.cuts.length + 1}`, { partA: a, partB: b, dowelPieces: dps }, part.meta.name);
      // Continue cutting on the larger of the two new parts (the one most likely to still need further cuts)
      const partA = working.parts.get(`${target}_a`)!;
      const partB = working.parts.get(`${target}_b`)!;
      const sizeA = new THREE.Box3().setFromObject(partA.group).getSize(new THREE.Vector3()).length();
      const sizeB = new THREE.Box3().setFromObject(partB.group).getSize(new THREE.Vector3()).length();
      target = sizeA >= sizeB ? partA.id : partB.id;
    }
    push(working);
  } catch (e: any) {
    setError(e?.message ?? String(e));
  } finally { setBusy(false); }
}, [session]);
```

Add this to the hook's return value, plus the imports `import { autoPlaceCutDowels } from "../lib/cut/auto-place-cut-dowels";` and `import { applyAutoOrient } from "../lib/cut/auto-orient";`.

- [ ] **Step 5: Wire into App.tsx as a "Suggest cuts" modal**

Add state for `suggestedCuts`. When user clicks "Suggest cuts" link in StatusBar, compute cuts for the largest non-fitting visible part, store them in state, show a modal:

```tsx
const [suggestedCuts, setSuggestedCuts] = useState<{ partId: PartId; cuts: CutPlaneSpec[] } | null>(null);

// In handler for the StatusBar onSuggestCuts callback:
const onSuggestCuts = () => {
  if (!session.session.printer) return;
  const tooBig = session.partsArray.find((p) => p.meta.visible && !p.isDowel && !fitsInPrinter(dimensionsFromBBox(new THREE.Box3().setFromObject(p.group)), session.session.printer!));
  if (!tooBig) return;
  const cuts = suggestCuts(new THREE.Box3().setFromObject(tooBig.group), session.session.printer);
  setSuggestedCuts({ partId: tooBig.id, cuts });
};

{suggestedCuts && (
  <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
    <div className="bg-white rounded shadow p-4 max-w-md">
      <h3 className="font-semibold">Suggested cuts</h3>
      <p className="text-sm">Will add {suggestedCuts.cuts.length} cut(s) producing {suggestedCuts.cuts.length + 1} parts that fit your printer.</p>
      <div className="flex gap-2 mt-3">
        <button className="flex-1 py-2 bg-slate-200 rounded" onClick={() => setSuggestedCuts(null)}>Cancel</button>
        <button className="flex-1 py-2 bg-emerald-600 text-white rounded" onClick={async () => {
          await session.performCutsSequential(suggestedCuts.partId, suggestedCuts.cuts, { count: 4, diameter: 5, length: 20, tolerance: "pla-tight" });
          setSuggestedCuts(null);
        }}>Apply</button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/cut/fit-to-printer.ts tests/cut/fit-to-printer.test.ts src/hooks/useCutSession.ts src/App.tsx
git commit -m "feat(m3): fit-to-printer suggested cuts"
```

---

## Task 7: Multi-cut UI integration

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/CutPanel.tsx`

- [ ] **Step 1: Allow CutPanel to operate on the selected part**

Edit `src/App.tsx` so that CutPanel reads `session.selectedPartId` and computes its bbox. The performCut call passes `session.selectedPartId` as the target. After a cut, selection auto-moves to part A (already done by `applyCutResult`).

- [ ] **Step 2: Add PartsTree to App layout**

Place PartsTree to the left of the Viewer, CutPanel to the right (or above) it.

```tsx
<aside className="flex">
  <PartsTree
    parts={session.partsArray}
    selectedId={session.session.selectedPartId}
    onSelect={session.selectPartId}
    onToggleVisible={session.togglePartVisible}
  />
</aside>
```

- [ ] **Step 3: Verify multi-cut works**

Run: `npm run dev`. Manual:
1. Load cube → select Body in tree → cut → tree shows Body (hidden) + Body-A + Body-B
2. Select Body-A → cut → tree shows Body-A (hidden) + Body-A-A + Body-A-B
3. Toggle visibility on Body in tree → Body shows again (overlaps children visually)
4. Verify no duplicate keys in React console

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(m3): multi-cut workflow with PartsTree integration"
```

---

## Task 8: Undo/redo wiring

**Files:**
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add Undo / Redo buttons to Toolbar**

```tsx
type Props = {
  onOpen: () => void;
  onExport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canExport: boolean;
  canUndo: boolean;
  canRedo: boolean;
};

// in JSX, between Open and the right side:
<button className="px-3 py-1 bg-slate-100 rounded disabled:opacity-50" onClick={onUndo} disabled={!canUndo}>Undo</button>
<button className="px-3 py-1 bg-slate-100 rounded disabled:opacity-50" onClick={onRedo} disabled={!canRedo}>Redo</button>
```

- [ ] **Step 2: Wire from App**

```tsx
<Toolbar
  onOpen={...} onExport={...}
  onUndo={session.undo} onRedo={session.redo}
  canExport={...} canUndo={session.canUndo} canRedo={session.canRedo}
/>
```

- [ ] **Step 3: Smoke test**

Cut → Undo → confirm two halves disappear and original Body returns. Redo → halves return.

- [ ] **Step 4: Commit**

```bash
git add src/components/Toolbar.tsx src/App.tsx
git commit -m "feat(m3): undo/redo buttons in Toolbar"
```

---

## Task 9: Exploded view

**Files:**
- Create: `src/components/ExplodedView.tsx`
- Modify: `src/components/Viewer.tsx`
- Modify: `src/components/Toolbar.tsx`

- [ ] **Step 1: Implement ExplodedView (slider widget)**

```tsx
type Props = {
  value: number; // 0..1
  onChange: (v: number) => void;
};

export function ExplodedView({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-600">Explode</span>
      <input type="range" min={0} max={1} step={0.01} value={value} onChange={(e) => onChange(+e.target.value)} className="w-32" />
    </div>
  );
}
```

- [ ] **Step 2: Apply offset in Viewer**

In `Viewer.tsx`, accept `explodeFactor: number`. For each rendered cut part, compute its centroid relative to the overall scene centroid, then translate `centroid.normalize() × explodeFactor × bboxDiagonal × 0.5`. Don't translate dowels (they should appear to stay put — or translate them with their nearest part).

- [ ] **Step 3: Wire in App.tsx**

```tsx
const [explodeFactor, setExplodeFactor] = useState(0);
// pass explodeFactor to <Viewer />
// add <ExplodedView value={explodeFactor} onChange={setExplodeFactor} /> to Toolbar
```

- [ ] **Step 4: Smoke test**

Make a cut, drag explode slider — parts should separate visually. At 0, they should sit together perfectly.

- [ ] **Step 5: Commit**

```bash
git add src/components/ExplodedView.tsx src/components/Viewer.tsx src/App.tsx src/components/Toolbar.tsx
git commit -m "feat(m3): exploded view slider"
```

---

## Task 10: 3MF multi-object exporter

**Files:**
- Source: `/home/goodsmileduck/local/personal/3dlab/viewer-3d/src/lib/exporters/3mf.ts`
- Create: `src/lib/exporters/3mf.ts`
- Create: `tests/exporters/3mf.test.ts`

- [ ] **Step 1: Port file**

Copy from viewer-3d. The viewer-3d version exports a single mesh; we need to extend it to write multiple objects in a single 3MF.

- [ ] **Step 2: Adapt for multi-object**

Modify the exported function signature to accept an array of meshes and write them as separate `<object>` entries in the 3MF model XML, all referenced from a single `<build>`. Each object should have its own transform from the mesh's matrix.

Reference the 3MF schema via the existing viewer-3d test fixture (load it with `load3MF` to see what valid multi-object output looks like) or refer to https://github.com/3MFConsortium/spec_core.

- [ ] **Step 3: Write test**

```ts
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { exportToMulti3MF } from "../../src/lib/exporters/3mf";
import { load3MF } from "../../src/lib/loaders/3mf";

describe("exportToMulti3MF", () => {
  it("round-trips two cubes", async () => {
    const a = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10));
    const b = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 5));
    b.position.set(20, 0, 0);
    b.updateMatrix();
    const buf = exportToMulti3MF([
      { name: "A", mesh: a },
      { name: "B", mesh: b },
    ]);
    const reloaded = await load3MF(buf, "test.3mf");
    let count = 0;
    reloaded.traverse((o) => { if ((o as any).isMesh) count++; });
    expect(count).toBe(2);
  });
});
```

- [ ] **Step 4: Run test**

Run: `npm run test -- exporters/3mf.test.ts`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/exporters/3mf.ts tests/exporters/3mf.test.ts
git commit -m "feat(m3): 3MF multi-object exporter"
```

---

## Task 11: Export modal with format toggle

**Files:**
- Create: `src/components/ExportDialog.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Implement ExportDialog**

```tsx
import { useState } from "react";

type Props = {
  defaultFilename: string;
  onCancel: () => void;
  onConfirm: (opts: { format: "zip-stl" | "3mf"; includeDowels: boolean; autoOrient: boolean; filename: string }) => void;
};

export function ExportDialog({ defaultFilename, onCancel, onConfirm }: Props) {
  const [format, setFormat] = useState<"zip-stl" | "3mf">("zip-stl");
  const [includeDowels, setIncludeDowels] = useState(true);
  const [autoOrient, setAutoOrient] = useState(true);
  const [filename, setFilename] = useState(defaultFilename);

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded shadow p-4 w-96 space-y-3">
        <h3 className="font-semibold">Export</h3>
        <label className="block">
          <span className="text-sm">Format</span>
          <select className="block w-full border border-slate-300 rounded px-2 py-1 mt-1" value={format} onChange={(e) => setFormat(e.target.value as any)}>
            <option value="zip-stl">Zip of STL files (one per part)</option>
            <option value="3mf">Single 3MF (multi-object)</option>
          </select>
        </label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={includeDowels} onChange={(e) => setIncludeDowels(e.target.checked)} />Include dowels</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={autoOrient} onChange={(e) => setAutoOrient(e.target.checked)} />Auto-orient parts to Z=0</label>
        <label className="block">
          <span className="text-sm">Filename</span>
          <input className="block w-full border border-slate-300 rounded px-2 py-1 mt-1" value={filename} onChange={(e) => setFilename(e.target.value)} />
        </label>
        <div className="flex gap-2 mt-4">
          <button className="flex-1 py-2 bg-slate-200 rounded" onClick={onCancel}>Cancel</button>
          <button className="flex-1 py-2 bg-emerald-600 text-white rounded" onClick={() => onConfirm({ format, includeDowels, autoOrient, filename })}>Export</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire into App.tsx**

Replace the immediate-zip Export button handler with a state toggle: `setShowExportDialog(true)`. The dialog's `onConfirm` does the actual export — `format === "zip-stl"` calls `buildZipExport`, `format === "3mf"` calls `exportToMulti3MF`. Filename suffix `.zip` or `.3mf`. If `autoOrient: false`, skip the auto-orient pre-pass for export.

Note: by Task 3, parts are already auto-oriented in the scene. The "Auto-orient on export" toggle is a re-orient pass that runs only on the export-time copies (don't mutate scene meshes here). For v1 simplicity, ignore the toggle when scene parts are already auto-oriented — leave the checkbox in the UI but document this in `docs/m3-smoke-test.md`. The toggle exists for future-proofing when we allow disabling auto-orient post-cut.

- [ ] **Step 3: Smoke test**

Make a cut → Export → choose 3MF → download → re-import file with DropZone. Should show all parts.

- [ ] **Step 4: Commit**

```bash
git add src/components/ExportDialog.tsx src/App.tsx
git commit -m "feat(m3): export dialog with format toggle and 3MF support"
```

---

## Task 12: Keyboard shortcuts and HelpOverlay

**Files:**
- Source: `/home/goodsmileduck/local/personal/3dlab/viewer-3d/src/components/HelpOverlay.tsx`
- Create: `src/hooks/useKeyboard.ts`
- Create: `src/components/HelpOverlay.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Port HelpOverlay**

Copy `viewer-3d/src/components/HelpOverlay.tsx` → `pasak/src/components/HelpOverlay.tsx`. Replace the shortcut list with Pasak's:

| Key | Action |
|---|---|
| O | Open file |
| X / Y / Z | Start cut on selected axis |
| Enter | Confirm cut |
| Esc | Cancel cut / close modal |
| Ctrl+Z / Ctrl+Shift+Z | Undo / redo |
| H | Toggle build plate |
| E | Toggle exploded view (or focus the slider) |
| Ctrl+E | Open export dialog |
| ? | Toggle help overlay |

- [ ] **Step 2: Create useKeyboard hook**

```ts
import { useEffect } from "react";

type Handlers = Partial<Record<string, () => void>>;

export function useKeyboard(handlers: Handlers, deps: any[] = []) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Skip when focused in an input
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return;
      const key = [
        e.ctrlKey || e.metaKey ? "Ctrl+" : "",
        e.shiftKey ? "Shift+" : "",
        e.altKey ? "Alt+" : "",
        e.key,
      ].join("");
      const norm = key.replace(/Ctrl\+Shift\+/, "Ctrl+Shift+");
      const handler = handlers[norm] ?? handlers[e.key];
      if (handler) {
        e.preventDefault();
        handler();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
```

- [ ] **Step 3: Lift cut-axis state into App.tsx**

CutPanel previously owned its own `axis` state. Lift it into App.tsx so keyboard shortcuts can drive it. Add:

```tsx
const [pendingCutAxis, setPendingCutAxis] = useState<"x" | "y" | "z">("x");
const startCut = (axis: "x" | "y" | "z") => {
  setPendingCutAxis(axis);
  setShowCutPanel(true);
};
```

Pass `axis={pendingCutAxis}` and `onAxisChange={setPendingCutAxis}` to `<CutPanel>`. Inside `CutPanel.tsx`, replace the local `axis` state with the controlled prop:

```tsx
type Props = {
  axis: "x" | "y" | "z";
  onAxisChange: (a: "x" | "y" | "z") => void;
  // ...other props
};
// remove: const [axis, setAxis] = useState(initialAxis);
// in axis button onClick: onAxisChange(a) instead of setAxis(a)
```

- [ ] **Step 4: Wire shortcuts in App.tsx**

```tsx
const [showHelp, setShowHelp] = useState(false);

const triggerCut = () => {
  if (!showCutPanel) return;
  // The CutPanel "Cut" button is the source of truth; expose a ref or state callback.
  // Simplest: lift the dowel/tolerance defaults into App and call session.performCut directly.
  if (!session.session.selectedPartId) return;
  const target = session.partsArray.find((p) => p.id === session.session.selectedPartId);
  if (!target) return;
  const plane: CutPlaneSpec = {
    normal: pendingCutAxis === "x" ? [1, 0, 0] : pendingCutAxis === "y" ? [0, 1, 0] : [0, 0, 1],
    constant: pendingCutPosition,
    axisSnap: pendingCutAxis,
  };
  const dowels = autoPlaceCutDowels(target.mesh, plane, { count: 4, dowelDiameter: 5, length: 20, minSpacing: 2 });
  session.performCut(target.id, plane, dowels, "pla-tight");
};

useKeyboard({
  "o": () => fileInputRef.current?.click(),
  "x": () => startCut("x"),
  "y": () => startCut("y"),
  "z": () => startCut("z"),
  "Enter": triggerCut,
  "Escape": () => { setShowCutPanel(false); setShowExportDialog(false); setShowHelp(false); },
  "Ctrl+z": () => session.undo(),
  "Ctrl+Shift+Z": () => session.redo(),
  "Ctrl+e": () => setShowExportDialog(true),
  "?": () => setShowHelp((s) => !s),
}, [session, showCutPanel, pendingCutAxis, pendingCutPosition]);
```

`pendingCutPosition` is similarly lifted from CutPanel into App.tsx as part of this refactor — initialize it to the centroid of the selected part on `startCut`.

- [ ] **Step 5: Render HelpOverlay**

Add `{showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}` to App.

- [ ] **Step 6: Smoke test**

Press `?` → overlay shows. Press Esc → closes. Press Ctrl+Z after a cut → undo works. Press X with a part selected → CutPanel opens with X axis pre-selected.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useKeyboard.ts src/components/HelpOverlay.tsx src/App.tsx
git commit -m "feat(m3): keyboard shortcuts and help overlay"
```

---

## Task 13: Polished error states

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace inline error toast with error-class-aware UI**

Categorize errors from `session.error`:
- "does not intersect" → toast: "Cut plane doesn't intersect the part. Try repositioning."
- "out of memory" / Manifold crash → modal: "Cut failed (out of memory). For meshes this large, try the desktop version."
- non-manifold mesh import → modal at import: "This mesh has gaps and can't be cut reliably. Try repairing it in your CAD/slicer first."

Implement as a small `<ErrorToast>` and `<ErrorModal>` component, conditionally rendered based on the error string pattern.

- [ ] **Step 2: Smoke test**

Drag plane outside mesh → cut → toast appears. Close cleanly.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(m3): polished error toast and modal classes"
```

---

## Task 14: Empty state polish

**Files:**
- Modify: `src/components/DropZone.tsx`

- [ ] **Step 1: Update DropZone empty state**

```tsx
// At the bottom of DropZone, add a sample file link:
<button className="text-sm text-blue-600 underline mt-3" onClick={async () => {
  const res = await fetch("/sample-keycap.3mf");
  const blob = await res.blob();
  onFile(new File([blob], "sample-keycap.3mf"));
}}>Try with a sample model</button>
```

Copy `tests/fixtures/sample.3mf` → `public/sample-keycap.3mf` so it's served as a static asset.

- [ ] **Step 2: Smoke test**

Open app fresh → click "Try with a sample model" → keycap loads and CutPanel appears.

- [ ] **Step 3: Commit**

```bash
git add src/components/DropZone.tsx public/sample-keycap.3mf
git commit -m "feat(m3): sample model link on empty state"
```

---

## Task 15: M3 acceptance — smoke test

**Files:**
- Create: `docs/m3-smoke-test.md`

- [ ] **Step 1: Document checks**

```markdown
# M3 Smoke Test Checklist

- [ ] All M2 checks still pass
- [ ] `npm run test` passes
- [ ] `npm run build` succeeds
- [ ] PartsTree renders, hierarchy expands/collapses correctly
- [ ] Visibility checkboxes hide/show parts in scene
- [ ] Selection in PartsTree highlights part in scene (and selects it for next cut)
- [ ] Multi-cut: cut Body → cut Body-A → tree shows full lineage with hidden parents
- [ ] Auto-orient: each new part sits on Z=0 in the scene
- [ ] Undo: removes last cut, restores parent visibility
- [ ] Redo: re-applies the cut
- [ ] Printer dropdown lists Bambu, Prusa, Ender, Voron
- [ ] StatusBar updates with fit status when printer changes
- [ ] When a part doesn't fit: amber warning + "Suggest cuts" link
- [ ] Click "Suggest cuts" → modal previews count → Apply → cuts execute → all parts fit
- [ ] Exploded view slider separates parts smoothly
- [ ] Export → format toggle works → both zip-stl and 3mf produce valid files
- [ ] Re-import exported 3MF → all parts present
- [ ] Re-import exported zip → not supported (zip isn't a 3D format) — verify error toast
- [ ] Keyboard shortcuts work: O, X/Y/Z, Esc, Ctrl+Z/Ctrl+Shift+Z, ?, Ctrl+E
- [ ] Help overlay shows all shortcuts
- [ ] Cut plane outside mesh → friendly error toast
- [ ] Sample model link on empty state loads keycap
```

- [ ] **Step 2: Walk through, fix failures**

- [ ] **Step 3: Commit**

```bash
git add docs/m3-smoke-test.md
git commit -m "docs: M3 smoke test checklist"
```

---

## M3 Done

Pasak v1 web feature set complete. Next: M4 wraps the desktop shell, sets up GitHub Actions, and ships to `pasak.3dlab.id`.
