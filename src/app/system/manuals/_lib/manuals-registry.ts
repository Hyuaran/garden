import { isRoleAtLeast, type GardenRole } from "@/app/root/_constants/types";
import type { SystemIcon } from "@/app/system/_components/ShachoShell/shacho-shell-config";

export type ManualDocKey = "operation" | "summary" | "overview" | "engineer" | "claude";

export type ManualDoc = {
  key: ManualDocKey;
  label: string;
  file: string;
  kind: "html" | "md";
  minRole: GardenRole;
};

export type ManualModule = {
  slug: string;
  name: string;
  description: string;
  icon: SystemIcon;
};

export type ManualDefinition = {
  moduleSlug: string;
  slug: string;
  name: string;
  description: string;
  storagePrefix: string;
  docs: ManualDoc[];
};

// タブの並びと権限（全機能で共通）。①操作マニュアル＝社員以上、⓪②③④＝全権管理者のみ
export const MANUAL_DOCS: ManualDoc[] = [
  { key: "operation", label: "操作マニュアル", file: "1_operation.html", kind: "html", minRole: "staff" },
  { key: "summary", label: "要点", file: "0_summary.html", kind: "html", minRole: "super_admin" },
  { key: "overview", label: "仕組み", file: "2_overview.html", kind: "html", minRole: "super_admin" },
  { key: "engineer", label: "仕様", file: "3_engineer.html", kind: "html", minRole: "super_admin" },
  { key: "claude", label: "Claude 用", file: "4_claude.md", kind: "md", minRole: "super_admin" },
];

export const MANUAL_MODULES: ManualModule[] = [
  { slug: "system", name: "System", description: "社内システム", icon: "home" },
  { slug: "bud", name: "Bud", description: "経理収支", icon: "salary" },
];

function manual(moduleSlug: string, slug: string, name: string, description: string): ManualDefinition {
  return { moduleSlug, slug, name, description, storagePrefix: `${moduleSlug}/${slug}`, docs: MANUAL_DOCS };
}

// 並びは System の左メニューと同じ。資料の本体は Storage（system-manuals）の storagePrefix 配下に置く
export const SYSTEM_MANUALS: ManualDefinition[] = [
  manual("system", "docs", "資料", "会社説明・スライド・研修動画など、社内で読む資料の見方。"),
  manual("system", "onboarding", "入社手続き", "入社時の情報入力と、提出した内容の確認のしかた。"),
  manual("system", "mypage", "自分の情報と届出", "登録情報の確認と、住所・口座・交通費などの届出の出し方。"),
  manual("system", "kot-attendance", "勤怠打刻と KOT 取込", "出勤・退勤の打刻と、KOT へ取り込む CSV の作り方。"),
  manual("system", "shift", "シフト", "シフトの提出と勤務予定の確認のしかた。"),
  manual("system", "zenkaku", "前確依頼", "営業IDの登録内容の確認と、取次先への前確依頼の出し方。"),
  manual("system", "call-metrics", "テレマ コール集計", "架電の件数や結果の見方と、コールセンターへの共有。"),
  manual("system", "payroll-notice", "フォーム（給与計算連絡）", "月に一度の給与計算に関する連絡の送り方と、送信履歴の見方。"),
  manual("system", "contracts", "契約書管理", "上位店との契約書の登録と、パートナー配布用ひな形の作り方。"),
  manual("system", "toss", "関電トスポータル", "関西電力のトスアップの受け付けと、Kintone への連携。"),
  manual("system", "deliveries", "自動配信", "決まった時刻に Chatwork へ自動で送っている連絡の中身と確認のしかた。"),
  manual("system", "kanri", "管理表ポータル", "毎日の管理表を KOT・Kintone のデータから作り、TV・Excel・Chatwork へ出す手順。"),
  manual("system", "list", "リストマスタ", "営業リストを条件で絞って件数を見て、.mer に書き出す手順。"),
  manual("bud", "expense", "経費精算", "領収書の申請から承認・仕訳までの流れ。"),
];

export function getVisibleManualDocs(manual: ManualDefinition, role: GardenRole) {
  return manual.docs.filter((doc) => isRoleAtLeast(role, doc.minRole));
}

export function getVisibleManuals(role: GardenRole) {
  return SYSTEM_MANUALS.filter((manual) => getVisibleManualDocs(manual, role).length > 0);
}

export function getManualModules(role: GardenRole) {
  const visibleManuals = getVisibleManuals(role);
  return MANUAL_MODULES.map((module) => ({
    ...module,
    count: visibleManuals.filter((manual) => manual.moduleSlug === module.slug).length,
  })).filter((module) => module.count > 0);
}

export function findManualModule(moduleSlug: string) {
  return MANUAL_MODULES.find((module) => module.slug === moduleSlug) ?? null;
}

export function findManual(moduleSlug: string, slug: string) {
  return SYSTEM_MANUALS.find((manual) => manual.moduleSlug === moduleSlug && manual.slug === slug) ?? null;
}

export function findManualDoc(manual: ManualDefinition, file: string) {
  return manual.docs.find((doc) => doc.file === file) ?? null;
}
