import type { Group } from "three";
import type { LoadProgress } from "../../types";
import { parse3MF } from "../parsers/3mf";
import { buildGroupFromMeshData } from "./mesh-builder";

export function load3MF(
  buffer: ArrayBuffer,
  filename: string,
  onProgress?: (p: LoadProgress) => void,
): Promise<Group> {
  onProgress?.({ stage: "Parsing geometry...", progress: 0.1 });
  const meshes = parse3MF(buffer, (parsed, total) => {
    onProgress?.({ stage: "Parsing geometry...", progress: 0.1 + 0.7 * (parsed / total) });
  });
  onProgress?.({ stage: "Building scene...", progress: 0.9 });
  const group = buildGroupFromMeshData(meshes, filename);
  onProgress?.({ stage: "Done", progress: 1.0 });
  return Promise.resolve(group);
}
