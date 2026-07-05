import * as THREE from "three";
import type { CutPlaneSpec } from "../types";

/** Placement of a translucent plane gizmo for a cut spec, sized past the part bbox.
 *  Shared by CutPlane (active gizmo) and SuggestedCutPlanes (bed-cut preview). */
export function planeTransform(
  plane: CutPlaneSpec,
  bbox: THREE.Box3,
): { position: THREE.Vector3; quaternion: THREE.Quaternion; size: number } {
  const n = new THREE.Vector3(...plane.normal).normalize();
  const center = bbox.getCenter(new THREE.Vector3());
  // Closest point on plane (n · p = constant) to the bbox center.
  const signedDist = n.dot(center) - plane.constant;
  const position = center.clone().sub(n.clone().multiplyScalar(signedDist));
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  const sizeVec = bbox.getSize(new THREE.Vector3());
  const size = Math.max(sizeVec.x, sizeVec.y, sizeVec.z) * 1.5;
  return { position, quaternion, size };
}
