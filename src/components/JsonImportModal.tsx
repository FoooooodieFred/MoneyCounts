import type { BackupImportPreview } from "../pages/SettingsPage";

type JsonImportModalProps = {
  preview: BackupImportPreview;
  onConfirm: () => void;
  onCancel: () => void;
};

export function JsonImportModal({ preview, onConfirm, onCancel }: JsonImportModalProps) {
  return (
    <div
      className="modal-backdrop is-open"
      role="presentation"
      data-section="json-import-modal"
      onMouseDown={onCancel}
    >
      <section
        className="modal-card json-import-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="json-import-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">JSON backup</p>
            <h2 id="json-import-title">确认导入备份？</h2>
          </div>
        </div>
        <p className="muted">
          文件：{preview.fileName} · 导出时间：
          {new Date(preview.exportedAt).toLocaleString("zh-CN")}
        </p>
        <div className="import-preview-grid">
          <div>
            <span>将导入账本</span>
            <strong>
              {preview.incomingLedger.dateCount} 天 / {preview.incomingLedger.recordCount} 条
            </strong>
          </div>
          <div>
            <span>当前账本</span>
            <strong>
              {preview.currentLedger.dateCount} 天 / {preview.currentLedger.recordCount} 条
            </strong>
          </div>
          <div>
            <span>设置覆盖</span>
            <strong>{preview.settingsWillOverwrite ? "会覆盖" : "无设置项"}</strong>
          </div>
          <div>
            <span>旅游历史</span>
            <strong>
              {preview.travelHistoryCount} 条（当前 {preview.currentTravelHistoryCount} 条）
            </strong>
          </div>
          <div>
            <span>API 接口</span>
            <strong>{preview.llmApiWillOverwrite ? "会覆盖密钥与接口" : "不改动"}</strong>
          </div>
        </div>
        <p className="warning-text">
          确认后会用备份文件替换当前账本、设置、旅游状态与相关本地缓存
          {preview.llmApiWillOverwrite ? "，并覆盖本机 API 接口与密钥" : ""}。
        </p>
        <div className="action-row">
          <button
            type="button"
            className="danger-button"
            data-action="json-backup-confirm-import"
            onClick={onConfirm}
          >
            确认覆盖导入
          </button>
          <button type="button" className="secondary-button" onClick={onCancel}>
            取消
          </button>
        </div>
      </section>
    </div>
  );
}
