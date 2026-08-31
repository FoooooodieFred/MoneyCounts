/**
 * 用已配置的 LLM 把旧记账表格（CSV / TSV / 纯文本）映射成 MoneyCounts 词条。
 * 金额绝对值由模型输出，收入与负支出的符号由程序按分类补上。
 */
import { buildDateKey, isValidDateKey } from "./dateRange";
import { appendLlmCallLog, hostFromBaseUrl } from "./llmCallLog";
import { requestLlmChat } from "./llmChatClient";
import { isLlmApiVerified, type LlmApiSettings } from "./llmApiSettings";
import {
  applyCategoryAmountSign,
  extractJsonObject,
  isJsonModeUnsupported,
  resolveLlmCategory,
} from "./llmLedgerParser";
import { type LlmChatMessage } from "./llmProxy";
import { LEDGER_CATEGORY_DEFS } from "./nlLedgerCategories";
import type { LocalLedgerRecord } from "./localLedgerParser";

/** 每段行数压小，避免单次生成超过代理超时。 */
export const SPREADSHEET_ROWS_PER_CHUNK = 30;
export const SPREADSHEET_CHUNK_CHARS = 10_000;
export const SPREADSHEET_MAX_CHUNKS = 80;
export const SPREADSHEET_MAX_ROWS = 2_000;
export const SPREADSHEET_PARALLEL = 6;
/** 30 行 JSON 足够；拉太高会拖慢生成直至超时。 */
export const SPREADSHEET_CHUNK_MAX_TOKENS = 4_096;
export const LLM_SPREADSHEET_NOT_CONFIGURED = "请先到「API 看台」配置并验证 LLM 模型。";

export type SpreadsheetImportRow = LocalLedgerRecord;

export type SpreadsheetImportResult = {
  rows: SpreadsheetImportRow[];
  warnings: string[];
  truncated: boolean;
};

const DATE_KEYS = ["date", "日期", "记账日期", "交易日期", "时间", "time", "datetime"];
const CATEGORY_KEYS = ["category", "分类", "类别", "类目", "科目", "类型", "项目"];
const AMOUNT_KEYS = ["amount", "金额", "数额", "money", "value"];
const EXPENSE_KEYS = ["支出", "花费", "debit", "out"];
const INCOME_KEYS = ["收入", "credit", "in"];
const CURRENCY_KEYS = ["currency", "货币", "币种", "币别"];
const NOTE_KEYS = ["note", "备注", "说明", "摘要", "商家", "内容", "描述"];

const IMPORT_CATEGORY_ALIASES: Record<string, string> = {
  others: "日用百货",
  other: "日用百货",
  misc: "日用百货",
  miscellaneous: "日用百货",
  general: "日用百货",
  services: "日用百货",
  service: "日用百货",
  shopping: "商超购物",
  food: "餐饮美食",
  dining: "餐饮美食",
  transport: "交通出行",
  travel: "旅游度假",
};

const isBlankLedgerLine = (line: string) => {
  const trimmed = line.trim();
  if (!trimmed) return true;
  return /^[",\t\s]*$/.test(trimmed);
};

const resolveImportCategory = (raw: string) => {
  const aliased = IMPORT_CATEGORY_ALIASES[raw.trim().toLowerCase()];
  return resolveLlmCategory(aliased ?? raw);
};

const mapPool = async <T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
) => {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const index = cursor;
        cursor += 1;
        if (index >= items.length) return;
        results[index] = await mapper(items[index], index);
      }
    }),
  );
  return results;
};

const categoryCatalog = () =>
  LEDGER_CATEGORY_DEFS.map(
    (item) => `- ${item.zh} | ${item.en} | id=${item.id} | kind=${item.kind}`,
  ).join("\n");

const CURRENCY_ALIASES: Record<string, string> = {
  RMB: "CNY",
  人民币: "CNY",
  元: "CNY",
  块: "CNY",
  港币: "HKD",
  港元: "HKD",
  美金: "USD",
  美元: "USD",
  日元: "JPY",
  円: "JPY",
  TWD: "NTD",
  新台币: "NTD",
  台币: "NTD",
};

