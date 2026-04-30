import * as THREE from "three";

/** Reset group position to origin, then translate so it is centered on XY and sits on Z=0. */
export function centerOnXY(group: THREE.Group): void {
  group.position.set(0, 0, 0);
  group.updateMatrixWorld(true);
  const bbox = new THREE.Box3().setFromObject(group);
  const center = bbox.getCenter(new THREE.Vector3());
  group.position.set(-center.x, -center.y, -bbox.min.z);
}

export function computeBBoxDiagonal(bbox: THREE.Box3): number {
  const size = bbox.getSize(new THREE.Vector3());
  return Math.sqrt(size.x * size.x + size.y * size.y + size.z * size.z);
}

/** Z-up orthographic camera positioned looking down at -Y from a sensible offset. */
export function makeOrthoCamera(viewSize: number): THREE.OrthographicCamera {
  const aspect = 1; // updated by R3F based on canvas
  const cam = new THREE.OrthographicCamera(
    (-viewSize * aspect) / 2,
    (viewSize * aspect) / 2,
    viewSize / 2,
    -viewSize / 2,
    0.1,
    viewSize * 100,
  );
  cam.up.set(0, 0, 1);
  cam.position.set(viewSize, viewSize, viewSize);
  cam.lookAt(0, 0, 0);
  return cam;
}
