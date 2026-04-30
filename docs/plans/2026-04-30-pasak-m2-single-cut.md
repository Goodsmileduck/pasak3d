# Pasak M2 — Single-Cut MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Prerequisite:** M1 complete (foundation + viewer working).

**Goal:** User can load a model, define one cut plane along an axis, see auto-placed dowels (with manual override), execute the cut, and download a zip containing the two halves plus separate dowel pieces.

**Architecture:** Manifold-3d WASM runs in a Web Worker (`cut-worker.ts`) so the main thread stays responsive. Pure functions in `src/lib/cut/` are tested directly in Node (Manifold works server-side), then composed in the worker. UI uses an R3F gizmo for the cut plane and HTML overlay handles for dowel markers.

**Tech Stack:** Adds `manifold-3d` (WASM) on top of M1 stack. Reuses `fflate` for ZIP packaging.

**Working directory for all commands:** `/home/goodsmileduck/local/personal/3dlab/pasak/`

---

## Task 1: Install Manifold and extend types

**Files:**
- Modify: `package.json`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Install manifold-3d**

Run: `npm install manifold-3d@^3.0.0`
(Use latest 3.x available. If install fails, check https://www.npmjs.com/package/manifold-3d for current version.)

- [ ] **Step 2: Extend `src/types/index.ts` with Pasak domain types**

Append to existing file:
```ts
export type PartId = string;
export type CutId = string;

export type TolerancePreset = "pla-tight" | "pla-loose" | "petg" | "sla";

/**
 * Radial clearance per hole, in mm.
 * Hole radius = dowel radius + clearance. Both halves get the same clearance,
 * so total play between halves = 2 × value.
 */
export const TOLERANCE_VALUES: Record<TolerancePreset, number> = {
  "pla-tight": 0.10,
  "pla-loose": 0.20,
  "petg":      0.25,
  "sla":       0.05,
};

export type Dowel = {
  id: string;
  position: [number, number, number]; // world-space, on the cut plane
  axis: [number, number, number];     // unit normal of the cut plane
  diameter: number;                    // mm
  length: number;                      // mm (extends symmetrically across plane)
  source: "auto" | "manual";
};

export type CutPlaneSpec = {
  normal: [number, number, number]; // unit vector
  constant: number;                  // signed distance from origin
  axisSnap: "x" | "y" | "z" | "free";
};

export type Part = {
  id: PartId;
  name: string;
  source: "import" | "cut";
  parentId: PartId | null;
  cutId: CutId | null;
  visible: boolean;
  color: string;
  triCount: number;
};

export type Cut = {
  id: CutId;
  partId: PartId;
  plane: CutPlaneSpec;
  dowels: Dowel[];
  tolerance: TolerancePreset;
  resultPartIds: [PartId, PartId];
  createdAt: number;
};
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/types/index.ts
git commit -m "feat(m2): install manifold-3d and add cut/dowel domain types"
```

---

## Task 2: Manifold initialization helper

**Files:**
- Create: `src/lib/cut/manifold.ts`
- Create: `tests/cut/manifold.test.ts`

- [ ] **Step 1: Write test**

```ts
import { describe, it, expect } from "vitest";
import { initManifold } from "../../src/lib/cut/manifold";

describe("initManifold", () => {
  it("returns a working Manifold module", async () => {
    const M = await initManifold();
    expect(M).toBeDefined();
    expect(typeof M.Manifold).toBe("function");
    const cube = M.Manifold.cube([10, 10, 10], true);
    expect(cube.numVert()).toBeGreaterThan(0);
    cube.delete();
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `npm run test -- cut/manifold.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/cut/manifold.ts`**

```ts
import Module from "manifold-3d";

let modulePromise: Promise<Awaited<ReturnType<typeof Module>>> | null = null;

/**
 * Initialize the Manifold WASM module. Cached after first call.
 * Safe to call from main thread (in tests/Node) and from a Web Worker.
 */
export function initManifold() {
  if (!modulePromise) {
    modulePromise = (async () => {
      const m = await Module();
      m.setup();
      return m;
    })();
  }
  return modulePromise;
}

/** For tests: forget the cached module so a fresh init can run. */
export function _resetManifoldCache() {
  modulePromise = null;
}
```

- [ ] **Step 4: Run test**

Run: `npm run test -- cut/manifold.test.ts`
Expected: 1 passed. (If Node fails to load WASM, ensure `manifold-3d` package version supports Node ≥ 20.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/cut/manifold.ts tests/cut/manifold.test.ts
git commit -m "feat(m2): add Manifold WASM initializer"
```

---

## Task 3: Mesh ↔ Manifold conversion helpers

**Files:**
- Create: `src/lib/cut/convert.ts`
- Create: `tests/cut/convert.test.ts`

- [ ] **Step 1: Write test**

```ts
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { initManifold } from "../../src/lib/cut/manifold";
import { meshToManifold, manifoldToMesh } from "../../src/lib/cut/convert";

describe("convert", () => {
  it("round-trips a cube through Manifold", async () => {
    const M = await initManifold();
    const geom = new THREE.BoxGeometry(10, 10, 10);
    const mesh = new THREE.Mesh(geom);
    const man = meshToManifold(M, mesh);
    expect(man.volume()).toBeCloseTo(1000, 1);
    const back = manifoldToMesh(man);
    const bbox = new THREE.Box3().setFromObject(back);
    expect(bbox.max.x - bbox.min.x).toBeCloseTo(10, 5);
    man.delete();
  });
});
```

- [ ] **Step 2: Implement `src/lib/cut/convert.ts`**

```ts
import * as THREE from "three";

/** Convert a THREE.Mesh (must have indexed BufferGeometry) into a Manifold. */
export function meshToManifold(M: any, mesh: THREE.Mesh): any {
  const geom = mesh.geometry as THREE.BufferGeometry;
  geom.applyMatrix4(mesh.matrixWorld);
  let indexed = geom;
  if (!geom.index) {
    indexed = (geom as any).toNonIndexed();
  }
  const positions = indexed.attributes.position.array as Float32Array;
  const indices = indexed.index
    ? new Uint32Array(indexed.index.array)
    : new Uint32Array(positions.length / 3).map((_, i) => i);

  const manMesh = new M.Mesh({
    numProp: 3,
    vertProperties: positions,
    triVerts: indices,
  });
  return new M.Manifold(manMesh);
}

/** Convert a Manifold result into a THREE.Group containing one Mesh. */
export function manifoldToMesh(man: any): THREE.Group {
  const meshOut = man.getMesh();
  const geom = new THREE.BufferGeometry();
  geom.setAttribute(
    "position",
    new THREE.BufferAttribute(meshOut.vertProperties, 3),
  );
  geom.setIndex(new THREE.BufferAttribute(meshOut.triVerts, 1));
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  const mesh = new THREE.Mesh(geom);
  const group = new THREE.Group();
  group.add(mesh);
  return group;
}
```

- [ ] **Step 3: Run test**

Run: `npm run test -- cut/convert.test.ts`
Expected: 1 passed.

- [ ] **Step 4: Commit**

```bash
git add src/lib/cut/convert.ts tests/cut/convert.test.ts
git commit -m "feat(m2): mesh ↔ Manifold conversion helpers"
```

---

## Task 4: Plane cut

**Files:**
- Create: `src/lib/cut/plane-cut.ts`
- Create: `tests/cut/plane-cut.test.ts`

- [ ] **Step 1: Write test**

```ts
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { initManifold } from "../../src/lib/cut/manifold";
import { planeCutMesh } from "../../src/lib/cut/plane-cut";

describe("planeCutMesh", () => {
  it("cuts a 10mm cube in half along X", async () => {
    const M = await initManifold();
    const geom = new THREE.BoxGeometry(10, 10, 10);
    const mesh = new THREE.Mesh(geom);
    const result = await planeCutMesh(M, mesh, {
      normal: [1, 0, 0],
      constant: 0,
      axisSnap: "x",
    });
    expect(result.partA.volume).toBeCloseTo(500, 0);
    expect(result.partB.volume).toBeCloseTo(500, 0);
  });

  it("returns nearly the whole part on one side when plane is at edge", async () => {
    const M = await initManifold();
    const geom = new THREE.BoxGeometry(10, 10, 10);
    const mesh = new THREE.Mesh(geom);
    const result = await planeCutMesh(M, mesh, {
      normal: [1, 0, 0],
      constant: 4.99,
      axisSnap: "x",
    });
    expect(result.partA.volume).toBeGreaterThan(990);
    expect(result.partB.volume).toBeLessThan(10);
  });

  it("throws when plane misses the mesh entirely", async () => {
    const M = await initManifold();
    const geom = new THREE.BoxGeometry(10, 10, 10);
    const mesh = new THREE.Mesh(geom);
    await expect(
      planeCutMesh(M, mesh, { normal: [1, 0, 0], constant: 100, axisSnap: "x" }),
    ).rejects.toThrow(/does not intersect/i);
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `npm run test -- cut/plane-cut.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/cut/plane-cut.ts`**

```ts
import * as THREE from "three";
import type { CutPlaneSpec } from "../../types";
import { meshToManifold } from "./convert";

export type PlaneCutResult = {
  partA: { manifold: any; volume: number }; // side where (normal · p - constant) >= 0
  partB: { manifold: any; volume: number }; // opposite side
};

/**
 * Cut a mesh with a plane. Returns two Manifolds.
 * Caller is responsible for calling .delete() on each manifold when done.
 */
export async function planeCutMesh(
  M: any,
  mesh: THREE.Mesh,
  plane: CutPlaneSpec,
): Promise<PlaneCutResult> {
  const m = meshToManifold(M, mesh);
  const [n0, n1, n2] = plane.normal;

  // Manifold.split(normal, originOffset) returns [first, second]
  // where `first` is on the negative side (normal · p < originOffset)
  // and `second` is on the positive side.
  // Pasak convention: partA = positive side, partB = negative side.
  const [neg, pos] = m.split([n0, n1, n2], plane.constant);
  m.delete();

  const volA = pos.volume();
  const volB = neg.volume();
  if (volA < 1e-3 || volB < 1e-3) {
    pos.delete();
    neg.delete();
    throw new Error("Cut plane does not intersect the part.");
  }

  return {
    partA: { manifold: pos, volume: volA },
    partB: { manifold: neg, volume: volB },
  };
}
```

- [ ] **Step 4: Run test**

Run: `npm run test -- cut/plane-cut.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cut/plane-cut.ts tests/cut/plane-cut.test.ts
git commit -m "feat(m2): plane cut producing two Manifold halves"
```

---

## Task 5: Cut polygon extraction (for dowel placement)

**Files:**
- Create: `src/lib/cut/cut-polygon.ts`
- Create: `tests/cut/cut-polygon.test.ts`

- [ ] **Step 1: Write test**

```ts
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { extractCutPolygon } from "../../src/lib/cut/cut-polygon";

describe("extractCutPolygon", () => {
  it("returns the cross-section polygon of a cube cut at x=0", () => {
    const geom = new THREE.BoxGeometry(10, 10, 10);
    const mesh = new THREE.Mesh(geom);
    const plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
    const polys = extractCutPolygon(mesh, plane);
    // Should produce one closed loop with 4 segments (a square)
    expect(polys.length).toBeGreaterThan(0);
    const totalVerts = polys.reduce((s, p) => s + p.length, 0);
    expect(totalVerts).toBeGreaterThanOrEqual(4);
  });

  it("returns empty when plane misses mesh", () => {
    const geom = new THREE.BoxGeometry(10, 10, 10);
    const mesh = new THREE.Mesh(geom);
    const plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), -100);
    expect(extractCutPolygon(mesh, plane)).toEqual([]);
  });
});
```

- [ ] **Step 2: Implement `src/lib/cut/cut-polygon.ts`**

```ts
import * as THREE from "three";

