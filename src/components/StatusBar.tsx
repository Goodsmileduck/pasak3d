import * as THREE from "three";
import type { ModelInfo, PrinterPreset } from "../types";
import { dimensionsFromBBox, fitsInPrinter } from "../lib/printer-presets";

interface StatusBarProps {
  info: ModelInfo | null;
  error: string | null;
  isDark: boolean;
  isLoading: boolean;
  parts?: Array<{ visible: boolean; isDowel: boolean; group: THREE.Group }>;
  printer?: PrinterPreset | null;
  onSuggestCuts?: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${(bytes / 1_000).toFixed(1)} KB`;
}

function FitIndicator({
  parts,
  printer,
  onSuggestCuts,
}: {
  parts: Array<{ visible: boolean; isDowel: boolean; group: THREE.Group }>;
  printer: PrinterPreset | null | undefined;
  onSuggestCuts?: () => void;
}) {
  if (!printer) {
    return (
      <span className="ml-auto px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">
        Add a printer to check fit
      </span>
    );
  }

  const visibleParts = parts.filter((p) => p.visible && !p.isDowel);
  if (visibleParts.length === 0) return null;

  const tooBig = visibleParts.filter((p) => {
    const bb = new THREE.Box3().setFromObject(p.group);
    return !fitsInPrinter(dimensionsFromBBox(bb), printer);
  });

  if (tooBig.length === 0) {
    return (
      <span className="ml-auto px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">
        All parts fit {printer.name}
      </span>
    );
  }

  return (
    <span className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">
      {tooBig.length} {tooBig.length === 1 ? "part" : "parts"} too big
      {onSuggestCuts && (
        <button
          className="underline hover:no-underline"
          onClick={onSuggestCuts}
        >
          Suggest cuts
        </button>
      )}
    </span>
  );
}

export function StatusBar({ info, error, isDark, isLoading, parts, printer, onSuggestCuts }: StatusBarProps) {
  const bg = isDark
    ? "bg-neutral-900 border-neutral-700 text-neutral-400"
    : "bg-gray-50 border-gray-200 text-gray-500";
  const separator = `hidden md:inline ${isDark ? "text-neutral-600" : "text-gray-300"}`;

  return (
    <div
      className={`flex items-center gap-2 md:gap-4 px-2 md:px-3 py-1 border-t text-xs shrink-0 select-none ${bg}`}
    >
      {error && (
        <span className="text-red-400">{error}</span>
      )}

      {info && !error && (
        <>
          <span className="hidden md:inline">{info.filename}</span>
          <span className={separator}>|</span>
          <span className="hidden md:inline">{info.format.toUpperCase()}</span>
          <span className={separator}>|</span>
          <span>{formatFileSize(info.fileSize)}</span>
          <span className={separator}>|</span>
          <span>{info.triCount.toLocaleString()} triangles</span>
          <span className={separator}>|</span>
          <span className="hidden md:inline">
            {info.dimensions.x.toFixed(1)} × {info.dimensions.y.toFixed(1)} × {info.dimensions.z.toFixed(1)} mm
          </span>
          {parts !== undefined && (
            <FitIndicator parts={parts} printer={printer} onSuggestCuts={onSuggestCuts} />
          )}
        </>
      )}

      {!info && !error && !isLoading && (
        <span>Drop a file to load a model</span>
      )}
    </div>
  );
}
