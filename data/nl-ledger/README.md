# 自然语言记账语料

本目录是 **35 类 × 中英各 50 条** 的槽位标注集，用来训练「一句话 → 分类 / 金额 / 币种 / 备注 / 日期」的小型模型。不改 App 解析器，也不改 LocalStorage。

默认锚点日（对应解析时的 `selectedDate`）是 **2026-08-31（周一）**，见 [`src/lib/nlLedgerDateSpec.ts`](../../src/lib/nlLedgerDateSpec.ts)。

## 文件

| 文件                                          | 用途                                                                         |
| --------------------------------------------- | ---------------------------------------------------------------------------- |
| `categories.json`                             | 35 类：`id` / 中英名 / `kind`（expense / income / negative_expense）         |
| `pairs/*.json`                                | 人可改的双语对（每类 50 条）                                                 |
| `source-zh-30.csv`                            | 原始 30 类中文表                                                             |
| `patch_zh.py`                                 | 边界修正、零金额替换、日期改写                                               |
| `export_dataset.py`                           | 展开中英行、解析 `date_spec`、写 span                                        |
| `ledger_utterances.csv` / `zh.csv` / `en.csv` | 训练用宽表                                                                   |
| `记账语义数据集.csv`                          | 中文表头的合并表（分类名称、自然表达、金额、币种、备注、日期规则、展开日期） |
| `samples.jsonl`                               | 规范样本（含 `spans` 与 `dates`）                                            |

重建导出：

```bash
python3 data/nl-ledger/export_dataset.py
```

## 分类

28 个支出类 + 2 个收入类（金额为正）+ 5 个负支出类（`amount` 为负数，口语句子里仍说正数，如「退款 50 元」）。

负支出：

- `refund_shopping` 购物退款
- `refund_tickets` 票务退款
- `reimbursement` 报销到账
- `cashback` 优惠返现
- `repay_from_others` 他人还款（含 AA 收回、垫付收回）

AA 聚餐自己那一份仍记在 `food_dining` 且金额为正。工资/兼职走收入类，不走负支出。

## 日期：一句话怎么填若干天

口语句子只标一条 `date_spec`。解码时按锚点展开成 1..N 个 `YYYY-MM-DD`，**同一金额复制到每一天**（「这一周每天地铁 10.8」是 7 笔 10.8，不是一周合计）。

| `date_spec`                     | 含义                         | 锚点 2026-08-31 上的展开 |
| ------------------------------- | ---------------------------- | ------------------------ |
| `anchor`                        | 句中无日期，用选中日         | `2026-08-31`             |
| `rel:0` / `rel:-1` / `rel:1`    | 今天 / 昨天 / 明天           | 单日                     |
| `rel:0,1`                       | 今天明天                     | 两天                     |
| `span:0:2`                      | 今天到后天（含）             | 三天                     |
| `week:0` / `week:-1` / `week:1` | 本/上/下周每天（周一至周日） | 7 天                     |
| `weekday:3`                     | 本周三                       | `2026-09-02`             |
| `weekday:-1:5`                  | 上周五                       | `2026-08-28`             |
| `ymd:2026-08-20`                | 绝对日期                     | 单日                     |
| `md:08-20`                      | 锚点年的月日                 | 单日                     |

实现：`parseNlLedgerDateSpec` / `resolveNlLedgerDateSpec`。接入解析器时建议仍由规则切句，模型只出 `date_spec`（或日期列表），再调用该函数展开预览行。

## Span

`samples.jsonl` 的 `spans` 是 Unicode 码点偏移（本语料无代理对，与 JS `indexOf` 一致）：

- `amount`：句中的无符号数字
- `currency`：元/块/HKD/yuan 等表面形式；对不上则为 `null`
- `note`：备注是原句子串时给出；否则 `null`（生成式备注）

分类名经常不在原句里，用 `category_id` 分类头，不要标成 span。

## 旧 10 类 → 这 35 类（以后改账本时用，本轮不迁 schema）

- 餐饮 → `food_dining`
- 交通 → `transport`
- 购物 → `groceries` / `household_goods` / `apparel` / `electronics` / `beauty` / `home_decor` / `pets`
- 居住 → `rent` / `property_mgmt` / `utilities`
- 通讯 → `mobile_phone`（宽带改挂 `broadband`）
- 娱乐 → `leisure` / `shows_media` / `fitness`
- 医疗 → `medical` / `pharmacy`
- 教育 → `education` / `books_stationery`
- 旅行 → `travel` / `lodging`
- 其他 → `gifts` / `red_packet` / `insurance` / `loan_repay` / `tax` / `salary` / `side_income` / 五个负支出类
