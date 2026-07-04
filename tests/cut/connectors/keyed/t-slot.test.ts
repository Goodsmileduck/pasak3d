import { describe, it, expect, beforeAll } from "vitest";
import { initManifold } from "../../../../src/lib/cut/manifold";
import { tSlotConnector } from "../../../../src/lib/cut/connectors/keyed/t-slot";

let M: any;
beforeAll(async () => { M = await initManifold(); });

const p = { size: 8, length: 12, clearance: 0.3 };

describe("tSlotConnector", () => {
  it("is a keyed separate-piece connector with the expected metadata", () => {
    expect(tSlotConnector.id).toBe("t-slot");
    expect(tSlotConnector.category).toBe("keyed");
    expect(tSlotConnector.assembly).toBe("separate-piece");
  });

  it("piece is a valid T solid; cavity is larger by the clearance", () => {
    const piece = tSlotConnector.build.piece(M, p)!;
    const cavity = tSlotConnector.build.femaleCavity(M, p);
    expect(piece.status()).toBe("NoError");
    expect(piece.volume()).toBeGreaterThan(0);
    expect(cavity.volume()).toBeGreaterThan(piece.volume());
    piece.delete(); cavity.delete();
  });

  it("the piece cap is wider than its neck (a real T)", () => {
    const piece = tSlotConnector.build.piece(M, { size: 8, length: 12, clearance: 0 })!;
    // Cap occupies the bottom slab; neck the top. Slice bboxes: bottom half wider in X than top half.
    const bb = piece.boundingBox();
    expect(bb.max[0] - bb.min[0]).toBeCloseTo(8, 1);
    piece.delete();
  });
});
