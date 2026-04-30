# Pasak — Claude Notes

## Project

Web + desktop tool to cut large 3D meshes into printable parts joined by separate dowel pieces. React + TypeScript + Vite frontend, Tauri v2 (Rust) for desktop, Cloudflare Pages for web. All compute client-side via Manifold (WASM).

- **App name:** Pasak (Indonesian for "dowel / peg")
- **Web URL:** https://pasak.3dlab.id
- **Sister project:** `../viewer-3d/` — shared loader / scene patterns, but the codebase is forked (not symlinked).

## Development Rule

All frontend changes must work in both targets. Verify with `npm run build:web` (web) and `npm run build` (desktop) before considering a task done. Platform-specific code is gated by `import.meta.env.VITE_TARGET !== 'web'` (desktop builds do not set `VITE_TARGET`).

## Key Commands

```bash
# Desktop dev (requires Rust)
source "$HOME/.cargo/env" && npm run tauri dev

# Web dev
npm run dev:web

# Build checks
npm run build          # Desktop bundle (Tauri's beforeBuild → tsc + vite build with VITE_TARGET unset)
npm run build:web      # Web bundle (VITE_TARGET=web tsc + vite build, externalizes Tauri imports)

# Tests
npm run test
npm run test:watch

# Regenerate icons
npm run tauri icon src-tauri/icons/icon.png
```

## Structure

```
src/
  App.tsx                          App shell, location-based routing, file loading
  pages/DownloadPage.tsx           /download (link to GitHub Releases)
  components/                      Viewer, Toolbar, CutPanel, CutPlane,
                                   PartsTree, DowelMarkers, ExplodedView,
                                   PrinterPanel, BuildPlate, AxisCube,
                                   StatusBar, DropZone, Spinner,
                                   ExportDialog, HelpOverlay,
                                   UpdateNotification
  lib/
    loaders/                       STL, OBJ, 3MF, GLB (mesh-only — no STEP)
    parsers/                       Pure parser functions for each format
    exporters/                     STL, 3MF (multi-object), zip-export, save (browser/Tauri)
    cut/
      manifold.ts                  Manifold WASM init
      convert.ts                   THREE ↔ Manifold (auto-merges verts)
      plane-cut.ts                 splitByPlane → 2 manifolds
      cut-polygon.ts               Extract 2D cross-section from mesh+plane
      dowel-place.ts               Grid sampling on polygon
      auto-place-cut-dowels.ts     Wires cut-polygon + dowel-place
      dowel-apply.ts               Subtract holes, build dowel pieces
      auto-orient.ts               Largest-face-down rotation + Z=0 placement
      fit-to-printer.ts            Suggest cuts for build volume
      cut-client.ts                Worker bridge
    session.ts                     Pure session reducer
    printer-presets.ts             Bambu / Prusa / Ender / Voron volumes
    bvh.ts, model-info.ts, scene.ts, constants.ts
  workers/cut-worker.ts            Manifold ops on a Web Worker
  hooks/                           useCutSession, useViewerControls,
                                   useTheme, useAutoUpdate, useKeyboard
  types/index.ts                   Domain types
src-tauri/                         Rust shell (Tauri v2)
.github/workflows/
  deploy-web.yml                   Web → CF Pages on main; auto-tags + triggers release
  release.yml                      Desktop → GitHub Releases on v* tags
  deploy-preview.yml               Web preview on PRs (only when version is bumped)
  cleanup-preview.yml              Delete preview deploys on PR close
  cleanup-production.yml           Prune old prod deploys (keep 5 most recent)
docs/                              Spec, milestone plans, smoke test checklists
```

## Web Routes

- `/` — Pasak app
- `/download` — Desktop download landing

CF Pages serves index.html for any unknown path, so client-side routing via `window.location.pathname` works without server config.

## Web Infrastructure

- **Hosting:** Cloudflare Pages (custom domain: `pasak.3dlab.id`)
- **API:** None in v1 (pure static)
- **Database/Storage:** None in v1
- **Pages project name:** `pasak`

## Cut / Dowel Design Conventions

