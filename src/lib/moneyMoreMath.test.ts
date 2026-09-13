import { describe, expect, it } from "vitest";
import { evaluateMathExpression } from "./moneyMoreMath";

describe("evaluateMathExpression", () => {
  it("evaluates python-like arithmetic", () => {
    expect(evaluateMathExpression("1 + 2 * 3")).toBe(7);
    expect(evaluateMathExpression("(128 + 56) / 3")).toBeCloseTo(61.333, 3);
    expect(evaluateMathExpression("2 ** 8")).toBe(256);
    expect(evaluateMathExpression("7 // 2")).toBe(3);
    expect(evaluateMathExpression("-4 + abs(-9)")).toBe(5);
    expect(evaluateMathExpression("mean(10, 20, 30)")).toBe(20);
    expect(evaluateMathExpression("sum(1, 2, 3, 4)")).toBe(10);
  });

  it("rejects unsafe input", () => {
    expect(() => evaluateMathExpression("")).toThrow();
    expect(() => evaluateMathExpression("1 / 0")).toThrow(/除数/);
    expect(() => evaluateMathExpression("alert(1)")).toThrow();
  });
});
