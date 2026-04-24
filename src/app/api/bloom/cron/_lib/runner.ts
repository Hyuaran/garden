/**
 * Cron 実行の共通ラッパー
 *
 * 流れ:
 *   1. verifyCronRequest で認可チェック
 *   2. Chatwork シークレット解決（env）
 *   3. ビルダー関数を呼び、送信予定メッセージを受け取る
 *   4. bloom_cron_log に pending / skipped で INSERT
 *   5. dry_run=false のときのみ Chatwork API へ POST
 *   6. ログを success / failure で UPDATE
 *
 * 呼び出し例 (daily/route.ts):
 *   export const runtime = "nodejs";
 *   export async function GET(request: Request) {
 *     return runCron({ kind: "daily", request, build: buildDailyMessage });
 *   }
 */

import { ChatworkClient } from "../../../../../lib/chatwork/client";
import { readSecretsFromEnv, type ChatworkSecrets } from "../../../../../lib/chatwork/secrets";
import type { ChatworkNotificationKind } from "../../../../../lib/chatwork/types";
import { verifyCronRequest } from "./auth";
import {
  finishCronLogFailure,
  finishCronLogSuccess,
  startCronLog,
} from "./log";

export type CronBuildResult = {
  /** Chatwork 本文（必須） */
  body: string;
  /** 送信先ルーム ID（省略時 secrets.roomIdProgress を使用） */
  roomId?: string;
};

export type CronBuildContext = {
  now: Date;
  secrets: ChatworkSecrets;
};

export type CronBuilder = (ctx: CronBuildContext) => Promise<CronBuildResult>;

export type RunCronInput = {
  kind: ChatworkNotificationKind;
  request: Request;
  build: CronBuilder;
};

export async function runCron(input: RunCronInput): Promise<Response> {
  // 1. 認可
  const auth = verifyCronRequest(input.request);
  if (!auth.ok) {
    return jsonError(auth.status, auth.reason);
  }

  // 2. シークレット
  let secrets: ChatworkSecrets;
  try {
    secrets = readSecretsFromEnv();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[bloom/cron] secrets load failed:", msg);
    return jsonError(500, `Secrets load failed: ${msg}`);
  }

  // 3. メッセージ生成
  let built: CronBuildResult;
  try {
    built = await input.build({ now: new Date(), secrets });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[bloom/cron] build failed:", msg);
    return jsonError(500, `Build failed: ${msg}`);
  }

  const roomId = built.roomId ?? secrets.roomIdProgress;

  // 4. ログ（送信前スナップショット）
  const log = await startCronLog({
    cron_kind: input.kind,
    dry_run: secrets.dryRun,
    room_id: roomId,
    message_snapshot: built.body,
  });

  // 5-6. Chatwork 送信 + 結果更新
  const client = new ChatworkClient(secrets.apiToken, { dryRun: secrets.dryRun });

  try {
    const response = await client.sendMessage(roomId, built.body);

    if (log.id && !secrets.dryRun) {
      await finishCronLogSuccess({ id: log.id, chatwork_response: response });
    }

    return Response.json({
      ok: true,
      kind: input.kind,
      dry_run: secrets.dryRun,
      room_id: roomId,
      log_id: log.id,
      response,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[bloom/cron] ${input.kind} send failed:`, msg);

    if (log.id) {
      await finishCronLogFailure({ id: log.id, error_detail: msg });
    }

    return jsonError(502, `Chatwork send failed: ${msg}`, {
      kind: input.kind,
      log_id: log.id,
    });
  }
}

function jsonError(status: number, reason: string, extra: Record<string, unknown> = {}) {
  return Response.json({ ok: false, error: reason, ...extra }, { status });
}
