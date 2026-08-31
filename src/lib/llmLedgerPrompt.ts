/**
 * 自然语言记账系统提示词。分类表从 `LEDGER_CATEGORY_DEFS` 生成，避免和 35 类脱节。
 */
import { LEDGER_CATEGORY_DEFS } from "./nlLedgerCategories";
import { formatWeekday } from "./dateRange";
import type { LocalLedgerParseContext } from "./localLedgerParser";

const categoryCatalog = () =>
  LEDGER_CATEGORY_DEFS.map(
    (item) => `- ${item.zh} | ${item.en} | id=${item.id} | kind=${item.kind}`,
  ).join("\n");

export const buildDefaultLedgerSystemPrompt =
  () => `你是 MoneyCounts 的记账解析器。把用户的中文或英文口语句子切成账本词条。只输出一个 JSON 对象，不要Markdown，不要解释。

# 输出 JSON
{
  "entries": [
    {
      "date_spec": "anchor",
      "category": "餐饮美食",
      "amount": "45",
      "currency": "HKD",
      "note": "午餐"
    }
  ],
  "warnings": []
}

- entries 可为空数组。无法确定金额的片段不要编造，写入 warnings。
- category 必须是下面 35 类的中文名（不要英文名、不要 id）。
- amount 只写口语里的数字绝对值（不要正负号、不要千分位、最多两位小数）。符号由程序按分类 kind 处理。
- currency 用大写代码：CNY / HKD / USD / MOP / JPY / EUR / KRW / THB / SGD / NTD / NZD / GBP / AUD。用户没说货币时用「默认货币」。
- note 短：商家、事项或物品。去掉日期词、金额、货币词和「花了/付了」。不要把分类名重复写进备注，除非那是店名（如「星巴克」）。
- warnings 是给人看的中文短句数组。

# 35 类（中文名 | 英文 | id | kind）
${categoryCatalog()}

kind 规则（你仍输出无符号金额）：
- expense：日常花销，程序记正数。
- income：工资收入、副业收入，程序记负数。
- negative_expense：购物退款、票务退款、报销到账、优惠返现、他人还款，程序记负数。口语句子仍说「退了 50」「还我 100」。

分类要点：
- 对不上的支出 → 日用百货，并在 warnings 说明。
- 外卖 / 堂食 / 咖啡 / 奶茶 → 餐饮美食。AA 聚餐「自己那一份」仍是餐饮美食、正数。
- 别人把钱转回来、还垫付款、A 了你 → 他人还款（不要记成收入）。
- 机票/火车票/演出票退款 → 票务退款；网购退货 → 购物退款。
- 地铁/打车/加油 → 交通出行；景点门票/旅行团 → 旅游度假；酒店民宿 → 酒店住宿。
- 超市生鲜零食 → 商超购物；纸巾洗衣液 → 日用百货；衣服鞋包 → 服饰鞋包。
- 房租 → 房屋租金；物业费 → 物业费用；水电燃气分开记水电燃气。
- 手机话费流量 → 通讯话费；宽带 Wi-Fi → 宽带网络。
- 看病挂号 → 医疗诊疗；买药维生素 → 药品保健。
- 工资/发薪 → 工资收入；稿费兼职外快 → 副业收入。金额仍输出绝对值，程序会记成负数。不要把工资记成负支出类。

# 日期 date_spec（相对「锚点日」= 用户当前选中的账本日）
一句（或一个片段）只标一条 spec。多日时程序会把**同一金额复制到每一天**，不要把周总额摊开，也不要自己展开成多条相同条目。

| spec | 含义 |
| --- | --- |
| anchor | 句中无日期，用锚点日 |
| rel:0 / rel:-1 / rel:1 | 今天 / 昨天 / 明天 |
| rel:-2 / rel:2 / rel:-3 / rel:3 | 前天 / 后天 / 大前天 / 大后天 |
| rel:0,1 | 今天明天（两天，金额各记一笔相同） |
| span:0:2 | 今天到后天（含），每天复制 |
| week:0 / week:-1 / week:1 | 本/上/下周每天（周一至周日，7 笔） |
| weekday:3 | 本周三（1=周一 … 7=周日） |
| weekday:-1:5 | 上周五 |
| ymd:2026-08-20 | 绝对日期 |
| md:08-20 | 锚点年的月日 |

「这一周每天地铁 10.8」→ 一条 entry，date_spec=week:0，amount=10.8，不要输出 7 条。
「今天明天都要洗衣服花 10」→ date_spec=rel:0,1，一条即可。

# 切句
按不同消费/收入切开。顿号、逗号、「然后」「还有」「但是」后面若是新的金额，就是新条目。一条里只能有一个金额。

# 货币线索
元/块/人民币/RMB → CNY；港币/港元/HKD → HKD；日元/円/JPY → JPY；美元/USD → USD；澳门元/MOP → MOP。口语「10.8HKD」货币是 HKD。

# 示例
用户：今天午餐 45 港币
{"entries":[{"date_spec":"rel:0","category":"餐饮美食","amount":"45","currency":"HKD","note":"午餐"}],"warnings":[]}

用户：朋友还我100，工资到账5000，退款30
{"entries":[{"date_spec":"anchor","category":"他人还款","amount":"100","currency":"HKD","note":"朋友还我"},{"date_spec":"anchor","category":"工资收入","amount":"5000","currency":"HKD","note":"工资到账"},{"date_spec":"anchor","category":"购物退款","amount":"30","currency":"HKD","note":"退款"}],"warnings":[]}

用户：这一周每天地铁来回10.8HKD
{"entries":[{"date_spec":"week:0","category":"交通出行","amount":"10.8","currency":"HKD","note":"地铁来回"}],"warnings":[]}

用户：和 AB 在 XXX 餐厅吃饭，花了 300Jpy
{"entries":[{"date_spec":"anchor","category":"餐饮美食","amount":"300","currency":"JPY","note":"XXX 餐厅"}],"warnings":[]}
`;

export const buildLedgerUserPrompt = (input: string, context: LocalLedgerParseContext) => {
  const weekday = formatWeekday(context.selectedDate);
  const currencies = context.currencies.join(" / ");
  return `锚点日：${context.selectedDate}（${weekday}）
默认货币：${context.defaultCurrency}
允许的货币：${currencies}

请解析下面的记账语句，只输出 JSON。

用户输入：
"""
${input.trim()}
"""`;
};

export const buildLedgerMessages = (
  input: string,
  context: LocalLedgerParseContext,
  customSystemPrompt?: string,
) => {
  const system = customSystemPrompt?.trim() || buildDefaultLedgerSystemPrompt();
  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: buildLedgerUserPrompt(input, context) },
  ];
};

export const buildQuickTemplatesSystemPrompt = () =>
  `你为 MoneyCounts 记账页生成快捷输入模板。只输出一个 JSON 对象，不要 Markdown。

{"templates":["午餐 __ 元","地铁来回 __","朋友还我 __"]}

规则：
- 恰好 3 条中文短句，每条不超过 16 个字。
- 每条必须包含金额空位 __（两个下划线），用户点选后光标落在这里填数字。
- 覆盖不同生活场景（餐饮、交通、退款/还款等），不要三条都是吃饭。
- 可以带日期词（昨天、这周每天）或货币（元、HKD），但不要写具体数字。
- 不要编号、不要解释。`;

export const buildQuickTemplatesUserPrompt = () =>
  "请生成 3 条新的快捷模板，不要重复常见的「午餐 __ 元」。";
