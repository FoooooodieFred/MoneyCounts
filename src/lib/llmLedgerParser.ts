/**
 * 用用户配置的 LLM 把自然语言打成账本词条；日期仍用 `date_spec` 规则展开。
 */
import { formatDateKey, isValidDateKey } from "./dateRange";
import { parseNlLedgerDateSpec, resolveNlLedgerDateSpec } from "./nlLedgerDateSpec";
import {
  FALLBACK_CATEGORY_ZH,
  LEDGER_CATEGORIES,
  LEDGER_CATEGORY_DEFS,
  getCategoryKind,
  remapLegacyCategoryName,
} from "./nlLedgerCategories";
import type {
  LocalLedgerParseContext,
  LocalLedgerParseResult,
  LocalLedgerRecord,
} from "./localLedgerParser";
import { isLlmApiConfigured, readLlmApiSettings, type LlmApiSettings } from "./llmApiSettings";
import { buildLedgerMessages } from "./llmLedgerPrompt";
import { requestLlmChat } from "./llmChatClient";
import { appendLlmCallLog, hostFromBaseUrl } from "./llmCallLog";

const MAX_RECORDS = 62;

export const LLM_NOT_CONFIGURED_MESSAGE = "请先到「API 看台」填写接口地址、模型与 API Key。";

export const extractJsonObject = (text: string): unknown => {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : trimmed).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new Error("模型没有返回 JSON。");
  }
};

export const formatSignedAmount = (value: number) => {
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
};

export const applyCategoryAmountSign = (category: string, rawAmount: string) => {
  const parsed = Number(rawAmount);
  if (!Number.isFinite(parsed) || parsed === 0) return null;
  const magnitude = Math.abs(parsed);
  const signed = getCategoryKind(category) === "negative_expense" ? -magnitude : magnitude;
  return formatSignedAmount(signed);
};

