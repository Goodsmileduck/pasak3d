import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { computeAutoOrientRotation, applyAutoOrient } from "../../src/lib/cut/auto-orient";

describe("auto-orient", () => {
  it("computeAutoOrientRotation returns a quaternion", () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(50, 10, 2));
    const rot = computeAutoOrientRotation(mesh);
    expect(rot).toBeInstanceOf(THREE.Quaternion);
  });

  it("applyAutoOrient places mesh on Z=0", () => {
    // L-bracket-ish shape: just test on a flat box. After auto-orient, the largest face should be on Z=0.
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(50, 50, 2));
    applyAutoOrient(mesh);
    const bbox = new THREE.Box3().setFromObject(mesh);
    expect(bbox.min.z).toBeCloseTo(0, 1);
  });

  it("leaves a cube near Z=0 (any face is the largest)", () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10));
    applyAutoOrient(mesh);
    const bbox = new THREE.Box3().setFromObject(mesh);
    expect(bbox.min.z).toBeCloseTo(0, 1);
    expect(bbox.max.z - bbox.min.z).toBeCloseTo(10, 1);
  });
});
