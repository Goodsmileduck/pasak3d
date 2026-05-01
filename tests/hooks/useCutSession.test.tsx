import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import * as THREE from "three";
import type { ModelData } from "../../src/types";

// Mock the cut-client (which spins up a real Web Worker) so we can test the hook in isolation.
vi.mock("../../src/lib/cut/cut-client", () => ({
  runCut: vi.fn(),
}));

// Mock auto-orient to a no-op so we don't need real geometry transformations to work in jsdom.
vi.mock("../../src/lib/cut/auto-orient", () => ({
  applyAutoOrient: vi.fn(),
}));

// Mock auto-place — just returns an empty array (sequential-cut tests don't depend on dowel placement).
vi.mock("../../src/lib/cut/auto-place-cut-dowels", () => ({
  autoPlaceCutDowels: vi.fn(() => []),
}));

import { useCutSession } from "../../src/hooks/useCutSession";
import { runCut } from "../../src/lib/cut/cut-client";

function makeGroupWithMesh(): THREE.Group {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10));
  group.add(mesh);
  return group;
}

function makeModelData(): ModelData {
  const group = makeGroupWithMesh();
  return {
    group,
    info: {
      filename: "cube.stl",
      format: "stl",
      fileSize: 100,
      triCount: 12,
      bbox: { min: [-5, -5, -5], max: [5, 5, 5] },
      dimensions: { x: 10, y: 10, z: 10 },
    },
  };
}

function makeRunCutResult() {
  return {
    partA: makeGroupWithMesh(),
    partB: makeGroupWithMesh(),
    dowelPieces: [],
  };
}

