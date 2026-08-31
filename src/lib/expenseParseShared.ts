import { classifyNlLedgerCategory } from "./nlLedgerClassifier";
import {
  CATEGORY_KEYWORDS,
  FALLBACK_CATEGORY_ZH,
  FOOD_DINING_CATEGORY_ZH,
  getCategoryKind,
  LEDGER_CATEGORIES,
  REPAY_FROM_OTHERS_CATEGORY_ZH,
} from "./nlLedgerCategories";

export { CATEGORY_KEYWORDS, LEDGER_CATEGORIES as QUICK_PARSER_CATEGORIES };

export const REPAY_FROM_OTHERS_PATTERN =
  /还我|還我|还给我|還給我|转我|轉我|转回|轉回|垫付收回|有人\s*A|A了?我|paid me back|transferred back|paid back my|repaid me/i;

export const OWN_SPLIT_BILL_PATTERN = /(?:^|[^\w])AA(?:\b)|分摊|分攤|go dutch|split (?:the )?bill/i;

export const CURRENCY_ALIASES: Record<string, string[]> = {
  HKD: ["HKD", "HK$", "港币", "港幣", "港元", "香港币", "香港幣", "香港元"],
  CNY: ["CNY", "RMB", "人民币", "人民幣", "¥", "￥"],
  USD: ["USD", "US$", "美元", "美金", "刀"],
  MOP: ["MOP", "澳门元", "澳門元", "葡币", "葡幣"],
  JPY: ["JPY", "日元", "日币", "日幣"],
  EUR: ["EUR", "欧元", "歐元"],
  KRW: ["KRW", "韩元", "韓元"],
  THB: ["THB", "泰铢", "泰銖"],
  SGD: ["SGD", "新加坡元", "新元"],
  NTD: ["NTD", "TWD", "新台币", "新台幣", "台币", "台幣"],
  NZD: ["NZD", "纽元", "紐元", "新西兰元", "新西蘭元"],
  GBP: ["GBP", "英镑", "英鎊"],
  AUD: ["AUD", "澳元"],
};

export const NEGATIVE_AMOUNT_PREFIX = /^\s*(?:[-−—+]?\s*)?(?:负|減|减)/i;

export const SEGMENT_SPLIT_PATTERN = /[\n,，、;；。!！?？]+/;

export const AMOUNT_PATTERN =
  /(?<![\dA-Za-z/-])[-−+]?\d+(?:\.\d{1,2})?\s*(?:HKD|CNY|RMB|USD|MOP|JPY|EUR|KRW|THB|SGD|NTD|TWD|NZD|GBP|AUD|港币|港幣|港元|香港币|香港幣|香港元|人民币|人民幣|美元|美金|澳门元|澳門元|葡币|葡幣|日元|日币|日幣|欧元|歐元|韩元|韓元|泰铢|泰銖|新加坡元|新元|新台币|新台幣|台币|台幣|纽元|紐元|新西兰元|新西蘭元|英镑|英鎊|澳元|块钱|块|元|¥|￥|\$|€|£|₩|฿)?(?![\d/-])/gi;

const amountPatternSingle = () => new RegExp(AMOUNT_PATTERN.source, "i");

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const findSplitBetween = (text: string, left: RegExpMatchArray, right: RegExpMatchArray) => {
  const leftEnd = (left.index ?? 0) + left[0].length;
  const rightStart = right.index ?? text.length;
  const between = text.slice(leftEnd, rightStart);
  const lowerBetween = between.toLowerCase();
  const threshold = leftEnd + Math.max(1, Math.floor(between.length * 0.35));

  let splitAt = rightStart;
  for (const [, keywords] of CATEGORY_KEYWORDS) {
    for (const keyword of [...keywords].sort((a, b) => b.length - a.length)) {
      const idx = lowerBetween.lastIndexOf(keyword.toLowerCase());
      if (idx < 0) continue;
      const pos = leftEnd + idx;
      if (pos >= threshold && pos < splitAt) splitAt = pos;
    }
  }
  if (splitAt < rightStart) return splitAt;

  const verb = between.search(/(?:花了|用了|付了|花费)/);
  if (verb >= 0) return leftEnd + verb;

  return rightStart;
};

