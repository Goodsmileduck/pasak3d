import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { initManifold } from "../../src/lib/cut/manifold";
import { separateComponents } from "../../src/lib/cut/separate";

let M: any;
beforeAll(async () => { M = await initManifold(); });

function twoCubeMesh(): THREE.Mesh {
  const a = new THREE.BoxGeometry(4, 4, 4);
  const b = new THREE.BoxGeometry(4, 4, 4).translate(20, 0, 0);
  const merged = mergeGeometries([a, b]);
  return new THREE.Mesh(merged);
}

describe("separateComponents", () => {
  it("splits two disjoint bodies into two components", () => {
    const comps = separateComponents(M, twoCubeMesh());
    expect(comps.length).toBe(2);
    for (const c of comps) {
      expect(c.status()).toBe("NoError");
      expect(c.volume()).toBeCloseTo(64, 0);
      c.delete();
    }
  });

  it("returns a single component for a connected body", () => {
    const cube = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4));
    const comps = separateComponents(M, cube);
    expect(comps.length).toBe(1);
    comps.forEach((c) => c.delete());
  });
});
