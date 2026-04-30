import { useState } from "react";

export type ExportFormat = "zip-stl" | "3mf";

export type ExportOptions = {
  format: ExportFormat;
  includeDowels: boolean;
  filename: string;
};

type Props = {
  defaultFilename: string;
  onCancel: () => void;
  onConfirm: (opts: ExportOptions) => void;
};

export function ExportDialog({ defaultFilename, onCancel, onConfirm }: Props) {
  const [format, setFormat] = useState<ExportFormat>("zip-stl");
  const [includeDowels, setIncludeDowels] = useState(true);
  const [filename, setFilename] = useState(defaultFilename);

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded shadow p-4 w-96 space-y-3">
        <h3 className="font-semibold">Export</h3>
        <label className="block">
          <span className="text-sm">Format</span>
          <select
            className="block w-full border border-slate-300 rounded px-2 py-1 mt-1 text-sm"
            value={format}
            onChange={(e) => setFormat(e.target.value as ExportFormat)}
          >
            <option value="zip-stl">Zip of STL files (one per part)</option>
            <option value="3mf">Single 3MF (multi-object)</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeDowels}
            onChange={(e) => setIncludeDowels(e.target.checked)}
          />
          Include dowels
        </label>
        <label className="block">
          <span className="text-sm">Filename</span>
          <input
            className="block w-full border border-slate-300 rounded px-2 py-1 mt-1 text-sm"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
          />
        </label>
        <div className="flex gap-2 mt-4">
          <button className="flex-1 py-2 bg-slate-200 rounded text-sm" onClick={onCancel}>Cancel</button>
          <button
            className="flex-1 py-2 bg-emerald-600 text-white rounded text-sm"
            onClick={() => onConfirm({ format, includeDowels, filename })}
          >Export</button>
        </div>
      </div>
    </div>
  );
}
