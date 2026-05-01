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

  it("respects mesh.matrixWorld — a translated mesh tested against a world-space plane", () => {
    // Regression: previous version read geometry positions raw (mesh-local),
    // ignoring parent transforms. For a model loaded via centerOnXY, the parent
    // group has a non-identity translation, so cuts at world X=0 used to produce
    // zero polygons (because raw vertex coords never reached 0).
    const geom = new THREE.BoxGeometry(10, 10, 10);
    geom.translate(128, 128, 0); // simulate raw 3MF coords
    const mesh = new THREE.Mesh(geom);
    const group = new THREE.Group();
    group.add(mesh);
    group.position.set(-128, -128, 0); // simulate centerOnXY translation
    group.updateMatrixWorld(true);

    // World-space plane at X=0 should cut through the now-centered cube
    const plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
    const polys = extractCutPolygon(mesh, plane);
    expect(polys.length).toBeGreaterThan(0);
  });
});
