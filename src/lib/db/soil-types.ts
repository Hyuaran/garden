/**
 * Garden-Soil DB 行型定義
 *
 * 対応 spec:
 *   - docs/specs/2026-04-25-soil-01-list-master-schema.md（#01 リスト本体）
 *   - docs/specs/2026-04-25-soil-02-call-history-schema.md（#02 コール履歴）
 *   - docs/specs/2026-04-25-soil-07-delete-pattern.md（#07 削除パターン）
 *   - docs/specs/2026-04-25-soil-08-api-contracts.md（#08 参照 API 契約）
 *   - docs/specs/2026-04-26-soil-phase-b-03-kanden-master-integration.md（B-03 関電マスタ列）
 *
 * 対応 migration:
 *   - supabase/migrations/20260507000001_soil_lists.sql
 *   - supabase/migrations/20260507000002_soil_call_history.sql
 *
 * 作成: 2026-05-07（Batch 16 基盤実装、a-soil）
 *
 * 命名規則:
 *   - DB 行型は `Soil*Row`（Snake → Camel 変換は呼出元で）
 *   - INSERT 入力型は `Soil*Insert`
 *   - UPDATE 入力型は `Soil*Update`
 */

// ============================================================
// soil_lists（リスト本体、253 万件級顧客マスタ）
// ============================================================

/** 顧客区分 */
export type SoilCustomerType = "individual" | "corporate";

/** 法人規模 */
export type SoilBusinessSize = "micro" | "small" | "medium" | "large";

/** リスト状態 */
export type SoilListStatus =
  | "active"           // 通常リスト、架電可（既定）
  | "casecreated"      // 1 件以上の Leaf 案件あり
  | "churned"          // 全 Leaf 案件が離脱・終了
  | "donotcall"        // 架電拒否 / クーリング
  | "merged";          // 重複統合済（旧側）

/** 案件モジュール識別（Leaf 各商材） */
export type SoilCaseModule =
  | "leaf_kanden"
  | "leaf_hikari"
  | "leaf_creditcard"
  | string;            // 拡張可

/** 取込元チャネル（B-03） */
export type SoilSourceChannel =
  | "kintone_app55"
  | "walk_in"
  | "referral"
  | "csv_import"
  | string;

/** 連絡先補助エントリ */
export type SoilPhoneAlternate = {
  number: string;
  type: "fax" | "mobile" | "office" | "home" | string;
};

/** 住所 JSONB エントリ */
export type SoilAddress = {
  postal_code: string;
  prefecture: string;
  city: string;
  address_line: string;
};

/** soil_lists テーブル行型 */
export type SoilListRow = {
  id: string;

  // 識別
  list_no: string | null;
  source_system: string;
  source_record_id: string | null;

  // 顧客
  customer_type: SoilCustomerType;
  name_kanji: string | null;
  name_kana: string | null;
  representative_name_kanji: string | null;
  representative_name_kana: string | null;

  // 連絡先
  phone_primary: string | null;
  phone_alternates: SoilPhoneAlternate[] | null;
  email_primary: string | null;
  email_alternates: { email: string; type?: string }[] | null;

  // 住所
  postal_code: string | null;
  prefecture: string | null;
  city: string | null;
  address_line: string | null;
  addresses_jsonb: {
    billing?: SoilAddress;
    usage?: SoilAddress;
    delivery?: SoilAddress;
  } | null;

  // 商材適性
  industry_type: string | null;
  business_size: SoilBusinessSize | null;

  // 状態
  status: SoilListStatus;
  status_changed_at: string | null;
  status_changed_by: string | null;
  donotcall_reason: string | null;

  // 重複統合
  merged_into_id: string | null;

  // 案件化トラッキング
  primary_case_module: SoilCaseModule | null;
  primary_case_id: string | null;
  case_count: number;

  // B-03 関電マスタ統合
  supply_point_22: string | null;
  pd_number: string | null;
  old_pd_numbers: string[] | null;

  // B-03 リスト外
  is_outside_list: boolean;
  source_channel: SoilSourceChannel | null;

  // メタ
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;

  // 削除
  deleted_at: string | null;
  deleted_by: string | null;
  deleted_reason: string | null;
};

