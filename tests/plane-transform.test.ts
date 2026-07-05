import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { planeTransform } from "../src/lib/plane-transform";
import type { CutPlaneSpec } from "../src/types";

const bboxAround = (cx: number, cy: number, cz: number, half: number) =>
  new THREE.Box3(
    new THREE.Vector3(cx - half, cy - half, cz - half),
    new THREE.Vector3(cx + half, cy + half, cz + half),
  );

describe("planeTransform", () => {
  it("places a Z-normal plane at its constant and sizes to 1.5× the max extent", () => {
    const plane: CutPlaneSpec = { normal: [0, 0, 1], constant: 5, axisSnap: "z" };
    const { position, quaternion, size } = planeTransform(plane, bboxAround(0, 0, 0, 5));
    expect(position.z).toBeCloseTo(5, 5);
    expect(position.x).toBeCloseTo(0, 5);
    expect(position.y).toBeCloseTo(0, 5);
    expect(size).toBeCloseTo(15, 5); // (10) * 1.5
    // +Z → +Z is identity
    expect(quaternion.x).toBeCloseTo(0, 5);
    expect(quaternion.y).toBeCloseTo(0, 5);
    expect(quaternion.z).toBeCloseTo(0, 5);
    expect(quaternion.w).toBeCloseTo(1, 5);
  });

  it("projects the bbox center onto an X-normal plane", () => {
    const plane: CutPlaneSpec = { normal: [1, 0, 0], constant: 0, axisSnap: "x" };
    const { position, quaternion } = planeTransform(plane, bboxAround(2, 0, 0, 3));
    expect(position.x).toBeCloseTo(0, 5); // center (2,0,0) projected onto x=0
    // +Z rotated to +X: applying the quaternion to (0,0,1) yields (±1,0,0)
    const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion);
    expect(Math.abs(dir.x)).toBeCloseTo(1, 5);
  });
});
