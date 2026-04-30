import * as THREE from "three";

/**
 * Find the rotation that places the largest planar face cluster downward (-Z).
 * Strategy: cluster triangles by face normal (round to ~5° buckets), sum area per bucket,
 * pick the bucket with the largest summed area, then rotate so that normal → -Z.
 */
export function computeAutoOrientRotation(mesh: THREE.Mesh): THREE.Quaternion {
  const geom = mesh.geometry as THREE.BufferGeometry;
  const pos = geom.attributes.position.array as Float32Array;
  const idx = geom.index?.array;
  const triCount = idx ? idx.length / 3 : pos.length / 9;

  const buckets = new Map<string, { normal: THREE.Vector3; area: number }>();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3();

  for (let t = 0; t < triCount; t++) {
    const ia = idx ? idx[t * 3] : t * 3;
    const ib = idx ? idx[t * 3 + 1] : t * 3 + 1;
    const ic = idx ? idx[t * 3 + 2] : t * 3 + 2;
    a.fromArray(pos, ia * 3); b.fromArray(pos, ib * 3); c.fromArray(pos, ic * 3);
    ab.subVectors(b, a); ac.subVectors(c, a);
    const cross = new THREE.Vector3().crossVectors(ab, ac);
    const area = cross.length() / 2;
    if (area < 1e-6) continue;
    const n = cross.normalize();
    const key = bucketKey(n);
    const existing = buckets.get(key);
    if (existing) existing.area += area;
    else buckets.set(key, { normal: n.clone(), area });
  }

  let best: { normal: THREE.Vector3; area: number } | null = null;
  for (const v of buckets.values()) {
    if (!best || v.area > best.area) best = v;
  }
  if (!best) return new THREE.Quaternion();
  return new THREE.Quaternion().setFromUnitVectors(best.normal, new THREE.Vector3(0, 0, -1));
}

function bucketKey(n: THREE.Vector3, stepDeg = 5): string {
  const stepRad = (stepDeg * Math.PI) / 180;
  const round = (v: number) => Math.round(v / stepRad) * stepRad;
  return `${round(n.x)},${round(n.y)},${round(n.z)}`;
}

/**
 * Bake the auto-orient rotation into the mesh geometry, then translate so the lowest
 * point of the rotated bbox sits on Z=0.
 */
export function applyAutoOrient(mesh: THREE.Mesh): void {
  const rot = computeAutoOrientRotation(mesh);
  mesh.quaternion.copy(rot);
  mesh.updateMatrix();
  mesh.geometry.applyMatrix4(mesh.matrix);
  mesh.position.set(0, 0, 0);
  mesh.quaternion.identity();
  mesh.updateMatrix();
  const bbox = new THREE.Box3().setFromObject(mesh);
  const center = bbox.getCenter(new THREE.Vector3());
  mesh.position.set(-center.x, -center.y, -bbox.min.z);
  mesh.updateMatrixWorld(true);
}
