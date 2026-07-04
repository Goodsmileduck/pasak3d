import { describe, it, expect, beforeAll } from "vitest";
import { initManifold } from "../../src/lib/cut/manifold";
import { generateTestFitPairs } from "../../src/lib/cut/test-fit";

let M: any;
beforeAll(async () => { M = await initManifold(); });

const base = { count: 1, step: 0.05, baseClearance: 0.1, cubeSize: 12, keyDepth: 5, keyWidth: 6, shape: "cylinder" as const };

describe("generateTestFitPairs", () => {
  it("emits one male+female coupon for count=1", () => {
    const pairs = generateTestFitPairs(M, base);
    expect(pairs.length).toBe(1);
    const p = pairs[0];
    expect(p.male.status()).toBe("NoError");
    expect(p.female.status()).toBe("NoError");
    // male block + protruding key => more than a bare block; female block - socket => less.
    const block = M.Manifold.cube([12, 12, 12], true);
    expect(p.male.volume()).toBeGreaterThan(block.volume());
    expect(p.female.volume()).toBeLessThan(block.volume());
    block.delete();
    p.male.delete(); p.female.delete();
  });

  it("names encode shape, clearance and A/B", () => {
    const p = generateTestFitPairs(M, base)[0];
    expect(p.maleName).toBe("testfit_cylinder_c0.10_A.stl");
    expect(p.femaleName).toBe("testfit_cylinder_c0.10_B.stl");
    p.male.delete(); p.female.delete();
  });
});
