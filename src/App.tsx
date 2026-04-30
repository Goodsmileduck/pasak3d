import { useCallback, useState } from "react";
import { Viewer } from "./components/Viewer";
import { DropZone } from "./components/DropZone";
import { StatusBar } from "./components/StatusBar";
import { Spinner } from "./components/Spinner";
import { useTheme } from "./hooks/useTheme";
import { useViewerControls } from "./hooks/useViewerControls";
import { loadModel } from "./lib/loaders";
import type { ModelData } from "./types";

export default function App() {
  const { isDark } = useTheme();
  const { plateMode, wireframe, handleControlsReady } = useViewerControls();

  const [model, setModel] = useState<ModelData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setLoading(true);
    try {
      const buf = await file.arrayBuffer();
      if (buf.byteLength > 100 * 1024 * 1024) {
        console.warn(
          "Large mesh — cuts may be slow or fail. The desktop version handles big files better.",
        );
      }
      const data = await loadModel(file.name, buf, file.size);
      setModel(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const emptyBg = isDark ? "bg-neutral-900 text-neutral-400" : "bg-slate-100 text-slate-500";

  return (
    <div
      className={`h-full w-full flex flex-col ${isDark ? "bg-neutral-900" : "bg-slate-100"}`}
    >
      <header
        className={`px-4 py-2 border-b text-sm font-semibold shrink-0 ${
          isDark
            ? "bg-neutral-800 border-neutral-700 text-neutral-100"
            : "bg-white border-slate-200 text-slate-800"
        }`}
      >
        Pasak{" "}
        <span className={isDark ? "font-normal text-neutral-400" : "font-normal text-slate-500"}>
          — alpha
        </span>
      </header>

      <main className="flex-1 relative min-h-0">
        <DropZone onFile={handleFile} isDark={isDark}>
          {model ? (
            <Viewer
              model={model}
              isDark={isDark}
              wireframe={wireframe}
              plateMode={plateMode}
              onControlsReady={handleControlsReady}
            />
          ) : (
            <div
              className={`w-full h-full flex flex-col items-center justify-center gap-3 ${emptyBg}`}
            >
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
              <label
                className={`mt-1 cursor-pointer px-4 py-2 rounded text-sm font-medium transition-colors ${
                  isDark
                    ? "bg-neutral-700 hover:bg-neutral-600 text-neutral-200"
                    : "bg-slate-200 hover:bg-slate-300 text-slate-700"
                }`}
              >
                Browse file
                <input
                  type="file"
                  accept=".stl,.obj,.3mf,.glb"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFile(file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          )}
        </DropZone>

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-black/50 z-40">
            <Spinner className="w-10 h-10 text-blue-500" />
          </div>
        )}

        {error && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-100 text-red-800 px-4 py-2 rounded shadow text-sm max-w-sm text-center">
            {error}
          </div>
        )}
      </main>

      <StatusBar
        info={model?.info ?? null}
        error={error}
        isDark={isDark}
        isLoading={loading}
      />
    </div>
  );
}
