export type ParsePdfResult = {
  company_id: string | null;
  uriage: number | null;
  gaichuhi: number | null;
  rieki: number | null;
  period: string | null;
};

export type ShinkoukiUpdateInput = {
  uriage?: number | null;
  gaichuhi?: number | null;
  rieki?: number | null;
  reflected?: string;
  zantei?: boolean;
};

export type PeriodRolloverInput = {
  junshisan: number;
  genkin: number;
  yokin: number;
  doc_url: string;
};

/**
 * `forest_hankanhi` テーブル行型（販管費内訳 8 項目）。
 * 進行期（fiscal_period 未確定）に対応するため fiscal_period_id は null 許容。
 */
export type Hankanhi = {
  id: string;
  company_id: string;
  fiscal_period_id: string | null;
  ki: number;
  yakuin: number | null;
  kyuyo: number | null;
  settai: number | null;
  kaigi: number | null;
  ryohi: number | null;
  hanbai: number | null;
  chidai: number | null;
  shiharai: number | null;
  source: "manual" | "pdf" | "csv";
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/** DetailModal 等で map 用に使う 8 科目のキー集合。 */
export type HankanhiKey =
  | "yakuin"
  | "kyuyo"
  | "settai"
  | "kaigi"
  | "ryohi"
  | "hanbai"
  | "chidai"
  | "shiharai";

/** 表示順と和名ラベルの対応。v9 HANKANHI 定数の並びに準拠。 */
export const HANKANHI_LABELS: readonly { key: HankanhiKey; label: string }[] = [
  { key: "yakuin", label: "役員報酬" },
  { key: "kyuyo", label: "給与手当" },
  { key: "settai", label: "接待交際費" },
  { key: "kaigi", label: "会議費" },
  { key: "ryohi", label: "旅費交通費" },
  { key: "hanbai", label: "販売促進費" },
  { key: "chidai", label: "地代家賃" },
  { key: "shiharai", label: "支払報酬料" },
] as const;

/**
 * T-F2-01: Forest 全体の「最終更新日」情報。
 *
 * `fiscal_periods.updated_at` と `shinkouki.updated_at` の最大値を
 * まとめた結果。どちらが勝ったかは `source` で識別する。
 * 両テーブルが空の場合は `at = new Date(0)` のフォールバック。
 */
export type LastUpdatedAt = {
  /** どちらのテーブル側の updated_at が採用されたか */
  source: "fiscal_periods" | "shinkouki" | "both";
  /** 採用された updated_at（両テーブル空なら epoch 0） */
  at: Date;
};

/* =====================================================================
 * T-F4-02 / T-F11-01: Nouzei (納税カレンダー / 税詳細モーダル)
 *
 * P09 (docs/specs/2026-04-24-forest-nouzei-tables-design.md) で定義された
 * `forest_nouzei_schedules` / `forest_nouzei_items` / `forest_nouzei_files`
 * の TypeScript 写像。
 * ===================================================================== */

/** 納税種別。kakutei=確定 / yotei=予定 / extra=追加 */
export type NouzeiKind = "kakutei" | "yotei" | "extra";

/** 納付ステータス。pending=未納 / paid=納付済 / postponed=猶予 / deferred=延納 */
export type NouzeiStatus = "pending" | "paid" | "postponed" | "deferred";

/** 税目内訳行（forest_nouzei_items）。 */
export type NouzeiItem = {
  id: string;
  schedule_id: string;
  label: string;
  amount: number;
  sort_order: number;
  created_at: string;
};

/** 添付ファイル行（forest_nouzei_files）。 */
export type NouzeiFile = {
  id: string;
  schedule_id: string;
  doc_name: string;
  storage_path: string;
  uploaded_by: string | null;
  uploaded_at: string;
};

/** 納付スケジュール本体（forest_nouzei_schedules）。 */
export type NouzeiSchedule = {
  id: string;
  company_id: string;
  kind: NouzeiKind;
  /** '確定' / '予定' / '予定（消費税）' 等の自由文字列 */
  label: string;
  year: number;
  month: number;
  /** ISO 日付 'YYYY-MM-DD' */
  due_date: string;
  total_amount: number | null;
  status: NouzeiStatus;
  /** ISO timestamp、null=未納 */
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/** TaxCalendar 用：schedule + 内訳。 */
export type NouzeiScheduleWithItems = NouzeiSchedule & {
  items: NouzeiItem[];
};

/** TaxDetailModal 用：schedule + 内訳 + 添付。 */
export type NouzeiScheduleDetail = NouzeiSchedule & {
  items: NouzeiItem[];
  files: NouzeiFile[];
};

/** ステータスの日本語ラベル。 */
export const NOUZEI_STATUS_LABELS: Record<NouzeiStatus, string> = {
  pending: "未納",
  paid: "納付済",
  postponed: "猶予",
  deferred: "延納",
};
