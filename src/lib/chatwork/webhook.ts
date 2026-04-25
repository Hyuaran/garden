/**
 * Chatwork Webhook の署名検証
 *
 * Chatwork は X-ChatWorkWebhookSignature ヘッダで HMAC-SHA256 (base64) を
 * 送信する。サーバ側で保持している webhook シークレットで計算し突合する。
 *
 * 仕様: https://developer.chatwork.com/reference/webhook
 *
 * 実装は Node の timingSafeEqual を使って比較し、タイミング攻撃を回避する。
 * Edge ランタイムは crypto.subtle 経由の実装が必要 → Node ランタイム固定。
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export const CHATWORK_SIGNATURE_HEADER = "x-chatworkwebhooksignature";

/**
 * Webhook の署名を検証する。
 *
 * @param rawBody   リクエストボディの生文字列（パースする前）
 * @param signature X-ChatWorkWebhookSignature ヘッダ値
 * @param secret    サーバ側で保持するシークレット
 * @returns         一致すれば true、不一致または入力不備で false
 */
export function verifyChatworkWebhook(
  rawBody: string,
  signature: string | null | undefined,
  secret: string | null | undefined,
): boolean {
  if (!signature || !secret) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest();
  let received: Buffer;
  try {
    received = Buffer.from(signature, "base64");
  } catch {
    return false;
  }
  if (expected.length !== received.length) return false;

  try {
    return timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}
