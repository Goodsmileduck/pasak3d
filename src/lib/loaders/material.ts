import * as THREE from "three";

const DEFAULT_ROUGHNESS = 0.35;
const DEFAULT_METALNESS = 0.4;

export function createModelMaterial(
  color: THREE.ColorRepresentation,
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: DEFAULT_ROUGHNESS,
    metalness: DEFAULT_METALNESS,
    side: THREE.DoubleSide,
  });
}
