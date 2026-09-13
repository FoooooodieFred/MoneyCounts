import { describe, expect, it } from "vitest";
import { BotEngine } from "./bloub/engine";
import { SHAPE_BY_ID } from "./bloub/skins";

describe("bloub engine", () => {
  it("samples a circular idle frame", () => {
    const engine = new BotEngine(100, "idle", SHAPE_BY_ID.get("cercle")?.radii ?? null);
    const frame = engine.sample(0.4);
    expect(frame.bodyPath.startsWith("M")).toBe(true);
    expect(frame.eyes).toHaveLength(2);
  });
});
