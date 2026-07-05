import * as THREE from "three";

/** Offset a point by distance `d` along a (unit) axis. */
export function shiftAlong(
  p: [number, number, number],
  axis: [number, number, number],
  d: number,
): [number, number, number] {
  return [p[0] + axis[0] * d, p[1] + axis[1] * d, p[2] + axis[2] * d];
}

export function placeSolid(
  solid: any,
  position: [number, number, number],
  axis: [number, number, number],
): any {
  const mat = rotationMat4FromTo([0, 0, 1], axis);
  // transform() and translate() each allocate a new Manifold; free the
  // intermediate so it doesn't leak until the whole WASM heap is torn down.
  const rotated = solid.transform(mat);
  const out = rotated.translate(position);
  rotated.delete();
  return out;
}

/**
 * Column-major 4x4 rotation matrix mapping unit vector `from` to `to`, in the
 * layout Manifold's `transform()` expects. three.js `Matrix4` is column-major
 * and `Quaternion.setFromUnitVectors` handles the antiparallel case, so we lean
 * on the library instead of re-deriving Rodrigues by hand.
 */
export function rotationMat4FromTo(
  from: [number, number, number],
  to: [number, number, number],
): number[] {
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(from[0], from[1], from[2]).normalize(),
    new THREE.Vector3(to[0], to[1], to[2]).normalize(),
  );
  return new THREE.Matrix4().makeRotationFromQuaternion(q).toArray();
}