const splitOnConjunction = (segment: string) => {
  const parts = segment.split(/\s*(?:和|跟|以及)\s*/);
  if (parts.length <= 1) return null;
  const pattern = amountPatternSingle();
  if (parts.every((part) => pattern.test(part))) return parts.map((part) => part.trim());
  return null;
};

export const currencyAliasPattern = new RegExp(
  Object.values(CURRENCY_ALIASES)
    .flat()
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|"),
  "gi",
);

export const normalizeCurrencyCode = (value: string) =>
  value.trim().toUpperCase().replace(/^TWD$/, "NTD");

export const normalizeCurrency = (value: string, currencies: readonly string[]) => {
  const code = normalizeCurrencyCode(value);
  return currencies.includes(code) ? code : null;
};

export const formatAmount = (amount: number) => {
  const rounded = Math.round((amount + Number.EPSILON) * 100) / 100;
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
};

export const normalizeNegativeAmountText = (text: string) =>
  text.replace(/(负|減|减)\s*(\d)/g, "-$2").replace(/(倒贴|倒貼)\s*(\d)/g, "-$2");

export const detectCategoryWithKeyword = (text: string, categories: readonly string[]) => {
  const amountMatch = text.match(amountPatternSingle());
  const anchor = amountMatch?.index ?? 0;
  const amountEnd = anchor + (amountMatch?.[0].length ?? 0);
  const lowerText = text.toLowerCase();

  type Candidate = { category: string; keyword: string; idx: number };
  const candidates: Candidate[] = [];

  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    if (!categories.includes(category)) continue;
    for (const keyword of keywords) {
      let searchFrom = 0;
      while (searchFrom < lowerText.length) {
        const idx = lowerText.indexOf(keyword.toLowerCase(), searchFrom);
        if (idx < 0) break;
        candidates.push({ category, keyword, idx });
        searchFrom = idx + 1;
      }
    }
  }

  if (!candidates.length) {
    const fallback = categories.includes(FALLBACK_CATEGORY_ZH)
      ? FALLBACK_CATEGORY_ZH
      : (categories[0] ?? FALLBACK_CATEGORY_ZH);
    return {
      category: fallback,
      matchedKeyword: null as string | null,
    };
  }

  const filtered = candidates.filter(
    (candidate) =>
      !candidates.some(
        (other) =>
          other !== candidate &&
          other.keyword.length > candidate.keyword.length &&
          other.idx <= candidate.idx &&
          other.idx + other.keyword.length >= candidate.idx + candidate.keyword.length,
      ),
  );

  const score = (candidate: Candidate) => {
    const beforeAmount = candidate.idx + candidate.keyword.length <= amountEnd + 1;
    const afterAmount = candidate.idx >= amountEnd - 1;
    const relevant = beforeAmount || afterAmount;
    const distance = Math.min(
      Math.abs(candidate.idx - anchor),
      Math.abs(candidate.idx + candidate.keyword.length - amountEnd),
    );
    return (relevant ? 0 : 100) + distance - candidate.keyword.length * 0.01;
  };

  filtered.sort((a, b) => score(a) - score(b));
  const best = filtered[0];
  return { category: best.category, matchedKeyword: best.keyword };
};

const CLASSIFIER_MIN_CONFIDENCE = 0.22;

const isStrongKeyword = (keyword: string | null) => {
  if (!keyword) return false;
  return keyword.length >= 2;
};

export const findLongestCategoryKeyword = (text: string, category: string) => {
  const phrases = CATEGORY_KEYWORDS.find(([name]) => name === category)?.[1] ?? [];
  const lowerText = text.toLowerCase();
  return (
    [...phrases]
      .filter((phrase) => lowerText.includes(phrase.toLowerCase()))
      .sort((a, b) => b.length - a.length)[0] ?? null
  );
};

