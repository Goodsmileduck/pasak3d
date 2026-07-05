import { it, expect, beforeAll } from "vitest";
import { initManifold } from "../../../../src/lib/cut/manifold";
import { cantileverClipConnector } from "../../../../src/lib/cut/connectors/snap/cantilever-clip";

let M: any;
beforeAll(async () => { M = await initManifold(); });
const p = { size: 8, length: 14, clearance: 0.2 };

it("cantilever clip is integral: has integralMale, no piece", () => {
  expect(cantileverClipConnector.assembly).toBe("integral");
  const male = cantileverClipConnector.build.integralMale!(M, p);
  expect(male).not.toBeNull();
  expect(male.status()).toBe("NoError");
  expect(cantileverClipConnector.build.piece(M, p)).toBeNull();
  male.delete();
});

it("the cavity has an UNDERCUT — wider in +X at hook depth than at the slot mouth", () => {
  const cav = cantileverClipConnector.build.femaleCavity(M, p);
  // +X extent of a thin Z-slab near the mouth (z≈0) vs near the hook end (z≈length).
  const xMaxAtZ = (z: number): number => {
    const probe = M.Manifold.cube([80, 80, 1], true).translate([0, 0, z]);
    const slice = cav.intersect(probe);
    const x = slice.isEmpty() ? -Infinity : slice.boundingBox().max[0];
    probe.delete(); slice.delete();
    return x;
  };
  const mouthX = xMaxAtZ(0.5);
  const hookX = xMaxAtZ(p.length - 0.5);
  expect(hookX).toBeGreaterThan(mouthX + 1); // catch recess overhangs the mouth = real undercut
  cav.delete();
});
