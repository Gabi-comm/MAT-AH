import { ToastProvider } from "./components/feedback/Feedback";
import { FirstRunConsent } from "./features/consent/FirstRunConsent";
import { HanapPage } from "./features/hanap/HanapPage";
import { HomePage } from "./features/home/HomePage";
import { KilosPage } from "./features/kilos/KilosPage";
import { LinisPage } from "./features/linis/LinisPage";
import { SagotPage } from "./features/sagot/SagotPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { Startup } from "./features/startup/Startup";
import { StatusProvider } from "./hooks/StatusContext";
import { useRoute } from "./hooks/useRoute";
import { IrisProvider } from "./mascot/IrisContext";
import { PrefsProvider } from "./prefs/PrefsContext";
import type { Preferences } from "./prefs/preferences";
import type { Backend } from "./services/backend";
import { BackendProvider } from "./services/BackendContext";

function Routes() {
  const { page, params, navigate } = useRoute();
  const q = params.get("q") ?? "";
  switch (page) {
    case "hanap":
      return <HanapPage q={q} navigate={navigate} />;
    case "sagot":
      return <SagotPage q={q} navigate={navigate} />;
    case "kilos":
      return <KilosPage q={q} />;
    case "linis":
      return <LinisPage />;
    case "settings":
      return <SettingsPage section={params.get("section") ?? undefined} />;
    case "home":
    default:
      return <HomePage navigate={navigate} />;
  }
}

export function App({ backend, prefs, startup = true }: { backend: Backend; prefs?: Preferences; startup?: boolean }) {
  return (
    <BackendProvider backend={backend}>
      <PrefsProvider initial={prefs}>
        <IrisProvider>
          <StatusProvider>
            <ToastProvider>
              {startup && <Startup />}
              <Routes />
              <FirstRunConsent />
            </ToastProvider>
          </StatusProvider>
        </IrisProvider>
      </PrefsProvider>
    </BackendProvider>
  );
}