/** Strong keywords (length ≥ 2) win; otherwise the n-gram classifier; else 日用百货. */
export const detectCategory = (text: string, categories: readonly string[]) => {
  const keywordHit = detectCategoryWithKeyword(text, categories);
  const prediction = classifyNlLedgerCategory(text);
  if (isStrongKeyword(keywordHit.matchedKeyword)) return keywordHit;
  if (
    prediction &&
    categories.includes(prediction.category) &&
    prediction.confidence >= CLASSIFIER_MIN_CONFIDENCE
  ) {
    return {
      category: prediction.category,
      matchedKeyword:
        findLongestCategoryKeyword(text, prediction.category) ?? keywordHit.matchedKeyword,
    };
  }
  return keywordHit;
};

export const detectCurrency = (
  text: string,
  currencies: readonly string[],
  defaultCurrency: string,
) => {
  const upperText = text.toUpperCase();
  const sortedAliases = Object.entries(CURRENCY_ALIASES)
    .flatMap(([currency, aliases]) => aliases.map((alias) => ({ currency, alias })))
    .sort((a, b) => b.alias.length - a.alias.length);

  for (const { currency, alias } of sortedAliases) {
    const normalized = normalizeCurrency(currency, currencies);
    if (!normalized) continue;
    if (upperText.includes(alias.toUpperCase())) return normalized;
  }

  if (/元|人民币|人民幣|¥|￥|CNY|RMB/i.test(text)) {
    const cny = normalizeCurrency("CNY", currencies);
    if (cny) return cny;
  }

  if (/块|块钱/i.test(text)) {
    const fallback =
      normalizeCurrency(defaultCurrency, currencies) ?? normalizeCurrency("CNY", currencies);
    if (fallback) return fallback;
  }

  const codeMatch = upperText.match(/\b[A-Z]{3}\b/);
  if (codeMatch) return normalizeCurrency(codeMatch[0], currencies) ?? defaultCurrency;
  return normalizeCurrency(defaultCurrency, currencies) ?? defaultCurrency;
};

export const detectAmount = (text: string) => {
  const normalizedText = normalizeNegativeAmountText(text);
  const amountMatch = normalizedText.match(amountPatternSingle());
  if (!amountMatch) return null;
  const token = amountMatch[0];
  const numericMatch = token.match(/[-−+]?\d+(?:\.\d{1,2})?/);
  if (!numericMatch) return null;
  const numeric = Number(numericMatch[0].replace("−", "-"));
  if (!Number.isFinite(numeric) || numeric === 0) return null;

  const hasExplicitNegative =
    numeric < 0 || /^[-−—]/.test(token.trim()) || NEGATIVE_AMOUNT_PREFIX.test(token);
  return formatAmount(hasExplicitNegative ? -Math.abs(numeric) : Math.abs(numeric));
};

export const applyCategoryAmountSign = (amount: string, category: string) => {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric) || numeric === 0) return amount;
  if (numeric < 0) return formatAmount(numeric);
  if (getCategoryKind(category) === "negative_expense") return formatAmount(-Math.abs(numeric));
  return formatAmount(Math.abs(numeric));
};

