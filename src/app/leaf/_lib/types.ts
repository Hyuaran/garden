/**
 * Garden-Leaf 関電業務委託 — TypeScript 型定義
 *
 * v3 改訂で以下を拡張:
 * - KandenAttachment に deleted_at / deleted_by を追加（論理削除）
 * - GardenRole / DELETABLE_ROLES / ADMIN_ROLES を新設（v3 で論理削除全員可化）
 * - LeafBusiness / LeafUserBusiness を新設（事業スコープ制御）
 * - AttachmentHistory を新設（変更履歴 trigger 用、UI は Batch 14 別 spec）
 * - ImageDownloadPasswordSetting を新設（DL 専用 PW、root_settings 格納）
 *
 * see: docs/superpowers/specs/2026-04-23-leaf-a1c-attachment-design.md §2.6.6 (v3)
 */

// ─── 8段階ステータス ─────────────────────────────────────────────────────────
export type KandenStatus =
  | "ordered"            // 受注
  | "awaiting_specs"     // 諸元待ち
  | "awaiting_entry"     // エントリー待ち
  | "awaiting_sending"   // 送付待ち
  | "awaiting_invoice"   // 請求待ち
  | "awaiting_payment"   // 入金待ち
  | "awaiting_payout"    // 支払待ち
  | "completed";         // 完了

export const STATUS_FLOW: {
  key: KandenStatus;
  label: string;
  short: string;
  num: number;
  dateField: keyof KandenCase;
  dateLabel: string;
}[] = [
  { key: "ordered",           label: "受注",         short: "受注",   num: 1, dateField: "ordered_at",           dateLabel: "受注日" },
  { key: "awaiting_specs",    label: "諸元待ち",     short: "諸元",   num: 2, dateField: "specs_collected_at",    dateLabel: "諸元回収日" },
  { key: "awaiting_entry",    label: "エントリー待ち", short: "エントリ", num: 3, dateField: "entered_at",           dateLabel: "エントリー日" },
  { key: "awaiting_sending",  label: "送付待ち",     short: "送付",   num: 4, dateField: "sent_at",               dateLabel: "送付日" },
  { key: "awaiting_invoice",  label: "請求待ち",     short: "請求",   num: 5, dateField: "invoiced_at",           dateLabel: "請求日" },
  { key: "awaiting_payment",  label: "入金待ち",     short: "入金",   num: 6, dateField: "payment_received_at",   dateLabel: "入金予定日" },
  { key: "awaiting_payout",   label: "支払待ち",     short: "支払",   num: 7, dateField: "payment_sent_at",       dateLabel: "支払予定日" },
  { key: "completed",         label: "完了",         short: "完了",   num: 8, dateField: "completed_at",          dateLabel: "完了日" },
];

export const STATUS_LABELS: Record<KandenStatus, string> = {
  ordered:           "受注",
  awaiting_specs:    "諸元待ち",
  awaiting_entry:    "エントリー待ち",
  awaiting_sending:  "送付待ち",
  awaiting_invoice:  "請求待ち",
  awaiting_payment:  "入金待ち",
  awaiting_payout:   "支払待ち",
  completed:         "完了",
};

// ─── soil_kanden_cases ───────────────────────────────────────────────────────
export interface KandenCase {
  case_id: string;
  company_id: string;
  case_type: "latest" | "replaced" | "makinaoshi" | "outside";
  acquisition_type: "dakkan" | "kakoi";

  // 営業担当
  sales_employee_number: string | null;
  sales_name: string | null;
  sales_department: string | null;
  app_code: string | null;

  // 顧客情報
  customer_number: string;
  customer_name: string | null;
  supply_point_22: string | null;
  supply_schedule_code: string | null;
  supply_start_date: string | null;      // YYYY-MM-DD

  // PD
  pd_number: string | null;
  old_pd_number: string | null;

  // 8段階ステータス
  status: KandenStatus;
  ordered_at: string | null;
  specs_collected_at: string | null;
  entered_at: string | null;
  sent_at: string | null;
  invoiced_at: string | null;
  payment_received_at: string | null;
  payment_sent_at: string | null;
  completed_at: string | null;

  // フラグ
  is_urgent_sw: boolean;
  sw_target_month: string | null;
  is_direct_operation: boolean;
  specs_ready_on_submit: boolean;

  // OCR
  ocr_status: "success" | "warning" | "error" | "pending";
  ocr_customer_number: string | null;
  ocr_confidence: number | null;

  // 3者比較
  compare_customer_name_result: string | null;
  compare_address_result: string | null;
  compare_supply_point_result: string | null;

