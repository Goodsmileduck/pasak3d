import { useCallback, useState } from "react";
import * as THREE from "three";
import type { Dowel, CutPlaneSpec, TolerancePreset, ModelData, PartId, Part } from "../types";
import { runCut } from "../lib/cut/cut-client";

type SessionState = {
  rootPart: { id: PartId; mesh: THREE.Mesh; group: THREE.Group } | null;
  cutParts: Array<{ id: PartId; mesh: THREE.Mesh; group: THREE.Group; isDowel: boolean; meta: Part }>;
  busy: boolean;
  error: string | null;
};

export function useCutSession() {
  const [state, setState] = useState<SessionState>({ rootPart: null, cutParts: [], busy: false, error: null });

  const loadModel = useCallback((data: ModelData) => {
    let mesh: THREE.Mesh | null = null;
    data.group.traverse((o) => { if ((o as any).isMesh && !mesh) mesh = o as THREE.Mesh; });
    if (!mesh) throw new Error("Model has no mesh");
    setState({
      rootPart: { id: "p_root", mesh, group: data.group },
      cutParts: [],
      busy: false,
      error: null,
    });
  }, []);

  const performCut = useCallback(async (plane: CutPlaneSpec, dowels: Dowel[], tolerance: TolerancePreset) => {
    setState((current) => {
      if (!current.rootPart) return current;
      // Kick off async work
      (async () => {
        try {
          const result = await runCut(current.rootPart!.mesh, plane, dowels, tolerance);
          const partAMesh = findFirstMesh(result.partA);
          const partBMesh = findFirstMesh(result.partB);
          if (!partAMesh || !partBMesh) throw new Error("Cut produced empty parts");
          const newParts: SessionState["cutParts"] = [
            {
              id: "p_a", mesh: partAMesh, group: result.partA, isDowel: false,
              meta: { id: "p_a", name: "Part A", source: "cut", parentId: current.rootPart!.id, cutId: "c_1", visible: true, color: "#3b82f6", triCount: countTris(partAMesh) },
            },
            {
              id: "p_b", mesh: partBMesh, group: result.partB, isDowel: false,
              meta: { id: "p_b", name: "Part B", source: "cut", parentId: current.rootPart!.id, cutId: "c_1", visible: true, color: "#ef4444", triCount: countTris(partBMesh) },
            },
            ...result.dowelPieces.map((g, i) => {
              const m = findFirstMesh(g)!;
              return {
                id: `d_${i}`, mesh: m, group: g, isDowel: true,
                meta: { id: `d_${i}`, name: `Dowel ${i + 1}`, source: "cut" as const, parentId: null, cutId: "c_1", visible: true, color: "#a3a3a3", triCount: countTris(m) },
              };
            }),
          ];
          setState({ rootPart: null, cutParts: newParts, busy: false, error: null });
        } catch (e: any) {
          setState((s) => ({ ...s, busy: false, error: e?.message ?? String(e) }));
        }
      })();
      return { ...current, busy: true, error: null };
    });
  }, []);

  return { ...state, loadModel, performCut };
}

function findFirstMesh(group: THREE.Group): THREE.Mesh | null {
  let mesh: THREE.Mesh | null = null;
  group.traverse((o) => { if ((o as any).isMesh && !mesh) mesh = o as THREE.Mesh; });
  return mesh;
}

function countTris(mesh: THREE.Mesh): number {
  const idx = (mesh.geometry as THREE.BufferGeometry).index;
  return idx ? idx.count / 3 : (mesh.geometry as THREE.BufferGeometry).attributes.position.count / 3;
}