/**
 * Extract closed 2D polygons (in plane-local coords) where the plane intersects the mesh.
 * Uses three-mesh-bvh's intersectsBox / classification approach via simple triangle-plane intersection.
 *
 * Returns one or more polygons (a mesh with holes produces multiple).
 * Coordinates are in the plane's local 2D frame:
 *   u = an orthogonal axis to the plane normal
 *   v = normal × u
 */
export function extractCutPolygon(
  mesh: THREE.Mesh,
  plane: THREE.Plane,
): Array<Array<[number, number]>> {
  const geom = mesh.geometry as THREE.BufferGeometry;
  const pos = geom.attributes.position.array as Float32Array;
  const idx = geom.index?.array as Uint32Array | undefined;

  const triCount = idx ? idx.length / 3 : pos.length / 9;
  const segments: Array<[THREE.Vector3, THREE.Vector3]> = [];

  const v0 = new THREE.Vector3();
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();

  for (let t = 0; t < triCount; t++) {
    const ia = idx ? idx[t * 3] : t * 3;
    const ib = idx ? idx[t * 3 + 1] : t * 3 + 1;
    const ic = idx ? idx[t * 3 + 2] : t * 3 + 2;
    v0.fromArray(pos, ia * 3);
    v1.fromArray(pos, ib * 3);
    v2.fromArray(pos, ic * 3);
    const seg = triPlaneSegment(v0, v1, v2, plane);
    if (seg) segments.push(seg);
  }

  if (segments.length === 0) return [];

  // Build local 2D frame
  const n = plane.normal.clone().normalize();
  const u = Math.abs(n.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  u.sub(n.clone().multiplyScalar(n.dot(u))).normalize();
  const v = new THREE.Vector3().crossVectors(n, u);
  const origin = n.clone().multiplyScalar(-plane.constant);

  const project = (p: THREE.Vector3): [number, number] => {
    const d = p.clone().sub(origin);
    return [d.dot(u), d.dot(v)];
  };

  // Stitch segments into closed loops by matching endpoints
  const loops: Array<Array<[number, number]>> = [];
  const remaining = segments.map(([a, b]) => [project(a), project(b)] as [[number, number], [number, number]]);
  const eq = (p: [number, number], q: [number, number]) =>
    Math.abs(p[0] - q[0]) < 1e-4 && Math.abs(p[1] - q[1]) < 1e-4;

  while (remaining.length > 0) {
    const seed = remaining.shift()!;
    const loop: Array<[number, number]> = [seed[0], seed[1]];
    let extended = true;
    while (extended) {
      extended = false;
      for (let i = 0; i < remaining.length; i++) {
        const [a, b] = remaining[i];
        const tail = loop[loop.length - 1];
        if (eq(tail, a)) { loop.push(b); remaining.splice(i, 1); extended = true; break; }
        if (eq(tail, b)) { loop.push(a); remaining.splice(i, 1); extended = true; break; }
      }
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}

function triPlaneSegment(
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  plane: THREE.Plane,
): [THREE.Vector3, THREE.Vector3] | null {
  const da = plane.distanceToPoint(a);
  const db = plane.distanceToPoint(b);
  const dc = plane.distanceToPoint(c);

  const points: THREE.Vector3[] = [];
  if ((da > 0) !== (db > 0)) points.push(intersect(a, b, da, db));
  if ((db > 0) !== (dc > 0)) points.push(intersect(b, c, db, dc));
  if ((dc > 0) !== (da > 0)) points.push(intersect(c, a, dc, da));

  if (points.length === 2) return [points[0], points[1]];
  return null;
}

function intersect(p: THREE.Vector3, q: THREE.Vector3, dp: number, dq: number): THREE.Vector3 {
  const t = dp / (dp - dq);
  return new THREE.Vector3(
    p.x + (q.x - p.x) * t,
    p.y + (q.y - p.y) * t,
    p.z + (q.z - p.z) * t,
  );
}
```

- [ ] **Step 3: Run test**

Run: `npm run test -- cut/cut-polygon.test.ts`
Expected: 2 passed.

- [ ] **Step 4: Commit**

```bash
git add src/lib/cut/cut-polygon.ts tests/cut/cut-polygon.test.ts
git commit -m "feat(m2): extract 2D cut polygons from mesh-plane intersection"
```

---

## Task 6: Auto-place dowels on a polygon

**Files:**
- Create: `src/lib/cut/dowel-place.ts`
- Create: `tests/cut/dowel-place.test.ts`

- [ ] **Step 1: Write test**

```ts
import { describe, it, expect } from "vitest";
import { autoPlaceDowels } from "../../src/lib/cut/dowel-place";

describe("autoPlaceDowels", () => {
  const square: Array<[number, number]> = [
    [-5, -5], [5, -5], [5, 5], [-5, 5], [-5, -5],
  ];

  it("places requested count when polygon is large enough", () => {
    const dowels = autoPlaceDowels([square], { count: 4, dowelDiameter: 5, minSpacing: 2 });
    expect(dowels.length).toBe(4);
    for (const d of dowels) {
      expect(d[0]).toBeGreaterThan(-5);
      expect(d[0]).toBeLessThan(5);
      expect(d[1]).toBeGreaterThan(-5);
      expect(d[1]).toBeLessThan(5);
    }
  });

  it("respects min spacing between dowels", () => {
    const dowels = autoPlaceDowels([square], { count: 8, dowelDiameter: 4, minSpacing: 1 });
    for (let i = 0; i < dowels.length; i++) {
      for (let j = i + 1; j < dowels.length; j++) {
        const dx = dowels[i][0] - dowels[j][0];
        const dy = dowels[i][1] - dowels[j][1];
        const dist = Math.sqrt(dx * dx + dy * dy);
        expect(dist).toBeGreaterThanOrEqual(4 + 1 - 0.01);
      }
    }
  });

  it("places fewer than requested when polygon is too small", () => {
    const tiny: Array<[number, number]> = [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]];
    const dowels = autoPlaceDowels([tiny], { count: 10, dowelDiameter: 5, minSpacing: 1 });
    expect(dowels.length).toBeLessThan(10);
  });
});
```

- [ ] **Step 2: Implement `src/lib/cut/dowel-place.ts`**

```ts
type Point = [number, number];

export type DowelPlaceOptions = {
  count: number;
  dowelDiameter: number;   // mm
  minSpacing: number;       // mm — additional gap beyond dowel radius
};

/**
 * Auto-place dowels inside a 2D polygon (with optional holes).
 * Strategy: bbox-bounded jittered grid, filtered by point-in-polygon and pairwise spacing.
 * Returns up to `count` positions, fewer if the polygon can't fit them all.
 *
 * Polygons[0] is the outer boundary (CCW). Additional entries are holes.
 * Coordinates are 2D (in cut-plane local frame).
 */
export function autoPlaceDowels(
  polygons: Array<Array<Point>>,
  opts: DowelPlaceOptions,
): Point[] {
  if (polygons.length === 0) return [];
  const outer = polygons[0];
  const holes = polygons.slice(1);
  const minDist = opts.dowelDiameter + opts.minSpacing;
  const inset = opts.dowelDiameter / 2;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of outer) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  // Inset bbox so dowels don't touch edges
  minX += inset; maxX -= inset; minY += inset; maxY -= inset;
  if (maxX <= minX || maxY <= minY) return [];

  // Try a sequence of grid resolutions; keep growing density until we find `count` valid spots.
  const placed: Point[] = [];
  const tryGrid = (cellsX: number, cellsY: number) => {
    for (let iy = 0; iy < cellsY && placed.length < opts.count; iy++) {
      for (let ix = 0; ix < cellsX && placed.length < opts.count; ix++) {
        const x = minX + ((ix + 0.5) * (maxX - minX)) / cellsX;
        const y = minY + ((iy + 0.5) * (maxY - minY)) / cellsY;
        if (!pointInPolygon([x, y], outer)) continue;
        if (holes.some((h) => pointInPolygon([x, y], h))) continue;
        if (placed.some((p) => Math.hypot(p[0] - x, p[1] - y) < minDist)) continue;
        placed.push([x, y]);
      }
    }
  };
  // Increase density until we hit the target or top out
  for (let n = 2; n <= 16 && placed.length < opts.count; n++) {
    placed.length = 0;
    tryGrid(n, n);
  }
  return placed.slice(0, opts.count);
}

function pointInPolygon(p: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    if (((yi > p[1]) !== (yj > p[1])) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi + 1e-12) + xi) {
      inside = !inside;
    }
  }
  return inside;
}
```

- [ ] **Step 3: Run test**

Run: `npm run test -- cut/dowel-place.test.ts`
Expected: 3 passed.

- [ ] **Step 4: Commit**

```bash
git add src/lib/cut/dowel-place.ts tests/cut/dowel-place.test.ts
git commit -m "feat(m2): auto-place dowels in cut polygon via grid sampling"
```

---

## Task 7: Apply dowels (subtract holes, build dowel pieces)

**Files:**
- Create: `src/lib/cut/dowel-apply.ts`
- Create: `tests/cut/dowel-apply.test.ts`

- [ ] **Step 1: Write test**

```ts
import { describe, it, expect } from "vitest";
import { initManifold } from "../../src/lib/cut/manifold";
import { applyDowels, buildDowelPiece } from "../../src/lib/cut/dowel-apply";
import type { Dowel } from "../../src/types";

