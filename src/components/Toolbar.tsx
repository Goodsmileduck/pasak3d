import type { ReactNode } from "react";

type Props = {
  onOpen: () => void;
  onExport: () => void;
  onTestFit: () => void;
  canExport: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  printerSlot?: ReactNode;
  isDark?: boolean;
  onToggleTheme?: () => void;
};

export function Toolbar({
  onOpen,
  onExport,
  onTestFit,
  canExport,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  printerSlot,
  isDark,
  onToggleTheme,
}: Props) {
  return (
    <div className="px-3 py-2 bg-[var(--surface)] border-b border-[var(--border)] flex gap-2 text-sm items-center">
      <span className="font-display font-semibold tracking-tight text-[var(--ink)] mr-1 select-none">
        Pasak
      </span>
      <button
        className="px-3 py-1 rounded bg-[var(--ink)] text-[var(--surface)] hover:opacity-90 transition-opacity"
        onClick={onOpen}
      >
        Open…
      </button>
      <button className="btn-neutral px-3 py-1" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
        Undo
      </button>
      <button className="btn-neutral px-3 py-1" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
        Redo
      </button>
      <div className="flex-1" />
      {printerSlot}
      <button
        className="btn-neutral px-3 py-1"
        onClick={onTestFit}
        aria-label="Generate test-fit coupons"
      >
        Test-fit
      </button>
      {onToggleTheme && (
        <button
          className="w-8 h-7 grid place-items-center rounded bg-[var(--surface-2)] text-[var(--ink-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--ink)] transition-colors"
          onClick={onToggleTheme}
          title={isDark ? "Switch to light theme" : "Switch to dark theme"}
          aria-label="Toggle theme"
        >
          {isDark ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      )}
      <button
        className="btn-primary px-3 py-1"
        disabled={!canExport}
        onClick={onExport}
      >
        Export
      </button>
    </div>
  );
}
