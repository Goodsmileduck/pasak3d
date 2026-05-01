import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Viewer } from "./components/Viewer";
import { DropZone } from "./components/DropZone";
import { StatusBar } from "./components/StatusBar";
import { Spinner } from "./components/Spinner";
import { Toolbar } from "./components/Toolbar";
import { CutPanel } from "./components/CutPanel";
import { PartsTree } from "./components/PartsTree";
import { PrinterPanel } from "./components/PrinterPanel";
import { ExplodedView } from "./components/ExplodedView";
import { ExportDialog, type ExportOptions } from "./components/ExportDialog";
import { HelpOverlay } from "./components/HelpOverlay";
import { UpdateNotification } from "./components/UpdateNotification";
import { useKeyboard } from "./hooks/useKeyboard";
import { useAutoUpdate } from "./hooks/useAutoUpdate";
import { loadModel } from "./lib/loaders";
import { useCutSession } from "./hooks/useCutSession";
import { autoPlaceCutDowels } from "./lib/cut/auto-place-cut-dowels";
import { buildZipExport } from "./lib/exporters/zip-export";
import { exportToMulti3MF } from "./lib/exporters/3mf";
import { saveBytes } from "./lib/exporters/save";
import { suggestCuts } from "./lib/cut/fit-to-printer";
import { applyAutoOrient } from "./lib/cut/auto-orient";
import { fitsInPrinter, dimensionsFromBBox } from "./lib/printer-presets";
import { isDesktop, basename } from "./lib/platform";
import type { ModelData, CutPlaneSpec, Dowel, TolerancePreset, PartId } from "./types";

/** Read a file from disk via Tauri and feed it to the standard load pipeline. */
async function loadFileFromPath(path: string, onFile: (f: File) => Promise<void>): Promise<void> {
  const { readFile } = await import("@tauri-apps/plugin-fs");
  const data = await readFile(path);
  await onFile(new File([data as BlobPart], basename(path)));
}

