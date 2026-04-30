import { useCallback, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Viewer } from "./components/Viewer";
import { DropZone } from "./components/DropZone";
import { StatusBar } from "./components/StatusBar";
import { Spinner } from "./components/Spinner";
import { Toolbar } from "./components/Toolbar";
import { CutPanel } from "./components/CutPanel";
import { PartsTree } from "./components/PartsTree";
import { PrinterPanel } from "./components/PrinterPanel";
import { loadModel } from "./lib/loaders";
import { useCutSession } from "./hooks/useCutSession";
import { autoPlaceCutDowels } from "./lib/cut/auto-place-cut-dowels";
import { buildZipExport } from "./lib/exporters/zip-export";
import { suggestCuts } from "./lib/cut/fit-to-printer";
import { fitsInPrinter, dimensionsFromBBox } from "./lib/printer-presets";
import type { ModelData, CutPlaneSpec, Dowel, TolerancePreset, PartId } from "./types";

export default function App() {
  const session = useCutSession();
  const [modelInfo, setModelInfo] = useState<ModelData["info"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCutPanel, setShowCutPanel] = useState(false);
  const [previewPlane, setPreviewPlane] = useState<CutPlaneSpec | null>(null);
  const [previewDowels, setPreviewDowels] = useState<Dowel[]>([]);
  const [suggestedCuts, setSuggestedCuts] = useState<{ partId: PartId; cuts: CutPlaneSpec[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const onPreview = (plane: CutPlaneSpec, dowelsHint: Dowel[], _t: TolerancePreset) => {
    if (!activePart) return;
    setPreviewPlane(plane);
    const placed = autoPlaceCutDowels(activePart.mesh, plane, {
      count: dowelsHint.length,
      dowelDiameter: dowelsHint[0]?.diameter ?? 5,
      length: dowelsHint[0]?.length ?? 20,
      minSpacing: 2,
    });
    setPreviewDowels(placed);
  };

  const onCut = (plane: CutPlaneSpec, dowelsHint: Dowel[], tolerance: TolerancePreset) => {
    if (!activePart) return;
    const placed = autoPlaceCutDowels(activePart.mesh, plane, {
      count: dowelsHint.length,
      dowelDiameter: dowelsHint[0]?.diameter ?? 5,
      length: dowelsHint[0]?.length ?? 20,
      minSpacing: 2,
    });
    void session.performCut(activePart.id, plane, placed, tolerance);
    setShowCutPanel(false);
    setPreviewPlane(null);
    setPreviewDowels([]);
  };

  const onExport = () => {
    const exportableParts = session.partsArray.filter((p) => p.meta.source === "cut");
    if (exportableParts.length === 0) return;
    const parts = exportableParts
      .filter((p) => !p.isDowel)
      .map((p) => ({ name: `${p.meta.name.replace(/\s+/g, "_")}.stl`, mesh: p.mesh }));
    const dowels = exportableParts
      .filter((p) => p.isDowel)
      .map((p, i) => ({ name: `dowel_${String(i + 1).padStart(2, "0")}.stl`, mesh: p.mesh }));
    const zip = buildZipExport(parts, dowels);
    const blob = new Blob([zip.buffer as ArrayBuffer], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (modelInfo?.filename.replace(/\.[^.]+$/, "") ?? "pasak") + "-pasak.zip";
    a.click();
    URL.revokeObjectURL(url);
  };

  const onSuggestCuts = useCallback(() => {
    if (!session.session.printer) return;
    const tooBig = session.partsArray.find((p) => {
      if (!p.meta.visible || p.isDowel) return false;
      const bb = new THREE.Box3().setFromObject(p.group);
      return !fitsInPrinter(dimensionsFromBBox(bb), session.session.printer!);
    });
    if (!tooBig) return;
    const bb = new THREE.Box3().setFromObject(tooBig.group);
    const cuts = suggestCuts(bb, session.session.printer);
    setSuggestedCuts({ partId: tooBig.id, cuts });
  }, [session.session.printer, session.partsArray]);

  const hasCutParts = session.partsArray.some((p) => p.meta.source === "cut");

  // Build the viewer's cutParts list from all visible parts when a cut has been done.
  // When no cut has happened yet, the imported root part is passed as rootGroup.
  const importRoot = session.partsArray.find((p) => p.meta.source === "import") ?? null;
  const hasAnyCut = session.partsArray.some((p) => p.meta.source === "cut");

  const cutPartsForViewer = hasAnyCut
    ? session.partsArray.map((p) => ({
        id: p.id,
        group: p.group,
        visible: p.meta.visible,
        isDowel: p.isDowel,
      }))
    : undefined;

  const hasContent = importRoot !== null || hasAnyCut;

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
        onOpen={() => fileInputRef.current?.click()}
        onExport={onExport}
        canExport={hasCutParts}
        onUndo={session.undo}
        onRedo={session.redo}
        canUndo={session.canUndo}
        canRedo={session.canRedo}
        printerSlot={
          <PrinterPanel
            selected={session.session.printer}
            onChange={session.setPrinter}
          />
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
              </div>
            </DropZone>
          ) : (
            <Viewer
              rootGroup={hasAnyCut ? null : (importRoot?.group ?? null)}
              cutParts={cutPartsForViewer}
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
