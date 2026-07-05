import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { applyHeatmap, clearHeatmap } from "../src/lib/heatmap-apply";

function meshGroup(): { group: THREE.Group; mesh: THREE.Mesh; orig: THREE.Material } {
  const orig = new THREE.MeshStandardMaterial({ color: 0x3b82f6 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), orig);
  const group = new THREE.Group();
  group.add(mesh);
  return { group, mesh, orig };
}

describe("applyHeatmap / clearHeatmap", () => {
  it("swaps to the heatmap material and restores the original", () => {
    const { group, mesh, orig } = meshGroup();
    const heat = new THREE.MeshStandardMaterial();
    applyHeatmap(group, heat);
    expect(mesh.material).toBe(heat);
    clearHeatmap(group);
    expect(mesh.material).toBe(orig);
  });
  it("double-apply keeps the true original", () => {
    const { group, mesh, orig } = meshGroup();
    applyHeatmap(group, new THREE.MeshStandardMaterial());
    applyHeatmap(group, new THREE.MeshStandardMaterial());
    clearHeatmap(group);
    expect(mesh.material).toBe(orig);
  });
});
