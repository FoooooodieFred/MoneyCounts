# 问题与冗余标记（阶段2盘点）

> 盘点日期：2026-08-05 · **只标记、不删除、不移动、不改逻辑**  
> 凡「拿不准」一律标注 **先保留**。

## 图例

| 标记 | 含义 |
| --- | --- |
| 🔴 高确信冗余/残留 | 后续整理优先候选，仍需人工确认后再动 |
| 🟡 结构/可维护性风险 | 非死代码，但整理成本高 |
| 🟠 嫌疑死代码 | 需再确认引用链；**拿不准先保留** |
| ⚪ 不明 / 先保留 | 信息不足，阶段3前勿动 |

---

## 1. 构建与仓库残留

| 项 | 标记 | 说明 |
| --- | --- | --- |
| `.next/`（约 245MB） | 🔴 | 旧 Next.js 构建残留；已在 `.gitignore`，本地仍占盘。**删除前确认无未迁移资源 → 拿不准先保留磁盘副本直到备份确认** |
| `api/` 空目录 | 🔴 | 无文件、无后端；可能是历史占位。**先保留空目录直至阶段3确认** |
| `.cursor/` 空目录 | ⚪ | 工具目录；无项目规则。可忽略 |
| `dist/` 被 git 跟踪 | 🟡 | `.gitignore` 未忽略 `dist/`；`npm run build` 会弄脏工作区。是否改为生成物不入库 → **阶段3决策，先保留** |
| `vite.config.js` + `vite.config.d.ts` | 🟡 | 与 `vite.config.ts` 内容等价的编译产物且被跟踪。是否只保留 `.ts` → **先保留** |
| `tsconfig*.tsbuildinfo` | 🟡 | 本地增量缓存；已 gitignore，正常 |
| `.DS_Store` | 🔴 | 系统垃圾；多处存在。清理无功能影响，但本阶段不改 |

## 2. 源码结构 / 体量

| 项 | 标记 | 说明 |
| --- | --- | --- |
| `src/App.tsx` ≈ 3770 行 | 🟡 | 状态、存储、汇率、统计、旅游分账、路由、大量 JSX 集中；整理主战场 |
| `src/styles.css` ≈ 5990 行 | 🟡 | 全局样式单文件；`button`/`input` 等全局规则易副作用 |
| 根级 `TravelHistoryUI.tsx` / `travelCharts.tsx` / `travelMode.ts` / `localLedgerParser.ts` | 🟡 | 与 `components/`、`lib/`、`pages/` 分层不完全一致；乱结构嫌疑，**先保留路径** |
| 首页区块设置顺序 vs 实际分屏渲染 | 🟡 | `refactor-preservation.md` 已记载不完全同构；改布局易脱节 |

## 3. 废代码 / 重复实现嫌疑

| 项 | 标记 | 说明 |
| --- | --- | --- |
| `App.tsx` 内本地 `function PieChart`（约 L715） | 🟠 | 渲染使用 `LazyPieChart`（`LazyCharts`）；本地 `PieChart` **未见 JSX 引用**。伴随的 `polarToCartesian` / `getPieSlicePath` 可能同为死代码。**拿不准先保留**（或仅注释标记，本阶段不动） |
| `ledgerInsights.ts` 仅导出 type | ⚪ | 实现逻辑仍在 `App` 内；文件非死，但是「类型空壳」。**先保留** |
| `@vitest/coverage-v8` | ⚪ | `package.json` 有依赖，未见 coverage 脚本。不明是否计划使用。**先保留依赖** |
| `docs/refactor-preservation.md` | ⚪ | 文档非废；与本轮盘点有重叠，保留作历史契约 |

## 4. 依赖与外部服务

| 项 | 标记 | 说明 |
| --- | --- | --- |
| 前端 lockfile | ✅ 就绪 | `package-lock.json` 存在；`npm ci --dry-run` 显示 up to date；本阶段未升级大版本 |
| Python / 后端 | — | **无**；跳过 |
| 汇率 API 外网依赖 | 🟡 | 运行时依赖第三方；失败时有默认汇率路径（需阶段3后验收时再压测） |
| Google Fonts（`index.html`） | 🟡 | 外网字体；离线 PWA 下字体行为需知悉。**先保留** |
| `gitignore` 仍含 next.js 段 | ⚪ | 历史痕迹；无害。**先保留** |

## 5. Git / 远程差异（盘点事实）

| 项 | 说明 |
| --- | --- |
| 本地 `main` @ `279ab60` | 已打 annotated tag `baseline-pre-cleanup` |
| 相对 `origin/main` | **落后 1 提交**：`1dd9ecc Update README.md`（未 pull、未 push） |
| 工作区 | 阶段1验证后已还原 `dist/`；盘点文档为新增未提交文件（阶段2产物） |

## 6. 建议的后续整理关注点（非本阶段执行）

1. 拆分 `App.tsx` / `styles.css` 边界（在验收流程守护下）  
2. 确认并移除死 `PieChart` 副本（先写测试或对比 `LazyCharts`）  
3. 决定 `dist/`、编译出的 `vite.config.js`、空 `api/`、本地 `.next/` 去留  
4. 统一 `src` 顶层旅游/解析文件与 `lib`/`pages` 分层  

**原则重申：拿不准先保留。阶段3需用户确认后再开始。**
