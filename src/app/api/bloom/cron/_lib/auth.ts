/**
 * Cron リクエスト認証
 *
 * Vercel Cron は実行時に Authorization: Bearer <CRON_SECRET> を付与する
 * （プロジェクトの環境変数 CRON_SECRET を設定した場合）。
 *
 * 外部からの誤呼出しを防ぐため、Route Handler はこのヘルパで検証する。
 * CRON_SECRET 未設定なら常に拒否（本番設定漏れ検知）。
 */

import { timingSafeEqual } from "node:crypto";

const BEARER_PREFIX = "Bearer ";

export type CronAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 500; reason: string };

export function verifyCronRequest(request: Request): CronAuthResult {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return { ok: false, status: 500, reason: "CRON_SECRET is not configured" };
  }

  const header = request.headers.get("authorization");
  if (!header || !header.startsWith(BEARER_PREFIX)) {
    return { ok: false, status: 401, reason: "Missing Bearer token" };
  }

  const provided = header.slice(BEARER_PREFIX.length);
  const expectedBuf = Buffer.from(secret);
  const providedBuf = Buffer.from(provided);

  if (expectedBuf.length !== providedBuf.length) {
    return { ok: false, status: 401, reason: "Invalid token length" };
  }
  try {
    if (!timingSafeEqual(expectedBuf, providedBuf)) {
      return { ok: false, status: 401, reason: "Invalid token" };
    }
  } catch {
    return { ok: false, status: 401, reason: "Token comparison failed" };
  }

  return { ok: true };
}
