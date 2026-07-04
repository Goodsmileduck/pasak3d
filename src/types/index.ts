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

export type JointShape = "cylinder" | "cube" | "cross" | "dovetail" | "puzzle";
export type JointPolarity = "separate-peg" | "male" | "female" | "magnet";

/**
 * A joint placed on a cut seam. Superset of the former `Dowel`.
 * Missing `shape`/`polarity` => legacy cylinder + separate-peg behavior.
 */
export type Joint = {
  id: string;
  position: [number, number, number]; // world-space, on the cut plane
  axis: [number, number, number];     // unit normal of the cut plane
  diameter: number;                    // mm (nominal; drives radius / box size)
  length: number;                      // mm
  source: "auto" | "manual";
  shape?: JointShape;                  // default "cylinder"
  polarity?: JointPolarity;            // default "separate-peg"
  taper?: number;                      // 0..1 draft (0 = straight)
  clearance?: number;                  // per-joint radial clearance override (mm)
};

/** Back-compat alias - existing code referencing `Dowel` keeps working. */
export type Dowel = Joint;

/** Selectable joint shapes / polarities, in UI order. */
export const JOINT_SHAPES: JointShape[] = ["cylinder", "cube", "cross", "dovetail", "puzzle"];
export const JOINT_POLARITIES: JointPolarity[] = ["separate-peg", "male", "female", "magnet"];

/** Radial clearance for a joint: per-joint override, else the tolerance preset. */
export function resolveClearance(joint: Joint, preset: TolerancePreset): number {
  return joint.clearance ?? TOLERANCE_VALUES[preset];
}

/** Joint shape with the legacy-dowel default applied. */
export function resolveShape(joint: Joint): JointShape {
  return joint.shape ?? "cylinder";
}

/** Joint polarity with the legacy-dowel default applied. */
export function resolvePolarity(joint: Joint): JointPolarity {
  return joint.polarity ?? "separate-peg";
}

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
  dowels: Joint[];
  tolerance: TolerancePreset;
  resultPartIds: [PartId, PartId];
  createdAt: number;
};

export type PrinterPreset = {
  id: string;
  name: string;
  buildVolume: { x: number; y: number; z: number }; // mm
};
