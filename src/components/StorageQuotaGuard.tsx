import { formatStorageBytes } from "../lib/localStorageQuota";
import { isDesktopClientDownloadReady } from "../lib/desktopClient";

export type StorageQuotaGuardLevel = "warn" | "block";
export type StorageQuotaGuardSource =
  "persist" | "import-json" | "import-csv" | "import-spreadsheet" | "import-file";

export type StorageQuotaGuardModel = {
  level: StorageQuotaGuardLevel;
  source: StorageQuotaGuardSource;
  usedBytes: number;
  quotaBytes: number;
  projectedBytes: number;
};

type StorageQuotaGuardProps = {
  model: StorageQuotaGuardModel;
  onExportBackup: () => void;
  onDownloadClient: () => void;
  onDismiss: () => void;
};

const isImportSource = (source: StorageQuotaGuardSource) => source.startsWith("import");

const titleFor = (model: StorageQuotaGuardModel) =>
  model.level === "block" ? "浏览器存储已满" : "浏览器存储即将用尽";

const bodyFor = (model: StorageQuotaGuardModel) => {
  const used = formatStorageBytes(model.usedBytes);
  const quota = formatStorageBytes(model.quotaBytes);
  const projected = formatStorageBytes(model.projectedBytes);
  if (model.source === "import-file") {
    return `所选文件过大，无法在浏览器里安全解析或写入 LocalStorage（上限约 ${quota}）。请先导出当前 JSON 备份；更长年份的账本请改用桌面客户端，数据会存成本地文件。`;
  }
  if (model.level === "block" && isImportSource(model.source)) {
    return `这次导入约需 ${projected}，超过了当前浏览器约 ${quota} 的 LocalStorage 上限，没有写入账本。请先导出 JSON 备份。更长年份的旧账请改用桌面客户端，账本会存成本地文件，不再受此限制。`;
  }
  if (model.level === "block") {
    return `账本未能写入浏览器存储（当前约 ${used} / ${quota}）。刷新后未保存的改动可能丢失，请立即导出 JSON。桌面客户端会把账本存成本地文件，不再受此限制。`;
  }
  return `账本已占用约 ${used}，写入后约 ${projected}（上限约 ${quota}）。请先导出 JSON 备份。若还要导入更长年份的旧账，建议改用桌面客户端。`;
};

export function StorageQuotaGuard({
  model,
  onExportBackup,
  onDownloadClient,
  onDismiss,
}: StorageQuotaGuardProps) {
  const clientReady = isDesktopClientDownloadReady();

  return (
    <div
      className="modal-backdrop storage-quota-guard-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && model.level === "warn") onDismiss();
      }}
    >
      <section
        className={`modal-card storage-quota-guard ${model.level === "block" ? "storage-quota-guard--block" : ""}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="storage-quota-guard-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">Storage</p>
            <h2 id="storage-quota-guard-title">{titleFor(model)}</h2>
          </div>
        </div>
        <p className="storage-quota-guard__body">{bodyFor(model)}</p>
        <p className="muted storage-quota-guard__hint">
          网页版数据只存在这个浏览器里。导出备份后，换设备或改用客户端都能继续。
        </p>
        <div className="storage-quota-guard__actions">
          <button type="button" data-action="storage-quota-export-json" onClick={onExportBackup}>
            立即导出 JSON
          </button>
          <button
            type="button"
            className="secondary-button"
            data-action="download-desktop-client"
            disabled={!clientReady}
            title={clientReady ? "下载桌面客户端" : "桌面客户端即将推出"}
            onClick={onDownloadClient}
          >
            {clientReady ? "下载桌面客户端" : "下载桌面客户端（即将推出）"}
          </button>
          <button
            type="button"
            className="ghost-button"
            data-action="storage-quota-dismiss"
            onClick={onDismiss}
          >
            {model.level === "block" ? "我已了解" : "稍后再说"}
          </button>
        </div>
      </section>
    </div>
  );
}
