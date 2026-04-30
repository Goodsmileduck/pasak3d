import { useState, useEffect, useCallback } from "react";
import type { Update } from "@tauri-apps/plugin-updater";

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "ready"
  | "error";

export interface AutoUpdateState {
  status: UpdateStatus;
  version: string | null;
  progress: number; // 0-100
  error: string | null;
  checkForUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  dismiss: () => void;
}

import { isDesktop as isTauri } from "../lib/platform";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function useAutoUpdate(): AutoUpdateState {
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [version, setVersion] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<Update | null>(null);

  const checkForUpdate = useCallback(async () => {
    if (!isTauri) return;
    setStatus("checking");
    setError(null);

    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();

      if (update) {
        setVersion(update.version);
        setPendingUpdate(update);
        setStatus("available");
      } else {
        setStatus("idle");
      }
    } catch (err) {
      const msg = errorMessage(err);
      // Suppress expected errors from @tauri-apps/plugin-updater v2:
      // - "no updater pubkey": dev builds without TAURI_SIGNING_PRIVATE_KEY
      // - "Could not validate": network/signature validation failures in dev
      if (msg.includes("no updater pubkey") || msg.includes("Could not validate")) {
        setStatus("idle");
        return;
      }
      setError(msg);
      setStatus("error");
    }
  }, []);

  const installUpdate = useCallback(async () => {
    if (!pendingUpdate) return;
    setStatus("downloading");
    setProgress(0);

    try {
      let downloaded = 0;
      let contentLength = 0;
      await pendingUpdate.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            downloaded = 0;
            contentLength = event.data.contentLength ?? 0;
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              setProgress(Math.round((downloaded / contentLength) * 100));
            }
            break;
          case "Finished":
            setProgress(100);
            break;
        }
      });

      setStatus("ready");

      // On Windows, the app exits automatically during NSIS install.
      // On other platforms, we need to restart.
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (err) {
      setError(errorMessage(err));
      setStatus("error");
    }
  }, [pendingUpdate]);

  const dismiss = useCallback(() => {
    setStatus("idle");
    setPendingUpdate(null);
    setVersion(null);
    setError(null);
  }, []);

  // Check for updates on mount (with a short delay to let the app settle)
  useEffect(() => {
    if (!isTauri) return;
    const timer = setTimeout(checkForUpdate, 3000);
    return () => clearTimeout(timer);
  }, [checkForUpdate]);

  return { status, version, progress, error, checkForUpdate, installUpdate, dismiss };
}
