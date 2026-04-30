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
});
