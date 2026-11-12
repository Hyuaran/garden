import { GARDEN_ROLE_ORDER, isRoleAtLeast } from "@/app/root/_constants/types";
import { LEAF_FOREST_VIEW_SCOPES } from "./leaf-forest-view-scopes";
import type { SystemViewScope } from "./system-view-scopes";

// ホームの既存キーと既定を共有し、保存済み設定を保つ。
export const SOIL_VIEW_SCOPES: SystemViewScope[] = [
  ...LEAF_FOREST_VIEW_SCOPES.filter(scope => scope.pageKey === "soil-overview"),
  {
    pageKey: "soil-product-points",
    tabKey: "",
    label: "付与ポイント表",
    defaultRoles: GARDEN_ROLE_ORDER.filter(role => isRoleAtLeast(role, "manager")),
  },
];

export function soilPageKey(pathname: string) {
  const path = pathname.split("?")[0].replace(/\/$/, "");
  if (path === "/soil") return "soil-overview";
  const key = `soil-${path.split("/")[2]}`;
  return SOIL_VIEW_SCOPES.some(scope => scope.pageKey === key) ? key : undefined;
}
