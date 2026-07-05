import { useMemo } from "react";
import * as THREE from "three";
import type { CutPlaneSpec } from "../types";
import { planeTransform } from "../lib/plane-transform";

type Props = {
  plane: CutPlaneSpec;
  bbox: THREE.Box3;
  /** Called when the user clicks on the plane at a world-space point. */
  onClick?: (point: THREE.Vector3) => void;
};

/**
 * Renders a translucent plane visualization at the given cut location.
 * Sized to extend slightly past the part bbox.
 */
export function CutPlane({ plane, bbox, onClick }: Props) {
  const { position, quaternion, size } = useMemo(
    () => planeTransform(plane, bbox),
    [plane, bbox],
  );

  return (
    <group position={position} quaternion={quaternion}>
      <mesh
        onClick={(e) => {
          if (!onClick) return;
          // Only react to a clean click (no drag); R3F sets event.button on click.
          e.stopPropagation();
          onClick(e.point);
        }}
      >
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
