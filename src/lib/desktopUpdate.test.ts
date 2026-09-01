import { describe, expect, it } from "vitest";
import {
  compareSemver,
  detectDesktopPlatform,
  offerFromRelease,
  pickReleaseAsset,
} from "./desktopUpdate";

const assets = [
  {
    name: "MoneyCounts-macos-arm64.zip",
    browser_download_url: "https://example.com/mac.zip",
  },
  {
    name: "MoneyCounts-windows-amd64.zip",
    browser_download_url: "https://example.com/win.zip",
  },
];

describe("desktopUpdate", () => {
  it("compares dotted versions", () => {
    expect(compareSemver("1.2.1", "1.2.0")).toBe(1);
    expect(compareSemver("v1.2.0", "1.2.0")).toBe(0);
    expect(compareSemver("1.1.9", "1.2.0")).toBe(-1);
  });

  it("picks the zip for the current OS", () => {
    expect(pickReleaseAsset(assets, "darwin")?.name).toBe("MoneyCounts-macos-arm64.zip");
    expect(pickReleaseAsset(assets, "windows")?.name).toBe("MoneyCounts-windows-amd64.zip");
    expect(detectDesktopPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("darwin");
  });

  it("only offers a release newer than the running app", () => {
    expect(
      offerFromRelease(
        { tag_name: "v1.2.1", html_url: "https://example.com/r", assets },
        "darwin",
        "1.2.1",
      ),
    ).toBeNull();
    const offer = offerFromRelease(
      { tag_name: "v1.3.0", html_url: "https://example.com/r", assets },
      "darwin",
      "1.2.1",
    );
    expect(offer?.downloadUrl).toBe("https://example.com/mac.zip");
    expect(offer?.version).toBe("1.3.0");
  });
});
