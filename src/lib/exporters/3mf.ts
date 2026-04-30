import * as THREE from "three";
import { zipSync } from "fflate";

/** TextEncoder in jsdom returns a jsdom-realm Uint8Array which fflate rejects.
 *  Re-wrapping via the buffer constructor returns one in the current realm. */
function encodeText(str: string): Uint8Array {
  const encoded = new TextEncoder().encode(str);
  return new Uint8Array(encoded.buffer, encoded.byteOffset, encoded.byteLength);
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" />
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" />
</Relationships>`;

interface MeshData {
  positions: Float32Array;
  indices: Uint32Array | Uint16Array | null;
  matrix: THREE.Matrix4;
}

function collectMeshes(group: THREE.Group): MeshData[] {
  const meshes: MeshData[] = [];
  group.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      const geo = child.geometry as THREE.BufferGeometry;
      const pos = geo.getAttribute("position");
      if (!pos) return;
      child.updateWorldMatrix(true, false);
      meshes.push({
        positions: pos.array as Float32Array,
        indices: geo.getIndex()?.array as Uint32Array | Uint16Array | null,
        matrix: child.matrixWorld.clone(),
      });
    }
  });
  return meshes;
}

function buildObjectXml(meshes: MeshData[], startId = 1): { objectsXml: string; itemsXml: string; nextId: number } {
  const objects: string[] = [];
  const items: string[] = [];
  const vec = new THREE.Vector3();
  let id = startId;

  for (const { positions, indices, matrix } of meshes) {
    const vertexLines: string[] = [];
    const vertexCount = positions.length / 3;
    for (let v = 0; v < vertexCount; v++) {
      vec.set(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
      vec.applyMatrix4(matrix);
      vertexLines.push(`        <vertex x="${vec.x}" y="${vec.y}" z="${vec.z}" />`);
    }
    const triangleLines: string[] = [];
    if (indices) {
      for (let t = 0; t < indices.length; t += 3) {
        triangleLines.push(`        <triangle v1="${indices[t]}" v2="${indices[t + 1]}" v3="${indices[t + 2]}" />`);
      }
    } else {
      for (let t = 0; t < vertexCount; t += 3) {
        triangleLines.push(`        <triangle v1="${t}" v2="${t + 1}" v3="${t + 2}" />`);
      }
    }
    objects.push(`    <object id="${id}" type="model">
      <mesh>
        <vertices>
${vertexLines.join("\n")}
        </vertices>
        <triangles>
${triangleLines.join("\n")}
        </triangles>
      </mesh>
    </object>`);
    items.push(`    <item objectid="${id}" />`);
    id++;
  }

  return { objectsXml: objects.join("\n"), itemsXml: items.join("\n"), nextId: id };
}

/** Single-group export — collects all meshes inside the group as separate objects. */
export function export3MF(group: THREE.Group): ArrayBuffer {
  const meshes = collectMeshes(group);
  if (meshes.length === 0) throw new Error("No geometry to export");
  return packageModel(buildModelDoc(meshes));
}

export type Multi3MFItem = { name: string; mesh: THREE.Mesh };

/** Multi-object export — each Mesh becomes its own <object> inside one 3MF. */
export function exportToMulti3MF(items: Multi3MFItem[]): Uint8Array {
  if (items.length === 0) throw new Error("No meshes to export");
  const meshDatas: MeshData[] = items.map(({ mesh }) => {
    const geo = mesh.geometry as THREE.BufferGeometry;
    const pos = geo.getAttribute("position");
    if (!pos) throw new Error("Mesh has no position attribute");
    mesh.updateWorldMatrix(true, false);
    return {
      positions: pos.array as Float32Array,
      indices: geo.getIndex()?.array as Uint32Array | Uint16Array | null,
      matrix: mesh.matrixWorld.clone(),
    };
  });
  const modelXml = buildModelDoc(meshDatas);
  const zipped = zipSync({
    "[Content_Types].xml": encodeText(CONTENT_TYPES),
    "_rels/.rels": encodeText(RELS),
    "3D/3dmodel.model": encodeText(modelXml),
  });
  // Copy into a fresh Uint8Array — zipSync may return a view over a larger pooled buffer
  const copy = new Uint8Array(zipped.byteLength);
  copy.set(zipped);
  return copy;
}

function buildModelDoc(meshes: MeshData[]): string {
  const { objectsXml, itemsXml } = buildObjectXml(meshes);
  return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US"
  xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
${objectsXml}
  </resources>
  <build>
${itemsXml}
  </build>
</model>`;
}

function packageModel(modelXml: string): ArrayBuffer {
  const zipped = zipSync({
    "[Content_Types].xml": encodeText(CONTENT_TYPES),
    "_rels/.rels": encodeText(RELS),
    "3D/3dmodel.model": encodeText(modelXml),
  });
  const copy = new Uint8Array(zipped.byteLength);
  copy.set(zipped);
  return copy.buffer;
}
