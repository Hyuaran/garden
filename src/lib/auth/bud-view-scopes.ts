import { GARDEN_ROLE_ORDER, isRoleAtLeast } from "@/app/root/_constants/types";
import type { SystemViewScope } from "./system-view-scopes";

// Bud は役職の最低条件に加えて bud_has_access が必要。実際の既定はサーバーで渡す。
export const BUD_DEFAULT_ROLES = GARDEN_ROLE_ORDER.filter(role => isRoleAtLeast(role, "staff"));
export const BUD_PAGES = [
  ["dashboard", "ダッシュボード"], ["receivables", "入金管理"], ["invoices", "請求書管理"],
  ["expenses", "経費精算"], ["payroll", "給与管理"], ["transfers", "振込管理"],
  ["journal", "仕訳帳"], ["statements", "明細"], ["profit", "損益管理"],
  ["masters", "マスタ管理"], ["audit", "監査ログ"], ["settings", "設定"],
] as const;
export const BUD_TABS: Record<string, readonly (readonly [string, string])[]> = {
  dashboard: [["overview", "全体"]],
  invoices: [["issued", "発行"], ["received", "受領"], ["templates", "テンプレ"], ["partners", "取引先"]],
  expenses: [["submit", "承認待ち"], ["approve", "完了待ち"], ["booking", "仕訳待ち"], ["done", "完了"], ["list", "一覧"], ["deleted", "削除済み"], ["categories", "区分マスタ"]],
  payroll: [["monthly", "月次給与"], ["history", "給与履歴"], ["bonus", "賞与"], ["yearend", "年末調整"], ["master", "マスタ"]],
  transfers: [["overview", "全体"], ["approval", "承認待ち"], ["schedule", "振込予定"], ["history", "実行履歴"], ["list", "一覧"], ["master", "振込先マスタ"]],
  journal: [["import", "取込"], ["edit", "明細編集"], ["export", "弥生エクスポート"], ["master", "マスタ"]],
  statements: [["list", "明細"], ["imports", "取込履歴"], ["summary", "月次集計"]],
  profit: [["monthly", "月次"], ["trends", "推移"], ["comparison", "比較"], ["trial", "試算表"]],
  masters: [["journal", "共通仕訳"], ["intercompany", "法人間取引"], ["partners", "取引先"], ["payroll", "給与計算式"], ["categories", "経費区分"]],
  audit: [["all", "全ログ"], ["critical", "重要操作"], ["errors", "エラー"], ["role-changes", "ロール変更"]],
  settings: [["roles", "ロール"], ["notifications", "通知"], ["yayoi", "弥生連携"], ["misc", "その他"]],
};
export const BUD_VIEW_SCOPES: SystemViewScope[] = BUD_PAGES.flatMap(([key, label]) => [
  { pageKey: `bud-${key}`, tabKey: "", label, defaultRoles: BUD_DEFAULT_ROLES },
  ...(BUD_TABS[key] ?? []).map(([tabKey, tabLabel]) => ({ pageKey: `bud-${key}`, tabKey, label: tabLabel, defaultRoles: key === "expenses" && tabKey === "deleted" ? ["super_admin"] as const : BUD_DEFAULT_ROLES })),
]);
export function budPageKey(pathname: string) {
  const path = pathname.split("?")[0];
  if (path === "/bud/profit/broadband" || path.startsWith("/bud/profit/broadband/")) return undefined;
  const segment = path.split("/")[2];
  const key = segment === "shiwakechou" ? "journal" : segment;
  return BUD_PAGES.some(([page]) => page === key) ? `bud-${key}` : undefined;
}
