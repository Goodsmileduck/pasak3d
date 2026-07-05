import { describe, it, expect, beforeAll } from "vitest";
import { initManifold } from "../../../src/lib/cut/manifold";
import { m1KeyedConnectors } from "../../../src/lib/cut/connectors/m1-adapter";

let M: any;

beforeAll(async () => {
  M = await initManifold();
});

describe("m1KeyedConnectors", () => {
  it("exposes one keyed separate-piece connector per M1 shape", () => {
    const cs = m1KeyedConnectors();
    expect(cs.map((c) => c.id).sort()).toEqual(["cross", "cube", "cylinder", "dovetail", "puzzle"]);
    expect(cs.every((c) => c.category === "keyed" && c.assembly === "separate-piece")).toBe(true);
  });

  it("female cavity is larger than the piece by the clearance", () => {
    const cyl = m1KeyedConnectors().find((c) => c.id === "cylinder")!;
    const p = { size: 6, length: 12, clearance: 0.3 };
    const cavity = cyl.build.femaleCavity(M, p);
    const piece = cyl.build.piece(M, p)!;
    expect(cavity.volume()).toBeGreaterThan(piece.volume());
    expect(cyl.build.integralMale).toBeUndefined();
    cavity.delete();
    piece.delete();
  });
});
