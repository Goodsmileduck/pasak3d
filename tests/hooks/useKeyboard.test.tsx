import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useKeyboard } from "../../src/hooks/useKeyboard";

function fire(key: string, opts: KeyboardEventInit = {}, target: EventTarget = window) {
  const event = new KeyboardEvent("keydown", { key, ...opts, bubbles: true, cancelable: true });
  Object.defineProperty(event, "target", { value: target, writable: false });
  window.dispatchEvent(event);
  return event;
}

describe("useKeyboard", () => {
  it("calls the registered handler for a plain key", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboard({ "o": handler }));
    fire("o");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not fire when no handler matches", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboard({ "o": handler }));
    fire("p");
    expect(handler).not.toHaveBeenCalled();
  });

  it("matches Ctrl modifier", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboard({ "Ctrl+z": handler }));
    fire("z", { ctrlKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("matches Cmd as Ctrl (cross-platform)", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboard({ "Ctrl+z": handler }));
    fire("z", { metaKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("matches Ctrl+Shift+key combo", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboard({ "Ctrl+Shift+Z": handler }));
    fire("Z", { ctrlKey: true, shiftKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("ignores keys when focus is on an input element", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboard({ "o": handler }));
    const input = document.createElement("input");
    document.body.appendChild(input);
    fire("o", {}, input);
    expect(handler).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it("ignores keys when focus is on a textarea", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboard({ "o": handler }));
    const ta = document.createElement("textarea");
    document.body.appendChild(ta);
    fire("o", {}, ta);
    expect(handler).not.toHaveBeenCalled();
    document.body.removeChild(ta);
  });

  it("ignores keys when focus is on a select element", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboard({ "o": handler }));
    const sel = document.createElement("select");
    document.body.appendChild(sel);
    fire("o", {}, sel);
    expect(handler).not.toHaveBeenCalled();
    document.body.removeChild(sel);
  });

  it("ignores keys when focus is on a contentEditable element", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboard({ "o": handler }));
    const div = document.createElement("div");
    // jsdom doesn't implement HTMLElement.isContentEditable as a derived getter,
    // so we stub it directly to simulate the browser behavior.
    Object.defineProperty(div, "isContentEditable", { value: true });
    document.body.appendChild(div);
    fire("o", {}, div);
    expect(handler).not.toHaveBeenCalled();
    document.body.removeChild(div);
  });

  it("calls preventDefault when a handler runs", () => {
    renderHook(() => useKeyboard({ "o": () => {} }));
    const event = fire("o");
    expect(event.defaultPrevented).toBe(true);
  });

  it("does not call preventDefault when no handler matches", () => {
    renderHook(() => useKeyboard({ "o": () => {} }));
    const event = fire("p");
    expect(event.defaultPrevented).toBe(false);
  });

  it("removes the listener on unmount", () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useKeyboard({ "o": handler }));
    unmount();
    fire("o");
    expect(handler).not.toHaveBeenCalled();
  });

  it("falls back to bare e.key when combo doesn't match", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboard({ "Escape": handler }));
    // Pressing Esc with Shift held — combo is "Shift+Escape" but bare "Escape" should still fire
    fire("Escape", { shiftKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
