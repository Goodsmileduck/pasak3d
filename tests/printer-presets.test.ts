import { describe, it, expect } from "vitest";
import { PRINTER_PRESETS, fitsInPrinter, dimensionsFromBBox } from "../src/lib/printer-presets";
import * as THREE from "three";

describe("printer presets", () => {
  it("includes Bambu A1, X1, Prusa MK4, Ender 3", () => {
    const ids = PRINTER_PRESETS.map((p) => p.id);
    expect(ids).toContain("bambu-a1");
    expect(ids).toContain("bambu-x1");
    expect(ids).toContain("prusa-mk4");
    expect(ids).toContain("ender-3");
  });

  it("dimensionsFromBBox returns x/y/z size", () => {
    const bb = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(10, 20, 30));
    expect(dimensionsFromBBox(bb)).toEqual({ x: 10, y: 20, z: 30 });
  });

  it("fitsInPrinter respects rotation = false", () => {
    const p = { id: "x", name: "X", buildVolume: { x: 100, y: 100, z: 100 } };
    expect(fitsInPrinter({ x: 90, y: 90, z: 90 }, p)).toBe(true);
    expect(fitsInPrinter({ x: 110, y: 90, z: 90 }, p)).toBe(false);
  });
});
