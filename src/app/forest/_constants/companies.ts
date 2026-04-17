/**
 * Garden Forest — Supabase 行型定義
 *
 * Supabase の各テーブル行に対応する TypeScript 型と、
 * フロントエンドで使用する表示用セル型 CellData を定義する。
 * 型は supabase-js の型推論とも互換性がある形式で記述。
 */

/** companies テーブルの行型（法人マスタ） */
export type Company = {
  id: string;
  name: string;
  short: string;
  kessan: string;
  color: string;
  light: string;
  sort_order: number;
};

/** fiscal_periods テーブルの行型（確定決算期） */
export type FiscalPeriod = {
  id: number;
  company_id: string;
  ki: number;
  yr: number;
  period_from: string;
  period_to: string;
  uriage: number | null;
  gaichuhi: number | null;
  rieki: number | null;
  junshisan: number | null;
  genkin: number | null;
  yokin: number | null;
  doc_url: string | null;
};

/** shinkouki テーブルの行型（進行期） */
export type Shinkouki = {
  company_id: string;
  ki: number;
  yr: number;
  label: string;
  range: string;
  reflected: string;
  zantei: boolean;
  uriage: number | null;
  gaichuhi: number | null;
  rieki: number | null;
};

/** forest_users テーブルの行型（Forest アクセス権） */
export type ForestUser = {
  user_id: string;
  /** 社員番号（4桁ゼロパディング）。ログインUIのプレフィル用。 */
  employee_number: string | null;
  role: "admin" | "viewer";
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
};

/**
 * 表示用セルデータ型
 *
 * 確定決算期・進行期の両方を統一して扱うための結合型。
 * isShinkouki フラグで進行期か確定期かを判定する。
 */
export type CellData = {
  company: Company;
  ki: number;
  yr: number;
  period_from: string;
  period_to: string;
  uriage: number | null;
  gaichuhi: number | null;
  rieki: number | null;
  junshisan: number | null;
  genkin: number | null;
  yokin: number | null;
  doc_url: string | null;
  /** true = 進行期（暫定）, false = 確定決算期 */
  isShinkouki: boolean;
  /** 進行期のみ: 反映済み期間テキスト（例: "4月〜6月"） */
  reflected: string | null;
  /** 進行期のみ: 暫定フラグ */
  zantei: boolean;
};
