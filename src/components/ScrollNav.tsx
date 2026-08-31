import { Link, useLocation } from "react-router-dom";
import type { AppSettings } from "../lib/appSettings";
import { type ReactNode, useEffect, useState } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  group?: "entry" | "primary" | "sections" | "tools";
};

const SIDEBAR_COLLAPSED_KEY = "moneycounts:sidebar-collapsed";

const iconProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

const Icons = {
  pen: (
    <svg {...iconProps}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  ),
  search: (
    <svg {...iconProps}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  ),
  calendar: (
    <svg {...iconProps}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  ),
  day: (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  ),
  week: (
    <svg {...iconProps}>
      <path d="M4 19V5M10 19V9M16 19V7M22 19V11" />
    </svg>
  ),
  month: (
    <svg {...iconProps}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M8 2v4M16 2v4M3 10h18" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
    </svg>
  ),
  year: (
    <svg {...iconProps}>
      <path d="M3 17 9 11l4 4 8-8" />
      <path d="M14 7h7v7" />
    </svg>
  ),
  travel: (
    <svg {...iconProps}>
      <path d="M10 21v-6.5L3.5 12 10 9.5V3l11 9-11 9Z" />
    </svg>
  ),
  data: (
    <svg {...iconProps}>
      <path d="M12 3v12" />
      <path d="m8 11 4 4 4-4" />
      <path d="M4 19h16" />
    </svg>
  ),
  console: (
    <svg {...iconProps}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 9h.01M10 9h7M7 13h.01M10 13h5" />
    </svg>
  ),
  settings: (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2.2M12 19.8V22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2 12h2.2M19.8 12H22M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
    </svg>
  ),
  collapse: (
    <svg {...iconProps}>
      <path d="M15 6 9 12l6 6" />
    </svg>
  ),
  expand: (
    <svg {...iconProps}>
      <path d="M9 6h11M9 12h11M9 18h11M4 6v12" />
    </svg>
  ),
  sun: (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  ),
  moon: (
    <svg {...iconProps}>
      <path d="M21 14.3A8.4 8.4 0 1 1 9.7 3 7 7 0 0 0 21 14.3Z" />
    </svg>
  ),
};

const getLinks = (_settings: AppSettings): NavItem[] => {
  void _settings;
  return [
    { href: "/", label: "记账", icon: Icons.pen, group: "entry" },
    { href: "/today", label: "今日", icon: Icons.calendar, group: "primary" },
    { href: "/search", label: "搜索", icon: Icons.search, group: "primary" },
    { href: "/day", label: "当日", icon: Icons.day, group: "sections" },
    { href: "/week", label: "本周", icon: Icons.week, group: "sections" },
    { href: "/month", label: "本月", icon: Icons.month, group: "sections" },
    { href: "/year", label: "全年", icon: Icons.year, group: "sections" },
    { href: "/travel", label: "旅游模式", icon: Icons.travel, group: "tools" },
    { href: "/data", label: "数据管理", icon: Icons.data, group: "tools" },
    { href: "/console", label: "API 看台", icon: Icons.console, group: "tools" },
    { href: "/settings", label: "设置", icon: Icons.settings, group: "tools" },
  ];
};

