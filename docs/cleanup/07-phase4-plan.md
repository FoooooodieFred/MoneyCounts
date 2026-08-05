# 阶段4计划：代码规范化

> 计划日期：2026-08-05  
> 仓库状态：`main`，工作区干净；相对 `origin/main` 领先 3 提交（阶段1–3 文档与结构整理）。  
> 原则：**只整理、不加功能**；顺序 **格式 → 清冗余 → 按需模块化**；拿不准先保留。

## 预备确认

| 项 | 结果 |
| --- | --- |
| 分支 | `main` |
| 工作区 | clean |
| 近期提交 | `c2b601c` phase3 result → `24349b5` 目录规整 → `8eab9f1` 盘点文档 |
| 现有格式化工具 | **无** ESLint / Prettier / Biome |
| 现有多数风格 | 2 空格、双引号、分号、行宽多数 <100（p90≈73） |

## 第一层：统一代码风格（零风险）

1. 引入 **Prettier**（主格式化）+ 最小 **ESLint**（flat config，`typescript-eslint` + `react-hooks`），规则对齐现有风格，避免风格大翻转。  
2. Prettier 约定：`semi: true`、`singleQuote: false`、`tabWidth: 2`、`printWidth: 100`、`trailingComma: "all"`。  
3. 全量 format：`src/**`、根级 `*.ts`/`*.tsx`/`*.html`/`package.json` 等源与配置；**不**格式化 `dist/`、`node_modules/`、`.next/`。  
4. 拆两次提交：`chore: add prettier/eslint config` → `chore: format codebase with prettier`。  
5. 每层后：`npm run typecheck`；本层末可 `npm test`。

## 第二层：清理冗余垃圾（低风险）

| 候选 | 动作 | 依据 |
| --- | --- | --- |
| `App.tsx` 本地 `PieChart` + `polarToCartesian` / `getPieSlicePath` | **删除** | 渲染仅用 `LazyPieChart`；本地函数无 JSX 引用（grep 确认） |
| 空目录 `api/` | **删除** | 无文件、无后端；阶段3后仍空 |
| 本地 `.next/` | **磁盘删除** | 已 gitignore；旧 Next 残留 |
| 工作区 `.DS_Store` | **磁盘删除** | 已 gitignore |
| `@vitest/coverage-v8` | **先保留** | 无 coverage 脚本，不明是否计划使用 → `08-phase4-deferred.md` |
| 已跟踪 `dist/`、`vite.config.js`/`.d.ts` | **先保留** | 入库惯例未决 → deferred |
| `ledgerInsights.ts` 类型空壳 | **先保留** | 非死文件 |
| 未确认 unused import 批量清扫 | **克制** | 仅删已确认死代码；eslint unused 若误报则不删 |

验证：`typecheck` + `test`；关键节点 `build`。  
提交：`refactor: 清理冗余代码与依赖`。

## 第三层：核心逻辑模块化（中风险，克制）

- **默认倾向跳过**：阶段3已完成路径归位；`dateRange` / `ledgerStats` / parser 等纯逻辑已抽出。  
- 本层**最多** 1 个抽取；仅当存在边界极清晰、零行为变化的纯函数块。  
- **不做**：拆分 `App.tsx` JSX、拆 `styles.css`、批量抽 hooks。  
- 若跳过：在结果文档写明原因。

## 文档产出

| 文件 | 内容 |
| --- | --- |
| `07-phase4-plan.md` | 本计划 |
| `08-phase4-deferred.md` | 拿不准而保留的项 |
| `09-phase4-result.md` | 各层做了什么、验证、commit |

## 明确不做

- 不加新功能、不改产品需求  
- 不进入阶段5（规则/文档固化）或阶段6  
- 不 push  
- 不强制卸载拿不准的依赖  
