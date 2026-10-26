import { ROOT_VIEW_ROLES, ROOT_WRITE_ROLES } from "@/app/root/_constants/types";
import type { SystemViewScope } from "./system-view-scopes";

// 現在の Root には画面切り替えのタブはない。絞り込みや編集小窓は含めない。
export const ROOT_VIEW_SCOPES: SystemViewScope[] = [
  ["home", "ホーム"], ["employees", "従業員マスタ"], ["companies", "法人マスタ"],
  ["vendors", "取引先"], ["bank-accounts", "銀行口座"], ["bank-check", "口座の点検"],
  ["salary-systems", "給与体系"], ["insurance", "社会保険"], ["attendance", "勤怠データ"],
  ["kot-sync-history", "KOT 同期履歴"], ["contracts", "契約書"], ["inbox", "受信箱"], ["permissions", "権限一覧"],
].map(([key, label]) => ({ pageKey: `root-${key}`, tabKey: "", label,
  defaultRoles: ["bank-check", "kot-sync-history"].includes(key) ? ROOT_WRITE_ROLES : ROOT_VIEW_ROLES }));

export function rootPageKey(pathname: string) {
  const key = `root-${pathname.split("?")[0].split("/")[2] || "home"}`;
  return ROOT_VIEW_SCOPES.some(scope => scope.pageKey === key) ? key : undefined;
}
