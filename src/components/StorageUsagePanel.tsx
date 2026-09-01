import { formatStorageBytes } from "../lib/localStorageQuota";

export type StorageUsageModel =
  | {
      mode: "web";
      usedBytes: number;
      quotaBytes: number;
      remainingBytes: number;
      ledgerBytes: number;
    }
  | {
      mode: "desktop";
      usedBytes: number;
      fileBytes: number | null;
      filePath: string | null;
    };

type StorageUsagePanelProps = {
  usage: StorageUsageModel;
};

export function StorageUsagePanel({ usage }: StorageUsagePanelProps) {
  if (usage.mode === "web") {
    const ratio = usage.quotaBytes > 0 ? Math.min(1, usage.usedBytes / usage.quotaBytes) : 0;
    return (
      <section className="settings-stack__section surface-secondary" data-section="storage-usage">
        <header className="settings-stack__heading">
          <h2>浏览器存储</h2>
          <p className="muted">网页版账本写在这个浏览器的 LocalStorage 里，整站合计大约 5 MB。</p>
        </header>
        <div className="storage-meter" data-section="storage-meter-web">
          <div className="storage-meter__bar" aria-hidden="true">
            <span style={{ width: `${Math.max(2, ratio * 100)}%` }} />
          </div>
          <dl className="storage-meter__stats">
            <div>
              <dt>LocalStorage 已用</dt>
              <dd>{formatStorageBytes(usage.usedBytes)}</dd>
            </div>
            <div>
              <dt>剩余额度</dt>
              <dd>{formatStorageBytes(usage.remainingBytes)}</dd>
            </div>
            <div>
              <dt>账本 JSON</dt>
              <dd>{formatStorageBytes(usage.ledgerBytes)}</dd>
            </div>
            <div>
              <dt>浏览器上限</dt>
              <dd>{formatStorageBytes(usage.quotaBytes)}</dd>
            </div>
          </dl>
        </div>
      </section>
    );
  }

  return (
    <section className="settings-stack__section surface-secondary" data-section="storage-usage">
      <header className="settings-stack__heading">
        <h2>本地记账文件</h2>
        <p className="muted">客户端把全部键值存在本机 store.json，不受浏览器 5 MB 限制。</p>
      </header>
      <dl
        className="storage-meter__stats storage-meter__stats--desktop"
        data-section="storage-meter-desktop"
      >
        <div>
          <dt>内存中的 JSON</dt>
          <dd>{formatStorageBytes(usage.usedBytes)}</dd>
        </div>
        <div>
          <dt>磁盘文件大小</dt>
          <dd>{usage.fileBytes == null ? "读取中…" : formatStorageBytes(usage.fileBytes)}</dd>
        </div>
      </dl>
      {usage.filePath ? <p className="storage-meter__path">{usage.filePath}</p> : null}
    </section>
  );
}
