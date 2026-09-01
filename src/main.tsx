import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";
import { getDesktopApp, isDesktopRuntime, onDesktopBeforeClose } from "./lib/desktopRuntime";
import { flushDesktopStore, hydrateDesktopStore } from "./lib/kv";

const boot = async () => {
  await hydrateDesktopStore();
  const desktopShell = isDesktopRuntime();
  if (desktopShell) {
    onDesktopBeforeClose(async () => {
      await flushDesktopStore();
      await getDesktopApp()?.NotifyFlushed();
    });
  }

  const Router = desktopShell ? HashRouter : BrowserRouter;

  createRoot(document.getElementById("root") as HTMLElement).render(
    <StrictMode>
      <Router>
        <App />
      </Router>
    </StrictMode>,
  );

  if ("serviceWorker" in navigator && import.meta.env.PROD && !desktopShell) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.warn("Service worker registration failed", error);
      });
    });
  }
};

void boot();
