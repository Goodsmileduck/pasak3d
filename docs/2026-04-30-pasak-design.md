# Pasak — Design Document

**Date:** 2026-04-30
**Status:** Approved (ready for implementation plan)
**Project root:** `/home/goodsmileduck/local/personal/3dlab/pasak/`

## Summary

Pasak is a web + desktop tool for cutting large 3D mesh models into smaller, printable parts joined by dowel connectors. Free public alternative to LuBan3D, doubling as an SEO/lead asset for 3D Lab Bali. Architecture mirrors the existing `viewer-3d` project (sister project at `../viewer-3d/`): single React + R3F frontend, two build targets (Cloudflare Pages for web, Tauri v2 for desktop). All compute runs client-side in WASM — no backend in v1.

- **Name:** Pasak (Indonesian for "dowel / peg" — directly references the differentiating feature)
- **Web URL:** `pasak.3dlab.id`
- **Tagline:** "Cut large 3D models into printable parts with dowel connections"

## Architecture

Single React + TypeScript + Vite codebase, two build targets, all compute client-side.

```
            ┌──────────── React + R3F + Three.js (shared) ────────────┐
            │  Loaders · Cut engine (Manifold WASM) · Dowel placer    │
            │  Auto-orient · Exporters · Scene · Hooks · UI components │
            └──────────────────────────────────────────────────────────┘
                  │                                       │
       VITE_TARGET=web                          (no env var set)
                  ▼                                       ▼
        ┌──────────────────┐                   ┌──────────────────┐
        │ Cloudflare Pages │                   │   Tauri v2 shell │
        │ pasak.3dlab.id   │                   │  Pasak.exe (Win) │
        │  (static only)   │                   │  + auto-updater  │
        └──────────────────┘                   └──────────────────┘
```

### Key properties

- **No backend in v1.** Everything — file load, mesh booleans, dowel generation, auto-orient, export — runs in the user's browser or Tauri WebView. No D1, no R2, no Pages Functions, no auth. CF Pages serves static assets only.
- **Manifold-3d (WASM) is the compute engine.** Loaded once on app start in a Web Worker so the main thread stays responsive while cuts run. If WASM init fails, show a "try again" button rather than a blank screen.
- **Same `VITE_TARGET=web` gating pattern as viewer-3d.** Desktop-only features (native file dialogs, larger memory budget, OS file association) live behind `import.meta.env.VITE_TARGET !== 'web'`.
- **Memory safety on web.** Show a non-blocking warning toast on import if uploaded mesh > 100MB or > 1M triangles ("Large mesh — cuts may be slow or fail. The desktop version handles big files better."). User can proceed anyway. Desktop has no such warning since the Tauri WebView has more headroom.
- **No telemetry, no analytics, no accounts in v1.** Public tool, anonymous use.

## Project structure

```
pasak/
├── src/                          React frontend (shared)
│   ├── App.tsx                   App shell, file loading
│   ├── components/
│   │   ├── Viewer.tsx            R3F canvas, scene, camera
│   │   ├── DropZone.tsx          File drag/drop (port from viewer-3d)
│   │   ├── Toolbar.tsx           Top toolbar: open, undo/redo, export
│   │   ├── CutPlane.tsx          Draggable cut-plane gizmo
│   │   ├── CutPanel.tsx          Side panel: axis, position, dowels, tolerance
│   │   ├── PrinterPanel.tsx      Printer presets + custom build volume
│   │   ├── PartsTree.tsx         Parts tree with visibility toggles
│   │   ├── DowelMarkers.tsx      Render dowel positions on cut surface
│   │   ├── ExplodedView.tsx      Slider-controlled exploded view
│   │   ├── BuildPlate.tsx        Reused from viewer-3d
│   │   ├── AxisCube.tsx          Reused from viewer-3d
│   │   ├── StatusBar.tsx         Reused from viewer-3d
│   │   └── HelpOverlay.tsx       Keyboard shortcuts
│   ├── lib/
│   │   ├── loaders/              STL, OBJ, 3MF, GLB — copied from viewer-3d
│   │   ├── exporters/            STL, 3MF, save.ts — copied from viewer-3d
│   │   ├── cut/
│   │   │   ├── manifold.ts       Manifold WASM init + worker bridge
│   │   │   ├── plane-cut.ts      Cut a mesh with a plane → 2 meshes
│   │   │   ├── dowel-place.ts    Auto-distribute dowels on a cut surface
│   │   │   ├── dowel-apply.ts    Subtract holes from both halves; emit dowel pieces
│   │   │   └── auto-orient.ts    Find largest flat face → rotate part down
│   │   ├── bvh.ts                Reused from viewer-3d
│   │   ├── model-info.ts         Reused from viewer-3d
│   │   ├── scene.ts              Reused from viewer-3d
│   │   └── printer-presets.ts    Bambu A1/X1, Prusa MK4, Ender 3, custom
│   ├── workers/
│   │   └── cut-worker.ts         Manifold-3d ops on a Web Worker
│   ├── hooks/
│   │   ├── useCutSession.ts      Central state: parts tree, history, dirty flag
│   │   ├── usePlaneController.ts Drag/snap behavior of the cut-plane gizmo
│   │   ├── useExport.ts          Adapted from viewer-3d (multi-part export)
│   │   ├── useTheme.ts           Reused
│   │   └── useViewerControls.ts  Reused
│   └── types/
│       └── index.ts              Part, Cut, Dowel, PrinterPreset, Session
├── src-tauri/                    Rust shell (copy structure from viewer-3d)
│   ├── src/lib.rs                read_file, get_cli_file
│   ├── tauri.conf.json           productName "Pasak"; .stl/.obj/.3mf assoc
│   └── icons/                    New icons (Pasak branding)
├── public/                       Manifold WASM, sample .stl, favicon
├── tests/                        Vitest — cut math, dowel placement, exports
├── docs/                         Specs, design notes, decision log
├── .github/workflows/            deploy-web, release, deploy-preview, cleanup-*
├── package.json
├── vite.config.ts
├── wrangler.toml                 Pages project name "pasak"
├── index.html
├── README.md
└── CLAUDE.md                     Project notes (mirrors viewer-3d's)
```

