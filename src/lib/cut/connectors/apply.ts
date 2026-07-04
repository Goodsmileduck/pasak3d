import type { Joint, TolerancePreset } from "../../../types";
import { applyJoints, type ApplyJointsResult } from "../joints/apply";
import { getConnector, isM1Shape } from "./registry";

/**
 * Apply catalog connectors to a cut.
 *
 * P2-M1: every catalog connector is an M1 keyed shape, so this maps
 * `connectorId → joint.shape` and delegates to the proven `applyJoints`
 * (identical geometry, incl. polarity/magnet). When `connectorId` is present it
 * takes precedence over any explicit `joint.shape` (they're kept in lockstep by
 * the UI). New non-M1 connectors (P2-M2+) will branch here to consume the
 * connector's own `build.femaleCavity`/`piece`/`integralMale` — that surface is
 * deliberately unused until then.
 */
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
    if (c && isM1Shape(c.id)) {
      return { ...j, shape: c.id };
    }
    return j;
  });
  return applyJoints(M, partA, partB, mapped, preset);
}
