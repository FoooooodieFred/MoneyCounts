import { describe, expect, it } from "vitest";
import { cardsFromToolOutput, mergeMoneyMoreCards } from "./moneyMoreCards";

describe("moneyMore cards", () => {
  it("builds kpi and category cards from month_stats", () => {
    const cards = cardsFromToolOutput(
      "month_stats",
      JSON.stringify({
        month: "2026-09",
        currency: "HKD",
        kpi: {
          expense: 120,
          income: 800,
          surplus: 680,
          budgetLimit: null,
          budgetRemaining: null,
          dailyAvailable: null,
          pendingReimburse: 0,
          netWorth: 680,
          totalAssets: 800,
          totalLiabilities: 120,
        },
        topCategories: [{ category: "餐饮美食", emoji: "🍽️", amount: 120, percent: 100, count: 2 }],
      }),
    );
    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({ type: "kpi", month: "2026-09" });
    expect(cards[1]).toMatchObject({ type: "categories", items: [{ category: "餐饮美食" }] });
  });

  it("builds a records card from search_records", () => {
    const [card] = cardsFromToolOutput(
      "search_records",
      JSON.stringify({
        total: 1,
        records: [
          { date: "2026-09-13", category: "餐饮美食", amount: 45, currency: "HKD", note: "午餐" },
        ],
      }),
    );
    expect(card).toMatchObject({ type: "records", total: 1 });
  });

  it("merges duplicate month cards", () => {
    const merged = mergeMoneyMoreCards([
      ...cardsFromToolOutput(
        "month_stats",
        JSON.stringify({
          month: "2026-09",
          currency: "HKD",
          kpi: {
            expense: 1,
            income: 0,
            surplus: -1,
            budgetLimit: null,
            budgetRemaining: null,
            dailyAvailable: null,
            pendingReimburse: 0,
            netWorth: -1,
            totalAssets: 0,
            totalLiabilities: 1,
          },
          topCategories: [],
        }),
      ),
      ...cardsFromToolOutput("calculate", JSON.stringify({ expression: "1+1", value: 2 })),
    ]);
    expect(merged.map((card) => card.type)).toEqual(["kpi", "categories", "calc"]);
  });
});
