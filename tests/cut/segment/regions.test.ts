// tests/cut/segment/regions.test.ts
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { segmentFaces } from "../../../src/lib/cut/segment/regions";

/**
 * A flat "barbell strip" of `cols-1` quads along X (each quad = 2 triangles), sharing welded edges.
 * `sdfPerQuad[q]` is the synthetic SDF applied to both triangles of quad q. Returns { geometry, sdf }.
 * Optional `crumb`: appends one tiny triangle on quad 0's left edge with its own sdf (its own band).
 */
function barbellStrip(sdfPerQuad: number[], crumb?: { sdf: number; width: number }) {
  const cols = sdfPerQuad.length + 1;
  const verts: number[] = [];
  const sdf: number[] = [];
  const tri = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => {
    verts.push(ax, ay, 0, bx, by, 0, cx, cy, 0);
  };
  for (let q = 0; q < sdfPerQuad.length; q++) {
    // quad q spans x=q..q+1, y=0..1; CCW from +Z ⇒ normal +Z
    tri(q, 0, q + 1, 0, q + 1, 1);
    tri(q, 0, q + 1, 1, q, 1);
    sdf.push(sdfPerQuad[q], sdfPerQuad[q]);
  }
  if (crumb) {
    // tiny triangle sharing quad-0's left edge (0,0)-(0,1), apex at x=-width
    tri(0, 0, 0, 1, -crumb.width, 0.5);
    sdf.push(crumb.sdf);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  return { geometry: geom, sdf: new Float32Array(sdf), cols };
}

/** Two triangles sharing edge (0,0,0)-(0,1,0); ridge at z=dir. dir=+1 convex fold, dir=-1 concave valley. */
function foldPair(dir: 1 | -1) {
  const R0 = [0, 0, dir], R1 = [0, 1, dir];
  const L0 = [-1, 0, 0], Rr0 = [1, 0, 0];
  const verts = [
    ...L0, ...R0, ...R1,      // left tri
    ...R1, ...R0, ...Rr0,     // right tri
  ];
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  return { geometry: geom, sdf: new Float32Array([1, 1]) }; // same band ⇒ only concavity can split
}

const distinct = (labels: Int32Array) => new Set(Array.from(labels)).size;

describe("segmentFaces", () => {
  it("splits a thin-middle barbell into 3 regions (two ends + bar), by SDF band", () => {
    const { geometry, sdf } = barbellStrip([1, 1, 0.1, 0.1, 1, 1]); // ends thick, middle thin
    const labels = segmentFaces(geometry, sdf, { maxParts: 64, detail: 0.45 });
    expect(distinct(labels)).toBe(3);
    // both triangles of quad 0 share a label; quad 0 (left end) differs from quad 2 (bar) and quad 5 (right end)
    expect(labels[0]).toBe(labels[1]);
    expect(labels[0]).not.toBe(labels[4]);  // quad 2 (bar) tri
    expect(labels[0]).not.toBe(labels[10]); // quad 5 (right end) tri
  });

  it("respects maxParts by merging down to the cap", () => {
    const { geometry, sdf } = barbellStrip([1, 1, 0.1, 0.1, 1, 1]);
    const labels = segmentFaces(geometry, sdf, { maxParts: 2, detail: 0.45 });
    expect(distinct(labels)).toBe(2);
  });

  it("merges a tiny sub-threshold crumb into its neighbor", () => {
    const { geometry, sdf } = barbellStrip([1, 1, 0.1, 0.1, 1, 1], { sdf: 0.5, width: 0.02 });
    const labels = segmentFaces(geometry, sdf, { maxParts: 64, detail: 0.45 });
    const crumbFace = labels.length - 1; // appended last
    expect(distinct(labels)).toBe(3);        // crumb absorbed ⇒ back to the 3 natural regions
    expect(labels[crumbFace]).toBe(labels[0]); // merged into quad-0's region
  });

  it("cuts a region at a strong concave crease, not at a convex fold", () => {
    expect(distinct(segmentFaces(foldPair(1).geometry, new Float32Array([1, 1]), { maxParts: 64, detail: 0.45 }))).toBe(1);
    expect(distinct(segmentFaces(foldPair(-1).geometry, new Float32Array([1, 1]), { maxParts: 64, detail: 0.45 }))).toBe(2);
  });
});