function isActive(href: string, pathname: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

type ScrollNavProps = {
  settings: AppSettings;
  travelAccent?: boolean;
  themeMode: "light" | "dark";
  onToggleTheme: () => void;
};

function ThemeToggle({
  themeMode,
  onToggleTheme,
}: {
  themeMode: "light" | "dark";
  onToggleTheme: () => void;
}) {
  const goingLight = themeMode === "dark";
  return (
    <button
      type="button"
      className="scroll-nav__theme"
      data-action="toggle-theme"
      aria-label={goingLight ? "切换浅色模式" : "切换深色模式"}
      title={goingLight ? "浅色模式" : "深色模式"}
      onClick={onToggleTheme}
    >
      {goingLight ? Icons.sun : Icons.moon}
    </button>
  );
}

function NavLink({
  href,
  label,
  icon,
  active,
  collapsed,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  active: boolean;
  collapsed?: boolean;
}) {
  const className = `nav-item${active ? " nav-item--active" : ""}`;
  return (
    <Link
      className={className}
      to={href}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
    >
      <span className="nav-item__icon">{icon}</span>
      <span className="nav-item__label">{label}</span>
    </Link>
  );
}

function NavGroup({
  items,
  pathname,
  collapsed,
  className,
}: {
  items: NavItem[];
  pathname: string;
  collapsed?: boolean;
  className?: string;
}) {
  if (!items.length) return null;
  return (
    <div className={`scroll-nav__group${className ? ` ${className}` : ""}`}>
      {items.map((link) => (
        <NavLink
          key={link.href}
          href={link.href}
          label={link.label}
          icon={link.icon}
          active={isActive(link.href, pathname)}
          collapsed={collapsed}
        />
      ))}
    </div>
  );
}

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function applyCollapsedDataset(collapsed: boolean) {
  document.documentElement.dataset.sidebar = collapsed ? "collapsed" : "expanded";
}

export function ScrollNav({
  settings,
  travelAccent = false,
  themeMode,
  onToggleTheme,
}: ScrollNavProps) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const links = getLinks(settings);
  const entry = links.filter((l) => l.group === "entry");
  const primary = links.filter((l) => l.group === "primary");
  const sections = links.filter((l) => l.group === "sections");
  const tools = links.filter((l) => l.group === "tools");

  useEffect(() => {
    const initial = readCollapsed();
    setCollapsed(initial);
    applyCollapsedDataset(initial);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      applyCollapsedDataset(next);
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <nav
      className={`scroll-nav journal-desktop-only${travelAccent ? " scroll-nav--travel" : ""}${collapsed ? " scroll-nav--collapsed" : ""}`}
      aria-label="页面章节"
      data-collapsed={collapsed ? "true" : "false"}
    >
      <div className="scroll-nav__top">
        <Link className="scroll-nav__brand" to="/" title="MoneyCounts">
          <span className="scroll-nav__brand-mark" aria-hidden="true">
            M
          </span>
          <span className="scroll-nav__brand-text">MoneyCounts</span>
        </Link>
        <button
          type="button"
          className="scroll-nav__collapse"
          aria-label={collapsed ? "展开侧边栏" : "收缩侧边栏"}
          aria-expanded={!collapsed}
          title={collapsed ? "展开" : "收缩"}
          onClick={toggleCollapsed}
        >
          {collapsed ? Icons.expand : Icons.collapse}
        </button>
      </div>

      <div className="scroll-nav__links">
        <NavGroup
          items={entry}
          pathname={location.pathname}
          collapsed={collapsed}
          className="scroll-nav__group--entry"
        />
        <NavGroup items={primary} pathname={location.pathname} collapsed={collapsed} />
        <NavGroup items={sections} pathname={location.pathname} collapsed={collapsed} />
        <NavGroup items={tools} pathname={location.pathname} collapsed={collapsed} />
      </div>
      <ThemeToggle themeMode={themeMode} onToggleTheme={onToggleTheme} />
    </nav>
  );
}

export function MobileScrollNav({
  settings,
  travelAccent = false,
  themeMode,
  onToggleTheme,
}: ScrollNavProps) {
  const location = useLocation();
  const links = getLinks(settings).filter((link) =>
    ["/", "/today", "/search", "/travel", "/data", "/settings"].includes(link.href),
  );

  return (
    <nav
      className={`mobile-scroll-nav journal-mobile-only${travelAccent ? " mobile-scroll-nav--travel" : ""}`}
      aria-label="快捷跳转"
    >
      {links.map((link) => (
        <NavLink
          key={link.href}
          href={link.href}
          label={link.label}
          icon={link.icon}
          active={isActive(link.href, location.pathname)}
        />
      ))}
      <ThemeToggle themeMode={themeMode} onToggleTheme={onToggleTheme} />
    </nav>
  );
}
