# 阶段3结果：结构重整

> 完成日期：2026-08-05  
> 基线 tag：`baseline-pre-cleanup` @ `279ab60`（仍在；当前 `main` 在其后含 README + 盘点文档 + 本阶段改动）

## 预备

| 项 | 结果 |
| --- | --- |
| `git pull --ff-only` | 成功：`279ab60` → `1dd9ecc`（Update README.md） |
| 落后 `origin/main` | 已解决，对齐后无冲突 |
| 盘点文档提交 | `docs: add cleanup inventory for phase 1-2` |
| 工作区干净后开移 | 是 |

## 实际移动 / 重命名

| 原路径 | 新路径 |
| --- | --- |
| `src/localLedgerParser.ts` | `src/lib/localLedgerParser.ts` |
| `src/travelMode.ts` | `src/lib/travelMode.ts` |
| `src/TravelHistoryUI.tsx` | `src/components/TravelHistoryUI.tsx` |
| `src/travelCharts.tsx` | `src/components/TravelCharts.tsx`（PascalCase） |

配套修正：各引用方 import；`localLedgerParser` 内部相对 `lib/` 路径；`vite.config.ts` / `vite.config.js` 的 charts chunk 匹配兼容 `TravelCharts`。

**无** re-export 薄封装（引用点少，直接改路径更干净）。

## 验证

| 命令 | 结果 |
| --- | --- |
| `npm run typecheck`（每批后） | 通过 |
| `npm test` | 2 files / 32 tests passed |
| `npm run build` | 通过；更新已跟踪的 `dist/` 哈希产物 |

## 刻意未动

- `App.tsx` / `styles.css` 拆分（阶段4）
- `dist/` 是否停止入库（惯例未决，仅同步本次 build）
- `vite.config.js` 是否停止跟踪（仅同步 chunk 字符串）
- 空 `api/`、本地 `.next/`、嫌疑死 `PieChart`、大批量重命名
- CSS 拆到 `styles/`

## 本阶段相关提交

| Hash | Message |
| --- | --- |
| `8eab9f1` | `docs: add cleanup inventory for phase 1-2` |
| `24349b5` | `refactor: 规整目录结构` |
| （本文件提交） | `docs: record phase 3 structure cleanup result` |

## 结论

结构本已基本规范；本阶段只做**有限、有价值**归位。`src/` 根目录现仅余 `App.tsx`、`main.tsx`、`styles.css`、`vite-env.d.ts`。

**阶段3完成。阶段4（格式化/删冗余/逻辑模块化）需用户确认后再继续。**
