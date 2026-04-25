/**
 * Cron リクエスト認証（モジュール横断の共通ヘルパ）
 *
 * Vercel Cron は Route Handler 起動時に `Authorization: Bearer <CRON_SECRET>` を付与する。
 * CRON_SECRET は Vercel 環境変数で設定（production / preview 両方）。
 *
 * - 未設定時は常に拒否（本番設定漏れを早期検知）
 * - タイミング攻撃耐性のため `timingSafeEqual` で比較
 *
 * Bloom モジュール側にも同等実装 `src/app/api/bloom/cron/_lib/auth.ts` が存在。
 * 今後は本ファイルに集約する方針（Bloom 側の漸進的移行は別 PR）。
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
