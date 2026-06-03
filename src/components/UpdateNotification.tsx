import type { AutoUpdateState } from "../hooks/useAutoUpdate";

interface Props {
  update: AutoUpdateState;
}

export function UpdateNotification({ update }: Props) {
  const { status, version, progress, error, installUpdate, dismiss } = update;

  if (status === "idle" || status === "checking") return null;

  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-lg border border-[var(--border)] shadow-lg bg-[var(--surface)] text-[var(--ink)]">
      {status === "available" && (
        <>
          <span className="text-sm">
            Version <span className="font-semibold">{version}</span> is available
          </span>
          <button
            onClick={installUpdate}
            className="px-3 py-1 text-xs font-medium text-[var(--accent-fg)] bg-[var(--accent)] hover:brightness-110 rounded transition"
          >
            Update now
          </button>
          <button
            onClick={dismiss}
            className="px-2 py-1 text-xs text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors"
            title="Dismiss"
          >
            Later
          </button>
        </>
      )}

      {status === "downloading" && (
        <>
          <span className="text-sm">Downloading update...</span>
          <div className="w-32 h-1.5 rounded-full overflow-hidden bg-[var(--surface-3)]">
            <div
              className="h-full bg-[var(--accent)] rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs tabular-nums text-[var(--ink-muted)]">{progress}%</span>
        </>
      )}

      {status === "ready" && (
        <span className="text-sm">Update installed. Restarting...</span>
      )}

      {status === "error" && (
        <>
          <span className="text-sm text-[var(--danger)]">Update failed: {error}</span>
          <button
            onClick={dismiss}
            className="px-2 py-1 text-xs text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors"
          >
            Dismiss
          </button>
        </>
      )}
    </div>
  );
}
