# 功能清单（阶段2盘点）

> 盘点日期：2026-08-05 · 基线：`baseline-pre-cleanup`  
> 依据：`README.md`、`docs/refactor-preservation.md`、源码路由与组件引用。**未改业务逻辑。**

## 已实现功能点

### 记账录入

| 功能 | 说明 | 主要落点 |
| --- | --- | --- |
| 自然语言快速记账 | 中文多句输入 → 草稿识别 → 可编辑预览 → 确认写入 | `NaturalLanguageInput`、`localLedgerParser`、`expenseParseShared`、`quickExpenseParser` |
| 多日期 / 周期展开 | 相对日、星期、整周等展开为多条预览 | `localLedgerParser` + `dateRange` |
| AA / 退款负金额 | 自然语言支持负金额语义 | 解析链路 |
| 手动完整明细表格 | 10 类目表格弹窗；键盘导航；增删隐 | `SettingsModal` + `App` 表格逻辑 |
| 今日明细快编 | 首页编辑当日已有记录 | `TodayEntriesList` |
| 类目体系 | 10 个固定类目；每类最多 50 条 | `App.tsx` `CATEGORIES` / `MAX_RECORDS_PER_CATEGORY` |

### 统计与洞察

| 功能 | 说明 | 主要落点 |
| --- | --- | --- |
| 日 / 周 / 月汇总 | 分币种或合并口径 | `App` + `ledgerStats` + `StatsControls` |
| 分类饼图 | 懒加载 | `LazyCharts.PieChart` |
| 全年趋势图 | 懒加载折线/趋势 | `LazyCharts.TrendChart` |
| 连续记账 / 徽章 | Hero 趣味卡片 | `App` + `ledgerInsights` 类型 |
| 周对比成就 / 近 30 天洞察 | Hero 卡片文案 | `App` 内 `useMemo` |
| 统计货币多选 | 至少一个兜底货币 | `StatsCurrencyPicker` |

### 预算

| 功能 | 说明 | 主要落点 |
| --- | --- | --- |
| 月度总预算 | 设置页配置；首页概览 | `appSettings.budget`、`BudgetOverview` |
| 分类预算 | 超支进度 | 同上 |
| 日均可花 / 剩余天数 | 基于当月剩余 | `dateRange` + `ledgerStats` |

### 多货币与汇率

| 功能 | 说明 | 主要落点 |
| --- | --- | --- |
| 主货币 HKD/CNY + 扩展币种 | 含自定义货币 | `App` `CURRENCY_META` / LocalStorage |
| 汇率拉取与缓存 | USD 基准；NTD→TWD；离线有默认表 | `open.er-api.com` + `RATE_KEY` |
| 设置页汇率面板 | 展示/刷新 | `ExchangeRatesPanel` |

### 旅游模式

| 功能 | 说明 | 主要落点 |
| --- | --- | --- |
| 行程账单 | 名称、日期、目的地/目标货币、同行人 | `travelMode`、`TravelPage` |
| AA 均分 / 参与人 | 分账汇总 | `App`/`travelMode` 分账工具 |
| 地点标签 | 账单命名辅助 | `buildBillNameFromLocation` 等 |
| 旅游自然语言录入 | 复用 `parseNaturalLedger` | `TravelPage` |
| 旅游预算 / 导出账单 | 行程内工具 | `TravelPage` |
| 结束后写历史 | 详情、重命名、删除撤销、合并 | `TravelHistoryUI`、pending delete TTL |
| 旅游图表 | 懒加载饼图/条形/卡片 | `travelCharts` |

### 搜索

| 功能 | 说明 | 主要落点 |
| --- | --- | --- |
| 多条件筛选 | 关键词、分类、日期、金额区间 | `SearchPage` |
| 定位回首页日期 | 选中记录跳转 | `onSelectDate` 契约 |

### 设置与个性化

| 功能 | 说明 | 主要落点 |
| --- | --- | --- |
| 首页区块显隐 / 排序 | 拖拽与上下移；锁定/钉住规则 | `SettingsPage` + `appSettings` |
| 主题 light/dark | LocalStorage | `THEME_KEY` |
| 备份提醒 | 导出 / 明天 / 3 天内不提醒 | `BACKUP_REMINDER_KEY` |

### 备份与导入导出

| 功能 | 说明 | 主要落点 |
| --- | --- | --- |
| JSON 完整备份 | 账本+汇率+设置+旅游等；导入预览确认 | `lib/backup`、`SettingsPage` |
| CSV 导入/导出 | 按格子覆盖 | `App` CSV 逻辑 |

### PWA / 体验

| 功能 | 说明 | 主要落点 |
| --- | --- | --- |
| 可安装 / 离线壳 | manifest + SW | `public/*`、`main.tsx` |
| GSAP 动效 | 入场、预览、模态、彩带等 | 多组件 + `useGsapContext` |
| 滚动导航 | 桌面/移动锚点 | `ScrollNav` |
| 浮动操作 | 快捷入口 | `FloatingActions` |

## 核心用户流程（概览）

1. **日常记账**：打开首页 → 自然语言或手动表格 → 预览确认 → 今日明细可见  
2. **查看统计**：切换日期/统计货币/分合口径 → 展开周月图表  
3. **管预算**：设置页开预算 → 首页预算概览反映进度  
4. **旅游分账**：进入旅游模式 → 记账/均分 → 结束写入历史  
5. **备份迁移**：设置页导出 JSON → 他处导入预览 → 确认覆盖  

> 验收级细化见 `04-acceptance-flows.md`。

## 数据持久化（LocalStorage keys，盘点摘录）

- `monthly-smart-ledger:v1` 账本  
- `monthly-smart-ledger:exchange` 汇率  
- `monthly-smart-ledger:last-currency` / `stats-currencies` / `custom-currencies`  
- `monthly-smart-ledger:theme` / `settings` / `backup-reminder`  
- 旅游：`TRAVEL_KEY` / `TRAVEL_HISTORY_KEY` / `TRAVEL_HISTORY_PENDING_DELETE_KEY`（见 `travelMode.ts`）

## 明确未做 / 计划中（产品层）

- 多语言 i18n（README 标明计划中）  
- 真实后端 / 账号同步（纯前端）  
- `api/` 目录无实现  
