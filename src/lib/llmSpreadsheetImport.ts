/**
 * 用已配置的 LLM 把旧记账表格（CSV / TSV / 纯文本）映射成 MoneyCounts 词条。
 * 金额绝对值由模型输出，收入与负支出的符号由程序按分类补上。
 */
import { buildDateKey, isValidDateKey } from "./dateRange";
import { appendLlmCallLog, hostFromBaseUrl } from "./llmCallLog";
import { requestLlmChat } from "./llmChatClient";
import { isLlmApiVerified, type LlmApiSettings } from "./llmApiSettings";
import { applyCategoryAmountSign, extractJsonObject, resolveLlmCategory } from "./llmLedgerParser";
import type { LlmChatMessage } from "./llmProxy";
import { LEDGER_CATEGORY_DEFS } from "./nlLedgerCategories";
import type { LocalLedgerRecord } from "./localLedgerParser";

export const SPREADSHEET_CHUNK_CHARS = 12_000;
export const SPREADSHEET_MAX_CHUNKS = 4;
export const SPREADSHEET_MAX_ROWS = 400;
export const LLM_SPREADSHEET_NOT_CONFIGURED = "请先到「API 看台」配置并验证 LLM 模型。";

export type SpreadsheetImportRow = LocalLedgerRecord;

export type SpreadsheetImportResult = {
  rows: SpreadsheetImportRow[];
  warnings: string[];
  truncated: boolean;
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
  category: "category",
  分类: "category",
  类目: "category",
  类别: "category",
  amount: "amount",
  金额: "amount",
  currency: "currency",
  货币: "currency",
  币种: "currency",
  note: "note",
  备注: "note",
  说明: "note",
};

export const looksLikeBinarySpreadsheet = (text: string) =>
  text.startsWith("PK") || text.slice(0, 256).includes("\0");

