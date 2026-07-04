import { describe, it, expect, beforeAll } from "vitest";
import { initManifold } from "../../../src/lib/cut/manifold";
import { buildSeamLabel, applySeamLabel } from "../../../src/lib/cut/joints/labels";

let M: any;
beforeAll(async () => { M = await initManifold(); });

describe("buildSeamLabel", () => {
  it("builds a valid solid for an alphanumeric id", () => {
    const s = buildSeamLabel(M, "A", { size: 6, depth: 1 });
    expect(s.status()).toBe("NoError");
    expect(s.isEmpty()).toBe(false);
    expect(s.volume()).toBeGreaterThan(0);
    s.delete();
  });

  it("multi-char labels have more volume than a single char", () => {
    const a = buildSeamLabel(M, "A", { size: 6, depth: 1 });
    const ab = buildSeamLabel(M, "AB", { size: 6, depth: 1 });
    expect(ab.volume()).toBeGreaterThan(a.volume());
    a.delete(); ab.delete();
  });

  it("emboss adds volume, deboss removes volume on the top face", () => {
    const mk = () => M.Manifold.cube([30, 30, 30], true);
    const top: [number, number, number] = [0, 0, 15];
    const up: [number, number, number] = [0, 0, 1];
    const base = mk().volume();

    const cube1 = mk();
    const embossed = applySeamLabel(M, cube1, "A", { mode: "emboss", size: 8, depth: 1 }, top, up);
    expect(embossed.volume()).toBeGreaterThan(base);
    cube1.delete(); embossed.delete();

    const cube2 = mk();
    const debossed = applySeamLabel(M, cube2, "A", { mode: "deboss", size: 8, depth: 1 }, top, up);
    expect(debossed.volume()).toBeLessThan(base);
    cube2.delete(); debossed.delete();
  });
});
