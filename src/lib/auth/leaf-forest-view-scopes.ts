import { GARDEN_ROLE_ORDER, isRoleAtLeast } from "@/app/root/_constants/types";
import { MODULE_MIN_ROLES } from "@/app/_constants/module-min-roles";
import type { SystemViewScope } from "./system-view-scopes";

export const LEAF_FOREST_PAGES = [
  ["leaf-overview", "/leaf", "Leaf"],
  ["leaf-kanden", "/leaf/kanden", "関電"],
  ["leaf-kanden-input", "/leaf/kanden/input", "関電・入力"],
  ["leaf-kanden-backoffice", "/leaf/kanden/backoffice", "関電・事務"],
  ["soil-overview", "/soil", "Soil"],
  ["seed-overview", "/seed", "Seed"],
  ["fruit-overview", "/fruit", "Fruit"],
  ["forest-dashboard", "/forest/dashboard", "ダッシュボード"],
  ["forest-company-overview", "/forest/company-overview", "会社概要"],
  ["forest-financial-statements", "/forest/financial-statements", "決算書"],
  ["forest-registration-change", "/forest/registration-change", "登記変更"],
  ["forest-reports", "/forest/reports", "レポート分析"],
  ["forest-shinkouki", "/forest/shinkouki", "進行期"],
  ["forest-shinkouki-company", "/forest/shinkouki/[companyId]", "法人の進行期"],
  ["forest-journal", "/forest/shiwakechou", "仕訳帳"],
  ["forest-balances", "/forest/shiwakechou/balance-overview", "残高一覧"],
  ["forest-journal-company", "/forest/shiwakechou/[corp_id]", "法人の仕訳帳"],
  ["forest-journal-review", "/forest/shiwakechou/[corp_id]/review", "仕訳の確認"],
] as const;
export const LEAF_FOREST_TABS: Record<string, readonly (readonly [string, string])[]> = {
  "leaf-kanden-input": [["myprofile", "マイページ"], ["input", "新規送信"], ["mypage", "案件一覧"]],
  "forest-dashboard": [["overview", "概要"], ["matrix", "6法人マトリクス"]],
  "forest-shinkouki": [["numbers", "数値更新"], ["rollover", "期の切り替え"]],
  "forest-shinkouki-company": [["numbers", "数値更新"], ["rollover", "期の切り替え"]],
};
export const LEAF_FOREST_VIEW_SCOPES: SystemViewScope[] = LEAF_FOREST_PAGES.flatMap(([pageKey, , label]) => {
  const module = pageKey.split("-")[0] as "leaf" | "soil" | "seed" | "fruit" | "forest";
  const defaultRoles = GARDEN_ROLE_ORDER.filter(role => isRoleAtLeast(role, MODULE_MIN_ROLES[module]));
  return [{ pageKey, tabKey: "", label, defaultRoles }, ...(LEAF_FOREST_TABS[pageKey] ?? []).map(([tabKey, label]) => ({ pageKey, tabKey, label, defaultRoles }))];
});
export function leafForestPageKey(path: string) {
  if (path === "/forest") return "forest-dashboard";
  return LEAF_FOREST_PAGES.find(([, href]) => new RegExp("^" + href.replace(/\[[^\]]+\]/g, "[^/]+") + "/?$").test(path))?.[0];
}
