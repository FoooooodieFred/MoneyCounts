# Refactor Preservation Notes

本轮目标是“功能保全”：记录现有功能、稳定交互契约、抽出可复用纯逻辑，为后续从零重做视觉/布局做准备。本轮没有重做页面视觉，也没有迁移 LocalStorage schema。

## Core Feature Inventory

- 表单提交：手动完整记账表格支持分类、金额、货币、备注、隐藏/恢复、删除/清空、按键导航和新增记录；首页今日明细支持快速编辑已有记录。
- 自然语言解析/预览/确认：`NaturalLanguageInput` 先做草稿识别，再生成可编辑预览；预览支持编辑日期、分类、金额、货币、备注，支持新增/删除预览记录，确认后写入账本。
- 多日期周期记账：`parseNaturalLedger` 支持大前天/前天/昨天/今天/明天/后天/大后天、星期几、整周每天、今天明天等多日期目标，周期记录会展开成多条预览。
- 手动记账明细弹窗：`SettingsModal` 承载完整表格，按 `data-date`/`data-index`/`data-field` 定位焦点，支持 Enter 新增、Tab 下一类目、方向键移动。
- 数据渲染：首页按语义区块渲染 Hero、快速输入、今日明细、当日汇总、本周统计、本月汇总、趋势、汇率、页脚；路由包含 `/`、`/search`、`/travel`、`/settings`。
- 统计计算：日/周/月金额合计、分类汇总、饼图、趋势图、月度原币种/合并口径、连续记账天数、近 30 天消费洞察、本周对比成就。
- 预算：设置页开启总预算和分类预算；首页展示本月已用、剩余/超出、日均可花、分类预算进度。
- 搜索：搜索页按关键词、分类、开始/结束日期、最小/最大金额筛选，支持定位到对应日期。
- 设置页显隐/排序：首页区块可显示/隐藏、按钮上移/下移、拖拽排序；核心区块锁定，快速输入固定第一位。
- JSON/CSV 导入导出：CSV 以 date/category/slot/amount/currency/note/hidden 覆盖对应格子；JSON 完整备份包含账本、汇率、货币、主题、提醒、设置、旅游状态和旅游历史，导入前显示预览并覆盖确认。
- 备份提醒：LocalStorage 数据风险提示支持立即导出、明天提醒、3 天内不提醒；设置页也可调整提醒状态。
- 本地存储：账本、汇率、最后货币、统计货币、自定义货币、主题、设置、备份提醒、旅游状态、旅游历史、待撤销删除均保存在 LocalStorage。
- 汇率请求/缓存：启动时和手动按钮请求 `https://open.er-api.com/v6/latest/USD`，缓存 USD 基准汇率；旧 HKD/CNY 缓存可迁移；NTD 映射为 TWD 请求。
- 旅游模式/AA 分账/历史/预算：旅游模式可设置名称、日期、目的地货币、目标货币、同行人、参与人均分、地点标签、旅游自然语言快速录入、预算、导出账单、结束后写入历史；历史支持详情、重命名、删除撤销、合并、本地同步标记。
- PWA：`index.html` 注册 manifest 和 SVG icon；生产环境 `src/main.tsx` 注册 service worker；`public/sw.js` 缓存 shell 与同源 GET 资源。
- GSAP 动画触发点：页面入场、自然语言对话框、预览行、统计展开面板、模态框打开/关闭、hover 提升、彩带庆祝、旅游页入场、旅游历史抽屉均有 GSAP 触发。

## Pure Logic Extracted

- `src/lib/dateRange.ts`：日期 key 格式化、日期合法性、相对日期位移、周范围、整周日期展开、月份天数、预算剩余天数、连续记账天数。
- `src/lib/ledgerStats.ts`：金额解析、记录内容判断、分类行索引、分类记录切片、默认可见行数、跨日期记录收集、账本日期/记录计数、可见统计记录计数、预算可用值、月记录进度。
- `src/localLedgerParser.ts` 已改为复用 `dateRange` 的日期/整周工具，周期记账解析仍保持原入口。
- `src/App.tsx` 保留原本局部函数名作为配置薄封装，内部委托 `ledgerStats`，避免一次性改动过多调用点。
- `src/components/BudgetOverview.tsx` 使用 `calculateBudgetAvailability` 计算剩余预算、日均可花和进度。
- `src/lib/backup.ts` 与 `src/lib/appSettings.ts` 已是独立边界，本轮未做 schema 迁移，只记录它们继续作为备份和设置归一化入口。

