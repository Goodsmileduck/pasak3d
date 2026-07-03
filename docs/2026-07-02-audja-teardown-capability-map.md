# Audja Teardown → Pasak Capability Map

**Date:** 2026-07-02
**Status:** Reference for implementation planning — no build committed
**Companion:** [`2026-07-02-audja-comparison-strategy.md`](./2026-07-02-audja-comparison-strategy.md) (read first — decides *evolve, tiered engine*)
**Audience:** A clean agent with no prior context, tasked with writing a pasak implementation plan.

---

## 0. How to read this document

This is a **competitive teardown** of Audja (`Audja-Setup-1.0.0-beta.2.exe`, v1.0.0-beta.2), a native
C++ desktop app that splits large 3D models for printing — pasak's direct analogue. Everything below
was extracted by **static analysis of Audja's binaries** (ImGui widget IDs, leaked C++ symbol names,
GLSL shader source, and its `audja_settings.ini`). Treat behavioral claims as **inferred, not
confirmed** — symbol names reveal *which* operations exist, not their exact semantics. Confidence is
flagged per item: **[HIGH]** = explicit string/param, **[MED]** = strong symbol inference,
**[LOW]** = guess.

**Strategy recap (from companion doc):** Do NOT rewrite pasak. Keep the Tauri + React + Three.js +
`manifold-3d` (WASM) stack. Add capability in tiers:
- **Web tier (client-side WASM):** better cuts/dowels, sockets/keyed joints — algorithm work in `src/lib/cut/`.
- **Desktop tier (native module in the empty Tauri Rust backend):** heavy geometry (hollow, offset, remesh, voxel).
- **Later / opt-in cloud or desktop:** AI auto-segmentation.

---

## 1. Audja's full feature surface (inventory)

Grouped by domain. Source column: `##widgetId` = ImGui control, `Op_X` = leaked job symbol, `.ini` = settings key.

### 1.1 Cutting / splitting
| Feature | Evidence | Conf |
|---|---|---|
| Bed cut (cut to fit printer bed) | `##buildBedCutApply`, `##buildBedCutPreview`, `bed_cut_depth`, `bed_cut_preview` | HIGH |
| Auto-Split (automatic segmentation into parts) | `##kcAutoSplitRun`, `segmenter::SegmentResult`, `[AutoSplitDiag]` | HIGH |
| Manual cut "blades" (multi-plane preview) | `##kcAutoSplitPreviewBlades`, `##kcAutoSplitResetBlades` | HIGH |
| Separate into connected components | `##buildSeparateApply`, `MeshComponents::getAllComponents` | HIGH |
| Mirror | `##buildMirrorApply` | HIGH |

### 1.2 Joints (pasak's core: dowels → Audja has more)
| Feature | Evidence | Conf |
|---|---|---|
| Keyed joints along seams | `##kcAutoSplitJoints`, `##kcAutoSplitJointsPerSeam`, `##buildApplyKeys`, `##buildKeyShape` | HIGH |
| Joint params: clearance, depth, scale, edge-margin, shape | `##kcAutoSplitJoint{Clearance,Depth,Scale,EdgeMargin,Shape}` | HIGH |
| Magnet sockets (recess for magnets between parts) | `##buildAddMagnetSocket`, "Magnet Socket Diameter/Depth/Clearance" | HIGH |
| Custom keys | `##buildAddCustomKey` | HIGH |
| Socket taper / draft | `##sepSocketTaper`, `##sepSocketResetTaperOffset` | HIGH |
| **Test-fit pair generator** (print small coupons to dial in tolerance) | `##buildGenerateTestFitPairs`, `##buildTestFit{Count,Step,CubeSize,KeyDepth,KeyWidth,Mode,ShuffleShapes}` | HIGH |
| Key-by-part (KBP) workflow | `##buildKbpWorkflow`, `##kbpA`/`##kbpB` (pair endpoints) | MED |
| Assembly seam labels (embossed part IDs at seams) | `##kcAutoSplitAssemblyLabels`, `...LabelHeight`, `...LabelDepth` | HIGH |
| Key shapes catalog | strings: `Cube`, `Cross`, `Cylinder` (+ more via `##buildKeyShape` enum) | MED |
| Mixed pin/socket polarity guard | "mixed pin/socket polarity on one seam", `polarityLocked` (.ini) | HIGH |

