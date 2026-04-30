import { useEffect, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls as DreiOrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { BuildPlate } from "./BuildPlate";
import { AxisCube } from "./AxisCube";
import { CutPlane } from "./CutPlane";
import { DowelMarkers } from "./DowelMarkers";
import { centerOnXY } from "../lib/scene";
import type { CutPlaneSpec, Dowel } from "../types";
import type { PlateMode } from "./plateModes";

// --- Props ---

interface CutPartEntry {
  id: string;
  group: THREE.Group;
  visible: boolean;
  isDowel: boolean;
}

interface ViewerProps {
  /** M1 mode: single model group. Used when cutParts is absent/empty. */
  rootGroup?: THREE.Group | null;
  /** M2 mode: cut parts to render instead of rootGroup */
  cutParts?: CutPartEntry[];
  /** M2 mode: cut plane preview */
  cutPreview?: { plane: CutPlaneSpec; bbox: THREE.Box3 } | null;
  /** M2 mode: dowel markers */
  dowels?: Dowel[];
  isDark?: boolean;
  wireframe?: boolean;
  plateMode?: PlateMode;
  onControlsReady?: (controls: OrbitControls) => void;
}

// --- Inner scene: must be a child of <Canvas> ---

interface SceneContentsProps {
  rootGroup: THREE.Group | null;
  cutParts?: CutPartEntry[];
  cutPreview?: { plane: CutPlaneSpec; bbox: THREE.Box3 } | null;
  dowels?: Dowel[];
  isDark: boolean;
  wireframe: boolean;
  plateMode: PlateMode;
  controlsRef: React.MutableRefObject<OrbitControls | null>;
  onControlsReady?: (controls: OrbitControls) => void;
}

function SceneContents({
  rootGroup,
  cutParts,
  cutPreview,
  dowels,
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

  // Determine which groups to render in scene
  const hasCutParts = cutParts && cutParts.length > 0;

  // Single-model mode: add rootGroup to scene
  useEffect(() => {
    if (hasCutParts || !rootGroup) return;

    centerOnXY(rootGroup);
    scene.add(rootGroup);

    // Frame camera after centering
    const controls = controlsRef.current;
    if (controls) {
      const box = new THREE.Box3().setFromObject(rootGroup);
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
      scene.remove(rootGroup);
    };
  }, [rootGroup, hasCutParts, scene, controlsRef]);

  // Cut-parts mode: add visible groups to scene
  useEffect(() => {
    if (!hasCutParts || !cutParts) return;

    const added: THREE.Group[] = [];
    for (const part of cutParts) {
      if (part.visible) {
        scene.add(part.group);
        added.push(part.group);
      }
    }

    // Frame camera to encompass all visible parts
    const controls = controlsRef.current;
    if (controls && added.length > 0) {
      const box = new THREE.Box3();
      for (const g of added) box.expandByObject(g);
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
      for (const g of added) scene.remove(g);
    };
  }, [cutParts, hasCutParts, scene, controlsRef]);

  // Wireframe toggle (applies to rootGroup in M1 mode)
  useEffect(() => {
    if (!rootGroup) return;
    rootGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mats = Array.isArray(child.material)
          ? child.material
          : [child.material];
        mats.forEach((m) => {
          if (m instanceof THREE.MeshStandardMaterial) m.wireframe = wireframe;
        });
      }
    });
  }, [rootGroup, wireframe]);

  // The model prop for BuildPlate — prefer rootGroup in M1, first visible cut group in M2
  const buildPlateModel = hasCutParts && cutParts
    ? (cutParts.find((p) => p.visible)?.group ?? null)
    : rootGroup;

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
      <BuildPlate mode={plateMode} isDark={isDark} model={buildPlateModel} />

      {/* Cut plane preview */}
      {cutPreview && (
        <CutPlane plane={cutPreview.plane} bbox={cutPreview.bbox} />
      )}

      {/* Dowel markers */}
      {dowels && dowels.length > 0 && (
        <DowelMarkers dowels={dowels} />
      )}

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
  rootGroup = null,
  cutParts,
  cutPreview,
  dowels,
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
          rootGroup={rootGroup}
          cutParts={cutParts}
          cutPreview={cutPreview}
          dowels={dowels}
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
