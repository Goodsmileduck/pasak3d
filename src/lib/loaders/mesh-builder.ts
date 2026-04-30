import * as THREE from "three";
import type { WorkerMeshData } from "../../types";
import { createModelMaterial } from "./material";

const DEFAULT_COLORS = [
  0x2a5db0, 0x2e7d32, 0x8b5cf6, 0xe67e22,
  0xe74c3c, 0x1abc9c, 0xf39c12, 0x9b59b6,
];

export function buildGroupFromMeshData(
  meshes: WorkerMeshData[],
  name: string,
): THREE.Group {
  const group = new THREE.Group();
  group.name = name;

  for (let idx = 0; idx < meshes.length; idx++) {
    const meshData = meshes[idx];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(meshData.vertices, 3),
    );
    geometry.setIndex(new THREE.BufferAttribute(meshData.indices, 1));

    const hasNormals = meshData.normals && meshData.normals.length > 0;
    if (hasNormals) {
      geometry.setAttribute(
        "normal",
        new THREE.BufferAttribute(meshData.normals, 3),
      );
    } else {
      geometry.computeVertexNormals();
    }

    const color = meshData.color ?? DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
    const material = createModelMaterial(color);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  return group;
}
