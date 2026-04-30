import { useRef, useEffect, useCallback, useImperativeHandle, forwardRef, Fragment, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

interface AxisCubeProps {
  controlsRef: React.RefObject<OrbitControls | null>;
  controls?: OrbitControls | null;
  isDark: boolean;
  onResetView?: () => void;
}

export type Face = "top" | "bottom" | "front" | "back" | "right" | "left";

export interface AxisCubeRef {
  snapToView: (face: Face) => void;
}

const FACE_LABELS: Record<Face, string> = {
  top: "Top",
  bottom: "Bot",
  front: "Front",
  back: "Back",
  right: "Right",
  left: "Left",
};

const SIZE = 60;
const HALF = SIZE / 2;

// CSS transforms to position each face of the cube.
// CSS cube axes after getCubeTransform: CSS_x = 3D_x, CSS_y = -3D_z, CSS_z = -3D_y
// So: +X=right, -X=left (CSS X), +Z=top → CSS -Y=up, -Y=forward → CSS -Z=front
//
// In Z-up CAD convention: front = -Y (toward default camera), right = +X
const FACE_TRANSFORMS: Record<Face, string> = {
  top:    `rotateX(90deg) translateZ(${HALF}px)`,    // +Z (top)
  bottom: `rotateX(-90deg) translateZ(${HALF}px)`,   // -Z (bottom)
  front:  `translateZ(${HALF}px)`,                   // -Y face (toward default camera)
  back:   `rotateY(180deg) translateZ(${HALF}px)`,   // +Y face
  right:  `rotateY(90deg) translateZ(${HALF}px)`,    // +X face
  left:   `rotateY(-90deg) translateZ(${HALF}px)`,   // -X face
};

// Unit direction offsets per face — scaled by camera distance at snap time (Z-up scene)
export const FACE_DIRECTIONS: Record<Face, THREE.Vector3> = {
  top:    new THREE.Vector3(0, 0, 1),   // +Z (up)
  bottom: new THREE.Vector3(0, 0, -1),  // -Z (down)
  right:  new THREE.Vector3(1, 0, 0),   // +X
  left:   new THREE.Vector3(-1, 0, 0),  // -X
  front:  new THREE.Vector3(0, -1, 0),  // -Y (toward default camera)
  back:   new THREE.Vector3(0, 1, 0),   // +Y
};

// Camera up vectors per face (Z-up scene)
export const FACE_UPS: Record<Face, THREE.Vector3> = {
  top:    new THREE.Vector3(0, 1, 0),   // +Y up on screen → +X right
  bottom: new THREE.Vector3(0, -1, 0),  // -Y up on screen → +X right
  front:  new THREE.Vector3(0, 0, 1),
  back:   new THREE.Vector3(0, 0, 1),
  right:  new THREE.Vector3(0, 0, 1),
  left:   new THREE.Vector3(0, 0, 1),
};

// --- Edge types and directions ---

export type EdgeId =
  | "front-right" | "front-left" | "front-top" | "front-bottom"
  | "back-right"  | "back-left"  | "back-top"  | "back-bottom"
  | "right-top"   | "right-bottom"| "left-top"  | "left-bottom";

function normalizedSum(...vecs: THREE.Vector3[]): THREE.Vector3 {
  const sum = new THREE.Vector3();
  for (const v of vecs) sum.add(v);
  return sum.normalize();
}

/**
 * Compute a camera up vector that is perpendicular to `direction` by
 * Gram-Schmidt orthogonalization of `refUp` against `direction`.
 * `refUp` is the desired visual "up" hint (e.g. Z-up or -Z for bottom views).
 */
function perpUp(direction: THREE.Vector3, refUp: THREE.Vector3): THREE.Vector3 {
  const d = direction.dot(refUp);
  return new THREE.Vector3().copy(refUp).addScaledVector(direction, -d).normalize();
}

export const EDGE_DIRECTIONS: Record<EdgeId, THREE.Vector3> = {
  "front-right":   normalizedSum(FACE_DIRECTIONS.front, FACE_DIRECTIONS.right),
  "front-left":    normalizedSum(FACE_DIRECTIONS.front, FACE_DIRECTIONS.left),
  "front-top":     normalizedSum(FACE_DIRECTIONS.front, FACE_DIRECTIONS.top),
  "front-bottom":  normalizedSum(FACE_DIRECTIONS.front, FACE_DIRECTIONS.bottom),
  "back-right":    normalizedSum(FACE_DIRECTIONS.back,  FACE_DIRECTIONS.right),
  "back-left":     normalizedSum(FACE_DIRECTIONS.back,  FACE_DIRECTIONS.left),
  "back-top":      normalizedSum(FACE_DIRECTIONS.back,  FACE_DIRECTIONS.top),
  "back-bottom":   normalizedSum(FACE_DIRECTIONS.back,  FACE_DIRECTIONS.bottom),
  "right-top":     normalizedSum(FACE_DIRECTIONS.right, FACE_DIRECTIONS.top),
  "right-bottom":  normalizedSum(FACE_DIRECTIONS.right, FACE_DIRECTIONS.bottom),
  "left-top":      normalizedSum(FACE_DIRECTIONS.left,  FACE_DIRECTIONS.top),
  "left-bottom":   normalizedSum(FACE_DIRECTIONS.left,  FACE_DIRECTIONS.bottom),
};

// Z-up reference for Gram-Schmidt orthogonalization
const _zUp = new THREE.Vector3(0, 0, 1);
const _zDown = new THREE.Vector3(0, 0, -1);

export const EDGE_UPS: Record<EdgeId, THREE.Vector3> = {
  // Horizontal edges (z=0 in direction) — Z-up is already perpendicular
  "front-right":   new THREE.Vector3(0, 0, 1),
  "front-left":    new THREE.Vector3(0, 0, 1),
  "back-right":    new THREE.Vector3(0, 0, 1),
  "back-left":     new THREE.Vector3(0, 0, 1),
  // Vertical edges — Gram-Schmidt to ensure perpendicularity
  "front-top":     perpUp(EDGE_DIRECTIONS["front-top"],    _zUp),
  "front-bottom":  perpUp(EDGE_DIRECTIONS["front-bottom"], _zUp),
  "back-top":      perpUp(EDGE_DIRECTIONS["back-top"],     _zUp),
  "back-bottom":   perpUp(EDGE_DIRECTIONS["back-bottom"],  _zUp),
  "right-top":     perpUp(EDGE_DIRECTIONS["right-top"],    _zUp),
  "right-bottom":  perpUp(EDGE_DIRECTIONS["right-bottom"], _zUp),
  "left-top":      perpUp(EDGE_DIRECTIONS["left-top"],     _zUp),
  "left-bottom":   perpUp(EDGE_DIRECTIONS["left-bottom"],  _zUp),
};

// --- Corner types and directions ---

export type CornerId =
  | "front-right-top"  | "front-left-top"  | "back-right-top"  | "back-left-top"
  | "front-right-bottom"| "front-left-bottom"| "back-right-bottom"| "back-left-bottom";

export const CORNER_DIRECTIONS: Record<CornerId, THREE.Vector3> = {
  "front-right-top":     normalizedSum(FACE_DIRECTIONS.front, FACE_DIRECTIONS.right, FACE_DIRECTIONS.top),
  "front-left-top":      normalizedSum(FACE_DIRECTIONS.front, FACE_DIRECTIONS.left,  FACE_DIRECTIONS.top),
  "back-right-top":      normalizedSum(FACE_DIRECTIONS.back,  FACE_DIRECTIONS.right, FACE_DIRECTIONS.top),
  "back-left-top":       normalizedSum(FACE_DIRECTIONS.back,  FACE_DIRECTIONS.left,  FACE_DIRECTIONS.top),
  "front-right-bottom":  normalizedSum(FACE_DIRECTIONS.front, FACE_DIRECTIONS.right, FACE_DIRECTIONS.bottom),
  "front-left-bottom":   normalizedSum(FACE_DIRECTIONS.front, FACE_DIRECTIONS.left,  FACE_DIRECTIONS.bottom),
  "back-right-bottom":   normalizedSum(FACE_DIRECTIONS.back,  FACE_DIRECTIONS.right, FACE_DIRECTIONS.bottom),
  "back-left-bottom":    normalizedSum(FACE_DIRECTIONS.back,  FACE_DIRECTIONS.left,  FACE_DIRECTIONS.bottom),
};

// Top corners use Z-up hint, bottom corners use -Z so the camera flips naturally
export const CORNER_UPS: Record<CornerId, THREE.Vector3> = {
  "front-right-top":     perpUp(CORNER_DIRECTIONS["front-right-top"],    _zUp),
  "front-left-top":      perpUp(CORNER_DIRECTIONS["front-left-top"],     _zUp),
  "back-right-top":      perpUp(CORNER_DIRECTIONS["back-right-top"],     _zUp),
  "back-left-top":       perpUp(CORNER_DIRECTIONS["back-left-top"],      _zUp),
  "front-right-bottom":  perpUp(CORNER_DIRECTIONS["front-right-bottom"], _zDown),
  "front-left-bottom":   perpUp(CORNER_DIRECTIONS["front-left-bottom"],  _zDown),
  "back-right-bottom":   perpUp(CORNER_DIRECTIONS["back-right-bottom"],  _zDown),
  "back-left-bottom":    perpUp(CORNER_DIRECTIONS["back-left-bottom"],   _zDown),
};
// For each face, map CSS-local positions to global EdgeId/CornerId.
// "top" = the edge at the top of the face as rendered in CSS 3D space.
//
// CSS face layout (after FACE_TRANSFORMS):
//   Front face: CSS top = toward +Z (scene top), CSS right = toward +X (scene right)
//   Back face:  CSS top = toward +Z, CSS right = toward -X (mirrored via rotateY(180))
//   Right face: CSS top = toward +Z, CSS right = toward +Y (scene back)
//   Left face:  CSS top = toward +Z, CSS right = toward -Y (scene front)
//   Top face:   CSS top = toward +Y (scene back), CSS right = toward +X (scene right)
//   Bottom face: CSS top = toward -Y (scene front), CSS right = toward +X (scene right)

type FaceEdgePosition = "top" | "right" | "bottom" | "left";
type FaceCornerPosition = "tl" | "tr" | "bl" | "br";

export const FACE_EDGE_MAP: Record<Face, Record<FaceEdgePosition, EdgeId>> = {
  front:  { top: "front-top",    right: "front-right",   bottom: "front-bottom",  left: "front-left" },
  back:   { top: "back-top",     right: "back-left",     bottom: "back-bottom",   left: "back-right" },
  right:  { top: "right-top",    right: "back-right",    bottom: "right-bottom",  left: "front-right" },
  left:   { top: "left-top",     right: "front-left",    bottom: "left-bottom",   left: "back-left" },
  top:    { top: "back-top",     right: "right-top",     bottom: "front-top",     left: "left-top" },
  bottom: { top: "front-bottom", right: "right-bottom",  bottom: "back-bottom",   left: "left-bottom" },
};

export const FACE_CORNER_MAP: Record<Face, Record<FaceCornerPosition, CornerId>> = {
  front:  { tl: "front-left-top",    tr: "front-right-top",    bl: "front-left-bottom",    br: "front-right-bottom" },
  back:   { tl: "back-right-top",    tr: "back-left-top",      bl: "back-right-bottom",    br: "back-left-bottom" },
  right:  { tl: "front-right-top",   tr: "back-right-top",     bl: "front-right-bottom",   br: "back-right-bottom" },
  left:   { tl: "back-left-top",     tr: "front-left-top",     bl: "back-left-bottom",     br: "front-left-bottom" },
  top:    { tl: "back-left-top",     tr: "back-right-top",     bl: "front-left-top",       br: "front-right-top" },
  bottom: { tl: "front-left-bottom", tr: "front-right-bottom", bl: "back-left-bottom",     br: "back-right-bottom" },
};

const BEVEL = 10; // px — bevel inset on each face
const P = (BEVEL / SIZE) * 100; // ~16.67%

// Clip-path polygons for each zone (in % coordinates, tiling without overlap)
const CLIP = {
  center:     `inset(${P}% ${P}% ${P}% ${P}%)`,
  edgeTop:    `polygon(${P}% 0%, ${100-P}% 0%, ${100-P}% ${P}%, ${P}% ${P}%)`,
  edgeRight:  `polygon(${100-P}% ${P}%, 100% ${P}%, 100% ${100-P}%, ${100-P}% ${100-P}%)`,
  edgeBottom: `polygon(${P}% ${100-P}%, ${100-P}% ${100-P}%, ${100-P}% 100%, ${P}% 100%)`,
  edgeLeft:   `polygon(0% ${P}%, ${P}% ${P}%, ${P}% ${100-P}%, 0% ${100-P}%)`,
  cornerTL:   `polygon(0% 0%, ${P}% 0%, ${P}% ${P}%, 0% ${P}%)`,
  cornerTR:   `polygon(${100-P}% 0%, 100% 0%, 100% ${P}%, ${100-P}% ${P}%)`,
  cornerBL:   `polygon(0% ${100-P}%, ${P}% ${100-P}%, ${P}% 100%, 0% 100%)`,
  cornerBR:   `polygon(${100-P}% ${100-P}%, 100% ${100-P}%, 100% 100%, ${100-P}% 100%)`,
} as const;

// Map edge position names to CLIP keys
const EDGE_CLIP: Record<string, keyof typeof CLIP> = {
  top: "edgeTop", right: "edgeRight", bottom: "edgeBottom", left: "edgeLeft",
};
const CORNER_CLIP: Record<string, keyof typeof CLIP> = {
  tl: "cornerTL", tr: "cornerTR", bl: "cornerBL", br: "cornerBR",
};
// Pre-allocated scratch objects — reused every frame to avoid GC pressure
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();

function getCubeTransform(camera: THREE.Camera): string {
  _q.copy(camera.quaternion).invert();
  _m.makeRotationFromQuaternion(_q);

  // Z-up scene → CSS: full transform is S_css * R * S^(-1) where
  //   S maps 3D→CSS cube coords:   CSS_x=3D_x, CSS_y=-3D_z, CSS_z=-3D_y
  //   S_css maps camera-local→CSS:  CSS_x=cam_x, CSS_y=-cam_y, CSS_z=cam_z
  //   det=+1 (proper rotation, no mirror)
  const e = _m.elements;
  // Col 0: (e[0], -e[1], e[2])   Col 1: (-e[8], e[9], -e[10])   Col 2: (-e[4], e[5], -e[6])
  return `matrix3d(${e[0]},${-e[1]},${e[2]},0,${-e[8]},${e[9]},${-e[10]},0,${-e[4]},${e[5]},${-e[6]},0,0,0,0,1)`;
}

const AXIS_THICKNESS = 2;

interface AxisDef {
  label: string;
  color: string;
  line: { width: number; height: number; transform: string };
  labelTransform: string;
}

// Axis lines in CSS cube space.
// CSS mapping: CSS_x = 3D_x, CSS_y = -3D_z, CSS_z = -3D_y
// Origin is at front-left-bottom corner of CSS cube.
const AXES: AxisDef[] = [
  {
    // X: runs along CSS X (3D X), on the bottom-front edge
    label: "X",
    color: "#ef4444",
    line: {
      width: SIZE,
      height: AXIS_THICKNESS,
      transform: `translate3d(0px, ${SIZE - AXIS_THICKNESS / 2}px, ${HALF}px)`,
    },
    labelTransform: `translate3d(${SIZE + 2}px, ${SIZE - 7}px, ${HALF}px)`,
  },
  {
    // Y: runs along CSS Z (3D Y), on the bottom-left edge going into depth
    label: "Y",
    color: "#22c55e",
    line: {
      width: AXIS_THICKNESS,
      height: SIZE,
      transform: `translate3d(${-AXIS_THICKNESS / 2}px, ${HALF}px, 0px) rotateX(90deg)`,
    },
    labelTransform: `translate3d(-7px, ${SIZE - 7}px, ${-(HALF + 4)}px)`,
  },
  {
    // Z: runs along CSS -Y (3D Z = up), on the left-front edge going up
    label: "Z",
    color: "#3b82f6",
    line: {
      width: AXIS_THICKNESS,
      height: SIZE,
      transform: `translate3d(${-AXIS_THICKNESS / 2}px, 0px, ${HALF}px)`,
    },
    labelTransform: `translate3d(-7px, -12px, ${HALF}px)`,
  },
];

// Keyboard mapping: digit keys 1-6 to cube faces (used by App and ShareView)
export const VIEW_SNAP_MAP: Record<string, Face> = {
  "1": "front", "2": "back", "3": "left", "4": "right", "5": "top", "6": "bottom",
};

export const AxisCube = forwardRef<AxisCubeRef, AxisCubeProps>(function AxisCube({ controlsRef, controls: controlsProp, isDark, onResetView }, ref) {
  const cubeRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number | null>(null);
  // Shared hover state: tracks the hovered EdgeId or CornerId so all zones
  // with the same ID highlight together across adjacent faces.
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);

  // Sync cube transform to camera via controls change event.
  // Re-attaches when controls instance changes (e.g. after projection toggle).
  useEffect(() => {
    const controls = controlsProp ?? controlsRef.current;
    const cube = cubeRef.current;
    if (!controls || !cube) return;

    const updateCube = () => {
      const camera = controls.object as THREE.Camera;
      cube.style.transform = getCubeTransform(camera);
    };

    updateCube();
    controls.addEventListener("change", updateCube);
    return () => {
      controls.removeEventListener("change", updateCube);
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, [controlsProp, controlsRef]);

  const snapToDirection = useCallback((direction: THREE.Vector3, up: THREE.Vector3) => {
    const controls = controlsRef.current;
    const camera = controls?.object;
    if (!camera || !controls) return;

    if (animRef.current !== null) cancelAnimationFrame(animRef.current);

    const duration = 300;
    const startPos = camera.position.clone();
    const startQuat = camera.quaternion.clone();
    const startUp = camera.up.clone();

    const dist = camera.position.distanceTo(controls.target);
    const endPos = controls.target.clone().addScaledVector(direction, dist);
    const endUp = up.clone();

    const tmpCam = camera.clone();
    tmpCam.position.copy(endPos);
    tmpCam.up.copy(endUp);
    tmpCam.lookAt(controls.target);
    const endQuat = tmpCam.quaternion.clone();

    controls.enabled = false;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const raw = Math.min(elapsed / duration, 1);
      const t = smoothstep(raw);

      camera.position.lerpVectors(startPos, endPos, t);
      camera.quaternion.slerpQuaternions(startQuat, endQuat, t);
      camera.up.lerpVectors(startUp, endUp, t);

      if (cubeRef.current) cubeRef.current.style.transform = getCubeTransform(camera as THREE.Camera);

      if (raw < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        camera.position.copy(endPos);
        // Always reset to Z-up so OrbitControls orbits turntable-style
        // around Z (like OrcaSlicer). controls.update() calls makeSafe()
        // which nudges the camera off-pole for top/bottom views, avoiding
        // gimbal lock while keeping the visual nearly identical.
        camera.up.set(0, 0, 1);
        controls.enabled = true;
        controls.update();
        animRef.current = null;
      }
    };

    animRef.current = requestAnimationFrame(tick);
  }, [controlsRef]);

  const snapToView = useCallback((face: Face) => {
    snapToDirection(FACE_DIRECTIONS[face], FACE_UPS[face]);
  }, [snapToDirection]);

  const flipView = useCallback(() => {
    const controls = controlsRef.current;
    const camera = controls?.object;
    if (!camera || !controls) return;

    const dir = camera.position.clone().sub(controls.target).normalize().negate();
    const up = camera.up.clone();
    snapToDirection(dir, up);
  }, [controlsRef, snapToDirection]);
  useImperativeHandle(ref, () => ({ snapToView }), [snapToView]);

  const faceBase = isDark
    ? "bg-neutral-700/80 hover:bg-blue-600/80 border border-neutral-500/50 text-neutral-200"
    : "bg-gray-300/80 hover:bg-blue-400/80 border border-gray-400/50 text-gray-700";

  // Returns Tailwind classes for edge/corner zones with shared hover highlight.
  // All class strings are written as full literals so Tailwind's JIT scanner keeps them.
  function getZoneClass(zoneId: string, kind: "edge" | "corner"): string {
    const isHovered = hoveredZone === zoneId;
    if (isHovered) return isDark ? "bg-blue-600/80" : "bg-blue-400/80";
    if (kind === "edge") {
      return isDark
        ? "bg-neutral-600/80 hover:bg-blue-600/80"
        : "bg-gray-200/80 hover:bg-blue-400/80";
    }
    return isDark
      ? "bg-neutral-600/70 hover:bg-blue-600/80"
      : "bg-gray-200/70 hover:bg-blue-400/80";
  }

  return (
    <div className="absolute bottom-4 left-4 select-none" style={{ width: 110 }}>
      {/* Home button — well above the cube so 3D corners can't overlap */}
      {onResetView && (
        <button
          onClick={onResetView}
          className={`w-6 h-6 flex items-center justify-center rounded mb-2
            ${isDark ? "bg-neutral-700/90 hover:bg-blue-600/80 text-neutral-300" : "bg-gray-300/90 hover:bg-blue-400/80 text-gray-600"}
            cursor-pointer`}
          title="Reset view (F)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12l9-9 9 9" />
            <path d="M9 21V12h6v9" />
          </svg>
        </button>
      )}

      {/* Cube + flip button wrapper */}
      <div className="relative" style={{ width: 110, height: 110 }}>
        {/* Flip button — bottom-right, z-index keeps it above the 3D cube */}
        <button
          onClick={flipView}
          className={`absolute w-6 h-6 flex items-center justify-center rounded
            ${isDark ? "bg-neutral-700/90 hover:bg-blue-600/80 text-neutral-300" : "bg-gray-300/90 hover:bg-blue-400/80 text-gray-600"}
            cursor-pointer`}
          style={{ bottom: 0, right: 0, zIndex: 10 }}
          title="Flip to opposite view"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 15l-6 6-6-6" />
            <path d="M6 9l6-6 6 6" />
          </svg>
        </button>
        {/* Orthographic-like container (large perspective = minimal distortion) */}
        <div style={{ perspective: 800, width: SIZE, height: SIZE, margin: "10px 20px" }}>
        {/* Rotating cube */}
        <div
          ref={cubeRef}
          style={{
            width: SIZE,
            height: SIZE,
            position: "relative",
            transformStyle: "preserve-3d",
          }}
        >
          {/* Cube faces */}
          {(Object.keys(FACE_LABELS) as Face[]).map((face) => (
            <div
              key={face}
              style={{
                position: "absolute",
                width: SIZE,
                height: SIZE,
                transform: FACE_TRANSFORMS[face],
                backfaceVisibility: "hidden",
              }}
            >
              {/* Face center */}
              <div
                onClick={() => snapToView(face)}
                style={{
                  position: "absolute", inset: 0, cursor: "pointer",
                  clipPath: CLIP.center,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, fontWeight: 600, letterSpacing: "0.03em",
                }}
                className={faceBase}
              >
                {FACE_LABELS[face]}
              </div>

              {/* Edges */}
              {(["top", "right", "bottom", "left"] as const).map((pos) => {
                const edgeId = FACE_EDGE_MAP[face][pos];
                return (
                  <div
                    key={`edge-${pos}`}
                    onClick={() => snapToDirection(EDGE_DIRECTIONS[edgeId], EDGE_UPS[edgeId])}
                    onMouseEnter={() => setHoveredZone(edgeId)}
                    onMouseLeave={() => setHoveredZone((prev) => prev === edgeId ? null : prev)}
                    style={{
                      position: "absolute", inset: 0, cursor: "pointer",
                      clipPath: CLIP[EDGE_CLIP[pos]],
                    }}
                    className={getZoneClass(edgeId, "edge")}
                  />
                );
              })}

              {/* Corners */}
              {(["tl", "tr", "bl", "br"] as const).map((pos) => {
                const cornerId = FACE_CORNER_MAP[face][pos];
                return (
                  <div
                    key={`corner-${pos}`}
                    onClick={() => snapToDirection(CORNER_DIRECTIONS[cornerId], CORNER_UPS[cornerId])}
                    onMouseEnter={() => setHoveredZone(cornerId)}
                    onMouseLeave={() => setHoveredZone((prev) => prev === cornerId ? null : prev)}
                    style={{
                      position: "absolute", inset: 0, cursor: "pointer",
                      clipPath: CLIP[CORNER_CLIP[pos]],
                    }}
                    className={getZoneClass(cornerId, "corner")}
                  />
                );
              })}
            </div>
          ))}

          {/* Axis lines along cube edges */}
          {AXES.map(({ label, color, line, labelTransform }) => (
            <Fragment key={label}>
              <div style={{
                position: "absolute",
                width: line.width,
                height: line.height,
                background: color,
                borderRadius: 1,
                transform: line.transform,
              }} />
              <div style={{
                position: "absolute",
                transform: labelTransform,
                fontSize: 10,
                fontWeight: 700,
                color,
              }}>{label}</div>
            </Fragment>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
});
