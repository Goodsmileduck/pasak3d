import { useCallback, useState } from "react";
import * as THREE from "three";
import type { Dowel, CutPlaneSpec, TolerancePreset, ModelData, PartId, PrinterPreset } from "../types";
import { runCut } from "../lib/cut/cut-client";
import { applyAutoOrient } from "../lib/cut/auto-orient";
import { autoPlaceCutDowels } from "../lib/cut/auto-place-cut-dowels";
import { centerOnXY } from "../lib/scene";
import {
  emptySession,
  importPart,
  applyCutResult,
  setVisible,
  selectPart,
  setPrinter as setPrinterReducer,
  type Session,
  type RuntimePart,
} from "../lib/session";

export function useCutSession() {
  const [session, setSession] = useState<Session>(emptySession());
  const [history, setHistory] = useState<Session[]>([]);
  const [future, setFuture] = useState<Session[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const push = useCallback(
    (next: Session) => {
      setHistory((h) => [...h, session]);
      setFuture([]);
      setSession(next);
    },
    [session],
  );

  const loadModel = useCallback((data: ModelData) => {
    let mesh: THREE.Mesh | null = null;
    data.group.traverse((o) => {
      if ((o as any).isMesh && !mesh) mesh = o as THREE.Mesh;
    });
    if (!mesh) throw new Error("Model has no mesh");
    // Center the part now so the bbox React reads is in canonical world coords.
    // (Viewer used to do this in its mount effect, but App.tsx's bbox memo
    // captured the pre-centering bbox — leaving the cut plane at mesh-local coords.)
    centerOnXY(data.group);
    const fresh = emptySession();
    const { session: next } = importPart(fresh, mesh, data.group, "Body");
    setHistory([]);
    setFuture([]);
    setSession(next);
    setError(null);
  }, []);

  const performCut = useCallback(
    async (partId: PartId, plane: CutPlaneSpec, dowels: Dowel[], tolerance: TolerancePreset) => {
      const target = session.parts.get(partId);
      if (!target) return;
      setBusy(true);
      setError(null);
      try {
        const result = await runCut(target.mesh, plane, dowels, tolerance);
        const a = firstMeshAndGroup(result.partA);
        const b = firstMeshAndGroup(result.partB);
        if (!a || !b) throw new Error("Cut produced empty parts");
        const dps = result.dowelPieces
          .map(firstMeshAndGroup)
          .filter((x): x is { mesh: THREE.Mesh; group: THREE.Group } => !!x);
        applyAutoOrient(a.mesh);
        applyAutoOrient(b.mesh);
        dps.forEach((d) => applyAutoOrient(d.mesh));
        const next = applyCutResult(
          session,
          partId,
          `c${session.cuts.length + 1}`,
          { partA: a, partB: b, dowelPieces: dps },
          target.meta.name,
        );
        push(next);
      } catch (e: any) {
        setError(e?.message ?? String(e));
      } finally {
        setBusy(false);
      }
    },
    [session, push],
  );

  const performCutsSequential = useCallback(
    async (
      rootPartId: PartId,
      planes: CutPlaneSpec[],
      defaultDowelOpts: { count: number; diameter: number; length: number; tolerance: TolerancePreset },
    ) => {
      if (planes.length === 0) return;
      setBusy(true);
      setError(null);
      let working = session;
      let target = rootPartId;
      try {
        for (const plane of planes) {
          const part = working.parts.get(target);
          if (!part) throw new Error("Target part missing during sequential cuts");
          const dowels = autoPlaceCutDowels(part.mesh, plane, {
            count: defaultDowelOpts.count,
            dowelDiameter: defaultDowelOpts.diameter,
            length: defaultDowelOpts.length,
            minSpacing: 2,
          });
          const result = await runCut(part.mesh, plane, dowels, defaultDowelOpts.tolerance);
          const a = firstMeshAndGroup(result.partA);
          const b = firstMeshAndGroup(result.partB);
          if (!a || !b) throw new Error("Cut produced empty parts");
          const dps = result.dowelPieces
            .map(firstMeshAndGroup)
            .filter((x): x is { mesh: THREE.Mesh; group: THREE.Group } => !!x);
          applyAutoOrient(a.mesh);
          applyAutoOrient(b.mesh);
          dps.forEach((d) => applyAutoOrient(d.mesh));
          working = applyCutResult(
            working,
            target,
            `c${working.cuts.length + 1}`,
            { partA: a, partB: b, dowelPieces: dps },
            part.meta.name,
          );
          // Continue cutting the larger of the two new parts — most likely needs further cuts to fit.
          const partA = working.parts.get(`${target}_a`)!;
          const partB = working.parts.get(`${target}_b`)!;
          const sizeA = new THREE.Box3().setFromObject(partA.group).getSize(new THREE.Vector3()).length();
          const sizeB = new THREE.Box3().setFromObject(partB.group).getSize(new THREE.Vector3()).length();
          target = sizeA >= sizeB ? partA.id : partB.id;
        }
        push(working);
      } catch (e: any) {
        setError(e?.message ?? String(e));
      } finally {
        setBusy(false);
      }
    },
    [session, push],
  );

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setFuture((f) => [session, ...f]);
    setSession(prev);
  }, [history, session]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture((f) => f.slice(1));
    setHistory((h) => [...h, session]);
    setSession(next);
  }, [future, session]);

  const selectPartId = useCallback(
    (id: PartId | null) => setSession((s) => selectPart(s, id)),
    [],
  );

  const togglePartVisible = useCallback(
    (id: PartId, visible: boolean) => setSession((s) => setVisible(s, id, visible)),
    [],
  );

  const setPrinter = useCallback(
    (p: PrinterPreset | null) => setSession((s) => setPrinterReducer(s, p)),
    [],
  );

  const partsArray: RuntimePart[] = Array.from(session.parts.values());

  return {
    session,
    partsArray,
    busy,
    error,
    loadModel,
    performCut,
    performCutsSequential,
    undo,
    redo,
    canUndo: history.length > 0,
    canRedo: future.length > 0,
    selectPartId,
    togglePartVisible,
    setPrinter,
  };
}

function firstMeshAndGroup(
  group: THREE.Group,
): { mesh: THREE.Mesh; group: THREE.Group } | null {
  let mesh: THREE.Mesh | null = null;
  group.traverse((o) => {
    if ((o as any).isMesh && !mesh) mesh = o as THREE.Mesh;
  });
  return mesh ? { mesh, group } : null;
}
