import { Canvas } from "@react-three/fiber";
import { BuildPlate } from "./components/BuildPlate";
import { makeOrthoCamera } from "./lib/scene";

export default function App() {
  return (
    <div className="h-full w-full">
      <Canvas camera={makeOrthoCamera(300)}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[100, 100, 100]} />
        <BuildPlate mode="grid" isDark={false} model={null} />
      </Canvas>
    </div>
  );
}
