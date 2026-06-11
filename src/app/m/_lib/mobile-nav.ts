export type MobileNavItem = {
  href: string;
  label: string;
  icon: string;
  key: "home" | "search" | "todo" | "news" | "account";
};

export const MOBILE_NAV_ITEMS: MobileNavItem[] = [
  { href: "/m", label: "ホーム", icon: "🏠", key: "home" },
  { href: "/m/search", label: "検索", icon: "🔍", key: "search" },
  { href: "/m/todo", label: "やること", icon: "✅", key: "todo" },
  { href: "/m/news", label: "お知らせ", icon: "🔔", key: "news" },
  { href: "/m/account", label: "アカウント", icon: "👤", key: "account" },
];

export function isActiveMobileNav(pathname: string, href: string) {
  if (href === "/m") return pathname === "/m";
  return pathname === href || pathname.startsWith(`${href}/`);
}
