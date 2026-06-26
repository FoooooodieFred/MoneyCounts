# MoneyCounts · 月度智能记账本

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)

> **界面语言**：当前版本为**简体中文** UI。多语言（i18n）计划中。  
> **UI language**: Simplified Chinese only for now. Full internationalization (i18n) is planned.

一款纯前端的月度智能记账 Web 应用。数据保存在浏览器 **LocalStorage**，无需后端；支持自然语言快速记账、多货币换算、旅游模式、统计图表、PWA 安装与 GSAP 动效。

A client-side monthly smart ledger. Data lives in **LocalStorage**—no backend required. Natural-language entry, multi-currency conversion, travel mode, charts, PWA install, and GSAP animations.

**仓库 / Repository**：[github.com/FoooooodieFred/MoneyCounts](https://github.com/FoooooodieFred/MoneyCounts)

---

## 目录 · Table of Contents

| 中文 | English |
|------|---------|
| [功能概览](#功能概览) | [Features](#features) |
| [快速开始](#快速开始) | [Quick Start](#quick-start) |
| [自然语言记账](#自然语言记账) | [Natural Language Entry](#natural-language-entry) |
| [数据与隐私](#数据与隐私) | [Data & Privacy](#data--privacy) |
| [技术栈](#技术栈) | [Tech Stack](#tech-stack) |
| [作者 / Author](#作者--author) | — |

---

## 功能概览

### 路由

| 路径 | 说明 |
|------|------|
| `/` | 首页 · 7 屏纵向滚动记账体验 |
| `/search` | 搜索与高级筛选 |
| `/settings` | 设置、预算、完整备份、汇率查询 |
| `/travel` | 旅游模式 |

### 全站导航

- 桌面端顶部 **fixed** 导航栏全站常驻（首页锚点、搜索、旅游、设置等）
- 移动端底部快捷栏提供主要跳转
- 旅游模式激活时导航栏切换橙色度假氛围

### 首页 · 固定 7 屏结构

首页采用语义化 7 屏骨架，核心顺序固定；设置页的区块排序仅影响导航偏好，不改变这 7 屏渲染顺序。

| 屏 | 区块 | 说明 |
|----|------|------|
| **第 1 屏** | Hero + 自然语言记账 | 日期卡片、记账标语；可选「趣味小卡片」（默认关闭）；「几句话记几笔」主输入区 |
| **第 2 屏** | 今日明细 | 当日记录内联编辑；可打开完整记账表格弹窗 |
| **第 3 屏** | 日统计 | 当日汇总，支持**分币种**与**单币种合并**切换 |
| **第 4 屏** | 本周统计 | 自然周（周一至周日）分类汇总与饼图；可在设置中隐藏 |
| **第 5 屏** | 本月汇总 | 当月分类汇总与饼图；可在设置中隐藏 |
| **第 6 屏** | 全年趋势 + 数据工具 | 近 N 个月趋势图、CSV 导入/导出与清理；预算开启时在此屏展示预算概览 |
| **第 7 屏** | 页脚 | 开发者信息与 GitHub 链接 |

### 自然语言记账

- 多句/多行输入，中文标点分句，支持多金额同句拆分
- 多日期：今天/明天/大前天、星期几、`整周每天` 等周期展开
- 负支出：AA、有人 A 我、退款、到账 → 负金额记录
- 提交后先展开**可编辑预览**（日期、分类、金额、货币、备注均可改），确认后批量写入
- **底部 compact 输入**：滚过第一屏后从底部滑入；从此处提交会自动滚回「几句话记几笔」预览区
- 成功确认记账后触发 **GSAP 彩带**庆祝动效

### 手动记账明细弹窗

- 标题：`{日期} 记账明细`
- 10 个类目 × 每类最多 **50 条**记录
- 类目：餐饮、交通、购物、居住、通讯、娱乐、医疗、教育、旅行、其他
- 键盘方向键导航（↑↓ 行、←→ 字段）；Enter 新增、Tab 切换类目
- 支持隐藏/恢复、删除/清空；今日默认货币滑动选择

### 预算管理

- 默认**关闭**；在设置页开启后可指定预算货币、月度总预算与分类预算
- 开启后第 6 屏展示：本月已用、剩余/超出、日均可花、分类进度
- 负支出视为抵扣；跨币种记录按当前汇率换算到预算货币

### 趣味小卡片

- 默认**关闭**；在设置页开启后显示于第 1 屏 Hero 区
- 三层交错卡片池，含消费洞察、本周对比、连续记账徽章等轻量趣味内容
- 可点击洗牌刷新卡片组合

### 搜索页 · `/search`

- 按备注关键词、分类、日期范围、金额区间组合筛选
- 备注关键词可作为轻量标签搜索（如「咖啡」「#通勤」）
- 点击结果可定位回首页对应日期

### 设置页 · `/settings`

**首页区块显隐与排序**

- 仅 **4 个区块可隐藏**：趣味小卡片、工具与趋势、本周统计、本月汇总
- 核心区块（自然语言记账、记账明细、日统计、页脚等）始终显示
- 支持拖拽排序、↑↓ 按钮与键盘方向键排序；一键隐藏/显示可选区块；恢复默认顺序

**预算管理** — 见上文。

**完整 JSON 备份 / 导入**

- 导出包含：账本、汇率缓存、货币设置、主题、备份提醒、设置配置、旅游状态与历史
- 导入前先展示预览摘要（日期/记录数量、设置覆盖、旅游历史条数），确认后覆盖当前数据

**汇率查询**

- 兑换表与手动刷新位于设置页（已从首页迁移）
- 打开应用时自动拉取一次；来源 `open.er-api.com`（USD 基准），缓存至 LocalStorage

**备份提醒** — 支持立即导出、明天提醒、3 天内不提醒。

### 旅游模式 · `/travel`

独立页面，与日常记账分离：

- 行程/账单管理、同行人与 **AA 均分**（默认 A/B/C 昵称可用于自然语言分账）
- 每笔消费可添加**地点**标签
- **每日预算**与**分类预算**，进度与超支预警
- 结束旅行时保存**汇率快照**，历史换算不随后续刷新改变
- 开启后橙色度假氛围；退出时选择保留口径（仅本人 / 保留所有人分账）
- 历史账单、详情、重命名、合并、CSV 导出、本地同步标记
- 类目汇总与懒加载图表

### 常驻快捷操作

- **左下角**：圆形主题按钮（☀ 日间 / ☾ 夜间）
- **右下角**：三个圆形日期按钮（前一天 · 今天 · 后一天）

### 货币与汇率

- **主要货币**：港币 (HKD)、人民币 (CNY)
- **扩展货币**：USD、MOP、JPY、EUR、KRW、THB、SGD、NTD、NZD、GBP、AUD 等
- 统计与汇总可按不同货币口径切换

### 动效、图表与 PWA

- [GSAP](https://gsap.com/) 驱动页面入场、弹窗、卡片交互与彩带庆祝
- 统计饼图、趋势图与旅游图表**懒加载**，首屏保留轻量占位
- 遵循 `prefers-reduced-motion`；动画结束清理 inline 样式
- **PWA**：Web App Manifest、SVG 图标、Service Worker；可安装到桌面/主屏幕，缓存静态壳层支持离线打开（账本数据仍在 LocalStorage）

---

## 快速开始

### 环境要求

- Node.js 18+
- npm 9+

### 安装与运行

```bash
git clone https://github.com/FoooooodieFred/MoneyCounts.git
cd MoneyCounts
npm install
npm run dev        # 开发服务器，默认 http://localhost:5173
npm run build      # 生产构建 → dist/
npm run preview    # 预览生产构建
npm test           # 自然语言解析器单元测试（Vitest）
npm run typecheck  # TypeScript 类型检查
```

### 部署

构建产物为静态文件，可部署至 **Vercel、Netlify、GitHub Pages** 等任意静态托管：

```bash
npm run build
# 上传 dist/ 目录
```

无需环境变量；汇率请求在浏览器端发起（需用户联网）。

### 常见问题

**页面样式异常或模块报错** — 关闭旧开发进程后重试；必要时删除 `node_modules/.vite` 或重新 `npm install`。

**数据存在哪里？** — 全部在浏览器 LocalStorage。清除站点数据、换浏览器或换设备不会自动同步。请定期在设置页使用「导出 JSON」完整备份；账本表格也可在首页第 6 屏使用 CSV 导入/导出。

---

## 自然语言记账

在「几句话记几笔」文本框中输入一条或多条消费描述，系统解析为结构化记录，经预览确认后写入。

**示例输入：**

```
我今天吃了65USD的午餐，33块钱的充值。93元的公交车洗衣服花了78HKD，晚餐300HKD，但是有人A了我85块钱。
```

**解析能力概览：**

- 中文标点分句（`，。；` 等）及多金额同句拆分
- 识别 CNY / HKD / USD 及「元、块、港币、美元」等表达
- 类目关键词：餐饮、交通、购物、居住、通讯、娱乐、医疗、教育、旅行等
- AA / 有人 A / 退款 → **负金额**记录
- 未标明货币时使用当前默认货币（CNY 或 HKD）
- `这一周每天地铁来回10.8HKD` → 周一至周日 7 笔；`今天明天都要洗衣服花10HKD` → 两天记录
- 底部 compact 输入在滚过第一屏后滑入；从此提交会滚回主输入区预览；确认成功后 GSAP 彩带庆祝

解析逻辑：`src/lib/expenseParseShared.ts`、`src/localLedgerParser.ts`  
测试：`src/lib/quickExpenseParser.test.ts`

---

## 数据与隐私

| 项目 | 说明 |
|------|------|
| 存储位置 | 浏览器 LocalStorage（键名前缀 `monthly-smart-ledger:*`） |
| 服务器 | 无；除汇率 API 外不发送记账数据 |
| 备份 | 设置页 JSON 完整导出 / 导入预览；首页 CSV 导出 / 导入账本行 |
| 清除 | 首页「清空当日/当月」或浏览器清除站点数据 |

---

## 技术栈

| 类别 | 技术 |
|------|------|
| UI | React 19 + TypeScript |
| 路由 | react-router-dom（`/`、`/search`、`/settings`、`/travel`） |
| 构建 | Vite 8 |
| 样式 | 自定义 CSS（Design tokens、日夜间主题、旅游橙色变量） |
| 动画 | GSAP 3 + ScrollTrigger |
| 测试 | Vitest |
| 存储 | LocalStorage |
| 离线 | PWA（Manifest + Service Worker） |

### 项目结构（简要）

```
src/
├── App.tsx                 # 主页面逻辑、统计、路由、数据管理
├── pages/
│   ├── SearchPage.tsx      # 搜索与筛选
│   ├── SettingsPage.tsx    # 设置、预算、备份、汇率
│   └── TravelPage.tsx      # 旅游模式
├── components/             # Hero、自然语言输入、图表、导航、FAB 等
├── lib/                    # 解析器、设置、备份、统计纯逻辑
├── travelMode.ts           # 旅游模式数据层
└── hooks/useGsapContext.ts # GSAP 生命周期封装
```

功能保全与交互契约详见 [`docs/refactor-preservation.md`](docs/refactor-preservation.md)。

---

## Features

### Routes

| Path | Description |
|------|-------------|
| `/` | Homepage · fixed 7-screen scroll experience |
| `/search` | Search and advanced filters |
| `/settings` | Settings, budgets, full backup, exchange rates |
| `/travel` | Travel mode |

### Global navigation

- Desktop **fixed** top nav persists across all routes (anchors, search, travel, settings)
- Mobile bottom shortcut bar for primary jumps
- Orange vacation accent when travel mode is active

### Homepage · Fixed 7-screen layout

Core screen order is fixed; settings section reordering affects nav preferences only, not the 7-screen skeleton.

| Screen | Section | Description |
|--------|---------|-------------|
| **1** | Hero + NL entry | Date chip, tagline; optional playful stat cards (off by default); main “几句话记几笔” input |
| **2** | Today's entries | Inline edit; open full manual ledger modal |
| **3** | Day totals | Split-by-currency or single-currency merged view |
| **4** | This week | Mon–Sun category summary and pie chart; hideable in settings |
| **5** | This month | Monthly category summary and pie chart; hideable in settings |
| **6** | Year trend + tools | N-month trend chart, CSV import/export/clear; budget overview when enabled |
| **7** | Footer | Credits and GitHub link |

### Natural language entry

- Multi-sentence / multi-line input with Chinese punctuation splitting
- Multi-date: today/tomorrow/day-of-week/`整周每天` recurring expansion
- Negative amounts for AA, refunds, incoming transfers
- Editable preview before import; compact bottom bar slides in after screen 1; submit from compact scrolls back to preview
- GSAP confetti on successful import

### Manual ledger modal

- 10 categories × up to **50 entries** each; keyboard navigation; hide/restore/delete

### Budget management

- Off by default; enable in settings for monthly/category limits and day-screen-6 overview
- Negative expenses offset spending; mixed currencies converted via cached rates

### Playful stat cards

- Off by default; optional Hero cards with insights, weekly comparison, streak badges

### Search · `/search`

- Filter by keyword, category, date range, amount range; jump back to homepage date

### Settings · `/settings`

- Toggle visibility for 4 optional sections only; drag/keyboard reorder; show/hide all optional blocks
- Full JSON backup with import preview; exchange rate table (moved from homepage)
- Budget configuration and backup reminder snooze

### Travel mode · `/travel`

- Trip bills, companions, equal split (A/B/C nicknames in NL input), location tags
- Daily/category budgets, rate snapshots on trip end, history/merge/CSV export
- Orange vacation theme; lazy-loaded charts

### Motion, charts & PWA

- GSAP animations with `prefers-reduced-motion` fallback
- Lazy-loaded pie/trend/travel charts
- Installable PWA with offline static shell; ledger data stays in LocalStorage

---

## Quick Start

```bash
git clone https://github.com/FoooooodieFred/MoneyCounts.git
cd MoneyCounts
npm install
npm run dev        # dev server → http://localhost:5173
npm run build      # production build → dist/
npm run preview    # preview production build
npm test           # NL parser unit tests (Vitest)
npm run typecheck  # TypeScript check
```

Deploy the `dist/` folder to any static host. No env vars required.

---

## Natural Language Entry

Type one or more expense descriptions; the parser splits clauses, detects amounts/currencies/categories, and supports AA/refunds as negative amounts. Recurring patterns like `这一周每天地铁来回10.8HKD` expand to multiple dated records. Compact bottom input appears after scrolling past screen 1; confirmed imports trigger GSAP confetti.

Logic: `src/lib/expenseParseShared.ts` · Tests: `src/lib/quickExpenseParser.test.ts`

---

## Data & Privacy

| Item | Details |
|------|---------|
| Storage | Browser LocalStorage only (`monthly-smart-ledger:*`) |
| Server | None; ledger data never uploaded (exchange API fetches rates only) |
| Backup | Full JSON export/import preview in settings; CSV on homepage screen 6 |
| Clear | In-app clear day/month, or browser site-data wipe |

---

## Tech Stack

Vite 8 · React 19 · TypeScript · GSAP · react-router-dom · LocalStorage · Vitest · PWA

See [`docs/refactor-preservation.md`](docs/refactor-preservation.md) for feature inventory and interaction contracts.

---

## 作者 · Author

**@FoodieFred** · [github.com/FoooooodieFred/MoneyCounts](https://github.com/FoooooodieFred/MoneyCounts)

---

## 许可证 · License

ISC（见 `package.json`）
