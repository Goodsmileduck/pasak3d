import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  emptySession,
  importPart,
  applyCutResult,
  setVisible,
  selectPart,
  setPrinter,
} from "../src/lib/session";

function makeMesh(): { mesh: THREE.Mesh; group: THREE.Group } {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10));
  const group = new THREE.Group();
  group.add(mesh);
  return { mesh, group };
}

describe("session reducer", () => {
  it("imports a part and selects it", () => {
    let s = emptySession();
    const { mesh, group } = makeMesh();
    const r = importPart(s, mesh, group, "Cube");
    s = r.session;
    expect(s.parts.size).toBe(1);
    expect(s.selectedPartId).toBe(r.partId);
    expect(s.parts.get(r.partId)?.meta.name).toBe("Cube");
  });

  it("applyCutResult hides parent and adds A, B, and dowel pieces", () => {
    let s = emptySession();
    const root = makeMesh();
    const r = importPart(s, root.mesh, root.group, "Cube");
    s = r.session;
    const a = makeMesh();
    const b = makeMesh();
    const d = makeMesh();
    s = applyCutResult(
      s,
      r.partId,
      "c1",
      { partA: a, partB: b, dowelPieces: [d] },
      "Cube",
    );
    expect(s.parts.get(r.partId)?.meta.visible).toBe(false);
    expect(s.parts.size).toBe(4); // root + A + B + dowel
    expect(s.selectedPartId).toBe(`${r.partId}_a`);
  });

  it("setVisible toggles", () => {
    let s = emptySession();
    const r = importPart(s, makeMesh().mesh, makeMesh().group, "X");
    s = r.session;
    s = setVisible(s, r.partId, false);
    expect(s.parts.get(r.partId)?.meta.visible).toBe(false);
  });

  it("selectPart updates selection", () => {
    let s = emptySession();
    const r = importPart(s, makeMesh().mesh, makeMesh().group, "X");
    s = r.session;
    s = selectPart(s, null);
    expect(s.selectedPartId).toBeNull();
  });

  it("setPrinter sets the printer", () => {
    let s = emptySession();
    const printer = { id: "p", name: "P", buildVolume: { x: 256, y: 256, z: 256 } };
    s = setPrinter(s, printer);
    expect(s.printer?.id).toBe("p");
    s = setPrinter(s, null);
    expect(s.printer).toBeNull();
  });
});