const HEADER_ALIASES: Record<string, "date" | "category" | "amount" | "currency" | "note"> = {
  date: "date",
  日期: "date",
  记账日期: "date",
  交易日期: "date",
  category: "category",
  分类: "category",
  类目: "category",
  类别: "category",
  科目: "category",
  amount: "amount",
  金额: "amount",
  支出: "amount",
  收入: "amount",
  currency: "currency",
  货币: "currency",
  币种: "currency",
  note: "note",
  备注: "note",
  说明: "note",
  摘要: "note",
};

export const looksLikeBinarySpreadsheet = (text: string) =>
  text.startsWith("PK") || text.slice(0, 256).includes("\0");

const excelSerialToDate = (serial: number) => {
  if (!Number.isFinite(serial) || serial < 20_000 || serial >= 80_000) return null;
  const utc = Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000;
  const parsed = new Date(utc);
  return buildDateKey(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, parsed.getUTCDate());
};

export const normalizeImportDate = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const serial = excelSerialToDate(Number(trimmed));
  if (serial) return serial;

  const datePart = trimmed.split(/[T\s]+/)[0]?.replace(/["']/g, "") ?? "";
  if (isValidDateKey(datePart)) return datePart;

  const iso = datePart.match(/^(\d{4})[./年-](\d{1,2})[./月-](\d{1,2})日?$/);
  if (iso) return buildDateKey(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const trailingYear = datePart.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (trailingYear) {
    const first = Number(trailingYear[1]);
    const second = Number(trailingYear[2]);
    const year = Number(trailingYear[3]);
    if (first > 12) return buildDateKey(year, second, first);
    if (second > 12) return buildDateKey(year, first, second);
    return buildDateKey(year, second, first);
  }

  return null;
};

const parseCsvLine = (line: string) => {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && quoted && line[index + 1] === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if ((char === "," || char === "\t") && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
};

export const splitSpreadsheetChunks = (text: string) => {
  const stripped = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (!stripped) return { chunks: [] as string[], truncated: false };

  const lines = stripped.split("\n");
  const header = lines[0] ?? "";
  const rest = lines.slice(1).filter((line) => !isBlankLedgerLine(line));
  if (!rest.length) {
    return {
      chunks: [stripped.slice(0, SPREADSHEET_CHUNK_CHARS)],
      truncated: stripped.length > SPREADSHEET_CHUNK_CHARS,
    };
  }

  const chunks: string[] = [];
  let buf: string[] = [];
  let len = 0;

  const flush = () => {
    if (!buf.length) return;
    chunks.push([header, ...buf].join("\n"));
    buf = [];
    len = 0;
  };

  for (let index = 0; index < rest.length; index += 1) {
    const line =
      rest[index].length > SPREADSHEET_CHUNK_CHARS
        ? rest[index].slice(0, SPREADSHEET_CHUNK_CHARS)
        : rest[index];
    const extra = line.length + 1;
    const wouldOverflow =
      buf.length >= SPREADSHEET_ROWS_PER_CHUNK ||
      (buf.length > 0 && len + extra > SPREADSHEET_CHUNK_CHARS);
    if (wouldOverflow) {
      flush();
      if (chunks.length >= SPREADSHEET_MAX_CHUNKS) {
        return { chunks, truncated: true };
      }
    }
    buf.push(line);
    len += extra;
  }
  if (buf.length) {
    if (chunks.length >= SPREADSHEET_MAX_CHUNKS) return { chunks, truncated: true };
    flush();
  }
  return { chunks, truncated: false };
};

const normalizeAmountRaw = (raw: unknown) => {
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[,，\s]/g, "")
    .replace(/HKD|USD|JPY|CNY|NTD|RMB/gi, "")
    .replace(/[¥$€£]/g, "")
    .replace(/元|港币|港元/g, "");
};

const normalizeImportCurrency = (raw: string, defaultCurrency: string) => {
  const trimmed = raw.trim();
  if (!trimmed) return defaultCurrency;
  const aliased = CURRENCY_ALIASES[trimmed] ?? CURRENCY_ALIASES[trimmed.toUpperCase()];
  const code = (aliased ?? trimmed).toUpperCase();
  if (code === "TWD") return "NTD";
  if (/^[A-Z]{3}$/.test(code)) return code;
  return defaultCurrency;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readString = (value: unknown) => {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
};

const lookupKey = (record: Record<string, unknown>, names: string[]) => {
  const entries = Object.entries(record);
  for (const name of names) {
    const direct = record[name];
    if (direct != null && readString(direct).trim()) return direct;
    const match = entries.find(([key]) => key.toLowerCase() === name.toLowerCase());
    if (match && readString(match[1]).trim()) return match[1];
  }
  return "";
};

const parseCsvTable = (csv: string): Record<string, string>[] => {
  const lines = csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map(
    (header) => HEADER_ALIASES[header.toLowerCase()] ?? HEADER_ALIASES[header] ?? header,
  );
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (
        header === "date" ||
        header === "category" ||
        header === "amount" ||
        header === "currency" ||
        header === "note"
      ) {
        row[header] = cells[index] ?? "";
      }
    });
    return row;
  });
};

