import { Html } from "@react-three/drei";
import type { Dowel } from "../types";

type Props = {
  dowels: Dowel[];
  onDelete?: (id: string) => void;
};

export function DowelMarkers({ dowels, onDelete }: Props) {
  return (
    <>
      {dowels.map((d) => (
        <group key={d.id} position={d.position}>
          <mesh>
            <sphereGeometry args={[d.diameter / 2 + 0.5, 16, 16]} />
            <meshBasicMaterial color="#f59e0b" transparent opacity={0.6} />
          </mesh>
          <Html distanceFactor={150} center>
            <button
              className="bg-amber-500 text-white text-xs px-1 rounded shadow"
              onClick={() => onDelete?.(d.id)}
            >×</button>
          </Html>
        </group>
      ))}
    </>
  );
}
