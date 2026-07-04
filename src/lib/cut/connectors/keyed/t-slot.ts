import type { Connector, ConnectorParams } from "../types";

/** Nominal T cross-section: a wide cap slab at the bottom + a narrower neck on top. */
function tProfile(M: any, size: number): any {
  const capW = size;
  const capH = size / 3;
  const neckW = size / 2.5;
  const neckH = size - capH;
  const overlap = Math.max(size * 0.01, 0.01);
  const cap = M.CrossSection.square([capW, capH + overlap], true).translate([0, -neckH / 2 + overlap / 2]);
  const neck = M.CrossSection.square([neckW, neckH + overlap], true).translate([0, capH / 2 - overlap / 2]);
  const out = cap.add(neck);
  cap.delete();
  neck.delete();
  return out;
}

function extrudeT(M: any, size: number, length: number, grow: number): any {
  const nominal = tProfile(M, size);
  const profile = grow > 0 ? nominal.offset(grow, "Round", 2, 32) : nominal;
  const out = profile.extrude(length, 1, 0, undefined, true);
  if (profile !== nominal) profile.delete();
  nominal.delete();
  return out;
}

export const tSlotConnector: Connector = {
  id: "t-slot",
  name: "T-slot",
  category: "keyed",
  assembly: "separate-piece",
  defaults: {},
  describe: "T-slot - keys against shear and rotation at the seam",
  build: {
    femaleCavity: (M: any, p: ConnectorParams) => extrudeT(M, p.size, p.length, p.clearance),
    piece: (M: any, p: ConnectorParams) => extrudeT(M, p.size, p.length, 0),
    integralMale: undefined,
  },
};
