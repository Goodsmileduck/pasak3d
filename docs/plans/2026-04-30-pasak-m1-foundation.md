# Pasak M1 — Foundation + Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working web 3D viewer at `localhost:5173` that loads STL/OBJ/3MF/GLB files via drag-and-drop, displays them on a build plate with axis cube and status bar, and runs as the foundation for cut/dowel functionality in M2.

**Architecture:** Single React + TypeScript + Vite app with R3F (React Three Fiber) for 3D scene, Tailwind v4 for styling, Z-up axis convention. All loaders/scene code ported from sister project `../viewer-3d/` then trimmed to Pasak's mesh-only scope. No backend. No Tauri shell yet (added in M4).

**Tech Stack:** React 19, TypeScript 5.7, Vite 6, Three.js 0.170, @react-three/fiber 9, @react-three/drei 10, three-mesh-bvh 0.8, Tailwind 4, Vitest 4, jsdom 28.

**Sister project for reference:** `/home/goodsmileduck/local/personal/3dlab/viewer-3d/`. Many tasks are "port file X" — read the file from viewer-3d, copy to Pasak, trim STEP-related branches.

**Working directory for all commands:** `/home/goodsmileduck/local/personal/3dlab/pasak/`

---

## Task 1: Initialize package.json and install core deps

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `README.md`

- [ ] **Step 1: Create `package.json`**

Write this exact content:
```json
{
  "name": "pasak",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "VITE_TARGET=web vite",
    "dev:web": "VITE_TARGET=web vite",
    "build": "VITE_TARGET=web tsc && VITE_TARGET=web vite build",
    "build:web": "VITE_TARGET=web tsc && VITE_TARGET=web vite build",
    "preview": "VITE_TARGET=web vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@react-three/drei": "^10.7.7",
    "@react-three/fiber": "^9.5.0",
    "fflate": "^0.8.2",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "three": "^0.170.0",
    "three-mesh-bvh": "^0.8.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@testing-library/user-event": "^14.6.1",
    "@types/node": "^25.3.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/three": "^0.170.0",
    "@vitejs/plugin-react": "^4.3.4",
    "jsdom": "^28.1.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.2",
    "vite": "^6.0.3",
    "vitest": "^4.0.18"
  }
}
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules
dist
.DS_Store
.vite
.wrangler
.dev.vars
*.local
.env*
!.env.example
.playwright-screenshots
.playwright-mcp
.worktrees
coverage
```

- [ ] **Step 3: Create `README.md`**

```markdown
# Pasak

Cut large 3D models into printable parts with dowel connections. Free public alternative to LuBan3D. Web at https://pasak.3dlab.id.

## Development

```bash
npm install
npm run dev          # web dev server (localhost:5173)
npm run typecheck    # TypeScript check
npm run test         # run unit tests
npm run build        # production web build
```

See `docs/2026-04-30-pasak-design.md` for the full design.
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`
Expected: `node_modules/` populated, `package-lock.json` generated.

- [ ] **Step 5: Initialize git and commit**

Run:
```bash
git init
git add package.json package-lock.json .gitignore README.md
git commit -m "feat: initialize Pasak project with core dependencies"
```

---

## Task 2: TypeScript and Vite configuration

**Files:**
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`
- Create: `tests/setup.ts`

- [ ] **Step 1: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vite/client", "vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "tests"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 2: Create `tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 3: Create `vite.config.ts`**

```ts
/// <reference types="vitest" />
import { readFileSync } from "fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const isWeb = process.env.VITE_TARGET === "web";
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

export default defineConfig({
  plugins: [react(), tailwindcss()],

  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },

  ...(isWeb
    ? {}
    : {
        clearScreen: false,
        server: {
          port: 1420,
          strictPort: true,
          watch: { ignored: ["**/src-tauri/**"] },
        },
      }),

  // Manifold WASM (M2) and any other .wasm assets
  assetsInclude: ["**/*.wasm"],

  worker: {
    format: "es",
  },

  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    globals: true,
  },
});
```

- [ ] **Step 4: Create `src/styles.css`**

```css
@import "tailwindcss";

html, body, #root {
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
```

