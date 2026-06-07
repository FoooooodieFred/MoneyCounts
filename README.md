# MoneyCounts

月度智能记账本 — 支持人民币 / 港币双货币、LocalStorage 本地保存。

## 本地开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
npm run preview
```

## 部署到 Vercel

1. 打开 [vercel.com/new](https://vercel.com/new)，用 GitHub 登录
2. 选择仓库 `FoooooodieFred/MoneyCounts` → **Import**
3. 保持默认设置（Framework: Vite，Build: `npm run build`，Output: `dist`）
4. 点击 **Deploy**，约 1 分钟后获得 `*.vercel.app` 公共链接

之后每次 `git push` 到 `main` 分支，Vercel 会自动重新部署。
