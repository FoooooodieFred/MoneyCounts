import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";
import { getDesktopApp, isDesktopRuntime, onDesktopBeforeClose } from "./lib/desktopRuntime";
import { flushDesktopStore, hydrateDesktopStore } from "./lib/kv";
import { preloadNlLedgerClassifier } from "./lib/nlLedgerClassifier";
import { preloadAllRoutes } from "./lib/routePreload";

/**
 * The 35-class classifier weighs ~2.5 MB, so it is a separate chunk that is only
 * needed once the user actually types a ledger line. Fetch it while the browser is
 * idle so the first parse does not wait on the network.
 */
const warmClassifier = () => {
  const start = () => void preloadNlLedgerClassifier().catch(() => undefined);
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(start, { timeout: 3000 });
    return;
  }
  window.setTimeout(start, 1500);
};

/**
 * Page chunks are lazy, but waiting for the network on every navigation leaves the
 * old page frozen before the new one animates in. Pull them down while idle.
 */
const warmRoutes = () => {
  const start = () => preloadAllRoutes();
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(start, { timeout: 4000 });
    return;
  }
  window.setTimeout(start, 2000);
};

/** Dismiss only after React has committed the first screen; never delay boot. */
function StartupReady() {
  useEffect(() => {
    const loader = document.getElementById("startup-loader");
    if (!loader) return;
    let timer = 0;
    const frame = window.requestAnimationFrame(() => {
      loader.classList.add("is-ready");
      timer = window.setTimeout(() => loader.remove(), 320);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, []);
  return null;
}

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
        <StartupReady />
      </Router>
    </StrictMode>,
  );

  warmClassifier();
  warmRoutes();

  if ("serviceWorker" in navigator && import.meta.env.PROD && !desktopShell) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.warn("Service worker registration failed", error);
      });
    });
  }
};

void boot().catch((error) => {
  console.error("App startup failed", error);
  const status = document.getElementById("startup-status");
  if (status) status.textContent = "账本暂时未能打开，请重新加载";
  const retry = document.getElementById("startup-retry");
  if (retry) {
    retry.hidden = false;
    retry.addEventListener("click", () => window.location.reload(), { once: true });
  }
});
