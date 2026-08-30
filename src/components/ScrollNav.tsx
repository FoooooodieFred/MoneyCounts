import { Link, useLocation } from "react-router-dom";
import type { AppSettings } from "../lib/appSettings";
import type { ReactNode } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  group?: "primary" | "sections" | "tools";
};

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
  home: (
    <svg {...iconProps}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V21h13V9.5" />
    </svg>
  ),
  search: (
    <svg {...iconProps}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  ),
  pen: (
    <svg {...iconProps}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
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
  settings: (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2.2M12 19.8V22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2 12h2.2M19.8 12H22M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
    </svg>
  ),
};

const getLinks = (_settings: AppSettings): NavItem[] => {
  void _settings;
  return [
    { href: "/", label: "首页", icon: Icons.home, group: "primary" },
    { href: "/search", label: "搜索", icon: Icons.search, group: "primary" },
    { href: "/#entry", label: "记账", icon: Icons.pen, group: "primary" },
    { href: "/#today", label: "今日", icon: Icons.calendar, group: "primary" },
    { href: "/#totals", label: "当日", icon: Icons.day, group: "sections" },
    { href: "/#week", label: "本周", icon: Icons.week, group: "sections" },
    { href: "/#month", label: "本月", icon: Icons.month, group: "sections" },
    { href: "/#tools", label: "全年", icon: Icons.year, group: "sections" },
    { href: "/travel", label: "旅游模式", icon: Icons.travel, group: "tools" },
    { href: "/settings", label: "设置", icon: Icons.settings, group: "tools" },
  ];
};

const isRouteLink = (href: string) => href.startsWith("/") && !href.includes("#");

const toRouterTarget = (href: string) => {
  const hashIndex = href.indexOf("#");
  if (hashIndex === -1) {
    return href;
  }
  return {
    pathname: href.slice(0, hashIndex) || "/",
    hash: href.slice(hashIndex),
  };
};

function isActive(href: string, pathname: string, hash: string) {
  if (href === "/") {
    return pathname === "/" && (!hash || hash === "#");
  }
  if (isRouteLink(href)) {
    return pathname === href;
  }
  const target = toRouterTarget(href);
  if (typeof target === "string") return pathname === target;
  return pathname === target.pathname && hash === target.hash;
}

type ScrollNavProps = {
  settings: AppSettings;
  travelAccent?: boolean;
};

function NavLink({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  active: boolean;
}) {
  const className = `nav-item${active ? " nav-item--active" : ""}`;
  const content = (
    <>
      <span className="nav-item__icon">{icon}</span>
      <span className="nav-item__label">{label}</span>
    </>
  );
  if (isRouteLink(href)) {
    return (
      <Link className={className} to={href} aria-current={active ? "page" : undefined}>
        {content}
      </Link>
    );
  }
  return (
    <Link className={className} to={toRouterTarget(href)} aria-current={active ? "page" : undefined}>
      {content}
    </Link>
  );
}

function NavGroup({
  items,
  pathname,
  hash,
}: {
  items: NavItem[];
  pathname: string;
  hash: string;
}) {
  if (!items.length) return null;
  return (
    <div className="scroll-nav__group">
      {items.map((link) => (
        <NavLink
          key={link.href}
          href={link.href}
          label={link.label}
          icon={link.icon}
          active={isActive(link.href, pathname, hash)}
        />
      ))}
    </div>
  );
}

export function ScrollNav({ settings, travelAccent = false }: ScrollNavProps) {
  const location = useLocation();
  const links = getLinks(settings);
  const primary = links.filter((l) => l.group === "primary");
  const sections = links.filter((l) => l.group === "sections");
  const tools = links.filter((l) => l.group === "tools");

  return (
    <nav
      className={`scroll-nav journal-desktop-only${travelAccent ? " scroll-nav--travel" : ""}`}
      aria-label="页面章节"
    >
      <Link className="scroll-nav__brand" to="/">
        <span className="scroll-nav__brand-mark" aria-hidden="true">
          M
        </span>
        <span className="scroll-nav__brand-text">MoneyCounts</span>
      </Link>

      <div className="scroll-nav__links">
        <NavGroup items={primary} pathname={location.pathname} hash={location.hash} />
        <NavGroup items={sections} pathname={location.pathname} hash={location.hash} />
        <NavGroup items={tools} pathname={location.pathname} hash={location.hash} />
      </div>
    </nav>
  );
}

export function MobileScrollNav({ settings, travelAccent = false }: ScrollNavProps) {
  const location = useLocation();
  const links = getLinks(settings).filter((link) =>
    ["/", "/search", "/#entry", "/#today", "/travel", "/settings"].includes(link.href),
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
          active={isActive(link.href, location.pathname, location.hash)}
        />
      ))}
    </nav>
  );
}
