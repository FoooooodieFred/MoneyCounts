import { Link } from "react-router-dom";
import type { AppSettings } from "../lib/appSettings";

const getLinks = (settings: AppSettings) => {
  void settings;

  return [
    { href: "/", label: "首页" },
    { href: "/search", label: "搜索" },
    { href: "/#entry", label: "记账" },
    { href: "/#today", label: "今日" },
    { href: "/#totals", label: "当日" },
    { href: "/#week", label: "本周" },
    { href: "/#month", label: "本月" },
    { href: "/#tools", label: "全年" },
    { href: "/#footer", label: "页脚" },
    { href: "/travel", label: "🏖️ 旅游模式" },
    { href: "/settings", label: "设置" },
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

type ScrollNavProps = {
  settings: AppSettings;
  travelAccent?: boolean;
};

function NavLink({ href, label }: { href: string; label: string }) {
  if (isRouteLink(href)) {
    return <Link to={href}>{label}</Link>;
  }
  return <Link to={toRouterTarget(href)}>{label}</Link>;
}

export function ScrollNav({ settings, travelAccent = false }: ScrollNavProps) {
  const links = getLinks(settings);
  return (
    <nav
      className={`scroll-nav journal-desktop-only${travelAccent ? " scroll-nav--travel" : ""}`}
      aria-label="页面章节"
    >
      <Link className="scroll-nav__brand" to="/">
        MoneyCounts
      </Link>
      <div className="scroll-nav__links">
        {links.map((link) => (
          <NavLink key={link.href} href={link.href} label={link.label} />
        ))}
      </div>
    </nav>
  );
}

export function MobileScrollNav({ settings, travelAccent = false }: ScrollNavProps) {
  const links = getLinks(settings).filter((link) => link.href !== "/").slice(0, 6);
  return (
    <nav
      className={`mobile-scroll-nav journal-mobile-only${travelAccent ? " mobile-scroll-nav--travel" : ""}`}
      aria-label="快捷跳转"
    >
      {links.map((link) => (
        <NavLink key={link.href} href={link.href} label={link.label} />
      ))}
    </nav>
  );
}
