import { buildJointSolid } from "../../joints/shapes";
import { assertNoError } from "../../manifold-assert";
import type { Connector, ConnectorParams } from "../types";

function dovetailWithDetent(M: any, size: number, length: number, grow: number): any {
  const body = buildJointSolid(M, { shape: "dovetail", diameter: size, length, grow });
  const rDetent = size * 0.18 + grow;
  const detent = M.Manifold.sphere(rDetent, 32).translate([size / 2, 0, 0]);
  const out = body.add(detent);
  assertNoError(out, "snap-dovetail detent union");
  body.delete();
  detent.delete();
  return out;
}

export const snapDovetailConnector: Connector = {
  id: "snap-dovetail",
  name: "Snap dovetail",
  category: "snap",
  assembly: "separate-piece",
  defaults: { clearance: 0.2 },
  describe: "Snap dovetail - slides in, detent clicks at seat",
  build: {
    femaleCavity: (M: any, p: ConnectorParams) => dovetailWithDetent(M, p.size, p.length, p.clearance),
    piece: (M: any, p: ConnectorParams) => dovetailWithDetent(M, p.size, p.length, 0),
    integralMale: undefined,
  },
};
