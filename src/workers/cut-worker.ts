import * as THREE from "three";
import { initManifold } from "../lib/cut/manifold";
import { meshToManifold } from "../lib/cut/convert";
import { planeCutMesh } from "../lib/cut/plane-cut";
import { separateComponents } from "../lib/cut/separate";
import { applyConnectors } from "../lib/cut/connectors/apply";
import { applySeamLabel } from "../lib/cut/joints/labels";
import { generateTestFitPairs, type TestFitOpts } from "../lib/cut/test-fit";
import type { CutPlaneSpec, Joint, TolerancePreset } from "../types";

export type SerializedMesh = { positions: Float32Array; indices: Uint32Array };

export type CutWorkerRequest =
  | {
      reqId: number;
      op: "cut";
      meshGeometry: { positions: Float32Array; indices: Uint32Array | null };
      plane: CutPlaneSpec;
      dowels: Joint[];
      tolerance: TolerancePreset;
    }
  | {
      reqId: number;
      op: "testfit";
      testfit: TestFitOpts;
    }
  | {
      reqId: number;
      op: "separate";
      meshGeometry: { positions: Float32Array; indices: Uint32Array | null };
    }
  | {
      reqId: number;
      op: "label";
      meshGeometry: { positions: Float32Array; indices: Uint32Array | null };
      label: {
        text: string;
        mode: "emboss" | "deboss";
        size?: number;
        depth?: number;
        position: [number, number, number];
        axis: [number, number, number];
      };
    };

export type CutWorkerResponse =
  | { reqId: number; ok: true; partA: SerializedMesh; partB: SerializedMesh; dowelPieces: SerializedMesh[] }
  | { reqId: number; ok: true; coupons: { name: string; mesh: SerializedMesh }[] }
  | { reqId: number; ok: true; components: SerializedMesh[] }
  | { reqId: number; ok: true; labeled: SerializedMesh }
  | { reqId: number; ok: false; error: string };

let workerManifoldPromise: Promise<any> | null = null;

function getWorkerManifold(): Promise<any> {
  if (!workerManifoldPromise) {
    workerManifoldPromise = initManifold().then((M) => {
      M.setCircularSegments(128);
      return M;
    });
  }
  return workerManifoldPromise;
}

self.onmessage = async (e: MessageEvent<CutWorkerRequest>) => {
  const { reqId } = e.data;
  try {
    const M = await getWorkerManifold();
    if (e.data.op === "testfit") {
      const pairs = generateTestFitPairs(M, e.data.testfit);
      const couponManifolds = pairs.flatMap((p) => [
        { name: p.maleName, manifold: p.male },
        { name: p.femaleName, manifold: p.female },
      ]);
      const { meshes, transfer } = serializeAll(couponManifolds.map((c) => c.manifold));
      const coupons = couponManifolds.map((c, i) => ({ name: c.name, mesh: meshes[i] }));
      for (const p of pairs) {
        p.male.delete();
        p.female.delete();
      }
      (self as any).postMessage({ reqId, ok: true, coupons } satisfies CutWorkerResponse, transfer);
      return;
    }

    const mesh = meshFromSerializedGeometry(e.data.meshGeometry);

    if (e.data.op === "separate") {
      const comps = separateComponents(M, mesh);
      try {
        const { meshes: components, transfer } = serializeAll(comps);
        (self as any).postMessage({ reqId, ok: true, components } satisfies CutWorkerResponse, transfer);
      } finally {
        for (const c of comps) c.delete();
      }
      return;
    }

    if (e.data.op === "label") {
      const man = meshToManifold(M, mesh);
      const labeled = applySeamLabel(
        M,
        man,
        e.data.label.text,
        e.data.label,
        e.data.label.position,
        e.data.label.axis,
      );
      try {
        const { meshes, transfer } = serializeAll([labeled]);
        (self as any).postMessage({ reqId, ok: true, labeled: meshes[0] } satisfies CutWorkerResponse, transfer);
      } finally {
        man.delete();
        labeled.delete();
      }
      return;
    }

    const { plane, dowels, tolerance } = e.data;

    const cut = await planeCutMesh(M, mesh, plane);
    const result = applyConnectors(M, cut.partA.manifold, cut.partB.manifold, dowels, tolerance);

    const { meshes, transfer } = serializeAll([result.partA, result.partB, ...result.jointPieces]);
    const [partA, partB, ...dowelPieces] = meshes;

    // Cleanup: input manifolds may have been replaced by applyConnectors.
    if (result.partA !== cut.partA.manifold) cut.partA.manifold.delete();
    if (result.partB !== cut.partB.manifold) cut.partB.manifold.delete();
    result.partA.delete();
    result.partB.delete();
    for (const p of result.jointPieces) p.delete();

    (self as any).postMessage({ reqId, ok: true, partA, partB, dowelPieces } satisfies CutWorkerResponse, transfer);
  } catch (err: any) {
    (self as any).postMessage({ reqId, ok: false, error: err?.message ?? String(err) } satisfies CutWorkerResponse);
  }
};

function meshFromSerializedGeometry(meshGeometry: { positions: Float32Array; indices: Uint32Array | null }): THREE.Mesh {
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(meshGeometry.positions, 3));
  if (meshGeometry.indices) geom.setIndex(new THREE.BufferAttribute(meshGeometry.indices, 1));
  return new THREE.Mesh(geom);
}

function serializeAll(manifolds: any[]): { meshes: SerializedMesh[]; transfer: ArrayBuffer[] } {
  const meshes = manifolds.map(serialize);
  return {
    meshes,
    transfer: meshes.flatMap((m) => [
      m.positions.buffer as ArrayBuffer,
      m.indices.buffer as ArrayBuffer,
    ]),
  };
}

function serialize(man: any): SerializedMesh {
  const m = man.getMesh();
  return {
    positions: new Float32Array(m.vertProperties),
    indices: new Uint32Array(m.triVerts),
  };
}
