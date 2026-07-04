import type { Joint, JointShape, TolerancePreset } from "../../../types";
import { JOINT_SHAPES } from "../../../types";
import { applyJoints, type ApplyJointsResult } from "../joints/apply";
import { getConnector } from "./registry";

export function applyConnectors(
  M: any,
  partA: any,
  partB: any,
  joints: Joint[],
  preset: TolerancePreset,
): ApplyJointsResult {
  const mapped = joints.map((j) => {
    if (!j.connectorId) return j;
    const c = getConnector(j.connectorId);
    if (c && JOINT_SHAPES.includes(c.id as JointShape)) {
      return { ...j, shape: c.id as JointShape };
    }
    return j;
  });
  return applyJoints(M, partA, partB, mapped, preset);
}
