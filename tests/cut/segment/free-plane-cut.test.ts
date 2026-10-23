import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import { initManifold } from "../../../src/lib/cut/manifold";
import { planeCutMesh } from "../../../src/lib/cut/plane-cut";

let M: any;

beforeAll(async () => {
  M = await initManifold();
});

describe("free-plane cuts", () => {
  it("cuts a box into two non-empty parts with an oblique free plane", async () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10));
    const invSqrt3 = 1 / Math.sqrt(3);
    const result = await planeCutMesh(M, mesh, {
      normal: [invSqrt3, invSqrt3, invSqrt3],
      constant: 0,
      axisSnap: "free",
    });

    try {
      expect(result.partA.manifold.isEmpty()).toBe(false);
      expect(result.partB.manifold.isEmpty()).toBe(false);
      expect(result.partA.volume).toBeGreaterThan(0);
      expect(result.partB.volume).toBeGreaterThan(0);
    } finally {
      result.partA.manifold.delete();
      result.partB.manifold.delete();
    }
  });
});
