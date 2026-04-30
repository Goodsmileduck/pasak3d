import { Canvas } from "@react-three/fiber";
import { useRef } from "react";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { BuildPlate } from "./components/BuildPlate";
import { AxisCube } from "./components/AxisCube";
import { makeOrthoCamera } from "./lib/scene";

export default function App() {
  const controlsRef = useRef<OrbitControls | null>(null);
  return (
    <div className="h-full w-full relative">
      <Canvas camera={makeOrthoCamera(300)}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[100, 100, 100]} />
        <BuildPlate mode="grid" isDark={false} model={null} />
      </Canvas>
      <div className="absolute top-4 right-4">
        <AxisCube controlsRef={controlsRef} isDark={false} />
      </div>
    </div>
  );
}
