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
  it("passes a joint with no connectorId straight through to applyJoints", () => {
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

  // Cover the ACTUAL mapping path the app uses (App always stamps a connectorId):
  // applyConnectors({connectorId: s}) must equal applyJoints({shape: s}) for every
  // keyed connector — the delegation's zero-behavior-change guarantee.
  it.each(["cylinder", "cube", "dovetail"] as const)(
    "connectorId '%s' produces the same geometry as applyJoints with that shape",
    (id) => {
      const viaConnector = applyConnectors(M, box(), box(), [{ ...joint, connectorId: id }], "pla-tight");
      const viaShape = applyJoints(M, box(), box(), [{ ...joint, shape: id }], "pla-tight");
      expect(viaConnector.partA.volume()).toBeCloseTo(viaShape.partA.volume(), 3);
      expect(viaConnector.partB.volume()).toBeCloseTo(viaShape.partB.volume(), 3);
      expect(viaConnector.jointPieces.length).toBe(viaShape.jointPieces.length);
      [viaConnector, viaShape].forEach((r) => {
        r.partA.delete();
        r.partB.delete();
        r.jointPieces.forEach((p: any) => p.delete());
      });
    },
  );

  it("t-slot connector subtracts from both halves and emits one piece", () => {
    const j = {
      id: "j",
      position: [0, 0, 0] as [number, number, number],
      axis: [0, 0, 1] as [number, number, number],
      diameter: 8,
      length: 12,
      source: "auto" as const,
      connectorId: "t-slot",
    };
    const a = box();
    const b = box();
    const r = applyConnectors(M, a, b, [j], "pla-tight");
    expect(r.partA.status()).toBe("NoError");
    expect(r.partA.volume()).toBeLessThan(30 * 30 * 30);
    expect(r.partB.volume()).toBeLessThan(30 * 30 * 30);
    expect(r.jointPieces.length).toBe(1);
    expect(r.jointPieces[0].volume()).toBeLessThan(500);
    r.partA.delete();
    r.partB.delete();
    r.jointPieces.forEach((p: any) => p.delete());
    a.delete();
    b.delete();
  });

  it("M1 shapes still delegate unchanged after adding the generic path", () => {
    const j = { ...joint, connectorId: "cube" };
    const viaConnector = applyConnectors(M, box(), box(), [j], "pla-tight");
    const viaShape = applyJoints(M, box(), box(), [{ ...joint, shape: "cube" as const }], "pla-tight");
    expect(viaConnector.partA.volume()).toBeCloseTo(viaShape.partA.volume(), 3);
    [viaConnector, viaShape].forEach((r) => {
      r.partA.delete();
      r.partB.delete();
      r.jointPieces.forEach((p: any) => p.delete());
    });
  });
});
