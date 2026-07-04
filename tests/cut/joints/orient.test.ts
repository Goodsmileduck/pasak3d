import { describe, it, expect } from "vitest";
import { rotationMat4FromTo } from "../../../src/lib/cut/joints/orient";

describe("rotationMat4FromTo", () => {
  it("returns identity (col-major) when from==to", () => {
    expect(rotationMat4FromTo([0, 0, 1], [0, 0, 1])).toEqual(
      [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    );
  });

  it("rotates +Z to +X (column-major: col0 becomes +Z image)", () => {
    const m = rotationMat4FromTo([0, 0, 1], [1, 0, 0]);
    // +Z maps to +X: applying rotation to (0,0,1) yields (1,0,0).
    // Column-major cols: [col0(0..3), col1, col2, col3]. z-axis image = col2 = m[8..10].
    expect(m[8]).toBeCloseTo(1, 5);
    expect(m[9]).toBeCloseTo(0, 5);
    expect(m[10]).toBeCloseTo(0, 5);
  });
});