/** soil_lists INSERT 入力型（DB デフォルトのある列はオプショナル） */
export type SoilListInsert = Omit<
  SoilListRow,
  "id" | "case_count" | "is_outside_list" | "status" | "created_at" | "updated_at"
> & {
  id?: string;
  case_count?: number;
  is_outside_list?: boolean;
  status?: SoilListStatus;
  created_at?: string;
  updated_at?: string;
};

/** soil_lists UPDATE 入力型（全列任意） */
export type SoilListUpdate = Partial<Omit<SoilListRow, "id" | "created_at">>;

// ============================================================
// soil_call_history（コール履歴、335 万件級、月次パーティション）
// ============================================================

/** 通話タイプ（Garden 7 段階）*/
export type SoilCallMode =
  | "sprout"           // 初回着信
  | "branch"           // 関係構築通話
  | "leaf"             // 商談化通話
  | "bloom"            // クロージング通話
  | "fruit"            // アフターフォロー通話
  | "noresponse"       // 無応答
  | "misdial";         // 誤タップ

/** 通話到達結果 */
export type SoilCallResult =
  | "connected"
  | "voicemail"
  | "busy"
  | "noanswer"
  | "rejected"
  | "wrongnumber";

/** 業務的成果 */
export type SoilCallOutcome =
  | "appointment_set"
  | "denied"
  | "callback_requested"
  | "sale_done";

/** soil_call_history テーブル行型 */
export type SoilCallHistoryRow = {
  id: number;                                // bigserial
  list_id: string;
  case_id: string | null;
  case_module: SoilCaseModule | null;
  user_id: string;
  call_datetime: string;                     // パーティションキー
  call_ended_at: string | null;
  call_duration_sec: number | null;
  call_mode: SoilCallMode;
  result: SoilCallResult;
  outcome: SoilCallOutcome | null;
  callback_requested_at: string | null;
  callback_target_at: string | null;
  memo: string | null;
  voice_recording_url: string | null;
  is_misdial: boolean;
  is_billable: boolean;
  created_at: string;
};

/** soil_call_history INSERT 入力型 */
export type SoilCallHistoryInsert = Omit<
  SoilCallHistoryRow,
  "id" | "call_duration_sec" | "is_misdial" | "is_billable" | "created_at"
> & {
  id?: number;
  call_duration_sec?: number | null;
  is_misdial?: boolean;
  is_billable?: boolean;
  created_at?: string;
};

// ============================================================
// soil_list_imports（インポートバッチ追跡）
// ============================================================

export type SoilListImportRow = {
  id: string;
  source_system: string;
  source_label: string | null;
  imported_at: string;
  imported_by: string | null;
  total_records: number;
  inserted_count: number;
  updated_count: number;
  skipped_duplicate_count: number;
  failed_count: number;
  error_summary: { records: { row_no: number; error: string }[] } | null;
  notes: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
};

// ============================================================
// soil_list_tags（タグ）
// ============================================================

export type SoilListTagRow = {
  id: string;
  list_id: string;
  tag: string;
  added_at: string;
  added_by: string | null;
};

// ============================================================
// soil_lists_merge_proposals（重複統合提案、B-03）
// ============================================================

export type SoilMatchRound = "R1" | "R2" | "R3" | "R4" | "R5" | "R6";

export type SoilMergeReviewStatus = "pending" | "approved" | "rejected" | "merged";

export type SoilMergeProposalRow = {
  id: string;
  primary_list_id: string;
  duplicate_list_id: string;
  match_round: SoilMatchRound;
  confidence: number;                        // 0.00 〜 1.00
  proposed_at: string;
  proposed_by: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_status: SoilMergeReviewStatus;
  review_notes: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
};

// ============================================================
// supply_point_22 format guard
// ============================================================

/**
 * 22 桁の関電供給地点識別子か検証する純粋関数。
 * DB 側 CHECK 制約と同等のバリデーション（'^[0-9]{22}$'）。
 */
export function isValidSupplyPoint22(value: string | null | undefined): boolean {
  if (value == null) return false;
  return /^[0-9]{22}$/.test(value);
}
