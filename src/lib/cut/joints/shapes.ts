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
    default:
      throw new Error(`buildJointSolid: shape ${shape} not implemented yet`);
  }
}
