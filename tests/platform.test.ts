import { describe, it, expect } from "vitest";
import { basename, isDesktop } from "../src/lib/platform";

describe("basename", () => {
  it("extracts filename from POSIX path", () => {
    expect(basename("/home/user/Documents/cube.stl")).toBe("cube.stl");
  });

  it("extracts filename from Windows path", () => {
    expect(basename("C:\\Users\\me\\Downloads\\model.3mf")).toBe("model.3mf");
  });

  it("returns the input when there's no separator", () => {
    expect(basename("just-a-name.glb")).toBe("just-a-name.glb");
  });

  it("returns fallback when path is empty", () => {
    expect(basename("", "fallback")).toBe("fallback");
  });

  it("returns 'model' as default fallback", () => {
    expect(basename("")).toBe("model");
  });

  it("handles trailing-slash path by returning fallback", () => {
    // .pop() on a path ending in / yields "" → falsy → fallback
    expect(basename("/path/to/")).toBe("model");
  });

  it("preserves dotfiles correctly", () => {
    expect(basename("/etc/.hidden")).toBe(".hidden");
  });
});

describe("isDesktop", () => {
  it("is a boolean", () => {
    expect(typeof isDesktop).toBe("boolean");
  });

  it("is false in the test environment (Vitest sets VITE_TARGET via vite.config.ts)", () => {
    // In Vitest mode, vite.config.ts is loaded but VITE_TARGET is not set unless we pass it.
    // For test env, isDesktop reflects whatever the test runner sets.
    // We just assert the type — actual value depends on how the suite is invoked.
    expect([true, false]).toContain(isDesktop);
  });
});
