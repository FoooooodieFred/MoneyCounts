import { afterEach, describe, expect, it } from "vitest";
import { hasWailsShell, isDesktopRuntime } from "./desktopRuntime";

const ensureWindow = () => {
  if (typeof globalThis.window === "undefined") {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        setTimeout: globalThis.setTimeout.bind(globalThis),
      },
    });
  }
  return globalThis.window;
};

afterEach(() => {
  const win = globalThis.window;
  if (win) {
    win.go = undefined;
    win.runtime = undefined;
  }
});

describe("desktop runtime detection", () => {
  it("does not treat a plain browser window as the desktop client", () => {
    expect(hasWailsShell()).toBe(false);
    expect(isDesktopRuntime()).toBe(false);
  });

  it("recognizes injected Wails App bindings", () => {
    ensureWindow().go = {
      main: {
        App: {
          LoadStore: async () => "",
          SaveStore: async () => undefined,
          SaveTextFile: async () => "",
          OpenTextFile: async () => ({ name: "", contents: "", size: 0, cancelled: true }),
          NotifyFlushed: async () => undefined,
        },
      },
    };
    expect(hasWailsShell()).toBe(true);
    expect(isDesktopRuntime()).toBe(true);
  });

  it("recognizes the Wails runtime object before App bindings appear", () => {
    ensureWindow().runtime = { EventsOn: () => undefined };
    expect(hasWailsShell()).toBe(true);
    expect(isDesktopRuntime()).toBe(true);
  });
});
