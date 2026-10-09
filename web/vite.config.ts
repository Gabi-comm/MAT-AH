/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// The FastAPI backend serves the built UI from web/dist and the API under /api.
// In development, Vite proxies /api to the backend. Override the target with
// VITE_API_TARGET if the backend runs on another port (run.ps1 uses 8765).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const target = env.VITE_API_TARGET || "http://127.0.0.1:8765"; // run.ps1 serves the backend on 8765
  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: false,
      proxy: { "/api": { target, changeOrigin: false } },
    },
    build: { outDir: "dist", emptyOutDir: true, sourcemap: false },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/test/setup.ts"],
      css: false,
    },
  };
});
