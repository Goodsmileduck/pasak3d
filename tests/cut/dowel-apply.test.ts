import { describe, it, expect } from "vitest";
import { initManifold } from "../../src/lib/cut/manifold";
import { applyDowels, buildDowelPiece } from "../../src/lib/cut/dowel-apply";
import type { Dowel } from "../../src/types";

describe("applyDowels", () => {
  it("subtracts hole cylinders from both halves and produces matching dowel pieces", async () => {
    const M = await initManifold();
    const cubeA = M.Manifold.cube([10, 10, 5], true).translate([0, 0, 2.5]);
    const cubeB = M.Manifold.cube([10, 10, 5], true).translate([0, 0, -2.5]);
    const dowels: Dowel[] = [{
      id: "d1",
      position: [0, 0, 0],
      axis: [0, 0, 1],
      diameter: 4,
      length: 10,
      source: "auto",
    }];
    const result = applyDowels(M, cubeA, cubeB, dowels, 0.10);

    const expectedHoleVol = Math.PI * Math.pow((4 / 2) + 0.10, 2) * 5;
    expect(result.partA.volume()).toBeCloseTo(500 - expectedHoleVol, 0);
    expect(result.partB.volume()).toBeCloseTo(500 - expectedHoleVol, 0);
    expect(result.dowelPieces.length).toBe(1);

    const piece = result.dowelPieces[0];
    const expectedPieceVol = Math.PI * Math.pow(4 / 2, 2) * 10;
    expect(piece.volume()).toBeCloseTo(expectedPieceVol, 0);

    cubeA.delete(); cubeB.delete();
    if (result.partA !== cubeA) result.partA.delete();
    if (result.partB !== cubeB) result.partB.delete();
    piece.delete();
  });
});

describe("buildDowelPiece", () => {
  it("creates a cylinder of the dowel's nominal diameter", async () => {
    const M = await initManifold();
    const piece = buildDowelPiece(M, {
      id: "d1",
      position: [0, 0, 0],
      axis: [0, 0, 1],
      diameter: 5,
      length: 20,
      source: "auto",
    });
    const expected = Math.PI * Math.pow(2.5, 2) * 20;
    expect(piece.volume()).toBeCloseTo(expected, 0);
    piece.delete();
  });
});
