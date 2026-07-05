import type { Connector, ConnectorParams } from "../types";

function assertNoError(solid: any, label: string): void {
  const status = solid.status();
  if (status !== "NoError") {
    throw new Error(`${label}: ${status}`);
  }
}

function clipMale(M: any, size: number, length: number): any {
  const beamW = size * 0.6;
  const beamT = size * 0.35;
  const beam = M.Manifold.cube([beamW, beamT, length], false)
    .translate([-beamW / 2, -beamT / 2, 0]);
  const hookW = size * 1.8;
  const hookH = size * 0.3;
  const hookOverlap = size * 0.1;
  const hook = M.Manifold.cube([hookW, beamT, hookH], false)
    .translate([beamW / 2 - hookOverlap, -beamT / 2, length - hookH]);
  const out = beam.add(hook);
  assertNoError(out, "cantilever-clip male union");
  beam.delete();
  hook.delete();
  return out;
}

function clipCavity(M: any, size: number, length: number, grow: number): any {
  const beamW = size * 0.6 + 2 * grow;
  const beamT = size * 0.35 + 2 * grow;
  const slot = M.Manifold.cube([beamW, beamT, length + grow], false)
    .translate([-beamW / 2, -beamT / 2, 0]);
  const catchW = size * 2 + grow;
  const catchH = size * 0.35 + 2 * grow;
  const catchOverlap = size * 0.1 + grow;
  const rec = M.Manifold.cube([catchW, beamT, catchH], false)
    .translate([beamW / 2 - catchOverlap, -beamT / 2, length - catchH]);
  const out = slot.add(rec);
  assertNoError(out, "cantilever-clip cavity union");
  slot.delete();
  rec.delete();
  return out;
}

export const cantileverClipConnector: Connector = {
  id: "cantilever-clip",
  name: "Cantilever clip",
  category: "snap",
  assembly: "integral",
  defaults: { clearance: 0.25 },
  describe: "Cantilever clip - hook molded into one part, catch in the other",
  build: {
    femaleCavity: (M: any, p: ConnectorParams) => clipCavity(M, p.size, p.length, p.clearance),
    piece: () => null,
    integralMale: (M: any, p: ConnectorParams) => clipMale(M, p.size, p.length),
  },
};
