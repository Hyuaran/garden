import type { RootMenuIconName } from "@/app/root/_constants/types";

export const SOIL_MENUS: { slug: string; title: string; description: string; icon: RootMenuIconName }[] = [
  {
    slug: "product-points",
    title: "付与ポイント表",
    description: "商材・獲得方法ごとの合計・トス・クローザーの付与ポイント。",
    icon: "document",
  },
];

export function visibleSoilMenus(viewAccess: Record<string, boolean>) {
  return SOIL_MENUS.filter(menu => viewAccess[`soil-${menu.slug}`]);
}
