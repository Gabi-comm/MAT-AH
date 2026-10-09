/*
  Runs a DOM-changing update inside a View Transition when the browser
  supports it and motion is on; otherwise just runs it. `className` is put on
  <html> for the transition's lifetime so CSS can pick the animation.
*/
import { flushSync } from "react-dom";

export function withViewTransition(update: () => void, className?: string): void {
  const root = document.documentElement;
  if (typeof document.startViewTransition !== "function" || root.dataset.motion === "none") {
    update();
    return;
  }
  if (className) root.classList.add(className);
  const vt = document.startViewTransition(() => flushSync(update));
  // A newer transition (fast clicking) skips this one; that rejects `ready`, which is expected.
  vt.ready.catch(() => {});
  vt.finished
    .catch(() => {})
    .finally(() => {
      if (className) root.classList.remove(className);
    });
}
