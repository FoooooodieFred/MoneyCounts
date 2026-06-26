export const QUICK_PARSER_CATEGORIES = [
  "餐饮",
  "交通",
  "购物",
  "居住",
  "通讯",
  "娱乐",
  "医疗",
  "教育",
  "旅行",
  "其他",
] as const;

export const CATEGORY_KEYWORDS: Array<[string, string[]]> = [
  [
    "居住",
    [
      "洗衣",
      "干洗",
      "洗衣服",
      "空调费",
      "冷气",
      "电费",
      "水费",
      "水电",
      "煤气",
      "燃气",
      "天然气",
      "物业",
      "管理费",
      "房租",
      "租金",
      "租房",
      "维修",
      "修理",
      "家具",
      "家电",
      "清洁",
      "保洁",
      "宽带",
      "网费",
      "网络费",
      "家政",
      "rent",
      "utility",
      "housing",
    ],
  ],
  [
    "通讯",
    [
      "手机费",
      "话费",
      "流量",
      "电话费",
      "电话卡",
      "sim",
      "sim卡",
      "通讯",
      "通信",
      "套餐",
      "漫游",
      "充值话费",
      "phone",
      "mobile",
      "data",
    ],
  ],
  [
    "餐饮",
    [
      "早餐",
      "早饭",
      "午餐",
      "午饭",
      "晚餐",
      "晚饭",
      "宵夜",
      "夜宵",
      "餐",
      "饭",
      "外卖",
      "餐厅",
      "饭店",
      "食堂",
      "咖啡",
      "奶茶",
      "茶餐厅",
      "星巴克",
      "饮料",
      "甜品",
      "蛋糕",
      "面包",
      "酒水",
      "吃",
      "喝",
      "food",
      "lunch",
      "dinner",
      "breakfast",
      "drink",
      "coffee",
      "tea",
    ],
  ],
  [
    "交通",
    [
      "打车",
      "的士",
      "出租",
      "网约车",
      "滴滴",
      "uber",
      "taxi",
      "地铁",
      "公交",
      "公交车",
      "巴士",
      "轻轨",
      "火车",
      "高铁",
      "动车",
      "机票",
      "航班",
      "机场",
      "车费",
      "油费",
      "停车",
      "过路费",
      "通行费",
      "交通",
      "船票",
      "轮渡",
      "transport",
      "metro",
      "subway",
      "bus",
      "train",
      "ride",
    ],
  ],
  [
    "购物",
    [
      "购物",
      "买",
      "购入",
      "淘宝",
      "天猫",
      "京东",
      "拼多多",
      "亚马逊",
      "超市",
      "便利店",
      "商场",
      "衣服",
      "鞋",
      "包",
      "护肤",
      "化妆",
      "日用品",
      "百货",
      "零食",
      "水果",
      "菜",
      "生鲜",
      "电子",
      "数码",
      "shopping",
      "mall",
      "store",
      "buy",
    ],
  ],
  [
    "娱乐",
    [
      "电影",
      "影院",
      "游戏",
      "会员",
      "充值",
      "演唱会",
      "音乐会",
      "展览",
      "酒吧",
      "ktv",
      "k歌",
      "剧本杀",
      "密室",
      "门票",
      "娱乐",
      "订阅",
      "spotify",
      "netflix",
      "迪士尼",
      "sport",
      "sports",
      "健身",
      "gym",
      "球",
      "entertainment",
      "movie",
      "game",
    ],
  ],
  [
    "医疗",
    [
      "医院",
      "诊所",
      "门诊",
      "挂号",
      "药",
      "药房",
      "看病",
      "牙医",
      "体检",
      "疫苗",
      "医疗",
      "医保",
      "理疗",
      "眼科",
      "health",
      "medical",
      "doctor",
      "pharmacy",
    ],
  ],
  [
    "教育",
    [
      "课程",
      "学费",
      "书",
      "教材",
      "培训",
      "教育",
      "考试",
      "报名费",
      "网课",
      "学习",
      "文具",
      "资料",
      "讲座",
      "education",
      "course",
      "book",
      "school",
    ],
  ],
  [
    "旅行",
    [
      "旅行",
      "旅游",
      "签证",
      "景点",
      "行李",
      "度假",
      "酒店",
      "民宿",
      "门票",
      "保险",
      "护照",
      "出游",
      "旅拍",
      "租车",
      "travel",
      "hotel",
      "flight",
      "trip",
    ],
  ],
  [
    "其他",
    ["其他", "other", "misc"],
  ],
];

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

