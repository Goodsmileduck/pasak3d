import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { makeHeatmapMaterial } from "../src/lib/heatmap-material";

describe("makeHeatmapMaterial", () => {
  it("is a MeshStandardMaterial carrying a live threshold uniform", () => {
    const m = makeHeatmapMaterial(45);
    expect(m).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(m.userData.uniforms.uThreshold.value).toBe(45);
    (m.userData.setThreshold as (d: number) => void)(30);
    expect(m.userData.uniforms.uThreshold.value).toBe(30);
  });
  it("patches the shaders on compile (injects vNormalW + uThreshold)", () => {
    const m = makeHeatmapMaterial(45);
    const shader: any = { uniforms: {}, vertexShader: "#include <begin_vertex>", fragmentShader: "#include <color_fragment>" };
    (m.onBeforeCompile as any)(shader);
    expect(shader.vertexShader).toContain("vNormalW");
    expect(shader.fragmentShader).toContain("uThreshold");
    expect(shader.uniforms.uThreshold).toBe(m.userData.uniforms.uThreshold);
  });
});
