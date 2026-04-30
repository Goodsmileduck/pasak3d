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

  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    globals: true,
  },
});
