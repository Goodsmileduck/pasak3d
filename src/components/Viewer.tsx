import { useEffect, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls as DreiOrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { BuildPlate } from "./BuildPlate";
import { AxisCube } from "./AxisCube";
import { centerOnXY } from "../lib/scene";
import type { ModelData } from "../types";
import type { PlateMode } from "./plateModes";

// --- Props ---

interface ViewerProps {
  model: ModelData;
  isDark?: boolean;
  wireframe?: boolean;
  plateMode?: PlateMode;
  onControlsReady?: (controls: OrbitControls) => void;
}

// --- Inner scene: must be a child of <Canvas> ---

interface SceneContentsProps {
  model: ModelData;
  isDark: boolean;
  wireframe: boolean;
  plateMode: PlateMode;
  controlsRef: React.MutableRefObject<OrbitControls | null>;
  onControlsReady?: (controls: OrbitControls) => void;
}

function SceneContents({
  model,
  isDark,
  wireframe,
  plateMode,
  controlsRef,
  onControlsReady,
}: SceneContentsProps) {
  const { scene } = useThree();

  // Background color
  useEffect(() => {
    scene.background = new THREE.Color(isDark ? 0x1a1a1a : 0xf0f0f0);
  }, [isDark, scene]);

  // Center model and add to scene
  useEffect(() => {
    const group = model.group;

    centerOnXY(group);
    scene.add(group);

    // Frame camera after centering
    const controls = controlsRef.current;
    if (controls) {
      const box = new THREE.Box3().setFromObject(group);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const dist = maxDim * 2.0;

      controls.target.copy(center);
      controls.object.position.set(
        center.x + dist,
        center.y - dist,
        center.z + dist * 0.8,
      );
      controls.update();
    }

    return () => {
      scene.remove(group);
    };
  }, [model, scene, controlsRef]);

  // Wireframe toggle
  useEffect(() => {
    model.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mats = Array.isArray(child.material)
          ? child.material
          : [child.material];
        mats.forEach((m) => {
          if (m instanceof THREE.MeshStandardMaterial) m.wireframe = wireframe;
        });
      }
    });
  }, [model, wireframe]);

  return (
    <>
      {/* Lights */}
      <ambientLight intensity={0.3} />
      <hemisphereLight args={[0xffeeb1, 0x080820, 0.8]} />
      <directionalLight
        position={[10, -10, 15]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.1}
        shadow-camera-far={500}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
        shadow-bias={-0.0001}
        shadow-normalBias={0.02}
      />
      <directionalLight position={[-5, 5, -5]} intensity={0.3} color={0x8888ff} />

      {/* Build plate */}
      <BuildPlate mode={plateMode} isDark={isDark} model={model.group} />

      {/* OrbitControls */}
      <DreiOrbitControls
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ref={((controls: OrbitControls | null) => {
          if (controls) {
            controlsRef.current = controls;
            onControlsReady?.(controls);
          }
        }) as any}
        enableDamping
        dampingFactor={0.08}
        minDistance={0.01}
        maxDistance={50000}
        makeDefault
      />
    </>
  );
}

// --- Outer component ---

export function Viewer({
  model,
  isDark = false,
  wireframe = false,
  plateMode = "grid",
  onControlsReady,
}: ViewerProps) {
  const controlsRef = useRef<OrbitControls | null>(null);

  return (
    <div className="relative w-full h-full">
      <Canvas
        shadows
        camera={{
          position: [200, -200, 150],
          fov: 45,
          near: 0.01,
          far: 100000,
          up: [0, 0, 1],
        }}
        gl={{
          antialias: true,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        dpr={Math.min(window.devicePixelRatio, 2)}
        style={{ touchAction: "none" }}
        className="w-full h-full block"
      >
        <SceneContents
          model={model}
          isDark={isDark}
          wireframe={wireframe}
          plateMode={plateMode}
          controlsRef={controlsRef}
          onControlsReady={onControlsReady}
        />
      </Canvas>

      {/* AxisCube HTML overlay */}
      <AxisCube controlsRef={controlsRef} isDark={isDark} />
    </div>
  );
}
