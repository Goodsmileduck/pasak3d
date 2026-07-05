import type { Connector, ConnectorParams } from "../types";
import { assertNoError } from "../../manifold-assert";

/** Nominal rounded-rectangle "paddle" cross-section: wide + flat → strong anti-rotation.
 *  width ≈ size, height ≈ size*0.5, corner radius ≈ height*0.35. */
function paddleProfile(M: any, size: number): any {
  const w = size;
  const h = size * 0.5;
  const r = h * 0.35;
  const inner = M.CrossSection.square([w - 2 * r, h - 2 * r], true);
  const rounded = inner.offset(r, "Round", 2, 32); // grow corners back out to w×h, rounded
  inner.delete();
  return rounded;
}

/** A paddle key centered on the seam (local Z), with a flattened-ellipsoid snap barb at each end.
 *  `grow` adds uniform clearance for the female cavity (mirrors extrudeProfile in shapes.ts). */
function keySolid(M: any, size: number, length: number, grow: number): any {
  const nominal = paddleProfile(M, size);
  const profile = grow > 0 ? nominal.offset(grow, "Round", 2, 32) : nominal;
  const body = profile.extrude(length, 1, 0, undefined, true); // centered: z ∈ [-L/2, +L/2]
  if (profile !== nominal) profile.delete();
  nominal.delete();

  // Barbs: a sphere flattened to the paddle aspect → smooth (self-inserting) undercut at each end.
  // Capture + delete every intermediate (sphere, scaled) — chaining .scale()/.translate() leaks the
  // receiver on the WASM heap (see lessons_learned: the placeSolid transform-intermediate leak).
  const rBarb = size * 0.6 + grow;
  const barb = (z: number): any => {
    const sphere = M.Manifold.sphere(rBarb, 48);
    const flat = sphere.scale([1, 0.55, 1] as [number, number, number]);
    sphere.delete();
    const placed = flat.translate([0, 0, z] as [number, number, number]);
    flat.delete();
    return placed;
  };
  const top = barb(length / 2);
  const bot = barb(-length / 2);

  const withTop = body.add(top);
  assertNoError(withTop, "snap-key body+top barb");
  const out = withTop.add(bot);
  assertNoError(out, "snap-key body+barbs");

  body.delete(); top.delete(); bot.delete(); withTop.delete();
  return out;
}

export const snapKeyConnector: Connector = {
  id: "snap-key",
  name: "Locking key",
  category: "snap",
  assembly: "separate-piece",
  defaults: { clearance: 0.2 },
  describe: "Locking key - paddle key with both-end barbs, pushes in and locks rotation + pull-apart",
  build: {
    femaleCavity: (M: any, p: ConnectorParams) => keySolid(M, p.size, p.length, p.clearance),
    piece: (M: any, p: ConnectorParams) => keySolid(M, p.size, p.length, 0),
    integralMale: undefined,
  },
};
