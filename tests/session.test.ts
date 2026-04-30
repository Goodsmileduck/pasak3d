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

  it("emptySession produces a fresh, independent session each call", () => {
    const a = emptySession();
    const b = emptySession();
    expect(a).not.toBe(b);
    expect(a.parts).not.toBe(b.parts);
    expect(a.cuts).not.toBe(b.cuts);
  });

  it("clones state on each operation (immutable updates)", () => {
    let s1 = emptySession();
    const r = importPart(s1, makeMesh().mesh, makeMesh().group, "X");
    const s2 = r.session;
    expect(s2).not.toBe(s1);
    expect(s2.parts).not.toBe(s1.parts);
    expect(s1.parts.size).toBe(0); // original is unchanged
    expect(s2.parts.size).toBe(1);
  });

  it("setVisible on a missing part is a no-op (does not throw)", () => {
    let s = emptySession();
    expect(() => { s = setVisible(s, "p_missing", false); }).not.toThrow();
    expect(s.parts.size).toBe(0);
  });

  it("multi-cut: cutting Body-A produces grandchildren with correct lineage", () => {
    let s = emptySession();
    const r = importPart(s, makeMesh().mesh, makeMesh().group, "Body");
    s = r.session;
    s = applyCutResult(s, r.partId, "c1", {
      partA: makeMesh(), partB: makeMesh(), dowelPieces: [],
    }, "Body");
    const aId = `${r.partId}_a`;
    expect(s.parts.get(aId)?.meta.parentId).toBe(r.partId);
    expect(s.parts.get(aId)?.meta.cutId).toBe("c1");

    s = applyCutResult(s, aId, "c2", {
      partA: makeMesh(), partB: makeMesh(), dowelPieces: [],
    }, "Body-A");
    const aaId = `${aId}_a`;
    expect(s.parts.get(aaId)?.meta.parentId).toBe(aId);
    expect(s.parts.get(aaId)?.meta.cutId).toBe("c2");
    expect(s.parts.get(aId)?.meta.visible).toBe(false);
    expect(s.parts.get(r.partId)?.meta.visible).toBe(false);
  });

  it("dowel pieces are flagged isDowel and parented to null", () => {
    let s = emptySession();
    const r = importPart(s, makeMesh().mesh, makeMesh().group, "Body");
    s = r.session;
    s = applyCutResult(s, r.partId, "c1", {
      partA: makeMesh(), partB: makeMesh(),
      dowelPieces: [makeMesh(), makeMesh()],
    }, "Body");

    const dowels = Array.from(s.parts.values()).filter((p) => p.isDowel);
    expect(dowels.length).toBe(2);
    expect(dowels[0].meta.parentId).toBeNull();
    expect(dowels[0].meta.cutId).toBe("c1");
    expect(dowels[0].meta.color).toBe("#a3a3a3");
  });

  it("cut-derived parts cycle through the color palette deterministically", () => {
    let s = emptySession();
    const r = importPart(s, makeMesh().mesh, makeMesh().group, "Body");
    s = r.session;
    s = applyCutResult(s, r.partId, "c1", {
      partA: makeMesh(), partB: makeMesh(), dowelPieces: [],
    }, "Body");
    const aColor = s.parts.get(`${r.partId}_a`)?.meta.color;
    const bColor = s.parts.get(`${r.partId}_b`)?.meta.color;
    expect(aColor).toBeTruthy();
    expect(bColor).toBeTruthy();
    expect(aColor).not.toBe(bColor);
  });

  it("applyCutResult throws when parent is missing", () => {
    const s = emptySession();
    expect(() =>
      applyCutResult(s, "p_missing", "c1", {
        partA: makeMesh(), partB: makeMesh(), dowelPieces: [],
      }, "Ghost"),
    ).toThrow(/Parent part missing/);
  });

  it("triCount is recorded on import and on each cut piece", () => {
    let s = emptySession();
    const r = importPart(s, makeMesh().mesh, makeMesh().group, "Body");
    s = r.session;
    expect(s.parts.get(r.partId)?.meta.triCount).toBe(12); // BoxGeometry = 12 tris
    s = applyCutResult(s, r.partId, "c1", {
      partA: makeMesh(), partB: makeMesh(), dowelPieces: [makeMesh()],
    }, "Body");
    expect(s.parts.get(`${r.partId}_a`)?.meta.triCount).toBe(12);
  });
});
