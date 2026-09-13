import { describe, expect, it } from "vitest";
import { buildStatsDashboard, extremeBarDates, isPendingReimbursement } from "./statsDashboard";

describe("stats dashboard", () => {
  const entries = [
    { date: "2026-09-01", category: "餐饮美食", amount: 40, note: "午餐" },
    { date: "2026-09-01", category: "工资收入", amount: -8000, note: "月薪" },
    { date: "2026-09-02", category: "交通出行", amount: 20, note: "待报销 地铁" },
    { date: "2026-09-03", category: "餐饮美食", amount: 90, note: "晚饭" },
  ];

  it("splits expense, income, reimbursement and net worth", () => {
    const dashboard = buildStatsDashboard({
      monthKey: "2026-09",
      entries,
      budgetEnabled: true,
      monthlyLimit: 3000,
      remainingDays: 10,
    });
    expect(dashboard.kpi.expense).toBe(150);
    expect(dashboard.kpi.income).toBe(8000);
    expect(dashboard.kpi.surplus).toBe(7850);
    expect(dashboard.kpi.pendingReimburse).toBe(20);
    expect(dashboard.kpi.budgetRemaining).toBe(2850);
    expect(dashboard.categories[0]?.category).toBe("餐饮美食");
    expect(dashboard.netSeries.at(-1)?.netWorth).toBe(7850);
  });

  it("marks daily extrema for the selected flow", () => {
    const dashboard = buildStatsDashboard({
      monthKey: "2026-09",
      entries,
      budgetEnabled: false,
      monthlyLimit: null,
      remainingDays: 1,
    });
    expect([...extremeBarDates(dashboard.dailyBars, "expense")].sort()).toEqual([
      "2026-09-02",
      "2026-09-03",
    ]);
  });

  it("detects pending reimbursement notes", () => {
    expect(isPendingReimbursement({ note: "待报销 打车", category: "交通出行" })).toBe(true);
    expect(isPendingReimbursement({ note: "已报销 打车", category: "交通出行" })).toBe(false);
  });
});
