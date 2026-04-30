import * as THREE from "three";
import type { Part, PartId, Cut, CutId, PrinterPreset } from "../types";

export type RuntimePart = {
  id: PartId;
  meta: Part;
  mesh: THREE.Mesh;
  group: THREE.Group;
  isDowel: boolean;
};

export type Session = {
  parts: Map<PartId, RuntimePart>;
  cuts: Cut[];
  selectedPartId: PartId | null;
  printer: PrinterPreset | null;
};

export function emptySession(): Session {
  return { parts: new Map(), cuts: [], selectedPartId: null, printer: null };
}

export function importPart(
  s: Session,
  mesh: THREE.Mesh,
  group: THREE.Group,
  name: string,
): { session: Session; partId: PartId } {
  const id = `p_${Math.random().toString(36).slice(2, 8)}`;
  const next = cloneSession(s);
  const tri = countTris(mesh);
  next.parts.set(id, {
    id,
    mesh,
    group,
    isDowel: false,
    meta: {
      id,
      name,
      source: "import",
      parentId: null,
      cutId: null,
      visible: true,
      color: pickColor(next.parts.size),
      triCount: tri,
    },
  });
  next.selectedPartId = id;
  return { session: next, partId: id };
}

export type CutOutput = {
  partA: { mesh: THREE.Mesh; group: THREE.Group };
  partB: { mesh: THREE.Mesh; group: THREE.Group };
  dowelPieces: Array<{ mesh: THREE.Mesh; group: THREE.Group }>;
};

export function applyCutResult(
  s: Session,
  parentId: PartId,
  cutId: CutId,
  output: CutOutput,
  parentName: string,
): Session {
  const next = cloneSession(s);
  const parent = next.parts.get(parentId);
  if (!parent) throw new Error("Parent part missing");
  parent.meta = { ...parent.meta, visible: false };

  const aId = `${parentId}_a`;
  const bId = `${parentId}_b`;
  next.parts.set(aId, {
    id: aId,
    mesh: output.partA.mesh,
    group: output.partA.group,
    isDowel: false,
    meta: {
      id: aId,
      name: `${parentName}-A`,
      source: "cut",
      parentId,
      cutId,
      visible: true,
      color: pickColor(next.parts.size),
      triCount: countTris(output.partA.mesh),
    },
  });
  next.parts.set(bId, {
    id: bId,
    mesh: output.partB.mesh,
    group: output.partB.group,
    isDowel: false,
    meta: {
      id: bId,
      name: `${parentName}-B`,
      source: "cut",
      parentId,
      cutId,
      visible: true,
      color: pickColor(next.parts.size),
      triCount: countTris(output.partB.mesh),
    },
  });
  output.dowelPieces.forEach((dp, i) => {
    const id = `${cutId}_d${i}`;
    next.parts.set(id, {
      id,
      mesh: dp.mesh,
      group: dp.group,
      isDowel: true,
      meta: {
        id,
        name: `Dowel ${cutId}-${i + 1}`,
        source: "cut",
        parentId: null,
        cutId,
        visible: true,
        color: "#a3a3a3",
        triCount: countTris(dp.mesh),
      },
    });
  });
  next.selectedPartId = aId;
  return next;
}

export function setVisible(s: Session, partId: PartId, visible: boolean): Session {
  const next = cloneSession(s);
  const part = next.parts.get(partId);
  if (part) part.meta = { ...part.meta, visible };
  return next;
}

export function selectPart(s: Session, partId: PartId | null): Session {
  return { ...s, parts: new Map(s.parts), selectedPartId: partId };
}

export function setPrinter(s: Session, p: PrinterPreset | null): Session {
  return { ...s, parts: new Map(s.parts), printer: p };
}

function cloneSession(s: Session): Session {
  return {
    parts: new Map(
      Array.from(s.parts.entries()).map(([k, v]) => [k, { ...v, meta: { ...v.meta } }]),
    ),
    cuts: [...s.cuts],
    selectedPartId: s.selectedPartId,
    printer: s.printer,
  };
}

function countTris(mesh: THREE.Mesh): number {
  const idx = (mesh.geometry as THREE.BufferGeometry).index;
  return idx
    ? idx.count / 3
    : (mesh.geometry as THREE.BufferGeometry).attributes.position.count / 3;
}

const PALETTE = [
  "#3b82f6",
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
];
function pickColor(n: number): string {
  return PALETTE[n % PALETTE.length];
}
