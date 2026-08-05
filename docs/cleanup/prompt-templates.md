# AI 指令模板（MoneyCounts）

复制下方对应模板，按需填空后发给 AI。每条均带边界，避免顺手改行为或扩 scope。

---

## 1. 新增页面

```
在 MoneyCounts 项目中新增一个路由页面。

目标：
- 路由路径：/______
- 页面职责（一句话）：______
- 需要的 props / 数据来源：______（从 App 传入 / 本地 state / LocalStorage 读）

约束：
- 页面文件放在 src/pages/；可复用 UI 放 src/components/；纯逻辑放 src/lib/
- 只做本页面与必要的路由接线；不要改其他页面的业务逻辑
- 不要新增依赖；不要改 LocalStorage key / 备份 schema
- 不要大拆 App.tsx 或 styles.css；样式尽量复用现有 class / token
- 遵循 Prettier（2 空格、双引号、分号、printWidth 100）
- 完成后跑 npm run typecheck；若动到 lib 纯函数再跑 npm test

参考：.cursor/rules/project.mdc、docs/refactor-preservation.md
```

---

## 2. 修改组件

```
修改 MoneyCounts 中的现有组件（非重构、非新功能大包）。

目标组件：src/______ 
改动内容：______
期望交互/视觉结果：______

约束：
- 只改该组件及其直接必要调用点；不要顺手整理无关文件
- 保持现有 props 契约与 data-action / data-section 标记（除非本次明确要改）
- 不要改 LocalStorage schema、账本写入口径、解析/统计公式
- 不要新增依赖；不要大拆 App.tsx / styles.css
- GSAP 选择器若依赖 class/data-motion，改名需同步动画绑定
- 完成后：npm run typecheck；涉及纯逻辑则 npm test

参考：docs/refactor-preservation.md 中的 Interaction Map
```

---

## 3. 排查 bug

```
排查并修复 MoneyCounts 的 bug（最小改动）。

现象：______
复现步骤：______
预期：______
实际：______
可疑范围（可选）：______

约束：
- 先定位根因，再做最小修复；不要借机重构或加功能
- 优先查 src/lib 纯逻辑与 LocalStorage 读写，再查 UI
- 不要改无关模块；不要新增依赖
- 若触及 localLedgerParser / ledgerStats / travelMode / appSettings / backup，改后必须 npm test
- 始终 npm run typecheck
- 修好后用一两句话说明根因与改动点
```

---

## 4. 清理 / 重构（只整理，不加功能）

```
对 MoneyCounts 做代码整理（清理或轻量重构）。

范围：______（例如：删除死代码 / 移动文件 / 注释 / 格式化）
不做：任何产品功能、交互变更、视觉重做、schema 迁移

硬性边界：
- 只整理，不加功能、不改业务行为
- 禁止无确认大拆 App.tsx / styles.css
- 禁止随意新增依赖
- 公共纯函数（src/lib）若必须动，保持行为等价并跑 npm test
- 不要改 LocalStorage key；不要 silent 改备份格式
- 可参考 docs/cleanup/ 盘点与延期清单；已延期项不要擅自处理
- 验证：npm run typecheck；涉及逻辑则 npm test；需要时再 build
- 不要 push、不要打 tag

完成后列出：改动文件、刻意未动项、验证结果。
```
