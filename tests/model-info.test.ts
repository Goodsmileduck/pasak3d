import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { computeModelInfo } from "../src/lib/model-info";

describe("computeModelInfo", () => {
  it("computes bbox, dimensions, and tri count for a cube", () => {
    const geom = new THREE.BoxGeometry(10, 20, 30);
    const mesh = new THREE.Mesh(geom);
    const group = new THREE.Group();
    group.add(mesh);
    const info = computeModelInfo(group, "cube.stl", 1234);
    expect(info.format).toBe("stl");
    expect(info.fileSize).toBe(1234);
    expect(info.dimensions.x).toBeCloseTo(10, 3);
    expect(info.dimensions.y).toBeCloseTo(20, 3);
    expect(info.dimensions.z).toBeCloseTo(30, 3);
    expect(info.triCount).toBe(12); // a box is 12 triangles
  });
});
