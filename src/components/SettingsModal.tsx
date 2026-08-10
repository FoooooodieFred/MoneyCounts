import { ReactNode } from "react";
import { Modal, useOverlayState } from "@heroui/react";

type SettingsModalProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
};

export function SettingsModal({ open, title, subtitle, onClose, children }: SettingsModalProps) {
  const state = useOverlayState({
    isOpen: open,
    onOpenChange: (isOpen) => {
      if (!isOpen) onClose();
    },
  });

  return (
    <Modal state={state}>
      <Modal.Backdrop className="settings-modal-backdrop">
        <Modal.Container className="settings-modal" size="lg" scroll="inside">
          <Modal.Dialog aria-label={title}>
            <Modal.CloseTrigger aria-label="关闭" className="settings-modal__close" />
            <Modal.Header className="settings-modal__header">
              <Modal.Heading>{title}</Modal.Heading>
              {subtitle ? <p className="muted">{subtitle}</p> : null}
            </Modal.Header>
            <Modal.Body className="settings-modal__body">{children}</Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
