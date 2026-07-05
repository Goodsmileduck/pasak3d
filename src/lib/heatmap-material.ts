import * as THREE from "three";

/**
 * A MeshStandardMaterial that colors each fragment by overhang severity (Z up).
 * The GLSL ramp MUST match `severityColor` in overhang.ts (green->amber->red).
 */
export function makeHeatmapMaterial(thresholdDeg: number): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0 });
  const uniforms = { uThreshold: { value: thresholdDeg } };

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uThreshold = uniforms.uThreshold;
    shader.vertexShader = "varying vec3 vNormalW;\n" + shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\n  vNormalW = normalize(mat3(modelMatrix) * normal);",
    );
    shader.fragmentShader = "uniform float uThreshold;\nvarying vec3 vNormalW;\n" + shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      float angFromUp = degrees(acos(clamp(vNormalW.z, -1.0, 1.0)));
      float overhang = angFromUp - 90.0;                 // >0 => down-facing
      float sev = clamp(overhang / max(90.0 - uThreshold, 1.0), 0.0, 1.0);
      vec3 safeCol = vec3(0.20, 0.72, 0.36);
      vec3 midCol  = vec3(0.96, 0.62, 0.10);
      vec3 hotCol  = vec3(0.90, 0.15, 0.15);
      vec3 ramp = sev < 0.5 ? mix(safeCol, midCol, sev * 2.0) : mix(midCol, hotCol, (sev - 0.5) * 2.0);
      diffuseColor.rgb = ramp;`,
    );
  };

  mat.userData.uniforms = uniforms;
  mat.userData.setThreshold = (deg: number) => { uniforms.uThreshold.value = deg; };
  return mat;
}
