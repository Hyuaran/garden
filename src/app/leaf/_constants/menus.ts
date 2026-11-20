export const LEAF_MENUS = [
  { slug: "kanden", title: "関電 案件一覧", icon: "document" },
] as const;

export function visibleLeafMenus(viewAccess: Record<string, boolean>) {
  return LEAF_MENUS.filter(menu => viewAccess[`leaf-${menu.slug}`]);
}
