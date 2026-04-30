# M4 Smoke Test Checklist (release readiness)

## Manual pre-flight (one-time setup, NOT automated)

- [ ] Create GitHub repo `pasak` under your GitHub account
- [ ] `git remote add origin git@github.com:<owner>/pasak.git && git push -u origin main`
- [ ] Generate Tauri signing keypair:
      `npx -y @tauri-apps/cli signer generate -w ~/.tauri/pasak.key`
- [ ] Replace `pubkey` in `src-tauri/tauri.conf.json` with the generated public key
- [ ] Add GitHub secrets in repo Settings → Secrets and variables → Actions:
  - `TAURI_SIGNING_PRIVATE_KEY` (contents of `~/.tauri/pasak.key`)
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
  - `CF_API_TOKEN` (Cloudflare API token with Pages:Edit permission)
  - `CF_ACCOUNT_ID`
- [ ] Create Cloudflare Pages project named `pasak` (production branch: main, build cmd empty, output dir: dist)
- [ ] Configure custom domain `pasak.3dlab.id` in CF Pages → Custom domains

## Web (Cloudflare Pages)

- [ ] `https://pasak.3dlab.id` resolves (DNS + SSL active)
- [ ] Loads to Pasak empty state
- [ ] All M3 web functionality works in production build
- [ ] `https://pasak.3dlab.id/download` shows download page
- [ ] PR previews work: open a PR with version bumped, confirm preview URL is posted
- [ ] PR previews are deleted after PR close
- [ ] Old production deployments are pruned (keep 5)

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

- [ ] Pasak icon visible in taskbar / start menu (Windows)
- [ ] Window title says "Pasak"
- [ ] Favicon visible in browser tab
- [ ] Page title and meta description correct
- [ ] BuildPlate canvas text says "Pasak" (currently still "3D Lab Viewer" — replace icon set first, then re-skin BuildPlate)

## Known carry-overs to address before public launch

- [ ] Replace placeholder icons in `src-tauri/icons/` (currently copied from viewer-3d)
      → drop a 1024×1024 `icon.png` and run `npm run tauri icon src-tauri/icons/icon.png`
- [ ] Replace BuildPlate's hardcoded "3D Lab Viewer" canvas text
- [ ] Generate Pasak signing keypair (do NOT reuse viewer-3d's keys)
