# MoneyCounts 桌面客户端

Wails v2 壳。界面仍是仓库根目录的 `src/`，这里只放 Go 壳、打包模板和桌面构建产物。

网页继续在仓库根目录 `npm run dev` / Cloudflare。

Windows **免安装 exe** 可以在 macOS 上交叉编译（已实测）。带开始菜单 / 卸载的 NSIS 安装包请在 Windows 或 GitHub Actions 上打。

## 本机开发

仓库根目录：

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@v2.15.0
npm run desktop:dev      # 等价于在 desktop/ 里 wails dev
npm run desktop:build    # 当前系统：macOS 得到 desktop/build/bin/MoneyCounts.app
```

或：

```bash
cd desktop
wails doctor
wails dev
wails build -clean
```

桌面前端会写到 `desktop/dist/`（相对路径），**不会覆盖** 网页用的根目录 `dist/`。

数据文件：

| 系统    | 路径                                                   |
| ------- | ------------------------------------------------------ |
| macOS   | `~/Library/Application Support/MoneyCounts/store.json` |
| Windows | `%AppData%\MoneyCounts\store.json`                     |

## Windows 包

免安装 exe 可在 macOS 交叉编译（已实测）：

```bash
cd desktop
wails build -clean -platform windows/amd64 -webview2 download
```

产物：`desktop/build/bin/MoneyCounts.exe`，可单独发给 64 位 Windows。

带开始菜单的 NSIS 安装包需要 [NSIS](https://wails.io/docs/guides/windows-installer/)，在 Windows 上：

```bat
winget install NSIS.NSIS --silent
go install github.com/wailsapp/wails/v2/cmd/wails@v2.15.0
npm run desktop:build:windows
```

或跑 GitHub Actions 的 Desktop workflow（`v*` 标签或手动触发）。安装包：`MoneyCounts-amd64-installer.exe`（当前用户目录，一般不用管理员）。

未签名：SmartScreen 选「仍要运行」。没有 WebView2 时会按需下载。

## macOS 自签名

若 `resource fork / detritus not allowed`：

```bash
xattr -cr desktop
npm run desktop:build
```
