# MoneyCounts

本地优先的多币种智能记账本：自然语言入账、35 分类、多货币、旅游分账。

**网页** · [moneycounts.freddyhu2007.workers.dev](https://moneycounts.freddyhu2007.workers.dev/)  
**macOS（Apple 芯片）** · [下载 .app zip](https://github.com/FoooooodieFred/MoneyCounts/releases/latest/download/MoneyCounts-macos-arm64.zip)  
**Windows（64 位）** · [下载 .exe zip](https://github.com/FoooooodieFred/MoneyCounts/releases/latest/download/MoneyCounts-windows-amd64.zip) · [安装版](https://github.com/FoooooodieFred/MoneyCounts/releases/download/v1.4.0/MoneyCounts-windows-amd64-installer-v1.4.0.exe)

网页由 Cloudflare Workers 发布 `main` 上的 `dist/`。

注意：界面目前**仅有简体中文。** 英文及其他版本将在未来考虑陆续支持。

## v1.4.0

相对 [v1.3.0](https://github.com/FoooooodieFred/MoneyCounts/releases/tag/v1.3.0)：

- **大改性能**：首屏 JS 从 1109 KB（gzip）降到 248 KB；逐键输入的主线程开销降到原来的 1/9。账本不再每次按键都全量落盘
- **API 看台重做**：支持**多套连接档案**随时切换；三种接口风格（Chat Completions / Responses / Anthropic Messages）；**拉取模型列表**；可自建供应商，接入后续新模型不用改代码
- **每套档案自带参数**：temperature、max_tokens、top_p、上下文长度、输入/输出单价、是否支持工具调用，外加自由填写的额外请求头与请求体
- **Token 看台** `/tokens`：每次模型调用的输入输出 token、耗时、场景与估算费用，按模型 / 场景 / 天分组统计
- **提示词瘦身**：35 类改成按 kind 分组展示，提示词少 28%；自定义提示词默认改成「追加」，不再误删 35 类和 date_spec 规则
- **JSON 备份搬到「数据管理」页**，设置页只留区块、预算、汇率与存储位置
- 页面切换动画不再闪一下；修掉多日条目备注串到上一段的问题

---

## 网页还是桌面

|        | 网页 / PWA                           | 桌面                          |
| ------ | ------------------------------------ | ----------------------------- |
| 数据   | 浏览器 LocalStorage（大约 5MB 上限） | 本机文件，不受该上限限制      |
| 换设备 | 数据管理里导出 JSON，再导入          | 同样靠 JSON；两套存储互不相通 |
| 适合   | 随开随记、可安装成 PWA               | 账本变长、或浏览器配额不够    |

桌面数据位置：

- macOS：`~/Library/Application Support/MoneyCounts/store.json`
- Windows：`%AppData%\MoneyCounts\store.json`

macOS 未公证：下载后对 `MoneyCounts.app` **如果门禁阻止该操作，请前往Mac设置 → 隐私与安全性 → 安全性 → 仍要打开**。
Windows 未签名：SmartScreen 里选「更多信息 → 仍要运行」。需要 [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/)（Win11 一般已有）。

从网页迁到桌面：数据管理 → 导出 JSON → 桌面设置里导入。

---

## 能做什么

- **自然语言记账**：中英句子生成预览，改日期 / 分类 / 金额 / 币种 / 备注，确认后才写入。识别方式可切换：
  - **本地**（默认）：本地规则 + 关键词 + 浏览器内 n-gram 分类器，不走网络；入口叫「记一笔」
  - **AI / MoneyMore**：调用「API 看台」里配置的接口；可对话查账、出卡片，也可改账删账（需设置打开并确认）
- **35 分类**：28 个支出、工资 / 副业、5 个负支出。对不上的进「日用百货」
- **多日句子**：「今天明天」「这一周每天」等按天**复制同一金额**
- 手动表格、统计看板、当日日历账单
- 多货币（HKD、CNY 为主），汇率公开 API 拉取并缓存
- 月度与分类预算、搜索、CSV、完整 JSON 备份、PWA
- 旅游模式仍可用，默认隐藏且不推荐新账使用

---

## 页面

| 路径        | 内容                                          |
| ----------- | --------------------------------------------- |
| `/`         | 自然语言记账（本地 / MoneyMore）              |
| `/today`    | 今日明细                                      |
| `/day`      | 当日汇总 + 日历账单                           |
| `/stats`    | 统计看板（`/week` `/month` `/year` 转到这里） |
| `/search`   | 筛选                                          |
| `/travel`   | 旅游模式                                      |
| `/data`     | CSV、完整 JSON 备份与账本清理                 |
| `/settings` | 区块、预算、汇率、存储位置、MoneyMore 权限     |
| `/console`  | API 看台：档案、参数、提示词、试运行          |
| `/tokens`   | Token 看台：用量、费用、按模型/场景统计      |
| `/entry`    | 转到 `/`                                      |

---

## API 看台

`/console` 里可以配多套**连接档案**，每套有自己的地址、模型、密钥和生成参数，随时切换：

- **供应商预设**：内置 OpenAI、DeepSeek、Kimi / Moonshot、Groq、OpenRouter、MiniMax、Anthropic、Ollama 与「自定义」。也可以自己加一家——填名称、Base URL 和接口风格就行，**接入后续新模型不用改代码**
- **接口风格**：`Chat Completions`（OpenAI 兼容）、`Responses`（OpenAI 新接口）、`Anthropic Messages`（Claude 原生，密钥走 `x-api-key`）
- **拉取模型列表**：填好地址和密钥后点一下，模型名直接选，不用手打
- **生成参数**：temperature、max_tokens、top_p、上下文长度、输入/输出单价、是否支持工具调用。留空的项表示不发送，由模型自己决定
- **高级**：额外请求头和额外请求体，供应商要什么特殊参数就填什么

Token 花费记在 **Token 看台** `/tokens`：每次调用的输入输出 token、耗时、场景和估算费用，按模型 / 场景 / 天分组。上游没报用量时按字数估算，表格里会标出来。填了单价就能看真实花销。

---

## 本地跑网页

Node.js 18+。

```bash
git clone https://github.com/FoooooodieFred/MoneyCounts.git
cd MoneyCounts
npm install
npm run dev          # http://localhost:5173
npm run typecheck
npm test
npm run build        # 根目录 dist/，Cloudflare 发这一份
```

账本不经过服务器。清站点数据或换浏览器前，先在「数据管理」里导出 JSON。

API Key 存在 `monthly-smart-ledger:llm-api:v1`，默认**不进** JSON 备份；在「数据管理」或 API 看台可打开「把 API 写入备份」。勾选后请自行保管备份文件。

模型请求走同源 `/api/llm/chat`（开发是 Vite 中间件，生产是 Worker 转发），避免浏览器直连模型站。密钥只出现在当次请求头，服务端不保存。拉取模型列表走同源 `/api/llm/models`。

---

## 本地打桌面包

壳在 [`desktop/`](desktop/README.md)，界面仍编译仓库根的 `src/`。需要 [Go 1.22+](https://go.dev/dl/) 和 [Wails v2](https://wails.io/docs/gettingstarted/installation)：

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@v2.15.0
npm run desktop:dev      # 原生窗口 + Vite
npm run desktop:build    # 当前系统；macOS → desktop/build/bin/MoneyCounts.app
```

Windows 免安装 exe 可在 macOS 上交叉编译（`desktop/build/bin/MoneyCounts.exe`）。带开始菜单的 NSIS 安装包请在 Windows 上执行 `npm run desktop:build:windows`，或跑 GitHub Actions 的 Desktop workflow（打 `v*` 标签或手动触发）。

桌面前端输出在 `desktop/dist/`，不会覆盖网页 `dist/`。macOS 自签名若报 `detritus not allowed`：`xattr -cr desktop` 后再构建。

---

## 自然语言怎么解析

|             | 本地（默认）                 | AI / MoneyMore                   |
| ----------- | ---------------------------- | -------------------------------- |
| 切句        | 本地规则                     | 模型返回多条                     |
| 金额 / 币种 | 正则                         | 模型 + 本地校验                  |
| 日期        | `date_spec` 规则展开         | 模型给 `date_spec`，仍由规则展开 |
| 分类        | 关键词，不够则 n-gram 分类器 | 映射到 35 类                     |
| 写入        | 预览确认后                   | 同左；改账删账另需确认           |

分类器：`src/lib/nlLedgerClassifier.model.json`（约 2.5 MB，按需加载，不进首屏包），语料 `data/nl-ledger/samples.jsonl`。改语料后：

```bash
pip install scikit-learn numpy   # 仅训练机
npm run train:nl-classifier
```

提示词与 35 类：`src/lib/llmLedgerPrompt.ts`。看台里写自定义提示词时默认是**追加**到默认提示词后面；想完全替换可以切到「替换」模式，但那样 35 类和 date_spec 规则就没了。

---

## 性能怎么做的

- **分类器懒加载**：2.5 MB 的 35 类模型只在真的要解析账单时才拉，首屏只带 248 KB
- **路由分包**：每个页面独立 chunk，导航时预取，点击不等待网络
- **落盘防抖**：账本 400 ms 内没有改动才写盘，页面隐藏或关闭时立刻补写
- **入场动画**：`useLayoutEffect` 设起始态，页面不会再「先出现再消失」

---

## 仓库

Vite 8 · React 19 · TypeScript · react-router-dom 7 · GSAP 3 · Vitest · PWA · Wails v2 · Cloudflare Workers

| 路径            | 用途                                           |
| --------------- | ---------------------------------------------- |
| `src/`          | 网页与桌面共用的 UI 和账本逻辑                 |
| `desktop/`      | Wails 壳：落盘、系统对话框、LLM 代理、打包模板 |
| `workers/`      | 生产环境 `/api/llm/chat` 与 `/api/llm/models`  |
| `dist/`         | 网页构建产物（Cloudflare 发布）                |
| `wrangler.toml` | Worker 名 `moneycounts`，SPA 回退              |

---

## 作者

**@FoodieFred** · [github.com/FoooooodieFred/MoneyCounts](https://github.com/FoooooodieFred/MoneyCounts)

License: ISC

---

# MoneyCounts (English)

Local‑first multi‑currency smart ledger: natural‑language entry, 35 categories, multi‑currency support, travel expense splitting.

**Web** · [moneycounts.freddyhu2007.workers.dev](https://moneycounts.freddyhu2007.workers.dev/)  
**macOS (Apple Silicon)** · [download .app zip](https://github.com/FoooooodieFred/MoneyCounts/releases/latest/download/MoneyCounts-macos-arm64.zip)  
**Windows (64-bit)** · [download .exe zip](https://github.com/FoooooodieFred/MoneyCounts/releases/latest/download/MoneyCounts-windows-amd64.zip) · [installer](https://github.com/FoooooodieFred/MoneyCounts/releases/download/v1.4.0/MoneyCounts-windows-amd64-installer-v1.4.0.exe)

Cloudflare Workers publishes `dist/` from **`main`**.

Note: The interface currently supports **Simplified Chinese only**. English and other language versions will be considered for rollout in the future.

## v1.4.0

Since [v1.3.0](https://github.com/FoooooodieFred/MoneyCounts/releases/tag/v1.3.0):

- **Big performance pass**: first-load JS down from 1109 KB to 248 KB (gzip); per-keystroke main-thread work down ~9x. The ledger no longer rewrites itself on every keypress
- **Rebuilt API console**: multiple **connection profiles** you can switch between; three API styles (Chat Completions / Responses / Anthropic Messages); **model discovery**; user-defined providers so a new model needs no code change
- **Per-profile settings**: temperature, max_tokens, top_p, context window, input/output price, tool-calling toggle, plus free-form extra headers and body fields
- **Token console** `/tokens`: input/output tokens, latency, scene and estimated cost per call, grouped by model, scene and day
- **Leaner prompt**: the 35 categories are grouped by kind; the prompt is 28% smaller. A custom prompt now **appends** to the default instead of replacing it, so the categories and `date_spec` rules can no longer be lost by accident
- **JSON backup moved to Data management**; Settings keeps sections, budgets, rates and storage location
- Page-open animations no longer flash; fixed notes on multi-day entries leaking from the previous clause

## Web vs desktop

|            | Web / PWA                       | Desktop                                     |
| ---------- | ------------------------------- | ------------------------------------------- |
| Data       | Browser LocalStorage (~5MB cap) | A file on disk                              |
| New device | Data management → export JSON → import | Same JSON flow; stores are not shared  |
| Use when   | Quick capture, installable PWA  | Larger books, or the browser quota is tight |

Store files: macOS `~/Library/Application Support/MoneyCounts/store.json` · Windows `%AppData%\MoneyCounts\store.json`.

Unsigned macOS: **If Gatekeeper blocks it, go to Mac Settings → Privacy & Security → Security → Open Anyway**. Unsigned Windows: SmartScreen → More info → Run anyway. Needs [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/).

## Features

Natural-language entry (**Local** rules, or **AI / MoneyMore** via `/console`), 35 categories, multi-day `date_spec` phrases that **copy the same amount onto each day**, manual grid, stats dashboard, day calendar, FX cache, budgets, search, CSV, JSON backup, PWA. Travel mode still exists but is hidden by default. Old 10-class books migrate in place (`monthly-smart-ledger:v1`).

Routes: `/` entry · `/today` list · `/day` day + calendar · `/stats` dashboard (`/week` `/month` `/year` redirect here) · `/search` · `/travel` · `/data` CSV + JSON backup · `/settings` · `/console` API console · `/tokens` token console.

## Develop

```bash
git clone https://github.com/FoooooodieFred/MoneyCounts.git
cd MoneyCounts
npm install
npm run dev          # http://localhost:5173
npm test && npm run typecheck
npm run build        # web dist/ for Cloudflare
```

Desktop shell is [`desktop/`](desktop/README.md) (Go 1.22+ and Wails v2):

```bash
npm run desktop:dev
npm run desktop:build            # this OS
npm run desktop:build:windows    # NSIS installer; run on Windows or CI
```

A portable `MoneyCounts.exe` can be cross-compiled from macOS. The NSIS installer should be built on Windows (or GitHub Actions). Desktop frontend output is `desktop/dist/` and does not overwrite the web `dist/`.

LLM calls go through same-origin `/api/llm/chat`, model discovery through `/api/llm/models`. API keys live in `monthly-smart-ledger:llm-api:v1` and are **off** JSON backup by default.

## Author

**@FoodieFred** · [github.com/FoooooodieFred/MoneyCounts](https://github.com/FoooooodieFred/MoneyCounts)

License: ISC
