import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { exportToMulti3MF } from "../../src/lib/exporters/3mf";
import { load3MF } from "../../src/lib/loaders/3mf";

describe("exportToMulti3MF", () => {
  it("round-trips two cubes through 3MF", async () => {
    const a = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10));
    const b = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 5));
    b.position.set(20, 0, 0);
    b.updateMatrix();
    const buf = exportToMulti3MF([
      { name: "A", mesh: a },
      { name: "B", mesh: b },
    ]);
    expect(buf.byteLength).toBeGreaterThan(0);

    const arrayBuffer = new ArrayBuffer(buf.byteLength);
    new Uint8Array(arrayBuffer).set(buf);
    const reloaded = await load3MF(arrayBuffer, "test.3mf");
    let count = 0;
    reloaded.traverse((o) => {
      if ((o as { isMesh?: boolean }).isMesh) count++;
    });
    expect(count).toBeGreaterThanOrEqual(2);
  });
});
