# MoneyCounts

纯前端记账本：一句话记账、35 类账本、多货币、旅游 AA。数据只在浏览器 LocalStorage，没有服务器。

**在线 → [moneycounts.freddyhu2007.workers.dev](https://moneycounts.freddyhu2007.workers.dev/)**

生产站由 Cloudflare Workers 从 **`main`** 构建（`wrangler.toml` 里 Worker 名是 `moneycounts`，静态资源来自 `dist/`）。

---

## 能做什么

- **自然语言记账**：中英句子切成多笔，预览里改日期 / 分类 / 金额 / 币种 / 备注，确认后才写入。金额、币种、日期仍走规则；分类用关键词 + 浏览器内 n-gram 分类器（语料在 `data/nl-ledger/`）。
- **35 类**：28 个支出 + 工资收入 / 副业收入 + 5 个负支出（购物退款、票务退款、报销到账、优惠返现、他人还款）。对不上的归入「日用百货」。
- **金额符号**：工资、副业为正；退款 / 报销 / 返现 / 别人还你为负；AA 自己那份仍是餐饮美食、正数。
- **多日展开**：「今天明天」「这一周每天」等按 `date_spec` 拆成若干账本日，**每天复制同一金额**（不是把一周总额摊开）。
- **手动表格**：按类目填，键盘在格子间移动。
- **日 / 周 / 月 / 年**：汇总、分类饼图、趋势。
- **多货币**：HKD、CNY 为主，可加 USD 等；汇率从公开 API 拉取并缓存。
- **预算**：月度总额 + 分类上限。
- **旅游模式**：行程账单、同行人 AA、地点标签、汇率快照、历史。
- **搜索**：备注、分类、日期、金额。
- **数据管理**：CSV 导入导出；设置页做完整 JSON 备份（换设备靠这个）。
- **PWA**：可安装。界面目前是简体中文。

旧版 10 类账本会自动迁到 35 类格子（LocalStorage key 仍是 `monthly-smart-ledger:v1`）。餐饮→餐饮美食，居住→房屋租金，其他→日用百货，其余同类映射。

---

## 页面

| 路径                                     | 内容                                 |
| ---------------------------------------- | ------------------------------------ |
| `/`                                      | 记账：自然语言入口、今日明细、日汇总 |
| `/today` `/day` `/week` `/month` `/year` | 各周期统计                           |
| `/search`                                | 筛选                                 |
| `/travel`                                | 旅游模式                             |
| `/data`                                  | CSV 与账本清理                       |
| `/settings`                              | 区块显隐、预算、汇率、JSON 备份      |
| `/entry`                                 | 重定向到 `/`                         |

---

## 本地开发

```bash
git clone https://github.com/FoooooodieFred/MoneyCounts.git
cd MoneyCounts
npm install
npm run dev          # http://localhost:5173
npm run typecheck
npm test
npm run build        # 输出 dist/，Cloudflare 发这一份
```

Node.js 18+。没有环境变量。账本不经过服务器；清站点数据或换设备前，在设置里导出 JSON。

自然语言 35 类与日期规则的语料在 `data/nl-ledger/`（见该目录 README）。

---

## 技术栈

Vite 8 · React 19 · TypeScript · react-router-dom 7 · GSAP 3 · Vitest · PWA（`public/sw.js`）

| 路径              | 用途                                        |
| ----------------- | ------------------------------------------- |
| `src/App.tsx`     | 应用壳：状态、路由、写入账本                |
| `src/pages/`      | 搜索 / 旅游 / 设置 / 数据管理               |
| `src/components/` | 可复用 UI                                   |
| `src/lib/`        | 解析、分类、日期展开、统计、备份、旅游状态  |
| `src/styles.css`  | 全局样式                                    |
| `public/`         | PWA                                         |
| `wrangler.toml`   | Cloudflare：`moneycounts`，SPA 回退 `dist/` |

---

## 35 类（中文名）

支出：餐饮美食、交通出行、商超购物、日用百货、房屋租金、物业费用、水电燃气、通讯话费、宽带网络、医疗诊疗、药品保健、教育学习、书籍文具、休闲娱乐、影视演出、运动健身、旅游度假、酒店住宿、人情送礼、红包礼金、宠物养护、服饰鞋包、美容个护、数码产品、家居家装、保险缴费、还贷支出、税费支出。

收入：工资收入、副业收入。

负支出：购物退款、票务退款、报销到账、优惠返现、他人还款。

---

## Author

**@FoodieFred** · [github.com/FoooooodieFred/MoneyCounts](https://github.com/FoooooodieFred/MoneyCounts)

License: ISC

---

# MoneyCounts (English)

A client-only ledger: natural-language entry, 35 categories, multiple currencies, travel split-bills. Everything stays in browser LocalStorage.

**Live → [moneycounts.freddyhu2007.workers.dev](https://moneycounts.freddyhu2007.workers.dev/)**

Cloudflare Workers builds **`main`**. Worker name `moneycounts`; static assets from `dist/` (`wrangler.toml`).

## What it does

- Parse Chinese or English into preview rows (date, category, amount, currency, note), then write after confirm. Amount / currency / date stay rules; category uses keywords plus an in-browser n-gram classifier.
- **35 classes**: 28 expenses, salary / side income (positive), five negative expenses (shopping refund, ticket refund, reimbursement, cashback, repayment from others). Unknown → 日用百货.
- Multi-day phrases copy the **same amount onto each day**.
- Manual grid, day/week/month/year stats, HKD/CNY-first FX cache, budgets, travel AA, search, CSV on `/data`, JSON backup in Settings, PWA.

Old 10-class books migrate in place (same LocalStorage key).

## Develop

```bash
npm install
npm run dev          # http://localhost:5173
npm run typecheck && npm test
npm run build        # dist/ — what Cloudflare publishes
```

No backend, no env vars. Export JSON from Settings before changing devices.
