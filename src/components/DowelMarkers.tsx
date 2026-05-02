import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { Dowel } from "../types";

type Props = {
  dowels: Dowel[];
  onDelete?: (id: string) => void;
};

/**
 * Visualize each dowel as a short cylinder along the cut normal — same shape
 * the dowel will actually have. Plus a small Html "×" delete button.
 *
 * The cylinder uses a translucent amber material so the user can see it
 * embedded in the part body.
 */
export function DowelMarkers({ dowels, onDelete }: Props) {
  return (
    <>
      {dowels.map((d) => {
        const n = new THREE.Vector3(...d.axis).normalize();
        // Three's CylinderGeometry is along Y axis; rotate Y → dowel axis.
        const quat = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          n,
        );
        return (
          <group key={d.id} position={d.position} quaternion={quat}>
            <mesh>
              <cylinderGeometry args={[d.diameter / 2, d.diameter / 2, d.length, 24]} />
              <meshBasicMaterial color="#f59e0b" transparent opacity={0.7} depthWrite={false} />
            </mesh>
            <Html distanceFactor={20} center>
              <button
                className="bg-amber-500 text-white text-[10px] leading-none w-3.5 h-3.5 rounded-full shadow flex items-center justify-center"
                onClick={(e) => { e.stopPropagation(); onDelete?.(d.id); }}
              >×</button>
            </Html>
          </group>
        );
      })}
    </>
  );
}
