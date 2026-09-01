import type { DesktopUpdateOffer } from "../lib/desktopUpdate";
import { APP_VERSION } from "../lib/appVersion";

type DesktopUpdatePromptProps = {
  offer: DesktopUpdateOffer;
  onDownload: () => void;
  onOpenRelease: () => void;
  onDismiss: () => void;
};

export function DesktopUpdatePrompt({
  offer,
  onDownload,
  onOpenRelease,
  onDismiss,
}: DesktopUpdatePromptProps) {
  return (
    <div className="modal-backdrop storage-quota-guard-backdrop" role="presentation">
      <section
        className="modal-card storage-quota-guard"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="desktop-update-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">Update</p>
            <h2 id="desktop-update-title">发现新版本 {offer.version}</h2>
          </div>
        </div>
        <p className="storage-quota-guard__body">
          当前客户端是 {APP_VERSION}，GitHub 上已发布 {offer.tagName}
          。可以下载最新安装包，然后手动替换本机应用。
        </p>
        <div className="storage-quota-guard__actions">
          <button
            type="button"
            data-action="desktop-update-download"
            disabled={!offer.downloadUrl}
            onClick={onDownload}
          >
            {offer.assetName ? `下载 ${offer.assetName}` : "下载安装包"}
          </button>
          <button
            type="button"
            className="secondary-button"
            data-action="desktop-update-open-release"
            onClick={onOpenRelease}
          >
            打开 Release 页
          </button>
          <button
            type="button"
            className="ghost-button"
            data-action="desktop-update-dismiss"
            onClick={onDismiss}
          >
            稍后再说
          </button>
        </div>
      </section>
    </div>
  );
}
