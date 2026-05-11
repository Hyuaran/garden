/**
 * Garden-Bud / Phase D #04 給与明細配信 純関数
 *
 * 対応 spec: docs/specs/2026-04-25-bud-phase-d-04-statement-distribution.md
 *
 * 純関数のみ。Server Action / Cron からは crypto / DB アクセス済の入力を渡して呼ぶ。
 *
 * 範囲:
 *   - delivery_method 判定（LINE 友だち + メアド有無 + payment_method）
 *   - DL リンクトークン生成（crypto.randomBytes + base64url）
 *   - 強ランダム PW 生成（PASSWORD_CHARSET 95 種から 16 文字）
 *   - 24h 期限判定
 *   - リトライ間隔判定（1h / 6h / 24h / null）
 *   - LINE 失敗時の自動フォールバック格上げ
 *   - 上田 UI 要件バリデーション
 *
 * 暗号学的安全性:
 *   - generateOneTimeToken / generateStrongPassword は crypto.randomBytes を使用
 *   - Math.random() は使わない（暗号学的に安全でないため）
 *   - PW は 95^16 ≈ 4.4×10^31 候補空間
 */

import { randomBytes } from "node:crypto";
import {
  type DeliveryMethod,
  type LineFriendStatus,
  type LineStatus,
  type PaymentMethod,
  PAYROLL_LINK_EXPIRY_HOURS,
  PAYROLL_PDF_PASSWORD_LENGTH,
  RETRY_DELAYS_MS,
  MAX_RETRY_COUNT,
  PASSWORD_CHARSET,
} from "./distribution-types";

// ============================================================
// 1. delivery_method 判定（spec §6.3）
// ============================================================

export interface DeliveryMethodInput {
  lineFriendStatus: LineFriendStatus;
  emailRegistered: boolean;
  paymentMethod: PaymentMethod;
}

/**
 * 配信方式を決定:
 *   - メアド未登録 → 'manual'（admin 個別対応）
 *   - LINE 友だち → 'line_email'（通常フロー）
 *   - その他（unfriend / unknown）→ 'fallback_email_pw'（例外フロー）
 *
 * Note: paymentMethod は配信方式の決定には影響しない（給与計算は形態によらず実行、
 *       配信先のみ payment_method 別に分岐 — 詳細は D-07 §1.4）。
 *       本関数では引数に含めるが、判定ロジック内では使用しない（将来の拡張用）。
 */
export function decideDeliveryMethod(input: DeliveryMethodInput): DeliveryMethod {
  if (!input.emailRegistered) return "manual";
  if (input.lineFriendStatus === "friend") return "line_email";
  return "fallback_email_pw";
}

// ============================================================
// 2. ワンタイム DL トークン生成（24h 有効）
// ============================================================

/**
 * URL-safe な 32 byte ランダムトークンを生成（base64url、43 文字相当）。
 * - crypto.randomBytes 暗号学的に安全
 * - base64url（パディング無し）= URL に直接埋め込み可能
 *
 * @returns base64url エンコード済みのトークン文字列
 */
export function generateOneTimeToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * DL トークンの有効期限を計算（now + PAYROLL_LINK_EXPIRY_HOURS）。
 *
 * @param now 現在時刻（テスト時に注入可能、デフォルト: new Date()）
 * @returns ISO 8601 形式の文字列
 */
export function calculateTokenExpiry(now: Date = new Date()): string {
  const expiry = new Date(now.getTime() + PAYROLL_LINK_EXPIRY_HOURS * 60 * 60 * 1000);
  return expiry.toISOString();
}

/**
 * DL トークンが期限切れか判定。
 */
export function isTokenExpired(
  expiresAt: string,
  now: Date = new Date(),
): boolean {
  return new Date(expiresAt).getTime() < now.getTime();
}

// ============================================================
// 3. 強ランダム PW 生成（フォールバック例外フロー）
// ============================================================

/**
 * ASCII printable から強ランダム PW を生成（デフォルト 16 文字）。
 *
 * 候補空間: 95^16 ≈ 4.4×10^31（ブルートフォース実質不可能）
 * crypto.randomBytes ベースで偏りなし。
 *
 * @param length PW 長（spec § 6.7.1: PAYROLL_PDF_PASSWORD_LENGTH=16）
 * @returns 生成された平文 PW（呼び出し側で bcrypt ハッシュ化 + 短期メモリで使用）
 */
export function generateStrongPassword(
  length: number = PAYROLL_PDF_PASSWORD_LENGTH,
): string {
  if (length < 8) {
    throw new Error(
      `Password length must be >= 8 (got: ${length}, recommended: ${PAYROLL_PDF_PASSWORD_LENGTH})`,
    );
  }
  const chars = PASSWORD_CHARSET;
  const charsLen = chars.length;

  // crypto.randomBytes で十分な量を取得して modulo bias を最小化
  // バイト数 = length × 2（rejection sampling 不要レベル、charsLen=95 なので bias ~= 0）
  const bytes = randomBytes(length * 2);
  let result = "";
  for (let i = 0; i < length; i++) {
    // 256 % 95 = 66、modulo bias 約 0.7%（許容範囲、十分強い）
    result += chars.charAt(bytes[i] % charsLen);
  }
  return result;
}

/**
 * PW 強度の最低条件を検証（生成された PW を二次チェック用）:
 *   - 長さ >= 8
 *   - PASSWORD_CHARSET 内の文字のみ
 */
export function isPasswordStrong(pw: string): boolean {
  if (pw.length < 8) return false;
  for (const c of pw) {
    if (!PASSWORD_CHARSET.includes(c)) return false;
  }
  return true;
}