- **Z-up axis** (matches viewer-3d). Cameras configured with `up = (0, 0, 1)`. Models centered on XY, sit on Z=0.
- **Separate dowels:** Both halves of a cut get holes; dowels are emitted as separate cylindrical meshes. User prints them, or substitutes wood/metal.
- **Tolerance:** Radial clearance per hole. Total play = 2× clearance. Presets: pla-tight (0.10), pla-loose (0.20), petg (0.25), sla (0.05).
- **Parent parts** stay in tree (hidden) after a cut for clean undo/redo.
- **Auto-orient** runs after every cut so the largest flat face lands on Z=0.

## Manifold API Quirks (discovered during M2)

- The actual API is `manifold.splitByPlane(normal, constant)` returning `[pos, neg]` — NOT `split([n], c)`.
- `manifold.transform(mat)` takes a column-major **16-element** Mat4, NOT row-major 4×3.
- `meshToManifold` runs `mergeVertices` first because THREE.BoxGeometry / loader output is non-manifold by default (per-face vertex duplication).
- 128 cylinder facets needed for `toBeCloseTo(expected, 0)` precision in volume tests.
- fflate's `instanceof u8` check rejects jsdom-realm Uint8Arrays from `strToU8` and `TextEncoder`. Workaround: `new Uint8Array(encoded.buffer, encoded.byteOffset, encoded.byteLength)`.

## Release Process

**Web:** Push to `main` → auto-deploys to Cloudflare Pages. If `package.json` version is bumped, the workflow tags `vX.Y.Z` and triggers `release.yml` for the desktop build.

**Desktop:** Tag `v*.*.*` (manual or auto-tag from web deploy) → GitHub Actions builds the Windows installer and creates a GitHub Release.

```bash
# Bump version, push (web deploy will tag + trigger desktop release)
npm version patch    # or minor / major
git push --follow-tags
```

## Auto-Update (Desktop)

Tauri updater plugin checks GitHub Releases for new versions on app startup (3s delay).
- **`useAutoUpdate`** hook — checks `@tauri-apps/plugin-updater`, tracks download progress.
- **`UpdateNotification`** — top-center banner with progress bar.
- **Config:** `src-tauri/tauri.conf.json` `plugins.updater` — endpoint points to GitHub Releases `latest.json`, install mode `passive` (NSIS).
- **Capabilities:** `src-tauri/capabilities/default.json` — explicit perms for updater, dialog, fs, shell, process.
- **Signing:** `release.yml` uses `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` GitHub secrets. The `pubkey` in `tauri.conf.json` must be the corresponding Ed25519 public key (NEW pair generated for Pasak — do NOT reuse viewer-3d's keys).

## What Pasak Is NOT (yet)

- Not a slicer
- Not STEP-aware (mesh-only inputs; STEP support is v1.2+)
- No accounts, no shares (deferred to v2.0)
- No Mac/Linux desktop builds (v1.1)
- No connector library beyond round dowels (v1.3)
- No build-plate packing (v1.1)
- No mobile-optimized UI

## Sample Models for Testing

- `tests/fixtures/cube.stl` — 12-tri cube
- `tests/fixtures/sample.3mf` — keycap (copied from viewer-3d)
- `tests/fixtures/cube.obj` — text OBJ cube
- `tests/fixtures/cube.glb` — hand-crafted minimal glTF binary
- `public/sample-keycap.3mf` — same keycap, served as static asset for empty-state link

## Known Issues / Notes

- **Workers were dropped from loaders** — the parser stack runs synchronously in pure functions. This is a deviation from viewer-3d. Big STL files will briefly block the main thread on import. Cut work IS in a worker.
- **BuildPlate canvas text still says "3D Lab Viewer"** — cosmetic carry-over from the port. Polish before public launch.
- **Cargo.lock** is committed — required for reproducible builds and CI cache key.
- **GitHub Actions (desktop):** `tauri-apps/tauri-action@action-v0.6.1`, `windows-latest`, triggered by `v*.*.*` tags.
- **Pages PR previews** require version bump in package.json — otherwise the workflow comments "skipped" instead of deploying.
- **Web memory:** browsers may OOM on very large meshes. Soft warning toast on import; recommend desktop for big files.
- **WSL2:** libEGL/MESA warnings on `tauri dev` are harmless (software rendering fallback).
