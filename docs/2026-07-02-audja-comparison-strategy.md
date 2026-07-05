# Pasak — Rebuild-vs-Evolve Strategy (Audja comparison)

**Date:** 2026-07-02
**Status:** Assessment only — no build committed
**Trigger:** Reverse-engineered a competitor/peer app, **Audja** (`Audja-Setup-1.0.0-beta.2.exe`),
to see how it splits large models for 3D printing, and asked whether pasak should be rebuilt to match.

## TL;DR

**Don't rebuild. Evolve.** Pasak already does Audja's core job (cut big models → dowel-joined
printable parts). The gap is not architecture — it's that Audja rents a heavier geometry engine than
pasak's browser WASM can match. A from-scratch rewrite would discard clean, working code and kill the
client-side browser version, which is the funnel and the privacy edge over LuBan3D.

## What Audja actually is

Native **C++ desktop app**, built on off-the-shelf open-source geometry:

- **MeshLib** (`MRMesh.dll`, `MRViewer.dll`, `MRVoxels.dll`, `MRCuda.dll`, `MeshLibC2.dll`) — the
  geometry engine. Open-source core: <https://github.com/MeshLib/MeshLib>. This is the "secret sauce."
- **OpenCASCADE** (`TK*.dll`) — CAD kernel (STEP/BREP import).
- **Dear ImGui** + GLFW — the GUI.
- **Embedded Python 3.11** (pybind11) for scripting/plugins — plugins currently **disabled**.
- Backend: Supabase + `api.audja.com`; auto-update via `/releases/latest` + PowerShell `Expand-Archive`.

Security note from the audit: no backdoor/spyware indicators found (static string analysis).
Real risks are ordinary: update-payload signature verification unconfirmed, and the usual
malicious-file parser surface (STL/STEP/DICOM/E57 via assimp/GDCM/OCCT).

**Key takeaway:** Audja didn't write the hard geometry — it wrapped **MeshLib** (native C++) in an
ImGui shell. MeshLib is why it chews big scans that pasak's `manifold-3d` WASM warns about.

## Why a rebuild is the wrong move

- **Code is healthy, not a mess.** ~5,200 LOC TypeScript, geometry cleanly isolated in
  `src/lib/cut/` (`plane-cut`, `dowel-place`, `auto-orient`, `cut-polygon`, `manifold` wrapper);
  loaders/parsers/exporters neatly split. Nothing structural forces a rewrite.
- **The Tauri Rust backend is empty** (~59 LOC shell). All geometry runs today as WASM in a web
  worker (`src/workers/cut-worker.ts`). That empty backend is the ready home for native heavy ops.
- **MeshLib is native C++ — it can't run in a browser.** Adopting it as the sole engine kills
  `pasak.3dlab.id` (client-side, free, "files never leave your computer") — the exact differentiator
  vs LuBan3D and the marketing funnel. Web-essential was a firm constraint.

## The impossible triangle

*native-MeshLib power* + *runs client-side in a browser* + *build it fast* → pick two.
Because web is essential, the browser engine stays **WASM (`manifold-3d`)**. Note `manifold-3d` is a
top-tier boolean engine (guaranteed-manifold output) — so "better output quality" is mostly an
**algorithm problem in pasak's own placement/seam logic**, which we control, not an engine limit.

## Recommended direction — A: Evolve, tiered engine

Wanted features map cleanly across tiers:

| Wanted capability | Where it lives | Rebuild needed? |
|---|---|---|
| Better cuts & dowels, output quality | Web tier — algorithm work in `src/lib/cut/` | No |
| Sockets / keyed joints | Web tier — WASM + good algorithms | No |
| Voxel / thicken / hollow | **Desktop tier** — native module in the empty Tauri Rust backend | New native module |
| AI auto-segmentation | Later — opt-in cloud, or desktop-native (not client-side web) | R&D |

This keeps the free client-side web funnel + privacy promise, reuses the existing code, and stays
incremental/shippable. Reserve a narrow, **opt-in** slice of a cloud service *only* for AI
segmentation — the one feature genuinely impractical client-side.

### Rejected alternatives

- **B: Native rewrite (Audja-style).** Full parity, best big-model power — but kills the browser
  version, discards working code, MeshLib licensing risk, slowest. Contradicts web-essential.
- **C: Cloud geometry service.** Full power everywhere including browser — but breaks
  "files never leave your computer" (the LuBan3D differentiator) and adds ongoing infra cost/latency.

## Gating item before betting on MeshLib

**Verify MeshLib's license for commercial use** (3D Lab is a commercial product) — do not assume.
Safely-permissive fallbacks for the heavy work: **OpenVDB** (MPL-2.0), **`manifold-3d`** (Apache-2.0).

**Update (2026-07-03, from inspecting Audja's install — see teardown §8):** Audja ships **MeshLib *and*
OpenVDB together** (`MeshLibC2.dll` + `openvdb.dll`/`blosc.dll`/`tbb12.dll`); MeshLib uses OpenVDB
internally. So "MeshLib vs OpenVDB" is not either/or — **adopting MeshLib's C API gets the OpenVDB voxel
ops (hollow/offset) too.** Pure-OpenVDB+Rust is the fallback only if MeshLib's commercial terms fail.
Also discovered: Audja's connector is a **pre-designed articulating key mesh** (`assets/articulation/
Key-Joint.stl`), not a procedural primitive — so the top near-term web-tier gap is a **designed-connector
joint type**, ahead of the native tier.

## Suggested sequencing (when/if we build)

1. **Socket / keyed-joint + cut-quality improvements** on the web tier — most value, lowest risk,
   ships straight to the free funnel.
2. **Desktop native module** for voxel / hollow / thicken — the "Pro" hook, fills the empty Rust backend.
3. **AI auto-segmentation** last — opt-in cloud or desktop-native.

## Not decided

Whether to build any of this at all. This note captures the analysis so future-you can pick it up
without re-deriving it.
