import type { ReactNode } from "react";
import { MatahSymbol, MatahWordmark } from "../../branding/MatahLogo";
import { useStatus } from "../../hooks/StatusContext";
import { hrefFor, type Page } from "../../hooks/useRoute";
import { IrisCompanion } from "../../mascot/IrisCompanion";
import { NavIris } from "../../mascot/NavIris";
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
  { page: "hanap", label: "Find", icon: "search" },
  { page: "sagot", label: "Ask", icon: "ask" },
];
const ACT: NavDef[] = [
  { page: "kilos", label: "Organize", icon: "organize" },
  { page: "linis", label: "Clean up", icon: "clean" },
];

/** Active item: Iris acts out the section. Inactive (or Iris hidden): the plain icon. */
function NavMark({ page, icon, on }: { page: Page; icon: IconName; on: boolean }) {
  const { prefs } = usePrefs();
  if (!on || !prefs.iris.visible) return <Icon name={icon} />;
  return (
    <span className="nav-scene" aria-hidden="true">
      <NavIris page={page} />
    </span>
  );
}

function NavLink({ def, current }: { def: NavDef; current: Page }) {
  const on = current === def.page;
  return (
    <a className="nav-item" href={hrefFor(def.page)} aria-current={on ? "page" : undefined}>
      <NavMark page={def.page} icon={def.icon} on={on} />
      {def.label}
      {def.en && <span className="en">{def.en}</span>}
    </a>
  );
}

function RailStatus() {
  const { status, index, error } = useStatus();
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
  children,
  showCompanion = true,
}: {
  page: Page;
  title: string;
  /** Kept for call-site compatibility; the topbar no longer shows it. */
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
            <MatahWordmark height={17} style={{ color: "#F4F0F7" }} />
          </span>
        </a>
        <NavLink def={{ page: "home", label: "Home", icon: "home" }} current={page} />
        <div className="rail-group">Discover</div>
        {DISCOVER.map((d) => (
          <NavLink key={d.page} def={d} current={page} />
        ))}
        <div className="rail-group">Act</div>
        {ACT.map((d) => (
          <NavLink key={d.page} def={d} current={page} />
        ))}
        <RailStatus />
        <NavLink def={{ page: "settings", label: "Settings", icon: "settings" }} current={page} />
      </nav>
      <div className="main">
        <header className="topbar">
          <div className="topbar-title">{title}</div>
          {backend.isDemo && <span className="demo-badge">Demo data</span>}
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
