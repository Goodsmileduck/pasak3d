/// <reference types="vitest" />
import { readFileSync } from "fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const isWeb = process.env.VITE_TARGET === "web";
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

export default defineConfig({
  plugins: [react(), tailwindcss()],

  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },

  ...(isWeb
    ? {}
    : {
        clearScreen: false,
        server: {
          port: 1420,
          strictPort: true,
          watch: { ignored: ["**/src-tauri/**"] },
        },
      }),

  // Manifold WASM (M2) and any other .wasm assets
  assetsInclude: ["**/*.wasm"],

  worker: {
    format: "es",
  },

  // In web mode, Tauri imports must be externalized so the bundler doesn't
  // try to resolve native plugin packages that don't exist in browsers.
  build: {
    rollupOptions: isWeb
      ? {
          external: [
            "@tauri-apps/api",
            "@tauri-apps/api/core",
            "@tauri-apps/plugin-dialog",
            "@tauri-apps/plugin-fs",
            "@tauri-apps/plugin-shell",
            "@tauri-apps/plugin-updater",
            "@tauri-apps/plugin-process",
          ],
        }
      : {},
  },

  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    globals: true,
  },
});
