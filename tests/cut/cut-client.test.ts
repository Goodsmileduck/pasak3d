import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { initManifold } from "../../src/lib/cut/manifold";
import { manifoldToMesh } from "../../src/lib/cut/convert";
import { planeCutMesh } from "../../src/lib/cut/plane-cut";
import { applyDowels } from "../../src/lib/cut/dowel-apply";
import { runTestFit } from "../../src/lib/cut/cut-client";
import { generateTestFitPairs } from "../../src/lib/cut/test-fit";
import type { CutWorkerRequest, CutWorkerResponse, SerializedMesh } from "../../src/workers/cut-worker";

function serialize(man: any): SerializedMesh {
  const m = man.getMesh();
  return {
    positions: new Float32Array(m.vertProperties),
    indices: new Uint32Array(m.triVerts),
  };
}

class TestFitWorker {
  onmessage: ((e: MessageEvent<CutWorkerResponse>) => void) | null = null;

  constructor(..._args: unknown[]) {}

  postMessage(req: CutWorkerRequest): void {
    void this.respond(req);
  }

  private async respond(req: CutWorkerRequest): Promise<void> {
    if (req.op !== "testfit") throw new Error("TestFitWorker only handles testfit requests");
    const M = await initManifold();
    const pairs = generateTestFitPairs(M, req.testfit);
    const coupons = pairs.flatMap((p) => [
      { name: p.maleName, mesh: serialize(p.male) },
      { name: p.femaleName, mesh: serialize(p.female) },
    ]);
    pairs.forEach((p) => { p.male.delete(); p.female.delete(); });
    this.onmessage?.({ data: { reqId: req.reqId, ok: true, coupons } } as MessageEvent<CutWorkerResponse>);
  }
}

describe("cut pipeline (in-process equivalent of worker)", () => {
  it("produces two halves and one dowel piece for a cube cut at X=0", async () => {
    const M = await initManifold();
    const geom = new THREE.BoxGeometry(10, 10, 10);
    const mesh = new THREE.Mesh(geom);
    const cut = await planeCutMesh(M, mesh, { normal: [1, 0, 0], constant: 0, axisSnap: "x" });
    const result = applyDowels(M, cut.partA.manifold, cut.partB.manifold, [{
      id: "d1", position: [0, 0, 0], axis: [1, 0, 0], diameter: 4, length: 10, source: "auto",
    }], 0.10);
    expect(result.dowelPieces.length).toBe(1);
    expect(result.partA.volume()).toBeLessThan(500);
    expect(result.partB.volume()).toBeLessThan(500);

    const groupA = manifoldToMesh(result.partA);
    expect(groupA.children.length).toBe(1);

    if (result.partA !== cut.partA.manifold) cut.partA.manifold.delete();
    if (result.partB !== cut.partB.manifold) cut.partB.manifold.delete();
    result.partA.delete();
    result.partB.delete();
    for (const p of result.dowelPieces) p.delete();
  });

  it("runs a cut with a cube joint and returns parts + one peg", async () => {
    const M = await initManifold();
    const geom = new THREE.BoxGeometry(10, 10, 10);
    const mesh = new THREE.Mesh(geom);
    const cut = await planeCutMesh(M, mesh, { normal: [0, 0, 1], constant: 0, axisSnap: "z" });
    const result = applyDowels(M, cut.partA.manifold, cut.partB.manifold, [{
      id: "j", position: [0, 0, 0], axis: [0, 0, 1], diameter: 4, length: 8,
      source: "auto", shape: "cube", polarity: "separate-peg",
    }], 0.10);
    expect(result.partA).toBeDefined();
    expect(result.dowelPieces.length).toBe(1);
    expect(result.dowelPieces[0].volume()).toBeCloseTo(4 * 4 * 8, 3);

    if (result.partA !== cut.partA.manifold) cut.partA.manifold.delete();
    if (result.partB !== cut.partB.manifold) cut.partB.manifold.delete();
    result.partA.delete();
    result.partB.delete();
    for (const p of result.dowelPieces) p.delete();
  });

  it("runTestFit returns hydrated coupon meshes named A/B", async () => {
    vi.stubGlobal("Worker", TestFitWorker);
    const items = await runTestFit({
      count: 2, step: 0.05, baseClearance: 0.1, cubeSize: 12, keyDepth: 5, keyWidth: 6, shape: "cylinder",
    });
    expect(items.length).toBe(4);
    expect(items.some((i) => i.name.endsWith("_A.stl"))).toBe(true);
    expect(items.some((i) => i.name.endsWith("_B.stl"))).toBe(true);
    vi.unstubAllGlobals();
  });
});
