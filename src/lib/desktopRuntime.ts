export type DesktopOpenedFile = {
  name: string;
  contents: string;
  size: number;
  cancelled?: boolean;
};

export type DesktopAppBindings = {
  LoadStore: () => Promise<string>;
  SaveStore: (contents: string) => Promise<void>;
  SaveTextFile: (defaultFilename: string, contents: string) => Promise<string>;
  OpenTextFile: (filterPattern: string) => Promise<DesktopOpenedFile>;
  NotifyFlushed: () => Promise<void>;
};

type WailsRuntime = {
  EventsOn?: (eventName: string, callback: () => void) => void;
};

declare global {
  interface Window {
    go?: {
      main?: {
        App?: DesktopAppBindings;
      };
    };
    runtime?: WailsRuntime;
  }
}

export const isDesktopBuild = (): boolean => {
  const flag = import.meta.env.VITE_DESKTOP;
  return flag === "1" || flag === "true";
};

export const getDesktopApp = (): DesktopAppBindings | null => {
  if (typeof window === "undefined") return null;
  return window.go?.main?.App ?? null;
};

/** Wails 会注入 window.go / window.runtime；构建时漏了 VITE_DESKTOP 也能识别客户端。 */
export const hasWailsShell = (): boolean => {
  if (typeof window === "undefined") return false;
  return Boolean(window.go?.main?.App || window.runtime);
};

export const isDesktopRuntime = (): boolean => Boolean(isDesktopBuild() || hasWailsShell());

export const onDesktopBeforeClose = (handler: () => void | Promise<void>) => {
  window.runtime?.EventsOn?.("moneycounts:before-close", () => {
    void Promise.resolve(handler());
  });
};
