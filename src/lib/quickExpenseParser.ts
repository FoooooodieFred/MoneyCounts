import {
  parseExpenseSegment,
  parseExpenseSegments,
  QUICK_PARSER_CATEGORIES,
  splitExpenseSegments,
  type ParsedExpenseSegment,
} from "./expenseParseShared";

export type QuickExpenseResult = ParsedExpenseSegment & {
  warnings: string[];
};

const SUPPORTED_CURRENCIES = ["CNY", "HKD", "USD", "MOP", "JPY", "EUR", "KRW", "THB", "SGD", "NTD", "NZD", "GBP", "AUD"];

function withWarnings(segment: ParsedExpenseSegment, text: string): QuickExpenseResult {
  const warnings: string[] = [];
  if (segment.category === "其他" && !/其他|other/i.test(text)) {
    warnings.push("未匹配到明确分类，已归入「其他」");
  }
  return { ...segment, warnings };
}

export function parseQuickExpense(input: string, defaultCurrency: string): QuickExpenseResult | null {
  const text = input.trim();
  if (!text) return null;

  const parsed = parseExpenseSegment(text, QUICK_PARSER_CATEGORIES, SUPPORTED_CURRENCIES, defaultCurrency);
  if (!parsed) return null;

  return withWarnings(parsed, text);
}

export function parseQuickExpenseLines(input: string, defaultCurrency: string): QuickExpenseResult[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  const sourceSegments = splitExpenseSegments(trimmed);
  return parseExpenseSegments(trimmed, QUICK_PARSER_CATEGORIES, SUPPORTED_CURRENCIES, defaultCurrency).map(
    (segment, index) => withWarnings(segment, sourceSegments[index] ?? trimmed),
  );
}

export { QUICK_PARSER_CATEGORIES };
