import { useMemo } from "react";
import * as THREE from "three";
import type { CutPlaneSpec } from "../types";

type Props = {
  plane: CutPlaneSpec;
  bbox: THREE.Box3;
};

/**
 * Renders a translucent plane visualization at the given cut location.
 * Sized to extend slightly past the part bbox.
 */
export function CutPlane({ plane, bbox }: Props) {
  const { position, quaternion, size } = useMemo(() => {
    const n = new THREE.Vector3(...plane.normal).normalize();
    const center = bbox.getCenter(new THREE.Vector3());
    // Closest point on plane (n · p = constant) to the bbox center.
    const signedDist = n.dot(center) - plane.constant;
    const pos = center.clone().sub(n.clone().multiplyScalar(signedDist));
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    const sizeVec = bbox.getSize(new THREE.Vector3());
    const planeSize = Math.max(sizeVec.x, sizeVec.y, sizeVec.z) * 1.5;
    return { position: pos, quaternion: q, size: planeSize };
  }, [plane, bbox]);

  return (
    <group position={position} quaternion={quaternion}>
      <mesh>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.25} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[new THREE.PlaneGeometry(size, size)]} />
        <lineBasicMaterial color="#0891b2" />
      </lineSegments>
    </group>
  );
}
