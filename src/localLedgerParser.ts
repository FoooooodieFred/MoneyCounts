export type LocalLedgerRecord = {
  date: string;
  category: string;
  amount: string;
  currency: string;
  note: string;
  hidden?: boolean;
};

export type LocalLedgerParseContext = {
  selectedDate: string;
  defaultCurrency: string;
  categories: readonly string[];
  currencies: readonly string[];
};

export type LocalLedgerParseResult = {
  records: LocalLedgerRecord[];
  warnings: string[];
  source: "local";
};

const CATEGORY_KEYWORDS: Array<[string, string[]]> = [
  [
    "居住",
    [
      "洗衣",
      "干洗",
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
      "住宿",
      "酒店",
      "民宿",
      "押金",
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
    ],
  ],
  [
    "娱乐",
    [
      "电影",
      "影院",
      "游戏",
      "会员",
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
    ],
  ],
];

const CURRENCY_ALIASES: Record<string, string[]> = {
  HKD: ["HKD", "HK$", "港币", "港幣", "港元", "香港币", "香港幣", "香港元"],
  CNY: ["CNY", "RMB", "人民币", "人民幣", "元", "块", "块钱", "¥", "￥"],
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

const REFUND_PATTERN =
  /退款|退回|返还|返現|返现|退费|退票|冲抵|沖抵|冲销|沖銷|报销|报销到账|返利|抵扣|抵回|倒贴|倒貼|负向|refund|rebate|cashback|reversal|chargeback/i;
const NEGATIVE_AMOUNT_PREFIX = /^\s*(?:[-−—+]?\s*)?(?:负|減|减)/i;
const DATE_TOKEN_PATTERN =
  /\b20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b|\b\d{1,2}[-/.]\d{1,2}\b|20\d{2}年\d{1,2}月\d{1,2}[日号]?|\d{1,2}月\d{1,2}[日号]?|今天|今日|昨天|昨日|前天|明天|后天|大前天|大后天|(?:上|下|本|这)?(?:周|星期|礼拜)[一二三四五六日天]/g;
const AMOUNT_PATTERN =
  /(?<![\dA-Za-z/-])[-−+]?\d+(?:\.\d{1,2})?\s*(?:HKD|CNY|RMB|USD|MOP|JPY|EUR|KRW|THB|SGD|NTD|TWD|NZD|GBP|AUD|港币|港幣|港元|香港币|香港幣|香港元|人民币|人民幣|美元|美金|澳门元|澳門元|葡币|葡幣|日元|日币|日幣|欧元|歐元|韩元|韓元|泰铢|泰銖|新加坡元|新元|新台币|新台幣|台币|台幣|纽元|紐元|新西兰元|新西蘭元|英镑|英鎊|澳元|块钱|块|元|¥|￥|\$|€|£|₩|฿)?(?![\d/-])/gi;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const formatDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const parseDateKey = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const isValidDate = (date: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
};

const buildDate = (year: number, month: number, day: number) => {
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day
    ? formatDateKey(parsed)
    : null;
};

const shiftDateKey = (date: string, offset: number) => {
  const next = parseDateKey(date);
  next.setDate(next.getDate() + offset);
  return formatDateKey(next);
};

const normalizeCurrencyCode = (value: string) => value.trim().toUpperCase().replace(/^TWD$/, "NTD");

const normalizeCurrency = (value: string, currencies: readonly string[]) => {
  const code = normalizeCurrencyCode(value);
  return currencies.includes(code) ? code : null;
};

const detectWeekday = (text: string, selectedDate: string) => {
  const match = text.match(/(上|下|本|这)?(?:周|星期|礼拜)([一二三四五六日天])/);
  if (!match) return null;
  const weekdayMap: Record<string, number> = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    日: 7,
    天: 7,
  };
  const selected = parseDateKey(selectedDate);
  const currentDay = selected.getDay() || 7;
  const targetDay = weekdayMap[match[2]];
  const prefix = match[1];
  let offset = targetDay - currentDay;
  if (prefix === "上") offset -= 7;
  if (prefix === "下") offset += 7;
  return shiftDateKey(selectedDate, offset);
};

const detectDate = (text: string, selectedDate: string) => {
  const fullDate = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b|20(\d{2})年(\d{1,2})月(\d{1,2})[日号]?/);
  if (fullDate) {
    const year = Number(fullDate[1] ?? `20${fullDate[4]}`);
    const month = Number(fullDate[2] ?? fullDate[5]);
    const day = Number(fullDate[3] ?? fullDate[6]);
    const parsed = buildDate(year, month, day);
    if (parsed) return parsed;
  }

  const [, selectedYear] = selectedDate.match(/^(\d{4})-/) ?? [];
  const monthDay = text.match(/\b(\d{1,2})[-/.](\d{1,2})\b|(\d{1,2})月(\d{1,2})[日号]?/);
  if (monthDay && selectedYear) {
    const month = Number(monthDay[1] ?? monthDay[3]);
    const day = Number(monthDay[2] ?? monthDay[4]);
    const parsed = buildDate(Number(selectedYear), month, day);
    if (parsed) return parsed;
  }

  if (/大前天/.test(text)) return shiftDateKey(selectedDate, -3);
  if (/前天/.test(text)) return shiftDateKey(selectedDate, -2);
  if (/昨天|昨日/.test(text)) return shiftDateKey(selectedDate, -1);
  if (/今天|今日/.test(text)) return selectedDate;
  if (/大后天/.test(text)) return shiftDateKey(selectedDate, 3);
  if (/明天/.test(text)) return shiftDateKey(selectedDate, 1);
  if (/后天/.test(text)) return shiftDateKey(selectedDate, 2);

  return detectWeekday(text, selectedDate);
};

