import type { GardenShellPageMenuItem } from "@/app/_components/layout/GardenShell/garden-shell-config";

const T = "/themes/garden-shell";
const BUD_ICON = `${T}/images/icons_bloom/orb_bud.png`;

const BUD_GARDEN_PAGE_MENU_BASE: GardenShellPageMenuItem[] = [
  { label: "ダッシュボード", href: "/bud/dashboard", icon: BUD_ICON },
  { label: "仕訳帳", href: "/bud/journal", icon: BUD_ICON },
  { label: "振込管理", href: "/bud/transfers", icon: BUD_ICON },
  { label: "損益管理", href: "/bud/profit", icon: BUD_ICON },
  { label: "給与管理", href: "/bud/payroll", icon: BUD_ICON },
  { label: "請求書管理", href: "/bud/invoices", icon: BUD_ICON },
  { label: "経費精算", href: "/bud/expenses", icon: BUD_ICON },
  { label: "銀行口座管理", href: "/bud/bank", icon: BUD_ICON },
  { label: "マスタ管理", href: "/bud/masters", icon: BUD_ICON },
  { label: "監査ログ", href: "/bud/audit", icon: BUD_ICON },
  { label: "設定", href: "/bud/settings", icon: BUD_ICON },
];

export function getBudGardenPageMenu(activeHref: string): GardenShellPageMenuItem[] {
  return BUD_GARDEN_PAGE_MENU_BASE.map((item) => ({
    ...item,
    active: item.href === activeHref,
  }));
}

export const BUD_GARDEN_PAGE_MENU: GardenShellPageMenuItem[] = getBudGardenPageMenu("/bud/dashboard");
