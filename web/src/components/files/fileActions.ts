import { useCallback } from "react";
import { useBackend } from "../../services/BackendContext";
import { useToast } from "../feedback/Feedback";

/** Open / Reveal through the backend (it launches Windows apps; the browser never touches files). */
export function useFileActions() {
  const backend = useBackend();
  const toast = useToast();
  const open = useCallback(
    async (id: number, name: string) => {
      try {
        await backend.openFile(id);
        toast(backend.isDemo ? `Demo: would open ${name}` : `Binuksan ang ${name}`);
      } catch (e) {
        toast((e as Error).message, "err");
      }
    },
    [backend, toast],
  );
  const reveal = useCallback(
    async (id: number, name: string) => {
      try {
        await backend.revealFile(id);
        toast(backend.isDemo ? `Demo: would show ${name} in its folder` : `Ipinakita sa File Explorer`);
      } catch (e) {
        toast((e as Error).message, "err");
      }
    },
    [backend, toast],
  );
  return { open, reveal };
}
