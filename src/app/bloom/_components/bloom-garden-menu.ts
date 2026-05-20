import type { GardenShellPageMenuItem } from "@/app/_components/layout/GardenShell/garden-shell-config";

import { BLOOM_PATHS } from "../_constants/routes";

const T = "/themes/garden-shell";

export const BLOOM_GARDEN_PAGE_MENU: GardenShellPageMenuItem[] = [
  {
    label: "Garden 設計図",
    href: BLOOM_PATHS.BLUEPRINT,
    icon: `${T}/images/icons_bloom/orb_bloom.png`,
  },
  {
    label: "ワークボード",
    href: BLOOM_PATHS.WORKBOARD,
    icon: `${T}/images/icons_bloom/bloom_workboard.png`,
  },
  {
    label: "日報",
    href: BLOOM_PATHS.DAILY_REPORTS,
    icon: `${T}/images/icons_bloom/bloom_dailyreport.png`,
  },
  {
    label: "月次まとめ",
    href: BLOOM_PATHS.MONTHLY_DIGEST,
    icon: `${T}/images/icons_bloom/bloom_monthlydigest.png`,
  },
  {
    label: "経営状況",
    href: BLOOM_PATHS.CEO_STATUS,
    icon: `${T}/images/icons_bloom/bloom_ceostatus.png`,
  },
  {
    label: "開発進捗",
    href: BLOOM_PATHS.PROGRESS,
    icon: `${T}/images/icons_bloom/orb_bloom.png`,
  },
];