  // メタ
  review_note: string | null;
  submitted_by: string | null;
  submitted_at: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

// ─── kanden_calendar ─────────────────────────────────────────────────────────
export interface KandenCalendar {
  id: number;
  fiscal_year: number;
  month_num: number;
  schedule_code: string;
  supply_date: string;  // YYYY-MM-DD
  note: string | null;
}

// ─── leaf_kanden_attachments ─────────────────────────────────────────────────
export type AttachmentCategory = "denki" | "douryoku" | "gas" | "shogen" | "ryosho";

export const ATTACHMENT_LABELS: Record<AttachmentCategory, string> = {
  denki:    "電灯",
  douryoku: "動力",
  gas:      "ガス",
  shogen:   "諸元",
  ryosho:   "受領書",
};

export interface KandenAttachment {
  attachment_id: string;
  case_id: string;
  category: AttachmentCategory;
  storage_url: string;
  thumbnail_url: string | null;
  is_guide_capture: boolean;
  is_post_added: boolean;
  ocr_processed: boolean;
  mime_type: string;
  archived_tier: "recent" | "monthly_pdf" | "yearly_pdf";
  uploaded_by: string | null;
  uploaded_at: string;
  archived_at: string | null;
  // v3 追加：論理削除（manager+ ガード撤廃、全員可能）+ 監査用
  deleted_at: string | null;
  deleted_by: string | null;
}

// ─── ステータス日付更新ペイロード ──────────────────────────────────────────────
export type StatusDateUpdate = Partial<
  Pick<
    KandenCase,
    | "status"
    | "ordered_at"
    | "specs_collected_at"
    | "entered_at"
    | "sent_at"
    | "invoiced_at"
    | "payment_received_at"
    | "payment_sent_at"
    | "completed_at"
  >
>;

// ─── ロール × 操作マトリクス（v3 新規） ─────────────────────────────────────────
/**
 * Garden 横断 8 段階ロール（Root A-3-g 定義 / CHECK 制約で実装）。
 * 順序は権限の階層を概念的に示すが、実装上は集合判定（IN）で扱う。
 */
export type GardenRole =
  | "toss"
  | "closer"
  | "cs"
  | "staff"
  | "outsource"
  | "manager"
  | "admin"
  | "super_admin";

/**
 * 削除関連の権限グループ（v3）。
 *
 * - DELETABLE_ROLES: 論理削除可能なロール一覧（v3 で全員可能化、後方互換のため定数として維持）
 * - ADMIN_ROLES: 物理削除 + 復元 + 事業マスタ書込 + DL PW 設定が可能なロール
 *
 * Client 側のロールガードでは `ADMIN_ROLES.includes(role)` を使う。
 * v3 では DELETABLE_ROLES の判定は Client コンポーネントで使われない（全員可能のため）が、
 * 将来のロール強化時に備えて定義として残す。
 */
export const DELETABLE_ROLES: readonly GardenRole[] = [
  "toss",
  "closer",
  "cs",
  "staff",
  "outsource",
  "manager",
  "admin",
  "super_admin",
] as const;

export const ADMIN_ROLES: readonly GardenRole[] = [
  "admin",
  "super_admin",
] as const;

/**
 * 与えられたロールが admin / super_admin か判定。
 * 物理削除 / 復元 / 事業マスタ書込み / DL PW 設定の表示制御で使用。
 */
export function isAdminRole(role: GardenRole | null): boolean {
  return role !== null && (ADMIN_ROLES as readonly string[]).includes(role);
}

// ─── 事業スコープ制御（v3 新規） ──────────────────────────────────────────────
/**
 * Leaf 配下の事業マスタ（関電 / コールセンター / ブレーカー 等）。
 * `business_id` は kebab-case の安定 ID（例: "kanden", "callcenter"）。
 */
export interface LeafBusiness {
  business_id: string;
  display_name: string;
  product_type: string | null;
  flow_type: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * ユーザー × 事業所属（複合 PK = (user_id, business_id)）。
 * `removed_at` が NULL or 未来日時なら所属中。
 * RLS では `leaf_user_in_business(biz_id)` 関数で AND `is_user_active()` を判定。
 */
export interface LeafUserBusiness {
  user_id: string;
  business_id: string;
  role_in_biz: string | null;
  assigned_at: string;
  assigned_by: string | null;
  removed_at: string | null;
}

// ─── 変更履歴記録（v3 新規、UI は Batch 14 別 spec） ───────────────────────────
/**
 * leaf_kanden_attachments の変更履歴レコード。
 *
 * BEFORE UPDATE / DELETE trigger で自動記録される（migration §13）:
 * - UPDATE: 変更列ごとに 1 行 (changed_field / old_value / new_value)
 * - DELETE: 1 行のみ (changed_field=NULL / old_value=削除前行の JSON)
 *
 * 書込みは trigger の SECURITY DEFINER 経由のみ（RLS で全 ALL 拒否）。
 * SELECT は事業所属者の自事業 + admin の事業横断。
 */
export interface AttachmentHistory {
  history_id: number;
  attachment_id: string;
  operation: "UPDATE" | "DELETE";
  changed_field: string | null;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  changed_at: string;
}

// ─── 画像 DL 専用パスワード（v3 新規） ──────────────────────────────────────────
/**
 * `root_settings.value` の構造（key='leaf.image_download_password_hash'）。
 *
 * - hash: bcrypt (rounds=12) でハッシュ化された PW
 * - 平文は保存しない、変更は super_admin のみ（set_image_download_password RPC）
 * - 検証は verify_image_download_password RPC で `crypt(input, stored_hash)` 比較
 */
export interface ImageDownloadPasswordSetting {
  hash: string;
}
