import type { ReactNode } from "react";
import { MatahSymbol, MatahWordmark } from "../../branding/MatahLogo";
import { useStatus } from "../../hooks/StatusContext";
import { hrefFor, type Page } from "../../hooks/useRoute";
import { IrisCompanion } from "../../mascot/IrisCompanion";
import { usePrefs } from "../../prefs/PrefsContext";
import { useBackend } from "../../services/BackendContext";
import { indexPhaseText, plural } from "../../services/normalize";
import { Icon, type IconName } from "../Icon";

interface NavDef {
  page: Page;
  label: string;
  en?: string;
  icon: IconName;
}

const DISCOVER: NavDef[] = [
  { page: "hanap", label: "Hanap", en: "Find", icon: "search" },
  { page: "sagot", label: "Sagot", en: "Ask", icon: "ask" },
];
const ACT: NavDef[] = [
  { page: "kilos", label: "Kilos", en: "Organize", icon: "organize" },
  { page: "linis", label: "Linis", en: "Clean up", icon: "clean" },
];

function NavLink({ def, current }: { def: NavDef; current: Page }) {
  const on = current === def.page;
  return (
    <a className="nav-item" href={hrefFor(def.page)} aria-current={on ? "page" : undefined}>
      {on ? <span className="nav-seam" aria-hidden="true" /> : <Icon name={def.icon} />}
      {def.label}
      {def.en && <span className="en">{def.en}</span>}
    </a>
  );
}

function RailStatus() {
  const { status, index, error } = useStatus();
  const backend = useBackend();
  const files = status ? Object.values(status.files).reduce((a, b) => a + b, 0) : 0;
  let line = "Checking local services…";
  let dot = "";
  if (error) {
    line = "Backend not reachable";
    dot = "err";
  } else if (status) {
    line = status.ollama ? "Running locally" : "Local AI offline";
    dot = status.ollama ? "ok" : "warn";
  }
  return (
    <div className="rail-status" aria-live="polite">
      <div className="line strong">
        <span className={`dot ${dot}`} aria-hidden="true" />
        {line}
      </div>
      {status && (
        <div className="line">
          {index?.running ? indexPhaseText(index) : `${plural(files, "file")} indexed`}
        </div>
      )}
      {status && <div className="line">{status.online ? "Internet on · not used" : "Offline · works anyway"}</div>}
      {backend.isDemo && <span className="demo-badge" style={{ alignSelf: "flex-start" }}>DEMO DATA</span>}
    </div>
  );
}

function ThemeToggle() {
  const { prefs, update, resolvedTheme } = usePrefs();
  const next = prefs.theme === "system" ? (resolvedTheme === "dark" ? "light" : "dark") : prefs.theme === "dark" ? "light" : "dark";
  return (
    <button
      className="icon-btn"
      onClick={() => update({ theme: next })}
      aria-label={`Switch to ${next} theme`}
      title={`Theme: ${prefs.theme}. Click for ${next}.`}
    >
      <Icon name={resolvedTheme === "dark" ? "sun" : "moon"} />
    </button>
  );
}

export function AppShell({
  page,
  title,
  eyebrow,
  children,
  showCompanion = true,
}: {
  page: Page;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  showCompanion?: boolean;
}) {
  const backend = useBackend();
  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <nav className="rail" aria-label="Main">
        <a className="rail-brand" href={hrefFor("home")} aria-label="MAT-AH home">
          <span className="row gap-2">
            <MatahSymbol size={30} tone="light" />
            <MatahWordmark height={17} style={{ color: "#F6F3EF" }} />
          </span>
        </a>
        <a className="nav-item" href={hrefFor("home")} aria-current={page === "home" ? "page" : undefined}>
          {page === "home" ? <span className="nav-seam" aria-hidden="true" /> : <Icon name="home" />}
          Home
        </a>
        <div className="rail-group">DISCOVER</div>
        {DISCOVER.map((d) => (
          <NavLink key={d.page} def={d} current={page} />
        ))}
        <div className="rail-group">ACT · NEEDS YOUR OK</div>
        {ACT.map((d) => (
          <NavLink key={d.page} def={d} current={page} />
        ))}
        <RailStatus />
        <NavLink def={{ page: "settings", label: "Settings", icon: "settings" }} current={page} />
      </nav>
      <div className="main">
        <header className="topbar">
          <div className="topbar-title">
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 20 }}>{title}</span>
          </div>
          {backend.isDemo && <span className="demo-badge">DEMO DATA · NOT YOUR FILES</span>}
          <div className="row gap-2" style={{ marginLeft: "auto", alignItems: "flex-end" }}>
            {showCompanion && <IrisCompanion />}
            <ThemeToggle />
          </div>
        </header>
        <main id="main" className="page" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
