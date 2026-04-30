# Pasak M4 — Desktop Shell + Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Prerequisite:** M3 complete (full v1 web feature set working).

**Goal:** Ship Pasak. Add the Tauri v2 desktop shell with auto-updater and Windows installer build, set up GitHub Actions for both web (Cloudflare Pages) and desktop (GitHub Releases) deployment, configure the `pasak.3dlab.id` custom domain, and finalize project docs.

**Architecture:** Same shared React frontend as M1-M3, now wrapped by Tauri v2 for the Windows desktop build. The web target stays static-only on Cloudflare Pages — no Pages Functions, no D1, no R2 (deferred to v2.0). Desktop installers ship via GitHub Releases; auto-updater reads `latest.json` from the release.

**Tech Stack:** Tauri 2, Rust stable, GitHub Actions, Cloudflare Pages, Wrangler 4. Sister project `viewer-3d` is the reference for every Tauri/CI file in this milestone.

**Sister project for reference:** `/home/goodsmileduck/local/personal/3dlab/viewer-3d/` — port `src-tauri/`, `.github/workflows/`, `wrangler.toml`, plus the `useAutoUpdate` hook and `UpdateNotification` component.

**Working directory:** `/home/goodsmileduck/local/personal/3dlab/pasak/`

---

## Pre-flight (manual, one-time setup)

Before running any of the tasks below, complete these manual setup steps. They produce credentials needed by later tasks.

- [ ] **Create GitHub repository for Pasak**
  - Repo name: `pasak` (under your `Goodsmileduck` GitHub account)
  - Push the local repo: `git remote add origin git@github.com:Goodsmileduck/pasak.git && git push -u origin main`

