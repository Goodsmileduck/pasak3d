import type * as THREE from "three";

export type FileFormat = "stl" | "obj" | "3mf" | "glb";

export interface WorkerMeshData {
  vertices: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  color?: number;
}

/** Progress callback for parsers: (parsed, total) where both are counts of elements processed. */
export type ParserProgressFn = (parsed: number, total: number) => void;

export type LoadProgress = {
  stage: string;
  progress: number; // 0..1
};

export type ModelInfo = {
  filename: string;
  format: FileFormat;
  fileSize: number;        // bytes
  triCount: number;
  bbox: { min: [number, number, number]; max: [number, number, number] };
  dimensions: { x: number; y: number; z: number }; // mm
};

export type ModelData = {
  group: THREE.Group;
  info: ModelInfo;
};

export type PartId = string;
export type CutId = string;

export type TolerancePreset = "pla-tight" | "pla-loose" | "petg" | "sla";

/**
 * Radial clearance per hole, in mm.
 * Hole radius = dowel radius + clearance. Both halves get the same clearance,
 * so total play between halves = 2 × value.
 */
export const TOLERANCE_VALUES: Record<TolerancePreset, number> = {
  "pla-tight": 0.10,
  "pla-loose": 0.20,
  "petg":      0.25,
  "sla":       0.05,
};

export type Dowel = {
  id: string;
  position: [number, number, number]; // world-space, on the cut plane
  axis: [number, number, number];     // unit normal of the cut plane
  diameter: number;                    // mm
  length: number;                      // mm (extends symmetrically across plane)
  source: "auto" | "manual";
};

export type CutPlaneSpec = {
  normal: [number, number, number]; // unit vector
  constant: number;                  // signed distance from origin
  axisSnap: "x" | "y" | "z" | "free";
};

export type Part = {
  id: PartId;
  name: string;
  source: "import" | "cut";
  parentId: PartId | null;
  cutId: CutId | null;
  visible: boolean;
  color: string;
  triCount: number;
};

export type Cut = {
  id: CutId;
  partId: PartId;
  plane: CutPlaneSpec;
  dowels: Dowel[];
  tolerance: TolerancePreset;
  resultPartIds: [PartId, PartId];
  createdAt: number;
};

export type PrinterPreset = {
  id: string;
  name: string;
  buildVolume: { x: number; y: number; z: number }; // mm
};
