# 阶段3：结构重整计划

> 基线：`main` 已与 `origin/main` fast-forward 对齐（含 README 更新）；盘点文档已提交。  
> 约束：只移动/重命名 + 修正 import；不改业务逻辑；CSS 不拆分。

## 现状结论

`src/` 已有合理分层：`components/`、`pages/`、`hooks/`、`lib/`。  
**无需大规模重组。** 主要问题是盘点标记的 4 个根级散落文件。

## 将移动（本阶段执行）

| 当前路径 | 目标路径 | 理由 |
| --- | --- | --- |
| `src/localLedgerParser.ts` | `src/lib/localLedgerParser.ts` | 纯解析逻辑，归入 lib |
| `src/travelMode.ts` | `src/lib/travelMode.ts` | 状态/持久化纯逻辑，归入 lib |
| `src/TravelHistoryUI.tsx` | `src/components/TravelHistoryUI.tsx` | UI 组件，归入 components |
| `src/travelCharts.tsx` | `src/components/TravelCharts.tsx` | UI 图表；顺带 PascalCase 命名 |

配套：更新引用方 import；`vite.config.ts` 的 `manualChunks` 匹配字符串随文件名调整（非业务逻辑）。

## 刻意不动（本阶段）

| 项 | 原因 |
| --- | --- |
| `App.tsx` / `styles.css` 拆分 | 高风险；属阶段4 |
| `dist/` 跟踪策略 | 仓库惯例未决；先保留 |
| `vite.config.js` / `.d.ts` | 编译产物去留拿不准 |
| 空 `api/`、本地 `.next/` | 拿不准 / 磁盘残留，阶段3不删 |
| `App` 内嫌疑死 `PieChart` | 拿不准先保留 |
| 大批量组件/工具重命名 | 风险高；现有命名基本合规 |
| CSS 拆到 `styles/` | 只移不改逻辑仍有回归面；留阶段4 |

## 验证批次

1. Batch A：`localLedgerParser` → `lib/` → `typecheck`  
2. Batch B：`travelMode` → `lib/` → `typecheck`  
3. Batch C：旅游 UI → `components/`（含 `TravelCharts` 命名）→ `typecheck`  
4. 全量：`npm test`；可行则 `npm run build`（`dist/` 若弄脏，按跟踪惯例同步或还原后说明）
