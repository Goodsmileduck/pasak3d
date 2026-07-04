import type { Joint, TolerancePreset } from "../../../types";
import { applyJoints, type ApplyJointsResult } from "../joints/apply";
import { placeSolid } from "../joints/orient";
import { getConnector, isM1Shape } from "./registry";
import { resolveConnectorParams, type Connector } from "./types";

function applySeparatePiece(
  M: any,
  partA: any,
  partB: any,
  joints: Joint[],
  connector: Connector,
  preset: TolerancePreset,
): ApplyJointsResult {
  let outA = partA;
  let outB = partB;
  const jointPieces: any[] = [];

  for (const j of joints) {
    const p = resolveConnectorParams(j, preset);
    const cavityLocal = connector.build.femaleCavity(M, p);
    const cavity = placeSolid(cavityLocal, j.position, j.axis);
    cavityLocal.delete();

    const newA = outA.subtract(cavity);
    const newB = outB.subtract(cavity);
    if (outA !== partA) outA.delete();
    if (outB !== partB) outB.delete();
    outA = newA;
    outB = newB;
    cavity.delete();

    const pieceLocal = connector.build.piece(M, p);
    if (pieceLocal) {
      jointPieces.push(placeSolid(pieceLocal, j.position, j.axis));
      pieceLocal.delete();
    }
  }

  return { partA: outA, partB: outB, jointPieces };
}

/**
 * Apply catalog connectors to a cut.
 *
 * M1 catalog connectors still map `connectorId → joint.shape` and delegate to
 * the proven `applyJoints` path. New keyed separate-piece connectors consume
 * their own `build.femaleCavity`/`piece` surfaces here.
 */
export function applyConnectors(
  M: any,
  partA: any,
  partB: any,
  joints: Joint[],
  preset: TolerancePreset,
): ApplyJointsResult {
  // Phase 2 supports one connector per cut. Dispatch on that single connector;
  // fail loudly on a mixed-connector cut rather than silently mis-routing joints.
  const ids = new Set(joints.map((j) => j.connectorId).filter(Boolean));
  if (ids.size > 1) {
    throw new Error("applyConnectors: mixed connectorIds in one cut are not supported.");
  }
  const id = joints.find((j) => j.connectorId)?.connectorId;
  if (id && !isM1Shape(id)) {
    const connector = getConnector(id);
    if (connector) return applySeparatePiece(M, partA, partB, joints, connector, preset);
  }

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
