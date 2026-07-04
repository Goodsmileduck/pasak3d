import type { JointShape } from "../../../types";
import { JOINT_SHAPES } from "../../../types";
import { buildJointSolid } from "../joints/shapes";
import type { Connector } from "./types";

const TITLE: Record<JointShape, string> = {
  cylinder: "Cylinder",
  cube: "Cube",
  cross: "Cross",
  dovetail: "Dovetail",
  puzzle: "Puzzle",
};

export function m1KeyedConnectors(): Connector[] {
  return JOINT_SHAPES.map((shape) => ({
    id: shape,
    name: TITLE[shape],
    category: "keyed" as const,
    assembly: "separate-piece" as const,
    defaults: {},
    describe: `${TITLE[shape]} key`,
    build: {
      femaleCavity: (M: any, p) =>
        buildJointSolid(M, { shape, diameter: p.size, length: p.length, taper: p.taper, grow: p.clearance }),
      piece: (M: any, p) =>
        buildJointSolid(M, { shape, diameter: p.size, length: p.length, taper: p.taper, grow: 0 }),
      integralMale: undefined,
    },
  }));
}
