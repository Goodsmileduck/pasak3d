import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { extractCutPolygon } from "../../src/lib/cut/cut-polygon";

describe("extractCutPolygon", () => {
  it("returns the cross-section polygon of a cube cut at x=0", () => {
    const geom = new THREE.BoxGeometry(10, 10, 10);
    const mesh = new THREE.Mesh(geom);
    const plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
    const polys = extractCutPolygon(mesh, plane);
    expect(polys.length).toBeGreaterThan(0);
    const totalVerts = polys.reduce((s, p) => s + p.length, 0);
    expect(totalVerts).toBeGreaterThanOrEqual(4);
  });

  it("returns empty when plane misses mesh", () => {
    const geom = new THREE.BoxGeometry(10, 10, 10);
    const mesh = new THREE.Mesh(geom);
    const plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), -100);
    expect(extractCutPolygon(mesh, plane)).toEqual([]);
  });
});