### Reuse strategy

Copy code from `viewer-3d/` (don't symlink or share via npm package). The two projects will diverge — version-locking them via a shared package would slow both down. Keep loaders/exporters/scene utilities identical at the start; let them drift naturally as each project's needs evolve.

## Dependencies

| Package | Purpose | Source |
|---|---|---|
| `react`, `react-dom`, `@types/react` | UI framework | new |
| `vite`, `typescript` | Build/dev | new |
| `three`, `@react-three/fiber`, `@react-three/drei` | 3D scene | match viewer-3d |
| `three-mesh-bvh` | Raycasting acceleration | match viewer-3d |
| **`manifold-3d`** | **Mesh boolean engine (WASM) — the one big new dep** | new |
| `fflate` | ZIP for multi-STL export and 3MF | match viewer-3d |
| `vitest`, `@vitest/ui` | Tests | match viewer-3d |
| `@tauri-apps/api`, `@tauri-apps/plugin-*` | Tauri runtime + updater + dialog/fs | match viewer-3d |

### Manifold-3d notes

- Ships its own `.wasm` file. Same Vite handling pattern as viewer-3d's `occt-import-js`: `?url` import in the worker, `assetsInclude: ["**/*.wasm"]` in `vite.config.ts`.
- Manifold expects watertight meshes. Need a "make-manifold / repair" pre-pass for STLs from the wild (most are non-manifold). Manifold has tooling for this; wire it in as the import step.

## Domain model

```ts
type PartId = string  // "p_a3f1" — short stable id

type Part = {
  id: PartId
  name: string                    // "Body", "Body-L", "Body-L-top"
  mesh: THREE.Mesh                // current geometry (post-cuts, post-dowels)
  source: 'import' | 'cut'
  parentId: PartId | null         // tree: who was I cut from?
  cutId: CutId | null             // which cut produced me (null for imports)
  visible: boolean
  color: string                   // auto-assigned for visual distinction
  bbox: THREE.Box3                // cached
  triCount: number                // cached
  printerFitStatus: 'fits' | 'too-big' | 'unknown'
}

type CutId = string

type Cut = {
  id: CutId
  partId: PartId                  // which part was cut
  plane: { normal: [x,y,z], constant: number }
  axisSnap: 'x' | 'y' | 'z' | 'free'
  dowels: Dowel[]
  tolerance: TolerancePreset
  resultPartIds: [PartId, PartId]
  createdAt: number
}

type Dowel = {
  id: string
  position: [x,y,z]               // on the cut plane in world space
  axis: [x,y,z]                   // perpendicular to cut plane
  diameter: number                // mm — peg outer diameter
  length: number                  // mm — total length (sticks half into each side)
  source: 'auto' | 'manual'       // manual dowels survive auto-replace
}

// Radial clearance per hole. Hole radius = dowel radius + clearance.
// Same clearance applied to both holes (separate-dowel design),
// so total play between the two halves = 2 × clearance.
type TolerancePreset =
  | 'pla-tight'    // 0.10mm radial clearance
  | 'pla-loose'    // 0.20mm
  | 'petg'         // 0.25mm
  | 'sla'          // 0.05mm

type PrinterPreset = {
  id: string
  name: string                    // "Bambu Lab A1"
  buildVolume: { x: number, y: number, z: number }  // mm
}

type Session = {
  rootParts: Part[]               // imported originals
  parts: Map<PartId, Part>        // all parts (root + derived), keyed
  cuts: Cut[]                     // history, ordered
  history: HistoryEntry[]         // for undo/redo
  printer: PrinterPreset | null   // null = no printer constraint shown
  explodeFactor: number           // 0..1, for exploded view
}
```

## Cut pipeline (one cut, end-to-end)

1. User selects a part in PartsTree (or it's the only part).
2. User clicks "X-axis cut" → CutPlane appears at part's centroid, normal = +X.
3. User drags plane along its normal (or types exact mm).
4. Live preview: render a translucent cut-line where plane meets mesh. No boolean yet.
5. User clicks "Place dowels" or "Cut now":
   - **If "Place dowels" first:**
     - `dowel-place.ts` projects cut-plane intersection → 2D polygon
     - Distributes N dowels using inscribed-circle / Poisson sampling
     - Renders DowelMarkers; user can drag, add (click empty space on plane), or delete
   - Then user clicks "Cut now":
6. Worker: `cut-worker.postMessage({ op: 'cut', partId, plane, dowels, tolerance })`.
7. In worker (off main thread):
   1. `plane-cut.ts`: `Manifold.split(mesh, plane) → [meshA, meshB]`
   2. `dowel-apply.ts`: for each dowel, build a cylinder; subtract from BOTH `meshA` and `meshB` (separate dowel pieces — Q1 = B). Generate matching dowel cylinders sized = hole radius − tolerance for the dowel-pieces output bucket.
   3. Return `[meshA, meshB]` as transferable buffers, plus `dowelMeshes: Mesh[]`.
8. Main thread: receive buffers, hydrate as `THREE.Mesh`, register as new Parts, hide parent (Q2 = B — parent stays in tree, hidden), update PartsTree, push HistoryEntry.
9. `auto-orient.ts` rotates each new part so its largest flat face is on Z=0.
10. `printerFitStatus` recomputed for all visible parts.

### Dowel style decision (Q1 = B)

**Separate dowel pieces.** Both halves get holes. The export zip includes a `dowels.stl` with the dowel pieces grouped (named like `dowels_5x20mm_qty4.stl`). Users can choose to print the dowels or substitute real wood/metal dowels of matching dimensions. Default tolerance applies the same radial clearance to both holes (so total play between halves is 2× the listed tolerance value).

### Parent-part decision (Q2 = B)

**Parent parts stay in the tree, hidden by default.** This enables clean undo/redo and lets users see the cut history visually. Memory cost is bounded — most users do <5 cuts per session.

## UX

### Layout (single screen, no routing in v1)

```
┌──────────────────────────────────────────────────────────────────┐
│ Toolbar: [Open] [Undo] [Redo]              [Printer▾] [Export▾]  │
├──────────────────┬───────────────────────────────────────────────┤
│                  │                                               │
│  Parts Tree      │                                               │
│  ─ Body          │                                               │
│    ├─ Body-L     │           3D Viewport (R3F)                   │
│    └─ Body-R     │           - model + cut plane gizmo           │
│                  │           - dowel markers                     │
│                  │           - build plate (optional)            │
│ ─────────────    │           - axis cube (corner)                │
│  Cut Panel       │                                               │
│  Axis: [X][Y][Z] │                                               │
│  Position: 32mm  │                                               │
│  ┌─Dowels──────┐ │                                               │
│  │ Auto: 4     │ │                                               │
│  │ Size: 5mm   │ │                                               │
│  │ Length: 20mm│ │                                               │
│  └─────────────┘ │                                               │
│  Tolerance:      │                                               │
│  [PLA-tight ▾]   │                                               │
│  [Cancel] [Cut]  │                                               │
│                  │                                               │
├──────────────────┴───────────────────────────────────────────────┤
│ Status: 1 part loaded · 24,318 tris · 80×60×120mm · Fits Bambu  │
└──────────────────────────────────────────────────────────────────┘
```

### Primary flows

**Flow 1 — Open and inspect**

1. Drop `model.stl` onto window (or File → Open, or Tauri file association on desktop).
2. Mesh imports; Manifold runs `make-manifold` repair pass; status bar reports tri count + dimensions.
3. Status bar shows printer-fit if a printer is selected (default: none).

**Flow 2 — Make a single cut**

1. Select part in PartsTree (auto-selected if only one).
2. Click axis button (X / Y / Z) in CutPanel → cut-plane gizmo appears at part centroid.
3. Drag plane along axis (keyboard arrows for fine adjust), or type position in mm.
4. Live preview line shows where cut will land on mesh surface.
5. Adjust dowel count / size / length; markers appear and reposition live.
6. Drag individual dowel markers, click empty plane to add, or click marker + Delete to remove.
7. Click "Cut" → worker runs (~0.5–3s for typical models, spinner shown).
8. Result: parent hides, two children appear in tree, scene updates, parts auto-orient.

**Flow 3 — Multi-cut (cut a child)**

1. Select a child part in tree.
2. Repeat Flow 2 — same UI, cuts produce grandchildren.
3. PartsTree shows depth visually.

**Flow 4 — Fit-to-printer suggest**

1. Select printer from dropdown (Bambu A1, X1, Prusa MK4, Ender 3, custom).
2. If any part is too big, status bar turns amber and shows "1 part too big — Suggest cuts" link.
3. Click link → tool computes a cut plan: along the longest axis, evenly spaced, just enough cuts to fit.
4. Shows preview: "Will add 2 cuts producing 3 parts." User clicks "Apply" or "Cancel."
5. On Apply: cuts run sequentially, each with default dowel placement.

**Flow 5 — Exploded view**

A slider in the toolbar (0 to 100). At 0, parts are in original positions. As slider increases, each part translates outward along the cut normal, separated by `slider × bbox.diagonal × 0.5`. Translation only — no rotation animations.

**Flow 6 — Export**

Click Export → modal:
- Format: zip-of-STL (default) / single 3MF multi-object
- "Include dowels" checkbox (default on)
- "Auto-orient parts to Z=0" checkbox (default on)
- Filename: `<original-name>-pasak.zip` or `.3mf`

On confirm: serialize all visible parts + dowel meshes; write file via browser blob download or Tauri save dialog.

### Keyboard shortcuts

| Key | Action |
|---|---|
| `O` | Open file |
| `X` / `Y` / `Z` | Start cut on selected axis |
| `Enter` | Confirm cut (when cut panel is active) |
| `Esc` | Cancel cut / close modal |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Undo / redo |
| `H` | Toggle build plate visibility |
| `E` | Toggle exploded view |
| `Ctrl+E` | Open export dialog |
| `?` | Show help overlay |

### Empty state

Centered DropZone with sample model link ("Try with a sample chess piece") and one-liner: "Cut large 3D models into printable parts with dowel connections."

### Error states

- **Non-manifold mesh that can't be repaired:** modal — "This mesh has gaps and can't be cut reliably. Try repairing it in your CAD/slicer first." with link to common repair tools.
- **Cut produced empty result** (plane outside mesh): toast — "Cut plane doesn't intersect the part. Try repositioning."
- **Memory pressure / WASM crash:** toast + offer reload — "Cut failed (out of memory). For meshes this large, try the desktop version."

## Build & deploy

### Commands

```bash
npm run dev:web        # Vite dev server, web target only
npm run dev            # Alias for dev:web
npm run tauri dev      # Desktop dev (Tauri + Vite)
npm run build:web      # VITE_TARGET=web tsc + vite build → dist/
npm run build          # Tauri build (desktop installer)
npm run test           # Vitest single run
npm run test:watch     # Vitest watch mode
npm run typecheck      # tsc --noEmit
```

### Web deploy

- **Cloudflare Pages project name:** `pasak`
- **Custom domain:** `pasak.3dlab.id`
- **Workflow:** `.github/workflows/deploy-web.yml` — on push to `main`, build with `VITE_TARGET=web`, deploy `dist/` to Pages.
- **PR previews:** `deploy-preview.yml` — auto-deploy preview URL on PRs (skip drafts).
- **Cleanup:** `cleanup-preview.yml` deletes preview deployments when PR closes; `cleanup-production.yml` prunes old production deployments.
- **No `wrangler.toml` bindings in v1** — no D1, no R2, no secrets. `wrangler.toml` only declares the Pages project name and build output dir.

### Desktop deploy

- **Workflow:** `.github/workflows/release.yml` — on `v*.*.*` tag push, build Windows installer, create GitHub Release.
- **Auto-updater:** Tauri updater plugin checks GitHub Releases on startup (3s delay). Same `useAutoUpdate` hook + `UpdateNotification` banner pattern as viewer-3d.
- **Code signing:** Reuse the same `TAURI_SIGNING_PRIVATE_KEY` GitHub secret pattern. **Generate a fresh keypair for Pasak** (do not reuse viewer-3d's) so the apps are independently signed.
- **R2 download bucket:** Defer until v1.1. For v1, ship Windows-only installers via GitHub Releases; link to Release page from a `/download` route on the web app. (Same `if: false` pattern viewer-3d uses today.)

## Testing

### Unit tests (Vitest) — must exist before code ships

| Module | What's tested |
|---|---|
| `lib/cut/plane-cut.ts` | Cut a unit cube with various planes; assert two output volumes sum to ~original; assert no degenerate triangles |
| `lib/cut/dowel-place.ts` | Auto-place on known polygons; assert all dowels inside polygon, min spacing respected, count matches request |
| `lib/cut/dowel-apply.ts` | Apply dowels to cut cube; assert resulting volume = cube_half − hole_volume; assert hole position matches dowel position |
| `lib/cut/auto-orient.ts` | Known shapes (L-bracket, sphere, cube): assert largest face ends up on Z=0 |
| `lib/loaders/*` | Round-trip: load → mesh → re-export → re-load → identical bbox + tri count (port from viewer-3d) |
| `lib/exporters/*` | 3MF multi-object: load result back, assert all parts present, transforms preserved |
| `lib/printer-presets.ts` | Bbox vs printer volume math for parts at various rotations |

### Manual smoke tests before each release

- Sample model `charizard-keycap.3mf` (already in viewer-3d) — cut, place dowels, export, verify result opens cleanly in Bambu Studio / Orca / PrusaSlicer.
- A larger model (~10MB STL) — verify worker doesn't block UI, cut completes in <5s on a typical laptop.
- A non-manifold mesh — verify repair pass works or error modal shows.
- Web on Chrome / Firefox / Safari, mobile Chrome (read-only — cuts allowed but warned about memory).
- Desktop on Windows (auto-updater check, file association via "Open with").

### Playwright (deferred for v1)

Visual regression of the splitter UI is low-value vs. the cost. Add Playwright for the key happy path in v1.1 if it turns out to matter.

## Out of v1 scope

- STEP / STP input files
- Build-plate packing (auto-arrange parts on the plate)
- Free-form / sketched cuts (only planar cuts in v1)
- Connector library beyond round dowels (no dovetails, puzzle joints, hex inserts, magnet pockets, screw bosses)
- Accounts, share links, project saves (no D1, no R2)
- Mobile-optimized UI (mobile loads but warns)
- Mac/Linux desktop builds (Windows only in v1)
- Telemetry / analytics / usage tracking
- Internationalization / Indonesian-language UI (English only in v1; the **name** is Indonesian, the UI is English — easier for SEO and matches viewer-3d)
- Cut history persistence across reloads (in-memory only)
- Preview "what does the export look like in my slicer" — that's the slicer's job

## Roadmap (post-v1, rough priority order)

1. **v1.1** — Build-plate packing (2D bin-packing with rotation), Mac/Linux desktop builds, R2 download bucket
2. **v1.2** — STEP support with mesh-conversion warning
3. **v1.3** — Connector library expansion (dovetail, puzzle-tab, hex insert)
4. **v2.0** — Accounts + share links (port from viewer-3d's auth + share infra)
5. **v2.x** — Free-form sketched cuts (the hard one)

## Decision log

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | Primary user / device | Public web tool, eventually | Free LuBan3D alternative + SEO/lead asset for 3D Lab Bali |
| 2 | Cut placement UX | Plane drag + fit-to-printer auto-suggest | Manual control + headline auto feature |
| 3 | Dowel placement | Auto with manual override | Magic by default, control when needed |
| 4 | v1 scope | Balanced MVP | Multi-cut, auto-orient, presets, web+desktop together |
| 5 | Input formats | Mesh-only (STL, OBJ, 3MF, GLB) | STEP support inflates surface area without solving real Pasak need |
| 6 | Name | Pasak | Indonesian for "dowel" — names the differentiator; available domain |
| 7 | Dowel style | Separate dowel pieces (both halves get holes) | Cleanest prints; users can substitute wood/metal dowels |
| 8 | Parent-part handling on cut | Keep parent in tree, hidden | Enables clean undo/redo and visible cut history |
