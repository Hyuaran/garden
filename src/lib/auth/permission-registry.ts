import {
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
import { MANAGER_VIEW_ROLES } from "@/lib/auth/view-roles";

// 各入口（page.tsx／layout.tsx／route.ts）は Next の制約で定数を export できないため、
// 入口と同じ集合を src/lib/auth/view-roles.ts から参照する
const CALL_METRICS_PAGE_VIEW_ROLES = MANAGER_VIEW_ROLES;
const CONTRACTS_VIEW_ROLES = MANAGER_VIEW_ROLES;
const CALL_METRICS_API_VIEW_ROLES = MANAGER_VIEW_ROLES;
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
    source: "src/app/system/call-metrics/page.tsx:VIEW_ROLES（=src/lib/auth/view-roles.ts:MANAGER_VIEW_ROLES）",
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
    source: "src/app/api/system/call-metrics/route.ts:VIEW_ROLES（=src/lib/auth/view-roles.ts:MANAGER_VIEW_ROLES）",
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
