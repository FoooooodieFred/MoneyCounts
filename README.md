# MoneyCounts · 月度智能记账本

一款纯前端的月度智能记账 Web 应用。数据保存在浏览器 **LocalStorage**，支持多货币日记账、本地自然语言解析、旅游模式与历史归档、统计图表、夜间模式与 GSAP 动效，无需后端服务或云端大模型。

---

## 项目简介

MoneyCounts（月度智能记账本）以「按日 × 分类」的格子账本为核心，帮助你在一个页面内完成日常记账、跨币种汇总、旅游专项记账与月度回顾。所有账本数据与偏好设置均存储在本机浏览器中；建议定期通过 **CSV 导出** 做备份。

> **隐私说明**：本应用不收集账号信息，不上传账本内容。自然语言解析完全在浏览器本地完成；已移除 Vercel 部署配置，不依赖任何云端 LLM 或代理服务。

---

## 核心功能

### 日记账

- 10 大分类：餐饮、交通、购物、居住、通讯、娱乐、医疗、教育、旅行、其他
- 按日期浏览与编辑，每类最多 **15** 条记录（旧版 5 条数据会自动迁移扩展）
- 支持隐藏单条记录（不计入统计）、备注与金额编辑
- 连续记账天数等趣味数据卡片

### 多货币

- 内置 HKD、CNY、USD、MOP、JPY、EUR、KRW、THB、SGD、NTD、NZD、GBP、AUD 等常用货币
- 可添加自定义 ISO 4217 货币代码
- 汇率来自 [open.er-api.com](https://open.er-api.com)（公开接口，无需 API Key），本地缓存 24 小时，失败时回退默认汇率
- 统计支持多货币口径切换与合并展示

### 自然语言本地解析

在「自然语言记账」模块输入一段话，由 `localLedgerParser.ts` 在浏览器内解析为结构化记录，例如：

```text
昨天午餐花了 58 港币，打车 42 HKD，星巴克 36 人民币
```

解析能力包括：

- 金额、正负数与退款语义
- 相对日期：今天 / 昨天 / 前天 / 明天 / 后天 / 大后天、星期几
- 绝对日期：`YYYY-MM-DD`、`MM-DD`、中文月日
- 货币别名：HKD / 港币 / CNY / 人民币 / USD 等
- 关键词分类映射（餐饮、交通、购物等）

解析结果以可编辑表格预览，确认后写入对应日期与分类格子。

### 旅游模式与历史

- **开始旅游**：记录起止日期、目的地货币与结算货币，可尝试根据 IP 自动识别所在地（`ipapi.co`）
- **旅游账单**：独立汇总、饼图与分类统计，支持导出 CSV
- **旅游历史**：结束旅游后归档；支持重命名、合并多条记录、查看详情（饼图、货币分布、明细表）
- 侧滑面板与弹窗由 GSAP 驱动入场/退场动画

### 统计

- **本周统计**、**本月统计 / 月度总结**
- 按分类饼图、多货币拆分或合并口径
- 旅游模式下的专项统计与历史回顾

### 夜间模式

- 浅色 / 深色主题一键切换，偏好写入 LocalStorage

### GSAP 动效

- 自然语言预览面板展开收起
- 旅游历史侧栏、详情与合并弹窗
- 尊重系统 `prefers-reduced-motion` 设置

### CSV 导入 / 导出

- **导出 CSV**：按当前月份导出完整账本
- **导入 CSV**：按日期、类目和序号覆盖对应格子，其余数据保持不变
- 旅游账单可单独导出

### LocalStorage 本地存储

主要存储键（节选）：

| 键名 | 用途 |
|------|------|
| `monthly-smart-ledger:v1` | 账本主体数据 |
| `monthly-smart-ledger:exchange` | 汇率缓存 |
| `monthly-smart-ledger:theme` | 主题模式 |
| `monthly-smart-ledger:travel` | 当前旅游状态 |
| `monthly-smart-ledger:travel-history` | 旅游历史记录 |

应用会定期提醒导出 CSV 备份。清理浏览器缓存或更换设备会导致数据丢失。

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React 19 + TypeScript |
| 构建 | Vite 8 |
| 动画 | GSAP 3 |
| 存储 | 浏览器 LocalStorage |
| 部署形态 | 纯静态前端，无服务端 |

### 主要模块

| 文件 | 说明 |
|------|------|
| `src/App.tsx` | 主界面、账本逻辑、统计、导入导出 |
| `src/localLedgerParser.ts` | 自然语言本地解析引擎 |
| `src/travelMode.ts` | 旅游状态、历史归档、地理识别、合并逻辑 |
| `src/TravelHistoryUI.tsx` | 旅游历史面板与弹窗 UI |
| `src/travelCharts.tsx` | 旅游统计图表组件 |

---

## 本地运行

### 环境要求

- Node.js 18+（推荐 LTS）
- npm

### 安装与启动

```bash
npm install
npm run dev
```

浏览器访问终端显示的本地地址（通常为 `http://localhost:5173`）。

### 开发者命令

```bash
npm run typecheck   # TypeScript 类型检查
npm run build       # 生产构建（输出至 dist/）
npm run preview     # 预览构建产物
```

---

## 数据存储与备份

- **存储位置**：浏览器 LocalStorage（仅当前域名 / 本机浏览器配置文件）
- **不会同步**：换设备、换浏览器、无痕模式或清理站点数据后，账本不会自动迁移
- **建议**：养成定期 **导出 CSV** 的习惯；重要数据请自行保管备份文件
- **敏感信息**：仓库与构建产物中不包含 `.env` 或 API Key；`.env*.local` 已在 `.gitignore` 中忽略

---

## 网络依赖说明

以下功能在联网时体验更佳，但账本数据本身始终保存在本地：

| 用途 | 服务 |
|------|------|
| 汇率刷新 | open.er-api.com |
| 旅游自动定位 | ipapi.co |
| 日期校准（可选） | worldtimeapi.org |

自然语言记账 **不** 调用任何大模型或第三方 AI API。

---

## 仓库

GitHub：[https://github.com/FoooooodieFred/MoneyCounts](https://github.com/FoooooodieFred/MoneyCounts)

---

## 许可证

ISC（见 `package.json`）
