import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { exportToSTL } from "../../src/lib/exporters/stl";

describe("exportToSTL", () => {
  it("produces a valid binary STL for a cube", () => {
    const geom = new THREE.BoxGeometry(10, 10, 10);
    const mesh = new THREE.Mesh(geom);
    const data = exportToSTL(mesh, "binary");
    expect(data.byteLength).toBeGreaterThan(0);
    // Binary STL header is 80 bytes + 4-byte tri count
    expect(data.byteLength).toBeGreaterThan(84);
  });
});
