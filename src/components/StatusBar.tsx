import type { ModelInfo } from "../types";

interface StatusBarProps {
  info: ModelInfo | null;
  error: string | null;
  isDark: boolean;
  isLoading: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${(bytes / 1_000).toFixed(1)} KB`;
}

export function StatusBar({ info, error, isDark, isLoading }: StatusBarProps) {
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
          {/* TODO M3: printer-fit indicator */}
        </>
      )}

      {!info && !error && !isLoading && (
        <span>Drop a file to load a model</span>
      )}
    </div>
  );
}