const detectCurrency = (text: string, currencies: readonly string[], defaultCurrency: string) => {
  const upperText = text.toUpperCase();
  const sortedAliases = Object.entries(CURRENCY_ALIASES).flatMap(([currency, aliases]) =>
    aliases.map((alias) => ({ currency, alias })),
  ).sort((a, b) => b.alias.length - a.alias.length);

  for (const { currency, alias } of sortedAliases) {
    const normalized = normalizeCurrency(currency, currencies);
    if (!normalized) continue;
    if (upperText.includes(alias.toUpperCase())) return normalized;
  }

  const codeMatch = upperText.match(/\b[A-Z]{3}\b/);
  if (codeMatch) return normalizeCurrency(codeMatch[0], currencies) ?? defaultCurrency;
  return defaultCurrency;
};

const detectCategory = (text: string, categories: readonly string[]) => {
  const lowerText = text.toLowerCase();
  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    if (!categories.includes(category)) continue;
    if (keywords.some((keyword) => lowerText.includes(keyword.toLowerCase()))) return category;
  }
  return categories.includes("其他") ? "其他" : categories[0] ?? "其他";
};

const formatAmount = (amount: number) => {
  const rounded = Math.round((amount + Number.EPSILON) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
};

const normalizeNegativeAmountText = (text: string) =>
  text
    .replace(/(负|減|减)\s*(\d)/g, "-$2")
    .replace(/(倒贴|倒貼)\s*(\d)/g, "-$2");

const detectAmount = (text: string) => {
  const normalizedText = normalizeNegativeAmountText(text);
  const amountMatch = normalizedText.match(AMOUNT_PATTERN);
  if (!amountMatch) return null;
  const token = amountMatch[0];
  const numericMatch = token.match(/[-−+]?\d+(?:\.\d{1,2})?/);
  if (!numericMatch) return null;
  const numeric = Number(numericMatch[0].replace("−", "-"));
  if (!Number.isFinite(numeric) || numeric === 0) return null;

  const hasExplicitNegative =
    numeric < 0 || /^[-−—]/.test(token.trim()) || NEGATIVE_AMOUNT_PREFIX.test(token);
  const hasRefundSemantics = REFUND_PATTERN.test(text) || /(负|減|减)\s*\d/.test(text);

  let amount = numeric;
  if (hasExplicitNegative) {
    amount = -Math.abs(numeric);
  } else if (numeric > 0 && hasRefundSemantics) {
    amount = -numeric;
  }

  return formatAmount(amount);
};

const currencyAliasPattern = new RegExp(
  Object.values(CURRENCY_ALIASES)
    .flat()
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|"),
  "gi",
);

const cleanNote = (segment: string) =>
  segment
    .replace(DATE_TOKEN_PATTERN, "")
    .replace(AMOUNT_PATTERN, "")
    .replace(currencyAliasPattern, "")
    .replace(/["'“”‘’`]/g, "")
    .replace(/花了|花费|消费|支出|用了|买了|支付|付了|付款|花|买|缴费|交了|交|充值/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[，,、;；。\s]+|[，,、;；。\s]+$/g, "")
    .trim();

const splitContinuousSegment = (segment: string) => {
  const matches = Array.from(segment.matchAll(AMOUNT_PATTERN)).filter((match) => typeof match.index === "number");
  if (matches.length <= 1) return [segment];

  const parts: string[] = [];
  let start = 0;
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const nextMatch = matches[index + 1];
    const end = nextMatch?.index ?? segment.length;
    const part = segment.slice(start, end).trim();
    if (part) parts.push(part);
    start = end;
  }
  return parts;
};

const splitSegments = (input: string) =>
  input
    .split(/[\n,，、;；。]+/)
    .flatMap((part) => splitContinuousSegment(part.trim()))
    .map((part) => part.trim())
    .filter(Boolean);

export const parseNaturalLedger = async (
  input: string,
  context: LocalLedgerParseContext,
): Promise<LocalLedgerParseResult> => {
  const warnings: string[] = [];
  const trimmed = input.trim();
  if (!trimmed) return { records: [], warnings: ["请输入自然语言账单。"], source: "local" };

  const fallbackDate = isValidDate(context.selectedDate) ? context.selectedDate : formatDateKey(new Date());
  const fallbackCurrency = context.currencies.includes(context.defaultCurrency)
    ? context.defaultCurrency
    : context.currencies[0] ?? "";
  const globalDate = detectDate(trimmed, fallbackDate);
  const segments = splitSegments(trimmed);
  const records = segments
    .map((segment) => {
      const amount = detectAmount(segment);
      if (!amount) {
        warnings.push(`已跳过未识别金额的片段：${segment}`);
        return null;
      }

      const date = detectDate(segment, fallbackDate) ?? globalDate ?? fallbackDate;
      const category = detectCategory(segment, context.categories);
      const currency = detectCurrency(segment, context.currencies, fallbackCurrency);
      const note = cleanNote(segment) || segment.replace(/["'“”‘’`]/g, "").trim();
      return { date, category, amount, currency, note };
    })
    .filter((record): record is LocalLedgerRecord => Boolean(record));

  if (!records.length && !warnings.length) warnings.push("未解析出可导入记录，请补充金额或换一种描述。");
  return { records, warnings, source: "local" };
};
