import {
  GARDEN_ROLE_LABELS,
  GARDEN_ROLE_ORDER,
  ROOT_VIEW_ROLES,
  ROOT_WRITE_ROLES,
  TREE_CONFIRM_VIEW_ROLES,
  isRoleAtLeast,
  type GardenRole,
} from "@/app/root/_constants/types";
import {
  SIDEBAR_HIDDEN_ROLES,
  SYSTEM_MENU_ITEMS,
} from "@/app/system/_components/ShachoShell/shacho-shell-config";
import { MANUAL_DOCS } from "@/app/system/manuals/_lib/manuals-registry";
import { SYSTEM_FORMS } from "@/app/system/forms/_lib/forms-registry";
import { SYSTEM_DELIVERIES } from "@/app/system/deliveries/_lib/deliveries-registry";
import { MANAGER_VIEW_ROLES, STAFF_VIEW_ROLES } from "@/lib/auth/view-roles";
import { MANAGER_ROLES } from "@/app/system/_lib/attendance";

// 各入口（page.tsx／layout.tsx／route.ts）は Next の制約で定数を export できないため、
// 入口と同じ集合を src/lib/auth/view-roles.ts から参照する
const CALL_METRICS_PAGE_VIEW_ROLES = STAFF_VIEW_ROLES;
const CONTRACTS_VIEW_ROLES = MANAGER_VIEW_ROLES;
const CALL_METRICS_API_VIEW_ROLES = STAFF_VIEW_ROLES;
const CALL_REPORT_API_VIEW_ROLES = MANAGER_VIEW_ROLES;

export type PermissionEntry = {
  key: string;
  label: string;
  group: "System" | "Root" | "API";
  kind: "画面" | "タブ" | "操作" | "API";
  allows: (role: GardenRole) => boolean;
  source: string;
};

function allowsSet(roles: Iterable<GardenRole>) {
  const allowedRoles = new Set(roles);
  return (role: GardenRole) => allowedRoles.has(role);
}

function allowsMinRole(minRole: GardenRole) {
  return (role: GardenRole) => isRoleAtLeast(role, minRole);
}

function slugifyLabel(label: string) {
  return label.toLowerCase().replace(/\s+/g, "-");
}

// サイドバーが出ない役職（トス・クローザー・業務委託）がマイページのタブとして使える 4 画面
// （src/app/system/mypage/MyPageClient.tsx の TABS：マイページ／勤怠打刻／シフト／前確依頼）
// ＋入社手続き（新しく入った人はログイン直後に案内される。役職の制限なし）
const SIDEBARLESS_TAB_HREFS = new Set(["/system/mypage", "/system/attendance", "/system/shift", "/system/zenkaku", "/system/onboarding"]);

// System のメニュー項目：サイドバーが出ない役職はメニュー自体を使えず、上の 4 画面だけをタブで使う。
// minRole の無い項目でも、サイドバーが隠れる役職には ×。まだ画面の無い項目（準備中）は全員 ×
const systemMenuEntries: PermissionEntry[] = SYSTEM_MENU_ITEMS.map((item) => ({
  key: `system-menu-${item.href ?? item.label}`,
  label: item.upcoming ? `${item.label}（準備中・画面はまだ無い）` : item.label,
  group: "System",
  kind: "画面",
  allows: (role) => {
    if (item.upcoming) return false;
    if (SIDEBAR_HIDDEN_ROLES.has(role)) return Boolean(item.href && SIDEBARLESS_TAB_HREFS.has(item.href));
    return !item.minRole || isRoleAtLeast(role, item.minRole);
  },
  source: "src/app/system/_components/ShachoShell/shacho-shell-config.ts:SYSTEM_MENU_ITEMS＋SIDEBAR_HIDDEN_ROLES（タブ 4 画面は mypage/MyPageClient.tsx:TABS）",
}));

const manualDocEntries: PermissionEntry[] = MANUAL_DOCS.map((doc) => ({
  key: `system-manual-doc-${doc.key}`,
  label: `マニュアル：${doc.label}`,
  group: "System",
  kind: "タブ",
  allows: allowsMinRole(doc.minRole),
  source: "src/app/system/manuals/_lib/manuals-registry.ts:MANUAL_DOCS",
}));

const formEntries: PermissionEntry[] = SYSTEM_FORMS.map((form) => ({
  key: `system-form-${form.slug}`,
  label: `フォーム：${form.name}`,
  group: "System",
  kind: "画面",
  allows: allowsMinRole(form.minRole),
  source: "src/app/system/forms/_lib/forms-registry.ts:SYSTEM_FORMS",
}));