describe("applyDowels", () => {
  it("subtracts hole cylinders from both halves and produces matching dowel pieces", async () => {
    const M = await initManifold();
    const cubeA = M.Manifold.cube([10, 10, 5], true).translate([0, 0, 2.5]); // top
    const cubeB = M.Manifold.cube([10, 10, 5], true).translate([0, 0, -2.5]); // bottom
    const dowels: Dowel[] = [{
      id: "d1",
      position: [0, 0, 0],
      axis: [0, 0, 1],
      diameter: 4,
      length: 10,
      source: "auto",
    }];
    const result = applyDowels(M, cubeA, cubeB, dowels, 0.10);

    const expectedHoleVol = Math.PI * Math.pow((4 / 2) + 0.10, 2) * 5; // half-length per side
    expect(cubeA.volume()).toBeCloseTo(500, 0); // unchanged
    expect(result.partA.volume()).toBeCloseTo(500 - expectedHoleVol, 0);
    expect(result.partB.volume()).toBeCloseTo(500 - expectedHoleVol, 0);
    expect(result.dowelPieces.length).toBe(1);

    const piece = result.dowelPieces[0];
    const expectedPieceVol = Math.PI * Math.pow(4 / 2, 2) * 10;
    expect(piece.volume()).toBeCloseTo(expectedPieceVol, 0);

    cubeA.delete(); cubeB.delete();
    result.partA.delete(); result.partB.delete();
    piece.delete();
  });
});

describe("buildDowelPiece", () => {
  it("creates a cylinder of the dowel's nominal diameter", async () => {
    const M = await initManifold();
    const piece = buildDowelPiece(M, {
      id: "d1",
      position: [0, 0, 0],
      axis: [0, 0, 1],
      diameter: 5,
      length: 20,
      source: "auto",
    });
    const expected = Math.PI * Math.pow(2.5, 2) * 20;
    expect(piece.volume()).toBeCloseTo(expected, 0);
    piece.delete();
  });
});
```

- [ ] **Step 2: Implement `src/lib/cut/dowel-apply.ts`**

```ts
import type { Dowel } from "../../types";

export type ApplyDowelsResult = {
  partA: any; // Manifold (input partA with holes subtracted)
  partB: any; // Manifold
  dowelPieces: any[]; // Manifold[] — one per dowel, sized to the nominal diameter
};

/**
 * Build a hole cylinder (sized = dowel radius + clearance) and a peg cylinder (nominal radius).
 * Subtract the hole from both partA and partB; emit the peg as a separate dowel piece.
 *
 * `tolerance` is radial clearance per hole, in mm.
 * Caller owns lifetimes of the input manifolds and result manifolds.
 */