## Interaction Map

| 触发源 | 触发函数/状态变化 | 当前 DOM/props 依赖 | 后续契约 |
| --- | --- | --- | --- |
| 首页日期按钮/日期弹窗 | `moveSelectedDate`、`jumpToToday`、`commitDateChange` | `HeroSection` props、`.date-modal` | 新骨架需保留日期切换 props 和 `selectedDate` 单一来源。 |
| 快速输入 textarea/form | `handleQuickExpenses` -> `parseNaturalLedger` -> `naturalLedgerPreview` | `data-section="quick-entry"`、`data-action="quick-entry-submit"` | 新输入组件必须输出 `QuickExpenseResult[]` 和 raw input，进入同一预览流。 |
| 快速输入底部 compact form | 同上 | `data-action="compact-quick-entry-submit"`，滚动位置由组件内部监听 | 可更换视觉，但保留 compact 入口与同一 submit 契约。 |
| 预览编辑控件 | `updateNaturalLedgerPreviewRecord` | `NaturalLanguageInput` props | 日期/分类/金额/货币/备注五个字段必须逐条可编辑。 |
| 预览新增/删除/确认 | `addNaturalLedgerPreviewRecord`、`deleteNaturalLedgerPreviewRecord`、`confirmNaturalLedgerImport` | `data-action="preview-add-record"`、`preview-delete-record`、`preview-confirm-import"` | 新页面应保留可编辑确认层，不能直接写入而跳过校验。 |
| 手动完整表格打开 | `setSettingsModalOpen(true)` | `.today-open-manual`，建议新增 `data-action="open-manual-ledger"` | 后续应保留完整表格或等价高级编辑入口。 |
| 手动表格金额/备注键盘 | `handleInputKeyDown`、`focusCell` | `data-date`、`data-index`、`data-field` | 若重做表格，焦点定位契约需保留或替换为同等稳定 ref map。 |
| 手动表格新增/删除/隐藏 | `addCategoryRecord`、`deleteCategoryRecord`、`toggleEntryHidden` | `.add-record-button`、`.delete-record-button`、`.hide-record-button`，建议新增 data-action | 记录上限和空行填充逻辑要沿用。 |
| 统计货币按钮 | `setStatsCurrencyPopup`、`toggleStatsCurrency` | `StatsCurrencyPicker` props、`.stats-card__currency-btn` | 保留多统计货币数组和至少一个兜底货币。 |
| 预算设置 | `onSettingsChange` -> `appSettings.budget` | `SettingsPage` budget inputs | 新 UI 写回 `AppSettings["budget"]`，不要改 LocalStorage key。 |
| 设置区块显隐/排序 | `updateSection`、`moveSection`、`handleDrop` | `data-section="home-section-order"`、`data-action="home-section-move-up/down"` | 保留 locked/pinned 规则和 `normalizeHomeSectionOrder`。 |
| CSV 导出/导入 | `exportCsv`、`importCsv` | `data-action="csv-export"`、`data-action="csv-import-pick"` | CSV 表头和 slot 覆盖规则保持兼容。 |
| JSON 导出/导入 | `exportJson`、`importJson`、`confirmJsonImport` | `data-action="json-backup-export"`、`json-backup-pick-import`、`json-backup-confirm-import"` | 导入必须保留预览确认，不可静默覆盖。 |
| 备份提醒按钮 | `exportJson`、`dismissBackupReminder` | `data-action="backup-reminder-export-json"` | 提醒状态继续写 `monthly-smart-ledger:backup-reminder`。 |
| 搜索筛选 | `SearchPage` 本地 state + `onSelectDate` | `/search` 路由 props | 新页面继续使用 `SearchableLedgerRecord[]`，定位日期后回首页。 |
| 旅游开启/结束 | `enableTravelMode`、`setTravelExitModalOpen`、`endTravelMode` | `TravelPage` props、`.travel-exit-modal` | 结束旅游必须写历史，保留分账口径选择。 |
| 旅游自然语言输入 | `handleTravelNaturalSubmit` | `TravelPage` props | 使用同一 `parseNaturalLedger`，并写入 travel entry meta。 |
| 旅游历史抽屉/详情/合并 | `setTravelHistoryRailOpen`、`deleteTravelHistoryRecord`、`confirmTravelHistoryMerge` | `#travel-history-panel`、`TravelHistoryPanel` props | 历史记录 id、pending delete、merge defaults 需保持。 |
| Escape 键 | 关闭旅游历史、设置弹窗、日期/货币/历史/合并弹窗 | `window.addEventListener("keydown")` in `App.tsx` | 新弹窗栈需要明确优先级，避免 Escape 关闭错误层。 |
| 滚动/锚点 | `ScrollNav`、`MobileScrollNav` | `id="hero-screen"`、`screen-*`、`id="entry"`、`id="today/week/month/tools/rates"` | 新页面骨架需先定义稳定 `data-section`/id 后再接导航。 |
| GSAP 动画 | 多处 `gsap.context` 和选择器 | `.hero-date-chip strong`、`.modal-card`、`.rate-table > div`、`.confetti-piece` 等 | 后续样式重做时先把动画选择器替换为 data-motion/data-section，再改 class。 |