const deliveryEntries: PermissionEntry[] = SYSTEM_DELIVERIES.map((delivery) => ({
  key: `system-delivery-${delivery.slug}`,
  label: `自動配信：${delivery.name}`,
  group: "System",
  kind: "操作",
  allows: allowsMinRole(delivery.minRole),
  source: "src/app/system/deliveries/_lib/deliveries-registry.ts:SYSTEM_DELIVERIES",
}));

export const PERMISSION_ENTRIES: PermissionEntry[] = [
  {
    key: "system-sidebar",
    label: "System のサイドバー",
    group: "System",
    kind: "画面",
    allows: (role) => !SIDEBAR_HIDDEN_ROLES.has(role),
    source: "src/app/system/_components/ShachoShell/shacho-shell-config.ts:SIDEBAR_HIDDEN_ROLES",
  },
  ...systemMenuEntries,
  ...formEntries,
  ...deliveryEntries,
  {
    key: "system-call-metrics-page",
    label: "テレマ コール集計（閲覧）",
    group: "System",
    kind: "画面",
    allows: allowsSet(CALL_METRICS_PAGE_VIEW_ROLES),
    source: "src/app/system/call-metrics/page.tsx:VIEW_ROLES（=src/lib/auth/view-roles.ts:STAFF_VIEW_ROLES）",
  },
  {
    key: "system-contracts-page",
    label: "契約書管理（閲覧）",
    group: "System",
    kind: "画面",
    allows: allowsSet(CONTRACTS_VIEW_ROLES),
    source: "src/app/system/contracts/layout.tsx:VIEW_ROLES（=src/lib/auth/view-roles.ts:MANAGER_VIEW_ROLES）",
  },
  {
    key: "system-kanri-page",
    label: "管理表ポータル（利用）",
    group: "System",
    kind: "画面",
    allows: allowsMinRole("manager"),
    source: "src/app/system/_components/ShachoShell/shacho-shell-config.ts:SYSTEM_MENU_ITEMS",
  },
  {
    key: "system-list-page",
    label: "リストマスタ（利用）",
    group: "System",
    kind: "画面",
    allows: allowsMinRole("manager"),
    source: "src/app/system/list/page.tsx:isRoleAtLeast(role, \"manager\")",
  },
  ...manualDocEntries,
  {
    key: "system-attendance-sync-status",
    label: "勤怠打刻：同期状況（KOT取込CSVの生成・確定・取消）",
    group: "System",
    kind: "画面",
    allows: (role) => MANAGER_ROLES.has(role),
    source: "src/app/system/attendance/sync-status/page.tsx（src/app/system/_lib/attendance.ts:MANAGER_ROLES）",
  },
  {
    key: "system-onboarding-admin",
    label: "入社手続き：管理画面（入社者の一覧・事務入力）",
    group: "System",
    kind: "画面",
    allows: (role) => MANAGER_ROLES.has(role),
    source: "src/app/system/onboarding/_lib/onboarding-admin.server.ts:onboardingAdminContext（MANAGER_ROLES）",
  },
  {
    key: "root-permissions-view",
    label: "Root 権限一覧（この画面）",
    group: "Root",
    kind: "画面",
    allows: allowsSet(ROOT_VIEW_ROLES),
    source: "src/app/root/_constants/types.ts:ROOT_VIEW_ROLES（RootGate）",
  },
  {
    key: "root-employees-view",
    label: "Root 従業員マスタ（閲覧）",
    group: "Root",
    kind: "画面",
    allows: allowsSet(ROOT_VIEW_ROLES),
    source: "src/app/root/_constants/types.ts:ROOT_VIEW_ROLES",
  },
  {
    key: "root-employees-write",
    label: "Root 従業員マスタ（編集）",
    group: "Root",
    kind: "操作",
    allows: allowsSet(ROOT_WRITE_ROLES),
    source: "src/app/root/_constants/types.ts:ROOT_WRITE_ROLES",
  },
  {
    key: "root-tree-confirm-view",
    label: "前確・後確（閲覧）",
    group: "Root",
    kind: "画面",
    allows: allowsSet(TREE_CONFIRM_VIEW_ROLES),
    source: "src/app/root/_constants/types.ts:TREE_CONFIRM_VIEW_ROLES",
  },
  {
    key: "root-roster-sync",
    label: "名簿と同期",
    group: "Root",
    kind: "操作",
    allows: allowsMinRole("admin"),
    source: "src/app/api/root/roster-sync/route.ts:requireAdmin",
  },
  {
    key: "api-require-employee",
    label: "本人の情報の API（自分の情報・打刻・届出）",
    group: "API",
    kind: "API",
    allows: () => true,
    source: "src/app/system/mypage/_lib/submission-server.ts:requireEmployee",
  },
  {
    key: "api-require-staff",
    label: "社員以上の API",
    group: "API",
    kind: "API",
    allows: allowsMinRole("staff"),
    source: "src/app/system/mypage/_lib/submission-server.ts:requireStaff",
  },
  {
    key: "api-require-manager",
    label: "責任者以上の API",
    group: "API",
    kind: "API",
    allows: allowsMinRole("manager"),
    source: "src/app/system/mypage/_lib/submission-server.ts:requireManager",
  },
  {
    key: "api-require-admin",
    label: "管理者以上の API",
    group: "API",
    kind: "API",
    allows: allowsMinRole("admin"),
    source: "src/app/system/mypage/_lib/submission-server.ts:requireAdmin",
  },
  {
    key: "api-call-metrics",
    label: "コール集計 API",
    group: "API",
    kind: "API",
    allows: allowsSet(CALL_METRICS_API_VIEW_ROLES),
    source: "src/app/api/system/call-metrics/route.ts:VIEW_ROLES（=src/lib/auth/view-roles.ts:STAFF_VIEW_ROLES）",
  },
  {
    key: "api-call-report",
    label: "テレマ日報 API",
    group: "API",
    kind: "API",
    allows: allowsSet(CALL_REPORT_API_VIEW_ROLES),
    source: "src/app/api/system/call-report/route.ts:VIEW_ROLES（=src/lib/auth/view-roles.ts:MANAGER_VIEW_ROLES）",
  },
  {
    key: "api-roster-sync",
    label: "名簿同期 API",
    group: "API",
    kind: "API",
    allows: allowsMinRole("admin"),
    source: "src/app/api/root/roster-sync/route.ts:requireAdmin",
  },
];