export function applyDowels(
  M: any,
  partA: any,
  partB: any,
  dowels: Dowel[],
  tolerance: number,
): ApplyDowelsResult {
  let outA = partA;
  let outB = partB;
  const dowelPieces: any[] = [];

  for (const d of dowels) {
    const hole = buildCylinder(M, d.diameter / 2 + tolerance, d.length, d.position, d.axis);
    const newA = outA.subtract(hole);
    const newB = outB.subtract(hole);
    if (outA !== partA) outA.delete();
    if (outB !== partB) outB.delete();
    outA = newA;
    outB = newB;
    hole.delete();
    dowelPieces.push(buildDowelPiece(M, d));
  }
  return { partA: outA, partB: outB, dowelPieces };
}

/** Build a cylinder centered at `position`, oriented along `axis`, with given length. */
function buildCylinder(
  M: any,
  radius: number,
  length: number,
  position: [number, number, number],
  axis: [number, number, number],
): any {
  const cyl = M.Manifold.cylinder(length, radius, radius, 32, true);
  // Default cylinder is along Z axis. Rotate to match axis, then translate.
  const [ax, ay, az] = axis;
  const zUp: [number, number, number] = [0, 0, 1];
  const rot = rotationFromTo(zUp, [ax, ay, az]);
  return cyl.transform(rot).translate(position);
}

export function buildDowelPiece(M: any, d: Dowel): any {
  return buildCylinder(M, d.diameter / 2, d.length, d.position, d.axis);
}

/** 4x3 row-major matrix for rotation that maps `from` unit vector to `to` unit vector. */
function rotationFromTo(
  from: [number, number, number],
  to: [number, number, number],
): number[] {
  const [fx, fy, fz] = normalize(from);
  const [tx, ty, tz] = normalize(to);
  const dot = fx * tx + fy * ty + fz * tz;
  if (dot > 0.99999) {
    return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]; // identity
  }
  if (dot < -0.99999) {
    // 180° around any axis perpendicular to `from`
    const ortho = Math.abs(fx) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const [vx, vy, vz] = normalize(cross([fx, fy, fz], ortho as [number, number, number]));
    return [
      2 * vx * vx - 1, 2 * vx * vy,     2 * vx * vz,     0,
      2 * vx * vy,     2 * vy * vy - 1, 2 * vy * vz,     0,
      2 * vx * vz,     2 * vy * vz,     2 * vz * vz - 1, 0,
    ];
  }
  const [cx, cy, cz] = cross([fx, fy, fz], [tx, ty, tz]);
  const s = Math.sqrt(cx * cx + cy * cy + cz * cz);
  const c = dot;
  const [kx, ky, kz] = [cx / s, cy / s, cz / s];
  const t = 1 - c;
  return [
    t * kx * kx + c,       t * kx * ky - s * kz,  t * kx * kz + s * ky,  0,
    t * kx * ky + s * kz,  t * ky * ky + c,       t * ky * kz - s * kx,  0,
    t * kx * kz - s * ky,  t * ky * kz + s * kx,  t * kz * kz + c,       0,
  ];
}

function normalize([x, y, z]: [number, number, number]): [number, number, number] {
  const l = Math.sqrt(x * x + y * y + z * z) || 1;
  return [x / l, y / l, z / l];
}

function cross(
  [ax, ay, az]: [number, number, number],
  [bx, by, bz]: [number, number, number],
): [number, number, number] {
  return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
}
```

- [ ] **Step 3: Run test**

Run: `npm run test -- cut/dowel-apply.test.ts`
Expected: 2 passed. The volume math may be off by a small percentage due to cylinder facet count; if so, relax `toBeCloseTo` precision or bump cylinder facets to 64.

- [ ] **Step 4: Commit**

```bash
git add src/lib/cut/dowel-apply.ts tests/cut/dowel-apply.test.ts
git commit -m "feat(m2): apply dowels — subtract holes from both halves, emit dowel pieces"
```

---

## Task 8: Cut worker (web worker bridge)

**Files:**
- Create: `src/workers/cut-worker.ts`
- Create: `src/lib/cut/cut-client.ts`
- Create: `tests/cut/cut-client.test.ts`

- [ ] **Step 1: Write the worker**

`src/workers/cut-worker.ts`:
```ts
import * as THREE from "three";
import { initManifold } from "../lib/cut/manifold";
import { planeCutMesh } from "../lib/cut/plane-cut";
import { applyDowels } from "../lib/cut/dowel-apply";
import type { CutPlaneSpec, Dowel, TolerancePreset } from "../types";
import { TOLERANCE_VALUES } from "../types";

export type CutWorkerRequest = {
  reqId: number;
  op: "cut";
  meshGeometry: { positions: Float32Array; indices: Uint32Array | null };
  plane: CutPlaneSpec;
  dowels: Dowel[];
  tolerance: TolerancePreset;
};

export type CutWorkerResponse =
  | { reqId: number; ok: true; partA: SerializedMesh; partB: SerializedMesh; dowelPieces: SerializedMesh[] }
  | { reqId: number; ok: false; error: string };

export type SerializedMesh = { positions: Float32Array; indices: Uint32Array };

self.onmessage = async (e: MessageEvent<CutWorkerRequest>) => {
  const { reqId, plane, dowels, tolerance, meshGeometry } = e.data;
  try {
    const M = await initManifold();
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(meshGeometry.positions, 3));
    if (meshGeometry.indices) geom.setIndex(new THREE.BufferAttribute(meshGeometry.indices, 1));
    const mesh = new THREE.Mesh(geom);

    const cut = await planeCutMesh(M, mesh, plane);
    const tolValue = TOLERANCE_VALUES[tolerance];
    const result = applyDowels(M, cut.partA.manifold, cut.partB.manifold, dowels, tolValue);

    const partA = serialize(result.partA);
    const partB = serialize(result.partB);
    const dowelPieces = result.dowelPieces.map(serialize);

    cut.partA.manifold.delete();
    cut.partB.manifold.delete();
    if (result.partA !== cut.partA.manifold) result.partA.delete();
    if (result.partB !== cut.partB.manifold) result.partB.delete();
    for (const p of result.dowelPieces) p.delete();

    const transfer = [
      partA.positions.buffer, partA.indices.buffer,
      partB.positions.buffer, partB.indices.buffer,
      ...dowelPieces.flatMap((d) => [d.positions.buffer, d.indices.buffer]),
    ];
    (self as any).postMessage({ reqId, ok: true, partA, partB, dowelPieces } satisfies CutWorkerResponse, transfer);
  } catch (err: any) {
    (self as any).postMessage({ reqId, ok: false, error: err?.message ?? String(err) } satisfies CutWorkerResponse);
  }
};

function serialize(man: any): SerializedMesh {
  const m = man.getMesh();
  return {
    positions: new Float32Array(m.vertProperties),
    indices: new Uint32Array(m.triVerts),
  };
}
```

- [ ] **Step 2: Write the client**

`src/lib/cut/cut-client.ts`:
```ts
import * as THREE from "three";
import type { CutPlaneSpec, Dowel, TolerancePreset } from "../../types";
import type { CutWorkerRequest, CutWorkerResponse, SerializedMesh } from "../../workers/cut-worker";

let worker: Worker | null = null;
let nextReqId = 1;
const pending = new Map<number, (r: CutWorkerResponse) => void>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("../../workers/cut-worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<CutWorkerResponse>) => {
      const cb = pending.get(e.data.reqId);
      if (cb) {
        pending.delete(e.data.reqId);
        cb(e.data);
      }
    };
  }
  return worker;
}

export type CutClientResult = {
  partA: THREE.Group;
  partB: THREE.Group;
  dowelPieces: THREE.Group[];
};

