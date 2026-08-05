# 阶段4结果：代码规范化

> 完成日期：2026-08-05  
> 基线：阶段3 完成后的 `main`（含 `c2b601c` 等）

## 预备

| 项 | 结果 |
| --- | --- |
| 分支 | `main`，开始时工作区干净 |
| 计划文档 | `07-phase4-plan.md` |
| 延期清单 | `08-phase4-deferred.md` |

## 第一层：统一代码风格

| 动作 | 说明 |
| --- | --- |
| 引入工具 | Prettier 3.9 + ESLint flat（`typescript-eslint` + `react-hooks` + `eslint-config-prettier`） |
| 风格约定 | 2 空格、双引号、分号、`printWidth: 100`、`trailingComma: "all"`（对齐现有多数风格） |
| 全量 format | `src/**`、配置与少量根文件；忽略 `dist/`、`node_modules/`、`.next/`、`docs/` |
| scripts | `format` / `format:check` / `lint` |

**验证**：`typecheck` ✅ · `test` 32 passed ✅

## 第二层：清理冗余

### 已删除 / 清理

| 项 | 说明 |
| --- | --- |
| `App.tsx` 本地 `PieChart` + `polarToCartesian` / `getPieSlicePath` | grep 确认仅 `LazyPieChart` 被引用 |
| 未使用 `parseNaturalLedgerInput` / `clearNaturalLedgerInput` | 已由 `handleQuickExpenses` + `NaturalLanguageInput` 替代 |
| 未使用 `trendPoints`、`getCurrencyLabel`、`APP_SETTINGS_KEY` import | 无引用 |
| 未使用 import/参数 | `isMigratedHomeSection`、`FeatureBlock`/`NaturalLanguageInput` 的 `ctx` → `_ctx` 等 |
| 空目录 `api/` | 删除；`tsconfig.json` include 去掉 `api` |
| 本地 `.next/` | 磁盘删除（本已 gitignore） |
| 工作区 `.DS_Store`（非 node_modules） | 磁盘删除 |
| 无第三方依赖卸载 | 无高确信无用依赖 |

### 未卸载 / 先保留

见 `08-phase4-deferred.md`（`@vitest/coverage-v8`、`dist/` 入库、`vite.config.js` 等）。

**验证**：`typecheck` ✅ · `test` 32 passed ✅ · `build` ✅（同步已跟踪 `dist/` 哈希）

## 第三层：核心逻辑模块化

**跳过。**

原因：阶段3 已完成路径归位；`dateRange` / `ledgerStats` / parser / backup 等纯逻辑此前已抽出。本阶段无「边界极清晰且紧迫」的单点抽取；强行拆 `App.tsx` JSX 或 `styles.css` 属中高风险，不符合「最多 1 个低风险抽取、禁止顺手改行为」。

## 提交一览

| Hash | Message |
| --- | --- |
| `7455862` | `docs: add phase 4 code normalization plan` |
| `90921f6` | `chore: add prettier and eslint config` |
| `5013116` | `chore: format codebase with prettier` |
| `10747b0` | `refactor: 清理冗余代码与依赖` |
| （本文件提交） | `docs: record phase 4 code normalization result` |

## 验证汇总

| 命令 | 结果 |
| --- | --- |
| `npm run typecheck` | 通过（各层后均跑） |
| `npm test` | 2 files / 32 tests passed |
| `npm run build` | 通过 |
| `npm run lint`（清理后） | 无 error |

## 结论

**阶段4完成。** 格式工具已就绪；高确信死代码与本地残留已清理；模块化本层刻意跳过。

**阶段5（规则/文档固化）需用户确认后再继续。本阶段未 push。**
