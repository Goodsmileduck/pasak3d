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

  // For complex models (e.g., a keycap with a dragon on top), the cut produces
  // multiple disconnected cross-section regions. We distribute dowels across
  // them proportionally to area so each meaningful region gets at least one
  // dowel — placing all dowels in just the largest region clusters them in
  // one corner of the model and leaves other halves under-supported.
  const withArea = polys.map((p) => ({ poly: p, area: Math.abs(polygonArea(p)) }));
  const totalArea = withArea.reduce((s, x) => s + x.area, 0) || 1;
  const sorted = [...withArea].sort((a, b) => b.area - a.area);

  const places2D: Array<[number, number]> = [];
  let remaining = opts.count;
  for (let i = 0; i < sorted.length && remaining > 0; i++) {
    const { poly, area } = sorted[i];
    // Proportional share, but always at least 1 dowel per region as long as
    // some count remains. Last region soaks up any remainder.
    const share = i === sorted.length - 1
      ? remaining
      : Math.max(1, Math.round((opts.count * area) / totalArea));
    const ask = Math.min(share, remaining);
    const got = autoPlaceDowels([poly], {
      count: ask,
      dowelDiameter: opts.dowelDiameter,
      minSpacing: opts.minSpacing,
    });
    places2D.push(...got);
    remaining -= got.length;
  }

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

/** Signed area of a 2D polygon via the shoelace formula. */
function polygonArea(poly: Array<[number, number]>): number {
  let sum = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    sum += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]);
  }
  return sum / 2;
}
