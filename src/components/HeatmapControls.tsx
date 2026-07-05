type Props = {
  threshold: number;
  onThresholdChange: (deg: number) => void;
};

export function HeatmapControls({ threshold, onThresholdChange }: Props) {
  return (
    <div className="flex items-center gap-2 text-xs text-[var(--ink-muted)]">
      <span>Overhang</span>
      <input
        type="range"
        min={15}
        max={89}
        step={1}
        value={threshold}
        aria-label="Overhang threshold"
        onChange={(e) => onThresholdChange(+e.target.value)}
        className="w-32"
      />
      <span className="tabular-nums w-7 text-right">{threshold}°</span>
      <div className="flex items-center gap-1">
        <span>Safe</span>
        <span
          aria-hidden="true"
          className="h-2 w-16 rounded-sm"
          style={{ background: "linear-gradient(90deg, #33b85c, #f59e1a, #e62626)" }}
        />
        <span>Steep</span>
      </div>
    </div>
  );
}
