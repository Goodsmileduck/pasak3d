import Module from "manifold-3d";

let modulePromise: Promise<Awaited<ReturnType<typeof Module>>> | null = null;

/**
 * Initialize the Manifold WASM module. Cached after first call.
 * Safe to call from main thread (in tests/Node) and from a Web Worker.
 */
export function initManifold() {
  if (!modulePromise) {
    modulePromise = (async () => {
      const m = await Module();
      m.setup();
      return m;
    })();
  }
  return modulePromise;
}

/** For tests: forget the cached module so a fresh init can run. */
export function _resetManifoldCache() {
  modulePromise = null;
}
