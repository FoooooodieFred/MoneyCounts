import { stripHiddenThink } from "./chatDisplay";
import {
  formatWeekday,
  getMonthKey,
  getToday,
  parseDateKey,
  shiftDateKey,
  shiftMonthKey,
} from "./dateRange";
import type { LlmApiSettings } from "./llmApiSettings";
import { requestLlmChat } from "./llmChatClient";
import type { LlmChatMessage, LlmToolCallPayload } from "./llmProxy";
import { cardsFromToolOutput, mergeMoneyMoreCards, type MoneyMoreCard } from "./moneyMoreCards";
import { LEDGER_CATEGORY_DEFS } from "./nlLedgerCategories";
import {
  clipToolOutput,
  executeMoneyMoreTool,
  getMoneyMoreTools,
  parseToolArguments,
  type MoneyMoreToolContext,
} from "./moneyMoreTools";

export const MONEY_MORE_NAME = "MoneyMore";
const MAX_TOOL_ROUNDS = 8;

const categoriesByKind = (kind: (typeof LEDGER_CATEGORY_DEFS)[number]["kind"]) =>
  LEDGER_CATEGORY_DEFS.filter((item) => item.kind === kind)
    .map((item) => item.zh)
    .join("、");

const mondayWeekRange = (date: string) => {
  const weekday = parseDateKey(date).getDay() || 7;
  const start = shiftDateKey(date, 1 - weekday);
  return { start, end: shiftDateKey(start, 6) };
};

export const MONEY_MORE_SYSTEM_PROMPT = `你是 MoneyMore，MoneyCounts 里的本地记账 Agent。像靠谱的账房先生：先把数算对，再用短句讲清楚。语气冷静、具体，不卖萌，不说废话。

## 绝对禁止
- 编造账单、金额、分类、日期、汇率或预算；没有工具结果就说「账本里没有」
- 心算任何金额；加减乘除、人均、税费、汇率草稿都要调用 calculate
- 输出 <think>、思考、推理过程、工具名、JSON、或「我调用了xxx」
- 自造分类名；必须用清单里的中文分类
- 谈旅游模式，除非用户主动问

## 工具怎么选
- 本月/某月总览、预算、分类占比、待报销、结余 → month_stats（要对比就调两次，例如本月和上月）
- 某天、某段、某商户、某分类明细 → search_records（用 dateFrom/dateTo；这周用系统给的周起止）
- 分类有哪些 → list_categories
- 用户要记账 → draft_ledger_records；系统会弹出确认卡片，你不必再让用户口头复述一遍
- 用户要改已有账单 → 仅当系统提示已开启删改权限时，先 search_records 拿到 id，再 update_ledger_records
- 用户要删已有账单 → 仅当已开启删改权限时，先 search_records 拿到 id，再 delete_ledger_records
- 未开启删改权限时，不要假装已改/已删；请用户到设置打开「允许修改和删除账本」

## 记账规则
- 「今天」= 选中日期（不一定是日历上的今天）；「昨天」= 选中日期前一天；用户说具体日期则用该日期
- 没说货币就用默认货币；「港币/HK」→ HKD，「人民币/RMB」→ CNY
- 支出、转出为正数；工资、副业、退款、报销到账、优惠返现、他人还款为负数
- 能合理推断日期/分类/金额/货币时立刻 draft，不要为了确认而确认。只在缺金额、或两种分类一样可能时，问一个最短的问题
- 一句话多笔（「咖啡 18 午餐 45」）拆成多条一起 draft
- 备注保留用户原话里的商户/场景；待报销写进 note（如「待报销」）
- draft 之后用一句话说明记了什么，并提醒点「确认记账」才会写入
- 改账/删账之后说明将改什么或删什么，并提醒点对话框里的确认才会生效

## 回答方式
- 先结论后依据。关键数字用 **加粗**，也可用列表；系统会另附统计卡片，正文不要把卡片数字再抄一遍
- 找不到数据就直说，并给出下一步（换月份、放宽关键词、或直接记账）
- 超出记账范围的问题：一句回绝，把话题拉回账本
- 只用中文`;

const FALLBACK_TOOL_PATTERN =
  /^\s*\{[\s\S]*"(?:tool_name|name|tool)"\s*:\s*"([a-zA-Z0-9_]+)"[\s\S]*\}\s*$/;

const parseFallbackTool = (content: string): { name: string; args: unknown } | null => {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : trimmed).trim();
  if (!FALLBACK_TOOL_PATTERN.test(body) && !/"arguments"\s*:/.test(body)) return null;
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    const name = String(parsed.tool_name ?? parsed.name ?? parsed.tool ?? "").trim();
    if (!name) return null;
    const args = parsed.arguments ?? parsed.params ?? parsed;
    return { name, args };
  } catch {
    return null;
  }
};