export async function runCut(
  mesh: THREE.Mesh,
  plane: CutPlaneSpec,
  dowels: Dowel[],
  tolerance: TolerancePreset,
): Promise<CutClientResult> {
  const w = getWorker();
  const reqId = nextReqId++;
  const geom = mesh.geometry as THREE.BufferGeometry;
  geom.applyMatrix4(mesh.matrixWorld);
  const indexed = geom.index ? geom : (geom as any).toNonIndexed();
  const positions = new Float32Array(indexed.attributes.position.array);
  const indices = indexed.index
    ? new Uint32Array(indexed.index.array)
    : null;

  const req: CutWorkerRequest = {
    reqId, op: "cut",
    meshGeometry: { positions, indices },
    plane, dowels, tolerance,
  };
  const transfer: ArrayBuffer[] = [positions.buffer];
  if (indices) transfer.push(indices.buffer);

  return new Promise((resolve, reject) => {
    pending.set(reqId, (resp) => {
      if (resp.ok) {
        resolve({
          partA: deserialize(resp.partA),
          partB: deserialize(resp.partB),
          dowelPieces: resp.dowelPieces.map(deserialize),
        });
      } else {
        reject(new Error(resp.error));
      }
    });
    w.postMessage(req, transfer);
  });
}

function deserialize(s: SerializedMesh): THREE.Group {
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(s.positions, 3));
  geom.setIndex(new THREE.BufferAttribute(s.indices, 1));
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  const m = new THREE.Mesh(geom);
  const g = new THREE.Group();
  g.add(m);
  return g;
}
```

- [ ] **Step 3: Write a smoke test that bypasses the worker**

Worker tests are flaky in jsdom; instead, test the same call sites by importing the worker's logic directly.

`tests/cut/cut-client.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { initManifold } from "../../src/lib/cut/manifold";
import { meshToManifold, manifoldToMesh } from "../../src/lib/cut/convert";
import { planeCutMesh } from "../../src/lib/cut/plane-cut";
import { applyDowels } from "../../src/lib/cut/dowel-apply";

// We test the worker pipeline by running the same sequence in-process.
describe("cut pipeline (in-process)", () => {
  it("produces two halves and one dowel piece for a cube cut at X=0", async () => {
    const M = await initManifold();
    const geom = new THREE.BoxGeometry(10, 10, 10);
    const mesh = new THREE.Mesh(geom);
    const cut = await planeCutMesh(M, mesh, { normal: [1, 0, 0], constant: 0, axisSnap: "x" });
    const result = applyDowels(M, cut.partA.manifold, cut.partB.manifold, [{
      id: "d1", position: [0, 0, 0], axis: [1, 0, 0], diameter: 4, length: 10, source: "auto",
    }], 0.10);
    expect(result.dowelPieces.length).toBe(1);
    expect(result.partA.volume()).toBeLessThan(500);
    expect(result.partB.volume()).toBeLessThan(500);

    const groupA = manifoldToMesh(result.partA);
    expect(groupA.children.length).toBe(1);

    cut.partA.manifold.delete(); cut.partB.manifold.delete();
    if (result.partA !== cut.partA.manifold) result.partA.delete();
    if (result.partB !== cut.partB.manifold) result.partB.delete();
    for (const p of result.dowelPieces) p.delete();
  });
});
```

- [ ] **Step 4: Run test**

Run: `npm run test -- cut/cut-client.test.ts`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add src/workers/cut-worker.ts src/lib/cut/cut-client.ts tests/cut/cut-client.test.ts
git commit -m "feat(m2): cut worker and client bridge"
```

---

## Task 9: Cut session hook (single-cut)

**Files:**
- Create: `src/hooks/useCutSession.ts`

- [ ] **Step 1: Implement the hook**

```ts
import { useCallback, useState } from "react";
import * as THREE from "three";
import type { Dowel, CutPlaneSpec, TolerancePreset, Part, PartId, ModelData } from "../types";
import { runCut } from "../lib/cut/cut-client";

type SessionState = {
  rootPart: { id: PartId; mesh: THREE.Mesh; group: THREE.Group } | null;
  cutParts: Array<{ id: PartId; mesh: THREE.Mesh; group: THREE.Group; isDowel: boolean; meta: Part }>;
  busy: boolean;
  error: string | null;
};

export function useCutSession() {
  const [state, setState] = useState<SessionState>({ rootPart: null, cutParts: [], busy: false, error: null });

  const loadModel = useCallback((data: ModelData) => {
    let mesh: THREE.Mesh | null = null;
    data.group.traverse((o) => { if ((o as any).isMesh && !mesh) mesh = o as THREE.Mesh; });
    if (!mesh) throw new Error("Model has no mesh");
    setState({
      rootPart: { id: "p_root", mesh, group: data.group },
      cutParts: [],
      busy: false,
      error: null,
    });
  }, []);

  const performCut = useCallback(async (plane: CutPlaneSpec, dowels: Dowel[], tolerance: TolerancePreset) => {
    if (!state.rootPart) return;
    setState((s) => ({ ...s, busy: true, error: null }));
    try {
      const result = await runCut(state.rootPart.mesh, plane, dowels, tolerance);
      const partAMesh = findFirstMesh(result.partA);
      const partBMesh = findFirstMesh(result.partB);
      if (!partAMesh || !partBMesh) throw new Error("Cut produced empty parts");
      const newParts: SessionState["cutParts"] = [
        {
          id: "p_a", mesh: partAMesh, group: result.partA, isDowel: false,
          meta: { id: "p_a", name: "Part A", source: "cut", parentId: state.rootPart.id, cutId: "c_1", visible: true, color: "#3b82f6", triCount: countTris(partAMesh) },
        },
        {
          id: "p_b", mesh: partBMesh, group: result.partB, isDowel: false,
          meta: { id: "p_b", name: "Part B", source: "cut", parentId: state.rootPart.id, cutId: "c_1", visible: true, color: "#ef4444", triCount: countTris(partBMesh) },
        },
        ...result.dowelPieces.map((g, i) => {
          const m = findFirstMesh(g)!;
          return {
            id: `d_${i}`, mesh: m, group: g, isDowel: true,
            meta: { id: `d_${i}`, name: `Dowel ${i + 1}`, source: "cut" as const, parentId: null, cutId: "c_1", visible: true, color: "#a3a3a3", triCount: countTris(m) },
          };
        }),
      ];
      setState({ rootPart: null, cutParts: newParts, busy: false, error: null });
    } catch (e: any) {
      setState((s) => ({ ...s, busy: false, error: e?.message ?? String(e) }));
    }
  }, [state.rootPart]);

  return { ...state, loadModel, performCut };
}

function findFirstMesh(group: THREE.Group): THREE.Mesh | null {
  let mesh: THREE.Mesh | null = null;
  group.traverse((o) => { if ((o as any).isMesh && !mesh) mesh = o as THREE.Mesh; });
  return mesh;
}

function countTris(mesh: THREE.Mesh): number {
  const idx = (mesh.geometry as THREE.BufferGeometry).index;
  return idx ? idx.count / 3 : (mesh.geometry as THREE.BufferGeometry).attributes.position.count / 3;
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useCutSession.ts
git commit -m "feat(m2): useCutSession hook (single-cut MVP)"
```

---

## Task 10: Cut plane gizmo

**Files:**
- Create: `src/components/CutPlane.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useMemo } from "react";
import * as THREE from "three";
import type { CutPlaneSpec } from "../types";

type Props = {
  plane: CutPlaneSpec;
  bbox: THREE.Box3;
};

/**
 * Renders a translucent plane visualization at the given cut location.
 * The plane is sized to extend slightly past the part bbox.
 */
export function CutPlane({ plane, bbox }: Props) {
  const { position, quaternion, size } = useMemo(() => {
    const n = new THREE.Vector3(...plane.normal).normalize();
    const center = bbox.getCenter(new THREE.Vector3());
    const dist = -plane.constant - n.dot(center);
    const pos = center.clone().add(n.clone().multiplyScalar(-dist));
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    const sizeVec = bbox.getSize(new THREE.Vector3());
    const planeSize = Math.max(sizeVec.x, sizeVec.y, sizeVec.z) * 1.2;
    return { position: pos, quaternion: q, size: planeSize };
  }, [plane, bbox]);

  return (
    <group position={position} quaternion={quaternion}>
      <mesh>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.25} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[new THREE.PlaneGeometry(size, size)]} />
        <lineBasicMaterial color="#0891b2" />
      </lineSegments>
    </group>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/CutPlane.tsx
git commit -m "feat(m2): cut plane gizmo component"
```

