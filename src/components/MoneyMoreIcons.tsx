const iconProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

export function IconSend() {
  return (
    <svg {...iconProps}>
      <path d="M3.4 11.2 21 3.4 13.4 21l-2.2-7.2L3.4 11.2Z" />
      <path d="m11.2 13.8 9.4-10" />
    </svg>
  );
}

export function IconStop() {
  return (
    <svg {...iconProps}>
      <rect x="7" y="7" width="10" height="10" rx="2.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconPen() {
  return (
    <svg {...iconProps}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function IconShrink() {
  return (
    <svg {...iconProps}>
      <path d="M8 16h8" />
      <path d="M15 4v5h5" />
      <path d="m21 3-7 7" />
    </svg>
  );
}

export function IconMaximize() {
  return (
    <svg {...iconProps}>
      <path d="M9 3H4v5" />
      <path d="M15 3h5v5" />
      <path d="M9 21H4v-5" />
      <path d="M15 21h5v-5" />
    </svg>
  );
}

export function IconRestore() {
  return (
    <svg {...iconProps}>
      <rect x="8" y="8" width="11" height="11" rx="1.5" />
      <path d="M6 16V6h10" />
    </svg>
  );
}

export function IconLedger() {
  return (
    <svg {...iconProps}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 9h8M8 12h8M8 15h5" />
    </svg>
  );
}
