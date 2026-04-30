/** True when running inside the Tauri desktop shell (vs. browser). */
export const isDesktop = import.meta.env.VITE_TARGET !== "web";

/** Extract a filename from an OS path (works for both `/` and `\` separators). */
export function basename(path: string, fallback = "model"): string {
  return path.split(/[/\\]/).pop() || fallback;
}
