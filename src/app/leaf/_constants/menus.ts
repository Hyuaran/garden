export const LEAF_MENUS = [
  { slug: "kanden", title: "関電 案件一覧", icon: "document" },
  { slug: "kanden/entry", title: "関電 事務入力", icon: "document" },
] as const;

export function visibleLeafMenus(viewAccess: Record<string, boolean>) {
  return LEAF_MENUS.filter(menu => viewAccess[`leaf-${menu.slug.replaceAll("/", "-")}`]);
}
