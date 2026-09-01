/**
 * 桌面客户端下载入口。发布安装包后把 URL 填在这里即可点亮「下载桌面客户端」按钮。
 */
export const DESKTOP_CLIENT_DOWNLOAD_URL: string | null = null;

export const isDesktopClientDownloadReady = (): boolean => Boolean(DESKTOP_CLIENT_DOWNLOAD_URL);

export const openDesktopClientDownload = (): boolean => {
  if (!DESKTOP_CLIENT_DOWNLOAD_URL || typeof window === "undefined") return false;
  window.open(DESKTOP_CLIENT_DOWNLOAD_URL, "_blank", "noopener,noreferrer");
  return true;
};
