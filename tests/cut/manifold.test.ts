import { describe, it, expect } from "vitest";
import { initManifold } from "../../src/lib/cut/manifold";

describe("initManifold", () => {
  it("returns a working Manifold module", async () => {
    const M = await initManifold();
    expect(M).toBeDefined();
    expect(typeof M.Manifold).toBe("function");
    const cube = M.Manifold.cube([10, 10, 10], true);
    expect(cube.numVert()).toBeGreaterThan(0);
    cube.delete();
  });
});