## Static Assets Inventory

- `public/manifest.webmanifest`：PWA manifest，定义应用名、scope、standalone display、主题色、SVG icon。
- `public/pwa-icon.svg`：PWA favicon/maskable icon；`index.html` 也直接作为 favicon 引用。
- `public/sw.js`：service worker，缓存 `/`、`/index.html`、manifest、icon，并缓存同源 GET 资源。
- `index.html`：PWA meta、manifest/icon link、Google Fonts 远程字体预连接和 stylesheet。
- `src/assets/`：当前不存在源图片/字体资产。
- `dist/`：当前有构建产物、manifest、service worker、PWA icon 和 hashed JS/CSS；这些是生成物，不应作为后续设计源资产。

## Why The Layout Keeps Getting Messier

- `src/App.tsx` 同时承担状态、LocalStorage、汇率请求、账本写入、统计、旅游历史、模态框、路由和大量 JSX，组件边界过宽，视觉改动很容易碰到业务逻辑。
- `src/styles.css` 是单个大型全局样式文件，基础选择器如 `button`、`input`、`textarea`、`select` 直接定义视觉，会影响所有页面和弹窗，局部修样式容易产生连锁副作用。
- class 命名混合了页面块、效果名和状态名，如 `.card`、`.card-soft`、`.stats-grid`、`.travel-*`、`.settings-*`、`.is-open`，缺少清晰命名层级，导致重构时很难判断样式所有权。
- 多处布局依赖全局 id/class 和屏幕区块，如 `#screen-week`、`.home-screen`、`.journal-scroll`，而设置页排序逻辑和实际首页分屏渲染并不完全同构，视觉布局一改就容易与导航/设置脱节。
- GSAP 直接绑定 CSS class 和 DOM 查询，包含 `.hero-date-chip strong`、`.modal-card`、`.rate-table > div`、`.travel-details > div` 等；class 既负责样式又负责动画定位，改名会同时影响动画。
- 手动表格焦点依赖 `data-date`/`data-index`/`data-field`，这是好的稳定契约；但其他关键交互此前主要依赖 class 或组件层闭包，缺少统一 `data-action` 标记。
- 响应式规则集中在全局 CSS，页面级组件没有独立样式边界；修一个 breakpoint 时会影响首页、设置页、旅游页和弹窗共享元素。
- 部分视觉态由 TSX 里的内联 style 或动态 class 拼接驱动，如饼图颜色、主题/variant、confetti、currency switch，这些与 design tokens 尚未分层。
- PWA、旅游模式、设置、备份、搜索等功能近期叠加到同一应用壳，尚未完成“业务逻辑库 -> 页面容器 -> 展示组件”的分层整理。

