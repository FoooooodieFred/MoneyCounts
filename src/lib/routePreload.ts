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
  "/today": () => import("../pages/SectionPage"),
  "/search": () => import("../pages/SearchPage"),
  "/day": () => import("../pages/DaySummaryPage"),
  "/stats": () => import("../pages/StatsDashboardPage"),
  "/travel": () => import("../pages/TravelPage"),
  "/data": () => import("../pages/DataManagementPage"),
  "/console": () => import("../pages/ApiConsolePage"),
  "/tokens": () => import("../pages/TokenConsolePage"),
  "/settings": () => import("../pages/SettingsPage"),
};

/** 鼠标悬停或键盘聚焦到某个入口时，先把它的分块拉下来。 */
export const preloadRoute = (href: string) => {
  const loader = routeLoaders[href];
  if (!loader) return;
  void loader().catch(() => undefined);
};

/** 空闲时把所有页面分块预取回来（加起来只有几十 KB）。 */
export const preloadAllRoutes = () => {
  for (const loader of Object.values(routeLoaders)) {
    void loader().catch(() => undefined);
  }
};
