import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { initManifold } from "../../src/lib/cut/manifold";
import { planeCutMesh } from "../../src/lib/cut/plane-cut";

describe("planeCutMesh", () => {
  it("cuts a 10mm cube in half along X", async () => {
    const M = await initManifold();
    const geom = new THREE.BoxGeometry(10, 10, 10);
    const mesh = new THREE.Mesh(geom);
    const result = await planeCutMesh(M, mesh, {
      normal: [1, 0, 0],
      constant: 0,
      axisSnap: "x",
    });
    expect(result.partA.volume).toBeCloseTo(500, 0);
    expect(result.partB.volume).toBeCloseTo(500, 0);
    result.partA.manifold.delete();
    result.partB.manifold.delete();
  });

  it("returns nearly the whole part on one side when plane is at edge", async () => {
    const M = await initManifold();
    const geom = new THREE.BoxGeometry(10, 10, 10);
    const mesh = new THREE.Mesh(geom);
    const result = await planeCutMesh(M, mesh, {
      normal: [1, 0, 0],
      constant: 4.99,
      axisSnap: "x",
    });
    expect(result.partA.volume).toBeGreaterThan(990);
    expect(result.partB.volume).toBeLessThan(10);
    result.partA.manifold.delete();
    result.partB.manifold.delete();
  });

  it("throws when plane misses the mesh entirely", async () => {
    const M = await initManifold();
    const geom = new THREE.BoxGeometry(10, 10, 10);
    const mesh = new THREE.Mesh(geom);
    await expect(
      planeCutMesh(M, mesh, { normal: [1, 0, 0], constant: 100, axisSnap: "x" }),
    ).rejects.toThrow(/does not intersect/i);
  });
});