---

## Task 11: Cut panel UI

**Files:**
- Create: `src/components/CutPanel.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useState } from "react";
import type { CutPlaneSpec, TolerancePreset, Dowel } from "../types";
import { TOLERANCE_VALUES } from "../types";

type Props = {
  bboxMin: [number, number, number];
  bboxMax: [number, number, number];
  initialAxis?: "x" | "y" | "z";
  onPreviewChange: (plane: CutPlaneSpec, dowels: Dowel[], tolerance: TolerancePreset) => void;
  onCut: (plane: CutPlaneSpec, dowels: Dowel[], tolerance: TolerancePreset) => void;
  onCancel: () => void;
  busy: boolean;
};

export function CutPanel({ bboxMin, bboxMax, initialAxis = "x", onPreviewChange, onCut, onCancel, busy }: Props) {
  const [axis, setAxis] = useState<"x" | "y" | "z">(initialAxis);
  const axisIdx = axis === "x" ? 0 : axis === "y" ? 1 : 2;
  const min = bboxMin[axisIdx];
  const max = bboxMax[axisIdx];
  const center = (min + max) / 2;
  const [position, setPosition] = useState(center);
  const [dowelCount, setDowelCount] = useState(4);
  const [dowelDiameter, setDowelDiameter] = useState(5);
  const [dowelLength, setDowelLength] = useState(20);
  const [tolerance, setTolerance] = useState<TolerancePreset>("pla-tight");

  const buildPlane = (): CutPlaneSpec => {
    const normal: [number, number, number] = axis === "x" ? [1, 0, 0] : axis === "y" ? [0, 1, 0] : [0, 0, 1];
    return { normal, constant: position, axisSnap: axis };
  };

  const buildAutoDowels = (): Dowel[] => {
    // For M2 single-cut we just emit `dowelCount` placeholder dowels at the centroid of the cut plane.
    // CutPanel will be integrated with the auto-place algorithm by the parent in Task 13.
    return Array.from({ length: dowelCount }, (_, i) => ({
      id: `auto_${i}`,
      position: [
        axis === "x" ? position : 0,
        axis === "y" ? position : 0,
        axis === "z" ? position : 0,
      ],
      axis: axis === "x" ? [1, 0, 0] : axis === "y" ? [0, 1, 0] : [0, 0, 1],
      diameter: dowelDiameter,
      length: dowelLength,
      source: "auto",
    }));
  };

  const fire = (handler: typeof onPreviewChange) => {
    const plane = buildPlane();
    const dowels = buildAutoDowels();
    handler(plane, dowels, tolerance);
  };

  const updatePosition = (v: number) => { setPosition(v); fire(onPreviewChange); };

  return (
    <div className="bg-white border-r border-slate-200 p-3 w-72 flex flex-col gap-3 text-sm">
      <div>
        <div className="font-semibold mb-1">Cut Axis</div>
        <div className="flex gap-1">
          {(["x", "y", "z"] as const).map((a) => (
            <button
              key={a}
              className={`flex-1 py-1 rounded ${axis === a ? "bg-slate-900 text-white" : "bg-slate-100"}`}
              onClick={() => { setAxis(a); fire(onPreviewChange); }}
            >{a.toUpperCase()}</button>
          ))}
        </div>
      </div>
      <div>
        <label className="block font-semibold mb-1">Position (mm)</label>
        <input type="range" min={min} max={max} step={0.1} value={position} onChange={(e) => updatePosition(+e.target.value)} className="w-full" />
        <input type="number" value={position.toFixed(2)} onChange={(e) => updatePosition(+e.target.value)} className="w-full border border-slate-300 rounded px-2 py-1 mt-1" />
      </div>
      <div className="border-t border-slate-200 pt-3">
        <div className="font-semibold mb-1">Dowels</div>
        <label className="block text-xs">Count</label>
        <input type="number" min={0} max={20} value={dowelCount} onChange={(e) => { setDowelCount(+e.target.value); fire(onPreviewChange); }} className="w-full border border-slate-300 rounded px-2 py-1" />
        <label className="block text-xs mt-2">Diameter (mm)</label>
        <input type="number" min={2} max={20} step={0.5} value={dowelDiameter} onChange={(e) => { setDowelDiameter(+e.target.value); fire(onPreviewChange); }} className="w-full border border-slate-300 rounded px-2 py-1" />
        <label className="block text-xs mt-2">Length (mm)</label>
        <input type="number" min={5} max={100} value={dowelLength} onChange={(e) => { setDowelLength(+e.target.value); fire(onPreviewChange); }} className="w-full border border-slate-300 rounded px-2 py-1" />
      </div>
      <div>
        <label className="block font-semibold mb-1">Tolerance</label>
        <select value={tolerance} onChange={(e) => { setTolerance(e.target.value as TolerancePreset); fire(onPreviewChange); }} className="w-full border border-slate-300 rounded px-2 py-1">
          {Object.entries(TOLERANCE_VALUES).map(([k, v]) => (
            <option key={k} value={k}>{k} ({v}mm)</option>
          ))}
        </select>
      </div>
      <div className="flex gap-2 mt-auto">
        <button className="flex-1 py-2 bg-slate-200 rounded" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className="flex-1 py-2 bg-emerald-600 text-white rounded disabled:opacity-50" onClick={() => fire(onCut)} disabled={busy}>{busy ? "Cutting..." : "Cut"}</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/CutPanel.tsx
git commit -m "feat(m2): CutPanel UI component"
```

---

## Task 12: Auto-place integration

**Files:**
- Create: `src/lib/cut/auto-place-cut-dowels.ts`
- Create: `tests/cut/auto-place-cut-dowels.test.ts`

This task wires together cut-polygon extraction + autoPlaceDowels into a single function that takes the source mesh + plane + count + diameter and returns world-space Dowel objects. Used by the App in Task 13.

- [ ] **Step 1: Write test**

```ts
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { autoPlaceCutDowels } from "../../src/lib/cut/auto-place-cut-dowels";

describe("autoPlaceCutDowels", () => {
  it("places dowels on the cut plane with axis = plane normal", () => {
    const geom = new THREE.BoxGeometry(20, 20, 20);
    const mesh = new THREE.Mesh(geom);
    const dowels = autoPlaceCutDowels(mesh, {
      normal: [1, 0, 0], constant: 0, axisSnap: "x",
    }, { count: 4, dowelDiameter: 5, length: 10, minSpacing: 2 });
    expect(dowels.length).toBe(4);
    for (const d of dowels) {
      expect(d.axis).toEqual([1, 0, 0]);
      expect(Math.abs(d.position[0])).toBeLessThan(0.01);
      expect(d.position[1]).toBeGreaterThan(-10);
      expect(d.position[1]).toBeLessThan(10);
      expect(d.position[2]).toBeGreaterThan(-10);
      expect(d.position[2]).toBeLessThan(10);
    }
  });
});
```

- [ ] **Step 2: Implement**

