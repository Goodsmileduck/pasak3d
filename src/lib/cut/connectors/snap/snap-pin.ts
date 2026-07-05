import type { Connector, ConnectorParams } from "../types";
import { assertNoError } from "../../manifold-assert";

function pinSolid(M: any, size: number, length: number, grow: number): any {
  const rStem = size / 2 + grow;
  const rBarb = (size / 2) * 1.6 + grow;
  const stem = M.Manifold.cylinder(length, rStem, rStem, 64, true);
  const top = M.Manifold.sphere(rBarb, 48).translate([0, 0, length / 2]);
  const bot = M.Manifold.sphere(rBarb, 48).translate([0, 0, -length / 2]);
  const withTop = stem.add(top);
  assertNoError(withTop, "snap-pin stem+top");
  const out = withTop.add(bot);
  assertNoError(out, "snap-pin stem+barbs");
  stem.delete();
  top.delete();
  bot.delete();
  withTop.delete();
  return out;
}

export const snapPinConnector: Connector = {
  id: "snap-pin",
  name: "Snap pin",
  category: "snap",
  assembly: "separate-piece",
  defaults: { clearance: 0.25 },
  describe: "Snap pin - barbed ends catch in each socket",
  build: {
    femaleCavity: (M: any, p: ConnectorParams) => pinSolid(M, p.size, p.length, p.clearance),
    piece: (M: any, p: ConnectorParams) => pinSolid(M, p.size, p.length, 0),
    integralMale: undefined,
  },
};
