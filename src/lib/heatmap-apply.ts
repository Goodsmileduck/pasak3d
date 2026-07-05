import * as THREE from "three";

export function applyHeatmap(group: THREE.Object3D, material: THREE.Material): void {
  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!(mesh as any).isMesh) return;
    if (mesh.userData.origMaterial === undefined) mesh.userData.origMaterial = mesh.material;
    mesh.material = material;
  });
}

export function clearHeatmap(group: THREE.Object3D): void {
  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!(mesh as any).isMesh) return;
    if (mesh.userData.origMaterial !== undefined) {
      mesh.material = mesh.userData.origMaterial as THREE.Material | THREE.Material[];
      delete mesh.userData.origMaterial;
    }
  });
}
