import { describe, expect, it } from "vitest";
import { moneyMoreContentBox, moneyMoreFrame } from "./moneyMoreMotion";

describe("moneyMoreFrame", () => {
  const viewport = { width: 1440, height: 900 };
  const gutters = { right: 18, bottom: 18, full: 12 };

  it("keeps the bubble as a 58px circle in the corner", () => {
    expect(moneyMoreFrame("bubble", viewport, gutters)).toMatchObject({
      width: 58,
      height: 58,
      radius: 29,
      right: 18,
      bottom: 18,
    });
  });

  it("grows the window from the same corner without stretching", () => {
    const frame = moneyMoreFrame("window", viewport, gutters, "#fff");
    expect(frame.width).toBe(420);
    expect(frame.height).toBe(620);
    expect(frame.right).toBe(18);
    expect(frame.bottom).toBe(18);
    expect(frame.radius).toBe(28);
  });

  it("fills the viewport from the same bottom-right anchor", () => {
    const frame = moneyMoreFrame("full", viewport, gutters, "#fff");
    expect(frame.width).toBe(1416);
    expect(frame.height).toBe(876);
    expect(frame.right).toBe(12);
    expect(frame.bottom).toBe(12);
  });

  it("keeps bubble content at window size so the circle clips instead of scaling", () => {
    const windowFrame = moneyMoreFrame("window", viewport, gutters, "#fff");
    expect(moneyMoreContentBox("bubble", viewport, gutters, "#fff")).toEqual({
      width: windowFrame.width,
      height: windowFrame.height,
    });
  });
});
