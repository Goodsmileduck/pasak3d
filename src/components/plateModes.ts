export type PlateMode = "grid" | "tiled" | "textured";

// Other modes ("tiled", "textured") are available but temporarily disabled
const PLATE_MODES: PlateMode[] = ["grid"];

/** Cycle plate mode — currently only "grid" is active */
export function nextPlateMode(current: PlateMode): PlateMode {
  const idx = PLATE_MODES.indexOf(current);
  return PLATE_MODES[(idx + 1) % PLATE_MODES.length];
}
