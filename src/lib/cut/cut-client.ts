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
  const w = getWorker();
  const reqId = nextReqId++;
  const geom = mesh.geometry as THREE.BufferGeometry;
  geom.applyMatrix4(mesh.matrixWorld);
  const indexed = geom.index ? geom : (geom as any).toNonIndexed();
  const positions = new Float32Array(indexed.attributes.position.array);
  const indices = indexed.index
    ? new Uint32Array(indexed.index.array)
    : null;

  const req: CutWorkerRequest = {
    reqId, op: "cut",
    meshGeometry: { positions, indices },
    plane, dowels, tolerance,
  };
  const transfer: ArrayBuffer[] = [positions.buffer];
  if (indices) transfer.push(indices.buffer);

  return new Promise((resolve, reject) => {
    pending.set(reqId, (resp) => {
      if (resp.ok && "partA" in resp) {
        resolve({
          partA: deserialize(resp.partA),
          partB: deserialize(resp.partB),
          dowelPieces: resp.dowelPieces.map(deserialize),
        });
      } else if (!resp.ok) {
        reject(new Error(resp.error));
      } else {
        reject(new Error("Unexpected test-fit response for cut request"));
      }
    });
    w.postMessage(req, transfer);
  });
}

export async function runTestFit(opts: TestFitOpts): Promise<ExportItem[]> {
  const w = getWorker();
  const reqId = nextReqId++;
  const req: CutWorkerRequest = { reqId, op: "testfit", testfit: opts };

  return new Promise((resolve, reject) => {
    pending.set(reqId, (resp) => {
      if (resp.ok && "coupons" in resp) {
        resolve(resp.coupons.map((c) => ({ name: c.name, mesh: deserializeMesh(c.mesh) })));
      } else if (!resp.ok) {
        reject(new Error(resp.error));
      } else {
        reject(new Error("Unexpected cut response for test-fit request"));
      }
    });
    w.postMessage(req);
  });
}

function deserializeMesh(s: SerializedMesh): THREE.Mesh {
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

function deserialize(s: SerializedMesh): THREE.Group {
  const g = new THREE.Group();
  g.add(deserializeMesh(s));
  return g;
}
