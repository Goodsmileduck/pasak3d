import * as THREE from "three";
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from "three-mesh-bvh";

const bgProto = THREE.BufferGeometry.prototype as any;
bgProto.computeBoundsTree = computeBoundsTree;
bgProto.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

export function attachBVH(group: THREE.Group): void {
  group.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry instanceof THREE.BufferGeometry) {
      try {
        (child.geometry as THREE.BufferGeometry & { computeBoundsTree: () => void }).computeBoundsTree();
      } catch (e) {
        console.warn("BVH computation failed for mesh:", e);
      }
    }
  });
}
