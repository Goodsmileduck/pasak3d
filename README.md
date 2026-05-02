# Pasak

**Cut large 3D models into printable parts joined by dowels.**

Free public alternative to LuBan3D. Works in your browser at [pasak.3dlab.id](https://pasak.3dlab.id), or as a Windows desktop app for handling bigger files.

## Features

- Cut any STL, OBJ, 3MF, or GLB mesh along X / Y / Z axes
- Auto-place dowels with tolerance presets for PLA, PETG, SLA — distributed across all cross-section regions
- Manual dowel placement — click the cut plane to add, drag to reposition, × to remove
- Multi-cut workflow with parts tree and undo / redo
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
npm run build        # desktop installer (via tauri build)
```

## Documentation

- Design: [`docs/2026-04-30-pasak-design.md`](docs/2026-04-30-pasak-design.md)
- Plans: [`docs/plans/`](docs/plans/)
- Per-milestone smoke tests: `docs/m1-smoke-test.md`, `m2-`, `m3-`, `m4-`
- Internal notes: [`CLAUDE.md`](CLAUDE.md)

---

Made by [3D Lab Bali](https://3dlab.co.id).