- [ ] **Step 5: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Pasak — Cut 3D models with dowel connections</title>
    <meta name="description" content="Free web tool to cut large 3D models into printable parts joined by dowels. Alternative to LuBan3D." />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create `src/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 7: Create `src/App.tsx`** (placeholder; replaced in later tasks)

```tsx
export default function App() {
  return (
    <div className="h-full w-full flex items-center justify-center text-gray-700">
      Pasak — coming soon
    </div>
  );
}
```

- [ ] **Step 8: Create `tests/setup.ts`**

```ts
import "@testing-library/jest-dom";
```

- [ ] **Step 9: Create `public/favicon.svg`** (simple placeholder)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#0f172a"/><text x="16" y="22" text-anchor="middle" font-family="sans-serif" font-size="18" font-weight="700" fill="#fff">P</text></svg>
```

- [ ] **Step 10: Verify dev server boots and typecheck passes**

Run: `npm run typecheck`
Expected: exits 0 with no output.

Run: `npm run dev` in background, then `curl -s http://localhost:5173 | head -5`
Expected: HTML response with `<title>Pasak — Cut 3D models with dowel connections</title>`. Kill the dev server.

- [ ] **Step 11: Commit**

```bash
git add tsconfig.json tsconfig.node.json vite.config.ts index.html src/ tests/setup.ts public/favicon.svg
git commit -m "feat: configure Vite, TypeScript, Tailwind, and Vitest"
```

---

## Task 3: Vitest sanity test

**Files:**
- Create: `tests/sanity.test.ts`

- [ ] **Step 1: Write a smoke test**

```ts
import { describe, it, expect } from "vitest";

describe("test runner", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npm run test`
Expected: `1 passed`.

- [ ] **Step 3: Commit**

```bash
git add tests/sanity.test.ts
git commit -m "test: add Vitest sanity test"
```

---

## Task 4: Core types

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: Write minimal types needed for M1**

```ts
import type * as THREE from "three";

export type FileFormat = "stl" | "obj" | "3mf" | "glb";

export type LoadProgress = {
  stage: string;
  progress: number; // 0..1
};

export type ModelInfo = {
  filename: string;
  format: FileFormat;
  fileSize: number;        // bytes
  triCount: number;
  bbox: { min: [number, number, number]; max: [number, number, number] };
  dimensions: { x: number; y: number; z: number }; // mm
};

export type ModelData = {
  group: THREE.Group;
  info: ModelInfo;
};
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add core type definitions"
```

---

## Task 5: Scene utilities (Z-up)

**Files:**
- Create: `src/lib/scene.ts`
- Create: `tests/scene.test.ts`

- [ ] **Step 1: Write test**

```ts
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { centerOnXY, computeBBoxDiagonal, makeOrthoCamera } from "../src/lib/scene";

describe("scene utilities", () => {
  it("centerOnXY centers group on XY and places at Z=0", () => {
    const geom = new THREE.BoxGeometry(2, 4, 6);
    const mesh = new THREE.Mesh(geom);
    mesh.position.set(10, 20, 30);
    const group = new THREE.Group();
    group.add(mesh);
    centerOnXY(group);
    const bbox = new THREE.Box3().setFromObject(group);
    expect(bbox.min.z).toBeCloseTo(0, 5);
    expect((bbox.min.x + bbox.max.x) / 2).toBeCloseTo(0, 5);
    expect((bbox.min.y + bbox.max.y) / 2).toBeCloseTo(0, 5);
  });

  it("computeBBoxDiagonal returns Euclidean distance of bbox extent", () => {
    const bbox = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(3, 4, 0));
    expect(computeBBoxDiagonal(bbox)).toBeCloseTo(5, 5);
  });

  it("makeOrthoCamera returns Z-up ortho camera", () => {
    const cam = makeOrthoCamera(100);
    expect(cam.up.toArray()).toEqual([0, 0, 1]);
    expect(cam.isOrthographicCamera).toBe(true);
  });
});
```

- [ ] **Step 2: Run test, verify failure**

Run: `npm run test -- scene.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/scene.ts`**

