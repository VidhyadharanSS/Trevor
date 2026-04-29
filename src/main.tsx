/**
 * Trevor — entry point.
 *
 *   1.  Default-dark hardening: synchronously sets data-theme on <html>
 *       BEFORE React mounts so the first paint never flashes light.
 *   2.  Subscribes to the persisted settings store and pushes its values
 *       to CSS custom properties on <html>.
 *   3.  Installs global error handlers so any uncaught error becomes a
 *       readable diagnostic instead of a black screen.
 *   4.  Mounts the React tree wrapped in an ErrorBoundary.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useSettings, applySettingsToDOM } from "./lib/settings/store";
import "./styles/globals.css";

// 1.  Dark-by-default — synchronously, before anything renders.
//     If the user has chosen a non-default theme it is reapplied a
//     few microseconds later via `applySettingsToDOM`, which is fine
//     because <html> already has dark tokens.
const html = document.documentElement;
if (!html.getAttribute("data-theme")) html.setAttribute("data-theme", "trevor-dark");
html.style.colorScheme = "dark";

// 2.  Apply the persisted settings synchronously so the first React
//     paint already reflects the user's chosen theme.
applySettingsToDOM(useSettings.getState().settings);
useSettings.subscribe((state) => applySettingsToDOM(state.settings));

// Remove the splash loader once React takes over.
function dismissSplash() {
  const splash = document.getElementById("initial-loader");
  if (splash) splash.remove();
}

// 3.  Diagnostics.
window.addEventListener("unhandledrejection", (event) => {
  console.error("[Trevor] Unhandled rejection:", event.reason);
  showFatalError(`Unhandled promise rejection:\n${event.reason}`);
});
window.addEventListener("error", (event) => {
  console.error("[Trevor] Global error:", event.error || event.message);
  showFatalError(
    `Global error:\n${event.message}\n\nat ${event.filename}:${event.lineno}:${event.colno}`,
  );
});

function showFatalError(message: string) {
  const root = document.getElementById("root");
  if (!root || root.querySelector("[data-trevor-app]")) return;
  dismissSplash();
  root.innerHTML = `
    <div style="padding:40px 24px;color:#fca5a5;font-family:monospace;font-size:13px;background:#0d0d0f;min-height:100vh;white-space:pre-wrap;">
      <h1 style="font-size:18px;color:#f4f4f5;margin-bottom:12px;">⚠ Trevor failed to start</h1>
      ${message.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] || c))}
    </div>
  `;
}

console.log("[Trevor] main.tsx loaded, mounting React…");

// 4.  Render.
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <div data-trevor-app className="contents">
        <App />
      </div>
    </ErrorBoundary>
  </React.StrictMode>,
);

// Dismiss splash after first paint.
requestAnimationFrame(() => requestAnimationFrame(dismissSplash));
