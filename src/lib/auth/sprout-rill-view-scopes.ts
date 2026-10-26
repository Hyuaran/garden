import { GARDEN_ROLE_ORDER, isRoleAtLeast } from "@/app/root/_constants/types";
import type { SystemViewScope } from "./system-view-scopes";

export const SPROUT_RILL_TABS: Record<string, readonly (readonly [string, string])[]> = {
  "sprout-applicants": [["applicants", "応募者"], ["interviews", "面接予定"], ["training", "研修予定"]],
  "sprout-postings": [["baitoru", "バイトル"]],
  "rill-mail": [["all", "すべての箱"], ["flagged", "ピン止め"], ["me", "自分の受信箱"], ["sent", "送信済み"], ["shared", "共有受信箱"]],
};
export const SPROUT_RILL_VIEW_SCOPES: SystemViewScope[] = Object.entries(SPROUT_RILL_TABS).flatMap(([pageKey, tabs]) => {
  const sprout = pageKey.startsWith("sprout-");
  const defaultRoles = GARDEN_ROLE_ORDER.filter(role => isRoleAtLeast(role, sprout ? "staff" : "admin"));
  // Sprout は staff 以上に準備中の入口があり、実データは従来 super_admin だけ。
  return [{ pageKey, tabKey: "", label: pageKey === "sprout-applicants" ? "採用管理" : sprout ? "掲載管理" : "メッセージ", defaultRoles },
    ...tabs.map(([tabKey, label]) => ({ pageKey, tabKey, label, defaultRoles: sprout ? ["super_admin"] as const : defaultRoles }))];
});
export const rillBoxTab = (box: string) => ["all", "flagged", "me", "sent"].includes(box) ? box : "shared";
