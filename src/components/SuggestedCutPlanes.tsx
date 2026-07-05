import * as THREE from "three";
import type { CutPlaneSpec } from "../types";
import { planeTransform } from "../lib/plane-transform";

type Props = {
  cuts: CutPlaneSpec[];
  bbox: THREE.Box3;
};

/** Read-only amber gizmos for the pending fit-to-printer suggested cut planes. */
export function SuggestedCutPlanes({ cuts, bbox }: Props) {
  return (
    <>
      {cuts.map((plane, i) => {
        const { position, quaternion, size } = planeTransform(plane, bbox);
        return (
          <group key={i} position={position} quaternion={quaternion}>
            <mesh>
              <planeGeometry args={[size, size]} />
              <meshBasicMaterial color="#f59e0b" transparent opacity={0.2} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
            <lineSegments>
              <edgesGeometry args={[new THREE.PlaneGeometry(size, size)]} />
              <lineBasicMaterial color="#d97706" />
            </lineSegments>
          </group>
        );
      })}
    </>
  );
}