- [ ] **Generate Tauri signing keypair** (different from viewer-3d's)
  ```bash
  cd /home/goodsmileduck/local/personal/3dlab/pasak
  npx -y @tauri-apps/cli signer generate -w ~/.tauri/pasak.key
  ```
  Save the password securely. The output prints both private and public keys. The public key goes into `tauri.conf.json` (Task 5). The private key + password become GitHub secrets.

- [ ] **Add GitHub secrets to the `pasak` repo**
  In repo Settings → Secrets and variables → Actions:
  - `TAURI_SIGNING_PRIVATE_KEY` — contents of `~/.tauri/pasak.key`
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — the password
  - `CF_API_TOKEN` — Cloudflare API token with Pages:Edit permission
  - `CF_ACCOUNT_ID` — Cloudflare account ID

- [ ] **Create Cloudflare Pages project** (manual, in CF dashboard)
  - Name: `pasak`
  - Production branch: `main`
  - Build command: leave empty (we deploy pre-built `dist/` via wrangler-action)
  - Output directory: `dist`
  - After creation, note the auto-assigned subdomain (likely `pasak.pages.dev` or `pasak-XXX.pages.dev` if name was taken)

- [ ] **Configure custom domain `pasak.3dlab.id`** in CF Pages
  - Pages → pasak → Custom domains → Add → `pasak.3dlab.id`
  - Cloudflare will auto-create the CNAME if `3dlab.id` is on the same Cloudflare account

---

## Task 1: Add Tauri scripts and runtime deps

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add Tauri scripts and dependencies**

Edit `package.json`. Append to `scripts`:
```json
"tauri": "tauri",
"build:tauri": "tauri build"
```

Add to `dependencies`:
```json
"@tauri-apps/api": "^2.0.0",
"@tauri-apps/plugin-dialog": "^2.0.0",
"@tauri-apps/plugin-fs": "^2.0.0",
"@tauri-apps/plugin-process": "^2.3.1",
"@tauri-apps/plugin-shell": "^2.0.0",
"@tauri-apps/plugin-updater": "^2.10.0"
```

Add to `devDependencies`:
```json
"@tauri-apps/cli": "^2.0.0"
```

Update existing `dev` script to default to Tauri-friendly behavior; rename current `dev` to `dev:web`:
```json
"dev": "tauri dev",
"dev:web": "VITE_TARGET=web vite",
```

- [ ] **Step 2: Install**

Run: `npm install`
Expected: lockfile updated, packages installed.

- [ ] **Step 3: Update `vite.config.ts` to externalize Tauri imports for web build**

Edit `vite.config.ts`. Change the `build.rollupOptions` block to:
```ts
build: {
  rollupOptions: isWeb
    ? {
        external: [
          "@tauri-apps/api",
          "@tauri-apps/api/core",
          "@tauri-apps/plugin-dialog",
          "@tauri-apps/plugin-fs",
          "@tauri-apps/plugin-shell",
          "@tauri-apps/plugin-updater",
          "@tauri-apps/plugin-process",
        ],
      }
    : {},
},
```

Add the dev server config block (only applies to non-web builds):
```ts
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
```

- [ ] **Step 4: Verify web build still works**

Run: `npm run build:web`
Expected: succeeds with no Tauri import errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vite.config.ts
git commit -m "feat(m4): add Tauri runtime deps and externalize for web build"
```

---

## Task 2: Tauri scaffolding

**Files:**
- Source: `/home/goodsmileduck/local/personal/3dlab/viewer-3d/src-tauri/`
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/build.rs`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/src/lib.rs`
- Create: `src-tauri/icons/` (placeholder)
- Create: `src-tauri/.gitignore`

- [ ] **Step 1: Create `src-tauri/Cargo.toml`**

```toml
[package]
name = "pasak"
version = "0.1.0"
description = "Pasak — cut 3D models with dowel connections"
edition = "2021"

[lib]
name = "pasak_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-dialog = "2"
tauri-plugin-fs = "2"
tauri-plugin-shell = "2"
tauri-plugin-updater = "2"
tauri-plugin-process = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"

[features]
custom-protocol = ["tauri/custom-protocol"]
```

- [ ] **Step 2: Create `src-tauri/build.rs`**

```rust
fn main() {
    tauri_build::build();
}
```

- [ ] **Step 3: Create `src-tauri/src/main.rs`**

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    pasak_lib::run();
}
```

- [ ] **Step 4: Create `src-tauri/src/lib.rs`**

Read `viewer-3d/src-tauri/src/lib.rs` for the canonical pattern. Port the `read_file` and `get_cli_file` commands (they are reusable verbatim). The Pasak version:

```rust
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[tauri::command]
fn read_file(path: String) -> Result<Vec<u8>, String> {
    fs::read(&path).map_err(|e| format!("Failed to read {}: {}", path, e))
}

#[tauri::command]
fn get_cli_file() -> Option<String> {
    let args: Vec<String> = std::env::args().collect();
    args.get(1).cloned()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![read_file, get_cli_file])
        .setup(|_app| Ok(()))
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 5: Create `src-tauri/.gitignore`**

```
target
gen/schemas
```

- [ ] **Step 6: Create placeholder icons**

Generate icons from a single PNG. For now, copy viewer-3d's icons as placeholders (we'll re-skin in Task 6):
```bash
mkdir -p src-tauri/icons
cp /home/goodsmileduck/local/personal/3dlab/viewer-3d/src-tauri/icons/* src-tauri/icons/
```

- [ ] **Step 7: Verify Cargo files compile (dry)**

Run: `cd src-tauri && cargo check && cd ..`
Expected: succeeds (~2-3 min on first run for crate downloads).

- [ ] **Step 8: Commit**

```bash
git add src-tauri/
git commit -m "feat(m4): scaffold Tauri v2 backend (Rust)"
```

---

## Task 3: tauri.conf.json

**Files:**
- Create: `src-tauri/tauri.conf.json`

- [ ] **Step 1: Write config**

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Pasak",
  "version": "0.1.0",
  "identifier": "id.3dlab.pasak",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:1420",
    "beforeDevCommand": "npm run dev:web",
    "beforeBuildCommand": "npm run build:web"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "Pasak",
        "width": 1280,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false,
        "decorations": true
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "createUpdaterArtifacts": true,
    "fileAssociations": [
      { "ext": ["stl"], "name": "STL File", "description": "STL 3D Model", "role": "Editor" },
      { "ext": ["obj"], "name": "OBJ File", "description": "OBJ 3D Model", "role": "Editor" },
      { "ext": ["3mf"], "name": "3MF File", "description": "3MF 3D Model", "role": "Editor" },
      { "ext": ["glb"], "name": "GLB File", "description": "GLB 3D Model", "role": "Editor" }
    ],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  },
  "plugins": {
    "updater": {
      "endpoints": [
        "https://github.com/Goodsmileduck/pasak/releases/latest/download/latest.json"
      ],
      "pubkey": "REPLACE_WITH_PASAK_PUBKEY_FROM_PREFLIGHT",
      "windows": {
        "installMode": "passive"
      }
    }
  }
}
```

- [ ] **Step 2: Replace `pubkey` with the value from pre-flight signing keypair generation**

Edit `src-tauri/tauri.conf.json`. Replace `REPLACE_WITH_PASAK_PUBKEY_FROM_PREFLIGHT` with the base64 public key emitted by `tauri signer generate`.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/tauri.conf.json
git commit -m "feat(m4): tauri config with file associations and updater"
```

---

## Task 4: Capabilities config

**Files:**
- Create: `src-tauri/capabilities/default.json`

- [ ] **Step 1: Port from viewer-3d and trim**

Read `viewer-3d/src-tauri/capabilities/default.json`. Copy to `pasak/src-tauri/capabilities/default.json` and remove any permissions Pasak doesn't use (e.g., shell:execute, anything HTTP). Keep:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default permissions for Pasak desktop app",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:default",
    "fs:default",
    "fs:allow-read-file",
    "shell:allow-open",
    "updater:default",
    "process:default",
    "process:allow-restart"
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add src-tauri/capabilities/default.json
git commit -m "feat(m4): tauri capabilities config"
```

---

## Task 5: Tauri-aware file open and save

**Files:**
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/App.tsx`
- Modify: `src/lib/exporters/save.ts`
- Modify: `src/hooks/useViewerControls.ts` (add CLI file handling)

- [ ] **Step 1: Update `save.ts` to use Tauri save dialog when on desktop**

```ts
const isDesktop = import.meta.env.VITE_TARGET !== "web";

export async function saveBytes(filename: string, mimeType: string, bytes: Uint8Array | ArrayBuffer): Promise<void> {
  if (isDesktop) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({ defaultPath: filename });
    if (!path) return;
    await writeFile(path, bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
    return;
  }
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

Update `App.tsx` export handler to call `saveBytes(filename, "application/zip", zip)` instead of building the anchor element directly.

- [ ] **Step 2: Add Tauri "Open file" path to Toolbar**

In `App.tsx`, replace the `onOpen` handler:
```ts
const handleOpen = useCallback(async () => {
  if (isDesktop) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readFile } = await import("@tauri-apps/plugin-fs");
    const path = await open({
      multiple: false,
      filters: [{ name: "3D Model", extensions: ["stl", "obj", "3mf", "glb"] }],
    });
    if (typeof path !== "string") return;
    const data = await readFile(path);
    const filename = path.split(/[/\\]/).pop() ?? "model";
    handleFile(new File([data], filename));
  } else {
    fileInputRef.current?.click();
  }
}, [handleFile]);
```

Add `const isDesktop = import.meta.env.VITE_TARGET !== "web";` near the top of App.tsx.

- [ ] **Step 3: CLI file open (file association)**

Add a new effect in App.tsx:
```ts
useEffect(() => {
  if (!isDesktop) return;
  (async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    const path = await invoke<string | null>("get_cli_file");
    if (!path) return;
    const { readFile } = await import("@tauri-apps/plugin-fs");
    const data = await readFile(path);
    const filename = path.split(/[/\\]/).pop() ?? "model";
    handleFile(new File([data], filename));
  })().catch((e) => console.error(e));
}, []);
```

- [ ] **Step 4: Verify web build still passes**

Run: `npm run build:web`
Expected: succeeds. Tauri imports are dynamic, so they won't crash the bundler when externalized.

- [ ] **Step 5: Commit**

```bash
git add src/lib/exporters/save.ts src/App.tsx
git commit -m "feat(m4): Tauri file open/save and file-association launch"
```

---

## Task 6: Auto-update hook and notification

**Files:**
- Source: `/home/goodsmileduck/local/personal/3dlab/viewer-3d/src/hooks/useAutoUpdate.ts` (and `UpdateNotification.tsx`)
- Create: `src/hooks/useAutoUpdate.ts`
- Create: `src/components/UpdateNotification.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Port both files**

Copy `viewer-3d/src/hooks/useAutoUpdate.ts` → `pasak/src/hooks/useAutoUpdate.ts`. Copy `viewer-3d/src/components/UpdateNotification.tsx` → matching path in pasak. Both use dynamic Tauri imports so they're safe in web builds.

- [ ] **Step 2: Wire into App.tsx**

```tsx
import { useAutoUpdate } from "./hooks/useAutoUpdate";
import { UpdateNotification } from "./components/UpdateNotification";

const update = useAutoUpdate();
// in render:
<UpdateNotification {...update} />
```

The hook handles its own no-op behavior on web — `useAutoUpdate` should detect `VITE_TARGET === "web"` and bail.

- [ ] **Step 3: Verify web build**

Run: `npm run build:web`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useAutoUpdate.ts src/components/UpdateNotification.tsx src/App.tsx
git commit -m "feat(m4): auto-update hook and notification banner"
```

---

## Task 7: Pasak icon set

**Files:**
- Create: `src-tauri/icons/icon.png` (replace placeholder)
- Generated: `src-tauri/icons/*` (regenerated by `tauri icon`)

- [ ] **Step 1: Provide a 1024×1024 source icon**

Place a Pasak-branded 1024×1024 PNG at `src-tauri/icons/icon.png`. For initial alpha you can use a simple "P" mark — replace with branded artwork before public launch.

If no source available yet, leave the viewer-3d icons in place and note this as a follow-up item in `docs/m4-followups.md`.

- [ ] **Step 2: Regenerate icon set**

Run: `npx tauri icon src-tauri/icons/icon.png`
Expected: regenerates `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico`, plus square icons for various platforms.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/icons/
git commit -m "feat(m4): Pasak icon set"
```

---

## Task 8: Smoke test the desktop app locally

- [ ] **Step 1: Run desktop dev**

Run: `source "$HOME/.cargo/env" && npm run tauri dev`
Expected: native window opens with Pasak. First build is slow (cargo crate download + compile).

- [ ] **Step 2: Manual checks**

- [ ] App window opens with title "Pasak"
- [ ] DropZone visible
- [ ] File → Open dialog uses native picker (not browser)
- [ ] Drop or open a STL → loads
- [ ] Make a cut → executes; manifold-3d WASM works inside Tauri WebView
- [ ] Export → native save dialog appears; chosen file written to disk
- [ ] Resize window → layout responds
- [ ] Close and re-open via "Open with → Pasak" on a `.stl` file (after first install) — defer to install testing later

- [ ] **Step 3: Build a debug installer**

Run: `npm run tauri build -- --no-bundle` (just to verify the bundle config compiles; we don't need a full installer locally).

If you want a real installer: `npm run tauri build` — produces `.msi` and `.exe` in `src-tauri/target/release/bundle/`. Test by installing.

- [ ] **Step 4: Commit anything that changed during smoke testing**

If you found and fixed bugs:
```bash
git add -A
git commit -m "fix(m4): desktop smoke test fixes"
```

---

## Task 9: GitHub Actions — release.yml (Windows desktop builds)

**Files:**
- Source: `/home/goodsmileduck/local/personal/3dlab/viewer-3d/.github/workflows/release.yml`
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Port and adapt**

Copy `viewer-3d/.github/workflows/release.yml` → `pasak/.github/workflows/release.yml`. Edit:
- `releaseName: 'Pasak ${{ env.TAG }}'`
- `releaseBody: 'Windows installer for Pasak ${{ env.TAG }}'`
- Remove the "Publish release to viewer.3dlab.id repo" step entirely — Pasak ships from its own repo, no cross-repo mirroring needed
- Remove the "Upload installer to R2" step (kept disabled in viewer-3d via `if: false`; deferred to v1.1)

Resulting workflow body:
```yaml
name: Release Windows Build

on:
  push:
    tags:
      - 'v*.*.*'
  workflow_dispatch:
    inputs:
      tag:
        description: 'Version tag (e.g. v1.0.0)'
        required: true
        type: string

env:
  TAG: ${{ inputs.tag || github.ref_name }}

jobs:
  release:
    runs-on: windows-latest
    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ inputs.tag || github.ref }}

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - uses: dtolnay/rust-toolchain@stable

      - uses: mozilla-actions/sccache-action@v0.0.7

      - name: Configure Rust cache
        run: |
          echo "SCCACHE_GHA_ENABLED=true" >> $GITHUB_ENV
          echo "RUSTC_WRAPPER=sccache" >> $GITHUB_ENV
        shell: bash

      - run: npm ci

      - name: Build and sign
        uses: tauri-apps/tauri-action@action-v0.6.1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          tagName: ${{ env.TAG }}
          releaseName: 'Pasak ${{ env.TAG }}'
          releaseBody: 'Windows installer for Pasak ${{ env.TAG }}'
          releaseDraft: false
          prerelease: false
          updaterJsonPreferNsis: true
```

- [ ] **Step 2: Commit and push**

```bash
git add .github/workflows/release.yml
git commit -m "ci(m4): release workflow for Windows desktop builds"
git push
```

- [ ] **Step 3: Trigger a test release**

```bash
git tag v0.1.0
git push origin v0.1.0
```

In GitHub Actions, watch the run. First build ~10-15 min (Rust crate compilation). On success, GitHub Releases page shows `Pasak v0.1.0` with `.msi`, `.exe`, `latest.json`, signature files.

- [ ] **Step 4: Install the released MSI on a Windows machine and verify file association works**

Manual check: install, then double-click an `.stl` file → Pasak should open with the file loaded.

---

## Task 10: wrangler.toml

**Files:**
- Create: `wrangler.toml`

- [ ] **Step 1: Write config**

```toml
name = "pasak"
compatibility_date = "2025-01-01"
pages_build_output_dir = "dist"

# Custom domain: pasak.3dlab.id (configured via Cloudflare Pages dashboard)
# v1 has no D1 / R2 bindings — pure static site.
```

- [ ] **Step 2: Commit**

```bash
git add wrangler.toml
git commit -m "feat(m4): wrangler config for static Pages deployment"
```

---

## Task 11: GitHub Actions — deploy-web.yml

**Files:**
- Source: `/home/goodsmileduck/local/personal/3dlab/viewer-3d/.github/workflows/deploy-web.yml`
- Create: `.github/workflows/deploy-web.yml`

- [ ] **Step 1: Port and adapt**

Copy from viewer-3d, then edit:
- Project name `3dviewer` → `pasak`

```yaml
name: Deploy Web

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      deployments: write
      actions: write

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - run: npm run build:web

      - name: Create version tag
        id: tag
        run: |
          VERSION=$(node -p "require('./package.json').version")
          TAG="v$VERSION"
          if git ls-remote --tags origin "$TAG" | grep -q "$TAG"; then
            echo "Tag $TAG already exists, skipping"
            echo "created=false" >> "$GITHUB_OUTPUT"
          else
            git tag "$TAG"
            git push origin "$TAG"
            echo "Created and pushed tag $TAG"
            echo "created=true" >> "$GITHUB_OUTPUT"
          fi
          echo "tag=$TAG" >> "$GITHUB_OUTPUT"

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
          accountId: ${{ secrets.CF_ACCOUNT_ID }}
          command: pages deploy dist --project-name=pasak --branch=main

      - name: Trigger release build
        if: steps.tag.outputs.created == 'true'
        env:
          GH_TOKEN: ${{ github.token }}
        run: gh workflow run release.yml -f tag=${{ steps.tag.outputs.tag }}
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy-web.yml
git commit -m "ci(m4): web deploy workflow to Cloudflare Pages"
```

- [ ] **Step 3: Verify by pushing to main**

Run: `git push`
Watch the Actions run. Verify `https://pasak.pages.dev` (or the project's auto-assigned URL) renders Pasak. Then verify `https://pasak.3dlab.id` resolves once DNS propagates (5-30 min).

---

## Task 12: PR preview deploys

**Files:**
- Source: `/home/goodsmileduck/local/personal/3dlab/viewer-3d/.github/workflows/deploy-preview.yml`
- Source: `/home/goodsmileduck/local/personal/3dlab/viewer-3d/.github/workflows/cleanup-preview.yml`
- Source: `/home/goodsmileduck/local/personal/3dlab/viewer-3d/.github/workflows/cleanup-production.yml`
- Create: `.github/workflows/deploy-preview.yml`
- Create: `.github/workflows/cleanup-preview.yml`
- Create: `.github/workflows/cleanup-production.yml`

- [ ] **Step 1: Port all three workflows**

For each, copy from viewer-3d, replace `3dviewer` with `pasak`, and remove any references to wrangler bindings (D1, R2) that Pasak doesn't have.

- [ ] **Step 2: Open a test PR to verify preview workflow**

Create a throwaway branch, push a trivial change, open PR. Confirm:
- `deploy-preview.yml` runs and posts a preview URL comment on the PR
- Preview URL renders Pasak
- Closing the PR triggers `cleanup-preview.yml` which deletes the preview deployment

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/
git commit -m "ci(m4): PR preview deploys and production cleanup workflows"
```

---

## Task 13: /download route on web

**Files:**
- Create: `src/pages/DownloadPage.tsx`
- Modify: `src/App.tsx` (add hash-based or react-router routing)

For v1, keep this minimal. Single route via simple location-hash check (avoids adding `react-router` as a dependency just for one secondary page).

- [ ] **Step 1: Implement DownloadPage**

```tsx
export function DownloadPage() {
  return (
    <div className="h-full w-full flex items-center justify-center bg-slate-100">
      <div className="bg-white rounded shadow p-6 max-w-md text-center">
        <h1 className="text-2xl font-bold mb-2">Pasak — Desktop</h1>
        <p className="text-slate-600 mb-4">Native Windows app for cutting larger 3D models without browser memory limits.</p>
        <a
          className="inline-block bg-emerald-600 text-white px-4 py-2 rounded font-medium"
          href="https://github.com/Goodsmileduck/pasak/releases/latest"
          target="_blank" rel="noreferrer"
        >Download from GitHub Releases</a>
        <p className="text-xs text-slate-500 mt-4">Mac and Linux builds coming in v1.1.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire route**

Edit `src/App.tsx`:
```tsx
import { DownloadPage } from "./pages/DownloadPage";

// At the top of the component body, before other rendering:
const isDownloadRoute = typeof window !== "undefined" && window.location.pathname === "/download";
if (isDownloadRoute) return <DownloadPage />;
```

(For Cloudflare Pages, the catch-all route serves `index.html` — no routing config needed for this to work.)

- [ ] **Step 3: Smoke test**

After deploy, visit `https://pasak.3dlab.id/download` → should show download page.

- [ ] **Step 4: Commit**

```bash
git add src/pages/DownloadPage.tsx src/App.tsx
git commit -m "feat(m4): /download route linking to GitHub Releases"
```

---

## Task 14: CLAUDE.md and docs polish

**Files:**
- Create: `CLAUDE.md`
- Modify: `README.md`

- [ ] **Step 1: Write `CLAUDE.md`**

Mirror viewer-3d's CLAUDE.md style. Concrete contents:

```markdown
# Pasak — Claude Notes

## Project

Web + desktop tool to cut large 3D meshes into printable parts joined by separate dowel pieces. React + TypeScript + Vite frontend, Tauri v2 (Rust) for desktop, Cloudflare Pages for web. All compute client-side via Manifold (WASM).

- **App name:** Pasak (Indonesian for "dowel / peg")
- **Web URL:** https://pasak.3dlab.id
- **Sister project:** `../viewer-3d/` — shared loader/exporter/scene patterns, but the codebase is forked (not symlinked).

## Development Rule

All frontend changes must work in both targets. Verify with `npm run build:web` (web) and `npm run build` (desktop) before considering a task done. Platform-specific code is gated by `import.meta.env.VITE_TARGET !== 'web'` (desktop builds do not set `VITE_TARGET`).

## Key Commands

```bash
# Desktop dev (requires Rust)
source "$HOME/.cargo/env" && npm run tauri dev

# Web dev
npm run dev:web

# Build checks
npm run build          # Desktop (tauri build via beforeBuild)
npm run build:web      # Web

# Tests
npm run test
npm run test:watch

# Regenerate icons
npm run tauri icon src-tauri/icons/icon.png
```

## Structure

```
src/
  App.tsx                          App shell, routing, file loading
  pages/DownloadPage.tsx           /download (link to GitHub Releases)
  components/                      Viewer, Toolbar, CutPanel, CutPlane,
                                   PartsTree, DowelMarkers, ExplodedView,
                                   PrinterPanel, BuildPlate, AxisCube,
                                   StatusBar, DropZone, Spinner,
                                   ExportDialog, HelpOverlay,
                                   UpdateNotification
  lib/
    loaders/                       STL, OBJ, 3MF, GLB (mesh-only — no STEP)
    exporters/                     STL, 3MF, zip-export, save (browser/Tauri)
    cut/
      manifold.ts                  Manifold WASM init
      convert.ts                   THREE ↔ Manifold
      plane-cut.ts                 split mesh by plane
      cut-polygon.ts               extract 2D cross-section
      dowel-place.ts               grid-based auto-placement
      auto-place-cut-dowels.ts     wires cut-polygon + dowel-place
      dowel-apply.ts               subtract holes, build dowel pieces
      auto-orient.ts               largest-face-down
      fit-to-printer.ts            suggest cuts for build volume
      cut-client.ts                worker bridge
    session.ts                     pure session reducer
    printer-presets.ts             Bambu / Prusa / Ender / Voron volumes
    bvh.ts, model-info.ts, scene.ts
  workers/cut-worker.ts            Manifold ops on a Web Worker
  hooks/                           useCutSession, useViewerControls,
                                   useTheme, useAutoUpdate, useKeyboard
  types/index.ts                   Domain types
src-tauri/                         Rust shell (Tauri v2)
.github/workflows/
  deploy-web.yml                   Web → CF Pages on main
  release.yml                      Desktop → GitHub Releases on v* tags
  deploy-preview.yml               Web preview on PRs
  cleanup-preview.yml              Delete preview on PR close
  cleanup-production.yml           Prune old prod deploys
docs/                              Specs and plans
```

## Web Routes

- `/` — Pasak app
- `/download` — Desktop download landing

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
- **Auto-orient** runs after every cut so largest flat face lands on Z=0.

## Release Process

**Web:** Push to `main` → auto-deploys to Cloudflare Pages and creates a version tag from `package.json`. The tag triggers the release workflow.

**Desktop:** Push a `v*.*.*` tag (or wait for the web deploy to push one) → GitHub Actions builds the Windows installer and creates a GitHub Release.

```bash
# Bump version
npm version patch    # or minor/major
git push --follow-tags
```

## Auto-Update (Desktop)

Tauri updater plugin checks GitHub Releases for new versions on app startup (3s delay).
- **`useAutoUpdate`** hook — checks `@tauri-apps/plugin-updater`, tracks download progress.
- **`UpdateNotification`** — top-center banner.
- **Config:** `src-tauri/tauri.conf.json` `plugins.updater` — endpoint points to GitHub Releases `latest.json`, install mode `passive` (NSIS).
- **Capabilities:** `src-tauri/capabilities/default.json` — explicit permissions for updater, dialog, fs, shell, process.
- **Signing:** `release.yml` uses `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` GitHub secrets. The `pubkey` in `tauri.conf.json` must be the corresponding Ed25519 public key (NEW pair generated for Pasak — do NOT reuse viewer-3d's keys).

## What Pasak Is NOT (yet)

- Not a slicer
- Not STEP-aware (mesh-only inputs)
- No accounts, no shares (deferred to v2.0)
- No Mac/Linux desktop builds (v1.1)
- No connector library beyond round dowels (v1.3)
- No build-plate packing (v1.1)
- No mobile-optimized UI

## Sample Models for Testing

- `tests/fixtures/cube.stl` — 12-tri cube
- `tests/fixtures/sample.3mf` — keycap (copied from viewer-3d)
- `tests/fixtures/cube.obj` — text OBJ cube
- `tests/fixtures/cube.glb` — binary glTF cube

## Known Issues / Notes

- **Manifold expects watertight meshes.** Non-manifold STLs are repaired on import; if repair fails, show error modal directing user to fix in their CAD tool.
- **Cut worker:** Manifold WASM is loaded once per worker lifetime. The worker stays alive across cuts to avoid re-init cost.
- **Web memory:** browsers may OOM on >100MB meshes. Soft warning toast on import; recommend desktop for big files.
- **Rust PATH:** `source "$HOME/.cargo/env"` required (already in `~/.bash_profile` typically).
- **WSL2:** libEGL/MESA warnings on `tauri dev` are harmless (software rendering fallback).
- **Cargo.lock** is committed — required for reproducible builds and CI cache key.
- **GitHub Actions (desktop):** `tauri-apps/tauri-action@action-v0.6.1`, `windows-latest`, triggered by `v*.*.*` tags.
```

- [ ] **Step 2: Update README.md**

```markdown
# Pasak

**Cut large 3D models into printable parts joined by dowels.**

Free public alternative to LuBan3D. Works in your browser at [pasak.3dlab.id](https://pasak.3dlab.id), or as a Windows desktop app for handling bigger files.

## Features

- Cut any STL, OBJ, 3MF, or GLB mesh along X / Y / Z axes
- Auto-place dowels with tolerance presets for PLA, PETG, SLA
- Multi-cut workflow with parts tree and undo/redo
- Auto-orient parts to your printer's build plate
- Suggest cuts to fit your printer (Bambu, Prusa, Ender, Voron presets)
- Exploded view to preview assembly
- Export as zip-of-STLs or single multi-object 3MF
- All processing client-side — your files never leave your computer

## Development

```bash
npm install

# Web
npm run dev:web

# Desktop (requires Rust)
source "$HOME/.cargo/env" && npm run tauri dev

# Tests
npm run test

# Build
npm run build:web    # web
npm run build        # desktop installer
```

## Documentation

- Design: [`docs/2026-04-30-pasak-design.md`](docs/2026-04-30-pasak-design.md)
- Plans: [`docs/plans/`](docs/plans/)
- Per-milestone smoke tests: [`docs/m1-smoke-test.md`](docs/m1-smoke-test.md), `m2-`, `m3-`, `m4-`

## License

[Add license here]

---

Made by 3D Lab Bali — https://3dlab.co.id
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs(m4): finalize CLAUDE.md and README"
```

---

## Task 15: M4 acceptance — full release smoke test

**Files:**
- Create: `docs/m4-smoke-test.md`

- [ ] **Step 1: Document checks**

```markdown
# M4 Smoke Test Checklist (release readiness)

## Web (Cloudflare Pages)

- [ ] `https://pasak.3dlab.id` resolves (DNS + SSL active)
- [ ] Loads to Pasak empty state
- [ ] All M3 web functionality works in production build
- [ ] `https://pasak.3dlab.id/download` shows download page
- [ ] PR previews work: open a PR, confirm preview URL is posted
- [ ] PR previews are deleted after PR close

## Desktop (Windows)

- [ ] `npm run tauri dev` runs locally (WSL or native)
- [ ] All M3 functionality works in dev mode
- [ ] Native open/save dialogs used (not browser blob downloads)
- [ ] Tagging `v0.1.x` triggers release.yml
- [ ] GitHub Release created with `.msi`, `.exe`, `.sig`, `latest.json`
- [ ] Install MSI on a clean Windows machine
- [ ] Double-click `.stl` file → Pasak opens with file loaded (file association works)
- [ ] Auto-update: bump version, push tag, install old version, restart → update notification appears, downloads, restarts cleanly

## Cross-cutting

- [ ] All tests pass: `npm run test`
- [ ] Web build succeeds: `npm run build:web`
- [ ] Desktop build succeeds locally: `npm run tauri build`
- [ ] No browser console errors on production build
- [ ] No Tauri crash logs in `%LOCALAPPDATA%\id.3dlab.pasak\logs`

## Polish

- [ ] Pasak icon visible in taskbar/start menu (Windows)
- [ ] Window title says "Pasak"
- [ ] Favicon visible in browser tab
- [ ] Page title and meta description correct
```

- [ ] **Step 2: Walk through the checklist**

Fix any failures. Each fix is its own commit.

- [ ] **Step 3: Tag v0.1.0 and ship**

```bash
npm version 0.1.0
git push --follow-tags
```

Watch:
- `Deploy Web` workflow → CF Pages production URL updates
- `Release Windows Build` workflow → GitHub Release published

- [ ] **Step 4: Commit**

```bash
git add docs/m4-smoke-test.md
git commit -m "docs(m4): release readiness smoke test"
```

---

## M4 Done — Pasak v1 Shipped

Live at:
- Web: `https://pasak.3dlab.id`
- Desktop: GitHub Releases (Windows installer)

## Post-launch follow-ups (already on roadmap)

- v1.1: Build-plate packing, Mac/Linux desktop builds, R2 download bucket
- v1.2: STEP support with mesh-conversion warning
- v1.3: Connector library expansion (dovetail, puzzle-tab, hex insert)
- v2.0: Accounts + share links (port from viewer-3d)
- v2.x: Free-form sketched cuts