const collectArrayField = (root: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = root[key];
    if (Array.isArray(value) && value.length) return value;
    const found = Object.keys(root).find((item) => item.toLowerCase() === key.toLowerCase());
    if (found && Array.isArray(root[found]) && root[found].length) return root[found] as unknown[];
  }
  return null;
};

const collectRawRows = (payload: unknown): { rows: unknown[]; warnings: string[] } => {
  const warnings: string[] = [];
  if (Array.isArray(payload)) {
    return { rows: payload, warnings };
  }

  const root = asRecord(payload);
  if (!root) return { rows: [], warnings: ["模型返回无法识别。"] };

  if (Array.isArray(root.warnings)) {
    for (const item of root.warnings) {
      if (typeof item === "string" && item.trim()) warnings.push(item.trim());
    }
  }

  const nested = collectArrayField(root, [
    "rows",
    "entries",
    "records",
    "data",
    "items",
    "明细",
    "流水",
  ]);
  if (nested) return { rows: nested, warnings };
  if (typeof root.csv === "string" && root.csv.trim()) {
    return { rows: parseCsvTable(root.csv), warnings };
  }
  return { rows: [], warnings };
};

const readAmount = (record: Record<string, unknown>) => {
  const explicit = lookupKey(record, AMOUNT_KEYS);
  if (readString(explicit).trim()) return explicit;
  const income = lookupKey(record, INCOME_KEYS);
  if (readString(income).trim()) return income;
  return lookupKey(record, EXPENSE_KEYS);
};

