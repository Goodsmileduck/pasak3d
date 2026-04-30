import type { WorkerMeshData, ParserProgressFn } from "../../types";

export function parseSTL(
  buffer: ArrayBuffer,
  onProgress?: ParserProgressFn,
): WorkerMeshData[] {
  return [
    isSTLBinary(buffer)
      ? parseSTLBinary(buffer, onProgress)
      : parseSTLAscii(buffer, onProgress),
  ];
}

function isSTLBinary(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 84) return false;
  const view = new DataView(buffer);
  const count = view.getUint32(80, true);
  const expected = 84 + count * 50;
  return buffer.byteLength >= expected && buffer.byteLength < expected + 100;
}

function parseSTLBinary(
  buffer: ArrayBuffer,
  onProgress?: ParserProgressFn,
): WorkerMeshData {
  const view = new DataView(buffer);
  const count = view.getUint32(80, true);
  const vertices = new Float32Array(count * 9);
  const indices = new Uint32Array(count * 3);
  const step = Math.max(1, Math.floor(count * 0.05));

  let offset = 84;
  for (let i = 0; i < count; i++) {
    offset += 12; // skip face normal
    for (let v = 0; v < 9; v++) {
      vertices[i * 9 + v] = view.getFloat32(offset, true);
      offset += 4;
    }
    offset += 2; // skip attribute byte count
    indices[i * 3] = i * 3;
    indices[i * 3 + 1] = i * 3 + 1;
    indices[i * 3 + 2] = i * 3 + 2;

    if (onProgress && (i + 1) % step === 0) {
      onProgress(i + 1, count);
    }
  }
  if (onProgress) onProgress(count, count);

  return { vertices, normals: new Float32Array(0), indices };
}

function parseSTLAscii(
  buffer: ArrayBuffer,
  onProgress?: ParserProgressFn,
): WorkerMeshData {
  const text = new TextDecoder().decode(buffer);
  const totalLen = text.length;
  const step = Math.max(1, Math.floor(totalLen * 0.05));
  let lastReport = 0;

  const verts: number[] = [];
  const re = /vertex\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    verts.push(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]));
    if (onProgress && re.lastIndex - lastReport >= step) {
      onProgress(re.lastIndex, totalLen);
      lastReport = re.lastIndex;
    }
  }
  if (onProgress) onProgress(totalLen, totalLen);

  const vertices = new Float32Array(verts);
  const indices = new Uint32Array(vertices.length / 3);
  for (let i = 0; i < indices.length; i++) indices[i] = i;

  return { vertices, normals: new Float32Array(0), indices };
}