export const normalizeImportDate = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (isValidDateKey(trimmed)) return trimmed;
  const iso = trimmed.match(/^(\d{4})[./年-](\d{1,2})[./月-](\d{1,2})日?$/);
  if (iso) return buildDateKey(Number(iso[1]), Number(iso[2]), Number(iso[3]));
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
    } else if (char === "," && !quoted) {
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
  if (stripped.length <= SPREADSHEET_CHUNK_CHARS) {
    return { chunks: [stripped], truncated: false };
  }

  const lines = stripped.split("\n");
  const header = lines[0] ?? "";
  const rest = lines.slice(1);
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
    if (buf.length && len + extra > SPREADSHEET_CHUNK_CHARS) {
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
    .replace(/[¥$€£HKDUSDJPYCNY]/gi, "")
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

const parseCsvTable = (csv: string): Record<string, string>[] => {
  const lines = csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map(
    (header) => HEADER_ALIASES[header.toLowerCase()] ?? header,
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

const collectRawRows = (payload: unknown): { rows: unknown[]; warnings: string[] } => {
  const warnings: string[] = [];
  const root = asRecord(payload);
  if (!root) return { rows: [], warnings: ["模型返回无法识别。"] };

  if (Array.isArray(root.warnings)) {
    for (const item of root.warnings) {
      if (typeof item === "string" && item.trim()) warnings.push(item.trim());
    }
  }

  if (Array.isArray(root.rows) && root.rows.length) return { rows: root.rows, warnings };
  if (Array.isArray(root.entries) && root.entries.length) return { rows: root.entries, warnings };
  if (typeof root.csv === "string" && root.csv.trim()) {
    return { rows: parseCsvTable(root.csv), warnings };
  }
  return { rows: [], warnings };
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
    const date = normalizeImportDate(readString(record.date));
    if (!date) {
      warnings.push(`第 ${index + 1} 条日期无效，已跳过。`);
      return;
    }
    const category = resolveLlmCategory(readString(record.category));
    const signed = applyCategoryAmountSign(category, normalizeAmountRaw(record.amount));
    if (!signed) {
      warnings.push(`第 ${index + 1} 条金额无效，已跳过。`);
      return;
    }
    rows.push({
      date,
      category,
      amount: signed,
      currency: normalizeImportCurrency(readString(record.currency), options.defaultCurrency),
      note: readString(record.note)
        .replace(/["'“”‘’`]/g, "")
        .trim(),
    });
  });

  return { rows, warnings };
};

export const buildSpreadsheetImportSystemPrompt =
  () => `你是 MoneyCounts 记账本的表格导入器。用户会贴一份以前用 Excel / Numbers / 其他记账软件导出的表格（CSV、TSV 或纯文本）。把每一笔真实流水映射成本账本词条。只输出一个 JSON 对象，不要 Markdown，不要解释。

# 输出 JSON
{
  "rows": [
    {
      "date": "2026-03-01",
      "category": "餐饮美食",
      "amount": "45.5",
      "currency": "HKD",
      "note": "午餐"
    }
  ],
  "warnings": []
}

规则：
- 表格里出现的每一笔有效流水都要进 rows，不要抽样、不要合并多笔、不要编造金额或日期。
- 无法确定金额或日期的行不要进 rows，写入 warnings（中文短句）。
- 不要输出 slot、hidden、序号。写入格子由程序分配。
- category 必须是下面 35 类的中文名。对不上的支出 → 日用百货，并在 warnings 说明。
- amount 只写数字绝对值（不要正负号、不要千分位、最多两位小数）。符号由程序按 kind 处理：expense 记正数；income（工资收入、副业收入）记负数；negative_expense（购物退款、票务退款、报销到账、优惠返现、他人还款）记负数。
- currency 用大写 ISO：CNY / HKD / USD / MOP / JPY / EUR / KRW / THB / SGD / NTD / NZD / GBP / AUD。人民币/RMB → CNY，港币 → HKD，台币/TWD → NTD。单元格没写货币时用「默认货币」。
- date 必须是 YYYY-MM-DD。把 2026/3/1、2026.03.01、2026年3月1日 转成 2026-03-01。不要输出 Excel 序列号。
- note 短：商家、事项或物品。去掉分类名重复，除非那是店名。
- 工资/发薪 → 工资收入；兼职稿费外快 → 副业收入。不要把工资记成负支出类。
- 别人还垫付款 / 转回来 → 他人还款。网购退货 → 购物退款。机票火车票演出票退款 → 票务退款。
- 外卖堂食咖啡奶茶 → 餐饮美食。超市生鲜 → 商超购物。纸巾洗衣液 → 日用百货。

# 35 类（中文名 | 英文 | id | kind）
${categoryCatalog()}`;

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
        ? `这是表格的第 ${options.chunkIndex + 1}/${options.chunkCount} 段，请只转换本段出现的行。`
        : "请转换下面整份表格。",
      "",
      options.tableText,
    ].join("\n"),
  },
];

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

  for (let index = 0; index < chunks.length; index += 1) {
    options.onProgress?.(
      chunks.length > 1 ? `正在识别表格（${index + 1}/${chunks.length}）…` : "正在用 LLM 识别表格…",
    );
    const messages = buildSpreadsheetImportMessages({
      tableText: chunks[index],
      defaultCurrency: options.defaultCurrency,
      fileName: options.fileName,
      chunkIndex: index,
      chunkCount: chunks.length,
    });
    const started = Date.now();
    try {
      const completion = await requestLlmChat({
        settings: options.settings,
        messages,
        jsonMode: true,
        maxTokens: 4096,
        temperature: 0,
      });
      const parsed = parseSpreadsheetImportPayload(extractJsonObject(completion.content), {
        defaultCurrency: options.defaultCurrency,
      });
      rows.push(...parsed.rows);
      warnings.push(...parsed.warnings);
      appendLlmCallLog({
        at: Date.now(),
        ...logBase,
        ok: true,
        latencyMs: Date.now() - started,
        entryCount: parsed.rows.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "模型识别失败。";
      appendLlmCallLog({
        at: Date.now(),
        ...logBase,
        ok: false,
        latencyMs: Date.now() - started,
        error: message,
      });
      throw new Error(message, { cause: error });
    }
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
