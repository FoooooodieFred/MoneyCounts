/**
 * 路由分块的预加载。
 *
 * 页面是 `React.lazy` 懒加载的，但点击导航时才开始下载分块，用户会先看到旧页面
 * 干等一个网络来回，然后新页面才带着入场动画出现——中间那一下就是「卡一下」。
 *
 * 这里用同一组 `import()` 提前把分块拉下来：浏览器按 URL 缓存模块，
 * 所以预加载和 `React.lazy` 命中的是同一个模块，不会重复下载。
 */

const routeLoaders: Record<string, () => Promise<unknown>> = {
  "/today": () => import("../pages/DaySummaryPage"),
  "/search": () => import("../pages/SearchPage"),
  "/day": () => import("../pages/DaySummaryPage"),
  "/stats": () => import("../pages/StatsDashboardPage"),
  "/travel": () => import("../pages/TravelPage"),
  "/data": () => import("../pages/DataManagementPage"),
  "/console": () => import("../pages/ConsolePage"),
  "/tokens": () => import("../pages/ConsolePage"),
  "/settings": () => import("../pages/SettingsPage"),
};

/** 鼠标悬停或键盘聚焦到某个入口时，先把它的分块拉下来。 */
export const preloadRoute = (href: string) => {
  const loader = routeLoaders[href];
  if (!loader) return;
  void loader().catch(() => undefined);
};

/** 空闲时只预取常用页面；搜索及看台等工具按访问意图加载。 */
export const preloadAllRoutes = () => {
  for (const href of ["/day", "/stats"]) {
    const loader = routeLoaders[href];
    void loader().catch(() => undefined);
  }
};
