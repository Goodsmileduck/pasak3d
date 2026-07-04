import { JOINT_SHAPES, type JointShape } from "../../types";
import { buildJointSolid } from "./joints/shapes";

export type TestFitOpts = {
  count: number; step: number; baseClearance: number;
  cubeSize: number; keyDepth: number; keyWidth: number;
  shape: JointShape; shuffleShapes?: boolean;
};

export type TestFitPair = {
  clearance: number; shape: JointShape;
  male: any; maleName: string;
  female: any; femaleName: string;
};

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

export function generateTestFitPairs(M: any, opts: TestFitOpts): TestFitPair[] {
  const pairs: TestFitPair[] = [];
  for (let i = 0; i < opts.count; i++) {
    const clearance = opts.baseClearance + i * opts.step;
    const shape = opts.shuffleShapes ? JOINT_SHAPES[i % JOINT_SHAPES.length] : opts.shape;
    pairs.push(buildPair(M, shape, opts, clearance, i));
  }
  return pairs;
}