### 1.3 Mesh repair / cleanup
| Feature | Evidence | Conf |
|---|---|---|
| Batch repair | `##buildBatchRepair`, `##buildBatchOutput` | HIGH |
| Fix self-intersections | `SelfIntersections::fix`, `SelfIntersections::getFaces` | HIGH |
| Fix degeneracies / disoriented faces / multiple edges | `fixMeshDegeneracies`, `findDegenerateFaces`, `findDisorientedFaces`, `fixMultipleEdges` | HIGH |
| Hole filling | `fillHole`, `fillHoleNicely`, `findHoleRepresentiveEdges` | HIGH |
| Rebuild / remesh (quality slider) | `##buildRebuildApply`, `##buildRebuildQuality` | HIGH |

### 1.4 Mesh editing (heavy geometry)
| Feature | Evidence | Conf |
|---|---|---|
| Hollow (shell out interior) | `Op_HollowMesh`, `##buildHollowApply`, "Hollow Thickness/Quality/Shell" | HIGH |
| Wall-thickness analysis (heatmap) | "Analyzing wall thickness: %s (%d faces)" | HIGH |
| Thicken / min-thickness | `##buildThicknessApply` | HIGH |
| Decimate (reduce triangles) | `Op_DecimateMesh`, `decimateMesh`, `##buildDecimateApply`, "Decimate Target" | HIGH |
| Smooth (presets) | `##buildSmoothApply`, `##buildSmoothPreset`, `relax`, `relaxKeepVolume`, `positionVertsSmoothly` | HIGH |
| Subdivide | `subdivideMesh` | HIGH |
| General offset (voxel-based, drives hollow/thicken) | `generalOffsetMesh`, `GeneralOffsetParameters` | HIGH |

### 1.5 Mold Studio ("mother mold" — likely OUT of scope for pasak v1)
Box mold generation: shell thickness, wall margin/thickness, pour + vent diameter, sprue, blockout,
inflate, frame style, voxel quality, 2D fill preview with trap hints.
Evidence: `##moldBox*`, `##moldAdv*`, `##MoldStudioPanel`, `##MoldFill2D*`. **Conf HIGH** it exists;
**scope: defer** — this is casting/silicone-mold tooling, adjacent to but not core to "split for printing."

### 1.6 Orientation / print-prep
| Feature | Evidence | Conf |
|---|---|---|
| Overhang heatmap (GLSL) | shader: `overhangAngle = max(angleFromUp-90,0)`, `uOverhangThreshold`, red/orange severity ramp | HIGH |
| Auto-orient to build plate | pasak already has this (`auto-orient.ts`); Audja parity assumed | MED |
| Arrange / spacing on plate | `##ArrangeSpacing`, `##BuildPlatesTab` | HIGH |

### 1.7 Painting (probably OUT of scope)
Full color/segmentation painter (brush, bucket, smart-fill, height/gap paint), multi-material AMS
export. Evidence: `##Painter*`, `##FullscreenPainter*`, paint shortcuts in `.ini`. **Scope: defer** —
this is multi-color prep, not model splitting.

### 1.8 I/O & slicer integration
| Feature | Evidence | Conf |
|---|---|---|
| Import: any format via MeshLib | `MeshLoad::fromAnySupportedFormat` (STL/OBJ/3MF/PLY/…) | HIGH |
| Export: 3MF with Bambu/Orca metadata | 3MF XML with `BambuStudio:3mfVersion`, `OrcaSlicer`, plate metadata | HIGH |
| Export & Open in Slicer (launch external slicer) | `Op_OpenCurrentProjectInSlicer`, `##viewportOpenInSlicer`, `##SlicerPick` | HIGH |
| Import painted 3MF (segmentation slots) | `Import3MF::DecodeSegmentationSlotRange`, `ParseImportedSegmentationTree` | HIGH |

---

## 2. The Auto-Split (segmentation) algorithm — reverse-engineered

Audja's headline feature over pasak. It's a **geometric region-growing segmenter** (not ML despite the
`AISegmentation` .ini label — no model files were bundled; parameters are classic mesh-segmentation
knobs). Confirmed by the diagnostic string: *"After the max-regions step, very small regions merge into
a neighbor."*

**Parameters (from `audja_settings.ini` `[AISegmentation]`, all HIGH conf — these are live defaults):**
```
segmentMethod    = 2        # algorithm variant (0/1/2)
geoMaxParts      = 64       # cap on number of regions
geoGranularity   = 0.45     # region size / seed density
geoConcavity     = 0.28     # concavity weight — split at concave creases (SDF/curvature-driven)
geoThresholdMin  = 0.02     # region-merge thresholds
geoThresholdMax  = 0.48
geoMinRegionFaces   = 0     # absolute min region size
geoMinRegionRatio   = 0.0025  # relative min region size (× total faces)
geoMinCrumbFraction = 0.0008  # below this = "crumb", force-merged
geoMergeMaxPasses   = 320   # iterative merge passes
geoSmoothPasses     = 2     # seam smoothing iterations
geoSmoothSelfWeight = 2
geoSplitDominant    = 1     # split oversized dominant regions
geoDominantRatio    = 0.58
geoDominantRetries  = 4
```

