# 阶段4 延期 / 先保留项

> 日期：2026-08-05  
> 原则：拿不准先保留，宁可少删。

| 项 | 原因 | 建议后续 |
| --- | --- | --- |
| `@vitest/coverage-v8` | 无 coverage 脚本，不明是否计划启用 | 明确不要 coverage 后再卸载 |
| 已跟踪 `dist/` | 入库惯例未决；阶段3仅同步 build 产物 | 决定是否改为生成物不入库并更新 `.gitignore` |
| `vite.config.js` + `vite.config.d.ts` | 与 `vite.config.ts` 等价的编译产物且被跟踪 | 确认无外部依赖后停止跟踪并只保留 `.ts` |
| `src/lib/ledgerInsights.ts` | 仅导出 type，实现仍在 `App`；非死文件 | 阶段5+ 再考虑把洞察逻辑迁入 |
| `App.tsx` / `styles.css` 大文件拆分 | 中高风险，超出本阶段「最多 1 个低风险抽取」 | 在验收流程守护下分批拆 |
| Google Fonts / 汇率外网 API | 运行时依赖，非冗余 | 仅文档知悉 |
| `.gitignore` 中 next.js 段 | 历史痕迹，无害；且本地 `.next/` 已删 | 可保留 |
| ESLint 未升为 CI 硬门槛 | 现有代码仍有少量 warn；本阶段只加工具 | 逐步清 warn 后再 gate |
