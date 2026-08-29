import type { GardenRole } from "@/app/root/_constants/types";
import { isRoleAtLeast } from "@/app/root/_constants/types";

export type SystemIcon = "home" | "person" | "clock" | "chart" | "document" | "folder" | "message" | "report" | "salary" | "portal";

export type SystemMenuItem = {
  label: string;
  description: string;
  icon: SystemIcon;
  href?: string;
  minRole?: GardenRole;
  upcoming?: boolean;
};

export const SIDEBAR_HIDDEN_ROLES = new Set<GardenRole>([
  "closer",
  "toss",
  "outsource",
]);

export function shouldHideSidebar(role: GardenRole) {
  return SIDEBAR_HIDDEN_ROLES.has(role);
}

export const SYSTEM_MENU_ITEMS: SystemMenuItem[] = [
  { label: "ホーム", description: "社内システムの入口です。", icon: "home", href: "/system" },
  { label: "マイページ", description: "自分の情報の確認と、住所・口座・交通費などの届出を出せます。前確依頼もここから。", icon: "person", href: "/system/mypage" },
  { label: "勤怠打刻", description: "出勤・退勤の打刻をします。打刻の記録はそのまま勤怠の集計につながります。", icon: "clock", href: "/system/attendance" },
  { label: "テレマ コール集計", description: "架電の件数や結果を日ごと・リストごとに見られます。コールセンターへの共有もここから。", icon: "chart", href: "/system/call-metrics" },
  { label: "契約書管理", description: "上位店との契約書を登録して保存漏れを防ぎます。パートナー配布用のひな形もここで作れます。", icon: "document", href: "/system/contracts", minRole: "manager" },
  { label: "関電トスポータル", description: "関西電力のトスアップを受け付けます。入力内容はそのままKintoneへ連携されます。", icon: "folder", href: "/p/toss" },
  { label: "コール数配信", description: "毎日のコール数を決まった時刻に自動でお知らせします。", icon: "message", upcoming: true },
  { label: "テレマ日報", description: "その日の架電の報告をまとめて提出できるようにします。", icon: "report", upcoming: true },
  { label: "給与試算", description: "支給前におおよその金額を確認できるようにします。", icon: "salary", upcoming: true },
  { label: "管理表ポータル", description: "あちこちに分かれている管理表をひとつの入口にまとめます。", icon: "portal", upcoming: true },
];

export function canUseSystemItem(item: SystemMenuItem, role: GardenRole) {
  return !item.minRole || isRoleAtLeast(role, item.minRole);
}
