import { useState } from "react";
import type { CutPlaneSpec, TolerancePreset, Dowel } from "../types";
import { TOLERANCE_VALUES } from "../types";

type Props = {
  bboxMin: [number, number, number];
  bboxMax: [number, number, number];
  initialAxis?: "x" | "y" | "z";
  onPreviewChange: (plane: CutPlaneSpec, dowels: Dowel[], tolerance: TolerancePreset) => void;
  onCut: (plane: CutPlaneSpec, dowels: Dowel[], tolerance: TolerancePreset) => void;
  onCancel: () => void;
  busy: boolean;
};

export function CutPanel({ bboxMin, bboxMax, initialAxis = "x", onPreviewChange, onCut, onCancel, busy }: Props) {
  const [axis, setAxis] = useState<"x" | "y" | "z">(initialAxis);
  const axisIdx = axis === "x" ? 0 : axis === "y" ? 1 : 2;
  const min = bboxMin[axisIdx];
  const max = bboxMax[axisIdx];
  const center = (min + max) / 2;
  const [position, setPosition] = useState(center);
  const [dowelCount, setDowelCount] = useState(4);
  const [dowelDiameter, setDowelDiameter] = useState(5);
  const [dowelLength, setDowelLength] = useState(20);
  const [tolerance, setTolerance] = useState<TolerancePreset>("pla-tight");

  const buildPlane = (): CutPlaneSpec => {
    const normal: [number, number, number] = axis === "x" ? [1, 0, 0] : axis === "y" ? [0, 1, 0] : [0, 0, 1];
    return { normal, constant: position, axisSnap: axis };
  };

  const buildAutoDowels = (): Dowel[] => {
    return Array.from({ length: dowelCount }, (_, i) => ({
      id: `auto_${i}`,
      position: [
        axis === "x" ? position : 0,
        axis === "y" ? position : 0,
        axis === "z" ? position : 0,
      ],
      axis: axis === "x" ? [1, 0, 0] : axis === "y" ? [0, 1, 0] : [0, 0, 1],
      diameter: dowelDiameter,
      length: dowelLength,
      source: "auto",
    }));
  };

  const fire = (handler: typeof onPreviewChange) => {
    const plane = buildPlane();
    const dowels = buildAutoDowels();
    handler(plane, dowels, tolerance);
  };

  const updatePosition = (v: number) => { setPosition(v); fire(onPreviewChange); };

  return (
    <div className="bg-white border-r border-slate-200 p-3 w-72 flex flex-col gap-3 text-sm">
      <div>
        <div className="font-semibold mb-1">Cut Axis</div>
        <div className="flex gap-1">
          {(["x", "y", "z"] as const).map((a) => (
            <button
              key={a}
              className={`flex-1 py-1 rounded ${axis === a ? "bg-slate-900 text-white" : "bg-slate-100"}`}
              onClick={() => { setAxis(a); fire(onPreviewChange); }}
            >{a.toUpperCase()}</button>
          ))}
        </div>
      </div>
      <div>
        <label className="block font-semibold mb-1">Position (mm)</label>
        <input type="range" min={min} max={max} step={0.1} value={position} onChange={(e) => updatePosition(+e.target.value)} className="w-full" />
        <input type="number" value={position.toFixed(2)} onChange={(e) => updatePosition(+e.target.value)} className="w-full border border-slate-300 rounded px-2 py-1 mt-1" />
      </div>
      <div className="border-t border-slate-200 pt-3">
        <div className="font-semibold mb-1">Dowels</div>
        <label className="block text-xs">Count</label>
        <input type="number" min={0} max={20} value={dowelCount} onChange={(e) => { setDowelCount(+e.target.value); fire(onPreviewChange); }} className="w-full border border-slate-300 rounded px-2 py-1" />
        <label className="block text-xs mt-2">Diameter (mm)</label>
        <input type="number" min={2} max={20} step={0.5} value={dowelDiameter} onChange={(e) => { setDowelDiameter(+e.target.value); fire(onPreviewChange); }} className="w-full border border-slate-300 rounded px-2 py-1" />
        <label className="block text-xs mt-2">Length (mm)</label>
        <input type="number" min={5} max={100} value={dowelLength} onChange={(e) => { setDowelLength(+e.target.value); fire(onPreviewChange); }} className="w-full border border-slate-300 rounded px-2 py-1" />
      </div>
      <div>
        <label className="block font-semibold mb-1">Tolerance</label>
        <select value={tolerance} onChange={(e) => { setTolerance(e.target.value as TolerancePreset); fire(onPreviewChange); }} className="w-full border border-slate-300 rounded px-2 py-1">
          {Object.entries(TOLERANCE_VALUES).map(([k, v]) => (
            <option key={k} value={k}>{k} ({v}mm)</option>
          ))}
        </select>
      </div>
      <div className="flex gap-2 mt-auto">
        <button className="flex-1 py-2 bg-slate-200 rounded" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className="flex-1 py-2 bg-emerald-600 text-white rounded disabled:opacity-50" onClick={() => fire(onCut)} disabled={busy}>{busy ? "Cutting..." : "Cut"}</button>
      </div>
    </div>
  );
}