```ts
import * as THREE from "three";

/** Reset group position to origin, then translate so it is centered on XY and sits on Z=0. */
export function centerOnXY(group: THREE.Group): void {
  group.position.set(0, 0, 0);
  group.updateMatrixWorld(true);
  const bbox = new THREE.Box3().setFromObject(group);
  const center = bbox.getCenter(new THREE.Vector3());
  group.position.set(-center.x, -center.y, -bbox.min.z);
}

export function computeBBoxDiagonal(bbox: THREE.Box3): number {
  const size = bbox.getSize(new THREE.Vector3());
  return Math.sqrt(size.x * size.x + size.y * size.y + size.z * size.z);
}

/** Z-up orthographic camera positioned looking down at -Y from a sensible offset. */
export function makeOrthoCamera(viewSize: number): THREE.OrthographicCamera {
  const aspect = 1; // updated by R3F based on canvas
  const cam = new THREE.OrthographicCamera(
    (-viewSize * aspect) / 2,
    (viewSize * aspect) / 2,
    viewSize / 2,
    -viewSize / 2,
    0.1,
    viewSize * 100,
  );
  cam.up.set(0, 0, 1);
  cam.position.set(viewSize, viewSize, viewSize);
  cam.lookAt(0, 0, 0);
  return cam;
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npm run test -- scene.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scene.ts tests/scene.test.ts
git commit -m "feat: scene utilities (center, bbox diagonal, Z-up ortho camera)"
```

---

## Task 6: Model info utility (port from viewer-3d)

**Files:**
- Source to read: `/home/goodsmileduck/local/personal/3dlab/viewer-3d/src/lib/model-info.ts`
- Create: `src/lib/model-info.ts`
- Create: `tests/model-info.test.ts`

- [ ] **Step 1: Read viewer-3d source and port**

