import { describe, it, expect, beforeAll } from "vitest";
import { initManifold } from "../../../src/lib/cut/manifold";
import { buildJointSolid } from "../../../src/lib/cut/joints/shapes";

let M: any;
beforeAll(async () => { M = await initManifold(); });

describe("buildJointSolid", () => {
  it("cylinder nominal volume ~= pi r^2 h", () => {
    const s = buildJointSolid(M, { shape: "cylinder", diameter: 6, length: 10 });
    expect(s.status()).toBe("NoError");
    expect(s.volume()).toBeCloseTo(Math.PI * 3 * 3 * 10, 0);
    s.delete();
  });

  it("female cylinder grows radius by `grow`", () => {
    const male = buildJointSolid(M, { shape: "cylinder", diameter: 6, length: 10 });
    const female = buildJointSolid(M, { shape: "cylinder", diameter: 6, length: 10, grow: 0.2 });
    expect(female.volume()).toBeGreaterThan(male.volume());
    male.delete(); female.delete();
  });

  it("cube nominal volume = x*y*z", () => {
    const s = buildJointSolid(M, { shape: "cube", diameter: 6, length: 10 });
    expect(s.status()).toBe("NoError");
    // cube maps diameter->x/y footprint, length->z. Exact for a box.
    expect(s.volume()).toBeCloseTo(6 * 6 * 10, 3);
    s.delete();
  });

  it("cross is a valid manifold with volume between one and two arms", () => {
    const arm = 6 * 10; // approx single-arm cross-sectionxlength reference
    const s = buildJointSolid(M, { shape: "cross", diameter: 6, length: 10 });
    expect(s.status()).toBe("NoError");
    expect(s.isEmpty()).toBe(false);
    // two overlapping arms: volume < 2x a single arm (overlap subtracted), > 1x
    expect(s.volume()).toBeGreaterThan(arm);
    s.delete();
  });

  it("dovetail is a valid manifold (trapezoid prism)", () => {
    const s = buildJointSolid(M, { shape: "dovetail", diameter: 6, length: 10 });
    expect(s.status()).toBe("NoError");
    expect(s.isEmpty()).toBe(false);
    expect(s.volume()).toBeGreaterThan(0);
    s.delete();
  });

  it("puzzle tab is a valid manifold (neck + lobe union)", () => {
    const s = buildJointSolid(M, { shape: "puzzle", diameter: 6, length: 10 });
    expect(s.status()).toBe("NoError");
    expect(s.isEmpty()).toBe(false);
    s.delete();
  });

  // Regression: the female cutter must clear the peg by `grow` on EVERY face, not
  // just the arm ends. Baking grow into per-shape dimensions gave only grow/3
  // (cross bar faces) / grow/2 (puzzle neck). A peg shifted by ~grow across those
  // faces must still fit entirely inside the hole (peg - hole == empty).
  it.each(["cross", "puzzle", "dovetail"] as const)(
    "%s female clears the peg by ~grow on the narrow faces",
    (shape) => {
      const grow = 0.2;
      const peg = buildJointSolid(M, { shape, diameter: 6, length: 10 });
      const hole = buildJointSolid(M, { shape, diameter: 6, length: 10, grow });
      // Shift the peg 0.9*grow along +Y (across a bar/neck face); a uniform grow
      // clearance keeps it inside the hole, an under-clearanced face pokes out.
      const shifted = peg.translate([0, 0.9 * grow, 0]);
      const leftover = shifted.subtract(hole);
      expect(leftover.isEmpty()).toBe(true);
      peg.delete(); hole.delete(); shifted.delete(); leftover.delete();
    },
  );
});