**Inferred pipeline [MED]:** compute per-face concavity/curvature → seed regions by granularity →
region-grow with concavity-weighted boundaries → iteratively merge regions below min-size thresholds
(up to 320 passes) → split any dominant oversized region → smooth seams → cap at `geoMaxParts`.
This is the well-known **hierarchical face clustering / SDF-segmentation** family (cf. Shapira SDF,
CGAL `Surface_mesh_segmentation`). A pasak implementation can target the same knobs.

**Then** each region becomes a part via `Mesh::cloneRegion` + `addMeshPart`, and seams get joints
(§1.2). Auto-split joint params (`##kcAutoSplitJoint*`) are the same as manual keys.

---

## 3. Geometry-operation dependency map (the "native shopping list")

Every MeshLib `MR::` operation Audja references, mapped to the pasak feature it enables and whether
`manifold-3d` (WASM, web tier) can already do it or it needs the **native desktop module**.

| MeshLib op (Audja uses) | Enables | manifold-3d (web)? | Native (desktop)? |
|---|---|---|---|
| `boolean` | cut / socket subtract / key add | ✅ core strength | ✅ |
| `cutMesh` + `convertMeshTriPointsToMeshContour` | plane & freeform cut along contour | ⚠️ pasak does plane-cut manually | ✅ cleaner |
| `MeshComponents::getAllComponents` | Separate into parts | ⚠️ doable (BFS on adjacency) | ✅ |
| `makeCube` / `makeCylinder` | dowel/key/pin primitives | ✅ trivial | ✅ |
| `Mesh::cloneRegion` / `addMeshPart` / `deleteFaces` | extract segmentation parts | ⚠️ manual face-set copy | ✅ |
| `fillHole` / `fillHoleNicely` | cap open cuts watertight | ⚠️ manifold caps planar; nicely=curved | ✅ better |
| `decimateMesh` (`DecimateSettings`) | reduce triangles | ❌ not in manifold | ✅ **native-only** |
| `subdivideMesh` | refine | ⚠️ limited | ✅ |
| `generalOffsetMesh` (`GeneralOffsetParameters`) | **hollow / thicken / offset** (voxel) | ❌ | ✅ **native-only** (OpenVDB-class) |
| `relax` / `relaxKeepVolume` / `positionVertsSmoothly` | smoothing | ❌ | ✅ **native-only** |
| `SelfIntersections::fix`, `fixMeshDegeneracies`, `findDegenerateFaces`, `findDisorientedFaces`, `fixMultipleEdges`, `duplicateMultiHoleVertices` | robust repair | ⚠️ pasak has make-manifold only | ✅ **much stronger** |
| `computeBoundingBox`, `area`, `volume`, `averageEdgeLength` | metrics | ✅ | ✅ |
| `Cuda::isCudaAvailable` | GPU accel (optional) | ❌ | optional |
| `MeshLoad/MeshSave::fromAnySupportedFormat` | wide format IO | ⚠️ pasak has STL/OBJ/3MF/GLB | ✅ more formats |

**Reading:** cuts, dowels, sockets, keyed joints, separate, hole-cap, metrics → **all web-tier
feasible on manifold-3d + custom code.** Decimate, hollow/thicken/offset, smoothing, and heavy repair
→ **native desktop module** (`generalOffsetMesh` implies a voxel/level-set engine like OpenVDB).

---

## 4. Mapping onto pasak's existing code

Current pasak geometry (all WASM, in web worker `src/workers/cut-worker.ts`):
```
src/lib/cut/
  plane-cut.ts            # axis-aligned plane cut (manifold boolean)
  cut-polygon.ts          # cross-section polygon extraction
  dowel-place.ts          # dowel positioning
  dowel-apply.ts          # boolean the dowels in/out
  auto-place-cut-dowels.ts# farthest-point auto placement
  auto-orient.ts          # orient to build plate
  fit-to-printer.ts       # suggest cuts to fit bed (presets in printer-presets.ts)
  manifold.ts             # manifold-3d wrapper
  convert.ts, cut-client.ts
src/lib/{loaders,parsers,exporters}/   # STL/OBJ/3MF/GLB in, STL/3MF/zip out
```

