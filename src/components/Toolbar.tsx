import type { ReactNode } from "react";

type Props = {
  onOpen: () => void;
  onExport: () => void;
  canExport: boolean;
  printerSlot?: ReactNode;
};

export function Toolbar({ onOpen, onExport, canExport, printerSlot }: Props) {
  return (
    <div className="px-3 py-2 bg-white border-b border-slate-200 flex gap-2 text-sm items-center">
      <button className="px-3 py-1 bg-slate-900 text-white rounded" onClick={onOpen}>Open…</button>
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