/** 役職ごとの説明（画面の「役職の一覧」に出す。誰がこの役職か・どこまで使えるか） */
export const GARDEN_ROLE_NOTES: Record<GardenRole, string> = {
  toss: "アルバイト（トス）。System のサイドバーは出ず、マイページのタブ（自分の情報・勤怠打刻・シフト・前確依頼）と入社手続きだけ",
  closer: "アルバイト（クローザー。テレマにもいる）。使える範囲はトスと同じ",
  cs: "CS。サイドバーが出て、社員向け以外の画面（資料・前確依頼・前確／後確の閲覧など）を使える",
  staff: "正社員。社員向けの画面（操作マニュアル・フォーム・自動配信）まで",
  outsource: "業務委託（外注）。サイドバーは出ず、マイページのタブと入社手続きだけ。社員以上の API は使える",
  manager: "責任者（チームリーダー・責任者）。管理表ポータル・リストマスタ・契約書管理・コール集計・勤怠の同期状況・Root の閲覧",
  admin: "管理者。責任者の範囲に加えて Root 従業員マスタの編集と名簿との同期",
  super_admin: "全権管理者。すべての画面と、マニュアルの仕組み・仕様・Claude 用の資料",
};

export type RoleSummaryRow = {
  role: GardenRole;
  rank: number;
  label: string;
  note: string;
  allowedCount: number;
  totalCount: number;
};

/** 役職の一覧：順位・名前・説明・使える行の数（上の表から自動で数える） */
export function buildRoleSummary(): RoleSummaryRow[] {
  return GARDEN_ROLE_ORDER.map((role, index) => ({
    role,
    rank: index + 1,
    label: GARDEN_ROLE_LABELS[role],
    note: GARDEN_ROLE_NOTES[role],
    allowedCount: PERMISSION_ENTRIES.filter((entry) => entry.allows(role)).length,
    totalCount: PERMISSION_ENTRIES.length,
  }));
}

export function buildPermissionMatrix() {
  return PERMISSION_ENTRIES.map((entry) => ({
    key: entry.key,
    label: entry.label,
    group: entry.group,
    kind: entry.kind,
    source: entry.source,
    roles: Object.fromEntries(
      GARDEN_ROLE_ORDER.map((role) => [role, entry.allows(role)]),
    ) as Record<GardenRole, boolean>,
  }));
}

export function findPermissionEntry(label: string) {
  return PERMISSION_ENTRIES.find((entry) => entry.label === label || entry.key === slugifyLabel(label));
}
