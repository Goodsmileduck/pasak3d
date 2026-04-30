import * as THREE from "three";
import { ModelInfo, FileFormat } from "../types";

const KNOWN_FORMATS: Set<string> = new Set<FileFormat>(["stl", "obj", "3mf", "glb"]);

const _v0 = new THREE.Vector3();
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();

export function computeModelInfo(
  group: THREE.Group,
  filename: string,
  fileSize: number,
): ModelInfo {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const format = (KNOWN_FORMATS.has(ext) ? ext : "stl") as FileFormat;

  let triangleCount = 0;

  group.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      const geo = child.geometry as THREE.BufferGeometry;
      const pos = geo.attributes.position;
      if (!pos) return;

      child.updateWorldMatrix(true, false);

      const index = geo.index;
      const triCount = index ? index.count / 3 : pos.count / 3;
      triangleCount += triCount;

      for (let t = 0; t < triCount; t++) {
        const base = t * 3;
        const i0 = index ? index.getX(base) : base;
        const i1 = index ? index.getX(base + 1) : base + 1;
        const i2 = index ? index.getX(base + 2) : base + 2;

        _v0.fromBufferAttribute(pos, i0);
        _v1.fromBufferAttribute(pos, i1);
        _v2.fromBufferAttribute(pos, i2);
      }
    }
  });

  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());

  return {
    filename,
    format,
    fileSize,
    triCount: Math.round(triangleCount),
    bbox: {
      min: [box.min.x, box.min.y, box.min.z],
      max: [box.max.x, box.max.y, box.max.z],
    },
    dimensions: {
      x: size.x,
      y: size.y,
      z: size.z,
    },
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDimension(value: number): string {
  return `${value < 10 ? value.toFixed(3) : value.toFixed(2)} mm`;
}
