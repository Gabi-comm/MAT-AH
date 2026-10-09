/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// The UI lives at the repo root next to the Python backend. The FastAPI backend serves the built UI
// from ./dist and the API under /api. In development, Vite proxies /api to the backend. Override the
// target with VITE_API_TARGET if the backend runs on another port (run.ps1 uses 8765).

// Python side of the repo: never watched, linted or tested by the frontend tooling.
const NOT_FRONTEND = ["**/.venv/**", "**/data/**", "**/backend/**", "**/demo_data/**", "**/eval/**",
  "**/tests/**", "**/scripts/**", "**/__pycache__/**", "**/.pytest_cache/**", "**/.remember/**"];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const target = env.VITE_API_TARGET || "http://127.0.0.1:8765"; // run.ps1 serves the backend on 8765
  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: false,
      proxy: { "/api": { target, changeOrigin: false } },
      // data/matah.db changes constantly while indexing; watching it (or .venv) would only slow Vite down
      watch: { ignored: NOT_FRONTEND },
    },
    build: { outDir: "dist", emptyOutDir: true, sourcemap: false },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/test/setup.ts"],
      include: ["src/**/*.test.{ts,tsx}"],
      css: false,
    },
  };
});
