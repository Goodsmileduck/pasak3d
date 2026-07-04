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
});