export const REFUND_PATTERN =
  /退款|退回|返还|返現|返现|退费|退票|冲抵|沖抵|冲销|沖銷|报销|报销到账|返利|抵扣|抵回|倒贴|倒貼|负向|分摊|分攤|有人\s*A|A了?我|AA\b|还我|還我|还给我|還給我|发工资|發工資|工资到账|工資到賬|工资入账|工資入賬|薪资到账|薪資到賬|薪水|工资|工資|收入|进账|進賬|到账|到賬|refund|rebate|cashback|reversal|chargeback|salary|payday|income/i;

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

export const normalizeCurrencyCode = (value: string) => value.trim().toUpperCase().replace(/^TWD$/, "NTD");

export const normalizeCurrency = (value: string, currencies: readonly string[]) => {
  const code = normalizeCurrencyCode(value);
  return currencies.includes(code) ? code : null;
};

export const formatAmount = (amount: number) => {
  const rounded = Math.round((amount + Number.EPSILON) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
};

export const normalizeNegativeAmountText = (text: string) =>
  text
    .replace(/(负|減|减)\s*(\d)/g, "-$2")
    .replace(/(倒贴|倒貼)\s*(\d)/g, "-$2");

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
    return {
      category: categories.includes("其他") ? "其他" : categories[0] ?? "其他",
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

export const detectCurrency = (text: string, currencies: readonly string[], defaultCurrency: string) => {
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
    const fallback = normalizeCurrency(defaultCurrency, currencies) ?? normalizeCurrency("CNY", currencies);
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
  const hasRefundSemantics =
    REFUND_PATTERN.test(text) || /(负|減|减)\s*\d/.test(text);

  let amount = numeric;
  if (hasExplicitNegative) {
    amount = -Math.abs(numeric);
  } else if (numeric > 0 && hasRefundSemantics) {
    amount = -numeric;
  }

  return formatAmount(amount);
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
    `(?:[\\u4e00-\\u9fffA-Za-z]{0,2})${escapeRegExp(matchedKeyword)}(?:[\\u4e00-\\u9fffA-Za-z]{0,3})`,
    "i",
  );
  let expanded = (segment.match(expandPattern)?.[0] ?? matchedKeyword).replace(/^我(?:的|们)?/, "").trim();
  const keywordIdx = expanded.toLowerCase().indexOf(matchedKeyword.toLowerCase());
  if (keywordIdx >= 0) {
    const prefix = expanded.slice(0, keywordIdx);
    if (!prefix || /^[块元钱的了\s]+$/u.test(prefix)) {
      expanded = expanded.slice(keywordIdx).trim();
    }
  }
  expanded = expanded.replace(/^(?:块|块钱|元|钱|的|了)+/u, "").trim();

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
  const matches = Array.from(segment.matchAll(amountPattern)).filter((match) => typeof match.index === "number");
  if (matches.length <= 1) return [segment];

  const parts: string[] = [];
  for (let index = 0; index < matches.length; index += 1) {
    const start = index === 0 ? 0 : findSplitBetween(segment, matches[index - 1], matches[index]);
    const end = index === matches.length - 1 ? segment.length : findSplitBetween(segment, matches[index], matches[index + 1]);
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
  const amount = detectAmount(segment);
  if (!amount) return null;

  const { category: detectedCategory, matchedKeyword } = detectCategoryWithKeyword(segment, categories);
  const isSplitBill = /AA\b|有人\s*A|A了?我|分摊|分攤/i.test(segment);
  const category = isSplitBill && detectedCategory === "其他" ? "餐饮" : detectedCategory;
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
