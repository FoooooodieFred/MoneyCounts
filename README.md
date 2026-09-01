# MoneyCounts

纯前端记账本：一句话记账、35 类账本、多货币、旅游 AA。账本只在浏览器 LocalStorage。

**在线 → [moneycounts.freddyhu2007.workers.dev](https://moneycounts.freddyhu2007.workers.dev/)** · **macOS 桌面（Apple 芯片）→ [下载 zip](https://github.com/FoooooodieFred/MoneyCounts/releases/latest/download/MoneyCounts-macos-arm64.zip)**

生产站由 Cloudflare Workers 从 **`main`** 构建（Worker 名 `moneycounts`，静态资源来自 `dist/`，见 `wrangler.toml`）。桌面包在 [GitHub Releases](https://github.com/FoooooodieFred/MoneyCounts/releases/latest)。

---

## 能做什么

- **自然语言记账**：输入中英句子，预览里改日期 / 分类 / 金额 / 币种 / 备注，确认后才写入。首页「生成记账预览」左侧可切换识别方式：
  - **规则识别·快且本地**（默认）：金额、币种、日期走规则；分类是关键词 + 浏览器内 n-gram 分类器。不经过网络。
  - **LLM识别·精确有效**：调用你在「API 看台」填写的 OpenAI 兼容接口。未配置或解析失败时会回退到规则识别。
- **35 类**：28 个支出 + 工资收入 / 副业收入 + 5 个负支出（购物退款、票务退款、报销到账、优惠返现、他人还款）。对不上的归入「日用百货」。
- **金额符号**：工资、副业为正；退款 / 报销 / 返现 / 别人还你为负；AA 自己那份仍记餐饮美食、正数。
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

| 路径                                     | 内容                                           |
| ---------------------------------------- | ---------------------------------------------- |
| `/`                                      | 记账：自然语言入口、今日明细、日汇总           |
| `/today` `/day` `/week` `/month` `/year` | 各周期统计                                     |
| `/search`                                | 筛选                                           |
| `/travel`                                | 旅游模式                                       |
| `/data`                                  | CSV 与账本清理                                 |
| `/settings`                              | 区块显隐、预算、汇率、JSON 备份                |
| `/console`                               | API 看台：接口、密钥、提示词、试运行、最近调用 |
| `/entry`                                 | 重定向到 `/`                                   |

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

Node.js 18+。账本不经过服务器；清站点数据或换设备前，在设置里导出 JSON。

API Key 存在单独的 LocalStorage key（`monthly-smart-ledger:llm-api:v1`）。默认**不进** JSON 备份；可在 API 看台或设置里勾选「把 API 写入 JSON 备份」。勾选后请自行保管备份文件。

本地 `npm run dev` 与生产站都会把浏览器的模型请求发到同源 `/api/llm/chat`（避免 CORS）。生产由 Worker 转发；密钥只出现在本次请求头里，服务端不保存。

## 桌面客户端（Wails）

**[下载 macOS（Apple 芯片）](https://github.com/FoooooodieFred/MoneyCounts/releases/latest/download/MoneyCounts-macos-arm64.zip)** · 解压得到 `MoneyCounts.app`。未公证：从网盘/浏览器下来后请 **右键 → 打开**。仅 M 系列 Mac；Intel 请等 universal 包。网页账本请先导出 JSON，在桌面设置里导入。

网页版继续 `npm run dev` / Cloudflare 发布。桌面版把同一套 UI 嵌进原生窗口，账本落到本机文件，不受浏览器 LocalStorage 约 5MB 上限限制。

| 系统    | 数据文件                                               |
| ------- | ------------------------------------------------------ |
| macOS   | `~/Library/Application Support/MoneyCounts/store.json` |
| Windows | `%AppData%\MoneyCounts\store.json`                     |

从网页迁到桌面：在网页设置里导出 JSON，打开桌面客户端后在设置里导入。两套存储互不相通。

本机需要 [Go 1.22+](https://go.dev/dl/) 和 [Wails v2 CLI](https://wails.io/docs/gettingstarted/installation)：

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@v2.15.0
wails doctor
wails dev          # 开发：Vite + 原生窗口
wails build        # macOS：build/bin/MoneyCounts.app
```

Windows 安装包请在 Windows 或 GitHub Actions（`.github/workflows/desktop.yml`）上构建，不要在 Mac 上交叉编译。未签名的 macOS 应用需右键打开；Windows 可能被 SmartScreen 拦截。

`wails build` 会先按桌面配置编译前端（相对路径）。打完包后若还要发网页，再跑一次不带 `VITE_DESKTOP` 的 `npm run build`。若本机自签名报 `resource fork ... detritus not allowed`，对工程执行 `xattr -cr .` 后再构建。

LLM 识别仍走同源 `/api/llm/chat`，由 Go 转发（规则与 `src/lib/llmProxy.ts` 对齐）。网页存储将满时的「下载桌面客户端」指向上述 GitHub Release zip。

---

## 自然语言怎么解析

| 步骤      | 规则识别（默认）                             | LLM 识别                         |
| --------- | -------------------------------------------- | -------------------------------- |
| 切句      | `expenseParseShared`                         | 模型返回多条词条                 |
| 金额/币种 | 正则                                         | 模型 + 本地校验                  |
| 日期      | `date_spec`（`nlLedgerDateSpec.ts`）         | 模型给 `date_spec`，仍由规则展开 |
| 分类      | 关键词优先；不够强则用浏览器内 n-gram 分类器 | 模型映射到 35 类                 |
| 写入      | 预览确认后才进 LocalStorage                  | 同左                             |

分类器权重在 `src/lib/nlLedgerClassifier.model.json`，用 `data/nl-ledger/samples.jsonl` 训练，**没有新增 npm 依赖**。改语料后：

```bash
pip install scikit-learn numpy   # 仅训练机
npm run train:nl-classifier      # 写出 model.json
```

35 类、`date_spec` 与默认 LLM 提示词见 `src/lib/llmLedgerPrompt.ts`；语料说明见 `data/nl-ledger/README.md`。

---

## 技术栈

Vite 8 · React 19 · TypeScript · react-router-dom 7 · GSAP 3 · Vitest · PWA（`public/sw.js`）· Wails v2 桌面壳

| 路径                 | 用途                                                            |
| -------------------- | --------------------------------------------------------------- |
| `src/App.tsx`        | 应用壳：状态、路由、写入账本                                    |
| `src/pages/`         | 搜索 / 旅游 / 设置 / 数据管理 / API 看台                        |
| `src/components/`    | 可复用 UI                                                       |
| `src/lib/`           | 解析、分类器、日期展开、LLM 提示词 / 代理、统计、备份、旅游状态 |
| `workers/`           | Cloudflare：`/api/llm/chat` 同源代理                            |
| `main.go` / `app.go` | Wails 桌面壳：落盘、文件对话框、LLM 代理                        |
| `scripts/`           | 分类器训练、桌面 Vite 环境包装                                  |
| `src/styles.css`     | 全局样式                                                        |
| `public/`            | PWA                                                             |
| `wrangler.toml`      | Cloudflare：`moneycounts`，SPA 回退 `dist/`                     |

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

A client-side ledger: natural-language entry, 35 categories, multiple currencies, travel split-bills. The book stays in browser LocalStorage.

**Live → [moneycounts.freddyhu2007.workers.dev](https://moneycounts.freddyhu2007.workers.dev/)** · **macOS desktop (Apple Silicon) → [download zip](https://github.com/FoooooodieFred/MoneyCounts/releases/latest/download/MoneyCounts-macos-arm64.zip)**

Cloudflare Workers builds **`main`**. Worker name `moneycounts`; static assets from `dist/` (`wrangler.toml`). Desktop builds live on [GitHub Releases](https://github.com/FoooooodieFred/MoneyCounts/releases/latest).

## What it does

- **Natural-language entry**: Chinese or English becomes preview rows (date, category, amount, currency, note). Nothing is written until you confirm. Next to **Generate Bookkeeping Preview** you can pick:
  - **Rule‑based Recognition: Fast and Local** (default): amount, currency, and dates stay rule-based; category uses keywords plus an in-browser n-gram classifier. No network.
  - **LLM Recognition · Accurate and Effective**: calls the OpenAI-compatible endpoint you set on **API Console** (`/console`). Falls back to local rules if the key is missing or the model fails.
- **35 classes**: 28 expenses, salary / side income (positive), five negative expenses (shopping refund, ticket refund, reimbursement, cashback, repayment from others). Unknown → 日用百货.
- **Signs**: salary and side income are positive; refunds / reimbursement / cashback / someone paying you back are negative; your own AA share is still 餐饮美食, positive.
- **Multi-day phrases** (`date_spec`) copy the **same amount onto each day**.
- Manual category grid, day/week/month/year stats, HKD/CNY-first FX cache, budgets, travel AA, search, CSV on `/data`, JSON backup in Settings, PWA. UI is Simplified Chinese.

Old 10-class books migrate in place (same LocalStorage key `monthly-smart-ledger:v1`).

## Routes

| Path                                     | What you get                                       |
| ---------------------------------------- | -------------------------------------------------- |
| `/`                                      | Home: NL entry, today’s rows, day totals           |
| `/today` `/day` `/week` `/month` `/year` | Period stats                                       |
| `/search`                                | Filters                                            |
| `/travel`                                | Travel mode                                        |
| `/data`                                  | CSV and ledger cleanup                             |
| `/settings`                              | Home blocks, budgets, FX, JSON backup              |
| `/console`                               | API console: URL, key, prompt, probe, recent calls |
| `/entry`                                 | Redirects to `/`                                   |

## Develop

```bash
git clone https://github.com/FoooooodieFred/MoneyCounts.git
cd MoneyCounts
npm install
npm run dev          # http://localhost:5173
npm run typecheck
npm test
npm run build        # dist/ — what Cloudflare publishes
```

Node.js 18+. The ledger never hits a server. Export JSON from Settings before wiping the origin or switching devices.

API keys live in `monthly-smart-ledger:llm-api:v1`. They are **off** JSON backup by default; opt in on the console or Settings. Keep that file private if you do.

LLM requests go through same-origin `/api/llm/chat` (Vite middleware in dev, Worker in production) so the browser does not talk to the model host directly. The key is only on that request; the Worker does not store it.

## Desktop client (Wails)

**[Download macOS (Apple Silicon)](https://github.com/FoooooodieFred/MoneyCounts/releases/latest/download/MoneyCounts-macos-arm64.zip)** — unzip `MoneyCounts.app`. Unsigned: after a browser/AirDrop download, **right-click → Open**. Apple Silicon only. Export JSON from the web app, then import it in desktop Settings.

The web app stays on Cloudflare. The desktop build embeds the same UI and writes the ledger to a local file, so the ~5MB browser LocalStorage cap does not apply.

| OS      | Store file                                             |
| ------- | ------------------------------------------------------ |
| macOS   | `~/Library/Application Support/MoneyCounts/store.json` |
| Windows | `%AppData%\MoneyCounts\store.json`                     |

Move from web to desktop by exporting JSON in Settings, then importing it in the desktop app. The two stores are not shared.

Needs [Go 1.22+](https://go.dev/dl/) and [Wails v2 CLI](https://wails.io/docs/gettingstarted/installation):

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@v2.15.0
wails doctor
wails dev
wails build
```

Build Windows on Windows or via `.github/workflows/desktop.yml`. Unsigned macOS apps need Open anyway; Windows SmartScreen may warn.

## How parsing works

| Step              | Local rules (default)                                      | LLM                                      |
| ----------------- | ---------------------------------------------------------- | ---------------------------------------- |
| Split utterances  | `expenseParseShared`                                       | Model returns rows                       |
| Amount / currency | Regex                                                      | Model + local checks                     |
| Dates             | `date_spec` in `nlLedgerDateSpec.ts`                       | Model emits `date_spec`; rules expand it |
| Category          | Keywords first; else in-browser n-gram logistic classifier | Model mapped onto the 35 classes         |
| Write             | After preview confirm                                      | Same                                     |

Classifier weights: `src/lib/nlLedgerClassifier.model.json`, trained from `data/nl-ledger/samples.jsonl` (no extra npm dependency):

```bash
pip install scikit-learn numpy   # trainer machine only
npm run train:nl-classifier
```

Default LLM prompt and the 35-class list: `src/lib/llmLedgerPrompt.ts`. Corpus notes: `data/nl-ledger/README.md`.

## Stack

Vite 8 · React 19 · TypeScript · react-router-dom 7 · GSAP 3 · Vitest · PWA (`public/sw.js`) · Wails v2 desktop shell

| Path                 | Role                                                                  |
| -------------------- | --------------------------------------------------------------------- |
| `src/App.tsx`        | Shell: state, routes, writes                                          |
| `src/pages/`         | Search / travel / settings / data / API console                       |
| `src/components/`    | Reusable UI                                                           |
| `src/lib/`           | Parsers, classifier, dates, LLM prompt / proxy, stats, backup, travel |
| `workers/`           | Cloudflare same-origin `/api/llm/chat`                                |
| `main.go` / `app.go` | Wails shell: on-disk store, file dialogs, LLM proxy                   |
| `scripts/`           | Classifier training, desktop Vite env wrapper                         |
| `wrangler.toml`      | Worker `moneycounts`, SPA fallback from `dist/`                       |

## Author

**@FoodieFred** · [github.com/FoooooodieFred/MoneyCounts](https://github.com/FoooooodieFred/MoneyCounts)

License: ISC
