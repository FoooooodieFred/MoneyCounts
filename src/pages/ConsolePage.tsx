import { type KeyboardEvent, lazy, Suspense, useState } from "react";
import { useSearchParams } from "react-router-dom";

const ApiSettings = lazy(() =>
  import("./ApiConsolePage").then((module) => ({ default: module.ApiConsolePage })),
);
const TokenUsage = lazy(() =>
  import("./TokenConsolePage").then((module) => ({ default: module.TokenConsolePage })),
);

export function ConsolePage() {
  const [params, setParams] = useSearchParams();
  const showUsage = params.get("tab") === "usage";
  const [visited, setVisited] = useState({ settings: !showUsage, usage: showUsage });

  const selectTab = (usage: boolean) => {
    setVisited((current) => ({
      settings: current.settings || !usage,
      usage: current.usage || usage,
    }));
    setParams(usage ? { tab: "usage" } : {});
  };

  const handleTabKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const usage = event.key === "End" || (event.key !== "Home" && !showUsage);
    selectTab(usage);
    document.getElementById(usage ? "console-usage-tab" : "console-settings-tab")?.focus();
  };

  return (
    <main className="app-shell app-shell--below-nav settings-page-shell" data-section="api-console">
      <div className="content-rail settings-stack">
        <header className="page-intro">
          <h1>API 看台</h1>
          <p className="muted">
            统一管理模型接口、连接档案与调用用量，查看输入输出量、耗时和估算费用。
          </p>
        </header>
        <div className="console-tabs" role="tablist" aria-label="看台功能" onKeyDown={handleTabKey}>
          <button
            type="button"
            id="console-settings-tab"
            role="tab"
            aria-selected={!showUsage}
            aria-controls="console-settings-panel"
            tabIndex={showUsage ? -1 : 0}
            onClick={() => selectTab(false)}
          >
            接口设置
          </button>
          <button
            type="button"
            id="console-usage-tab"
            role="tab"
            aria-selected={showUsage}
            aria-controls="console-usage-panel"
            tabIndex={showUsage ? 0 : -1}
            onClick={() => selectTab(true)}
          >
            用量统计
          </button>
        </div>
        <section
          id="console-settings-panel"
          className="console-panel settings-stack"
          role="tabpanel"
          aria-labelledby="console-settings-tab"
          hidden={showUsage}
        >
          <Suspense fallback={<p className="muted">正在加载接口设置…</p>}>
            {visited.settings || !showUsage ? <ApiSettings /> : null}
          </Suspense>
        </section>
        <section
          id="console-usage-panel"
          className="console-panel settings-stack"
          role="tabpanel"
          aria-labelledby="console-usage-tab"
          hidden={!showUsage}
        >
          <Suspense fallback={<p className="muted">正在加载用量统计…</p>}>
            {visited.usage || showUsage ? (
              <>
                <p className="muted">
                  用量仅保存在本机，不进入备份；上游未返回用量时按字数估算，并标注「估」。单价可在接口设置中填写。
                </p>
                <TokenUsage />
              </>
            ) : null}
          </Suspense>
        </section>
      </div>
    </main>
  );
}
