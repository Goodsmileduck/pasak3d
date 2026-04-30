type Props = {
  value: number; // 0..1
  onChange: (v: number) => void;
};

export function ExplodedView({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-2 text-xs text-slate-600">
      <span>Explode</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="w-32"
      />
      <span className="tabular-nums w-7 text-right">{Math.round(value * 100)}%</span>
    </div>
  );
}
