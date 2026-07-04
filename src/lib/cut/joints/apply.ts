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

    if (polarity === "magnet") {
      const depth = j.length;
      const axis = j.axis;
      const cutALocal = buildJointSolid(M, {
        shape, diameter: j.diameter, length: depth, taper: j.taper, grow: clearance,
      });
      const cutBLocal = buildJointSolid(M, {
        shape, diameter: j.diameter, length: depth, taper: j.taper, grow: clearance,
      });
      const cutA = placeSolid(
        cutALocal,
        [
          j.position[0] + axis[0] * depth / 2,
          j.position[1] + axis[1] * depth / 2,
          j.position[2] + axis[2] * depth / 2,
        ],
        axis,
      );
      const cutB = placeSolid(
        cutBLocal,
        [
          j.position[0] - axis[0] * depth / 2,
          j.position[1] - axis[1] * depth / 2,
          j.position[2] - axis[2] * depth / 2,
        ],
        axis,
      );
      cutALocal.delete();
      cutBLocal.delete();

      const newA = outA.subtract(cutA);
      const newB = outB.subtract(cutB);
      if (outA !== partA) outA.delete();
      if (outB !== partB) outB.delete();
      outA = newA;
      outB = newB;
      cutA.delete();
      cutB.delete();
      continue;
    }

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
