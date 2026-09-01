import { getDesktopApp, isDesktopRuntime } from "./desktopRuntime";
import type { DesktopOpenedFile } from "./desktopRuntime";

export type TextFilePayload = {
  name: string;
  contents: string;
  size: number;
};

const downloadBlob = (contents: string, filename: string) => {
  const blob = new Blob([contents], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
};

export const saveTextFile = async (filename: string, contents: string): Promise<void> => {
  const app = getDesktopApp();
  if (app) {
    await app.SaveTextFile(filename, contents);
    return;
  }
  downloadBlob(contents, filename);
};

export const openTextFile = async (filterPattern: string): Promise<TextFilePayload | null> => {
  const app = getDesktopApp();
  if (!app) return null;
  const result: DesktopOpenedFile = await app.OpenTextFile(filterPattern);
  if (!result || result.cancelled) return null;
  return {
    name: result.name,
    contents: result.contents,
    size: typeof result.size === "number" ? result.size : result.contents.length,
  };
};

export const canUseNativeFileDialog = (): boolean => isDesktopRuntime() && Boolean(getDesktopApp());
