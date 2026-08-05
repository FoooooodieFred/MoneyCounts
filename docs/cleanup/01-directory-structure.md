# 目录结构全景（阶段2盘点）

> 盘点日期：2026-08-05 · 基线 tag：`baseline-pre-cleanup` @ `279ab60`  
> 范围：忽略 `node_modules/`、`.git/` 内部细节、`dist/` 哈希产物细节、`.next/` 历史残留细节。  
> **本文件仅为盘点，未做任何结构重整。**

## 树状总览

```
Accounting Book/
├── .cursor/                 # 空目录（Cursor 本地）；无规则/技能文件
├── .gitignore               # 忽略 node_modules、.next、*.tsbuildinfo 等；未忽略 dist/
├── README.md                # 中英双语产品说明与快速开始
├── index.html               # Vite 入口 HTML（PWA meta / manifest / Google Fonts）
├── package.json             # 脚本与依赖声明
├── package-lock.json        # npm lockfile v3（已锁定）
├── tsconfig.json            # 应用 TS 工程
├── tsconfig.node.json       # Node/Vite 配置 TS 工程
├── tsconfig*.tsbuildinfo    # tsc 增量缓存（gitignore，本地生成）
├── vite.config.ts           # Vite 源配置（React plugin + charts manualChunks）
├── vite.config.js           # 由 tsc 编译出的 JS 配置（与 .ts 内容等价）
├── vite.config.d.ts         # 编译声明文件
├── api/                     # 空目录；无后端实现
├── docs/
│   ├── refactor-preservation.md   # 既有「功能保全」笔记（交互契约/重构计划）
│   └── cleanup/             # 本轮阶段2盘点产物（本目录）
├── public/
│   ├── manifest.webmanifest # PWA manifest
│   ├── pwa-icon.svg         # 应用图标
│   └── sw.js                # Service Worker（缓存 shell / 同源 GET）
├── src/                     # 应用源码（核心）
│   ├── main.tsx             # React 挂载、Router、生产环境 SW 注册
│   ├── App.tsx              # ★ 主应用壳：状态/路由/账本/统计/模态（约 3770 行）
│   ├── styles.css           # ★ 全局样式（约 5990 行）
│   ├── localLedgerParser.ts # 自然语言账本解析入口
│   ├── travelMode.ts        # 旅游模式状态/历史/LocalStorage 归一化
│   ├── TravelHistoryUI.tsx  # 旅游历史抽屉 UI
│   ├── travelCharts.tsx     # 旅游图表（懒加载）
│   ├── vite-env.d.ts        # Vite 类型
│   ├── components/          # 首页与共享展示组件
│   ├── pages/               # 路由页：Search / Travel / Settings
│   ├── hooks/               # useGsapContext 等
│   └── lib/                 # 纯逻辑与测试
├── dist/                    # 构建产物（已被 git 跟踪；验证构建后已还原）
├── .next/                   # 历史 Next.js 构建残留（gitignore，约 245MB）
└── node_modules/            # 依赖安装目录（约 94MB）
```

## 核心路径用途

| 路径 | 用途 | 备注 |
| --- | --- | --- |
| `src/App.tsx` | 路由壳 + 账本 CRUD + LocalStorage + 汇率 + 统计 + 大量 JSX | 体量最大，后续整理重点嫌疑 |
| `src/styles.css` | 全站视觉与响应式 | 全局选择器多，改样式易连锁 |
| `src/lib/*` | 日期/统计/备份/设置/解析共享逻辑 + Vitest | 相对清晰的纯逻辑边界 |
| `src/pages/*` | `/search` `/travel` `/settings` | 页面级；旅游依赖 `TravelHistoryUI` |
| `src/components/*` | Hero、自然语言输入、手动表格弹窗、预算、图表等 | 由 App 或 Settings 组装 |
| `src/travelMode.ts` | 旅游状态与历史持久化契约 | LocalStorage keys 在此集中 |
| `public/sw.js` | 离线静态壳 | 生产由 `main.tsx` 注册 |
| `docs/refactor-preservation.md` | 上一轮功能保全与交互契约 | 盘点时重要参考，非业务代码 |
| `api/` | 无内容 | 无 Python/后端；纯前端 LocalStorage 应用 |
| `.next/` | 旧栈残留 | 可清理候选，**拿不准先保留**（未纳入本阶段删除） |
| `dist/` | Vite 构建输出 | 已被跟踪；是否应从版本库移除待阶段3确认 |

## 路由与入口

- 入口：`index.html` → `src/main.tsx` → `BrowserRouter` → `App`
- 路由（`App.tsx` 内 `Routes`）：
  - `/` 首页（Hero / 快速记账 / 今日明细 / 日周月统计 / 趋势 / 预算等）
  - `/search` 搜索筛选
  - `/travel` 旅游模式
  - `/settings` 设置与备份/汇率

## 技术栈落点（只读确认）

- Vite 8 + React 19 + TypeScript + GSAP + react-router-dom + Vitest + PWA
- **无** Python / 服务端 API / requirements.txt
- 外部运行时依赖：汇率 API `https://open.er-api.com/v6/latest/USD`（浏览器直连）
