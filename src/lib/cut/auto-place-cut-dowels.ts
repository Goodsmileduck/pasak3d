import * as THREE from "three";
import type { CutPlaneSpec, Dowel } from "../../types";
import { extractCutPolygon } from "./cut-polygon";
import { autoPlaceDowels } from "./dowel-place";

export type AutoPlaceOpts = {
  count: number;
  dowelDiameter: number;
  length: number;
  minSpacing: number;
};

/**
 * Extract the cross-section polygon from mesh-plane intersection, then
 * auto-place dowels within it. Returns Dowel objects with world-space positions
 * and the cut plane's normal as axis.
 */
export function autoPlaceCutDowels(
  mesh: THREE.Mesh,
  plane: CutPlaneSpec,
  opts: AutoPlaceOpts,
): Dowel[] {
  // THREE.Plane convention: distanceToPoint = dot(normal, point) + constant
  // So the plane equation is: n · p + constant = 0
  // CutPlaneSpec.constant is the signed distance from origin (originOffset)
  // i.e.: n · p = constant, so THREE.Plane constant = -cutConstant
  const n3 = new THREE.Vector3(...plane.normal).normalize();
  const threePlane = new THREE.Plane(n3, -plane.constant);
  const polys = extractCutPolygon(mesh, threePlane);
  if (polys.length === 0) return [];

  // Use only the largest polygon as the placement boundary. Smaller loops
  // returned by the polygon stitcher are usually disconnected regions
  // (e.g., the wings of a figurine intersecting the plane), not real holes —
  // treating them as holes would falsely shrink the valid placement area.
  const sorted = [...polys].sort((a, b) => b.length - a.length);
  const outer = sorted[0];

  const places2D = autoPlaceDowels([outer], {
    count: opts.count,
    dowelDiameter: opts.dowelDiameter,
    minSpacing: opts.minSpacing,
  });

  // Build local 2D frame: same frame used by extractCutPolygon
  const n = n3.clone();
  const u = Math.abs(n.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  u.sub(n.clone().multiplyScalar(n.dot(u))).normalize();
  const v = new THREE.Vector3().crossVectors(n, u);
  // Origin on the plane: closest point to world origin = n * (-threePlane.constant) = n * constant
  const origin = n.clone().multiplyScalar(-threePlane.constant);

  return places2D.map((p, i) => {
    const world = origin.clone()
      .add(u.clone().multiplyScalar(p[0]))
      .add(v.clone().multiplyScalar(p[1]));
    return {
      id: `auto_${i}`,
      position: [world.x, world.y, world.z] as [number, number, number],
      axis: [n.x, n.y, n.z] as [number, number, number],
      diameter: opts.dowelDiameter,
      length: opts.length,
      source: "auto" as const,
    };
  });
}
