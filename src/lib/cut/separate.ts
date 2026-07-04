import * as THREE from "three";
import { meshToManifold } from "./convert";

/** Split a mesh into connected-component manifolds. Caller serializes and deletes the results. */
export function separateComponents(M: any, mesh: THREE.Mesh): any[] {
  const man = meshToManifold(M, mesh);
  const parts = man.decompose();
  man.delete();
  return parts;
}
