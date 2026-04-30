import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { unzipSync, strFromU8 } from "fflate";
import { buildZipExport } from "../../src/lib/exporters/zip-export";

describe("buildZipExport", () => {
  it("packages parts and dowels into a zip", () => {
    const parts = [
      { name: "part-A.stl", mesh: new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10)) },
      { name: "part-B.stl", mesh: new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10)) },
    ];
    const dowels = [
      { name: "dowels_5x20mm_qty4.stl", mesh: new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 20)) },
    ];
    const zipped = buildZipExport(parts, dowels);
    const entries = unzipSync(zipped);
    expect(Object.keys(entries).sort()).toEqual([
      "README.txt",
      "dowels/dowels_5x20mm_qty4.stl",
      "parts/part-A.stl",
      "parts/part-B.stl",
    ].sort());
    expect(strFromU8(entries["README.txt"])).toMatch(/Pasak/);
  });
});
