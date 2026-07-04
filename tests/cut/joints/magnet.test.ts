import { describe, it, expect, beforeAll } from "vitest";
import { initManifold } from "../../../src/lib/cut/manifold";
import { applyJoints } from "../../../src/lib/cut/joints/apply";
import type { Joint } from "../../../src/types";

let M: any;
beforeAll(async () => { M = await initManifold(); });

it("magnet recess does not perforate a thick part", () => {
  // 40mm-wide separated halves; magnet depth 6 -> each half keeps a solid floor.
  const a = M.Manifold.cube([40, 40, 20], true).translate([0, 0, 10]);
  const b = M.Manifold.cube([40, 40, 20], true).translate([0, 0, -10]);
  const j: Joint = {
    id: "m", position: [0, 0, 0], axis: [0, 0, 1],
    diameter: 8, length: 6, source: "auto", shape: "cylinder", polarity: "magnet",
  };
  const r = applyJoints(M, a, b, [j], "sla");
  const full = 40 * 40 * 20;
  const removed = full - r.partA.volume();
  // removed ~= one blind cylinder (pi*4^2*6 per half ~= 300), NOT the old centered half-depth cut.
  expect(removed).toBeLessThan(400);
  expect(removed).toBeGreaterThan(250);
  r.partA.delete(); r.partB.delete();
});
