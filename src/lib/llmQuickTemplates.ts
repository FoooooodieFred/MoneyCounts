/**
 * 连通成功后，用 LLM 生成 3 条带 `__` 金额空位的快捷模板。
 */
import { TEMPLATE_AMOUNT_SLOT, pickRandomTemplates } from "./quickTemplates";
import { isLlmApiVerified, type LlmApiSettings } from "./llmApiSettings";
import { requestLlmChat } from "./llmChatClient";
import { extractJsonObject } from "./llmLedgerParser";
import {
  buildQuickTemplatesSystemPrompt,
  buildQuickTemplatesUserPrompt,
} from "./llmLedgerPrompt";

export const parseQuickTemplatePayload = (payload: unknown): string[] => {
  if (!payload || typeof payload !== "object") return [];
  const templates = (payload as { templates?: unknown }).templates;
  if (!Array.isArray(templates)) return [];
  const cleaned = templates
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter((item) => item.includes(TEMPLATE_AMOUNT_SLOT) && item.length <= 24);
  return [...new Set(cleaned)].slice(0, 3);
};

export const fetchLlmQuickTemplates = async (
  settings: LlmApiSettings,
  fallbackCount = 3,
): Promise<string[]> => {
  if (!isLlmApiVerified(settings)) return pickRandomTemplates(fallbackCount);
  try {
    const completion = await requestLlmChat({
      settings,
      messages: [
        { role: "system", content: buildQuickTemplatesSystemPrompt() },
        { role: "user", content: buildQuickTemplatesUserPrompt() },
      ],
      jsonMode: settings.jsonMode,
      maxTokens: 200,
      temperature: 0.8,
    });
    const parsed = parseQuickTemplatePayload(extractJsonObject(completion.content));
    if (parsed.length === 3) return parsed;
  } catch {
    /* fall back */
  }
  return pickRandomTemplates(fallbackCount);
};
