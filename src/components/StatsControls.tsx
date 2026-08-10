import { useRef } from "react";
import { Button, Modal, ToggleButton, ToggleButtonGroup, useOverlayState } from "@heroui/react";
import { gsap } from "gsap";
import { prefersReducedMotion } from "../hooks/useGsapContext";

type StatsCurrencyPickerProps = {
  open: boolean;
  currencies: string[];
  selected: string[];
  onToggle: (currency: string) => void;
  onClose: () => void;
  getLabel: (currency: string) => string;
};

export function StatsCurrencyPicker({
  open,
  currencies,
  selected,
  onToggle,
  onClose,
  getLabel,
}: StatsCurrencyPickerProps) {
  const state = useOverlayState({
    isOpen: open,
    onOpenChange: (isOpen) => {
      if (!isOpen) onClose();
    },
  });

  return (
    <Modal state={state}>
      <Modal.Backdrop className="stats-currency-popup-backdrop">
        <Modal.Container className="stats-currency-popup" size="sm">
          <Modal.Dialog aria-label="选择统计货币">
            <Modal.CloseTrigger aria-label="关闭" />
            <Modal.Header>
              <Modal.Heading>统计货币</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div className="stats-currency-popup__chips">
                {currencies.map((currency) => (
                  <Button
                    key={currency}
                    className={
                      selected.includes(currency) ? "currency-chip active" : "currency-chip"
                    }
                    variant={selected.includes(currency) ? "secondary" : "tertiary"}
                    onPress={() => onToggle(currency)}
                    aria-pressed={selected.includes(currency)}
                  >
                    {currency} · {getLabel(currency)}
                  </Button>
                ))}
              </div>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

type SummaryModeToggleProps = {
  mode: "split" | "merged";
  onChange: (mode: "split" | "merged") => void;
};

export function SummaryModeToggle({ mode, onChange }: SummaryModeToggleProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);

  const animate = (next: "split" | "merged") => {
    if (prefersReducedMotion() || !trackRef.current) {
      onChange(next);
      return;
    }
    gsap.fromTo(
      trackRef.current,
      { scale: 0.96 },
      { scale: 1, duration: 0.35, ease: "back.out(2)" },
    );
    onChange(next);
  };

  return (
    <div ref={trackRef}>
      <ToggleButtonGroup
        className="summary-mode-toggle"
        aria-label="汇总显示模式"
        selectionMode="single"
        selectedKeys={new Set([mode])}
        disallowEmptySelection
        onSelectionChange={(keys) => {
          const next = [...keys][0];
          if (next === "split" || next === "merged") animate(next);
        }}
      >
        <ToggleButton id="split">分币种</ToggleButton>
        <ToggleButton id="merged">
          <ToggleButtonGroup.Separator />
          单币种
        </ToggleButton>
      </ToggleButtonGroup>
    </div>
  );
}
