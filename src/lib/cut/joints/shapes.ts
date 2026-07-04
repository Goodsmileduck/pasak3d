import type { Joint, JointShape } from "../../../types";
import { resolveShape } from "../../../types";
import { placeSolid } from "./orient";

export type BuildJointOpts = {
  shape: JointShape;
  diameter: number;   // nominal footprint (mm)
  length: number;     // mm along local +Z
  taper?: number;     // 0..1 draft
  grow?: number;      // female clearance added per side (mm)
};

/** Build a joint solid centered on local origin, extruding along +Z. */
export function buildJointSolid(M: any, opts: BuildJointOpts): any {
  const { shape, diameter, length, taper = 0, grow = 0 } = opts;
  switch (shape) {
    case "cylinder": {
      const r = diameter / 2 + grow;
      const rTop = (diameter / 2) * (1 - taper) + grow;
      return M.Manifold.cylinder(length, r, rTop, 128, true);
    }
    case "cube": {
      // Centered box: +2*grow per dimension = +grow per side.
      const x = diameter + 2 * grow;
      return M.Manifold.cube([x, x, length], true);
    }
    // Extruded profiles: build the NOMINAL 2D contour, then grow the female
    // cutter by a uniform CrossSection.offset(grow) so clearance is the same on
    // every face (baking grow into per-shape dimensions gives uneven clearance).
    case "cross":
      return extrudeProfile(crossProfile(M, diameter), length, grow);
    case "dovetail":
      return extrudeProfile(dovetailProfile(M, diameter), length, grow);
    case "puzzle":
      return extrudeProfile(puzzleProfile(M, diameter), length, grow);
    default:
      throw new Error(`buildJointSolid: shape ${shape} not implemented yet`);
  }
}

/** Offset a nominal 2D profile outward by `grow` (uniform clearance), then extrude. */
function extrudeProfile(nominal: any, length: number, grow: number): any {
  const profile = grow > 0 ? nominal.offset(grow, "Round", 2, 32) : nominal;
  const out = profile.extrude(length, 1, 0, undefined, true);
  if (profile !== nominal) profile.delete();
  nominal.delete();
  return out;
}

/** Nominal plus-sign profile: two crossed bars (arm = diameter, bar = diameter/3). */
function crossProfile(M: any, diameter: number): any {
  const arm = diameter;
  const barW = diameter / 3;
  const a = M.CrossSection.square([arm, barW], true);
  const b = M.CrossSection.square([barW, arm], true);
  const out = a.add(b);
  a.delete(); b.delete();
  return out;
}

/** Nominal dovetail trapezoid (wide base, narrow top). */
function dovetailProfile(M: any, diameter: number): any {
  const half = diameter / 2;
  const narrow = half * 0.6;
  const h = diameter;
  const contour: Array<[number, number]> = [
    [-half, -h / 2], [half, -h / 2], [narrow, h / 2], [-narrow, h / 2],
  ];
  return M.CrossSection.ofPolygons([contour]);
}

/** Nominal jigsaw tab: a neck rectangle unioned with an overlapping round lobe. */
function puzzleProfile(M: any, diameter: number): any {
  const r = diameter / 2;
  const neck = M.CrossSection.square([diameter / 2, diameter], true);
  const circle = M.CrossSection.circle(r, 64);
  const lobe = circle.translate([r * 0.9, 0]);
  circle.delete();
  const out = neck.add(lobe);
  neck.delete(); lobe.delete();
  return out;
}

/**
 * The printable joint piece (peg): the nominal solid (grow = 0), oriented to the
 * joint's axis and positioned at its seam point. Shared by applyJoints and the
 * legacy buildDowelPiece.
 */
export function buildJointPiece(M: any, j: Joint): any {
  const local = buildJointSolid(M, {
    shape: resolveShape(j),
    diameter: j.diameter,
    length: j.length,
    taper: j.taper,
    grow: 0,
  });
  const out = placeSolid(local, j.position, j.axis);
  local.delete();
  return out;
}
