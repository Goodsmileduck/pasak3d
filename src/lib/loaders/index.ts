import * as THREE from "three";
import type { FileFormat, LoadProgress, ModelData } from "../../types";
import { computeModelInfo } from "../model-info";
import { attachBVH } from "../bvh";
import { loadSTL } from "./stl";
import { loadOBJ } from "./obj";
import { load3MF } from "./3mf";
import { loadGLB } from "./glb";

export function detectFormat(filename: string): FileFormat | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "stl": return "stl";
    case "obj": return "obj";
    case "3mf": return "3mf";
    case "glb": return "glb";
    default: return null;
  }
}

export async function loadModel(
  filename: string,
  buffer: ArrayBuffer,
  fileSize: number,
  onProgress?: (p: LoadProgress) => void,
): Promise<ModelData> {
  const format = detectFormat(filename);
  if (!format) {
    throw new Error(
      `Unsupported file format: "${filename.split(".").pop()}". Supported: STL, OBJ, 3MF, GLB`,
    );
  }
  let group: THREE.Group;
  switch (format) {
    case "stl": group = await loadSTL(buffer, filename, onProgress); break;
    case "obj": group = await loadOBJ(buffer, filename, onProgress); break;
    case "3mf": group = await load3MF(buffer, filename, onProgress); break;
    case "glb": group = await loadGLB(buffer, filename, onProgress); break;
  }
  onProgress?.({ stage: "Optimizing...", progress: 0.95 });
  attachBVH(group);
  const info = computeModelInfo(group, filename, fileSize);
  return { group, info };
}

export const SUPPORTED_EXTENSIONS = [".stl", ".obj", ".3mf", ".glb"];
export const SUPPORTED_MIME_TYPES = [
  "model/stl",
  "model/obj",
  "model/3mf",
  "application/vnd.ms-package.3dmanufacturing-3dmodel+xml",
  "model/gltf-binary",
  "application/octet-stream",
  "",
];
