/**
 * Garden Root — マスタデータの型定義
 *
 * Supabase テーブル `root_*` に対応する TypeScript 型。
 * 設計書: 008_Garden Root/Garden-Root_マスタ定義書_GardenBud用_20260416_v2.md
 */

// ============================================================
// 1. 法人マスタ
// ============================================================
export interface Company {
  company_id: string;           // COMP-001
  company_name: string;
  company_name_kana: string;
  corporate_number: string | null;
  representative: string;
  address: string;
  phone: string | null;
  default_bank: string;          // 楽天銀行/みずほ銀行/PayPay銀行
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const DEFAULT_BANKS = ["楽天銀行", "みずほ銀行", "PayPay銀行"] as const;
export type DefaultBank = (typeof DEFAULT_BANKS)[number];

// ============================================================
// 2. 銀行口座マスタ
// ============================================================
export interface BankAccount {
  account_id: string;           // ACC-001
  company_id: string;
  bank_name: string;
  bank_code: string;            // 4桁
  branch_name: string;
  branch_code: string;          // 3桁
  account_type: string;         // 普通/当座
  account_number: string;       // 7桁
  account_holder: string;
  purpose: string | null;       // メイン/給与/経費等
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================
// 3. 取引先マスタ
// ============================================================
export interface Vendor {
  vendor_id: string;            // VND-001
  vendor_name: string;
  vendor_name_kana: string;
  vendor_type: string | null;   // 外注先/仕入先/その他
  bank_name: string;
  bank_code: string;
  branch_name: string;
  branch_code: string;
  account_type: string;
  account_number: string;
  account_holder_kana: string;
  fee_bearer: string;           // 当方負担/先方負担
  company_id: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================
// 4. 給与体系マスタ
// ============================================================
export interface SalarySystem {
  salary_system_id: string;     // SAL-SYS-001
  system_name: string;
  employment_type: string;      // 正社員/アルバイト/共通
  base_salary_type: string;     // 月給/時給/日給
  working_hours_day: number;
  working_days_month: number;
  overtime_rate: number;
  night_overtime_rate: number;
  holiday_overtime_rate: number;
  allowances: Record<string, unknown> | null;
  deductions: Record<string, unknown> | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// 5. 従業員マスタ
// ============================================================
export interface Employee {
  employee_id: string;          // EMP-0001
  employee_number: string;
  name: string;
  name_kana: string;
  company_id: string;
  employment_type: string;      // 正社員 / アルバイト / outsource（Phase A-3-g）
  salary_system_id: string;
  hire_date: string;            // YYYY-MM-DD
  termination_date: string | null;
  /** 外注の契約終了日（employment_type=outsource のときに利用）。Phase A-3-g */
  contract_end_on?: string | null;
  /** 年末調整の甲/乙欄区分（kou=甲欄/主な収入、otsu=乙欄/副業、null=未設定）。Phase A-3-h */
  kou_otsu?: "kou" | "otsu" | null;
  /** 扶養家族人数（0〜20）。源泉徴収税額表のルックアップに使用。Phase A-3-h */
  dependents_count?: number;
  /** 論理削除タイムスタンプ。null=有効、値あり=削除済（is_active とは別軸）。Phase A-3-h */
  deleted_at?: string | null;
  email: string;
  bank_name: string;
  bank_code: string;
  branch_name: string;
  branch_code: string;
  account_type: string;
  account_number: string;
  account_holder: string;
  account_holder_kana: string;
  kot_employee_id: string | null;
  mf_employee_id: string | null;
  insurance_type: string;       // 加入/未加入/一部加入
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// 6. 社会保険マスタ
// ============================================================
export interface Insurance {
  insurance_id: string;         // INS-2026
  fiscal_year: string;
  effective_from: string;
  effective_to: string | null;
  health_insurance_rate: number;
  nursing_insurance_rate: number;
  pension_rate: number;
  employment_insurance_rate: number;
  child_support_rate: number;
  grade_table: unknown[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================
// 7. 勤怠データ
// ============================================================
export interface Attendance {
  attendance_id: string;        // ATT-2026-04-0001
  employee_id: string;
  target_month: string;         // 2026-04
  working_days: number;
  absence_days: number;
  paid_leave_days: number;
  scheduled_hours: number;
  actual_hours: number;
  overtime_hours: number;
  legal_overtime_hours: number;
  night_hours: number;
  holiday_hours: number;
  late_hours: number;
  early_leave_hours: number;
  training_hours: number | null;
  office_hours: number | null;
  imported_at: string | null;
  import_status: string;        // 未取込/取込済/エラー
  kot_record_id: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// 8. 認証拡張型（root-auth-schema.sql で追加されるフィールド）
// ============================================================

/** Garden全体ロール（8段階・Phase A-3-g で outsource 追加） */
export type GardenRole =
  | "toss"         // トス（アポインター）
  | "closer"       // クローザー
  | "cs"           // CS（仮）: 前確/後確画面の閲覧権限ここ以上
  | "staff"        // 一般社員（仮）
  | "outsource"    // 外注（業務委託、Phase A-3-g、staff と manager の間）
  | "manager"      // 責任者（仮）
  | "admin"        // 管理者（仮）
  | "super_admin"; // 全権管理者

/** ロール表示ラベル（日本語） */
export const GARDEN_ROLE_LABELS: Record<GardenRole, string> = {
  toss:        "トス",
  closer:      "クローザー",
  cs:          "CS",
  staff:       "一般社員",
  outsource:   "外注",
  manager:     "責任者",
  admin:       "管理者",
  super_admin: "全権管理者",
};

/** ロールの階層順序（昇順）。outsource は staff と manager の間。 */
export const GARDEN_ROLE_ORDER: GardenRole[] = [
  "toss",
  "closer",
  "cs",
  "staff",
  "outsource",
  "manager",
  "admin",
  "super_admin",
];

/** 指定ロールが基準ロール以上の権限を持つか（階層比較） */
export function isRoleAtLeast(target: GardenRole, baseline: GardenRole): boolean {
  return GARDEN_ROLE_ORDER.indexOf(target) >= GARDEN_ROLE_ORDER.indexOf(baseline);
}

/** Root 画面閲覧可能なロール（manager 以上） */
export const ROOT_VIEW_ROLES: GardenRole[] = ["manager", "admin", "super_admin"];

/** Root 編集可能なロール（admin 以上） */
export const ROOT_WRITE_ROLES: GardenRole[] = ["admin", "super_admin"];

/** Tree 前確/後確画面の閲覧可能ロール（cs 以上） */
export const TREE_CONFIRM_VIEW_ROLES: GardenRole[] = [
  "cs", "staff", "manager", "admin", "super_admin",
];

/** root_employees テーブルに認証拡張フィールドを含めた型 */
export interface RootEmployee extends Employee {
  user_id: string | null;
  garden_role: GardenRole;
  birthday: string | null; // YYYY-MM-DD
}

// ============================================================
// マスタメニュー定義
// ============================================================
export interface MasterMenu {
  slug: string;
  title: string;
  description: string;
  icon: string;
  /** admin 以上のロールに限定表示するメニュー（ナビ非表示 + 直接 URL アクセス時は RootGate が弾く） */
  adminOnly?: boolean;
}

export const MASTER_MENUS: MasterMenu[] = [
  { slug: "companies",       title: "法人マスタ",     description: "6法人の基本情報、デフォルト振込銀行",   icon: "🏢" },
  { slug: "bank-accounts",   title: "銀行口座マスタ", description: "法人ごとの振込元口座",                    icon: "🏦" },
  { slug: "vendors",         title: "取引先マスタ",   description: "振込先（外注先・仕入先）の口座情報",      icon: "🤝" },
  { slug: "employees",       title: "従業員マスタ",   description: "従業員情報、振込口座、給与体系",          icon: "👤" },
  { slug: "salary-systems",  title: "給与体系マスタ", description: "雇用形態別の計算ルール",                  icon: "💰" },
  { slug: "insurance",       title: "社会保険マスタ", description: "保険料率、等級テーブル",                  icon: "🛡️" },
  { slug: "attendance",      title: "勤怠データ",     description: "キングオブタイムから取込",                icon: "📅" },
  { slug: "kot-sync-history", title: "KoT 同期履歴",  description: "KoT 連携の同期ログ閲覧・再実行",          icon: "🔄", adminOnly: true },
];
