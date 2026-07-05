import { describe, it, expect, beforeAll } from "vitest";
import { initManifold } from "../../../../src/lib/cut/manifold";
import { snapKeyConnector } from "../../../../src/lib/cut/connectors/snap/snap-key";

let M: any;
beforeAll(async () => { M = await initManifold(); });
const p = { size: 6, length: 16, clearance: 0.2 };

// Extent of a thin Z-slab along a chosen axis (0=X, 1=Y) at depth z.
function extentAtZ(solid: any, z: number, axis: 0 | 1): number {
  const probe = M.Manifold.cube([40, 40, 1], true).translate([0, 0, z]);
  const slice = solid.intersect(probe);
  const w = slice.isEmpty() ? 0 : slice.boundingBox().max[axis] - slice.boundingBox().min[axis];
  probe.delete(); slice.delete();
  return w;
}

describe("snapKeyConnector", () => {
  it("is a snap separate-piece connector with a snap-fit clearance default", () => {
    expect(snapKeyConnector.id).toBe("snap-key");
    expect(snapKeyConnector.category).toBe("snap");
    expect(snapKeyConnector.assembly).toBe("separate-piece");
    expect(snapKeyConnector.defaults.clearance).toBe(0.2);
  });

  it("piece and cavity are valid single-body manifolds", () => {
    const piece = snapKeyConnector.build.piece(M, p)!;
    const cavity = snapKeyConnector.build.femaleCavity(M, p);
    expect(piece.status()).toBe("NoError");
    expect(cavity.status()).toBe("NoError");
    expect(piece.volume()).toBeGreaterThan(0);
    expect(piece.decompose().length).toBe(1);
    piece.delete(); cavity.delete();
  });

  it("paddle cross-section is non-round (anti-rotation): X much wider than Y at mid", () => {
    const piece = snapKeyConnector.build.piece(M, p)!;
    const xW = extentAtZ(piece, 0, 0);
    const yW = extentAtZ(piece, 0, 1);
    expect(xW).toBeGreaterThan(yW * 1.4);
    piece.delete();
  });

  it("has both-end barb undercuts: end X-extent wider than the mid bore", () => {
    const piece = snapKeyConnector.build.piece(M, p)!;
    const midW = extentAtZ(piece, 0, 0);
    const topW = extentAtZ(piece, p.length / 2 - 0.5, 0);
    const botW = extentAtZ(piece, -(p.length / 2 - 0.5), 0);
    expect(topW).toBeGreaterThan(midW + 0.5);
    expect(botW).toBeGreaterThan(midW + 0.5);
    piece.delete();
  });

  it("cavity clears the piece — piece fits inside the grown cavity", () => {
    const piece = snapKeyConnector.build.piece(M, p)!;
    const cavity = snapKeyConnector.build.femaleCavity(M, p);
    const protrusion = piece.subtract(cavity); // piece ⊆ cavity ⇒ empty
    const shell = cavity.subtract(piece);       // clearance gap ⇒ non-empty
    expect(protrusion.isEmpty()).toBe(true);
    expect(shell.isEmpty()).toBe(false);
    piece.delete(); cavity.delete(); protrusion.delete(); shell.delete();
  });
});
