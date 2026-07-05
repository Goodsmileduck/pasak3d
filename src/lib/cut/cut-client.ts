import * as THREE from "three";
import type { CutPlaneSpec, Dowel, TolerancePreset } from "../../types";
import type { TestFitOpts } from "./test-fit";
import type { CutWorkerRequest, CutWorkerResponse, SerializedMesh } from "../../workers/cut-worker";
import type { ExportItem } from "../exporters/zip-export";
import { createModelMaterial } from "../loaders/material";

let worker: Worker | null = null;
let nextReqId = 1;
const pending = new Map<number, (r: CutWorkerResponse) => void>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("../../workers/cut-worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<CutWorkerResponse>) => {
      const cb = pending.get(e.data.reqId);
      if (cb) {
        pending.delete(e.data.reqId);
        cb(e.data);
      }
    };
  }
  return worker;
}

export type CutClientResult = {
  partA: THREE.Group;
  partB: THREE.Group;
  dowelPieces: THREE.Group[];
};

export async function runCut(
  mesh: THREE.Mesh,
  plane: CutPlaneSpec,
  dowels: Dowel[],
  tolerance: TolerancePreset,
): Promise<CutClientResult> {
  const reqId = nextReqId++;
  const { meshGeometry, transfer } = serializeMeshForWorker(mesh);

  const req: CutWorkerRequest = {
    reqId, op: "cut",
    meshGeometry,
    plane, dowels, tolerance,
  };
  return submit(req, transfer, (resp) => {
    if ("partA" in resp) {
      return {
        partA: deserialize(resp.partA),
        partB: deserialize(resp.partB),
        dowelPieces: resp.dowelPieces.map(deserialize),
      };
    }
    throw new Error("Unexpected test-fit response for cut request");
  });
}

export async function runTestFit(opts: TestFitOpts): Promise<ExportItem[]> {
  const reqId = nextReqId++;
  const req: CutWorkerRequest = { reqId, op: "testfit", testfit: opts };

  return submit(req, [], (resp) => {
    if ("coupons" in resp) {
      return hydrateCoupons(resp.coupons);
    }
    throw new Error("Unexpected cut response for test-fit request");
  });
}

export async function runConnectorTestFit(connectorId: string, opts: TestFitOpts): Promise<ExportItem[]> {
  const reqId = nextReqId++;
  const req: CutWorkerRequest = { reqId, op: "testfit", testfit: { ...opts, connectorId } };

  return submit(req, [], (resp) => {
    if ("coupons" in resp) {
      return hydrateCoupons(resp.coupons);
    }
    throw new Error("Unexpected cut response for connector test-fit request");
  });
}

export async function runSeparate(mesh: THREE.Mesh): Promise<THREE.Group[]> {
  const reqId = nextReqId++;
  const { meshGeometry, transfer } = serializeMeshForWorker(mesh);
  const req: CutWorkerRequest = { reqId, op: "separate", meshGeometry };

  return submit(req, transfer, (resp) => {
    if ("components" in resp) {
      return resp.components.map(deserialize);
    }
    throw new Error("Unexpected cut response for separate request");
  });
}

export async function runLabel(
  mesh: THREE.Mesh,
  spec: {
    text: string;
    mode: "emboss" | "deboss";
    size?: number;
    depth?: number;
    position: [number, number, number];
    axis: [number, number, number];
  },
): Promise<THREE.Group> {
  const reqId = nextReqId++;
  const { meshGeometry, transfer } = serializeMeshForWorker(mesh);
  const req: CutWorkerRequest = { reqId, op: "label", meshGeometry, label: spec };

  return submit(req, transfer, (resp) => {
    if ("labeled" in resp) {
      return deserialize(resp.labeled);
    }
    throw new Error("Unexpected cut response for label request");
  });
}

function serializeMeshForWorker(mesh: THREE.Mesh): {
  meshGeometry: { positions: Float32Array; indices: Uint32Array | null };
  transfer: ArrayBuffer[];
} {
  // Clone before baking matrixWorld — the session mesh may still be visible and
  // reused (separate/label leave it in the tree) and its group can carry an
  // explode/centering transform. Mutating it in place would permanently bake that
  // offset into the shared geometry, which undo (aliased snapshots) can't recover.
  const geom = (mesh.geometry as THREE.BufferGeometry).clone();
  geom.applyMatrix4(mesh.matrixWorld);
  const indexed = geom.index ? geom : (geom as any).toNonIndexed();
  const positions = new Float32Array(indexed.attributes.position.array);
  const indices = indexed.index
    ? new Uint32Array(indexed.index.array)
    : null;
  const transfer: ArrayBuffer[] = [positions.buffer];
  if (indices) transfer.push(indices.buffer);
  return { meshGeometry: { positions, indices }, transfer };
}

function submit<T>(
  req: CutWorkerRequest,
  transfer: ArrayBuffer[],
  pick: (resp: Extract<CutWorkerResponse, { ok: true }>) => T,
): Promise<T> {
  const w = getWorker();
  return new Promise((resolve, reject) => {
    pending.set(req.reqId, (resp) => {
      if (!resp.ok) {
        reject(new Error(resp.error));
        return;
      }
      try {
        resolve(pick(resp));
      } catch (err) {
        reject(err);
      }
    });
    try {
      if (transfer.length > 0) w.postMessage(req, transfer);
      else w.postMessage(req);
    } catch (err) {
      pending.delete(req.reqId);
      reject(err);
    }
  });
}

export function deserializeMesh(s: SerializedMesh): THREE.Mesh {
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(s.positions, 3));
  geom.setIndex(new THREE.BufferAttribute(s.indices, 1));
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  // Default neutral color — useCutSession overwrites material.color from RuntimePart.meta.color
  // once the session reducer assigns palette colors to each new part.
  const m = new THREE.Mesh(geom, createModelMaterial(0xcccccc));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function hydrateCoupons(coupons: { name: string; mesh: SerializedMesh }[]): ExportItem[] {
  return coupons.map((c) => ({ name: c.name, mesh: deserializeMesh(c.mesh) }));
}

export function deserialize(s: SerializedMesh): THREE.Group {
  const g = new THREE.Group();
  g.add(deserializeMesh(s));
  return g;
}