```ts
import * as THREE from "three";
import type { CutPlaneSpec, Dowel } from "../../types";
import { extractCutPolygon } from "./cut-polygon";
import { autoPlaceDowels } from "./dowel-place";

export type AutoPlaceOpts = {
  count: number;
  dowelDiameter: number;
  length: number;
  minSpacing: number;
};

export function autoPlaceCutDowels(
  mesh: THREE.Mesh,
  plane: CutPlaneSpec,
  opts: AutoPlaceOpts,
): Dowel[] {
  const threePlane = new THREE.Plane(new THREE.Vector3(...plane.normal).normalize(), -plane.constant);
  const polys = extractCutPolygon(mesh, threePlane);
  if (polys.length === 0) return [];

  const places2D = autoPlaceDowels(polys, {
    count: opts.count,
    dowelDiameter: opts.dowelDiameter,
    minSpacing: opts.minSpacing,
  });

  // Build local frame to convert 2D back to world
  const n = new THREE.Vector3(...plane.normal).normalize();
  const u = Math.abs(n.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  u.sub(n.clone().multiplyScalar(n.dot(u))).normalize();
  const v = new THREE.Vector3().crossVectors(n, u);
  const origin = n.clone().multiplyScalar(-plane.constant);

  return places2D.map((p, i) => {
    const world = origin.clone().add(u.clone().multiplyScalar(p[0])).add(v.clone().multiplyScalar(p[1]));
    return {
      id: `auto_${i}`,
      position: [world.x, world.y, world.z] as [number, number, number],
      axis: [n.x, n.y, n.z] as [number, number, number],
      diameter: opts.dowelDiameter,
      length: opts.length,
      source: "auto" as const,
    };
  });
}
```

- [ ] **Step 3: Run test**

Run: `npm run test -- cut/auto-place-cut-dowels.test.ts`
Expected: 1 passed.

- [ ] **Step 4: Commit**

```bash
git add src/lib/cut/auto-place-cut-dowels.ts tests/cut/auto-place-cut-dowels.test.ts
git commit -m "feat(m2): integrate cut-polygon extraction with auto-dowel placement"
```

---

## Task 13: Dowel markers (HTML overlay)

**Files:**
- Create: `src/components/DowelMarkers.tsx`

- [ ] **Step 1: Implement**

```tsx
import { Html } from "@react-three/drei";
import type { Dowel } from "../types";

type Props = {
  dowels: Dowel[];
  onDelete?: (id: string) => void;
};

export function DowelMarkers({ dowels, onDelete }: Props) {
  return (
    <>
      {dowels.map((d) => (
        <group key={d.id} position={d.position}>
          <mesh>
            <sphereGeometry args={[d.diameter / 2 + 0.5, 16, 16]} />
            <meshBasicMaterial color="#f59e0b" transparent opacity={0.6} />
          </mesh>
          <Html distanceFactor={150} center>
            <button
              className="bg-amber-500 text-white text-xs px-1 rounded shadow"
              onClick={() => onDelete?.(d.id)}
            >×</button>
          </Html>
        </group>
      ))}
    </>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/DowelMarkers.tsx
git commit -m "feat(m2): DowelMarkers component"
```

---

## Task 14: Toolbar (Open + Export buttons)

**Files:**
- Create: `src/components/Toolbar.tsx`

- [ ] **Step 1: Implement**

```tsx
type Props = {
  onOpen: () => void;
  onExport: () => void;
  canExport: boolean;
};

export function Toolbar({ onOpen, onExport, canExport }: Props) {
  return (
    <div className="px-3 py-2 bg-white border-b border-slate-200 flex gap-2 text-sm">
      <button className="px-3 py-1 bg-slate-900 text-white rounded" onClick={onOpen}>Open…</button>
      <div className="flex-1" />
      <button
        className="px-3 py-1 bg-emerald-600 text-white rounded disabled:opacity-50"
        disabled={!canExport}
        onClick={onExport}
      >Export</button>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/Toolbar.tsx
git commit -m "feat(m2): Toolbar component (Open + Export)"
```

---

## Task 15: STL exporter (port)

**Files:**
- Source: `/home/goodsmileduck/local/personal/3dlab/viewer-3d/src/lib/exporters/stl.ts`, `save.ts`, `index.ts`
- Create: `src/lib/exporters/stl.ts`
- Create: `src/lib/exporters/save.ts`
- Create: `src/lib/exporters/index.ts`

- [ ] **Step 1: Port files**

Copy each from viewer-3d to pasak. Adjust the `save.ts` to drop the Tauri branch (M4 will add it back); for now, save.ts is browser-only (uses `URL.createObjectURL` + anchor click).

- [ ] **Step 2: Trim `index.ts`**

Open `src/lib/exporters/index.ts`. Reduce the supported format set to just `stl` and `3mf` for now (no GLB/OBJ export needed in v1). Other formats can be added later.

- [ ] **Step 3: Verify typecheck and basic export test**

Create `tests/exporters/stl.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { exportToSTL } from "../../src/lib/exporters/stl";

describe("exportToSTL", () => {
  it("produces a valid binary STL for a cube", () => {
    const geom = new THREE.BoxGeometry(10, 10, 10);
    const mesh = new THREE.Mesh(geom);
    const data = exportToSTL(mesh, "binary");
    expect(data.byteLength).toBeGreaterThan(0);
    // Binary STL header is 80 bytes + 4-byte tri count
    expect(data.byteLength).toBeGreaterThan(84);
  });
});
```

Run: `npm run test -- exporters/stl.test.ts`
Expected: 1 passed. (You may need to expose an `exportToSTL` named export — adapt the ported code accordingly.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/exporters/ tests/exporters/stl.test.ts
git commit -m "feat(m2): port STL exporter from viewer-3d (mesh-only, no Tauri)"
```

---

## Task 16: Zip export

**Files:**
- Create: `src/lib/exporters/zip-export.ts`
- Create: `tests/exporters/zip-export.test.ts`

- [ ] **Step 1: Write test**

```ts
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { unzipSync, strFromU8 } from "fflate";
import { buildZipExport } from "../../src/lib/exporters/zip-export";

describe("buildZipExport", () => {
  it("packages parts and dowels into a zip", () => {
    const parts = [
      { name: "part-A.stl", mesh: new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10)) },
      { name: "part-B.stl", mesh: new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10)) },
    ];
    const dowels = [
      { name: "dowels_5x20mm_qty4.stl", mesh: new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 20)) },
    ];
    const zipped = buildZipExport(parts, dowels);
    const entries = unzipSync(zipped);
    expect(Object.keys(entries).sort()).toEqual([
      "README.txt",
      "dowels/dowels_5x20mm_qty4.stl",
      "parts/part-A.stl",
      "parts/part-B.stl",
    ].sort());
    expect(strFromU8(entries["README.txt"])).toMatch(/Pasak/);
  });
});
```

- [ ] **Step 2: Implement**

```ts
import * as THREE from "three";
import { zipSync, strToU8 } from "fflate";
import { exportToSTL } from "./stl";

export type ExportItem = { name: string; mesh: THREE.Mesh };

export function buildZipExport(parts: ExportItem[], dowels: ExportItem[]): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  for (const p of parts) {
    files[`parts/${p.name}`] = new Uint8Array(exportToSTL(p.mesh, "binary"));
  }
  for (const d of dowels) {
    files[`dowels/${d.name}`] = new Uint8Array(exportToSTL(d.mesh, "binary"));
  }
  files["README.txt"] = strToU8(
    "Generated by Pasak — https://pasak.3dlab.id\n\n" +
    `Parts: ${parts.length}\n` +
    `Dowel pieces: ${dowels.length}\n\n` +
    "Print parts in the orientation provided.\n" +
    "Dowels can be printed or substituted with wood/metal dowels of matching diameter.\n",
  );
  return zipSync(files);
}
```

- [ ] **Step 3: Run test**

Run: `npm run test -- exporters/zip-export.test.ts`
Expected: 1 passed.

- [ ] **Step 4: Commit**

```bash
git add src/lib/exporters/zip-export.ts tests/exporters/zip-export.test.ts
git commit -m "feat(m2): zip export packaging parts + dowels + README"
```

---

## Task 17: Wire App.tsx for the cut workflow

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/Viewer.tsx` (add cut-related props)

- [ ] **Step 1: Extend Viewer.tsx**

Open `src/components/Viewer.tsx`. Add optional props:
- `cutPreview?: { plane: CutPlaneSpec; bbox: THREE.Box3 } | null`
- `dowels?: Dowel[]`
- `cutParts?: Array<{ id: string; group: THREE.Group; visible: boolean; isDowel: boolean }>`

When `cutParts` is provided, render those instead of the original model. When `cutPreview` is provided, render `<CutPlane plane={cutPreview.plane} bbox={cutPreview.bbox} />`. When `dowels` are provided, render `<DowelMarkers dowels={dowels} />`.

