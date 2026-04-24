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