## Next Refactor Plan

1. 新建语义化页面骨架：先定义 Home/Search/Settings/Travel 的 section id、`data-section`、`data-action` 和路由壳，不写最终视觉。
2. 建立 CSS 变量/design tokens：颜色、间距、圆角、阴影、字体、动效时长先集中到 token 层，旧变量按兼容别名过渡。
3. 采用 BEM 或 CSS module 风格命名：页面块、组件元素、状态修饰分开；GSAP 绑定改用 `data-motion` 或 `data-section`。
4. 组件静态样式先行：先在无业务数据/假数据下完成布局、响应式和空态，避免边做视觉边改账本逻辑。
5. 逐功能回迁：按快速记账 -> 手动明细 -> 统计/预算 -> 搜索 -> 设置/备份 -> 旅游模式顺序接回真实 props。
6. 逐项测试：保留并扩展 `dateRange`、`ledgerStats`、自然语言解析、备份解析测试；每迁回一个功能跑 `npm test` 和 `npm run typecheck`。

本轮只完成保全、轻量抽离和文档化；不要基于本轮改动直接推倒重做视觉。

## Stage 2 Skeleton And Tokens

- 首页路由已固定为 7 屏语义骨架：`header` 承载 Hero/标语/三层趣味卡/记账入口，`main` 依次承载今日明细、当日汇总、本周统计、本月汇总、全年趋势，页脚仍由 `SiteFooter` 输出。设置页的排序/隐藏不再改变这 7 个核心屏顺序。
- 第六屏 `data-section="screen-year"` 保留全年/多月趋势、CSV 导入导出和清理入口，并把预算概览、成就洞察、汇率作为 `year-support-cards` 内的可选卡片，继续受设置显隐控制。
- `src/styles.css` 已建立 token 层：字体、字号、间距、圆角、阴影、容器宽度、z-index、动画时长、浅色/深色颜色和旅游模式橙色变量。旧的 `--ink`、`--paper`、`--blue` 等变量以别名方式保留，降低回归风险。
- 样式边界采用明确前缀/BEM 风格：`home-*`、`hero-*`、`nl-*`、`settings-*`、`search-*`、`travel-*`、`year-support-*`。本阶段未拆分 CSS 文件，先用后置覆盖收敛首页、卡片、弹窗、底部输入框、设置页、搜索页和旅游页的关键边界。
- 关键交互补充稳定标记：快速输入/compact 输入、预览新增删除确认、Hero 日期与入口、今日内联明细、手动明细表格、CSV/JSON 导入导出、搜索筛选、旅游开始结束/自然语言分账/预算/参与人、浮动主题和日期按钮。
- GSAP 继续使用 `useGsapContext` 或 `gsap.context().revert()`；Hero 入场动画改用 `data-motion` 选择器，运动属性保持 transform/opacity，并沿用 `prefers-reduced-motion` 降级。

## Stage 3 Functional Return And Polish

- 自然语言快速输入保留 Enter 提交、Shift+Enter 换行和 IME 合成保护；App 层解析现在使用异常收尾，避免本地规则异常导致解析中状态卡住，并在可用时保留草稿识别预览。
- 旅游模式同行人编辑新增 `reconcileTravelParticipants` 纯逻辑：重命名时保留既有 participant id，删减同行人时把失效分账元数据回落到当前全部同行人，避免历史选择变成空分摊。
- 页面宽度进一步收敛到 `--container-main`，设置/搜索/旅游与首页导航对齐；移动端 compact 快速输入上移，避免遮挡底部导航、日期 FAB 和主题 FAB。
- 暗色模式补齐今日内联表头、空图表、设置/搜索/旅游卡片和旅游预算超额态的深色底，减少 select/input/button/弹窗出现异常亮底的风险。
