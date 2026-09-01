import { describe, expect, it } from "vitest";
import { DESKTOP_CLIENT_DOWNLOAD_URL, isDesktopClientDownloadReady } from "./desktopClient";

describe("desktopClient download hook", () => {
  it("stays disabled until a download URL is published", () => {
    expect(DESKTOP_CLIENT_DOWNLOAD_URL).toBeNull();
    expect(isDesktopClientDownloadReady()).toBe(false);
  });
});
