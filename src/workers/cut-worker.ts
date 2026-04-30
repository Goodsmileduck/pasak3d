import * as THREE from "three";
import { initManifold } from "../lib/cut/manifold";
import { planeCutMesh } from "../lib/cut/plane-cut";
import { applyDowels } from "../lib/cut/dowel-apply";
import type { CutPlaneSpec, Dowel, TolerancePreset } from "../types";
import { TOLERANCE_VALUES } from "../types";

export type SerializedMesh = { positions: Float32Array; indices: Uint32Array };

export type CutWorkerRequest = {
  reqId: number;
  op: "cut";
  meshGeometry: { positions: Float32Array; indices: Uint32Array | null };
  plane: CutPlaneSpec;
  dowels: Dowel[];
  tolerance: TolerancePreset;
};

export type CutWorkerResponse =
  | { reqId: number; ok: true; partA: SerializedMesh; partB: SerializedMesh; dowelPieces: SerializedMesh[] }
  | { reqId: number; ok: false; error: string };

self.onmessage = async (e: MessageEvent<CutWorkerRequest>) => {
  const { reqId, plane, dowels, tolerance, meshGeometry } = e.data;
  try {
    const M = await initManifold();
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(meshGeometry.positions, 3));
    if (meshGeometry.indices) geom.setIndex(new THREE.BufferAttribute(meshGeometry.indices, 1));
    const mesh = new THREE.Mesh(geom);

    const cut = await planeCutMesh(M, mesh, plane);
    const tolValue = TOLERANCE_VALUES[tolerance];
    const result = applyDowels(M, cut.partA.manifold, cut.partB.manifold, dowels, tolValue);

    const partA = serialize(result.partA);
    const partB = serialize(result.partB);
    const dowelPieces = result.dowelPieces.map(serialize);

    // Cleanup: input manifolds may have been replaced by applyDowels
    if (result.partA !== cut.partA.manifold) cut.partA.manifold.delete();
    if (result.partB !== cut.partB.manifold) cut.partB.manifold.delete();
    result.partA.delete();
    result.partB.delete();
    for (const p of result.dowelPieces) p.delete();

    const transfer: ArrayBuffer[] = [
      partA.positions.buffer as ArrayBuffer, partA.indices.buffer as ArrayBuffer,
      partB.positions.buffer as ArrayBuffer, partB.indices.buffer as ArrayBuffer,
      ...dowelPieces.flatMap((d) => [d.positions.buffer as ArrayBuffer, d.indices.buffer as ArrayBuffer]),
    ];
    (self as any).postMessage({ reqId, ok: true, partA, partB, dowelPieces } satisfies CutWorkerResponse, transfer);
  } catch (err: any) {
    (self as any).postMessage({ reqId, ok: false, error: err?.message ?? String(err) } satisfies CutWorkerResponse);
  }
};

function serialize(man: any): SerializedMesh {
  const m = man.getMesh();
  return {
    positions: new Float32Array(m.vertProperties),
    indices: new Uint32Array(m.triVerts),
  };
}
