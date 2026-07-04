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
  const r = diameter / 2 + grow;
  switch (shape) {
    case "cylinder": {
      const rTop = (diameter / 2) * (1 - taper) + grow;
      return M.Manifold.cylinder(length, r, rTop, 128, true);
    }
    case "cube": {
      const x = diameter + 2 * grow;
      return M.Manifold.cube([x, x, length], true);
    }
    case "cross": {
      const arm = diameter + 2 * grow;
      const barW = arm / 3;
      const a = M.Manifold.cube([arm, barW, length], true);
      const b = M.Manifold.cube([barW, arm, length], true);
      const out = a.add(b);
      a.delete(); b.delete();
      return out;
    }
    case "dovetail": {
      const half = diameter / 2 + grow;
      const narrow = half * 0.6;
      const h = diameter + 2 * grow;
      const contour: Array<[number, number]> = [
        [-half, -h / 2], [half, -h / 2], [narrow, h / 2], [-narrow, h / 2],
      ];
      const cs = M.CrossSection.ofPolygons([contour]);
      const out = cs.extrude(length, 1, 0, undefined, true);
      cs.delete();
      return out;
    }
    case "puzzle": {
      const neck = M.CrossSection.square([r, diameter + 2 * grow], true);
      const circle = M.CrossSection.circle(r, 64);
      const lobe = circle.translate([r * 0.9, 0]);
      circle.delete();
      const profile = neck.add(lobe);
      const out = profile.extrude(length, 1, 0, undefined, true);
      neck.delete(); lobe.delete(); profile.delete();
      return out;
    }
    default:
      throw new Error(`buildJointSolid: shape ${shape} not implemented yet`);
  }
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
