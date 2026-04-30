import { describe, it, expect } from "vitest";
import { autoPlaceDowels } from "../../src/lib/cut/dowel-place";

describe("autoPlaceDowels", () => {
  const square: Array<[number, number]> = [
    [-5, -5], [5, -5], [5, 5], [-5, 5], [-5, -5],
  ];

  it("places requested count when polygon is large enough", () => {
    const dowels = autoPlaceDowels([square], { count: 4, dowelDiameter: 5, minSpacing: 2 });
    expect(dowels.length).toBe(4);
    for (const d of dowels) {
      expect(d[0]).toBeGreaterThan(-5);
      expect(d[0]).toBeLessThan(5);
      expect(d[1]).toBeGreaterThan(-5);
      expect(d[1]).toBeLessThan(5);
    }
  });

  it("respects min spacing between dowels", () => {
    const dowels = autoPlaceDowels([square], { count: 8, dowelDiameter: 4, minSpacing: 1 });
    for (let i = 0; i < dowels.length; i++) {
      for (let j = i + 1; j < dowels.length; j++) {
        const dx = dowels[i][0] - dowels[j][0];
        const dy = dowels[i][1] - dowels[j][1];
        const dist = Math.sqrt(dx * dx + dy * dy);
        expect(dist).toBeGreaterThanOrEqual(4 + 1 - 0.01);
      }
    }
  });

  it("places fewer than requested when polygon is too small", () => {
    const tiny: Array<[number, number]> = [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]];
    const dowels = autoPlaceDowels([tiny], { count: 10, dowelDiameter: 5, minSpacing: 1 });
    expect(dowels.length).toBeLessThan(10);
  });
});
