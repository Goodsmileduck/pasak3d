type Props = {
  onOpen: () => void;
  onExport: () => void;
  canExport: boolean;
};

export function Toolbar({ onOpen, onExport, canExport }: Props) {
  return (
    <div className="px-3 py-2 bg-white border-b border-slate-200 flex gap-2 text-sm">
      <button className="px-3 py-1 bg-slate-900 text-white rounded" onClick={onOpen}>Open…</button>
      <div className="flex-1" />
      <button
        className="px-3 py-1 bg-emerald-600 text-white rounded disabled:opacity-50"
        disabled={!canExport}
        onClick={onExport}
      >Export</button>
    </div>
  );
}
