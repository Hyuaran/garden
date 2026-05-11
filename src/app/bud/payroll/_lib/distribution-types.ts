/**
 * Garden-Bud / Phase D #04 給与明細配信 TypeScript 型定義
 *
 * 対応 spec: docs/specs/2026-04-25-bud-phase-d-04-statement-distribution.md
 * 対応 migration: supabase/migrations/20260508000001_bud_phase_d04_statement_distribution.sql
 *
 * Y 案 + フォールバック確定（2026-04-26）:
 *   - 通常: メール DL リンク（24h ワンタイム、PW なし PDF）+ LINE Bot 通知
 *   - 例外: メール DL リンク + PW 保護 PDF（強ランダム 16 文字）
 *
 * 4 次 follow-up Cat 4 #26 反映: 上田君「目視ダブルチェック」UI 要件は本 spec § 2.7 が正本リファレンス。
 */

// ============================================================
// 列挙型
// ============================================================

export const DELIVERY_METHODS = [
  "line_email", // 通常: メール DL リンク + LINE Bot
  "fallback_email_pw", // 例外: メール DL リンク + PW 保護 PDF
  "manual", // メアド未登録・admin 個別対応
] as const;
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number];

export const NOTIFICATION_OVERALL_STATUSES = [
  "pending",
  "sent",
  "failed",
  "pending_retry",
  "cancelled",
] as const;
export type NotificationOverallStatus = (typeof NOTIFICATION_OVERALL_STATUSES)[number];

export const EMAIL_STATUSES = [
  "sent",
  "failed",
  "opened",
  "downloaded",
  "bounced",
] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];

export const LINE_STATUSES = [
  "sent",
  "failed",
  "unsupported",
  "unfriend",
] as const;
export type LineStatus = (typeof LINE_STATUSES)[number];

export const LINE_FRIEND_STATUSES = ["friend", "unfriend", "unknown"] as const;
export type LineFriendStatus = (typeof LINE_FRIEND_STATUSES)[number];

export const PAYMENT_METHODS = ["bank_transfer", "cash", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const STATEMENT_TYPES = ["salary", "bonus"] as const;
export type StatementType = (typeof STATEMENT_TYPES)[number];

// ============================================================
// 配信通知レコード
// ============================================================

export interface BudPayrollNotification {
  id: string;
  salaryRecordId: string | null; // salaryRecordId と bonusRecordId は XOR
  bonusRecordId: string | null;
  employeeId: string;

  deliveryMethod: DeliveryMethod;

  overallStatus: NotificationOverallStatus;
  retryCount: number; // 0..4
  lastAttemptAt: string | null;
  nextRetryAt: string | null;

  emailStatus: EmailStatus | null;
  emailTo: string | null;
  emailProviderMessageId: string | null;
  emailSentAt: string | null;
  emailFailedReason: string | null;

  dlToken: string | null;
  dlTokenExpiresAt: string | null;
  dlUsedAt: string | null;
  dlIp: string | null;

  lineStatus: LineStatus | null;
  lineUserIdHash: string | null;
  lineMessageId: string | null;
  lineSentAt: string | null;
  lineFailedReason: string | null;

  fallbackPasswordHash: string | null;
  fallbackPasswordPlainTemp: Buffer | null;
  fallbackPasswordDisplayedAt: string | null;

  cashReceiptConfirmedAt: string | null;
  cashReceiptPaperSigned: boolean;

  createdAt: string;
  updatedAt: string;
}

// ============================================================
// 明細生成記録
// ============================================================

export interface BudSalaryStatement {
  id: string;
  salaryRecordId: string | null;
  bonusRecordId: string | null;
  employeeId: string;
  statementType: StatementType;
  storagePath: string;
  fileSizeBytes: number;
  pdfChecksum: string;
  generatedAt: string;
  generatedBy: string | null;
  notificationSentAt: string | null;
  notificationChatworkMessageId: string | null;
  downloadCount: number;
  lastDownloadedAt: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
}

// ============================================================
// 法令・運用定数
// ============================================================

/** メール DL リンクの有効期限（時間） */
export const PAYROLL_LINK_EXPIRY_HOURS = 24;

/** フォールバック PDF パスワードの長さ（文字数）*/
export const PAYROLL_PDF_PASSWORD_LENGTH = 16;

/** リトライ間隔（順序通り、ms 単位）: 1h / 6h / 24h、4 回目失敗で停止 */
export const RETRY_DELAYS_MS = [
  1 * 60 * 60 * 1000, // 1h
  6 * 60 * 60 * 1000, // 6h
  24 * 60 * 60 * 1000, // 24h
] as const;

/** 最大リトライ回数（4 回目失敗で停止 → admin Chatwork 通知）*/
export const MAX_RETRY_COUNT = 3;

/** PW 保護 PDF の文字種（ASCII printable、95 種、95^16 ≈ 4.4×10^31）*/
export const PASSWORD_CHARSET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%&()*+,-./:;<=>?@[]^_{|}~";

/** PW マスク表示までの時間（時間）*/
export const PW_DISPLAY_MASK_HOURS = 24;

// ============================================================
// 上田君「目視ダブルチェック」UI 要件（spec § 2.7 正本、Cat 4 #26）
// ============================================================
// D-04 が UI 要件の正本リファレンス。D-10 §6.3 / D-07 §4.1 から本セクションを参照。
// 本定数は UI 実装側が import して値を反映する想定。

/** 上田 UI 用 URL（一覧 + 個別 batch）*/
export const UEDA_VISUAL_CHECK_URLS = {
  list: "/bud/payroll/visual-check",
  detail: (batchId: string) => `/bud/payroll/visual-check/${batchId}`,
} as const;

/** 上田 UI 動作要件（時間制約 / 表示 / 操作権限）*/
export interface UedaVisualCheckUiRequirements {
  /** 自動 timeout（秒）。null = なし、急かす UI 禁止 */
  autoTimeoutSeconds: null;
  /** keep-alive 間隔（操作中の延長）*/
  keepAliveIntervalSeconds: number;
  /** 表示順 */
  displayOrder: "employee_number_asc";
  /** 1 行表示する内容（spec § 2.7 表）*/
  rowLayout: ReadonlyArray<
    | "employee_number"
    | "name_kana"
    | "name_kanji"
    | "bank_name_branch"
    | "account_type_number"
    | "amount_yen"
  >;
  /** 操作権限: 閲覧 + 各行チェックマーク + 全件 OK ボタンのみ */
  allowedActions: ReadonlyArray<"view" | "row_check" | "submit_ok" | "submit_ng">;
  /** 編集権限なし */
  editableFields: readonly never[];
  /** 配信・実行権限なし */
  canExecuteTransfer: false;
  /** 通知（Chatwork DM 不使用、Garden 内完結）*/
  notificationChannel: "garden_internal_only";
  /** バッジ表示: KPIHeader 通知センター */
  badgeLocation: "KPIHeader_notification_center";
}

export const UEDA_VISUAL_CHECK_UI_REQUIREMENTS: UedaVisualCheckUiRequirements = {
  autoTimeoutSeconds: null,
  keepAliveIntervalSeconds: 60,
  displayOrder: "employee_number_asc",
  rowLayout: [
    "employee_number",
    "name_kana",
    "name_kanji",
    "bank_name_branch",
    "account_type_number",
    "amount_yen",
  ],
  allowedActions: ["view", "row_check", "submit_ok", "submit_ng"],
  editableFields: [] as const,
  canExecuteTransfer: false,
  notificationChannel: "garden_internal_only",
  badgeLocation: "KPIHeader_notification_center",
};
