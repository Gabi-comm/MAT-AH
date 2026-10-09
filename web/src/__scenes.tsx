import { createRoot } from "react-dom/client";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/animations.css";
import { PrefsProvider } from "./prefs/PrefsContext";
import { IrisProvider } from "./mascot/IrisContext";
import { NavIris } from "./mascot/NavIris";
import { Iris } from "./mascot/Iris";
const pages = ["home", "hanap", "sagot", "kilos", "linis", "settings"] as const;
createRoot(document.getElementById("root")!).render(
  <PrefsProvider>
    <IrisProvider>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 30, padding: 40, zoom: 4 } as any}>
        {pages.map((p) => <div key={p} style={{ width: 46, height: 46 }}><NavIris page={p} /></div>)}
      </div>
      <div style={{ display: "flex", gap: 120, padding: "40px 120px", alignItems: "flex-end" }}>
        <Iris state="searching" size={180} theme="dark" />
        <Iris state="celebrating" size={180} theme="dark" />
        <Iris state="searching" size={180} theme="dark" accessory="detective" />
      </div>
    </IrisProvider>
  </PrefsProvider>,
);
