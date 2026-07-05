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
 * Seat an already-built local +Z solid on a coupon block's top face (half in / half
 * proud) and combine — `.add` for a male key, `.subtract` for a female socket.
 * Deletes the local, the block, and the placed solid.
 */
function buildCouponFromSolid(M: any, cubeSize: number, local: any, combine: (b: any, s: any) => any): any {
  const block = M.Manifold.cube([cubeSize, cubeSize, cubeSize], true);
  const solid = local.translate([0, 0, cubeSize / 2]);
  local.delete();
  const out = combine(block, solid);
  block.delete();
  solid.delete();
  return out;
}

/** One coupon block for a joint shape (the shape extrudes along +Z, so a translate seats it). */
function buildCoupon(
  M: any, shape: JointShape, o: TestFitOpts, grow: number,
  combine: (block: any, solid: any) => any,
): any {
  const local = buildJointSolid(M, { shape, diameter: o.keyWidth, length: o.keyDepth * 2, grow });
  return buildCouponFromSolid(M, o.cubeSize, local, combine);
}

/** Index-prefixed zip filenames so distinct sweep steps never collide on a rounded clearance label. */
function couponNames(index: number, stem: string, clearance: number): { maleName: string; femaleName: string } {
  const tag = `${String(index).padStart(2, "0")}_${stem}_c${clearance.toFixed(2)}`;
  return { maleName: `testfit_${tag}_A.stl`, femaleName: `testfit_${tag}_B.stl` };
}

/** One coupon pair: a block with a protruding key (A) and a block with the socket (B). */
function buildPair(M: any, shape: JointShape, o: TestFitOpts, clearance: number, index: number): TestFitPair {
  const male = buildCoupon(M, shape, o, 0, (b, s) => b.add(s));
  const female = buildCoupon(M, shape, o, clearance, (b, s) => b.subtract(s));
  return { clearance, shape, male, female, ...couponNames(index, shape, clearance) };
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

/** The nominal male feature a connector contributes to a test-fit coupon. Throws if it has none. */
function connectorMaleFeature(M: any, connector: Connector, params: { size: number; length: number; clearance: number }): any {
  const local = connector.assembly === "integral"
    ? connector.build.integralMale?.(M, params)
    : connector.build.piece(M, params);
  if (!local) throw new Error(`connector ${connector.id} has no test-fit male feature`);
  return local;
}

export function generateConnectorTestFit(M: any, connector: Connector, opts: TestFitOpts): CouponPair[] {
  const pairs: CouponPair[] = [];
  for (let i = 0; i < opts.count; i++) {
    const clearance = opts.baseClearance + i * opts.step;
    const params = (grow: number) => ({ size: opts.keyWidth, length: opts.keyDepth * 2, clearance: grow });
    const male = buildCouponFromSolid(M, opts.cubeSize, connectorMaleFeature(M, connector, params(0)), (b, s) => b.add(s));
    const femaleLocal = connector.build.femaleCavity(M, params(clearance));
    const female = buildCouponFromSolid(M, opts.cubeSize, femaleLocal, (b, s) => b.subtract(s));
    pairs.push({ clearance, male, female, ...couponNames(i, connector.id, clearance) });
  }
  return pairs;
}
