import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Convert a THREE.Mesh (must have BufferGeometry) into a Manifold.
 *
 * THREE geometries often have duplicated vertices (per-face normals / UVs).
 * We strip all attributes except position and weld coincident vertices with
 * mergeVertices so Manifold can verify the mesh is water-tight.
 */
export function meshToManifold(M: any, mesh: THREE.Mesh): any {
  const geom = (mesh.geometry as THREE.BufferGeometry).clone();
  geom.applyMatrix4(mesh.matrixWorld);

  // Build a position-only geometry (drop normals / UVs) and keep / create an
  // index so that coincident vertices are shared across faces.
  const posOnly = new THREE.BufferGeometry();
  posOnly.setAttribute("position", geom.attributes.position.clone());
  if (geom.index) {
    posOnly.setIndex(geom.index.clone());
  }

  // Weld any remaining duplicate positions so the topology is closed.
  const welded = mergeVertices(posOnly);

  const positions = welded.attributes.position.array as Float32Array;
  const idx = welded.index!.array as Uint32Array | Uint16Array;

  const manMesh = new M.Mesh({
    numProp: 3,
    vertProperties: Float32Array.from(positions),
    triVerts: Uint32Array.from(idx),
  });
  return new M.Manifold(manMesh);
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
