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

  it("the piece cap is genuinely wider than its neck (a real T, not a square)", () => {
    const piece = tSlotConnector.build.piece(M, { size: 8, length: 12, clearance: 0 })!;
    const full = piece.boundingBox();
    // Section a thin Y-strip and measure its X-width. Cap sits at low Y, neck at high Y.
    const stripWidth = (yLo: number, yHi: number): number => {
      const box = M.Manifold.cube([20, yHi - yLo, 20], true).translate([0, (yLo + yHi) / 2, 0]);
      const slice = piece.intersect(box);
      const bb = slice.boundingBox();
      const w = bb.max[0] - bb.min[0];
      box.delete(); slice.delete();
      return w;
    };
    const capW = stripWidth(full.min[1], full.min[1] + 1.5);   // bottom strip = cap
    const neckW = stripWidth(full.max[1] - 1.5, full.max[1]);  // top strip = neck
    expect(capW).toBeCloseTo(8, 1);          // cap width == size
    expect(neckW).toBeCloseTo(8 / 2.5, 0);   // neck width == size / 2.5
    expect(capW).toBeGreaterThan(neckW + 2); // clearly a T, not a square
    piece.delete();
  });
});
