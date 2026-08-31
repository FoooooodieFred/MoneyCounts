import { describe, expect, it } from "vitest";
import {
  QUICK_TEMPLATE_POOL,
  applyTemplateSlot,
  pickRandomTemplates,
} from "./quickTemplates";

describe("quickTemplates", () => {
  it("has 20 template variants", () => {
    expect(QUICK_TEMPLATE_POOL).toHaveLength(20);
  });

  it("picks three unique templates", () => {
    const picked = pickRandomTemplates(3, 42);
    expect(picked).toHaveLength(3);
    expect(new Set(picked).size).toBe(3);
  });

  it("places cursor at amount slot", () => {
    const { text, cursor } = applyTemplateSlot("午餐 __ 元");
    expect(text).toBe("午餐  元");
    expect(cursor).toBe(3);
  });
});
