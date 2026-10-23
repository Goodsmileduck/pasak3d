import * as THREE from "three";
import type { CutPlaneSpec } from "../../types";

/** True if the mesh (world space) has vertices on both sides of the plane — i.e. the plane would cut it. */
export function planeSeparatesMesh(mesh: THREE.Mesh, plane: CutPlaneSpec): boolean {
  const geom = mesh.geometry as THREE.BufferGeometry;
  const pos = geom.attributes.position as THREE.BufferAttribute;
  mesh.updateMatrixWorld(true);
  const n = new THREE.Vector3(plane.normal[0], plane.normal[1], plane.normal[2]);
  const v = new THREE.Vector3();
  let hasPos = false;
  let hasNeg = false;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    const s = n.dot(v) - plane.constant;
    if (s > 1e-4) hasPos = true;
    else if (s < -1e-4) hasNeg = true;
    if (hasPos && hasNeg) return true;
  }
  return false;
}
