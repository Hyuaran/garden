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
 * T-F5: 税理士連携ファイル（forest_tax_files テーブル + Storage）
 * ===================================================================== */

/** 税理士連携ファイルのステータス。zantei = 暫定 / kakutei = 確定。 */
export type TaxFileStatus = "zantei" | "kakutei";

/** `forest_tax_files` テーブル行型。 */
export type TaxFile = {
  id: string;
  company_id: string;
  /** 表示用ドキュメント名（例: '2024年度 確定申告書'） */
  doc_name: string;
  /** 元ファイル名（Storage パスとは別）*/
  file_name: string;
  /** Supabase Storage 内のパス（例: 'hyuaran/2024_kakutei_20260424.pdf'） */
  storage_path: string;
  status: TaxFileStatus;
  /** 書類基準日（年次=期末日 等）。連携日 (uploaded_at) とは別 */
  doc_date: string | null;
  /** Storage 連携日 */
  uploaded_at: string;
  /** uploaded_by: auth.users.id */
  uploaded_by: string | null;
  /** 備考（'※訂正版あり' 等） */
  note: string | null;
  mime_type: string;
  file_size_bytes: number;
  created_at: string;
  updated_at: string;
};
