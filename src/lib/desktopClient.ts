/**
 * 桌面客户端下载入口。发布安装包后把 URL 填在这里即可点亮「下载桌面客户端」按钮。
 */
import { isDesktopRuntime } from "./desktopRuntime";

export const DESKTOP_CLIENT_DOWNLOAD_URL: string | null =
  "https://github.com/FoooooodieFred/MoneyCounts/releases/latest/download/MoneyCounts-macos-arm64.zip";

export const isRunningDesktopClient = (): boolean => isDesktopRuntime();

export const isDesktopClientDownloadReady = (): boolean =>
  !isRunningDesktopClient() && Boolean(DESKTOP_CLIENT_DOWNLOAD_URL);

export const openDesktopClientDownload = (): boolean => {
  if (!DESKTOP_CLIENT_DOWNLOAD_URL || typeof window === "undefined") return false;
  window.open(DESKTOP_CLIENT_DOWNLOAD_URL, "_blank", "noopener,noreferrer");
  return true;
};
