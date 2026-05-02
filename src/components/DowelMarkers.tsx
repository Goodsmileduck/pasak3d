import { useRef } from "react";
import { Html } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Dowel, CutPlaneSpec } from "../types";

type Props = {
  dowels: Dowel[];
  /** Cut plane the dowels live on — used to constrain drag motion. */
  plane?: CutPlaneSpec;
  /** Disable OrbitControls during drag so the camera doesn't also orbit. */
  controlsRef?: React.RefObject<OrbitControls | null>;
  onMove?: (id: string, point: [number, number, number]) => void;
  onDelete?: (id: string) => void;
};

/**
 * One amber translucent cylinder per dowel. Click + drag to move along the
 * cut plane; click the × button to remove. Manual-source dowels are purple.
 */
export function DowelMarkers({ dowels, plane, controlsRef, onMove, onDelete }: Props) {
  return (
    <>
      {dowels.map((d) => (
        <DraggableDowel
          key={d.id}
          dowel={d}
          plane={plane}
          controlsRef={controlsRef}
          onMove={onMove}
          onDelete={onDelete}
        />
      ))}
    </>
  );
}

type DragProps = {
  dowel: Dowel;
  plane?: CutPlaneSpec;
  controlsRef?: React.RefObject<OrbitControls | null>;
  onMove?: (id: string, point: [number, number, number]) => void;
  onDelete?: (id: string) => void;
};

function DraggableDowel({ dowel, plane, controlsRef, onMove, onDelete }: DragProps) {
  const { camera, gl, raycaster } = useThree();
  const dragging = useRef(false);

  // Cylinder oriented along the cut normal. (Cylinder is along Y natively → rotate Y → axis.)
  const n = new THREE.Vector3(...dowel.axis).normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);

  const projectPointer = (clientX: number, clientY: number): THREE.Vector3 | null => {
    if (!plane) return null;
    const rect = gl.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    // THREE.Plane convention: n · p + constant = 0 → constant = -cutConstant
    const planeNormal = new THREE.Vector3(...plane.normal).normalize();
    const dragPlane = new THREE.Plane(planeNormal, -plane.constant);
    const hit = new THREE.Vector3();
    return raycaster.ray.intersectPlane(dragPlane, hit) ? hit : null;
  };

  return (
    <group position={dowel.position} quaternion={quat}>
      <mesh
        onPointerDown={(e) => {
          e.stopPropagation();
          dragging.current = true;
          if (controlsRef?.current) controlsRef.current.enabled = false;

          // Window-level handlers — keep tracking even if cursor leaves cylinder.
          const onMoveWin = (ev: PointerEvent) => {
            if (!dragging.current) return;
            const p = projectPointer(ev.clientX, ev.clientY);
            if (p) onMove?.(dowel.id, [p.x, p.y, p.z]);
          };
          const onUpWin = () => {
            dragging.current = false;
            window.removeEventListener("pointermove", onMoveWin);
            window.removeEventListener("pointerup", onUpWin);
            // Re-enable orbit on the next tick so the same pointerup doesn't
            // also trigger an OrbitControls click.
            setTimeout(() => {
              if (controlsRef?.current) controlsRef.current.enabled = true;
            }, 0);
          };
          window.addEventListener("pointermove", onMoveWin);
          window.addEventListener("pointerup", onUpWin);
        }}
        onPointerOver={() => { gl.domElement.style.cursor = "grab"; }}
        onPointerOut={() => { gl.domElement.style.cursor = ""; }}
      >
        <cylinderGeometry args={[dowel.diameter / 2, dowel.diameter / 2, dowel.length, 24]} />
        <meshBasicMaterial
          color={dowel.source === "manual" ? "#a855f7" : "#f59e0b"}
          transparent
          opacity={0.7}
          depthWrite={false}
        />
      </mesh>
      <Html distanceFactor={20} center>
        <button
          className={`${dowel.source === "manual" ? "bg-purple-600" : "bg-amber-500"} text-white text-[10px] leading-none w-3.5 h-3.5 rounded-full shadow flex items-center justify-center`}
          onClick={(e) => { e.stopPropagation(); onDelete?.(dowel.id); }}
        >×</button>
      </Html>
    </group>
  );
}
