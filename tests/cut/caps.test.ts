import { it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import { initManifold } from "../../src/lib/cut/manifold";
import { planeCutMesh } from "../../src/lib/cut/plane-cut";

let M: any;
beforeAll(async () => { M = await initManifold(); });

it("both halves of a plane cut are valid closed manifolds", async () => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10));
  const { partA, partB } = await planeCutMesh(M, mesh, { normal: [1, 0, 0], constant: 0, axisSnap: "x" });
  for (const p of [partA.manifold, partB.manifold]) {
    expect(p.status()).toBe("NoError");
    expect(p.isEmpty()).toBe(false);
    expect(p.volume()).toBeGreaterThan(0);
  }
  partA.manifold.delete();
  partB.manifold.delete();
});
