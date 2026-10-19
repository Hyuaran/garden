export type MobileNavItem = {
  href: string;
  label: string;
  key: "home" | "search" | "todo" | "news" | "account";
};

export const MOBILE_NAV_ITEMS: MobileNavItem[] = [
  { href: "/m", label: "ホーム", key: "home" },
  { href: "/m/search", label: "検索", key: "search" },
  { href: "/m/todo", label: "やること", key: "todo" },
  { href: "/m/news", label: "お知らせ", key: "news" },
  { href: "/m/account", label: "アカウント", key: "account" },
];

export function isActiveMobileNav(pathname: string, href: string) {
  if (href === "/m") return pathname === "/m";
  return pathname === href || pathname.startsWith(`${href}/`);
}
