import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { computeSDF } from "../../../src/lib/cut/segment/sdf";

describe("computeSDF", () => {
  it("measures local thickness: a thin slab's broad faces read ~the thin dimension", () => {
    // 10 x 10 x 2 box: top/bottom faces (thin Z axis) ⇒ SDF ≈ 2; side faces ⇒ ≈ 10.
    const geom = new THREE.BoxGeometry(10, 10, 2);
    const sdf = computeSDF(geom, { rayCount: 24 });
    const min = Math.min(...sdf);
    const max = Math.max(...sdf);
    expect(min).toBeGreaterThan(1.5);
    expect(min).toBeLessThan(4);   // thin dimension ≈ 2
    expect(max).toBeGreaterThan(7); // through-faces ≈ 10
  });

  it("returns one value per triangle", () => {
    const geom = new THREE.BoxGeometry(1, 1, 1);
    const triCount = (geom.index ? geom.index.count : geom.attributes.position.count) / 3;
    expect(computeSDF(geom, { rayCount: 8 }).length).toBe(triCount);
  });
});
