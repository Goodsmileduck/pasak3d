import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { seamPlanes, segmentCuts } from "../../../src/lib/cut/segment/seam-planes";

/** Per-face labels from face-centroid Z against ascending thresholds (0,1,2,... by band). */
function labelByZ(geom: THREE.BufferGeometry, thresholds: number[]): Int32Array {
  const pos = geom.attributes.position as THREE.BufferAttribute;
  const idx = geom.index!;
  const faceCount = idx.count / 3;
  const labels = new Int32Array(faceCount);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let f = 0; f < faceCount; f++) {
    a.fromBufferAttribute(pos, idx.getX(f * 3));
    b.fromBufferAttribute(pos, idx.getX(f * 3 + 1));
    c.fromBufferAttribute(pos, idx.getX(f * 3 + 2));
    const cz = (a.z + b.z + c.z) / 3;
    let band = 0;
    for (const t of thresholds) if (cz > t) band++;
    labels[f] = band;
  }
  return labels;
}

describe("seamPlanes", () => {
  it("fits one horizontal plane to a box split at z=0", () => {
    const geom = new THREE.BoxGeometry(2, 2, 2, 1, 1, 2); // faces above/below z=0 on the walls
    const labels = labelByZ(geom, [0]);
    const planes = seamPlanes(geom, labels);
    expect(planes.length).toBe(1);
    expect(Math.abs(planes[0].normal[2])).toBeGreaterThan(0.99); // normal ≈ ±Z
    expect(Math.abs(planes[0].constant)).toBeLessThan(0.05);     // passes through z≈0
    expect(planes[0].axisSnap).toBe("free");
  });

  it("returns no planes for a single-region (uniform label) mesh", () => {
    const geom = new THREE.BoxGeometry(2, 2, 2, 1, 1, 2);
    const labels = new Int32Array((geom.index!.count / 3)).fill(0);
    expect(seamPlanes(geom, labels)).toEqual([]);
  });

  it("keeps two parallel seams distinct (no over-dedupe)", () => {
    const geom = new THREE.BoxGeometry(2, 2, 3, 1, 1, 3); // walls split at z=-0.5 and z=+0.5
    const labels = labelByZ(geom, [-0.5, 0.5]);
    const planes = seamPlanes(geom, labels);
    expect(planes.length).toBe(2);
    for (const p of planes) expect(Math.abs(p.normal[2])).toBeGreaterThan(0.99);
  });

  it("fits an oblique plane (validates free-orientation PCA, not just axis-aligned)", () => {
    const geom = new THREE.BoxGeometry(2, 2, 2, 1, 1, 2);
    const labels = labelByZ(geom, [0]);          // label BEFORE rotating
    const R = new THREE.Matrix4().makeRotationX(Math.PI / 6);
    geom.applyMatrix4(R);                          // seam ring z=0 → rotated plane
    const planes = seamPlanes(geom, labels);
    expect(planes.length).toBe(1);
    const expected = new THREE.Vector3(0, 0, 1).applyMatrix4(R).normalize(); // (0,-0.5,0.866)
    const n = new THREE.Vector3(...planes[0].normal);
    expect(Math.abs(n.dot(expected))).toBeGreaterThan(0.99); // aligned up to sign
  });
});

describe("segmentCuts", () => {
  it("composes SDF → regions → planes and returns a CutPlaneSpec[] without throwing", () => {
    const geom = new THREE.BoxGeometry(4, 4, 4);
    const planes = segmentCuts(geom, { maxParts: 8, detail: 0.45 });
    expect(Array.isArray(planes)).toBe(true);
    for (const p of planes) {
      expect(p.axisSnap).toBe("free");
      expect(p.normal).toHaveLength(3);
    }
  });
});
