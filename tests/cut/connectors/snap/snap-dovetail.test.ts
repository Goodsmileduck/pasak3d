import { describe, it, expect, beforeAll } from "vitest";
import { initManifold } from "../../../../src/lib/cut/manifold";
import { buildJointSolid } from "../../../../src/lib/cut/joints/shapes";
import { snapDovetailConnector } from "../../../../src/lib/cut/connectors/snap/snap-dovetail";

let M: any;
beforeAll(async () => { M = await initManifold(); });
const p = { size: 8, length: 14, clearance: 0.2 };

describe("snapDovetailConnector", () => {
  it("is a snap separate-piece connector with valid geometry", () => {
    expect(snapDovetailConnector.assembly).toBe("separate-piece");
    const piece = snapDovetailConnector.build.piece(M, p)!;
    const cavity = snapDovetailConnector.build.femaleCavity(M, p);
    expect(piece.status()).toBe("NoError");
    expect(cavity.status()).toBe("NoError");
    piece.delete(); cavity.delete();
  });

  it("the detent adds volume over a plain dovetail (a real bump/dimple)", () => {
    const plain = buildJointSolid(M, { shape: "dovetail", diameter: p.size, length: p.length, grow: 0 });
    const piece = snapDovetailConnector.build.piece(M, p)!;
    expect(piece.volume()).toBeGreaterThan(plain.volume());
    plain.delete(); piece.delete();
  });
});
