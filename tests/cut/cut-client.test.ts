import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { initManifold } from "../../src/lib/cut/manifold";
import { manifoldToMesh } from "../../src/lib/cut/convert";
import { planeCutMesh } from "../../src/lib/cut/plane-cut";
import { applyDowels } from "../../src/lib/cut/dowel-apply";

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
});
