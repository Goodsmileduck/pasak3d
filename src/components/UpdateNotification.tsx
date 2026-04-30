import type { AutoUpdateState } from "../hooks/useAutoUpdate";

interface Props {
  update: AutoUpdateState;
  isDark: boolean;
}

export function UpdateNotification({ update, isDark }: Props) {
  const { status, version, progress, error, installUpdate, dismiss } = update;

  if (status === "idle" || status === "checking") return null;

  const bg = isDark
    ? "bg-neutral-800 border-neutral-700"
    : "bg-white border-gray-200";
  const text = isDark ? "text-neutral-200" : "text-gray-800";
  const muted = isDark ? "text-neutral-400" : "text-gray-500";
  const dismissBtn = isDark
    ? "text-neutral-400 hover:text-neutral-200"
    : "text-gray-500 hover:text-gray-800";
  const trackBg = isDark ? "bg-neutral-600" : "bg-gray-200";

  return (
    <div
      className={`absolute top-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-lg border shadow-lg ${bg} ${text}`}
    >
      {status === "available" && (
        <>
          <span className="text-sm">
            Version <span className="font-semibold">{version}</span> is
            available
          </span>
          <button
            onClick={installUpdate}
            className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded transition-colors"
          >
            Update now
          </button>
          <button
            onClick={dismiss}
            className={`px-2 py-1 text-xs transition-colors ${dismissBtn}`}
            title="Dismiss"
          >
            Later
          </button>
        </>
      )}

      {status === "downloading" && (
        <>
          <span className="text-sm">Downloading update...</span>
          <div className={`w-32 h-1.5 rounded-full overflow-hidden ${trackBg}`}>
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className={`text-xs tabular-nums ${muted}`}>
            {progress}%
          </span>
        </>
      )}

      {status === "ready" && (
        <span className="text-sm">Update installed. Restarting...</span>
      )}

      {status === "error" && (
        <>
          <span className={`text-sm ${isDark ? "text-red-400" : "text-red-600"}`}>
            Update failed: {error}
          </span>
          <button
            onClick={dismiss}
            className={`px-2 py-1 text-xs transition-colors ${dismissBtn}`}
          >
            Dismiss
          </button>
        </>
      )}
    </div>
  );
}
