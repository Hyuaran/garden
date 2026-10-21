import { BUD_GARDEN_PAGE_MENU } from "../bud-garden-menu";
import type { SystemIcon } from "@/app/system/_components/ShachoShell/shacho-shell-config";

export function resolveBudActivePath(pathname: string): string | null {
  if (pathname === "/bud") return "/bud/dashboard";
  if (pathname === "/bud/shiwakechou" || pathname.startsWith("/bud/shiwakechou/")) return "/bud/journal";
  if (pathname === "/bud/statements" || pathname.startsWith("/bud/statements/")) return "/bud/bank";
  return [...BUD_GARDEN_PAGE_MENU].sort((a,b) => b.href.length-a.href.length).find(item => !item.divider && (pathname === item.href || pathname.startsWith(`${item.href}/`)))?.href ?? null;
}

export function budMenuIcon(href: string): SystemIcon {
  const icons: Record<string, SystemIcon> = {
    dashboard: "home", receivables: "salary", invoices: "document", expenses: "report",
    payroll: "person", transfers: "shift", journal: "book", profit: "chart",
    bank: "portal", masters: "folder", audit: "clock", settings: "portal",
  };
  return icons[href.split("/").pop() ?? ""] ?? "document";
}
