/**
 * Garden-Leaf 関電業務委託 — TypeScript 型定義
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
