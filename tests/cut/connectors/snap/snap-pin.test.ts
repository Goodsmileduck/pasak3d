import { describe, it, expect, beforeAll } from "vitest";
import { initManifold } from "../../../../src/lib/cut/manifold";
import { snapPinConnector } from "../../../../src/lib/cut/connectors/snap/snap-pin";

let M: any;
beforeAll(async () => { M = await initManifold(); });
const p = { size: 6, length: 16, clearance: 0.2 };

// X-width of a thin Z-slab of a solid (proves cross-section width at a depth).
function widthAtZ(solid: any, z: number): number {
  const probe = M.Manifold.cube([40, 40, 1], true).translate([0, 0, z]);
  const slice = solid.intersect(probe);
  const bb = slice.boundingBox();
  const w = slice.isEmpty() ? 0 : bb.max[0] - bb.min[0];
  probe.delete(); slice.delete();
  return w;
}

describe("snapPinConnector", () => {
  it("is a snap separate-piece connector", () => {
    expect(snapPinConnector.category).toBe("snap");
    expect(snapPinConnector.assembly).toBe("separate-piece");
  });

  it("piece and cavity are valid manifolds", () => {
    const piece = snapPinConnector.build.piece(M, p)!;
    const cavity = snapPinConnector.build.femaleCavity(M, p);
    expect(piece.status()).toBe("NoError");
    expect(cavity.status()).toBe("NoError");
    piece.delete(); cavity.delete();
  });

  it("cavity has an UNDERCUT - the end chamber is wider than the mid bore", () => {
    const cavity = snapPinConnector.build.femaleCavity(M, p);
    const boreW = widthAtZ(cavity, 0);
    const chamberW = widthAtZ(cavity, p.length / 2 - 0.5);
    expect(chamberW).toBeGreaterThan(boreW + 1);
    cavity.delete();
  });
});
