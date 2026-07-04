import { describe, it, expect, beforeAll } from "vitest";
import { initManifold } from "../../../src/lib/cut/manifold";
import { buildSeamLabel } from "../../../src/lib/cut/joints/labels";

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
});