export const parseSpreadsheetImportPayload = (
  payload: unknown,
  options: { defaultCurrency: string },
): { rows: SpreadsheetImportRow[]; warnings: string[] } => {
  const { rows: rawRows, warnings } = collectRawRows(payload);
  const rows: SpreadsheetImportRow[] = [];

  rawRows.forEach((item, index) => {
    const record = asRecord(item);
    if (!record) {
      warnings.push(`第 ${index + 1} 条不是对象，已跳过。`);
      return;
    }
    const date = normalizeImportDate(readString(lookupKey(record, DATE_KEYS)));
    if (!date) {
      warnings.push(`第 ${index + 1} 条日期无效，已跳过。`);
      return;
    }
    const category = resolveImportCategory(readString(lookupKey(record, CATEGORY_KEYS)));
    const signed = applyCategoryAmountSign(category, normalizeAmountRaw(readAmount(record)));
    if (!signed) {
      warnings.push(`第 ${index + 1} 条金额无效，已跳过。`);
      return;
    }
    rows.push({
      date,
      category,
      amount: signed,
      currency: normalizeImportCurrency(
        readString(lookupKey(record, CURRENCY_KEYS)),
        options.defaultCurrency,
      ),
      note: readString(lookupKey(record, NOTE_KEYS))
        .replace(/["'“”‘’`]/g, "")
        .trim(),
    });
  });

  return { rows, warnings };
};

export const buildSpreadsheetImportSystemPrompt =
  () => `你是 MoneyCounts 的旧账本导入器。用户贴的是以前从 Excel / Numbers / 记账 App 导出的 CSV 或 TSV。把每一笔真实流水变成本账本词条。

只输出一个 JSON 对象。不要 Markdown、不要代码围栏、不要解释、不要顶层数组。不要在对象前面再写 {} 或 []，也不要输出第二份 JSON。

# 输出（键名必须是下面这些英文，不要用中文键）
{"rows":[{"date":"2024-03-01","category":"餐饮美食","amount":"45.5","currency":"HKD","note":"午餐"}],"warnings":[]}

# 字段
- date：只能是 YYYY-MM-DD。去掉时分秒。\`2024/3/1 0:00:00\`、\`2024年3月1日\`、\`2024.3.1\` → \`2024-03-01\`。不要输出 Excel 序列号。
- category：必须是下面 35 类的中文名。英文旧类名 Others / Other / Misc / General / Services → 日用百货（不要为此写 warnings）。Food → 餐饮美食；Shopping → 商超购物；Transport → 交通出行。其它对不上的支出也归日用百货，warnings 最多一句概括，不要逐行重复。
- amount：绝对值数字字符串，不要正负号、不要千分位、最多两位小数。符号由程序按分类处理。
- currency：大写 ISO。人民币/RMB/元 → CNY；港币 → HKD；台币/TWD → NTD。单元格没写货币时用用户给的「默认货币」。
- note：短备注（商家/事项）。不要重复分类名，除非那是店名。
- 不要输出 slot、hidden、序号。

# 旧表怎么读
- 表头可能是中文：日期/时间、分类/类别/科目、金额、支出、收入、备注/摘要/商家、货币。
- 若分开「支出」「收入」两列：有数的那列作为 amount；工资进收入列 → 工资收入；退款进收入列 → 对应退款类。
- 一行一笔。不要抽样、不要合并、不要编造。本段里能确定日期和金额的行都要进 rows。
- 无法确定日期或金额的行不要进 rows，写入 warnings（中文短句）。本段若有数据行，禁止写「全部为空/未包含流水」。

# 分类要点
- 工资/发薪 → 工资收入；兼职稿费外快 → 副业收入。不要把工资记成退款类。
- 别人还垫付款/转回来 → 他人还款。网购退货 → 购物退款。机票火车票演出票退款 → 票务退款。
- 外卖堂食咖啡奶茶 → 餐饮美食。超市生鲜 → 商超购物。纸巾洗衣液 → 日用百货。

# 35 类（中文名 | 英文 | id | kind）
${categoryCatalog()}

kind（你仍输出无符号金额）：expense 程序记正数；income（工资收入、副业收入）程序记负数；negative_expense（购物退款、票务退款、报销到账、优惠返现、他人还款）程序记负数。`;

export const buildSpreadsheetImportMessages = (options: {
  tableText: string;
  defaultCurrency: string;
  fileName: string;
  chunkIndex: number;
  chunkCount: number;
}): LlmChatMessage[] => [
  { role: "system", content: buildSpreadsheetImportSystemPrompt() },
  {
    role: "user",
    content: [
      `文件名：${options.fileName}`,
      `默认货币：${options.defaultCurrency}`,
      options.chunkCount > 1
        ? `这是表格的第 ${options.chunkIndex + 1}/${options.chunkCount} 段，请只转换本段出现的行。键名用英文 date/category/amount/currency/note。`
        : "请转换下面整份表格。键名用英文 date/category/amount/currency/note。",
      "",
      options.tableText,
    ].join("\n"),
  },
];

const completeSpreadsheetChunk = async (settings: LlmApiSettings, messages: LlmChatMessage[]) => {
  try {
    return await requestLlmChat({
      settings,
      messages,
      jsonMode: settings.jsonMode,
      maxTokens: SPREADSHEET_CHUNK_MAX_TOKENS,
      temperature: 0,
    });
  } catch (error) {
    if (settings.jsonMode && isJsonModeUnsupported(error)) {
      return await requestLlmChat({
        settings,
        messages,
        jsonMode: false,
        maxTokens: SPREADSHEET_CHUNK_MAX_TOKENS,
        temperature: 0,
      });
    }
    throw error;
  }
};

export const importSpreadsheetViaLlm = async (options: {
  tableText: string;
  fileName: string;
  defaultCurrency: string;
  settings: LlmApiSettings;
  onProgress?: (message: string) => void;
}): Promise<SpreadsheetImportResult> => {
  if (!isLlmApiVerified(options.settings)) {
    throw new Error(LLM_SPREADSHEET_NOT_CONFIGURED);
  }

  const { chunks, truncated } = splitSpreadsheetChunks(options.tableText);
  if (!chunks.length) {
    return { rows: [], warnings: ["表格是空的。"], truncated: false };
  }

  const warnings: string[] = [];
  const rows: SpreadsheetImportRow[] = [];
  const logBase = {
    model: options.settings.model,
    host: hostFromBaseUrl(options.settings.baseUrl),
    inputChars: options.tableText.length,
  };
  let completed = 0;
  let firstError: Error | null = null;

  options.onProgress?.(
    chunks.length > 1
      ? `正在并行识别 ${chunks.length} 段表格（${SPREADSHEET_PARALLEL} 路同时）…`
      : "正在用 LLM 识别表格…",
  );

  const chunkResults = await mapPool(chunks, SPREADSHEET_PARALLEL, async (chunk, index) => {
    const messages = buildSpreadsheetImportMessages({
      tableText: chunk,
      defaultCurrency: options.defaultCurrency,
      fileName: options.fileName,
      chunkIndex: index,
      chunkCount: chunks.length,
    });
    const started = Date.now();
    try {
      const completion = await completeSpreadsheetChunk(options.settings, messages);
      const parsed = parseSpreadsheetImportPayload(extractJsonObject(completion.content), {
        defaultCurrency: options.defaultCurrency,
      });
      appendLlmCallLog({
        at: Date.now(),
        ...logBase,
        ok: true,
        latencyMs: Date.now() - started,
        entryCount: parsed.rows.length,
      });
      return { rows: parsed.rows, warnings: parsed.warnings, error: null as string | null };
    } catch (error) {
      const message = error instanceof Error ? error.message : "模型识别失败。";
      if (!firstError) firstError = error instanceof Error ? error : new Error(message);
      appendLlmCallLog({
        at: Date.now(),
        ...logBase,
        ok: false,
        latencyMs: Date.now() - started,
        error: message,
      });
      return { rows: [] as SpreadsheetImportRow[], warnings: [] as string[], error: message };
    } finally {
      completed += 1;
      options.onProgress?.(
        chunks.length > 1
          ? `正在并行识别（已完成 ${completed}/${chunks.length}）…`
          : "正在用 LLM 识别表格…",
      );
    }
  });

  for (const [index, result] of chunkResults.entries()) {
    rows.push(...result.rows);
    const prefix = chunks.length > 1 ? `第 ${index + 1} 段：` : "";
    if (result.error) {
      warnings.push(`${prefix}${result.error}`);
      continue;
    }
    for (const warning of result.warnings) warnings.push(`${prefix}${warning}`);
  }

  if (!rows.length && firstError) {
    throw firstError;
  }

  if (truncated) warnings.unshift("表格过长，后半段未送入模型。");

  if (rows.length > SPREADSHEET_MAX_ROWS) {
    warnings.unshift(
      `识别结果超过 ${SPREADSHEET_MAX_ROWS} 条，只写入前 ${SPREADSHEET_MAX_ROWS} 条。`,
    );
    return { rows: rows.slice(0, SPREADSHEET_MAX_ROWS), warnings, truncated: true };
  }

  return { rows, warnings, truncated };
};
