export type MoneyMoreSize = "bubble" | "window" | "full";

export type MoneyMoreGutters = {
  right: number;
  bottom: number;
  full: number;
};

export type MoneyMoreFrame = {
  width: number;
  height: number;
  right: number;
  bottom: number;
  radius: number;
  background: string;
};

export const MONEY_MORE_BUBBLE = 58;
export const defaultMoneyMoreGutters: MoneyMoreGutters = {
  right: 18,
  bottom: 18,
  full: 12,
};

/** Content box for a size. Bubble keeps the window layout so the circle clips, never scales. */
export const moneyMoreContentBox = (
  size: MoneyMoreSize,
  viewport: { width: number; height: number },
  gutters: MoneyMoreGutters = defaultMoneyMoreGutters,
  surface = "#ffffff",
) => {
  const frame = moneyMoreFrame(size === "bubble" ? "window" : size, viewport, gutters, surface);
  return { width: frame.width, height: frame.height };
};

export const moneyMoreFrame = (
  size: MoneyMoreSize,
  viewport: { width: number; height: number },
  gutters: MoneyMoreGutters = defaultMoneyMoreGutters,
  surface = "#ffffff",
): MoneyMoreFrame => {
  if (size === "bubble") {
    return {
      width: MONEY_MORE_BUBBLE,
      height: MONEY_MORE_BUBBLE,
      right: gutters.right,
      bottom: gutters.bottom,
      radius: MONEY_MORE_BUBBLE / 2,
      background: "#3b93f0",
    };
  }
  if (size === "window") {
    const width = Math.min(420, Math.max(280, viewport.width - gutters.right * 2 - 16));
    const height = Math.min(620, Math.max(360, viewport.height - gutters.bottom - 72));
    return {
      width,
      height,
      right: gutters.right,
      bottom: gutters.bottom,
      radius: 28,
      background: surface,
    };
  }
  return {
    width: Math.max(280, viewport.width - gutters.full * 2),
    height: Math.max(320, viewport.height - gutters.full * 2),
    right: gutters.full,
    bottom: gutters.full,
    radius: 28,
    background: surface,
  };
};

export const measureHostGutters = (host: HTMLElement): MoneyMoreGutters => {
  const probe = document.createElement("span");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText =
    "position:absolute;width:var(--mm-gutter-right);height:var(--mm-gutter-bottom);pointer-events:none;visibility:hidden";
  host.appendChild(probe);
  const box = probe.getBoundingClientRect();
  probe.remove();
  const fullProbe = document.createElement("span");
  fullProbe.setAttribute("aria-hidden", "true");
  fullProbe.style.cssText =
    "position:absolute;width:var(--mm-gutter-full);height:var(--mm-gutter-full);pointer-events:none;visibility:hidden";
  host.appendChild(fullProbe);
  const fullBox = fullProbe.getBoundingClientRect();
  fullProbe.remove();
  return {
    right: box.width || defaultMoneyMoreGutters.right,
    bottom: box.height || defaultMoneyMoreGutters.bottom,
    full: fullBox.width || defaultMoneyMoreGutters.full,
  };
};

export const readSurfaceColor = () => {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue("--color-surface")
    .trim();
  return value || "#ffffff";
};
