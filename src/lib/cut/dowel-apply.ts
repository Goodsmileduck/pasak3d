import type { Dowel } from "../../types";
import { placeSolid } from "./joints/orient";

export type ApplyDowelsResult = {
  partA: any;
  partB: any;
  dowelPieces: any[];
};

/**
 * Build a hole cylinder (= dowel radius + clearance) and a peg cylinder (nominal radius).
 * Subtract the hole from both partA and partB; emit the peg as a separate dowel piece.
 *
 * `tolerance` is radial clearance per hole, in mm.
 */
export function applyDowels(
  M: any,
  partA: any,
  partB: any,
  dowels: Dowel[],
  tolerance: number,
): ApplyDowelsResult {
  let outA = partA;
  let outB = partB;
  const dowelPieces: any[] = [];

  for (const d of dowels) {
    const hole = buildCylinder(M, d.diameter / 2 + tolerance, d.length, d.position, d.axis);
    const newA = outA.subtract(hole);
    const newB = outB.subtract(hole);
    if (outA !== partA) outA.delete();
    if (outB !== partB) outB.delete();
    outA = newA;
    outB = newB;
    hole.delete();
    dowelPieces.push(buildDowelPiece(M, d));
  }
  return { partA: outA, partB: outB, dowelPieces };
}

function buildCylinder(
  M: any,
  radius: number,
  length: number,
  position: [number, number, number],
  axis: [number, number, number],
): any {
  // Create cylinder centered on Z axis
  const cyl = M.Manifold.cylinder(length, radius, radius, 128, true);
  return placeSolid(cyl, position, axis);
}

export function buildDowelPiece(M: any, d: Dowel): any {
  return buildCylinder(M, d.diameter / 2, d.length, d.position, d.axis);
}