Read `viewer-3d/src/lib/model-info.ts`. Copy to `pasak/src/lib/model-info.ts`. Adjust the `FileFormat` import to point to `../types` (Pasak's path) and remove any `step`/`stp` cases since Pasak is mesh-only.

- [ ] **Step 2: Write test**

```ts
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { computeModelInfo } from "../src/lib/model-info";

describe("computeModelInfo", () => {
  it("computes bbox, dimensions, and tri count for a cube", () => {
    const geom = new THREE.BoxGeometry(10, 20, 30);
    const mesh = new THREE.Mesh(geom);
    const group = new THREE.Group();
    group.add(mesh);
    const info = computeModelInfo(group, "cube.stl", 1234);
    expect(info.format).toBe("stl");
    expect(info.fileSize).toBe(1234);
    expect(info.dimensions.x).toBeCloseTo(10, 3);
    expect(info.dimensions.y).toBeCloseTo(20, 3);
    expect(info.dimensions.z).toBeCloseTo(30, 3);
    expect(info.triCount).toBe(12); // a box is 12 triangles
  });
});
```

- [ ] **Step 3: Run test**

Run: `npm run test -- model-info.test.ts`
Expected: 1 passed. Fix imports/types until it passes.

- [ ] **Step 4: Commit**

```bash
git add src/lib/model-info.ts tests/model-info.test.ts
git commit -m "feat: port model-info utility from viewer-3d"
```

---

## Task 7: BVH attachment (port from viewer-3d)

**Files:**
- Source to read: `/home/goodsmileduck/local/personal/3dlab/viewer-3d/src/lib/bvh.ts`
- Create: `src/lib/bvh.ts`

- [ ] **Step 1: Port file**

Read `viewer-3d/src/lib/bvh.ts`. Copy to `pasak/src/lib/bvh.ts` unchanged (it's self-contained, just three-mesh-bvh wiring).

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/bvh.ts
git commit -m "feat: port BVH attachment helper from viewer-3d"
```

---

## Task 8: STL loader (port + test)

**Files:**
- Source to read: `/home/goodsmileduck/local/personal/3dlab/viewer-3d/src/lib/loaders/stl.ts`, `parse-client.ts`, `mesh-builder.ts`, `material.ts`
- Create: `src/lib/loaders/stl.ts`
- Create: `src/lib/loaders/parse-client.ts`
- Create: `src/lib/loaders/mesh-builder.ts`
- Create: `src/lib/loaders/material.ts`
- Create: `tests/loaders/stl.test.ts`
- Create: `tests/fixtures/cube.stl`

- [ ] **Step 1: Port the supporting files**

Read each source file from viewer-3d and copy verbatim to `pasak/src/lib/loaders/`. These are: `parse-client.ts`, `mesh-builder.ts`, `material.ts`. Adjust any `../../types` imports if path layout matches (it does — same depth).

- [ ] **Step 2: Port `stl.ts`**

Read `viewer-3d/src/lib/loaders/stl.ts` and copy to `pasak/src/lib/loaders/stl.ts`. Adjust imports as needed.

- [ ] **Step 3: Generate a cube STL fixture**

Create `tests/fixtures/cube.stl` by writing a tiny Node script `tests/fixtures/gen-cube.mjs`:
```js
import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { writeFileSync } from "fs";

const geom = new THREE.BoxGeometry(10, 10, 10);
const mesh = new THREE.Mesh(geom);
const exporter = new STLExporter();
const data = exporter.parse(mesh, { binary: true });
writeFileSync("tests/fixtures/cube.stl", Buffer.from(data.buffer));
console.log("wrote tests/fixtures/cube.stl");
```

Run: `node --experimental-vm-modules tests/fixtures/gen-cube.mjs` (or just commit a pre-generated cube.stl). Verify file exists with `ls -la tests/fixtures/cube.stl`. Then delete `gen-cube.mjs` since it was a one-shot.

- [ ] **Step 4: Write loader test**

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { loadSTL } from "../../src/lib/loaders/stl";

describe("loadSTL", () => {
  it("loads a binary STL of a cube", async () => {
    const buffer = readFileSync("tests/fixtures/cube.stl").buffer;
    const group = await loadSTL(buffer as ArrayBuffer, "cube.stl");
    expect(group).toBeDefined();
    let triCount = 0;
    group.traverse((obj) => {
      if ((obj as any).isMesh) {
        const idx = (obj as any).geometry.index;
        const pos = (obj as any).geometry.attributes.position;
        triCount += idx ? idx.count / 3 : pos.count / 3;
      }
    });
    expect(triCount).toBe(12);
  });
});
```

- [ ] **Step 5: Run test**

Run: `npm run test -- loaders/stl.test.ts`
Expected: 1 passed. If the loader uses a Web Worker (parse-client.ts), the test environment needs to handle it — Vitest with jsdom + `Worker` polyfill or run the parsing inline in tests. Use the synchronous fallback path in `parse-client.ts` if available; otherwise call the Three.js `STLLoader` directly in this test.

- [ ] **Step 6: Commit**

```bash
git add src/lib/loaders/ tests/loaders/stl.test.ts tests/fixtures/cube.stl
git commit -m "feat: port STL loader from viewer-3d"
```

---

## Task 9: OBJ loader (port + test)

**Files:**
- Source: `/home/goodsmileduck/local/personal/3dlab/viewer-3d/src/lib/loaders/obj.ts`
- Create: `src/lib/loaders/obj.ts`
- Create: `tests/loaders/obj.test.ts`
- Create: `tests/fixtures/cube.obj`

- [ ] **Step 1: Port file**

Copy `viewer-3d/src/lib/loaders/obj.ts` → `pasak/src/lib/loaders/obj.ts`.

- [ ] **Step 2: Generate `cube.obj` fixture**

Create `tests/fixtures/cube.obj` with:
```
v -5 -5 -5
v  5 -5 -5
v  5  5 -5
v -5  5 -5
v -5 -5  5
v  5 -5  5
v  5  5  5
v -5  5  5
f 1 2 3 4
f 5 8 7 6
f 1 5 6 2
f 2 6 7 3
f 3 7 8 4
f 4 8 5 1
```

- [ ] **Step 3: Write test**

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { loadOBJ } from "../../src/lib/loaders/obj";

describe("loadOBJ", () => {
  it("loads an OBJ cube", async () => {
    const buffer = readFileSync("tests/fixtures/cube.obj").buffer;
    const group = await loadOBJ(buffer as ArrayBuffer, "cube.obj");
    let hasMesh = false;
    group.traverse((o) => { if ((o as any).isMesh) hasMesh = true; });
    expect(hasMesh).toBe(true);
  });
});
```

- [ ] **Step 4: Run test**

Run: `npm run test -- loaders/obj.test.ts`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/loaders/obj.ts tests/loaders/obj.test.ts tests/fixtures/cube.obj
git commit -m "feat: port OBJ loader from viewer-3d"
```

---

## Task 10: 3MF loader (port + test)

**Files:**
- Source: `/home/goodsmileduck/local/personal/3dlab/viewer-3d/src/lib/loaders/3mf.ts`
- Create: `src/lib/loaders/3mf.ts`
- Create: `tests/loaders/3mf.test.ts`
- Test fixture: copy `/home/goodsmileduck/local/personal/3dlab/viewer-3d/charizard-keycap.3mf` → `tests/fixtures/sample.3mf`

- [ ] **Step 1: Port loader**

Copy `viewer-3d/src/lib/loaders/3mf.ts` → `pasak/src/lib/loaders/3mf.ts`.

- [ ] **Step 2: Copy fixture**

Run: `cp /home/goodsmileduck/local/personal/3dlab/viewer-3d/charizard-keycap.3mf tests/fixtures/sample.3mf`

- [ ] **Step 3: Write test**

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { load3MF } from "../../src/lib/loaders/3mf";

describe("load3MF", () => {
  it("loads a real 3MF file", async () => {
    const buffer = readFileSync("tests/fixtures/sample.3mf").buffer;
    const group = await load3MF(buffer as ArrayBuffer, "sample.3mf");
    let hasMesh = false;
    group.traverse((o) => { if ((o as any).isMesh) hasMesh = true; });
    expect(hasMesh).toBe(true);
  });
});
```

- [ ] **Step 4: Run test**

Run: `npm run test -- loaders/3mf.test.ts`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/loaders/3mf.ts tests/loaders/3mf.test.ts tests/fixtures/sample.3mf
git commit -m "feat: port 3MF loader from viewer-3d"
```

---

## Task 11: GLB loader (port + test)

**Files:**
- Source: `/home/goodsmileduck/local/personal/3dlab/viewer-3d/src/lib/loaders/glb.ts`
- Create: `src/lib/loaders/glb.ts`
- Create: `tests/loaders/glb.test.ts`
- Create: `tests/fixtures/cube.glb`

- [ ] **Step 1: Port loader**

Copy `viewer-3d/src/lib/loaders/glb.ts` → `pasak/src/lib/loaders/glb.ts`.

- [ ] **Step 2: Generate fixture**

Create `tests/fixtures/gen-glb.mjs`:
```js
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { writeFileSync } from "fs";

const geom = new THREE.BoxGeometry(10, 10, 10);
const mesh = new THREE.Mesh(geom);
const exporter = new GLTFExporter();
exporter.parse(
  mesh,
  (result) => {
    writeFileSync("tests/fixtures/cube.glb", Buffer.from(result));
    console.log("wrote tests/fixtures/cube.glb");
  },
  (e) => { throw e; },
  { binary: true },
);
```

Run: `node tests/fixtures/gen-glb.mjs` then delete the script.

- [ ] **Step 3: Write test**

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { loadGLB } from "../../src/lib/loaders/glb";

describe("loadGLB", () => {
  it("loads a GLB cube", async () => {
    const buffer = readFileSync("tests/fixtures/cube.glb").buffer;
    const group = await loadGLB(buffer as ArrayBuffer, "cube.glb");
    let hasMesh = false;
    group.traverse((o) => { if ((o as any).isMesh) hasMesh = true; });
    expect(hasMesh).toBe(true);
  });
});
```

- [ ] **Step 4: Run test**

Run: `npm run test -- loaders/glb.test.ts`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/loaders/glb.ts tests/loaders/glb.test.ts tests/fixtures/cube.glb
git commit -m "feat: port GLB loader from viewer-3d"
```

---

## Task 12: Loader registry (mesh-only)

**Files:**
- Create: `src/lib/loaders/index.ts`
- Create: `tests/loaders/index.test.ts`

- [ ] **Step 1: Write test**

```ts
import { describe, it, expect } from "vitest";
import { detectFormat, SUPPORTED_EXTENSIONS, loadModel } from "../../src/lib/loaders";
import { readFileSync, statSync } from "fs";

describe("loader registry", () => {
  it("detects supported formats", () => {
    expect(detectFormat("foo.stl")).toBe("stl");
    expect(detectFormat("foo.OBJ")).toBe("obj");
    expect(detectFormat("foo.3mf")).toBe("3mf");
    expect(detectFormat("foo.glb")).toBe("glb");
    expect(detectFormat("foo.step")).toBeNull();
    expect(detectFormat("foo.unknown")).toBeNull();
  });

  it("exposes mesh-only extension list", () => {
    expect(SUPPORTED_EXTENSIONS).toEqual([".stl", ".obj", ".3mf", ".glb"]);
  });

  it("loadModel routes to the correct loader and returns ModelData", async () => {
    const path = "tests/fixtures/cube.stl";
    const buf = readFileSync(path).buffer;
    const size = statSync(path).size;
    const data = await loadModel("cube.stl", buf as ArrayBuffer, size);
    expect(data.info.format).toBe("stl");
    expect(data.info.triCount).toBe(12);
    expect(data.group).toBeDefined();
  });
});
```

- [ ] **Step 2: Implement `src/lib/loaders/index.ts`** (mesh-only — no STEP)

```ts
import * as THREE from "three";
import type { FileFormat, LoadProgress, ModelData } from "../../types";
import { computeModelInfo } from "../model-info";
import { attachBVH } from "../bvh";
import { loadSTL } from "./stl";
import { loadOBJ } from "./obj";
import { load3MF } from "./3mf";
import { loadGLB } from "./glb";

export function detectFormat(filename: string): FileFormat | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "stl": return "stl";
    case "obj": return "obj";
    case "3mf": return "3mf";
    case "glb": return "glb";
    default: return null;
  }
}

export async function loadModel(
  filename: string,
  buffer: ArrayBuffer,
  fileSize: number,
  onProgress?: (p: LoadProgress) => void,
): Promise<ModelData> {
  const format = detectFormat(filename);
  if (!format) {
    throw new Error(
      `Unsupported file format: "${filename.split(".").pop()}". Supported: STL, OBJ, 3MF, GLB`,
    );
  }
  let group: THREE.Group;
  switch (format) {
    case "stl": group = await loadSTL(buffer, filename, onProgress); break;
    case "obj": group = await loadOBJ(buffer, filename, onProgress); break;
    case "3mf": group = await load3MF(buffer, filename, onProgress); break;
    case "glb": group = await loadGLB(buffer, filename, onProgress); break;
  }
  onProgress?.({ stage: "Optimizing...", progress: 0.95 });
  attachBVH(group);
  const info = computeModelInfo(group, filename, fileSize);
  return { group, info };
}

export const SUPPORTED_EXTENSIONS = [".stl", ".obj", ".3mf", ".glb"];
export const SUPPORTED_MIME_TYPES = [
  "model/stl",
  "model/obj",
  "model/3mf",
  "application/vnd.ms-package.3dmanufacturing-3dmodel+xml",
  "model/gltf-binary",
  "application/octet-stream",
  "",
];
```

- [ ] **Step 3: Run tests**

Run: `npm run test -- loaders/index.test.ts`
Expected: 3 passed.

- [ ] **Step 4: Commit**

```bash
git add src/lib/loaders/index.ts tests/loaders/index.test.ts
git commit -m "feat: mesh-only loader registry (drops STEP from viewer-3d)"
```

---

## Task 13: DropZone component (port + adapt)

**Files:**
- Source: `/home/goodsmileduck/local/personal/3dlab/viewer-3d/src/components/DropZone.tsx`
- Create: `src/components/DropZone.tsx`

- [ ] **Step 1: Port file**

Copy `viewer-3d/src/components/DropZone.tsx` → `pasak/src/components/DropZone.tsx`. Adjust any imports of `SUPPORTED_EXTENSIONS` to point to Pasak's loader registry. Replace any viewer-specific copy text with: "Drop STL, OBJ, 3MF, or GLB to begin".

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/DropZone.tsx
git commit -m "feat: port DropZone component from viewer-3d"
```

---

## Task 14: Spinner and StatusBar (port)

**Files:**
- Source: `/home/goodsmileduck/local/personal/3dlab/viewer-3d/src/components/Spinner.tsx`, `StatusBar.tsx`
- Create: `src/components/Spinner.tsx`
- Create: `src/components/StatusBar.tsx`

- [ ] **Step 1: Port both files unchanged**

Copy each file from viewer-3d to the matching path in pasak.

- [ ] **Step 2: Trim StatusBar to Pasak fields**

Open `src/components/StatusBar.tsx`. Remove any references to fields not in Pasak's M1 `ModelInfo` (e.g. share status, anything STEP-specific). Display: filename, format, file size, triCount, dimensions x×y×z mm. Future M3 adds the printer-fit indicator — leave a TODO comment in place where it'll go.

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/Spinner.tsx src/components/StatusBar.tsx
git commit -m "feat: port Spinner and StatusBar from viewer-3d"
```

---

## Task 15: BuildPlate component (port)

**Files:**
- Source: `/home/goodsmileduck/local/personal/3dlab/viewer-3d/src/components/BuildPlate.tsx`, `plateModes.ts`
- Create: `src/components/BuildPlate.tsx`
- Create: `src/components/plateModes.ts`

- [ ] **Step 1: Port both files unchanged**

Copy from viewer-3d to pasak. Z-up convention is identical, so no changes needed.

- [ ] **Step 2: Verify typecheck and basic render in App.tsx temporarily**

Replace `src/App.tsx` with a quick smoke render (we'll do the real wiring in Task 18):
```tsx
import { Canvas } from "@react-three/fiber";
import { BuildPlate } from "./components/BuildPlate";
import { makeOrthoCamera } from "./lib/scene";

export default function App() {
  return (
    <div className="h-full w-full">
      <Canvas camera={makeOrthoCamera(300)}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[100, 100, 100]} />
        <BuildPlate size={[256, 256]} />
      </Canvas>
    </div>
  );
}
```

Run: `npm run dev` in background. Visit http://localhost:5173 — should see a build plate.

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/BuildPlate.tsx src/components/plateModes.ts src/App.tsx
git commit -m "feat: port BuildPlate component and add temporary render harness"
```

---

## Task 16: AxisCube component (port)

**Files:**
- Source: `/home/goodsmileduck/local/personal/3dlab/viewer-3d/src/components/AxisCube.tsx`
- Create: `src/components/AxisCube.tsx`

- [ ] **Step 1: Port file**

Copy `viewer-3d/src/components/AxisCube.tsx` → `pasak/src/components/AxisCube.tsx`. The axis cube reads a camera ref via context — keep the same API.

- [ ] **Step 2: Add to App.tsx render harness**

Edit `src/App.tsx` to include `<AxisCube />` (in the corner — it's an HTML overlay, not inside Canvas).

```tsx
import { Canvas } from "@react-three/fiber";
import { BuildPlate } from "./components/BuildPlate";
import { AxisCube } from "./components/AxisCube";
import { makeOrthoCamera } from "./lib/scene";
import { useRef } from "react";
import * as THREE from "three";

export default function App() {
  const cameraRef = useRef<THREE.OrthographicCamera>(null!);
  return (
    <div className="h-full w-full relative">
      <Canvas camera={makeOrthoCamera(300)} onCreated={({ camera }) => { cameraRef.current = camera as THREE.OrthographicCamera; }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[100, 100, 100]} />
        <BuildPlate size={[256, 256]} />
      </Canvas>
      <div className="absolute top-4 right-4">
        <AxisCube cameraRef={cameraRef} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify typecheck and render**

Run: `npm run typecheck` (exits 0).
Run: `npm run dev`, visit http://localhost:5173 — should see build plate + axis cube in the top right.

- [ ] **Step 4: Commit**

```bash
git add src/components/AxisCube.tsx src/App.tsx
git commit -m "feat: port AxisCube component"
```

---

## Task 17: Theme hook (port)

**Files:**
- Source: `/home/goodsmileduck/local/personal/3dlab/viewer-3d/src/hooks/useTheme.ts`
- Create: `src/hooks/useTheme.ts`

- [ ] **Step 1: Port file unchanged**

Copy from viewer-3d to pasak.

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useTheme.ts
git commit -m "feat: port useTheme hook from viewer-3d"
```

---

## Task 18: Camera controls hook (port + adapt)

**Files:**
- Source: `/home/goodsmileduck/local/personal/3dlab/viewer-3d/src/hooks/useViewerControls.ts`
- Create: `src/hooks/useViewerControls.ts`

- [ ] **Step 1: Port file**

Copy from viewer-3d to pasak. This hook may include file-loading helpers — if so, keep them; the App.tsx wiring in the next task will use them.

- [ ] **Step 2: Strip features not in M1**

Open `src/hooks/useViewerControls.ts`. Remove anything related to: STEP loading, Tauri file open, share dialogs, measurement tools, clipping. Keep: orbit controls setup, frameAll/frameModel helpers, basic file loading from a `File` object. (Tauri integration comes back in M4.)

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useViewerControls.ts
git commit -m "feat: port and trim useViewerControls hook"
```

---

## Task 19: Viewer component (port + adapt)

**Files:**
- Source: `/home/goodsmileduck/local/personal/3dlab/viewer-3d/src/components/Viewer.tsx`
- Create: `src/components/Viewer.tsx`

- [ ] **Step 1: Port file**

Copy `viewer-3d/src/components/Viewer.tsx` → `pasak/src/components/Viewer.tsx`.

- [ ] **Step 2: Strip M1-out-of-scope features**

Remove anything related to: clipping panel, measurement overlay, bounding box overlay, sharing. Keep: Canvas setup, lights, camera, model rendering, BuildPlate integration, AxisCube, OrbitControls. The component's only job in M1: render whatever ModelData is passed in. Centering uses `centerOnXY` from `lib/scene`.

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/Viewer.tsx
git commit -m "feat: port Viewer component (trimmed to M1 scope)"
```

---

## Task 20: Wire App.tsx to load and display files

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace App.tsx with the real wiring**

```tsx
import { useCallback, useState } from "react";
import { Viewer } from "./components/Viewer";
import { DropZone } from "./components/DropZone";
import { StatusBar } from "./components/StatusBar";
import { Spinner } from "./components/Spinner";
import { loadModel } from "./lib/loaders";
import type { ModelData } from "./types";

export default function App() {
  const [model, setModel] = useState<ModelData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setLoading(true);
    try {
      const buf = await file.arrayBuffer();
      // Soft warn for large meshes (per design doc, M1 scope)
      if (buf.byteLength > 100 * 1024 * 1024) {
        console.warn("Large mesh — cuts may be slow or fail. The desktop version handles big files better.");
      }
      const data = await loadModel(file.name, buf, file.size);
      setModel(data);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="h-full w-full flex flex-col bg-slate-100">
      <header className="px-4 py-2 bg-white border-b border-slate-200 text-sm font-semibold">
        Pasak <span className="font-normal text-slate-500">— alpha</span>
      </header>
      <main className="flex-1 relative">
        {model ? (
          <Viewer model={model} />
        ) : (
          <DropZone onFile={handleFile} />
        )}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60">
            <Spinner />
          </div>
        )}
        {error && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-100 text-red-800 px-4 py-2 rounded shadow">
            {error}
          </div>
        )}
      </main>
      {model && <StatusBar info={model.info} />}
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck and manual smoke**

Run: `npm run typecheck` (exits 0).
Run: `npm run dev`. Drag `tests/fixtures/cube.stl` onto the page — should load and render. Drag `tests/fixtures/sample.3mf` — should load and render. Drag a `.txt` file — should show error toast.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire App.tsx to load and display 3D models via DropZone"
```

---

## Task 21: M1 acceptance — manual smoke test checklist

**Files:**
- Create: `docs/m1-smoke-test.md`

- [ ] **Step 1: Document the manual checks**

```markdown
# M1 Smoke Test Checklist

Run before declaring M1 complete:

- [ ] `npm install` from clean clone succeeds
- [ ] `npm run typecheck` exits 0
- [ ] `npm run test` — all tests pass
- [ ] `npm run build` produces `dist/` with no errors
- [ ] `npm run dev` opens at http://localhost:5173
- [ ] Empty state: DropZone visible with prompt text
- [ ] Drop `tests/fixtures/cube.stl` → cube renders, status bar shows "12 tris, 10×10×10 mm"
- [ ] Drop `tests/fixtures/sample.3mf` → keycap renders
- [ ] Drop `tests/fixtures/cube.obj` → cube renders
- [ ] Drop `tests/fixtures/cube.glb` → cube renders
- [ ] Drop a `.txt` file → red error banner shows
- [ ] BuildPlate visible under model
- [ ] AxisCube in top-right tracks camera orientation
- [ ] OrbitControls work: drag to rotate, wheel to zoom, right-drag to pan
- [ ] Z-axis is up (model sits on plate)
```

- [ ] **Step 2: Run through the checklist manually**

Spin up dev server, walk through each checkbox. Fix any failures (commit fixes per-issue).

- [ ] **Step 3: Commit**

```bash
git add docs/m1-smoke-test.md
git commit -m "docs: add M1 smoke test checklist"
```

---

## M1 Done

At this point Pasak has a working 3D viewer foundation. Next milestone: M2 (Single-cut MVP) integrates Manifold WASM and adds the cut + dowel + export flow.
