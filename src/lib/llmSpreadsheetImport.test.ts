import { describe, expect, it } from "vitest";
import {
  looksLikeBinarySpreadsheet,
  normalizeImportDate,
  parseSpreadsheetImportPayload,
  splitSpreadsheetChunks,
  SPREADSHEET_CHUNK_CHARS,
  SPREADSHEET_MAX_CHUNKS,
  SPREADSHEET_ROWS_PER_CHUNK,
} from "./llmSpreadsheetImport";

describe("llmSpreadsheetImport", () => {
  it("rejects zip/xlsx binary payloads", () => {
    expect(looksLikeBinarySpreadsheet("PK\u0003\u0004xlsx")).toBe(true);
    expect(looksLikeBinarySpreadsheet("date,category,amount\n2026-01-01,餐饮美食,12")).toBe(false);
  });

  it("normalizes common date spellings", () => {
    expect(normalizeImportDate("2026-03-01")).toBe("2026-03-01");
    expect(normalizeImportDate("2026/3/1")).toBe("2026-03-01");
    expect(normalizeImportDate("2026.03.01")).toBe("2026-03-01");
    expect(normalizeImportDate("2026年3月1日")).toBe("2026-03-01");
    expect(normalizeImportDate("2026/3/1 0:00:00")).toBe("2026-03-01");
    expect(normalizeImportDate("2026-03-01T12:30:00")).toBe("2026-03-01");
    expect(normalizeImportDate("1/3/2026")).toBe("2026-03-01");
    expect(normalizeImportDate("45352")).toBe("2024-03-01");
    expect(normalizeImportDate("not-a-date")).toBeNull();
  });

  it("maps categories and signs income and refunds negative", () => {
    const { rows, warnings } = parseSpreadsheetImportPayload(
      {
        rows: [
          {
            date: "2026/3/1",
            category: "salary",
            amount: "5000",
            currency: "人民币",
            note: "工资",
          },
          {
            date: "2026-03-02",
            category: "餐饮美食",
            amount: "45.5",
            currency: "HKD",
            note: "午餐",
          },
          { date: "2026-03-03", category: "购物退款", amount: "30", currency: "CNY", note: "淘宝" },
          { date: "bad", category: "餐饮美食", amount: "10", currency: "HKD", note: "x" },
        ],
        warnings: ["表头货币列不统一"],
      },
      { defaultCurrency: "HKD" },
    );
    expect(rows).toEqual([
      { date: "2026-03-01", category: "工资收入", amount: "-5000", currency: "CNY", note: "工资" },
      { date: "2026-03-02", category: "餐饮美食", amount: "45.5", currency: "HKD", note: "午餐" },
      { date: "2026-03-03", category: "购物退款", amount: "-30", currency: "CNY", note: "淘宝" },
    ]);
    expect(warnings.some((item) => item.includes("日期无效"))).toBe(true);
    expect(warnings).toContain("表头货币列不统一");
  });

  it("accepts entries or csv fallback from a drifting model", () => {
    const fromEntries = parseSpreadsheetImportPayload(
      {
        entries: [
          {
            date: "2026-04-01",
            category: "副业收入",
            amount: "800",
            currency: "HKD",
            note: "稿费",
          },
        ],
      },
      { defaultCurrency: "HKD" },
    );
    expect(fromEntries.rows[0]).toMatchObject({ category: "副业收入", amount: "-800" });

    const fromCsv = parseSpreadsheetImportPayload(
      {
        csv: "date,category,amount,currency,note\n2026-04-02,交通出行,18,HKD,地铁",
      },
      { defaultCurrency: "CNY" },
    );
    expect(fromCsv.rows[0]).toEqual({
      date: "2026-04-02",
      category: "交通出行",
      amount: "18",
      currency: "HKD",
      note: "地铁",
    });
  });

  it("accepts arrays, Chinese keys, and income columns", () => {
    const fromArray = parseSpreadsheetImportPayload(
      [
        {
          日期: "2026/3/1 0:00:00",
          分类: "餐饮美食",
          金额: "45.5",
          币种: "HKD",
          备注: "午餐",
        },
      ],
      { defaultCurrency: "CNY" },
    );
    expect(fromArray.rows[0]).toEqual({
      date: "2026-03-01",
      category: "餐饮美食",
      amount: "45.5",
      currency: "HKD",
      note: "午餐",
    });

    const fromIncome = parseSpreadsheetImportPayload(
      {
        data: [{ 日期: "2026-04-01", 科目: "副业收入", 收入: "800", 备注: "稿费" }],
      },
      { defaultCurrency: "HKD" },
    );
    expect(fromIncome.rows[0]).toMatchObject({
      category: "副业收入",
      amount: "-800",
      currency: "HKD",
    });
  });

  it("skips blank and comma-only rows when chunking", () => {
    const table = [
      "date,category,amount",
      "2026-01-01,餐饮美食,12",
      "",
      ",,,",
      "   ",
      "2026-01-02,交通出行,8",
    ].join("\n");
    const { chunks, truncated } = splitSpreadsheetChunks(table);
    expect(truncated).toBe(false);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].split("\n")).toEqual([
      "date,category,amount",
      "2026-01-01,餐饮美食,12",
      "2026-01-02,交通出行,8",
    ]);
  });

  it("maps English catch-all categories without dropping the amount", () => {
    const { rows } = parseSpreadsheetImportPayload(
      {
        rows: [
          { date: "2025-10-01", category: "Others", amount: "38", currency: "HKD", note: "" },
          { date: "2025-10-02", category: "Services", amount: "10.82", currency: "HKD", note: "" },
        ],
      },
      { defaultCurrency: "HKD" },
    );
    expect(rows.map((row) => row.category)).toEqual(["日用百货", "日用百货"]);
    expect(rows.map((row) => row.amount)).toEqual(["38", "10.82"]);
  });

  it("chunks by row count so JSON output can fit", () => {
    const header = "date,category,amount";
    const line = "2026-01-01,餐饮美食,12";
    const modest = Array.from({ length: SPREADSHEET_ROWS_PER_CHUNK + 5 }, () => line).join("\n");
    const splitModest = splitSpreadsheetChunks(`${header}\n${modest}`);
    expect(splitModest.chunks).toHaveLength(2);
    expect(splitModest.truncated).toBe(false);

    const body = Array.from({ length: 4000 }, () => line).join("\n");
    const { chunks, truncated } = splitSpreadsheetChunks(`${header}\n${body}`);
    expect(chunks.length).toBe(SPREADSHEET_MAX_CHUNKS);
    expect(truncated).toBe(true);
    expect(chunks[0].length).toBeLessThanOrEqual(SPREADSHEET_CHUNK_CHARS + header.length + 2);
    expect(chunks[0].startsWith(header)).toBe(true);
    expect(chunks[0].split("\n").length - 1).toBe(SPREADSHEET_ROWS_PER_CHUNK);
  });
});
