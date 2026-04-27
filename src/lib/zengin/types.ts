/**
 * Garden-Bud / 全銀協 CSV ライブラリ — 型定義
 *
 * 全銀協フォーマット（総合振込データ）は 120 byte 固定長の半角 Shift-JIS。
 * 4 種類のレコード（ヘッダ/データ/トレーラ/エンド）で1ファイルを構成する。
 */

/** 対応銀行（京都銀行は枠のみ、実装なし） */
export type BankType = "rakuten" | "mizuho" | "paypay" | "kyoto";

/** 預金種目コード（全銀協仕様） */
export type AccountTypeCode = "1" | "2" | "4"; // 1=普通, 2=当座, 4=貯蓄

/** 振込データ（bud_transfers の抜粋、CSV 生成に必要な項目のみ） */
export interface ZenginTransferInput {
  /** 振込先金融機関コード（4桁数字） */
  payee_bank_code: string;
  /** 振込先支店コード（3桁数字） */
  payee_branch_code: string;
  /** 預金種目 */
  payee_account_type: AccountTypeCode;
  /** 口座番号（最大7桁数字） */
  payee_account_number: string;
  /** 受取人名（半角カタカナに変換前、漢字・ひらがな・全角カナ等） */
  payee_account_holder_kana: string;
  /** 振込金額（正の整数、円） */
  amount: number;
  /** EDI 情報（任意、半角20桁以内、description の冒頭を使用） */
  edi_info?: string;
  /** 顧客コード1（任意、10桁） */
  customer_code_1?: string;
  /** 顧客コード2（任意、10桁） */
  customer_code_2?: string;
}

/** 振込元口座情報（ヘッダレコードに入る情報） */
export interface ZenginSourceAccount {
  /** 依頼人コード（全銀協から付与される10桁、銀行により運用が異なる） */
  consignor_code: string;
  /** 依頼人名（半角カタカナ40桁以内） */
  consignor_name: string;
  /** 振込指定日（MMDD 形式、4桁） */
  transfer_date: string;
  /** 振込元金融機関コード（4桁） */
  source_bank_code: string;
  /** 振込元金融機関名（半角カタカナ15桁以内） */
  source_bank_name: string;
  /** 振込元支店コード（3桁） */
  source_branch_code: string;
  /** 振込元支店名（半角カタカナ15桁以内） */
  source_branch_name: string;
  /** 振込元預金種目 */
  source_account_type: AccountTypeCode;
  /** 振込元口座番号（7桁） */
  source_account_number: string;
}

/** CSV 生成オプション（銀行別差異吸収） */
export interface ZenginOptions {
  bank: BankType;
}

/** バリデーション結果 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/** CSV 生成結果 */
export interface GenerateResult {
  /** Shift-JIS エンコード済み Buffer */
  content: Buffer;
  /** 推奨ファイル名 */
  filename: string;
  /** レコード件数（データレコード数） */
  recordCount: number;
  /** 合計金額 */
  totalAmount: number;
}
