/**
 * Live 35-class ledger taxonomy (aligned with `data/nl-ledger/categories.json`).
 * Used by the parser, day-grid layout, settings budgets, and CSV import.
 */
export type LedgerCategoryKind = "expense" | "income" | "negative_expense";

export type LedgerCategoryDef = {
  id: string;
  zh: string;
  en: string;
  kind: LedgerCategoryKind;
};

export const LEDGER_CATEGORY_DEFS = [
  { id: "food_dining", zh: "餐饮美食", en: "Food and Dining", kind: "expense" },
  { id: "transport", zh: "交通出行", en: "Transport", kind: "expense" },
  { id: "groceries", zh: "商超购物", en: "Groceries", kind: "expense" },
  { id: "household_goods", zh: "日用百货", en: "Household Goods", kind: "expense" },
  { id: "rent", zh: "房屋租金", en: "Rent", kind: "expense" },
  { id: "property_mgmt", zh: "物业费用", en: "Property Fees", kind: "expense" },
  { id: "utilities", zh: "水电燃气", en: "Utilities", kind: "expense" },
  { id: "mobile_phone", zh: "通讯话费", en: "Mobile and Phone", kind: "expense" },
  { id: "broadband", zh: "宽带网络", en: "Broadband", kind: "expense" },
  { id: "medical", zh: "医疗诊疗", en: "Medical Care", kind: "expense" },
  { id: "pharmacy", zh: "药品保健", en: "Pharmacy", kind: "expense" },
  { id: "education", zh: "教育学习", en: "Education", kind: "expense" },
  { id: "books_stationery", zh: "书籍文具", en: "Books and Stationery", kind: "expense" },
  { id: "leisure", zh: "休闲娱乐", en: "Leisure", kind: "expense" },
  { id: "shows_media", zh: "影视演出", en: "Shows and Media", kind: "expense" },
  { id: "fitness", zh: "运动健身", en: "Fitness", kind: "expense" },
  { id: "travel", zh: "旅游度假", en: "Travel", kind: "expense" },
  { id: "lodging", zh: "酒店住宿", en: "Lodging", kind: "expense" },
  { id: "gifts", zh: "人情送礼", en: "Gifts", kind: "expense" },
  { id: "red_packet", zh: "红包礼金", en: "Red Packets", kind: "expense" },
  { id: "pets", zh: "宠物养护", en: "Pets", kind: "expense" },
  { id: "apparel", zh: "服饰鞋包", en: "Apparel", kind: "expense" },
  { id: "beauty", zh: "美容个护", en: "Beauty", kind: "expense" },
  { id: "electronics", zh: "数码产品", en: "Electronics", kind: "expense" },
  { id: "home_decor", zh: "家居家装", en: "Home and Decor", kind: "expense" },
  { id: "insurance", zh: "保险缴费", en: "Insurance", kind: "expense" },
  { id: "loan_repay", zh: "还贷支出", en: "Loan Repayment", kind: "expense" },
  { id: "tax", zh: "税费支出", en: "Taxes", kind: "expense" },
  { id: "salary", zh: "工资收入", en: "Salary", kind: "income" },
  { id: "side_income", zh: "副业收入", en: "Side Income", kind: "income" },
  { id: "refund_shopping", zh: "购物退款", en: "Shopping Refunds", kind: "negative_expense" },
  { id: "refund_tickets", zh: "票务退款", en: "Ticket Refunds", kind: "negative_expense" },
  { id: "reimbursement", zh: "报销到账", en: "Reimbursement", kind: "negative_expense" },
  { id: "cashback", zh: "优惠返现", en: "Cashback", kind: "negative_expense" },
  {
    id: "repay_from_others",
    zh: "他人还款",
    en: "Repayment from Others",
    kind: "negative_expense",
  },
] as const satisfies readonly LedgerCategoryDef[];

export const LEDGER_CATEGORIES: readonly string[] = LEDGER_CATEGORY_DEFS.map((item) => item.zh);

export const FALLBACK_CATEGORY_ZH = "日用百货";
export const FOOD_DINING_CATEGORY_ZH = "餐饮美食";
export const REPAY_FROM_OTHERS_CATEGORY_ZH = "他人还款";

