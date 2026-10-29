import { GARDEN_ROLE_ORDER, isRoleAtLeast, type GardenRole } from "@/app/root/_constants/types";

export type SystemViewScope = { pageKey: string; tabKey: string; label: string; defaultRoles: readonly GardenRole[] };
const all = GARDEN_ROLE_ORDER;
const staff = all.filter(role => isRoleAtLeast(role, "staff"));
const manager = all.filter(role => isRoleAtLeast(role, "manager"));
const scope = (page: string, label: string, roles: readonly GardenRole[] = all, tabKey = ""): SystemViewScope => ({ pageKey: `system-${page}`, tabKey, label, defaultRoles: roles });

// 画面の入口の既定。メニューの既定とは異なる画面もあるため、メニューは従来の判定を渡す。
export const SYSTEM_VIEW_SCOPES: SystemViewScope[] = [
  scope("expense", "経費 報告"),
  scope("dev-board", "開発ボード", []),
  scope("home", "ホーム"), scope("docs", "資料"), scope("manuals", "マニュアル"),
  scope("mypage", "自分の情報"), scope("attendance", "勤怠打刻"), scope("shift", "シフト"), scope("zenkaku", "前確依頼"),
  scope("call-metrics", "テレマ コール集計", staff), scope("innovera-calls", "INNOVERA履歴・録音"),
  scope("forms", "業務管理ツール"), scope("contracts", "契約書管理", manager),
  scope("sites", "コーポレートサイト", staff), scope("deliveries", "自動配信"),
  scope("kanri", "管理表ポータル", staff), scope("list", "リストマスタ", manager),
  ...([ ["input", "入力する"], ["auto", "自動で動いている"], ["host", "ホスト PC で動いている"], ["kintone", "Kintone に入れたしかけ"] ] as const).map(([key, label]) => scope("forms", label, staff, key)),
  ...([ ["sites", "サイト一覧"], ["news", "お知らせ"] ] as const).map(([key, label]) => scope("sites", label, staff, key)),
  ...([ ["list", "リスト"], ["upload", "アップロード"], ["analysis", "分析"], ["history", "履歴検索"], ["internal-block", "自社アポ禁"], ["guide", "管理方法"] ] as const).map(([key, label]) => scope("list", label, manager, key)),
  ...([ ["browse", "契約書"], ["register", "登録"] ] as const).map(([key, label]) => scope("contracts", label, manager, key)),
  ...([ ["employees", "従業員ごと"], ["lists", "リストごと"], ["definitions", "定義方法"], ["webinbound", "WEBインバウンド"] ] as const).map(([key, label]) => scope("call-metrics", label, staff, key)),
  ...([ ["kanri", "管理表"], ["jisseki", "実績管理"], ["aporan", "アポラン"], ["houhan", "訪問販売"], ["incentive", "インセ計算"], ["settings", "設定"] ] as const).map(([key, label]) => scope("kanri", label, manager, key)),
  scope("kanri", "給与試算", staff, "payroll"),
  ...([ ["operation", "操作マニュアル", staff], ["summary", "要点", ["super_admin"]], ["overview", "仕組み", ["super_admin"]], ["engineer", "仕様", ["super_admin"]], ["claude", "Claude 用", ["super_admin"]] ] as const).map(([key, label, roles]) => scope("manuals", label, roles, key)),
];

export function systemPageKey(href: string) {
  const segment = href.split("?")[0].split("/")[2] || "home";
  const key = `system-${segment}`;
  return SYSTEM_VIEW_SCOPES.some(scope => scope.pageKey === key) || segment === "onboarding" ? key : undefined;
}
