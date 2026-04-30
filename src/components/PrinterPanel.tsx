import { PRINTER_PRESETS } from "../lib/printer-presets";
import type { PrinterPreset } from "../types";

type Props = {
  selected: PrinterPreset | null;
  onChange: (p: PrinterPreset | null) => void;
};

export function PrinterPanel({ selected, onChange }: Props) {
  return (
    <select
      className="border border-slate-300 rounded px-2 py-1 text-sm"
      value={selected?.id ?? ""}
      onChange={(e) => {
        const id = e.target.value;
        onChange(id === "" ? null : PRINTER_PRESETS.find((p) => p.id === id) ?? null);
      }}
    >
      <option value="">No printer</option>
      {PRINTER_PRESETS.map((p) => (
        <option key={p.id} value={p.id}>{p.name} ({p.buildVolume.x}×{p.buildVolume.y}×{p.buildVolume.z})</option>
      ))}
    </select>
  );
}
