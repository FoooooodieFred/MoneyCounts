import { APP_VERSION, GITHUB_REPO } from "./appVersion";

export type DesktopPlatform = "darwin" | "windows" | "linux" | "unknown";

export type GitHubReleaseAsset = {
  name: string;
  browser_download_url: string;
};

export type GitHubReleasePayload = {
  tag_name?: string;
  html_url?: string;
  assets?: GitHubReleaseAsset[];
};

export type DesktopUpdateOffer = {
  tagName: string;
  version: string;
  htmlUrl: string;
  downloadUrl: string | null;
  assetName: string | null;
};

const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)/;

export const parseSemver = (raw: string): [number, number, number] | null => {
  const match = raw.trim().replace(/^v/i, "").match(VERSION_PATTERN);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
};

export const compareSemver = (left: string, right: string): number => {
  const a = parseSemver(left);
  const b = parseSemver(right);
  if (!a || !b) return 0;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  }
  return 0;
};

export const detectDesktopPlatform = (userAgent = ""): DesktopPlatform => {
  if (/Windows/i.test(userAgent)) return "windows";
  if (/Mac OS X|Macintosh/i.test(userAgent)) return "darwin";
  if (/Linux/i.test(userAgent)) return "linux";
  return "unknown";
};

export const pickReleaseAsset = (
  assets: GitHubReleaseAsset[],
  platform: DesktopPlatform,
): GitHubReleaseAsset | null => {
  if (platform === "windows") {
    return (
      assets.find((asset) => /windows.*\.exe$/i.test(asset.name)) ??
      assets.find((asset) => /windows.*\.zip$/i.test(asset.name)) ??
      null
    );
  }
  if (platform === "darwin") {
    return assets.find((asset) => /macos.*\.zip$/i.test(asset.name)) ?? null;
  }
  return null;
};

export const offerFromRelease = (
  payload: GitHubReleasePayload,
  platform: DesktopPlatform,
  currentVersion: string = APP_VERSION,
): DesktopUpdateOffer | null => {
  const tagName = payload.tag_name?.trim() ?? "";
  const version = tagName.replace(/^v/i, "");
  if (!parseSemver(version) || compareSemver(version, currentVersion) <= 0) return null;
  const asset = pickReleaseAsset(payload.assets ?? [], platform);
  return {
    tagName,
    version,
    htmlUrl: payload.html_url?.trim() || `https://github.com/${GITHUB_REPO}/releases/latest`,
    downloadUrl: asset?.browser_download_url ?? null,
    assetName: asset?.name ?? null,
  };
};

export const fetchLatestDesktopUpdate = async (
  platform: DesktopPlatform,
  currentVersion: string = APP_VERSION,
): Promise<DesktopUpdateOffer | null> => {
  const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as GitHubReleasePayload;
  return offerFromRelease(payload, platform, currentVersion);
};