export const resolveLlmCategory = (raw: string) => {
  const trimmed = raw.trim();
  if (LEDGER_CATEGORIES.includes(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  const byEn = LEDGER_CATEGORY_DEFS.find((item) => item.en.toLowerCase() === lower);
  if (byEn) return byEn.zh;
  const byId = LEDGER_CATEGORY_DEFS.find((item) => item.id === lower || item.id === trimmed);
  if (byId) return byId.zh;
  const remapped = remapLegacyCategoryName(trimmed);
  if (LEDGER_CATEGORIES.includes(remapped)) return remapped;
  return FALLBACK_CATEGORY_ZH;
};

const normalizeCurrency = (raw: string, context: LocalLedgerParseContext) => {
  const code = raw.trim().toUpperCase();
  if (context.currencies.includes(code)) return code;
  if (code === "RMB" && context.currencies.includes("CNY")) return "CNY";
  if (code === "TWD" && context.currencies.includes("NTD")) return "NTD";
  return context.currencies.includes(context.defaultCurrency)
    ? context.defaultCurrency
    : (context.currencies[0] ?? "");
};

export const parseLlmLedgerPayload = (
  payload: unknown,
  context: LocalLedgerParseContext,
): LocalLedgerParseResult => {
  const warnings: string[] = [];
  if (!payload || typeof payload !== "object") {
    return { records: [], warnings: ["模型返回无法识别。"], source: "llm" };
  }

  const root = payload as { entries?: unknown; warnings?: unknown };
  if (Array.isArray(root.warnings)) {
    for (const item of root.warnings) {
      if (typeof item === "string" && item.trim()) warnings.push(item.trim());
    }
  }

  if (!Array.isArray(root.entries)) {
    warnings.push("模型未返回 entries 数组。");
    return { records: [], warnings, source: "llm" };
  }

  const fallbackDate = isValidDateKey(context.selectedDate)
    ? context.selectedDate
    : formatDateKey(new Date());
  const records: LocalLedgerRecord[] = [];

  root.entries.forEach((item, index) => {
    if (!item || typeof item !== "object") {
      warnings.push(`第 ${index + 1} 条不是对象，已跳过。`);
      return;
    }
    const entry = item as {
      date_spec?: unknown;
      category?: unknown;
      amount?: unknown;
      currency?: unknown;
      note?: unknown;
    };
    const amountRaw =
      typeof entry.amount === "number"
        ? String(entry.amount)
        : typeof entry.amount === "string"
          ? entry.amount.trim()
          : "";
    const categoryRaw = typeof entry.category === "string" ? entry.category : "";
    const category = resolveLlmCategory(categoryRaw);
    if (category === FALLBACK_CATEGORY_ZH && categoryRaw && categoryRaw !== FALLBACK_CATEGORY_ZH) {
      warnings.push(`第 ${index + 1} 条分类「${categoryRaw}」不在 35 类中，已归入日用百货。`);
    }
    const signed = applyCategoryAmountSign(category, amountRaw);
    if (!signed) {
      warnings.push(`第 ${index + 1} 条没有有效金额，已跳过。`);
      return;
    }

    let spec =
      typeof entry.date_spec === "string" && entry.date_spec.trim()
        ? entry.date_spec.trim()
        : "anchor";
    try {
      parseNlLedgerDateSpec(spec);
    } catch {
      warnings.push(`第 ${index + 1} 条 date_spec「${spec}」无效，已改用锚点日。`);
      spec = "anchor";
    }
    const dates = resolveNlLedgerDateSpec(spec, fallbackDate);
    const currency = normalizeCurrency(
      typeof entry.currency === "string" ? entry.currency : context.defaultCurrency,
      context,
    );
    const note = typeof entry.note === "string" ? entry.note.replace(/["'“”‘’`]/g, "").trim() : "";

    for (const date of dates) {
      records.push({ date, category, amount: signed, currency, note });
    }
  });

  const clipped = records.slice(0, MAX_RECORDS);
  if (records.length > MAX_RECORDS) {
    warnings.push(`展开后超过 ${MAX_RECORDS} 笔，已截断。`);
  }
  if (!clipped.length && !warnings.length) {
    warnings.push("未解析出可导入记录，请补充金额或换一种描述。");
  }
  return { records: clipped, warnings, source: "llm" };
};

const isJsonModeUnsupported = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return /response_format|json_object|json mode|json_schema/i.test(message);
};

export const parseNaturalLedgerViaLlm = async (
  input: string,
  context: LocalLedgerParseContext,
  settings: LlmApiSettings = readLlmApiSettings(),
): Promise<LocalLedgerParseResult> => {
  const trimmed = input.trim();
  if (!trimmed) return { records: [], warnings: ["请输入自然语言账单。"], source: "llm" };
  if (!isLlmApiConfigured(settings)) {
    return { records: [], warnings: [LLM_NOT_CONFIGURED_MESSAGE], source: "llm" };
  }

  const messages = buildLedgerMessages(trimmed, context, settings.customSystemPrompt);
  const started = Date.now();
  const logBase = {
    model: settings.model,
    host: hostFromBaseUrl(settings.baseUrl),
    inputChars: trimmed.length,
  };

  try {
    let completion;
    try {
      completion = await requestLlmChat({
        settings,
        messages,
        jsonMode: settings.jsonMode,
      });
    } catch (error) {
      if (settings.jsonMode && isJsonModeUnsupported(error)) {
        completion = await requestLlmChat({
          settings,
          messages,
          jsonMode: false,
        });
      } else {
        throw error;
      }
    }

    const payload = extractJsonObject(completion.content);
    const parsed = parseLlmLedgerPayload(payload, context);
    appendLlmCallLog({
      at: Date.now(),
      ...logBase,
      ok: true,
      latencyMs: Date.now() - started,
      entryCount: parsed.records.length,
    });
    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : "模型解析失败。";
    appendLlmCallLog({
      at: Date.now(),
      ...logBase,
      ok: false,
      latencyMs: Date.now() - started,
      error: message,
    });
    throw new Error(message, { cause: error });
  }
};