// ============================================================
// 4. リトライ間隔判定（spec §6.6）
// ============================================================

/**
 * 配信失敗時のリトライ間隔を返す（ms）。
 *
 * | retryCount | 次回 |
 * |---|---|
 * | 0 (1 回目失敗後) | 1h |
 * | 1 (2 回目失敗後) | 6h |
 * | 2 (3 回目失敗後) | 24h |
 * | 3 (4 回目失敗後) | null（停止 → admin 通知）|
 *
 * @returns 次回リトライまでの ms、最大回数到達時は null
 */
export function decideRetryDelay(retryCount: number): number | null {
  if (retryCount < 0) return null;
  if (retryCount >= MAX_RETRY_COUNT) return null;
  return RETRY_DELAYS_MS[retryCount] ?? null;
}

/**
 * 次回リトライ時刻を計算（now + delay）。
 *
 * @returns ISO 8601 形式、最大回数到達時は null
 */
export function calculateNextRetryAt(
  retryCount: number,
  now: Date = new Date(),
): string | null {
  const delay = decideRetryDelay(retryCount);
  if (delay === null) return null;
  return new Date(now.getTime() + delay).toISOString();
}

/**
 * 最大リトライ到達時の admin 通知が必要か判定。
 */
export function shouldNotifyAdminOnFailure(retryCount: number): boolean {
  return retryCount >= MAX_RETRY_COUNT;
}

// ============================================================
// 5. LINE 失敗時の自動フォールバック格上げ判定
// ============================================================

/**
 * 現在の delivery_method と LINE 配信結果から、自動フォールバック格上げが必要か判定。
 *
 * spec §6.6: LINE 失敗 → delivery_method を line_email → fallback_email_pw に自動格上げ
 *
 * @returns 格上げ後の delivery_method（不要なら現在の値）
 */
export function decideFallbackUpgrade(
  currentMethod: DeliveryMethod,
  lineStatus: LineStatus | null,
): DeliveryMethod {
  // line_email 経路で LINE が unfriend / failed → fallback_email_pw に格上げ
  if (
    currentMethod === "line_email" &&
    (lineStatus === "unfriend" || lineStatus === "failed")
  ) {
    return "fallback_email_pw";
  }
  return currentMethod;
}

// ============================================================
// 6. ワンタイム消費判定
// ============================================================

/**
 * DL トークンが使用可能か（未使用かつ期限内）。
 */
export function isTokenUsable(
  dlUsedAt: string | null,
  dlTokenExpiresAt: string | null,
  now: Date = new Date(),
): { usable: boolean; reason: "OK" | "USED" | "EXPIRED" | "NO_TOKEN" } {
  if (!dlTokenExpiresAt) return { usable: false, reason: "NO_TOKEN" };
  if (dlUsedAt !== null) return { usable: false, reason: "USED" };
  if (isTokenExpired(dlTokenExpiresAt, now)) return { usable: false, reason: "EXPIRED" };
  return { usable: true, reason: "OK" };
}

// ============================================================
// 7. 上田 UI 要件バリデーション（spec § 2.7、Cat 4 #26）
// ============================================================

export interface UedaUiActionInput {
  /** 試みている操作 */
  action: string;
  /** 編集対象フィールド名（編集系操作の場合）*/
  editingField?: string | null;
  /** 振込実行フラグ（実行系操作の場合）*/
  triggersTransfer?: boolean;
}

export interface UedaUiValidationResult {
  allowed: boolean;
  reason: string | null;
}

/**
 * 上田 UI（payroll_visual_checker）の操作可否を検証。
 *
 * spec § 2.7 操作権限:
 *   - 閲覧 ('view')
 *   - 各行の目視チェックマーク ('row_check')
 *   - 全件 OK 後に「確認 OK」ボタン ('submit_ok')
 *   - NG 戻し ('submit_ng')
 *
 * 編集権限なし、配信・実行権限なし。違反時は reason 文字列を返す。
 */
export function validateUedaUiAction(input: UedaUiActionInput): UedaUiValidationResult {
  const allowedActions = ["view", "row_check", "submit_ok", "submit_ng"];

  // 編集試行は禁止
  if (input.editingField) {
    return {
      allowed: false,
      reason: `上田 UI は編集権限なし（試行フィールド: "${input.editingField}"）。spec § 2.7 準拠、編集は東海林さん再判断 → 計算者へ再修正依頼。`,
    };
  }

  // 振込実行系は禁止
  if (input.triggersTransfer) {
    return {
      allowed: false,
      reason: "上田 UI は振込実行権限なし。振込実行は東海林さん（payroll_auditor）専任。",
    };
  }

  // 許可された action のみ
  if (!allowedActions.includes(input.action)) {
    return {
      allowed: false,
      reason: `上田 UI で許可されていない action: "${input.action}"。許可: ${allowedActions.join(", ")}`,
    };
  }

  return { allowed: true, reason: null };
}

// ============================================================
// 8. PW 表示マスク判定（フォールバック時、spec § 6.7.2）
// ============================================================

/**
 * フォールバック時の PW がマスク対象か判定。
 *
 * spec § 6.7.2: マイページ表示後 24h で自動マスク。
 *
 * @param displayedAt PW を初めて表示した時刻（ISO 8601）、null = 未表示
 */
export function shouldMaskFallbackPassword(
  displayedAt: string | null,
  now: Date = new Date(),
): boolean {
  if (displayedAt === null) return false; // 未表示なら表示可
  const elapsedHours =
    (now.getTime() - new Date(displayedAt).getTime()) / (60 * 60 * 1000);
  return elapsedHours >= 24;
}
