import type { Dowel } from "../../types";

export type ApplyDowelsResult = {
  partA: any;
  partB: any;
  dowelPieces: any[];
};

/**
 * Build a hole cylinder (= dowel radius + clearance) and a peg cylinder (nominal radius).
 * Subtract the hole from both partA and partB; emit the peg as a separate dowel piece.
 *
 * `tolerance` is radial clearance per hole, in mm.
 */
export function applyDowels(
  M: any,
  partA: any,
  partB: any,
  dowels: Dowel[],
  tolerance: number,
): ApplyDowelsResult {
  let outA = partA;
  let outB = partB;
  const dowelPieces: any[] = [];

  for (const d of dowels) {
    const hole = buildCylinder(M, d.diameter / 2 + tolerance, d.length, d.position, d.axis);
    const newA = outA.subtract(hole);
    const newB = outB.subtract(hole);
    if (outA !== partA) outA.delete();
    if (outB !== partB) outB.delete();
    outA = newA;
    outB = newB;
    hole.delete();
    dowelPieces.push(buildDowelPiece(M, d));
  }
  return { partA: outA, partB: outB, dowelPieces };
}

function buildCylinder(
  M: any,
  radius: number,
  length: number,
  position: [number, number, number],
  axis: [number, number, number],
): any {
  // Create cylinder centered on Z axis
  const cyl = M.Manifold.cylinder(length, radius, radius, 128, true);
  const [ax, ay, az] = axis;
  const zUp: [number, number, number] = [0, 0, 1];
  const mat = rotationMat4FromTo(zUp, [ax, ay, az]);
  // Apply rotation then translate to position
  return cyl.transform(mat).translate(position);
}

export function buildDowelPiece(M: any, d: Dowel): any {
  return buildCylinder(M, d.diameter / 2, d.length, d.position, d.axis);
}

/**
 * Build a column-major 4x4 identity-based rotation matrix that rotates `from` to `to`.
 * Manifold's transform() takes a Mat4 in column-major order:
 *   [m00, m10, m20, m30,  m01, m11, m21, m31,  m02, m12, m22, m32,  m03, m13, m23, m33]
 * Translation is in the last column: m03, m13, m23.
 * The last row (m30, m31, m32, m33) is ignored.
 *
 * Column-major layout for a rotation R (no translation):
 *   col0 = [R[0][0], R[1][0], R[2][0], 0]
 *   col1 = [R[0][1], R[1][1], R[2][1], 0]
 *   col2 = [R[0][2], R[1][2], R[2][2], 0]
 *   col3 = [0,       0,       0,       1]
 * Flattened: [R00, R10, R20, 0, R01, R11, R21, 0, R02, R12, R22, 0, 0, 0, 0, 1]
 */
function rotationMat4FromTo(
  from: [number, number, number],
  to: [number, number, number],
): number[] {
  const [fx, fy, fz] = normalize(from);
  const [tx, ty, tz] = normalize(to);
  const dot = fx * tx + fy * ty + fz * tz;

  let R: [number, number, number, number, number, number, number, number, number];

  if (dot > 0.99999) {
    // Identity rotation
    R = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  } else if (dot < -0.99999) {
    // 180-degree rotation about an orthogonal axis
    const ortho: [number, number, number] = Math.abs(fx) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const [vx, vy, vz] = normalize(cross([fx, fy, fz], ortho));
    // Rodrigues with angle=PI: R = 2*v*v^T - I
    R = [
      2 * vx * vx - 1, 2 * vy * vx,     2 * vz * vx,
      2 * vx * vy,     2 * vy * vy - 1, 2 * vz * vy,
      2 * vx * vz,     2 * vy * vz,     2 * vz * vz - 1,
    ];
  } else {
    // Rodrigues rotation formula
    const [cx, cy, cz] = cross([fx, fy, fz], [tx, ty, tz]);
    const s = Math.sqrt(cx * cx + cy * cy + cz * cz);
    const c = dot;
    const [kx, ky, kz] = [cx / s, cy / s, cz / s];
    const t = 1 - c;
    R = [
      t * kx * kx + c,       t * kx * ky + s * kz,  t * kx * kz - s * ky,
      t * kx * ky - s * kz,  t * ky * ky + c,       t * ky * kz + s * kx,
      t * kx * kz + s * ky,  t * ky * kz - s * kx,  t * kz * kz + c,
    ];
  }

  // R is row-major: R[row*3 + col] = R_ij where row=i, col=j
  // Column-major Mat4 layout: [col0[0..3], col1[0..3], col2[0..3], col3[0..3]]
  // col j = [R[0][j], R[1][j], R[2][j], 0]
  // R[i][j] = R[i*3 + j]
  return [
    R[0], R[3], R[6], 0,  // col 0: R[0][0], R[1][0], R[2][0]
    R[1], R[4], R[7], 0,  // col 1: R[0][1], R[1][1], R[2][1]
    R[2], R[5], R[8], 0,  // col 2: R[0][2], R[1][2], R[2][2]
    0,    0,    0,    1,  // col 3: translation (none)
  ];
}

function normalize([x, y, z]: [number, number, number]): [number, number, number] {
  const l = Math.sqrt(x * x + y * y + z * z) || 1;
  return [x / l, y / l, z / l];
}

function cross(
  [ax, ay, az]: [number, number, number],
  [bx, by, bz]: [number, number, number],
): [number, number, number] {
  return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
}
