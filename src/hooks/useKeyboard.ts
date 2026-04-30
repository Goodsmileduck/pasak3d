import { useEffect } from "react";

type Handlers = Partial<Record<string, () => void>>;

/**
 * Bind keyboard shortcuts. Keys are matched as strings of the form:
 *   "o", "x", "?", "Escape", "Enter"
 *   "Ctrl+z", "Ctrl+Shift+Z", "Ctrl+e"
 *
 * The Ctrl prefix matches both Ctrl and Cmd. Event is ignored when the
 * focused element is an input/textarea/select.
 *
 * `deps` is forwarded to the underlying useEffect dependency array.
 */
export function useKeyboard(handlers: Handlers, deps: unknown[] = []) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        if (target.isContentEditable) return;
      }
      const ctrl = e.ctrlKey || e.metaKey;
      const parts: string[] = [];
      if (ctrl) parts.push("Ctrl+");
      if (e.shiftKey) parts.push("Shift+");
      if (e.altKey) parts.push("Alt+");
      const combo = parts.join("") + e.key;
      const handler = handlers[combo] ?? handlers[e.key];
      if (handler) {
        e.preventDefault();
        handler();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
