import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { load3MF } from "../../src/lib/loaders/3mf";

function readAsArrayBuffer(path: string): ArrayBuffer {
  const buf = readFileSync(path);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

describe("load3MF", () => {
  it("loads a real 3MF file", async () => {
    const buffer = readAsArrayBuffer("tests/fixtures/sample.3mf");
    const group = await load3MF(buffer as ArrayBuffer, "sample.3mf");
    let hasMesh = false;
    group.traverse((o) => { if ((o as any).isMesh) hasMesh = true; });
    expect(hasMesh).toBe(true);
  });
});
