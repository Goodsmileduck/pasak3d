import { describe, it, expect, beforeAll } from "vitest";
import { initManifold } from "../../../src/lib/cut/manifold";
import { applyJoints } from "../../../src/lib/cut/joints/apply";
import type { Joint } from "../../../src/types";

let M: any;
beforeAll(async () => { M = await initManifold(); });

function box(size: number) { return M.Manifold.cube([size, size, size], true); }

describe("applyJoints", () => {
  const joint: Joint = {
    id: "j", position: [0, 0, 0], axis: [0, 0, 1],
    diameter: 4, length: 20, source: "auto", shape: "cylinder", polarity: "separate-peg",
  };

  it("subtracts a hole from both halves and emits one peg", () => {
    const a = box(30), b = box(30);
    const r = applyJoints(M, a, b, [joint], "pla-tight");
    expect(r.partA.volume()).toBeLessThan(30 * 30 * 30);
    expect(r.partB.volume()).toBeLessThan(30 * 30 * 30);
    expect(r.jointPieces.length).toBe(1);
    r.partA.delete(); r.partB.delete(); r.jointPieces.forEach((p: any) => p.delete());
  });

  it("magnet polarity emits no peg", () => {
    const a = box(30), b = box(30);
    const r = applyJoints(M, a, b, [{ ...joint, polarity: "magnet" }], "pla-tight");
    expect(r.jointPieces.length).toBe(0);
    r.partA.delete(); r.partB.delete();
  });
});
