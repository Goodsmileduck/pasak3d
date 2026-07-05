const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Overhang severity (0 safe ... 1 severe) of a face with unit-ish `normal`, Z up. */
export function overhangSeverity(normal: [number, number, number], thresholdDeg: number): number {
  const [x, y, z] = normal;
  const len = Math.max(Math.hypot(x, y, z), 1);
  const nz = z / len;
  const angleFromUp = (Math.acos(clamp(nz, -1, 1)) * 180) / Math.PI;
  const overhang = angleFromUp - 90; // >0 => down-facing
  if (overhang <= 0) return 0;
  return clamp(overhang / Math.max(90 - thresholdDeg, 1), 0, 1);
}

// Ramp stops - MUST match the GLSL ramp in heatmap-material.ts.
const SAFE: [number, number, number] = [0.20, 0.72, 0.36]; // green
const MID: [number, number, number] = [0.96, 0.62, 0.10];  // amber
const HOT: [number, number, number] = [0.90, 0.15, 0.15];  // red
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] =>
  [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** Green->amber->red ramp for severity 0..1. */
export function severityColor(t: number): [number, number, number] {
  const c = clamp(t, 0, 1);
  return c < 0.5 ? mix(SAFE, MID, c * 2) : mix(MID, HOT, (c - 0.5) * 2);
}
