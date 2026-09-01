/**
 * 桌面客户端下载入口。打开 GitHub Release 页，按系统取 macOS zip 或 Windows zip。
 */
import { isDesktopRuntime } from "./desktopRuntime";

export const DESKTOP_CLIENT_DOWNLOAD_URL: string | null =
  "https://github.com/FoooooodieFred/MoneyCounts/releases/latest";

export const isRunningDesktopClient = (): boolean => isDesktopRuntime();

export const isDesktopClientDownloadReady = (): boolean =>
  !isRunningDesktopClient() && Boolean(DESKTOP_CLIENT_DOWNLOAD_URL);

export const openDesktopClientDownload = (): boolean => {
  if (!DESKTOP_CLIENT_DOWNLOAD_URL || typeof window === "undefined") return false;
  window.open(DESKTOP_CLIENT_DOWNLOAD_URL, "_blank", "noopener,noreferrer");
  return true;
};
