import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";
import { getDesktopApp, isDesktopBuild, onDesktopBeforeClose } from "./lib/desktopRuntime";
import { flushDesktopStore, hydrateDesktopStore } from "./lib/kv";

const Router = isDesktopBuild() ? HashRouter : BrowserRouter;

const boot = async () => {
  if (isDesktopBuild()) {
    await hydrateDesktopStore();
    onDesktopBeforeClose(async () => {
      await flushDesktopStore();
      await getDesktopApp()?.NotifyFlushed();
    });
  }

  createRoot(document.getElementById("root") as HTMLElement).render(
    <StrictMode>
      <Router>
        <App />
      </Router>
    </StrictMode>,
  );

  if ("serviceWorker" in navigator && import.meta.env.PROD && !isDesktopBuild()) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.warn("Service worker registration failed", error);
      });
    });
  }
};

void boot();
