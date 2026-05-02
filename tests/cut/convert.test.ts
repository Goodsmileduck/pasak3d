import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { initManifold } from "../../src/lib/cut/manifold";
import { meshToManifold, manifoldToMesh } from "../../src/lib/cut/convert";

describe("convert", () => {
  it("round-trips a cube through Manifold", async () => {
    const M = await initManifold();
    const geom = new THREE.BoxGeometry(10, 10, 10);
    const mesh = new THREE.Mesh(geom);
    const man = meshToManifold(M, mesh);
    expect(man.volume()).toBeCloseTo(1000, 1);
    const back = manifoldToMesh(man);
    const bbox = new THREE.Box3().setFromObject(back);
    expect(bbox.max.x - bbox.min.x).toBeCloseTo(10, 5);
    man.delete();
  });

  it("throws a clear error when the mesh can't be repaired", async () => {
    const M = await initManifold();
    // A single triangle is the canonical non-watertight mesh.
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3),
    );
    geom.setIndex(new THREE.BufferAttribute(new Uint32Array([0, 1, 2]), 1));
    const mesh = new THREE.Mesh(geom);
    expect(() => meshToManifold(M, mesh)).toThrow(/gaps or non-manifold/i);
  });
});
