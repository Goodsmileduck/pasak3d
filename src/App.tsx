import { useCallback, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Viewer } from "./components/Viewer";
import { DropZone } from "./components/DropZone";
import { StatusBar } from "./components/StatusBar";
import { Spinner } from "./components/Spinner";
import { Toolbar } from "./components/Toolbar";
import { CutPanel } from "./components/CutPanel";
import { loadModel } from "./lib/loaders";
import { useCutSession } from "./hooks/useCutSession";
import { autoPlaceCutDowels } from "./lib/cut/auto-place-cut-dowels";
import { buildZipExport } from "./lib/exporters/zip-export";
import type { ModelData, CutPlaneSpec, Dowel, TolerancePreset } from "./types";

export default function App() {
  const session = useCutSession();
  const [modelInfo, setModelInfo] = useState<ModelData["info"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCutPanel, setShowCutPanel] = useState(false);
  const [previewPlane, setPreviewPlane] = useState<CutPlaneSpec | null>(null);
  const [previewDowels, setPreviewDowels] = useState<Dowel[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
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
  }, [session]);

  const bbox = useMemo(() => {
    if (!session.rootPart) return null;
    const b = new THREE.Box3().setFromObject(session.rootPart.group);
    return b;
  }, [session.rootPart]);

  const onPreview = (plane: CutPlaneSpec, dowelsHint: Dowel[], _t: TolerancePreset) => {
    if (!session.rootPart) return;
    setPreviewPlane(plane);
    const placed = autoPlaceCutDowels(session.rootPart.mesh, plane, {
      count: dowelsHint.length,
      dowelDiameter: dowelsHint[0]?.diameter ?? 5,
      length: dowelsHint[0]?.length ?? 20,
      minSpacing: 2,
    });
    setPreviewDowels(placed);
  };

  const onCut = (plane: CutPlaneSpec, dowelsHint: Dowel[], tolerance: TolerancePreset) => {
    if (!session.rootPart) return;
    const placed = autoPlaceCutDowels(session.rootPart.mesh, plane, {
      count: dowelsHint.length,
      dowelDiameter: dowelsHint[0]?.diameter ?? 5,
      length: dowelsHint[0]?.length ?? 20,
      minSpacing: 2,
    });
    session.performCut(plane, placed, tolerance);
    setShowCutPanel(false);
    setPreviewPlane(null);
    setPreviewDowels([]);
  };

  const onExport = () => {
    if (session.cutParts.length === 0) return;
    const parts = session.cutParts
      .filter((p) => !p.isDowel)
      .map((p) => ({ name: `${p.meta.name.replace(/\s+/g, "_")}.stl`, mesh: p.mesh }));
    const dowels = session.cutParts
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

  const cutParts = session.cutParts.length > 0
    ? session.cutParts.map((p) => ({ id: p.id, group: p.group, visible: p.meta.visible, isDowel: p.isDowel }))
    : undefined;

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
        canExport={session.cutParts.length > 0}
      />
      <main className="flex-1 flex relative">
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
          {!session.rootPart && cutParts === undefined ? (
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
              rootGroup={session.rootPart?.group ?? null}
              cutParts={cutParts}
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
      {modelInfo && <StatusBar info={modelInfo} isDark={false} isLoading={false} error={null} />}
    </div>
  );
}
