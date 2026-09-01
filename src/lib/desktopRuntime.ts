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

export const isDesktopBuild = (): boolean => import.meta.env.VITE_DESKTOP === "1";

export const getDesktopApp = (): DesktopAppBindings | null => {
  if (typeof window === "undefined") return null;
  return window.go?.main?.App ?? null;
};

export const isDesktopRuntime = (): boolean => Boolean(isDesktopBuild() || getDesktopApp());

export const onDesktopBeforeClose = (handler: () => void | Promise<void>) => {
  window.runtime?.EventsOn?.("moneycounts:before-close", () => {
    void Promise.resolve(handler());
  });
};
