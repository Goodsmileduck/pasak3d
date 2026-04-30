import * as THREE from "three";
import type { CutPlaneSpec, PrinterPreset } from "../../types";

/**
 * Given a part bbox and a printer, suggest a sequence of axis-aligned cuts that produce
 * pieces fitting within the build volume. Picks the longest axis (relative to build volume),
 * divides into N equal slabs (N = ceil(extent / printerSize)).
 */
export function suggestCuts(bbox: THREE.Box3, printer: PrinterPreset): CutPlaneSpec[] {
  const size = bbox.getSize(new THREE.Vector3());
  const ratios: Array<{ axis: "x" | "y" | "z"; ratio: number; extent: number; min: number }> = [
    { axis: "x", ratio: size.x / printer.buildVolume.x, extent: size.x, min: bbox.min.x },
    { axis: "y", ratio: size.y / printer.buildVolume.y, extent: size.y, min: bbox.min.y },
    { axis: "z", ratio: size.z / printer.buildVolume.z, extent: size.z, min: bbox.min.z },
  ].sort((a, b) => b.ratio - a.ratio);

  const worst = ratios[0];
  if (worst.ratio <= 1) return [];

  const slabs = Math.ceil(worst.ratio);
  const cuts: CutPlaneSpec[] = [];
  const normal: [number, number, number] = worst.axis === "x" ? [1, 0, 0] : worst.axis === "y" ? [0, 1, 0] : [0, 0, 1];
  for (let i = 1; i < slabs; i++) {
    const constant = worst.min + (worst.extent * i) / slabs;
    cuts.push({ normal, constant, axisSnap: worst.axis });
  }
  return cuts;
}
