import { Mesh, type Group } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { LoadProgress } from "../../types";

export async function loadGLB(
  buffer: ArrayBuffer,
  filename: string,
  onProgress?: (p: LoadProgress) => void,
): Promise<Group> {
  onProgress?.({ stage: "Parsing GLB...", progress: 0.1 });

  const loader = new GLTFLoader();
  const gltf = await loader.parseAsync(buffer, "");
  const group = gltf.scene;
  group.name = filename;

  onProgress?.({ stage: "Building scene...", progress: 0.9 });

  group.traverse((child) => {
    if (child instanceof Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      if (child.geometry && !child.geometry.attributes.normal) {
        child.geometry.computeVertexNormals();
      }
    }
  });

  onProgress?.({ stage: "Done", progress: 1.0 });
  return group;
}
