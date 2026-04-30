import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { loadSTL } from "../../src/lib/loaders/stl";

function readAsArrayBuffer(path: string): ArrayBuffer {
  const buf = readFileSync(path);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

describe("loadSTL", () => {
  it("loads a binary STL of a cube", async () => {
    const buffer = readAsArrayBuffer("tests/fixtures/cube.stl");
    const group = await loadSTL(buffer as ArrayBuffer, "cube.stl");
    expect(group).toBeDefined();
    let triCount = 0;
    group.traverse((obj) => {
      if ((obj as any).isMesh) {
        const idx = (obj as any).geometry.index;
        const pos = (obj as any).geometry.attributes.position;
        triCount += idx ? idx.count / 3 : pos.count / 3;
      }
    });
    expect(triCount).toBe(12);
  });
});
