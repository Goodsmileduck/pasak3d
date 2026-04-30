import type { WorkerMeshData, ParserProgressFn } from "../../types";

export function parseOBJ(
  buffer: ArrayBuffer,
  onProgress?: ParserProgressFn,
): WorkerMeshData[] {
  const text = new TextDecoder().decode(buffer);
  const lines = text.split("\n");
  const totalLines = lines.length;
  const step = Math.max(1, Math.floor(totalLines * 0.05));

  const positions: number[] = [];
  const normals: number[] = [];
  const outVerts: number[] = [];
  const outNormals: number[] = [];
  const outIndices: number[] = [];
  let vertIdx = 0;

  for (let li = 0; li < totalLines; li++) {
    const line = lines[li].trim();
    if (line.length === 0 || line[0] === "#") continue;

    if (line.startsWith("v ")) {
      const p = line.split(/\s+/);
      positions.push(+p[1], +p[2], +p[3]);
    } else if (line.startsWith("vn ")) {
      const p = line.split(/\s+/);
      normals.push(+p[1], +p[2], +p[3]);
    } else if (line.startsWith("f ")) {
      const parts = line.split(/\s+/).slice(1);
      const face: number[] = [];

      for (const part of parts) {
        const segs = part.split("/");
        let vi = parseInt(segs[0], 10);
        vi = vi > 0 ? vi - 1 : positions.length / 3 + vi;

        outVerts.push(
          positions[vi * 3],
          positions[vi * 3 + 1],
          positions[vi * 3 + 2],
        );

        if (segs.length >= 3 && segs[2] !== "") {
          let ni = parseInt(segs[2], 10);
          ni = ni > 0 ? ni - 1 : normals.length / 3 + ni;
          outNormals.push(
            normals[ni * 3],
            normals[ni * 3 + 1],
            normals[ni * 3 + 2],
          );
        }

        face.push(vertIdx++);
      }

      // Fan triangulation for convex polygons
      for (let i = 1; i < face.length - 1; i++) {
        outIndices.push(face[0], face[i], face[i + 1]);
      }
    }

    if (onProgress && (li + 1) % step === 0) {
      onProgress(li + 1, totalLines);
    }
  }
  if (onProgress) onProgress(totalLines, totalLines);

  return [
    {
      vertices: new Float32Array(outVerts),
      normals:
        outNormals.length > 0
          ? new Float32Array(outNormals)
          : new Float32Array(0),
      indices: new Uint32Array(outIndices),
    },
  ];
}