export const cleanNote = (segment: string, matchedKeyword: string | null) => {
  if (/AA\b|有人\s*A|A了?我|分摊|分攤/i.test(segment)) {
    return "AA";
  }

  const amountMatch = segment.match(amountPatternSingle());
  let residual = segment.trim();
  if (amountMatch) residual = residual.replace(amountMatch[0], " ").trim();

  residual = residual
    .replace(currencyAliasPattern, " ")
    .replace(/["'""'']/g, "")
    .replace(/花了|花费|消费|支出|用了|买了|支付|付了|付款|花|买|缴费|交了|交|吃了/g, " ")
    .replace(/今天|今日|昨天|昨日|前天|明天|后天|但是|不过|然后|而且|还有|另外/g, " ")
    .replace(/^我(?:的|们)?\s*/g, "")
    .replace(/\s*的\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!matchedKeyword) return residual;

  const expandPattern = new RegExp(
    `(?:[\\u4e00-\\u9fff]{0,2})${escapeRegExp(matchedKeyword)}(?:[\\u4e00-\\u9fffA-Za-z]{0,3})`,
    "i",
  );
  let expanded = (segment.match(expandPattern)?.[0] ?? matchedKeyword)
    .replace(/^我(?:的|们)?/, "")
    .trim();
  const keywordIdx = expanded.toLowerCase().indexOf(matchedKeyword.toLowerCase());
  if (keywordIdx >= 0) {
    const prefix = expanded.slice(0, keywordIdx);
    if (!prefix || /^[块元钱的了买\s]+$/u.test(prefix)) {
      expanded = expanded.slice(keywordIdx).trim();
    }
  }
  expanded = expanded.replace(/^(?:块|块钱|元|钱|的|了|买)+/u, "").trim();

  const residualWithoutDescriptor = residual
    .replace(expandPattern, " ")
    .replace(/\s+/g, " ")
    .trim();

  const isExtraContext =
    residualWithoutDescriptor.length >= 2 &&
    (/和|与|去|在|跟|同事|公司|朋友/.test(residualWithoutDescriptor) ||
      !residualWithoutDescriptor.replace(/\s/g, "").includes(matchedKeyword.charAt(0)));

  if (isExtraContext) return residualWithoutDescriptor;
  return (expanded || matchedKeyword).replace(/(?:花了|用了|付了|花费)$/u, "").trim();
};

export const splitContinuousSegment = (segment: string): string[] => {
  const conjunctionParts = splitOnConjunction(segment);
  if (conjunctionParts) return conjunctionParts.flatMap((part) => splitContinuousSegment(part));

  const amountPattern = new RegExp(AMOUNT_PATTERN.source, "gi");
  const matches = Array.from(segment.matchAll(amountPattern)).filter(
    (match) => typeof match.index === "number",
  );
  if (matches.length <= 1) return [segment];

  const parts: string[] = [];
  for (let index = 0; index < matches.length; index += 1) {
    const start = index === 0 ? 0 : findSplitBetween(segment, matches[index - 1], matches[index]);
    const end =
      index === matches.length - 1
        ? segment.length
        : findSplitBetween(segment, matches[index], matches[index + 1]);
    const part = segment.slice(start, end).trim();
    if (part) parts.push(part);
  }
  return parts;
};

export const splitExpenseSegments = (input: string) =>
  input
    .split(SEGMENT_SPLIT_PATTERN)
    .flatMap((part) => splitContinuousSegment(part.trim()))
    .map((part) => part.trim())
    .filter(Boolean);

export type ParsedExpenseSegment = {
  amount: string;
  currency: string;
  category: string;
  note: string;
};

export const parseExpenseSegment = (
  segment: string,
  categories: readonly string[],
  currencies: readonly string[],
  defaultCurrency: string,
): ParsedExpenseSegment | null => {
  const rawAmount = detectAmount(segment);
  if (!rawAmount) return null;

  const { category: detectedCategory, matchedKeyword } = detectCategory(segment, categories);
  let category = detectedCategory;
  if (
    REPAY_FROM_OTHERS_PATTERN.test(segment) &&
    categories.includes(REPAY_FROM_OTHERS_CATEGORY_ZH)
  ) {
    category = REPAY_FROM_OTHERS_CATEGORY_ZH;
  } else if (
    OWN_SPLIT_BILL_PATTERN.test(segment) &&
    (category === FALLBACK_CATEGORY_ZH || category === "其他") &&
    categories.includes(FOOD_DINING_CATEGORY_ZH)
  ) {
    category = FOOD_DINING_CATEGORY_ZH;
  }

  const amount = applyCategoryAmountSign(rawAmount, category);
  const currency = detectCurrency(segment, currencies, defaultCurrency);
  const note = cleanNote(segment, matchedKeyword);

  return { amount, currency, category, note };
};

export const parseExpenseSegments = (
  input: string,
  categories: readonly string[],
  currencies: readonly string[],
  defaultCurrency: string,
): ParsedExpenseSegment[] =>
  splitExpenseSegments(input)
    .map((segment) => parseExpenseSegment(segment, categories, currencies, defaultCurrency))
    .filter((record): record is ParsedExpenseSegment => Boolean(record));
