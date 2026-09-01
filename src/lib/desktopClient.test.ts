import { describe, expect, it } from "vitest";
import { DESKTOP_CLIENT_DOWNLOAD_URL, isDesktopClientDownloadReady } from "./desktopClient";

describe("desktopClient download hook", () => {
  it("points at the GitHub Release zip for Apple Silicon", () => {
    expect(DESKTOP_CLIENT_DOWNLOAD_URL).toContain(
      "releases/latest/download/MoneyCounts-macos-arm64.zip",
    );
    expect(isDesktopClientDownloadReady()).toBe(true);
  });
});
