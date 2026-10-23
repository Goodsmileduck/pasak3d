import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { planeSeparatesMesh } from "../../src/lib/cut/plane-util";

describe("planeSeparatesMesh", () => {
  const box = () => new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10));

  it("true when the plane passes through the mesh", () => {
    expect(planeSeparatesMesh(box(), { normal: [0, 0, 1], constant: 0, axisSnap: "free" })).toBe(true);
  });

  it("false when the mesh is entirely on one side", () => {
    expect(planeSeparatesMesh(box(), { normal: [0, 0, 1], constant: 100, axisSnap: "free" })).toBe(false);
  });

  it("respects world transform (offset mesh)", () => {
    const m = box();
    m.position.set(0, 0, 100);
    m.updateMatrixWorld(true);
    expect(planeSeparatesMesh(m, { normal: [0, 0, 1], constant: 0, axisSnap: "free" })).toBe(false);
    expect(planeSeparatesMesh(m, { normal: [0, 0, 1], constant: 100, axisSnap: "free" })).toBe(true);
  });

  it("handles an oblique plane through the centre", () => {
    const s = 1 / Math.sqrt(3);
    expect(planeSeparatesMesh(box(), { normal: [s, s, s], constant: 0, axisSnap: "free" })).toBe(true);
  });
});
