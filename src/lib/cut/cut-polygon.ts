import * as THREE from "three";

/**
 * Extract closed 2D polygons (in plane-local coords) where the plane intersects the mesh.
 * Stitches triangle-plane intersection segments into closed loops.
 *
 * Returns one or more polygons. Coordinates are in the plane's local 2D frame.
 */
export function extractCutPolygon(
  mesh: THREE.Mesh,
  plane: THREE.Plane,
): Array<Array<[number, number]>> {
  const geom = mesh.geometry as THREE.BufferGeometry;
  const pos = geom.attributes.position.array as Float32Array;
  const idx = geom.index?.array as Uint32Array | undefined;

  // The plane is in WORLD space; vertices on the geometry are mesh-local.
  // Transform each vertex through the mesh's world matrix before testing.
  mesh.updateWorldMatrix(true, false);
  const matrixWorld = mesh.matrixWorld;

  const triCount = idx ? idx.length / 3 : pos.length / 9;
  const segments: Array<[THREE.Vector3, THREE.Vector3]> = [];

  const v0 = new THREE.Vector3();
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();

  for (let t = 0; t < triCount; t++) {
    const ia = idx ? idx[t * 3] : t * 3;
    const ib = idx ? idx[t * 3 + 1] : t * 3 + 1;
    const ic = idx ? idx[t * 3 + 2] : t * 3 + 2;
    v0.fromArray(pos, ia * 3).applyMatrix4(matrixWorld);
    v1.fromArray(pos, ib * 3).applyMatrix4(matrixWorld);
    v2.fromArray(pos, ic * 3).applyMatrix4(matrixWorld);
    const seg = triPlaneSegment(v0, v1, v2, plane);
    if (seg) segments.push(seg);
  }

  if (segments.length === 0) return [];

  // Build a local 2D frame on the plane
  const n = plane.normal.clone().normalize();
  const u = Math.abs(n.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  u.sub(n.clone().multiplyScalar(n.dot(u))).normalize();
  const v = new THREE.Vector3().crossVectors(n, u);
  // A point on the plane: origin + n * (-constant) (since n·p + constant = 0 → p = -constant*n for the closest point)
  const origin = n.clone().multiplyScalar(-plane.constant);

  const project = (p: THREE.Vector3): [number, number] => {
    const d = p.clone().sub(origin);
    return [d.dot(u), d.dot(v)];
  };

  // Stitch segments into closed loops using endpoint matching
  const loops: Array<Array<[number, number]>> = [];
  const remaining = segments.map(([a, b]) => [project(a), project(b)] as [[number, number], [number, number]]);
  const eq = (p: [number, number], q: [number, number]) =>
    Math.abs(p[0] - q[0]) < 1e-4 && Math.abs(p[1] - q[1]) < 1e-4;

  while (remaining.length > 0) {
    const seed = remaining.shift()!;
    const loop: Array<[number, number]> = [seed[0], seed[1]];
    let extended = true;
    while (extended) {
      extended = false;
      for (let i = 0; i < remaining.length; i++) {
        const [a, b] = remaining[i];
        const tail = loop[loop.length - 1];
        if (eq(tail, a)) { loop.push(b); remaining.splice(i, 1); extended = true; break; }
        if (eq(tail, b)) { loop.push(a); remaining.splice(i, 1); extended = true; break; }
      }
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}

function triPlaneSegment(
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  plane: THREE.Plane,
): [THREE.Vector3, THREE.Vector3] | null {
  const da = plane.distanceToPoint(a);
  const db = plane.distanceToPoint(b);
  const dc = plane.distanceToPoint(c);

  const points: THREE.Vector3[] = [];
  if ((da > 0) !== (db > 0)) points.push(intersect(a, b, da, db));
  if ((db > 0) !== (dc > 0)) points.push(intersect(b, c, db, dc));
  if ((dc > 0) !== (da > 0)) points.push(intersect(c, a, dc, da));

  if (points.length === 2) return [points[0], points[1]];
  return null;
}

function intersect(p: THREE.Vector3, q: THREE.Vector3, dp: number, dq: number): THREE.Vector3 {
  const t = dp / (dp - dq);
  return new THREE.Vector3(
    p.x + (q.x - p.x) * t,
    p.y + (q.y - p.y) * t,
    p.z + (q.z - p.z) * t,
  );
}
