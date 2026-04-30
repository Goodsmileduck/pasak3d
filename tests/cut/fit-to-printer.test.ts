import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { suggestCuts } from "../../src/lib/cut/fit-to-printer";

describe("suggestCuts", () => {
  it("returns one cut for a part that's 1.5× build volume on its longest axis", () => {
    const bb = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(300, 100, 100));
    const printer = { id: "p", name: "P", buildVolume: { x: 200, y: 200, z: 200 } };
    const cuts = suggestCuts(bb, printer);
    expect(cuts.length).toBe(1);
    expect(cuts[0].axisSnap).toBe("x");
    expect(cuts[0].constant).toBeCloseTo(150, 1);
  });

  it("returns two cuts for a part 2.5× build volume", () => {
    const bb = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(500, 100, 100));
    const printer = { id: "p", name: "P", buildVolume: { x: 200, y: 200, z: 200 } };
    const cuts = suggestCuts(bb, printer);
    expect(cuts.length).toBe(2);
    expect(cuts[0].constant).toBeCloseTo(500 / 3, 1);
    expect(cuts[1].constant).toBeCloseTo((500 / 3) * 2, 1);
  });

  it("returns empty if part already fits", () => {
    const bb = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(100, 100, 100));
    const printer = { id: "p", name: "P", buildVolume: { x: 200, y: 200, z: 200 } };
    expect(suggestCuts(bb, printer)).toEqual([]);
  });

  it("picks the Z axis when it has the worst ratio", () => {
    const bb = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(100, 100, 600));
    const printer = { id: "p", name: "P", buildVolume: { x: 200, y: 200, z: 200 } };
    const cuts = suggestCuts(bb, printer);
    expect(cuts.length).toBe(2); // ceil(600/200) = 3 slabs → 2 cuts
    expect(cuts[0].axisSnap).toBe("z");
    expect(cuts[0].normal).toEqual([0, 0, 1]);
  });

  it("picks the Y axis when it has the worst ratio", () => {
    const bb = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(100, 700, 100));
    const printer = { id: "p", name: "P", buildVolume: { x: 200, y: 200, z: 200 } };
    const cuts = suggestCuts(bb, printer);
    expect(cuts[0].axisSnap).toBe("y");
    expect(cuts[0].normal).toEqual([0, 1, 0]);
  });

  it("respects bbox origin (cuts are placed in world coords, not local)", () => {
    const bb = new THREE.Box3(new THREE.Vector3(100, 0, 0), new THREE.Vector3(400, 100, 100));
    const printer = { id: "p", name: "P", buildVolume: { x: 200, y: 200, z: 200 } };
    const cuts = suggestCuts(bb, printer);
    expect(cuts.length).toBe(1); // ratio = 300/200 = 1.5 → ceil = 2 → 1 cut
    expect(cuts[0].constant).toBeCloseTo(250, 1); // midpoint of [100, 400]
  });

  it("part exactly equal to build volume needs no cuts", () => {
    const bb = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(200, 200, 200));
    const printer = { id: "p", name: "P", buildVolume: { x: 200, y: 200, z: 200 } };
    expect(suggestCuts(bb, printer)).toEqual([]);
  });

  it("each suggested cut produces a slab that fits the build volume", () => {
    const bb = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(800, 100, 100));
    const printer = { id: "p", name: "P", buildVolume: { x: 200, y: 200, z: 200 } };
    const cuts = suggestCuts(bb, printer);
    const slabs = cuts.length + 1;
    const slabSize = 800 / slabs;
    expect(slabSize).toBeLessThanOrEqual(200);
  });
});