export const formatElapsedMs = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

export const buildMoneyMoreSystemMessage = (context: MoneyMoreToolContext): LlmChatMessage => {
  const calendarToday = getToday();
  const selected = context.selectedDate;
  const week = mondayWeekRange(selected);
  const month = getMonthKey(selected);
  const visibleCount = context.records.filter((record) => !record.hidden).length;
  return {
    role: "system",
    content: [
      MONEY_MORE_SYSTEM_PROMPT,
      `选中日期：${selected}（${formatWeekday(selected)}）。日历今天：${calendarToday}。`,
      `选中日期所在周（周一至周日）：${week.start} ~ ${week.end}`,
      `选中月份：${month}；上一月：${shiftMonthKey(month, -1)}`,
      `默认货币：${context.defaultCurrency}；可用货币：${context.currencies.join("、")}`,
      context.budget.enabled
        ? `月预算已开启：${context.budget.monthlyLimit ?? "未设金额"} ${context.budget.currency ?? context.defaultCurrency}`
        : "月预算未开启",
      `本地可见账单 ${visibleCount} 笔`,
      context.canMutateLedger
        ? "删改权限：已开启。改账用 update_ledger_records，删账用 delete_ledger_records，均需用户确认。"
        : "删改权限：未开启。只能查询和新增预览；用户若要求改/删，请说明到设置打开「允许修改和删除账本」。",
      `支出分类：${categoriesByKind("expense")}`,
      `收入分类：${categoriesByKind("income")}`,
      `冲减分类（金额为负）：${categoriesByKind("negative_expense")}`,
    ].join("\n"),
  };
};

const toAssistantToolCalls = (
  calls: Array<{ id: string; name: string; arguments: string }>,
): LlmToolCallPayload[] =>
  calls.map((item) => ({
    id: item.id,
    type: "function",
    function: { name: item.name, arguments: item.arguments },
  }));

export const runMoneyMoreTurn = async (options: {
  settings: LlmApiSettings;
  history: LlmChatMessage[];
  userText: string;
  context: MoneyMoreToolContext;
  signal: AbortSignal;
}): Promise<{ assistantText: string; cards: MoneyMoreCard[]; history: LlmChatMessage[] }> => {
  const history: LlmChatMessage[] = [
    ...options.history,
    { role: "user", content: options.userText },
  ];
  let toolsEnabled = true;
  const collectedCards: MoneyMoreCard[] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    if (options.signal.aborted) throw new DOMException("Aborted", "AbortError");
    let completion;
    try {
      completion = await requestLlmChat({
        settings: options.settings,
        messages: [buildMoneyMoreSystemMessage(options.context), ...history],
        jsonMode: false,
        temperature: 0.2,
        maxTokens: 1536,
        tools: toolsEnabled ? getMoneyMoreTools(options.context.canMutateLedger) : undefined,
        toolChoice: toolsEnabled ? "auto" : "none",
        signal: options.signal,
        allowEmptyContent: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (toolsEnabled && /tool/i.test(message)) {
        toolsEnabled = false;
        continue;
      }
      throw error;
    }

    const visibleContent = stripHiddenThink(completion.content);
    const fallback = !completion.toolCalls.length ? parseFallbackTool(visibleContent) : null;
    const toolCalls = completion.toolCalls.length
      ? completion.toolCalls
      : fallback
        ? [
            {
              id: `call_${round + 1}`,
              name: fallback.name,
              arguments: JSON.stringify(fallback.args),
            },
          ]
        : [];

    if (!toolCalls.length) {
      const cards = mergeMoneyMoreCards(collectedCards);
      const text = visibleContent.trim() || (cards.length ? "这是你要看的统计。" : "");
      if (!text) throw new Error("MoneyMore 没有返回内容。");
      history.push({ role: "assistant", content: text });
      return { assistantText: text, cards, history };
    }

    history.push({
      role: "assistant",
      content: visibleContent,
      tool_calls: toAssistantToolCalls(toolCalls),
    });

    for (const call of toolCalls) {
      const output = clipToolOutput(
        executeMoneyMoreTool(call.name, parseToolArguments(call.arguments), options.context),
      );
      collectedCards.push(...cardsFromToolOutput(call.name, output));
      history.push({
        role: "tool",
        content: output,
        tool_call_id: call.id,
        name: call.name,
      });
    }
  }

  throw new Error("MoneyMore 工具调用轮次过多，请把问题拆短再问。");
};
