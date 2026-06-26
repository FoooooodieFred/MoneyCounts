# MoneyCounts · 月度智能记账本

纯前端月度记账 Web 应用，数据保存在浏览器 LocalStorage，无需后端。

**在线体验 → [moneycounts.freddyhu2007.workers.dev](https://moneycounts.freddyhu2007.workers.dev/)**

---

## 功能

- **自然语言记账** — 中文多句输入，预览确认后批量写入；支持多日期、AA/退款负金额
- **手动明细** — 10 类目表格弹窗，键盘导航
- **统计图表** — 日/周/月汇总、全年趋势，懒加载饼图与折线图
- **多货币** — HKD/CNY 为主，USD 等扩展货币；汇率自动拉取并缓存
- **预算管理** — 月度与分类预算，超支预警
- **旅游模式** — 独立行程账单、AA 均分、地点标签、汇率快照
- **搜索筛选** — 关键词、分类、日期、金额区间
- **备份** — JSON 完整导出/导入，CSV 账本导入/导出
- **PWA** — 可安装到桌面，离线打开静态壳层

**界面语言**：当前为简体中文 UI；多语言（i18n）计划中。

---

## 快速开始

```bash
git clone https://github.com/FoooooodieFred/MoneyCounts.git
cd MoneyCounts
npm install
npm run dev      # http://localhost:5173
npm run build    # 构建 → dist/
```

Node.js 18+ · 无需环境变量 · 构建产物可部署至任意静态托管。

---

## 技术栈

React 19 · TypeScript · Vite 8 · GSAP · react-router-dom · LocalStorage · Vitest · PWA

---

## 数据

全部账本数据存于浏览器 LocalStorage，不经过服务器。换设备或清缓存前请在设置页导出 JSON 备份。

---

## Author

**@FoodieFred** · [github.com/FoooooodieFred/MoneyCounts](https://github.com/FoooooodieFred/MoneyCounts)

License: ISC

---

# MoneyCounts · Monthly Smart Ledger

Client-side monthly ledger. Data lives in browser LocalStorage — no backend required.

**Try it → [moneycounts.freddyhu2007.workers.dev](https://moneycounts.freddyhu2007.workers.dev/)**

---

## Features

- **Natural language entry** — Chinese multi-sentence input with editable preview; multi-date, AA/refunds as negative amounts
- **Manual ledger** — 10-category table modal with keyboard navigation
- **Charts** — Day/week/month totals, year trend; lazy-loaded pie and line charts
- **Multi-currency** — HKD/CNY primary, USD and more; auto-fetched exchange rates
- **Budgets** — Monthly and per-category limits with overspend alerts
- **Travel mode** — Trip bills, equal split, location tags, rate snapshots
- **Search** — Keyword, category, date range, amount filters
- **Backup** — Full JSON export/import, CSV ledger import/export
- **PWA** — Installable, offline static shell

**UI language**: Simplified Chinese only for now. Full i18n planned.

---

## Quick Start

```bash
git clone https://github.com/FoooooodieFred/MoneyCounts.git
cd MoneyCounts
npm install
npm run dev      # http://localhost:5173
npm run build    # → dist/
```

Node.js 18+ · No env vars · Deploy `dist/` to any static host.

---

## Tech Stack

React 19 · TypeScript · Vite 8 · GSAP · react-router-dom · LocalStorage · Vitest · PWA

---

## Data

All ledger data stays in browser LocalStorage — never uploaded. Export JSON from settings before switching devices or clearing site data.
