import type { ReactNode } from "react";

type Props = {
  onOpen: () => void;
  onExport: () => void;
  canExport: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  printerSlot?: ReactNode;
};

export function Toolbar({ onOpen, onExport, canExport, onUndo, onRedo, canUndo, canRedo, printerSlot }: Props) {
  return (
    <div className="px-3 py-2 bg-white border-b border-slate-200 flex gap-2 text-sm items-center">
      <button className="px-3 py-1 bg-slate-900 text-white rounded" onClick={onOpen}>Open…</button>
      <button
        className="px-3 py-1 bg-slate-100 rounded disabled:opacity-40"
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
      >Undo</button>
      <button
        className="px-3 py-1 bg-slate-100 rounded disabled:opacity-40"
        onClick={onRedo}
        disabled={!canRedo}
        title="Redo (Ctrl+Shift+Z)"
      >Redo</button>
      <div className="flex-1" />
      {printerSlot}
      <button
        className="px-3 py-1 bg-emerald-600 text-white rounded disabled:opacity-50"
        disabled={!canExport}
        onClick={onExport}
      >Export</button>
    </div>
  );
}
