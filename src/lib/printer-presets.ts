import * as THREE from "three";
import type { PrinterPreset } from "../types";

export const PRINTER_PRESETS: PrinterPreset[] = [
  { id: "bambu-a1",   name: "Bambu Lab A1",        buildVolume: { x: 256, y: 256, z: 256 } },
  { id: "bambu-a1m",  name: "Bambu Lab A1 mini",   buildVolume: { x: 180, y: 180, z: 180 } },
  { id: "bambu-x1",   name: "Bambu Lab X1 / P1",   buildVolume: { x: 256, y: 256, z: 256 } },
  { id: "bambu-h2d",  name: "Bambu Lab H2D",       buildVolume: { x: 320, y: 320, z: 325 } },
  { id: "prusa-mk4",  name: "Prusa MK4 / MK4S",    buildVolume: { x: 250, y: 210, z: 220 } },
  { id: "prusa-core", name: "Prusa Core One",      buildVolume: { x: 250, y: 220, z: 270 } },
  { id: "ender-3",    name: "Creality Ender 3",    buildVolume: { x: 220, y: 220, z: 250 } },
  { id: "voron-2.4",  name: "Voron 2.4 (350mm)",   buildVolume: { x: 350, y: 350, z: 350 } },
];

export function dimensionsFromBBox(bb: THREE.Box3): { x: number; y: number; z: number } {
  const s = bb.getSize(new THREE.Vector3());
  return { x: s.x, y: s.y, z: s.z };
}

export function fitsInPrinter(dim: { x: number; y: number; z: number }, p: PrinterPreset): boolean {
  return dim.x <= p.buildVolume.x && dim.y <= p.buildVolume.y && dim.z <= p.buildVolume.z;
}
