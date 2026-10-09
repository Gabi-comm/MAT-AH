import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/geist/400.css";
import "@fontsource/geist/500.css";
import "@fontsource/geist/600.css";
import "@fontsource/geist-mono/400.css";
import "@fontsource/geist-mono/500.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/animations.css";
import { App } from "./App";
import { demoRequested, realBackend, type Backend } from "./services/backend";

async function boot() {
  let backend: Backend = realBackend;
  // Development-only demo data. `import.meta.env.DEV &&` lets production builds drop it entirely.
  if (import.meta.env.DEV && demoRequested()) {
    backend = (await import("./mocks/demoBackend")).demoBackend;
    console.info("[MAT-AH] Demo mode: showing demonstration data, not your files.");
  }
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App backend={backend} />
    </StrictMode>,
  );
}

boot();
