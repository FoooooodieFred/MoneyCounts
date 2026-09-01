# MoneyCounts

本地优先记账本：一句话入账、35 类、多货币、旅游 AA。没有账号，没有云同步。

**网页** · [moneycounts.freddyhu2007.workers.dev](https://moneycounts.freddyhu2007.workers.dev/)  
**macOS（Apple 芯片）** · [下载 .app zip](https://github.com/FoooooodieFred/MoneyCounts/releases/latest/download/MoneyCounts-macos-arm64.zip)  
**Windows（64 位）** · [下载 .exe zip](https://github.com/FoooooodieFred/MoneyCounts/releases/latest/download/MoneyCounts-windows-amd64.zip)

网页由 Cloudflare Workers 发布 `main` 上的 `dist/`。桌面安装包在 [GitHub Releases](https://github.com/FoooooodieFred/MoneyCounts/releases/latest)。界面为简体中文。

---

## 网页还是桌面

|        | 网页 / PWA                           | 桌面（Wails）                 |
| ------ | ------------------------------------ | ----------------------------- |
| 数据   | 浏览器 LocalStorage（大约 5MB 上限） | 本机文件，不受该上限限制      |
| 换设备 | 设置里导出 JSON，再导入              | 同样靠 JSON；两套存储互不相通 |
| 适合   | 随开随记、可安装成 PWA               | 账本变长、或浏览器配额不够    |

桌面数据位置：

- macOS：`~/Library/Application Support/MoneyCounts/store.json`
- Windows：`%AppData%\MoneyCounts\store.json`

macOS 未公证：下载后对 `MoneyCounts.app` **右键 → 打开**。Windows 未签名：SmartScreen 里选「更多信息 → 仍要运行」。需要 [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/)（Win11 一般已有）。从网页迁到桌面：设置 → 导出 JSON → 桌面设置里导入。

---

## 能做什么

- **自然语言记账**：中英句子生成预览，改日期 / 分类 / 金额 / 币种 / 备注，确认后才写入。识别方式可切换：
  - **规则识别**（默认）：本地规则 + 关键词 + 浏览器内 n-gram 分类器，不走网络
  - **LLM 识别**：调用「API 看台」里配置的 OpenAI 兼容接口；没配或失败则回退规则
- **35 类**：28 个支出、工资 / 副业（正数）、5 个负支出（退款、报销、返现、他人还款）。对不上的进「日用百货」
- **多日句子**：「今天明天」「这一周每天」等按天**复制同一金额**（不是把总额摊开）
- 手动表格、日 / 周 / 月 / 年统计与图表
- 多货币（HKD、CNY 为主），汇率公开 API 拉取并缓存
- 月度与分类预算、旅游行程与 AA、搜索、CSV、完整 JSON 备份、PWA

旧版 10 类账本会自动迁到 35 类（LocalStorage key 仍是 `monthly-smart-ledger:v1`）。

---

## 页面

| 路径                                     | 内容                                 |
| ---------------------------------------- | ------------------------------------ |
| `/`                                      | 自然语言记账                         |
| `/today` `/day` `/week` `/month` `/year` | 今日明细与各周期统计                 |
| `/search`                                | 筛选                                 |
| `/travel`                                | 旅游模式                             |
| `/data`                                  | CSV 与账本清理                       |
| `/settings`                              | 区块、预算、汇率、JSON 备份          |
| `/console`                               | API 看台：地址、密钥、提示词、试运行 |
| `/entry`                                 | 转到 `/`                             |

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

账本不经过服务器。清站点数据或换浏览器前，先在设置里导出 JSON。

API Key 存在 `monthly-smart-ledger:llm-api:v1`，默认**不进** JSON 备份；设置或 API 看台可打开「把 API 写入备份」。勾选后请自行保管备份文件。

模型请求走同源 `/api/llm/chat`（开发是 Vite 中间件，生产是 Worker 转发），避免浏览器直连模型站。密钥只出现在当次请求头，服务端不保存。

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

|             | 规则识别（默认）             | LLM 识别                         |
| ----------- | ---------------------------- | -------------------------------- |
| 切句        | 本地规则                     | 模型返回多条                     |
| 金额 / 币种 | 正则                         | 模型 + 本地校验                  |
| 日期        | `date_spec` 规则展开         | 模型给 `date_spec`，仍由规则展开 |
| 分类        | 关键词，不够则 n-gram 分类器 | 映射到 35 类                     |
| 写入        | 预览确认后                   | 同左                             |

分类器：`src/lib/nlLedgerClassifier.model.json`，语料 `data/nl-ledger/samples.jsonl`。改语料后：

```bash
pip install scikit-learn numpy   # 仅训练机
npm run train:nl-classifier
```

提示词与 35 类：`src/lib/llmLedgerPrompt.ts`。

---

## 仓库

Vite 8 · React 19 · TypeScript · react-router-dom 7 · GSAP 3 · Vitest · PWA · Wails v2 · Cloudflare Workers

| 路径            | 用途                                           |
| --------------- | ---------------------------------------------- |
| `src/`          | 网页与桌面共用的 UI 和账本逻辑                 |
| `desktop/`      | Wails 壳：落盘、系统对话框、LLM 代理、打包模板 |
| `workers/`      | 生产环境 `/api/llm/chat`                       |
| `dist/`         | 网页构建产物（Cloudflare 发布）                |
| `wrangler.toml` | Worker 名 `moneycounts`，SPA 回退              |

---

## Author

**@FoodieFred** · [github.com/FoooooodieFred/MoneyCounts](https://github.com/FoooooodieFred/MoneyCounts)

License: ISC

---

# MoneyCounts (English)

A local-first ledger: one-line entry, 35 categories, multiple currencies, travel split-bills. No accounts, no cloud sync.

**Web** · [moneycounts.freddyhu2007.workers.dev](https://moneycounts.freddyhu2007.workers.dev/)  
**macOS (Apple Silicon)** · [download .app zip](https://github.com/FoooooodieFred/MoneyCounts/releases/latest/download/MoneyCounts-macos-arm64.zip)  
**Windows (64-bit)** · [download .exe zip](https://github.com/FoooooodieFred/MoneyCounts/releases/latest/download/MoneyCounts-windows-amd64.zip)

Cloudflare Workers publishes `dist/` from **`main`**. Desktop binaries are on [GitHub Releases](https://github.com/FoooooodieFred/MoneyCounts/releases/latest). UI is Simplified Chinese.

## Web vs desktop

|            | Web / PWA                       | Desktop (Wails)                             |
| ---------- | ------------------------------- | ------------------------------------------- |
| Data       | Browser LocalStorage (~5MB cap) | A file on disk                              |
| New device | Settings → export JSON → import | Same JSON flow; stores are not shared       |
| Use when   | Quick capture, installable PWA  | Larger books, or the browser quota is tight |

Store files: macOS `~/Library/Application Support/MoneyCounts/store.json` · Windows `%AppData%\MoneyCounts\store.json`.

Unsigned macOS: **right-click → Open**. Unsigned Windows: SmartScreen → More info → Run anyway. Needs [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/).

## Features

Natural-language entry (rules locally, or an OpenAI-compatible model from `/console`), 35 categories, multi-day `date_spec` phrases that **copy the same amount onto each day**, manual grid, period stats, FX cache, budgets, travel AA, search, CSV, JSON backup, PWA. Old 10-class books migrate in place (`monthly-smart-ledger:v1`).

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

LLM calls go through same-origin `/api/llm/chat`. API keys live in `monthly-smart-ledger:llm-api:v1` and are **off** JSON backup by default.

## Author

**@FoodieFred** · [github.com/FoooooodieFred/MoneyCounts](https://github.com/FoooooodieFred/MoneyCounts)

License: ISC
