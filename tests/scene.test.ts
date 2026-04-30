import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { centerOnXY, computeBBoxDiagonal, makeOrthoCamera } from "../src/lib/scene";

describe("scene utilities", () => {
  it("centerOnXY centers group on XY and places at Z=0", () => {
    const geom = new THREE.BoxGeometry(2, 4, 6);
    const mesh = new THREE.Mesh(geom);
    mesh.position.set(10, 20, 30);
    const group = new THREE.Group();
    group.add(mesh);
    centerOnXY(group);
    const bbox = new THREE.Box3().setFromObject(group);
    expect(bbox.min.z).toBeCloseTo(0, 5);
    expect((bbox.min.x + bbox.max.x) / 2).toBeCloseTo(0, 5);
    expect((bbox.min.y + bbox.max.y) / 2).toBeCloseTo(0, 5);
  });

  it("computeBBoxDiagonal returns Euclidean distance of bbox extent", () => {
    const bbox = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(3, 4, 0));
    expect(computeBBoxDiagonal(bbox)).toBeCloseTo(5, 5);
  });

  it("makeOrthoCamera returns Z-up ortho camera", () => {
    const cam = makeOrthoCamera(100);
    expect(cam.up.toArray()).toEqual([0, 0, 1]);
    expect(cam.isOrthographicCamera).toBe(true);
  });
});
