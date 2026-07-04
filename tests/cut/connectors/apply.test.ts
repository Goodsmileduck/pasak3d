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
});
