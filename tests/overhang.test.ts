import { describe, it, expect } from "vitest";
import { overhangSeverity, severityColor } from "../src/lib/overhang";

describe("overhangSeverity (Z up)", () => {
  it("up-facing and side-facing are safe (0)", () => {
    expect(overhangSeverity([0, 0, 1], 45)).toBe(0);   // up
    expect(overhangSeverity([1, 0, 0], 45)).toBe(0);   // side (angleFromUp = 90 -> overhang 0)
  });
  it("fully down-facing is severe (1)", () => {
    expect(overhangSeverity([0, 0, -1], 45)).toBe(1);
  });
  it("ramps between the threshold and vertical-down", () => {
    // overhang = angleFromUp - 90; severity = overhang / (90 - threshold).
    // nz = cos(112.5deg) ~= -0.3827 -> angleFromUp 112.5 -> overhang 22.5 -> /45 = 0.5
    expect(overhangSeverity([0, 0, Math.cos((112.5 * Math.PI) / 180)], 45)).toBeCloseTo(0.5, 2);
  });
  it("normalizes the input normal", () => {
    expect(overhangSeverity([0, 0, -2], 45)).toBe(1);
  });
});

describe("severityColor", () => {
  it("green at 0, red at 1, amber-ish in the middle", () => {
    expect(severityColor(0)[1]).toBeGreaterThan(severityColor(0)[0]); // green: g > r
    expect(severityColor(1)[0]).toBeGreaterThan(severityColor(1)[1]); // red: r > g
    const mid = severityColor(0.5);
    expect(mid[0]).toBeGreaterThan(0.5); // amber has high red
  });
});
