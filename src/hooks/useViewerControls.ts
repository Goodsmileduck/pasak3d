import { useRef, useCallback, useState } from "react";
import type { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { AxisCubeRef } from "../components/AxisCube";
import { nextPlateMode, type PlateMode } from "../components/plateModes";

export function useViewerControls() {
  const axisControlsRef = useRef<OrbitControls | null>(null);
  const [axisControls, setAxisControls] = useState<OrbitControls | null>(null);
  const axisCubeRef = useRef<AxisCubeRef>(null);

  const [wireframe, setWireframe] = useState(false);
  const [plateMode, setPlateMode] = useState<PlateMode>("grid");

  const handleControlsReady = useCallback((controls: OrbitControls) => {
    axisControlsRef.current = controls;
    setAxisControls(controls);
  }, []);

  const handleCyclePlate = useCallback(() => {
    setPlateMode(nextPlateMode);
  }, []);

  const handleToggleWireframe = useCallback(() => {
    setWireframe((prev) => !prev);
  }, []);

  return {
    axisControlsRef,
    axisControls,
    axisCubeRef,
    wireframe,
    setWireframe,
    plateMode,
    handleControlsReady,
    handleCyclePlate,
    handleToggleWireframe,
  };
}