export const LEGACY_TEN_CATEGORIES = [
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

/** Old 10-class names → canonical 35-class Chinese names (1-to-1 for stored slots). */
export const LEGACY_CATEGORY_NAME_MAP: Record<(typeof LEGACY_TEN_CATEGORIES)[number], string> = {
  餐饮: "餐饮美食",
  交通: "交通出行",
  购物: "商超购物",
  居住: "房屋租金",
  通讯: "通讯话费",
  娱乐: "休闲娱乐",
  医疗: "医疗诊疗",
  教育: "教育学习",
  旅行: "旅游度假",
  其他: "日用百货",
};

const CATEGORY_ZH_SET = new Set<string>(LEDGER_CATEGORIES);

export const remapLegacyCategoryName = (name: string) => {
  if (CATEGORY_ZH_SET.has(name)) return name;
  return LEGACY_CATEGORY_NAME_MAP[name as (typeof LEGACY_TEN_CATEGORIES)[number]] ?? name;
};

export const LEGACY_CATEGORY_INDEX_MAP = LEGACY_TEN_CATEGORIES.map((name) =>
  LEDGER_CATEGORIES.indexOf(LEGACY_CATEGORY_NAME_MAP[name]),
);

const KIND_BY_ZH = Object.fromEntries(
  LEDGER_CATEGORY_DEFS.map((item) => [item.zh, item.kind]),
) as Record<string, LedgerCategoryKind>;

export const getCategoryKind = (zh: string): LedgerCategoryKind => KIND_BY_ZH[zh] ?? "expense";

export const remapLegacyCategoryLimits = (limits: Record<string, unknown>) => {
  const next: Record<string, number> = {};
  for (const [name, raw] of Object.entries(limits)) {
    const parsed =
      typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;
    if (!Number.isFinite(parsed) || parsed <= 0) continue;
    const mapped = remapLegacyCategoryName(name);
    if (!CATEGORY_ZH_SET.has(mapped)) continue;
    if (mapped in next && name !== mapped) continue;
    next[mapped] = parsed;
  }
  return next;
};

/**
 * Keyword tables for the rule parser. Longer / more specific phrases win via
 * nested-keyword filtering in `detectCategoryWithKeyword`.
 * Negative-expense and income classes are listed first so equal scores prefer them.
 */
export const CATEGORY_KEYWORDS: Array<[string, string[]]> = [
  [
    "他人还款",
    [
      "还我",
      "還我",
      "还给我",
      "還給我",
      "转我",
      "轉我",
      "转回",
      "轉回",
      "垫付收回",
      "有人a",
      "a了我",
      "paid me back",
      "paid back",
      "transferred back",
      "repaid me",
    ],
  ],
  [
    "购物退款",
    [
      "购物退款",
      "淘宝退款",
      "天猫退款",
      "京东退款",
      "拼多多退",
      "退货退款",
      "商品退款",
      "订单退款",
      "退款",
      "退货",
      "refund",
      "chargeback",
    ],
  ],
  [
    "票务退款",
    [
      "机票退款",
      "火车票退",
      "退票",
      "票务退款",
      "演出退票",
      "电影退票",
      "门票退",
      "flight refund",
      "ticket refund",
    ],
  ],
  ["报销到账", ["报销到账", "报销入账", "报销", "invoice reimburs", "reimbursement", "reimbursed"]],
  ["优惠返现", ["优惠返现", "返现", "返現", "返利", "cashback", "rebate", "cash back"]],
  [
    "工资收入",
    [
      "发工资",
      "發工資",
      "工资到账",
      "工資到賬",
      "工资入账",
      "薪资到账",
      "交通补贴",
      "发薪",
      "薪水",
      "薪资",
      "工资",
      "工資",
      "salary",
      "payday",
      "paycheck",
    ],
  ],
  ["副业收入", ["副业", "兼职", "稿费", "外快", "freelance", "side hustle", "side income"]],
  [
    "餐饮美食",
    [
      "星巴克",
      "茶餐厅",
      "外卖",
      "餐厅",
      "饭店",
      "食堂",
      "早餐",
      "早饭",
      "午餐",
      "午饭",
      "晚餐",
      "晚饭",
      "宵夜",
      "夜宵",
      "奶茶",
      "咖啡",
      "甜品",
      "蛋糕",
      "面包",
      "酒水",
      "饮料",
      "聚餐",
      "餐饮",
      "吃饭",
      "food",
      "lunch",
      "dinner",
      "breakfast",
      "brunch",
      "coffee",
      "starbucks",
      "tea",
      "drink",
    ],
  ],
  [
    "交通出行",
    [
      "网约车",
      "公交车",
      "过路费",
      "通行费",
      "滴滴",
      "的士",
      "出租",
      "打车",
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
      "加油",
      "停车",
      "船票",
      "轮渡",
      "交通",
      "uber",
      "taxi",
      "transport",
      "metro",
      "subway",
      "bus",
      "train",
      "ride",
    ],
  ],
  [
    "商超购物",
    [
      "便利店",
      "超市",
      "商场",
      "生鲜",
      "水果",
      "零食",
      "菜",
      "淘宝",
      "天猫",
      "京东",
      "拼多多",
      "亚马逊",
      "网购",
      "购物",
      "grocer",
      "supermarket",
      "costco",
      "mall",
    ],
  ],
  [
    "日用百货",
    [
      "洗衣服",
      "洗衣液",
      "干洗",
      "洗衣",
      "日用品",
      "纸巾",
      "垃圾袋",
      "百货",
      "household",
      "detergent",
      "laundry",
    ],
  ],
  ["房屋租金", ["房租", "租金", "租房", "rent"]],
  ["物业费用", ["物业费", "管理费", "物业", "property fee", "management fee"]],
  [
    "水电燃气",
    [
      "水电费",
      "电费",
      "水费",
      "水电",
      "煤气",
      "燃气",
      "天然气",
      "空调费",
      "冷气",
      "utility",
      "electricity",
      "gas bill",
    ],
  ],
  [
    "通讯话费",
    [
      "充值话费",
      "手机费",
      "电话费",
      "电话卡",
      "话费",
      "流量",
      "通讯",
      "通信",
      "漫游",
      "套餐",
      "sim卡",
      "sim",
      "phone bill",
      "mobile",
    ],
  ],
  ["宽带网络", ["宽带", "网费", "网络费", "wifi", "broadband", "internet bill"]],
  [
    "医疗诊疗",
    [
      "医院",
      "诊所",
      "门诊",
      "挂号",
      "看病",
      "牙医",
      "体检",
      "疫苗",
      "理疗",
      "眼科",
      "医疗",
      "clinic",
      "doctor",
      "hospital",
      "medical",
    ],
  ],
  [
    "药品保健",
    ["药房", "药店", "买药", "保健品", "维生素", "药", "pharmacy", "medicine", "vitamin"],
  ],
  [
    "教育学习",
    [
      "学费",
      "培训",
      "网课",
      "课程",
      "考试",
      "报名费",
      "讲座",
      "教育",
      "学习",
      "education",
      "course",
      "tuition",
      "school",
    ],
  ],
  ["书籍文具", ["文具", "教材", "笔记本", "书籍", "买书", "stationery", "textbook", "notebook"]],
  [
    "休闲娱乐",
    [
      "剧本杀",
      "密室",
      "游戏",
      "会员",
      "充值",
      "订阅",
      "酒吧",
      "ktv",
      "k歌",
      "娱乐",
      "spotify",
      "netflix",
      "disney",
      "game",
      "entertainment",
    ],
  ],
  [
    "影视演出",
    [
      "演唱会",
      "音乐会",
      "电影票",
      "影院",
      "电影",
      "展览",
      "演出",
      "concert",
      "movie",
      "cinema",
      "show ticket",
    ],
  ],
  [
    "运动健身",
    ["健身房", "健身", "瑜伽", "游泳", "球场", "gym", "fitness", "yoga", "sport", "sports"],
  ],
  [
    "旅游度假",
    ["景点门票", "旅行", "旅游", "度假", "签证", "护照", "出游", "旅拍", "景点", "travel", "trip"],
  ],
  ["酒店住宿", ["民宿", "酒店", "住宿", "宾馆", "hotel", "airbnb", "lodging"]],
  ["人情送礼", ["人情", "送礼", "礼物", "礼品", "gift", "present"]],
  ["红包礼金", ["红包", "利是", "礼金", "份子钱", "red packet", "hongbao"]],
  ["宠物养护", ["宠物", "猫粮", "狗粮", "猫咪", "狗狗", "pet", "vet"]],
  ["服饰鞋包", ["衣服", "鞋子", "包包", "服饰", "鞋", "衣", "apparel", "shoes", "clothes"]],
  [
    "美容个护",
    ["护肤品", "化妆品", "护肤", "化妆", "美容", "美发", "个护", "skincare", "makeup", "beauty"],
  ],
  [
    "数码产品",
    ["数码", "电子产品", "手机", "耳机", "电脑", "键盘", "electronics", "gadget", "iphone"],
  ],
  ["家居家装", ["家装", "家具", "家电", "装修", "窗帘", "灯具", "furniture", "decor"]],
  ["保险缴费", ["保险", "保费", "insurance", "premium"]],
  ["还贷支出", ["还贷", "房贷", "车贷", "贷款", "loan", "mortgage"]],
  ["税费支出", ["个税", "税费", "税", "tax", "irs"]],
];

export const TRAVEL_BUDGET_CATEGORIES = ["餐饮美食", "交通出行", "商超购物", "旅游度假"] as const;
