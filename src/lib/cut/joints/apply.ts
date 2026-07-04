import type { Joint, TolerancePreset } from "../../../types";
import { resolveClearance, resolvePolarity, resolveShape } from "../../../types";
import { buildJointSolid, buildJointPiece } from "./shapes";
import { placeSolid } from "./orient";

export type ApplyJointsResult = { partA: any; partB: any; jointPieces: any[] };

function shiftAlong(
  p: [number, number, number],
  axis: [number, number, number],
  d: number,
): [number, number, number] {
  return [p[0] + axis[0] * d, p[1] + axis[1] * d, p[2] + axis[2] * d];
}

export function applyJoints(
  M: any,
  partA: any,
  partB: any,
  joints: Joint[],
  preset: TolerancePreset,
): ApplyJointsResult {
  let outA = partA;
  let outB = partB;
  const jointPieces: any[] = [];

  for (const j of joints) {
    const shape = resolveShape(j);
    const polarity = resolvePolarity(j);
    const clearance = resolveClearance(j, preset);
    // A magnet is a blind recess: two cutters offset ±length/2 so each half keeps
    // a solid floor. Every other polarity is one through-cutter shared by both halves.
    const magnet = polarity === "magnet";
    const off = magnet ? j.length / 2 : 0;

    const local = buildJointSolid(M, {
      shape, diameter: j.diameter, length: j.length, taper: j.taper, grow: clearance,
    });
    const cutterA = placeSolid(local, shiftAlong(j.position, j.axis, off), j.axis);
    const cutterB = magnet ? placeSolid(local, shiftAlong(j.position, j.axis, -off), j.axis) : cutterA;
    local.delete();

    const newA = outA.subtract(cutterA);
    const newB = outB.subtract(cutterB);
    if (outA !== partA) outA.delete();
    if (outB !== partB) outB.delete();
    outA = newA;
    outB = newB;
    cutterA.delete();
    if (cutterB !== cutterA) cutterB.delete();

    if (polarity === "separate-peg" || polarity === "male") {
      jointPieces.push(buildJointPiece(M, j));
    }
  }

  return { partA: outA, partB: outB, jointPieces };
}
