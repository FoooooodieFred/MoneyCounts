import { describe, expect, it } from "vitest";
import { DESKTOP_CLIENT_DOWNLOAD_URL, isDesktopClientDownloadReady } from "./desktopClient";

describe("desktopClient download hook", () => {
  it("points at the GitHub Releases page for macOS and Windows builds", () => {
    expect(DESKTOP_CLIENT_DOWNLOAD_URL).toContain("releases/latest");
    expect(DESKTOP_CLIENT_DOWNLOAD_URL).not.toContain(".zip");
    expect(isDesktopClientDownloadReady()).toBe(true);
  });
});
