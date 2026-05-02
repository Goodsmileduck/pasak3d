import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Tolerances tried (in mm) when welding coincident vertices. The first catches
 * the per-face vertex duplication that THREE / loaders introduce by default;
 * the larger ones catch float drift between adjacent triangles in
 * exported-from-CAD STLs.
 */
const WELD_TOLERANCES = [1e-4, 1e-3, 1e-2];

/**
 * Convert a THREE.Mesh (must have BufferGeometry) into a watertight Manifold.
 *
 * Manifold-3d expects a topologically closed mesh. Most STLs from the wild
 * are not — they have per-face vertex duplication (handled by mergeVertices
 * at small tolerance) or float drift between adjacent triangles (handled by
 * larger tolerance). We try progressively coarser welds until the resulting
 * Manifold reports `NoError` and is non-empty, then throw a clear error if
 * none of them produces a valid manifold.
 */
export function meshToManifold(M: any, mesh: THREE.Mesh): any {
  const geom = (mesh.geometry as THREE.BufferGeometry).clone();
  geom.applyMatrix4(mesh.matrixWorld);

  // Strip everything except position so mergeVertices can deduplicate aggressively.
  const posOnly = new THREE.BufferGeometry();
  posOnly.setAttribute("position", geom.attributes.position.clone());
  if (geom.index) posOnly.setIndex(geom.index.clone());

  let lastStatus = "NoError";
  for (const tol of WELD_TOLERANCES) {
    const welded = mergeVertices(posOnly.clone(), tol);
    const positions = welded.attributes.position.array as Float32Array;
    const idx = welded.index!.array as Uint32Array | Uint16Array;
    let man: any;
    try {
      const manMesh = new M.Mesh({
        numProp: 3,
        vertProperties: Float32Array.from(positions),
        triVerts: Uint32Array.from(idx),
      });
      man = new M.Manifold(manMesh);
    } catch {
      continue;
    }
    const status = man.status();
    if (status === "NoError" && !man.isEmpty()) return man;
    lastStatus = status;
    man.delete();
  }
  throw new Error(
    `This mesh has gaps or non-manifold edges and can't be cut reliably (${lastStatus}). Try repairing it in your CAD or slicer first.`,
  );
}

/** Convert a Manifold result into a THREE.Group containing one Mesh. */
export function manifoldToMesh(man: any): THREE.Group {
  const meshOut = man.getMesh();
  const geom = new THREE.BufferGeometry();
  geom.setAttribute(
    "position",
    new THREE.BufferAttribute(meshOut.vertProperties, 3),
  );
  geom.setIndex(new THREE.BufferAttribute(meshOut.triVerts, 1));
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  const mesh = new THREE.Mesh(geom);
  const group = new THREE.Group();
  group.add(mesh);
  return group;
}
