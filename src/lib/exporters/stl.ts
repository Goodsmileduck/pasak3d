import * as THREE from "three";
import { STLExporter } from "three/addons/exporters/STLExporter.js";

/**
 * Export a mesh (or group) to STL format.
 * @param mesh - The mesh or object to export
 * @param mode - "binary" (default) or "ascii"
 * @returns ArrayBuffer containing the STL data
 */
export function exportToSTL(mesh: THREE.Mesh | THREE.Group, mode: "binary" | "ascii" = "binary"): ArrayBuffer {
  const exporter = new STLExporter();

  // Wrap mesh in a group if it's not already a group
  let exportTarget: THREE.Object3D;
  if (mesh instanceof THREE.Group) {
    exportTarget = mesh;
  } else {
    const group = new THREE.Group();
    group.add(mesh);
    exportTarget = group;
  }

  if (mode === "ascii") {
    const str = exporter.parse(exportTarget, { binary: false }) as string;
    const encoder = new TextEncoder();
    return encoder.encode(str).buffer as ArrayBuffer;
  }

  const view = exporter.parse(exportTarget, { binary: true }) as unknown as DataView;
  return view.buffer as ArrayBuffer;
}