describe("useCutSession", () => {
  beforeEach(() => {
    vi.mocked(runCut).mockReset();
  });

  it("starts with an empty session", () => {
    const { result } = renderHook(() => useCutSession());
    expect(result.current.partsArray).toEqual([]);
    expect(result.current.busy).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it("loadModel imports the mesh as the root part", () => {
    const { result } = renderHook(() => useCutSession());
    act(() => result.current.loadModel(makeModelData()));
    expect(result.current.partsArray.length).toBe(1);
    expect(result.current.partsArray[0].meta.name).toBe("Body");
    expect(result.current.partsArray[0].meta.source).toBe("import");
  });

  it("loadModel centers the imported group on XY with bbox.min.z == 0", () => {
    // Build a mesh whose natural mesh-coords are far from origin (e.g. raw 3MF
    // file coords). loadModel must center it so the bbox React reads is sane.
    const group = new THREE.Group();
    const geom = new THREE.BoxGeometry(10, 10, 10);
    geom.translate(128, 64, 32); // simulate non-centered mesh data
    group.add(new THREE.Mesh(geom));

    const { result } = renderHook(() => useCutSession());
    act(() =>
      result.current.loadModel({
        group,
        info: {
          filename: "off.stl", format: "stl", fileSize: 1, triCount: 12,
          bbox: { min: [0, 0, 0], max: [0, 0, 0] },
          dimensions: { x: 10, y: 10, z: 10 },
        },
      }),
    );
    const part = result.current.partsArray[0];
    const bbox = new THREE.Box3().setFromObject(part.group);
    expect((bbox.min.x + bbox.max.x) / 2).toBeCloseTo(0, 5);
    expect((bbox.min.y + bbox.max.y) / 2).toBeCloseTo(0, 5);
    expect(bbox.min.z).toBeCloseTo(0, 5);
  });

  it("performCut adds two children + dowels and hides the parent", async () => {
    vi.mocked(runCut).mockResolvedValue(makeRunCutResult());
    const { result } = renderHook(() => useCutSession());
    act(() => result.current.loadModel(makeModelData()));

    const rootId = result.current.partsArray[0].id;
    await act(async () => {
      await result.current.performCut(
        rootId,
        { normal: [1, 0, 0], constant: 0, axisSnap: "x" },
        [],
        "pla-tight",
      );
    });

    expect(result.current.partsArray.length).toBe(3); // root (hidden) + A + B
    const root = result.current.partsArray.find((p) => p.id === rootId);
    expect(root?.meta.visible).toBe(false);
  });

  it("performCut surfaces worker errors via the error state", async () => {
    vi.mocked(runCut).mockRejectedValue(new Error("Cut plane does not intersect the part."));
    const { result } = renderHook(() => useCutSession());
    act(() => result.current.loadModel(makeModelData()));
    const rootId = result.current.partsArray[0].id;
    await act(async () => {
      await result.current.performCut(
        rootId,
        { normal: [1, 0, 0], constant: 100, axisSnap: "x" },
        [],
        "pla-tight",
      );
    });
    expect(result.current.error).toMatch(/does not intersect/);
    expect(result.current.busy).toBe(false);
  });

  it("performCut on a missing part is a no-op", async () => {
    const { result } = renderHook(() => useCutSession());
    act(() => result.current.loadModel(makeModelData()));
    await act(async () => {
      await result.current.performCut(
        "p_missing",
        { normal: [1, 0, 0], constant: 0, axisSnap: "x" },
        [],
        "pla-tight",
      );
    });
    expect(vi.mocked(runCut)).not.toHaveBeenCalled();
    expect(result.current.partsArray.length).toBe(1);
  });

  it("undo restores the prior session, redo re-applies", async () => {
    vi.mocked(runCut).mockResolvedValue(makeRunCutResult());
    const { result } = renderHook(() => useCutSession());
    act(() => result.current.loadModel(makeModelData()));
    const rootId = result.current.partsArray[0].id;
    await act(async () => {
      await result.current.performCut(rootId, { normal: [1, 0, 0], constant: 0, axisSnap: "x" }, [], "pla-tight");
    });
    expect(result.current.partsArray.length).toBe(3);
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(result.current.partsArray.length).toBe(1);
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.redo());
    expect(result.current.partsArray.length).toBe(3);
  });

  it("undo is a no-op when history is empty", () => {
    const { result } = renderHook(() => useCutSession());
    act(() => result.current.undo());
    expect(result.current.canUndo).toBe(false);
  });

  it("loadModel resets history and future stacks", async () => {
    vi.mocked(runCut).mockResolvedValue(makeRunCutResult());
    const { result } = renderHook(() => useCutSession());
    act(() => result.current.loadModel(makeModelData()));
    const rootId = result.current.partsArray[0].id;
    await act(async () => {
      await result.current.performCut(rootId, { normal: [1, 0, 0], constant: 0, axisSnap: "x" }, [], "pla-tight");
    });
    act(() => result.current.undo());
    expect(result.current.canRedo).toBe(true);

    // Loading a new model wipes the redo stack
    act(() => result.current.loadModel(makeModelData()));
    expect(result.current.canRedo).toBe(false);
    expect(result.current.canUndo).toBe(false);
  });

  it("setPrinter updates the printer in session state", () => {
    const { result } = renderHook(() => useCutSession());
    const printer = { id: "p1", name: "Test", buildVolume: { x: 100, y: 100, z: 100 } };
    act(() => result.current.setPrinter(printer));
    expect(result.current.session.printer?.id).toBe("p1");
  });

  it("togglePartVisible flips visibility on the named part", () => {
    const { result } = renderHook(() => useCutSession());
    act(() => result.current.loadModel(makeModelData()));
    const rootId = result.current.partsArray[0].id;
    act(() => result.current.togglePartVisible(rootId, false));
    expect(result.current.partsArray[0].meta.visible).toBe(false);
    act(() => result.current.togglePartVisible(rootId, true));
    expect(result.current.partsArray[0].meta.visible).toBe(true);
  });

  it("selectPartId updates selectedPartId", () => {
    const { result } = renderHook(() => useCutSession());
    act(() => result.current.loadModel(makeModelData()));
    act(() => result.current.selectPartId(null));
    expect(result.current.session.selectedPartId).toBeNull();
  });
});
