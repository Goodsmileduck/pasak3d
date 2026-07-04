import type { JointShape } from "../../../types";

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
    default:
      throw new Error(`buildJointSolid: shape ${shape} not implemented yet`);
  }
}
