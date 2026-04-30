import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { loadOBJ } from "../../src/lib/loaders/obj";

function readAsArrayBuffer(path: string): ArrayBuffer {
  const buf = readFileSync(path);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

describe("loadOBJ", () => {
  it("loads an OBJ cube", async () => {
    const buffer = readAsArrayBuffer("tests/fixtures/cube.obj");
    const group = await loadOBJ(buffer as ArrayBuffer, "cube.obj");
    let hasMesh = false;
    group.traverse((o) => { if ((o as any).isMesh) hasMesh = true; });
    expect(hasMesh).toBe(true);
  });
});
