import { describe, it, expect, beforeAll } from "vitest";
import { initManifold } from "../../../src/lib/cut/manifold";
import { applyConnectors } from "../../../src/lib/cut/connectors/apply";
import { applyJoints } from "../../../src/lib/cut/joints/apply";
import type { Joint } from "../../../src/types";

let M: any;

beforeAll(async () => {
  M = await initManifold();
});

const box = () => M.Manifold.cube([30, 30, 30], true);
const joint: Joint = { id: "j", position: [0, 0, 0], axis: [0, 0, 1], diameter: 4, length: 20, source: "auto" };

describe("applyConnectors", () => {
  it("matches applyJoints for a default (cylinder) placement", () => {
    const r1 = applyConnectors(M, box(), box(), [joint], "pla-tight");
    const r2 = applyJoints(M, box(), box(), [joint], "pla-tight");
    expect(r1.partA.volume()).toBeCloseTo(r2.partA.volume(), 3);
    expect(r1.jointPieces.length).toBe(r2.jointPieces.length);
    [r1, r2].forEach((r) => {
      r.partA.delete();
      r.partB.delete();
      r.jointPieces.forEach((p: any) => p.delete());
    });
  });

  it("maps connectorId 'dovetail' onto the dovetail shape", () => {
    const r = applyConnectors(M, box(), box(), [{ ...joint, connectorId: "dovetail" }], "pla-tight");
    expect(r.partA.status()).toBe("NoError");
    expect(r.jointPieces.length).toBe(1);
    r.partA.delete();
    r.partB.delete();
    r.jointPieces.forEach((p: any) => p.delete());
  });
});
