import { JOINT_SHAPES, type JointShape } from "../../types";
import type { Connector } from "./connectors/types";
import { buildJointSolid } from "./joints/shapes";

export type TestFitOpts = {
  count: number; step: number; baseClearance: number;
  cubeSize: number; keyDepth: number; keyWidth: number;
  shape?: JointShape; shuffleShapes?: boolean; connectorId?: string;
};

export type CouponPair = {
  clearance: number;
  male: any; maleName: string;
  female: any; femaleName: string;
};

export type TestFitPair = CouponPair & { shape: JointShape };

/** Sensible coupon defaults (base 0.10 → 0.25mm sweep); callers override `shape`. */
export const TESTFIT_DEFAULTS = {
  count: 4, step: 0.05, baseClearance: 0.1,
  cubeSize: 12, keyDepth: 5, keyWidth: 6,
} as const;

/**
 * One coupon block: a centered cube with the joint solid seated at the top face
 * (half in / half proud), then combined — `.add` for the male key, `.subtract`
 * for the female socket. The joint extrudes along +Z, so a plain translate seats
 * it (no rotation needed).
 */
function buildCoupon(
  M: any, shape: JointShape, o: TestFitOpts, grow: number,
  combine: (block: any, solid: any) => any,
): any {
  const block = M.Manifold.cube([o.cubeSize, o.cubeSize, o.cubeSize], true);
  const solid = buildJointSolid(M, { shape, diameter: o.keyWidth, length: o.keyDepth * 2, grow })
    .translate([0, 0, o.cubeSize / 2]);
  const out = combine(block, solid);
  block.delete(); solid.delete();
  return out;
}

/** One coupon pair: a block with a protruding key (A) and a block with the socket (B). */
function buildPair(M: any, shape: JointShape, o: TestFitOpts, clearance: number, index: number): TestFitPair {
  const male = buildCoupon(M, shape, o, 0, (b, s) => b.add(s));
  const female = buildCoupon(M, shape, o, clearance, (b, s) => b.subtract(s));
  // Prefix with the sweep index so distinct steps never collide in the zip even
  // if their clearances round to the same 2-decimal label.
  const tag = `${String(index).padStart(2, "0")}_${shape}_c${clearance.toFixed(2)}`;
  return {
    clearance, shape, male, female,
    maleName: `testfit_${tag}_A.stl`,
    femaleName: `testfit_${tag}_B.stl`,
  };
}

/** Seat an already-built local +Z solid on a coupon block's top face and combine. Deletes the local. */
function buildCouponFromSolid(M: any, cubeSize: number, local: any, combine: (b: any, s: any) => any): any {
  const block = M.Manifold.cube([cubeSize, cubeSize, cubeSize], true);
  const solid = local.translate([0, 0, cubeSize / 2]);
  local.delete();
  const out = combine(block, solid);
  block.delete();
  solid.delete();
  return out;
}

export function generateTestFitPairs(M: any, opts: TestFitOpts): TestFitPair[] {
  const pairs: TestFitPair[] = [];
  for (let i = 0; i < opts.count; i++) {
    const clearance = opts.baseClearance + i * opts.step;
    const shape = opts.shuffleShapes ? JOINT_SHAPES[i % JOINT_SHAPES.length] : opts.shape ?? "cylinder";
    pairs.push(buildPair(M, shape, opts, clearance, i));
  }
  return pairs;
}

export function generateConnectorTestFit(M: any, connector: Connector, opts: TestFitOpts): CouponPair[] {
  const pairs: CouponPair[] = [];
  for (let i = 0; i < opts.count; i++) {
    const clearance = opts.baseClearance + i * opts.step;
    const params = (grow: number) => ({ size: opts.keyWidth, length: opts.keyDepth * 2, clearance: grow });
    const maleLocal = connector.assembly === "integral"
      ? connector.build.integralMale!(M, params(0))
      : connector.build.piece(M, params(0));
    const male = buildCouponFromSolid(M, opts.cubeSize, maleLocal, (b, s) => b.add(s));
    const femaleLocal = connector.build.femaleCavity(M, params(clearance));
    const female = buildCouponFromSolid(M, opts.cubeSize, femaleLocal, (b, s) => b.subtract(s));
    const tag = `${String(i).padStart(2, "0")}_${connector.id}_c${clearance.toFixed(2)}`;
    pairs.push({
      clearance,
      male,
      maleName: `testfit_${tag}_A.stl`,
      female,
      femaleName: `testfit_${tag}_B.stl`,
    });
  }
  return pairs;
}
