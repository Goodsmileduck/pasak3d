import { describe, it, expect } from "vitest";
import { readFileSync, statSync } from "fs";
import { detectFormat, SUPPORTED_EXTENSIONS, loadModel } from "../../src/lib/loaders";

function readAsArrayBuffer(path: string): ArrayBuffer {
  const buf = readFileSync(path);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

describe("loader registry", () => {
  it("detects supported formats", () => {
    expect(detectFormat("foo.stl")).toBe("stl");
    expect(detectFormat("foo.OBJ")).toBe("obj");
    expect(detectFormat("foo.3mf")).toBe("3mf");
    expect(detectFormat("foo.glb")).toBe("glb");
    expect(detectFormat("foo.step")).toBeNull();
    expect(detectFormat("foo.unknown")).toBeNull();
  });

  it("exposes mesh-only extension list", () => {
    expect(SUPPORTED_EXTENSIONS).toEqual([".stl", ".obj", ".3mf", ".glb"]);
  });

  it("loadModel routes to the correct loader and returns ModelData", async () => {
    const path = "tests/fixtures/cube.stl";
    const buf = readAsArrayBuffer(path);
    const size = statSync(path).size;
    const data = await loadModel("cube.stl", buf as ArrayBuffer, size);
    expect(data.info.format).toBe("stl");
    expect(data.info.triCount).toBe(12);
    expect(data.group).toBeDefined();
  });
});