export default function App() {
  const session = useCutSession();
  const [modelInfo, setModelInfo] = useState<ModelData["info"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCutPanel, setShowCutPanel] = useState(false);
  const [previewPlane, setPreviewPlane] = useState<CutPlaneSpec | null>(null);
  const [previewDowels, setPreviewDowels] = useState<Dowel[]>([]);
  const [suggestedCuts, setSuggestedCuts] = useState<{ partId: PartId; cuts: CutPlaneSpec[] } | null>(null);
  const [explodeFactor, setExplodeFactor] = useState(0);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [cutAxis, setCutAxis] = useState<"x" | "y" | "z">("x");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const update = useAutoUpdate();

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      try {
        const buf = await file.arrayBuffer();
        const data = await loadModel(file.name, buf, file.size);
        session.loadModel(data);
        setModelInfo(data.info);
        setShowCutPanel(true);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [session],
  );

  /** Tauri-aware open: native dialog on desktop, falls back to hidden <input> in browser. */
  const handleOpen = useCallback(async () => {
    if (isDesktop) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const path = await open({
          multiple: false,
          filters: [{ name: "3D Model", extensions: ["stl", "obj", "3mf", "glb"] }],
        });
        if (typeof path !== "string") return;
        await loadFileFromPath(path, handleFile);
        return;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return;
      }
    }
    fileInputRef.current?.click();
  }, [handleFile]);

  /** On desktop, if Pasak was launched with a file argument (file association), load it. */
  useEffect(() => {
    if (!isDesktop) return;
    let cancelled = false;
    (async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const path = await invoke<string | null>("get_cli_file");
        if (cancelled || !path) return;
        await loadFileFromPath(path, handleFile);
      } catch (e) {
        console.error("CLI file load failed:", e);
      }
    })();
    return () => { cancelled = true; };
  }, [handleFile]);

  // The "active" part for cut operations: the currently selected visible part,
  // or fall back to the first visible import part if nothing selected.
  const activePart = useMemo(() => {
    const sel = session.session.selectedPartId;
    if (sel) {
      const p = session.session.parts.get(sel);
      if (p && p.meta.visible) return p;
    }
    return session.partsArray.find((p) => p.meta.visible && !p.isDowel) ?? null;
  }, [session.session, session.partsArray]);

  const bbox = useMemo(() => {
    if (!activePart) return null;
    const b = new THREE.Box3().setFromObject(activePart.group);
    return b;
  }, [activePart]);

  /**
   * Cap dowel length to the part's extent along the cut normal so the cylinder
   * never sticks out past the body. We use 70% of the extent as a safety margin.
   */
  const safeDowelLength = (plane: CutPlaneSpec, requested: number): number => {
    if (!activePart) return requested;
    const partBbox = new THREE.Box3().setFromObject(activePart.group);
    const size = partBbox.getSize(new THREE.Vector3());
    const axisExtent =
      plane.axisSnap === "x" ? size.x : plane.axisSnap === "y" ? size.y : size.z;
    return Math.min(requested, axisExtent * 0.7);
  };

  const onPreview = (plane: CutPlaneSpec, dowelsHint: Dowel[], _t: TolerancePreset) => {
    if (!activePart) return;
    setPreviewPlane(plane);
    const length = safeDowelLength(plane, dowelsHint[0]?.length ?? 20);
    const placed = autoPlaceCutDowels(activePart.mesh, plane, {
      count: dowelsHint.length,
      dowelDiameter: dowelsHint[0]?.diameter ?? 5,
      length,
      minSpacing: 2,
    });
    setPreviewDowels(placed);
  };

  const onCut = (plane: CutPlaneSpec, dowelsHint: Dowel[], tolerance: TolerancePreset) => {
    if (!activePart) return;
    const length = safeDowelLength(plane, dowelsHint[0]?.length ?? 20);
    const placed = autoPlaceCutDowels(activePart.mesh, plane, {
      count: dowelsHint.length,
      dowelDiameter: dowelsHint[0]?.diameter ?? 5,
      length,
      minSpacing: 2,
    });
    void session.performCut(activePart.id, plane, placed, tolerance);
    setShowCutPanel(false);
    setPreviewPlane(null);
    setPreviewDowels([]);
  };

  const onExport = () => {
    const hasAny = session.partsArray.some((p) => p.meta.source === "cut");
    if (!hasAny) return;
    setShowExportDialog(true);
  };

  const performExport = async (opts: ExportOptions) => {
    const exportableParts = session.partsArray.filter((p) => p.meta.source === "cut");
    if (exportableParts.length === 0) return;
    const parts = exportableParts.filter((p) => !p.isDowel);
    const dowels = opts.includeDowels ? exportableParts.filter((p) => p.isDowel) : [];

    // When auto-orient is on, we clone each mesh and bake an orient transform
    // so the source mesh in the scene stays in its natural cut position.
    const exportMesh = (m: THREE.Mesh): THREE.Mesh => {
      if (!opts.autoOrient) return m;
      const cloned = new THREE.Mesh(m.geometry.clone(), m.material);
      applyAutoOrient(cloned);
      return cloned;
    };

    const baseName = opts.filename.replace(/\.(zip|3mf)$/i, "");
    let bytes: Uint8Array;
    let downloadName: string;
    let mime: string;
    if (opts.format === "3mf") {
      const items = [
        ...parts.map((p) => ({ name: p.meta.name, mesh: exportMesh(p.mesh) })),
        ...dowels.map((p) => ({ name: p.meta.name, mesh: exportMesh(p.mesh) })),
      ];
      bytes = exportToMulti3MF(items);
      downloadName = `${baseName}.3mf`;
      mime = "model/3mf";
    } else {
      const zipParts = parts.map((p) => ({
        name: `${p.meta.name.replace(/\s+/g, "_")}.stl`,
        mesh: exportMesh(p.mesh),
      }));
      const zipDowels = dowels.map((p, i) => ({
        name: `dowel_${String(i + 1).padStart(2, "0")}.stl`,
        mesh: exportMesh(p.mesh),
      }));
      bytes = buildZipExport(zipParts, zipDowels);
      downloadName = `${baseName}.zip`;
      mime = "application/zip";
    }

    await saveBytes(downloadName, mime, bytes);
    setShowExportDialog(false);
  };

  const onSuggestCuts = useCallback(() => {
    const printer = session.session.printer;
    if (!printer) return;
    let target: { id: PartId; bbox: THREE.Box3 } | null = null;
    for (const p of session.partsArray) {
      if (!p.meta.visible || p.isDowel) continue;
      const bb = new THREE.Box3().setFromObject(p.group);
      if (!fitsInPrinter(dimensionsFromBBox(bb), printer)) {
        target = { id: p.id, bbox: bb };
        break;
      }
    }
    if (!target) return;
    setSuggestedCuts({ partId: target.id, cuts: suggestCuts(target.bbox, printer) });
  }, [session.session.printer, session.partsArray]);

  // Build the viewer's cutParts list from all visible parts when a cut has been done.
  // When no cut has happened yet, the imported root part is passed as rootGroup.
  const importRoot = session.partsArray.find((p) => p.meta.source === "import") ?? null;
  const hasCutParts = session.partsArray.some((p) => p.meta.source === "cut");

  const cutPartsForViewer = hasCutParts
    ? session.partsArray.map((p) => ({
        id: p.id,
        group: p.group,
        visible: p.meta.visible,
        isDowel: p.isDowel,
      }))
    : undefined;

  const hasContent = importRoot !== null;

  const startCut = (axis: "x" | "y" | "z") => {
    if (!activePart) return;
    setCutAxis(axis);
    setShowCutPanel(true);
  };

  useKeyboard(
    {
      "o": () => void handleOpen(),
      "x": () => startCut("x"),
      "y": () => startCut("y"),
      "z": () => startCut("z"),
      "Escape": () => {
        setShowCutPanel(false);
        setShowExportDialog(false);
        setShowHelp(false);
        setSuggestedCuts(null);
        setPreviewPlane(null);
        setPreviewDowels([]);
      },
      "Ctrl+z": session.undo,
      "Ctrl+Z": session.undo,
      "Ctrl+Shift+Z": session.redo,
      "Ctrl+Shift+z": session.redo,
      "Ctrl+e": () => hasCutParts && setShowExportDialog(true),
      "Ctrl+E": () => hasCutParts && setShowExportDialog(true),
      "?": () => setShowHelp((s) => !s),
    },
    [session.undo, session.redo, hasCutParts, activePart, handleOpen],
  );

  return (
    <div className="h-full w-full flex flex-col bg-slate-100">
      <input
        ref={fileInputRef}
        type="file"
        accept=".stl,.obj,.3mf,.glb"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.currentTarget.value = "";
        }}
      />
      <Toolbar
        onOpen={handleOpen}
        onExport={onExport}
        canExport={hasCutParts}
        onUndo={session.undo}
        onRedo={session.redo}
        canUndo={session.canUndo}
        canRedo={session.canRedo}
        printerSlot={
          <>
            {hasCutParts && (
              <ExplodedView value={explodeFactor} onChange={setExplodeFactor} />
            )}
            <PrinterPanel
              selected={session.session.printer}
              onChange={session.setPrinter}
            />
          </>
        }
      />
      <main className="flex-1 flex relative">
        {hasContent && (
          <PartsTree
            parts={session.partsArray}
            selectedId={session.session.selectedPartId}
            onSelect={(id) => {
              session.selectPartId(id);
              setShowCutPanel(true);
              setPreviewPlane(null);
              setPreviewDowels([]);
            }}
            onToggleVisible={session.togglePartVisible}
          />
        )}
        {showCutPanel && bbox && (
          <CutPanel
            bboxMin={bbox.min.toArray() as [number, number, number]}
            bboxMax={bbox.max.toArray() as [number, number, number]}
            axis={cutAxis}
            onAxisChange={setCutAxis}
            onPreviewChange={onPreview}
            onCut={onCut}
            onCancel={() => {
              setShowCutPanel(false);
              setPreviewPlane(null);
              setPreviewDowels([]);
            }}
            busy={session.busy}
          />
        )}
        <div className="flex-1 relative">
          {!hasContent ? (
            <DropZone onFile={handleFile} isDark={false}>
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-slate-100 text-slate-500">
                <svg
                  width="56"
                  height="56"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="opacity-40"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <p className="text-base font-medium opacity-60">
                  Drop an STL, OBJ, 3MF, or GLB file here
                </p>
                <button
                  className="mt-1 px-4 py-2 rounded text-sm font-medium bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Browse file
                </button>
                <button
                  className="text-xs text-blue-600 hover:underline mt-2"
                  onClick={async () => {
                    try {
                      const res = await fetch("/sample-keycap.3mf");
                      const blob = await res.blob();
                      void handleFile(new File([blob], "sample-keycap.3mf"));
                    } catch (e) {
                      setError(e instanceof Error ? e.message : String(e));
                    }
                  }}
                >Try with a sample model</button>
              </div>
            </DropZone>
          ) : (
            <Viewer
              rootGroup={hasCutParts ? null : (importRoot?.group ?? null)}
              cutParts={cutPartsForViewer}
              cutPreview={previewPlane && bbox ? { plane: previewPlane, bbox } : null}
              dowels={previewDowels}
              explodeFactor={explodeFactor}
            />
          )}
          {session.busy && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-slate-900/90 text-white text-sm px-3 py-1.5 rounded-full shadow-lg">
              <Spinner className="w-4 h-4 text-white" />
              <span>Cutting…</span>
            </div>
          )}
          {(error || session.error) && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 max-w-md bg-red-100 text-red-800 px-4 py-2 rounded shadow flex items-start gap-2">
              <span className="text-sm">
                {(() => {
                  const raw = error || session.error || "";
                  if (/does not intersect/i.test(raw))
                    return "Cut plane doesn't intersect the part. Try repositioning.";
                  if (/out of memory|RangeError/i.test(raw))
                    return "Cut failed (out of memory). For meshes this large, try the desktop version.";
                  if (/not manifold|gaps/i.test(raw))
                    return "This mesh has gaps and can't be cut reliably. Try repairing it in your CAD/slicer first.";
                  return raw;
                })()}
              </span>
              <button
                className="text-xs underline ml-auto"
                onClick={() => setError(null)}
              >Dismiss</button>
            </div>
          )}
        </div>
      </main>
      {modelInfo && (
        <StatusBar
          info={modelInfo}
          isDark={false}
          isLoading={false}
          error={null}
          parts={session.partsArray.map((p) => ({ visible: p.meta.visible, isDowel: p.isDowel, group: p.group }))}
          printer={session.session.printer}
          onSuggestCuts={onSuggestCuts}
        />
      )}
      {showExportDialog && (
        <ExportDialog
          defaultFilename={(modelInfo?.filename.replace(/\.[^.]+$/, "") ?? "pasak") + "-pasak"}
          onCancel={() => setShowExportDialog(false)}
          onConfirm={performExport}
        />
      )}
      {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}
      <UpdateNotification update={update} isDark={false} />
      {suggestedCuts && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow p-4 max-w-md">
            <h3 className="font-semibold">Suggested cuts</h3>
            <p className="text-sm">Will add {suggestedCuts.cuts.length} cut(s) producing {suggestedCuts.cuts.length + 1} parts that fit your printer.</p>
            <div className="flex gap-2 mt-3">
              <button className="flex-1 py-2 bg-slate-200 rounded" onClick={() => setSuggestedCuts(null)}>Cancel</button>
              <button
                className="flex-1 py-2 bg-emerald-600 text-white rounded"
                onClick={async () => {
                  await session.performCutsSequential(suggestedCuts.partId, suggestedCuts.cuts, { count: 4, diameter: 5, length: 20, tolerance: "pla-tight" });
                  setSuggestedCuts(null);
                }}
              >Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
