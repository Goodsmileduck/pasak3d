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

  it("centers the bbox on the XY origin after orientation", () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(20, 30, 5));
    applyAutoOrient(mesh);
    const bbox = new THREE.Box3().setFromObject(mesh);
    expect((bbox.min.x + bbox.max.x) / 2).toBeCloseTo(0, 4);
    expect((bbox.min.y + bbox.max.y) / 2).toBeCloseTo(0, 4);
  });

  it("places largest face on Z=0 for a thin slab oriented arbitrarily", () => {
    // Thin slab originally facing +X — after auto-orient the largest face should face -Z.
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 40, 40));
    applyAutoOrient(mesh);
    const bbox = new THREE.Box3().setFromObject(mesh);
    const sizeZ = bbox.max.z - bbox.min.z;
    // The 2-unit dimension is now the height (smallest extent → vertical)
    expect(sizeZ).toBeCloseTo(2, 1);
    expect(bbox.min.z).toBeCloseTo(0, 1);
  });

  it("returns identity-equivalent quaternion when largest face already faces -Z", () => {
    // BoxGeometry(50, 50, 2) — top/bottom (+Z/-Z) faces are already the largest.
    // The bucket rounding prefers one of them; rotation should be small or no-op.
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(50, 50, 2));
    const rot = computeAutoOrientRotation(mesh);
    // Rotation magnitude: |sin(θ/2)|. Expect either ~0 (already down) or ~1 (180° flip).
    const halfAngle = Math.acos(Math.min(1, Math.abs(rot.w)));
    const fullAngle = halfAngle * 2;
    // Should be close to 0 or close to π
    const closeToZero = Math.abs(fullAngle) < 0.05;
    const closeToPi = Math.abs(fullAngle - Math.PI) < 0.05;
    expect(closeToZero || closeToPi).toBe(true);
  });

  it("does not throw on a mesh with degenerate triangles", () => {
    // Build a geometry with some zero-area triangles in the index buffer.
    const positions = new Float32Array([
      0, 0, 0,  10, 0, 0,  10, 10, 0,    // good tri
      5, 5, 0,  5, 5, 0,   5, 5, 0,      // degenerate (all same point)
      0, 0, 5,  10, 0, 5,  10, 10, 5,    // good tri
    ]);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mesh = new THREE.Mesh(geom);
    expect(() => computeAutoOrientRotation(mesh)).not.toThrow();
  });
});
