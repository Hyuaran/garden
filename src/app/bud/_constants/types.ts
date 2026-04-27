/**
 * Garden-Bud — TypeScript 型定義
 *
 * Supabase テーブル `bud_*` に対応する型。
 * マスタ系（法人・口座・取引先・従業員・保険・勤怠）は
 * `../../root/_constants/types.ts` の型を使うこと（ここでは再定義しない）。
 *
 * ロール型（GardenRole）も Root の types.ts を参照する。
 */

import type { GardenRole } from "../../root/_constants/types";
import type {
  TransferStatus,
  CashbackApplicationStatus,
} from "./transfer-status";

// ============================================================
// Bud 内役割
// ============================================================
export type BudRole = "admin" | "approver" | "staff";

// ============================================================
// bud_users
// ============================================================
export interface BudUser {
  id: string;
  employee_id: string;
  user_id: string;
  bud_role: BudRole;
  is_active: boolean;
  assigned_by: string | null;
  assigned_at: string;
  created_at: string;
  updated_at: string;
}

// ============================================================
// 認証・アクセス情報（アプリ内状態管理用）
// ============================================================

/** BudGate 通過後に参照する認証済みユーザー情報 */
export interface BudSessionUser {
  employee_id: string;
  employee_number: string;
  name: string;
  garden_role: GardenRole;
  user_id: string;
  /** 明示登録がない場合は null（admin/super_admin の自動許可時） */
  bud_role: BudRole | null;
  /** UIで表示する実効 bud_role（null時は 'admin' 扱い） */
  effective_bud_role: BudRole;
}

// ============================================================
// bud_transfers（振込管理・Phase 1で使用）
// ============================================================
export type {
  TransferStatus,
  CashbackApplicationStatus,
} from "./transfer-status";
export {
  TRANSFER_STATUSES,
  CASHBACK_APPLICATION_STATUSES,
  canTransition,
} from "./transfer-status";

export type TransferCategory = "regular" | "cashback";
export type TransferType = "給与" | "外注費" | "経費精算" | "その他";
export type DataSource = "紙スキャン" | "デジタル入力" | "CSVインポート";
export type FeeBearer = "当方負担" | "先方負担";

export interface BudTransfer {
  transfer_id: string;
  status: TransferStatus;
  data_source: DataSource | null;
  transfer_type: TransferType | null;
  request_date: string;
  due_date: string | null;
  scheduled_date: string | null;
  executed_date: string | null;
  company_id: string | null;
  source_account_id: string | null;
  vendor_id: string | null;
  payee_name: string;
  payee_bank_name: string | null;
  payee_bank_code: string | null;
  payee_branch_name: string | null;
  payee_branch_code: string | null;
  payee_account_type: string | null;
  payee_account_number: string | null;
  payee_account_holder_kana: string | null;
  fee_bearer: FeeBearer | null;
  amount: number;
  description: string | null;
  created_by: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  csv_exported_by: string | null;
  csv_exported_at: string | null;
  executed_by: string | null;
  rejection_reason: string | null;
  batch_code: string | null;
  duplicate_flag: boolean;
  duplicate_confirmed: boolean;
  scan_image_url: string | null;
  invoice_pdf_url: string | null;
  created_at: string;
  updated_at: string;
  // ===== Phase 1b で追加（v2 schema） =====
  transfer_category: TransferCategory | null;
  request_company_id: string | null;
  execute_company_id: string | null;
  cashback_applicant_name_kana: string | null;
  cashback_applicant_name: string | null;
  cashback_applicant_phone: string | null;
  cashback_customer_id: string | null;
  cashback_order_date: string | null;
  cashback_opened_date: string | null;
  cashback_product_name: string | null;
  cashback_channel_name: string | null;
  cashback_partner_code: string | null;
  cashback_application_status: CashbackApplicationStatus | null;
  payee_mismatch_confirmed: boolean;
  expense_category_id: string | null;
  forest_account_id: string | null;
  duplicate_key: string | null; // GENERATED 列
  // ===== A-03 で追加（bud-a03-status-history-migration.sql） =====
  status_changed_at: string | null;
  status_changed_by: string | null;
}

// ============================================================
// bud_statements（入出金明細）
// 旧 Phase 2 仮置き型は A-06 全面再設計で廃止（a-review #55 R2、2026-04-27 a-bud）。
// 実装側の正本型は src/app/bud/_lib/statement-queries.ts / statement-import.ts 等の
// 個別ファイルが Supabase generated types ベースで保持する。
// 互換用として旧 ENUM は残置（他参照ゼロ確認済、将来削除可）。
// ============================================================
export type ReconcileStatus = "未照合" | "照合済み" | "対象外";
export type TransactionType = "入金" | "出金" | "振替";

/**
 * @deprecated A-06 で全面再設計（statement_id text PK → id uuid PK、deposit/withdrawal_amount → amount signed bigint 等）。
 * 本 interface は使用箇所ゼロのため残置のみ。新規利用は禁止、`statement-queries.ts` 等の個別型を使用すること。
 * 削除タイミング: PR #85 merge 後の型整理 PR（a-review #55 R2 後続作業）。
 */
export interface BudStatement {
  statement_id: string;
  company_id: string | null;
  account_id: string | null;
  transaction_date: string;
  transaction_type: TransactionType | null;
  deposit_amount: number;
  withdrawal_amount: number;
  balance: number | null;
  bank_description: string | null;
  counterparty_name: string | null;
  vendor_id: string | null;
  reconcile_status: ReconcileStatus;
  reconcile_transfer_id: string | null;
  reconciled_at: string | null;
  reconciled_by: string | null;
  import_datetime: string | null;
  import_filename: string | null;
  import_batch_id: string | null;
  created_at: string;
}

// ============================================================
// bud_salary_batches / bud_salary_details（給与処理・Phase 3で使用）
// ============================================================
export type SalaryBatchStatus =
  | "計算中"
  | "課長確認"
  | "東海林確認"
  | "確定"
  | "振込連携済";
export type SalaryDetailStatus = "計算中" | "確認待ち" | "確定";

export interface BudSalaryBatch {
  batch_id: string;
  target_month: string;
  status: SalaryBatchStatus;
  company_id: string | null;
  payment_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** 給与明細。Phase 3 で各カラムを個別に型付けする予定。Phase 0 は Record 互換の最小型のみ */
export interface BudSalaryDetailBase {
  detail_id: string;
  batch_id: string | null;
  employee_id: string | null;
  employee_name: string | null;
  company_id: string | null;
  employment_type: string | null;
  target_month: string | null;
  payment_date: string | null;
  status: SalaryDetailStatus;
  total_payment: number;
  total_deduction: number;
  net_payment: number;
  insurance_id: string | null;
  attendance_id: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}
