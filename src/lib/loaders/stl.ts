import type { Group } from "three";
import type { LoadProgress } from "../../types";
import { parseSTL } from "../parsers/stl";
import { buildGroupFromMeshData } from "./mesh-builder";

const DEFAULT_COLOR = 0x2a5db0;

export function loadSTL(
  buffer: ArrayBuffer,
  filename: string,
  onProgress?: (p: LoadProgress) => void,
): Promise<Group> {
  onProgress?.({ stage: "Parsing geometry...", progress: 0.1 });
  const meshes = parseSTL(buffer, (parsed, total) => {
    onProgress?.({ stage: "Parsing geometry...", progress: 0.1 + 0.7 * (parsed / total) });
  });
  for (const m of meshes) m.color = DEFAULT_COLOR;
  onProgress?.({ stage: "Building scene...", progress: 0.9 });
  const group = buildGroupFromMeshData(meshes, filename);
  onProgress?.({ stage: "Done", progress: 1.0 });
  return Promise.resolve(group);
}
