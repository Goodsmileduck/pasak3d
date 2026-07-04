import type { Joint, TolerancePreset } from "../../../types";
import { resolveClearance } from "../../../types";
import { buildJointSolid } from "./shapes";
import { placeSolid } from "./orient";

export type ApplyJointsResult = { partA: any; partB: any; jointPieces: any[] };

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
    const shape = j.shape ?? "cylinder";
    const polarity = j.polarity ?? "separate-peg";
    const clearance = resolveClearance(j, preset);

    const cutterLocal = buildJointSolid(M, {
      shape, diameter: j.diameter, length: j.length, taper: j.taper, grow: clearance,
    });
    const cutter = placeSolid(cutterLocal, j.position, j.axis);
    cutterLocal.delete();

    const newA = outA.subtract(cutter);
    const newB = outB.subtract(cutter);
    if (outA !== partA) outA.delete();
    if (outB !== partB) outB.delete();
    outA = newA;
    outB = newB;
    cutter.delete();

    if (polarity === "separate-peg" || polarity === "male") {
      const pegLocal = buildJointSolid(M, {
        shape, diameter: j.diameter, length: j.length, taper: j.taper, grow: 0,
      });
      jointPieces.push(placeSolid(pegLocal, j.position, j.axis));
      pegLocal.delete();
    }
  }

  return { partA: outA, partB: outB, jointPieces };
}
