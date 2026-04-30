import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { loadGLB } from "../../src/lib/loaders/glb";

function readAsArrayBuffer(path: string): ArrayBuffer {
  const buf = readFileSync(path);
  // Copy into a fresh ArrayBuffer so instanceof checks work in jsdom (cross-realm issue)
  const ab = new ArrayBuffer(buf.byteLength);
  new Uint8Array(ab).set(buf);
  return ab;
}

describe("loadGLB", () => {
  it("loads a GLB cube", async () => {
    const buffer = readAsArrayBuffer("tests/fixtures/cube.glb");
    const group = await loadGLB(buffer as ArrayBuffer, "cube.glb");
    let hasMesh = false;
    group.traverse((o) => { if ((o as any).isMesh) hasMesh = true; });
    expect(hasMesh).toBe(true);
  });
});
