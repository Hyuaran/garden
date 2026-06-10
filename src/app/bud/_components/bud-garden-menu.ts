import type { GardenShellPageMenuItem } from "@/app/_components/layout/GardenShell/garden-shell-config";

const T = "/themes/garden-shell";
const BUD_ICON = `${T}/images/icons_bloom/orb_bud.png`;

export const BUD_GARDEN_PAGE_MENU: GardenShellPageMenuItem[] = [
  {
    label: "ダッシュボード",
    href: "/bud/dashboard",
    icon: BUD_ICON,
    active: true,
  },
  {
    label: "仕訳帳 準備中",
    href: "/bud/dashboard#journal",
    icon: BUD_ICON,
  },
  {
    label: "振込管理 準備中",
    href: "/bud/dashboard#transfers",
    icon: BUD_ICON,
  },
  {
    label: "損益管理 準備中",
    href: "/bud/dashboard#profit",
    icon: BUD_ICON,
  },
  {
    label: "給与管理 準備中",
    href: "/bud/dashboard#payroll",
    icon: BUD_ICON,
  },
  {
    label: "請求書管理 準備中",
    href: "/bud/dashboard#invoices",
    icon: BUD_ICON,
  },
  {
    label: "経費精算 準備中",
    href: "/bud/dashboard#expenses",
    icon: BUD_ICON,
  },
  {
    label: "銀行口座管理 準備中",
    href: "/bud/dashboard#bank",
    icon: BUD_ICON,
  },
  {
    label: "マスタ管理 準備中",
    href: "/bud/dashboard#masters",
    icon: BUD_ICON,
  },
  {
    label: "監査ログ 準備中",
    href: "/bud/dashboard#audit-log",
    icon: BUD_ICON,
  },
  {
    label: "設定 準備中",
    href: "/bud/dashboard#settings",
    icon: BUD_ICON,
  },
];
