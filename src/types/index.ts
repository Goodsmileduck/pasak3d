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
