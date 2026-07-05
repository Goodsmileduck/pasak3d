import * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";

export type SDFOptions = { rayCount?: number; coneAngleDeg?: number };

/** Read triangle `f` vertex indices from indexed or non-indexed geometry. */
function triIndices(geom: THREE.BufferGeometry, f: number): [number, number, number] {
  if (geom.index) return [geom.index.getX(f * 3), geom.index.getX(f * 3 + 1), geom.index.getX(f * 3 + 2)];
  return [f * 3, f * 3 + 1, f * 3 + 2];
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Reusable scratch for coneDir's basis vectors — avoids per-ray allocation in the hot loop.
const CONE_UP_Z = new THREE.Vector3(0, 0, 1);
const CONE_UP_X = new THREE.Vector3(1, 0, 0);
const coneU = new THREE.Vector3();
const coneV = new THREE.Vector3();

/** A direction inside the cone around `axis` (half-angle `angle`), sample `i` of `n`. */
function coneDir(axis: THREE.Vector3, angle: number, i: number, n: number, out: THREE.Vector3): THREE.Vector3 {
  if (i === 0 || angle <= 0) return out.copy(axis);
  // deterministic spiral over the cap (no rng — reproducible)
  const t = i / n;
  const theta = t * angle;                 // polar from axis
  const phi = i * 2.399963;                // golden-angle azimuth
  // build a basis around axis
  const up = Math.abs(axis.z) < 0.9 ? CONE_UP_Z : CONE_UP_X;
  coneU.crossVectors(axis, up).normalize();
  coneV.crossVectors(axis, coneU);
  const sin = Math.sin(theta);
  return out.copy(axis).multiplyScalar(Math.cos(theta))
    .addScaledVector(coneU, sin * Math.cos(phi))
    .addScaledVector(coneV, sin * Math.sin(phi))
    .normalize();
}

/** Shape Diameter Function per triangle: median inward ray-cone hit distance (local thickness). */
export function computeSDF(geometry: THREE.BufferGeometry, opts: SDFOptions = {}): Float32Array {
  const rayCount = opts.rayCount ?? 30;
  const coneAngle = ((opts.coneAngleDeg ?? 30) * Math.PI) / 180;
  const bvh = new MeshBVH(geometry);
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const faceCount = (geometry.index ? geometry.index.count : pos.count) / 3;
  const sdf = new Float32Array(faceCount);

  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const centroid = new THREE.Vector3(), normal = new THREE.Vector3(), inward = new THREE.Vector3();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), dir = new THREE.Vector3();
  const origin = new THREE.Vector3();
  const ray = new THREE.Ray();

  for (let f = 0; f < faceCount; f++) {
    const [i0, i1, i2] = triIndices(geometry, f);
    a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
    centroid.copy(a).add(b).add(c).multiplyScalar(1 / 3);
    normal.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a)).normalize();
    inward.copy(normal).negate();

    const dists: number[] = [];
    for (let r = 0; r < rayCount; r++) {
      coneDir(inward, coneAngle, r, rayCount, dir);
      // Reject rays that flip to the outward hemisphere.
      if (dir.dot(inward) <= 0) continue;
      origin.copy(centroid).addScaledVector(dir, 1e-4); // nudge off the face to skip self-hit
      ray.set(origin, dir);
      const hit = bvh.raycastFirst(ray, THREE.DoubleSide);
      if (hit && hit.distance > 1e-3) dists.push(hit.distance);
    }
    sdf[f] = median(dists);
  }
  return sdf;
}
