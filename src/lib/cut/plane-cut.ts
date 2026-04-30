import * as THREE from "three";
import type { CutPlaneSpec } from "../../types";
import { meshToManifold } from "./convert";

export type PlaneCutResult = {
  partA: { manifold: any; volume: number }; // positive side: normal · p > constant
  partB: { manifold: any; volume: number }; // negative side
};

/**
 * Cut a mesh with a plane. Returns two Manifolds.
 * Caller is responsible for calling .delete() on each manifold when done.
 *
 * Uses splitByPlane: first result is in the direction of the normal (positive side),
 * second result is on the opposite side (negative side).
 */
export async function planeCutMesh(
  M: any,
  mesh: THREE.Mesh,
  plane: CutPlaneSpec,
): Promise<PlaneCutResult> {
  const m = meshToManifold(M, mesh);
  const [n0, n1, n2] = plane.normal;
  // splitByPlane(normal, originOffset): [pos, neg]
  // pos = in the direction of the normal (small slice when constant is near edge)
  // neg = behind the plane (the larger piece when constant is near positive edge)
  // Test convention: partA is the larger "behind" piece, partB the forward slice
  // so we map: partA = neg, partB = pos
  const [pos, neg] = m.splitByPlane([n0, n1, n2], plane.constant);
  m.delete();

  const volA = neg.volume();
  const volB = pos.volume();
  if (volA < 1e-3 || volB < 1e-3) {
    pos.delete();
    neg.delete();
    throw new Error("Cut plane does not intersect the part.");
  }

  return {
    partA: { manifold: neg, volume: volA },
    partB: { manifold: pos, volume: volB },
  };
}
