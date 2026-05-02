import type { RuntimePart } from "../lib/session";
import type { PartId } from "../types";

type Props = {
  parts: RuntimePart[];
  selectedId: PartId | null;
  onSelect: (id: PartId) => void;
  onToggleVisible: (id: PartId, visible: boolean) => void;
};

export function PartsTree({ parts, selectedId, onSelect, onToggleVisible }: Props) {
  const roots = parts.filter((p) => p.meta.parentId === null && !p.isDowel);
  const dowels = parts.filter((p) => p.isDowel);

  const renderNode = (part: RuntimePart, depth = 0) => {
    const children = parts.filter((p) => p.meta.parentId === part.id && !p.isDowel);
    return (
      <div key={part.id}>
        <div
          className={`flex items-center gap-1 px-1 py-0.5 cursor-pointer rounded ${selectedId === part.id ? "bg-blue-100" : "hover:bg-slate-100"}`}
          style={{ paddingLeft: depth * 12 + 4 }}
          onClick={() => onSelect(part.id)}
        >
          <input
            type="checkbox"
            checked={part.meta.visible}
            onChange={(e) => { e.stopPropagation(); onToggleVisible(part.id, e.target.checked); }}
            onClick={(e) => e.stopPropagation()}
          />
          <span className="w-2 h-2 rounded-full" style={{ background: part.meta.color }} />
          <span className="text-sm">{part.meta.name}</span>
          <span className="text-xs text-slate-400 ml-auto">{Math.round(part.meta.triCount)}</span>
        </div>
        {children.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  };

  return (
    <div className="bg-white border-r border-slate-200 w-56 shrink-0 flex flex-col text-sm">
      <div className="px-2 py-1 font-semibold border-b border-slate-100">Parts</div>
      <div className="flex-1 overflow-auto">{roots.map((r) => renderNode(r))}</div>
      {dowels.length > 0 && (
        <>
          <div className="px-2 py-1 font-semibold border-y border-slate-100">Dowels ({dowels.length})</div>
          <div className="overflow-auto max-h-40">
            {dowels.map((d) => (
              <div key={d.id} className="flex items-center gap-1 px-2 py-0.5">
                <input type="checkbox" checked={d.meta.visible} onChange={(e) => onToggleVisible(d.id, e.target.checked)} />
                <span className="text-xs">{d.meta.name}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
