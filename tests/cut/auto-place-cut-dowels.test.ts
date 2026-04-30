import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { autoPlaceCutDowels } from "../../src/lib/cut/auto-place-cut-dowels";

describe("autoPlaceCutDowels", () => {
  it("places dowels on the cut plane with axis = plane normal", () => {
    const geom = new THREE.BoxGeometry(20, 20, 20);
    const mesh = new THREE.Mesh(geom);
    const dowels = autoPlaceCutDowels(mesh, {
      normal: [1, 0, 0], constant: 0, axisSnap: "x",
    }, { count: 4, dowelDiameter: 5, length: 10, minSpacing: 2 });
    expect(dowels.length).toBe(4);
    for (const d of dowels) {
      expect(d.axis).toEqual([1, 0, 0]);
      expect(Math.abs(d.position[0])).toBeLessThan(0.01);
      expect(d.position[1]).toBeGreaterThan(-10);
      expect(d.position[1]).toBeLessThan(10);
      expect(d.position[2]).toBeGreaterThan(-10);
      expect(d.position[2]).toBeLessThan(10);
    }
  });
});
