import { JOINT_SHAPES, type JointShape } from "../../types";
import { buildJointSolid } from "./joints/shapes";
import { placeSolid } from "./joints/orient";

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

const AXIS: [number, number, number] = [0, 0, 1];

/** One coupon pair: a block with a protruding key (A) and a block with the socket (B). */
function buildPair(M: any, shape: JointShape, o: TestFitOpts, clearance: number): TestFitPair {
  const top: [number, number, number] = [0, 0, o.cubeSize / 2];
  // Key spans the top face: half into the block, half proud of it.
  const keyLen = o.keyDepth * 2;

  const blockA = M.Manifold.cube([o.cubeSize, o.cubeSize, o.cubeSize], true);
  const peg = placeSolid(buildJointSolid(M, { shape, diameter: o.keyWidth, length: keyLen, grow: 0 }), top, AXIS);
  const male = blockA.add(peg);
  blockA.delete(); peg.delete();

  const blockB = M.Manifold.cube([o.cubeSize, o.cubeSize, o.cubeSize], true);
  const hole = placeSolid(buildJointSolid(M, { shape, diameter: o.keyWidth, length: keyLen, grow: clearance }), top, AXIS);
  const female = blockB.subtract(hole);
  blockB.delete(); hole.delete();

  const c = clearance.toFixed(2);
  return {
    clearance, shape, male, female,
    maleName: `testfit_${shape}_c${c}_A.stl`,
    femaleName: `testfit_${shape}_c${c}_B.stl`,
  };
}

export function generateTestFitPairs(M: any, opts: TestFitOpts): TestFitPair[] {
  const pairs: TestFitPair[] = [];
  for (let i = 0; i < opts.count; i++) {
    const clearance = opts.baseClearance + i * opts.step;
    const shape = opts.shuffleShapes ? JOINT_SHAPES[i % JOINT_SHAPES.length] : opts.shape;
    pairs.push(buildPair(M, shape, opts, clearance));
  }
  return pairs;
}
