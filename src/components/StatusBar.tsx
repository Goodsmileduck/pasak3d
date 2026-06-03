import * as THREE from "three";
import type { ModelInfo, PrinterPreset } from "../types";
import { dimensionsFromBBox, fitsInPrinter } from "../lib/printer-presets";

interface StatusBarProps {
  info: ModelInfo | null;
  error: string | null;
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
      <span className="ml-auto px-2 py-0.5 rounded-full text-xs bg-[var(--surface-2)] text-[var(--ink-muted)]">
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
      <span className="ml-auto px-2 py-0.5 rounded-full text-xs bg-[var(--success-tint)] text-[var(--success)]">
        All parts fit {printer.name}
      </span>
    );
  }

  return (
    <span className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[var(--warning-tint)] text-[var(--warning)]">
      {tooBig.length} {tooBig.length === 1 ? "part" : "parts"} too big
      {onSuggestCuts && (
        <button className="underline hover:no-underline" onClick={onSuggestCuts}>
          Suggest cuts
        </button>
      )}
    </span>
  );
}

export function StatusBar({ info, error, isLoading, parts, printer, onSuggestCuts }: StatusBarProps) {
  const separator = "hidden md:inline text-[var(--ink-faint)]";

  return (
    <div className="flex items-center gap-2 md:gap-4 px-2 md:px-3 py-1 border-t border-[var(--border)] text-xs shrink-0 select-none bg-[var(--surface)] text-[var(--ink-muted)]">
      {error && <span className="text-[var(--danger)]">{error}</span>}

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

      {!info && !error && !isLoading && <span>Drop a file to load a model</span>}
    </div>
  );
}
