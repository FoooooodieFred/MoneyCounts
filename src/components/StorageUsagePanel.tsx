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
  locationMessage?: string;
  webFileName?: string | null;
  webFileSupported?: boolean;
  onChooseDesktopPath?: () => void;
  onResetDesktopPath?: () => void;
  onChooseWebFile?: () => void;
};

export function StorageUsagePanel({
  usage,
  locationMessage,
  webFileName,
  webFileSupported,
  onChooseDesktopPath,
  onResetDesktopPath,
  onChooseWebFile,
}: StorageUsagePanelProps) {
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
        {webFileSupported ? (
          <div className="action-row">
            <button
              type="button"
              className="secondary-button"
              data-action="bind-web-ledger-file"
              onClick={onChooseWebFile}
            >
              {webFileName ? `已绑定 ${webFileName}` : "选择本机 JSON 作为记账文件"}
            </button>
          </div>
        ) : (
          <p className="muted">当前浏览器不支持把账本绑到本机文件。可用桌面客户端自选存储位置。</p>
        )}
        {locationMessage ? <p className="status">{locationMessage}</p> : null}
      </section>
    );
  }

  return (
    <section className="settings-stack__section surface-secondary" data-section="storage-usage">
      <header className="settings-stack__heading">
        <h2>本地记账文件</h2>
        <p className="muted">
          客户端把全部键值存在本机 JSON 文件，不受浏览器 5 MB 限制。可改到任意目录。
        </p>
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
      <div className="action-row">
        <button type="button" data-action="choose-desktop-store-path" onClick={onChooseDesktopPath}>
          更改存储位置
        </button>
        <button
          type="button"
          className="secondary-button"
          data-action="reset-desktop-store-path"
          onClick={onResetDesktopPath}
        >
          恢复默认位置
        </button>
      </div>
      {locationMessage ? <p className="status">{locationMessage}</p> : null}
    </section>
  );
}
