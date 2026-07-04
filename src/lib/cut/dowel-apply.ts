import type { Dowel } from "../../types";
import { applyJoints } from "./joints/apply";
import { buildJointPiece } from "./joints/shapes";

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
  const result = applyJoints(
    M,
    partA,
    partB,
    dowels.map((d) => ({ ...d, clearance: d.clearance ?? tolerance })),
    "pla-tight",
  );
  return { partA: result.partA, partB: result.partB, dowelPieces: result.jointPieces };
}

export function buildDowelPiece(M: any, d: Dowel): any {
  return buildJointPiece(M, d);
}