### Gap analysis (Audja has → pasak lacks), tiered
**Web tier (extend `src/lib/cut/`, no native needed):**
1. **Keyed joints / sockets** — generalize `dowel-*` into a joint system: shapes (cylinder, cube,
   cross, dovetail, puzzle), male/female, taper/draft, clearance presets. New: `src/lib/cut/joints/`.
2. **Magnet sockets** — parametric recess (diameter/depth/clearance) subtracted on both mating faces.
3. **Test-fit pair generator** — emit small coupon pairs across a clearance sweep (count/step/size).
4. **Assembly seam labels** — emboss/deboss part IDs at seams (label height/depth).
5. **Separate connected components** — adjacency BFS → parts.
6. **Watertight cut caps** — replace/verify planar cap logic (`fillHole` analogue).
7. **Overhang heatmap** — port the GLSL (formula in §1.6) as a Three.js material for orient feedback.
8. **Bed-cut preview UX** — pasak has fit-to-printer; add live preview like `bed_cut_preview`.

**Desktop tier (new native module in `src-tauri/src/`, exposed via Tauri commands):**
9. **Decimate** (`decimateMesh`) — triangle reduction before export.
10. **Hollow / thicken / offset** (`generalOffsetMesh`) — voxel/level-set; needs OpenVDB or MeshLib.
11. **Volume-preserving smoothing & strong repair** (`relaxKeepVolume`, `SelfIntersections::fix`).
12. **Auto-Split segmentation** (§2) — could start web (CGAL-style in TS/WASM) but heavy; likely desktop.

**Defer / out of scope:** Mold Studio (§1.5), color Painter (§1.7), AI/ML segmentation (Audja's is
geometric, so this is NOT actually needed for parity — see §2).

### Native module shape (desktop tier)
The Tauri Rust backend is empty (~59 LOC) — clean slot. Options for the geometry lib behind it:
- **MeshLib** via its C API (`MeshLibC2.dll` is a real C interface) → FFI from Rust. Gives everything
  in §3 directly. **⚠️ LICENSE GATE — verify commercial terms before committing (see companion doc).**
- **OpenVDB** (MPL-2.0) for the voxel ops (hollow/thicken/offset) + Rust mesh crates for the rest.
- Pure-Rust geometry crates — weaker; likely insufficient for robust offset/repair.

Web and desktop must share the React UI and call a common TS interface (`GeometryEngine`) with two
implementations: `WasmEngine` (manifold-3d) and `NativeEngine` (Tauri command bridge). This keeps the
feature flags per-tier and the UI identical.

---

## 5. Suggested build order (for the planning agent)

Ranked by value ÷ risk, respecting the tiered strategy:

1. **Joint system overhaul (web)** — keys + sockets + shapes + clearance presets, generalizing the
   existing dowel code. Biggest capability jump, ships to the free funnel, no native dependency.
2. **Test-fit generator + tolerance presets (web)** — cheap, high user value, tightens print-fit.
3. **Separate components + watertight caps + seam labels (web)** — completeness, all WASM.
4. **Overhang heatmap + bed-cut preview (web)** — orientation UX, pure Three.js.
5. **`GeometryEngine` interface + native module scaffold (desktop)** — wire the empty Rust backend;
   first native op = **decimate** (self-contained, easy win, proves the FFI bridge).
6. **Hollow / thicken / offset (desktop native)** — the marquee "Pro" feature; OpenVDB or MeshLib.
7. **Auto-Split segmentation** — prototype geometric segmenter with the §2 params; web if performant,
   else desktop.

---

## 6. Open questions for the planning agent

- **License:** confirm MeshLib's commercial terms, or commit to OpenVDB + Rust crates for native ops.
- **Native geometry lib choice** drives §4/§5.6 — decide before planning the desktop tier.
- **Segmentation home:** attempt in-browser (TS/WASM CGAL-like) or desktop-only? Perf-test the §2 params
  on a representative large mesh first.
- **Slicer integration:** worth matching "Open in Slicer" (launch Bambu/Orca/Prusa)? Tauri shell plugin
  makes it easy; pasak already depends on `@tauri-apps/plugin-shell`.
- **Feature-flag mechanism** for web-vs-desktop tiers — pasak already has `VITE_TARGET` (web/desktop);
  extend it to gate native-only features.

---

## 7. Provenance / caveats

- All Audja data is from **static string/symbol analysis** of shipped binaries — not decompiled logic.
  Parameter *defaults* (§2) are exact; algorithm *behavior* is inferred from symbol names.
- Security audit of Audja (separate): no backdoor/spyware indicators; ordinary risks only. Not relevant
  to pasak's build but informs "is this a safe app to benchmark against" — yes.
- Extracted Audja files live outside this repo (session scratchpad); this doc is the durable summary.