Import statements:
```tsx
import { CutPlane } from "./CutPlane";
import { DowelMarkers } from "./DowelMarkers";
import type { CutPlaneSpec, Dowel } from "../types";
```

- [ ] **Step 2: Replace App.tsx**

```tsx
import { useCallback, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Viewer } from "./components/Viewer";
import { DropZone } from "./components/DropZone";
import { StatusBar } from "./components/StatusBar";
import { Spinner } from "./components/Spinner";
import { Toolbar } from "./components/Toolbar";
import { CutPanel } from "./components/CutPanel";
import { loadModel } from "./lib/loaders";
import { useCutSession } from "./hooks/useCutSession";
import { autoPlaceCutDowels } from "./lib/cut/auto-place-cut-dowels";
import { buildZipExport } from "./lib/exporters/zip-export";
import type { ModelData, CutPlaneSpec, Dowel, TolerancePreset } from "./types";

export default function App() {
  const session = useCutSession();
  const [modelInfo, setModelInfo] = useState<ModelData["info"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCutPanel, setShowCutPanel] = useState(false);
  const [previewPlane, setPreviewPlane] = useState<CutPlaneSpec | null>(null);
  const [previewDowels, setPreviewDowels] = useState<Dowel[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    try {
      const buf = await file.arrayBuffer();
      const data = await loadModel(file.name, buf, file.size);
      session.loadModel(data);
      setModelInfo(data.info);
      setShowCutPanel(true);
    } catch (e: any) {
      setError(e.message ?? String(e));
    }
  }, [session]);

  const bbox = useMemo(() => {
    if (!session.rootPart) return null;
    const b = new THREE.Box3().setFromObject(session.rootPart.group);
    return b;
  }, [session.rootPart]);

  const onPreview = (plane: CutPlaneSpec, _dowels: Dowel[], _t: TolerancePreset) => {
    if (!session.rootPart) return;
    setPreviewPlane(plane);
    const placed = autoPlaceCutDowels(session.rootPart.mesh, plane, {
      count: _dowels.length,
      dowelDiameter: _dowels[0]?.diameter ?? 5,
      length: _dowels[0]?.length ?? 20,
      minSpacing: 2,
    });
    setPreviewDowels(placed);
  };

  const onCut = (plane: CutPlaneSpec, _dowels: Dowel[], tolerance: TolerancePreset) => {
    if (!session.rootPart) return;
    const placed = autoPlaceCutDowels(session.rootPart.mesh, plane, {
      count: _dowels.length,
      dowelDiameter: _dowels[0]?.diameter ?? 5,
      length: _dowels[0]?.length ?? 20,
      minSpacing: 2,
    });
    session.performCut(plane, placed, tolerance);
    setShowCutPanel(false);
    setPreviewPlane(null);
    setPreviewDowels([]);
  };

  const onExport = () => {
    if (session.cutParts.length === 0) return;
    const parts = session.cutParts
      .filter((p) => !p.isDowel)
      .map((p) => ({ name: `${p.meta.name.replace(/\s+/g, "_")}.stl`, mesh: p.mesh }));
    const dowels = session.cutParts
      .filter((p) => p.isDowel)
      .map((p, i) => ({ name: `dowel_${String(i + 1).padStart(2, "0")}.stl`, mesh: p.mesh }));
    const zip = buildZipExport(parts, dowels);
    const blob = new Blob([zip], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (modelInfo?.filename.replace(/\.[^.]+$/, "") ?? "pasak") + "-pasak.zip";
    a.click();
    URL.revokeObjectURL(url);
  };

  const cutParts = session.cutParts.length > 0
    ? session.cutParts.map((p) => ({ id: p.id, group: p.group, visible: p.meta.visible, isDowel: p.isDowel }))
    : undefined;

  return (
    <div className="h-full w-full flex flex-col bg-slate-100">
      <input ref={fileInputRef} type="file" accept=".stl,.obj,.3mf,.glb" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      <Toolbar onOpen={() => fileInputRef.current?.click()} onExport={onExport} canExport={session.cutParts.length > 0} />
      <main className="flex-1 flex relative">
        {showCutPanel && bbox && (
          <CutPanel
            bboxMin={bbox.min.toArray() as [number, number, number]}
            bboxMax={bbox.max.toArray() as [number, number, number]}
            onPreviewChange={onPreview}
            onCut={onCut}
            onCancel={() => { setShowCutPanel(false); setPreviewPlane(null); setPreviewDowels([]); }}
            busy={session.busy}
          />
        )}
        <div className="flex-1 relative">
          {!session.rootPart && cutParts === undefined ? (
            <DropZone onFile={handleFile} />
          ) : (
            <Viewer
              rootGroup={session.rootPart?.group ?? null}
              cutParts={cutParts}
              cutPreview={previewPlane && bbox ? { plane: previewPlane, bbox } : null}
              dowels={previewDowels}
            />
          )}
          {session.busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60">
              <Spinner />
            </div>
          )}
          {(error || session.error) && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-100 text-red-800 px-4 py-2 rounded shadow">
              {error || session.error}
            </div>
          )}
        </div>
      </main>
      {modelInfo && <StatusBar info={modelInfo} />}
    </div>
  );
}
```

Note: The `Viewer` props have changed shape. Update `Viewer.tsx` to accept `rootGroup`, `cutParts`, `cutPreview`, `dowels` instead of a single `model`. The Viewer renders `rootGroup` if provided (and no `cutParts`), else renders each visible group in `cutParts`.

- [ ] **Step 3: Verify typecheck and smoke test**

Run: `npm run typecheck`. Fix any prop mismatches.

Run: `npm run dev`. Manual flow:
1. Drop `tests/fixtures/cube.stl` → cube renders, CutPanel appears on left.
2. Click X / Y / Z → preview plane appears in scene.
3. Drag position slider → plane moves; dowel markers appear and reposition.
4. Click "Cut" → spinner, then cube becomes two halves + 4 small cylinders (dowels).
5. Click "Export" → downloads `cube-pasak.zip`. Unzip and verify 2 part STLs + 1 dowel STL + README.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/Viewer.tsx
git commit -m "feat(m2): wire single-cut workflow end-to-end"
```

---

## Task 18: M2 acceptance — smoke test

**Files:**
- Create: `docs/m2-smoke-test.md`

- [ ] **Step 1: Document checks**

```markdown
# M2 Smoke Test Checklist

- [ ] All M1 checks still pass
- [ ] `npm run test` passes
- [ ] `npm run build` succeeds
- [ ] Drop cube STL → CutPanel appears
- [ ] Switch axis between X / Y / Z → cut plane re-orients in scene
- [ ] Drag position slider → cut plane translates; dowel markers update live
- [ ] Type position value → cut plane jumps; dowel markers update
- [ ] Adjust dowel count, diameter, length → markers reflect new values
- [ ] Change tolerance preset → no visual change yet (applied at cut time)
- [ ] Click Cut → spinner shows, then two halves + dowels appear in scene
- [ ] Click Export → zip downloads
- [ ] Unzip: contains parts/Part_A.stl, parts/Part_B.stl, dowels/dowels_qtyN.stl, README.txt
- [ ] Open Part_A.stl in Bambu Studio / Orca / PrusaSlicer → loads cleanly with hole geometry
- [ ] Place dowel in hole → dowel fits with appropriate clearance (PLA-tight: snug; PLA-loose: easy slide)
- [ ] Cut plane outside mesh → error message shown
- [ ] Reload page → state resets cleanly
```

- [ ] **Step 2: Walk through checklist, fix any failures**

- [ ] **Step 3: Commit**

```bash
git add docs/m2-smoke-test.md
git commit -m "docs: M2 smoke test checklist"
```

---

## M2 Done

Single-cut MVP shippable. Next: M3 adds parts tree, multi-cut, undo/redo, auto-orient, printer presets, fit-to-printer suggest, exploded view, and 3MF multi-object export.
