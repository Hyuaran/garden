import "server-only";

import { ChatworkClient } from "@/lib/chatwork";
import { createRecord, getAllRecords, updateRecord, type KintoneRecord } from "@/lib/kintone/records";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { diffInnoveraKintone, stripHistoryUser } from "./diff";
import type { InnoveraCircuit, InnoveraDiffAction, InnoveraSyncDetail, InnoveraSyncLogRow, InnoveraSyncResult, KintoneInnoveraRecord } from "./types";

const DEFAULT_KINTONE_APP_ID = "189";
const DEFAULT_CHATWORK_ROOM_ID = "450125458";

const KINTONE_FIELDS = [
  "$id",
  "識別番号",
  "回線番号",
  "FD番号",
  "最終回線名称",
  "最終番号ステータス",
  "発番日",
  "廃止日",
  "ドロップダウン",
  "最終入力日時",
  "最終行番号",
  "テーブル",
] as const;

export type RunInnoveraSyncOptions = {
  apply: boolean;
  trigger: "cron" | "manual";
  actorEmployeeId?: string | null;
  includeLogs?: boolean;
  now?: Date;
};

function nowParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    today: `${values.year}-${values.month}-${values.day}`,
    minute: `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}`,
  };
}

function envConfig() {
  const host = process.env.INNOVERA_API_HOST;
  const apiKey = process.env.INNOVERA_API_KEY;
  const appId = process.env.KINTONE_INNOVERA_APP_ID || DEFAULT_KINTONE_APP_ID;
  const token = process.env.KINTONE_INNOVERA_TOKEN;
  const subdomain = process.env.KINTONE_SUBDOMAIN;
  if (!host || !apiKey || !appId || !token || !subdomain) return null;
  return { host, apiKey, appId, token };
}

function emptyResult(options: RunInnoveraSyncOptions, now: Date, error?: string): InnoveraSyncResult {
  return {
    ok: !error,
    error,
    applied: options.apply,
    trigger: options.trigger,
    ranAt: now.toISOString(),
    innoveraCount: null,
    kintoneCount: null,
    counts: { added: 0, renamed: 0, retired: 0, needsReview: 0, failed: 0 },
    actions: [],
    details: [],
  };
}

function countActions(actions: InnoveraDiffAction[], failed = 0) {
  return {
    added: actions.filter((action) => action.kind === "added").length,
    renamed: actions.filter((action) => action.kind === "renamed").length,
    retired: actions.filter((action) => action.kind === "retired").length,
    needsReview: actions.filter((action) => action.kind === "needs_review").length,
    failed,
  };
}

function detailFor(action: InnoveraDiffAction, result: InnoveraSyncDetail["result"], error?: string): InnoveraSyncDetail {
  return {
    kind: action.kind,
    circuitNum: action.circuitNum,
    lineNumber: action.lineNumber,
    fdNumber: action.fdNumber,
    issuedDate: action.issuedDate,
    previousName: action.previousName,
    nextName: action.nextName,
    previousLineNumber: action.previousLineNumber,
    reason: action.reason,
    result,
    error,
  };
}

async function fetchInnoveraCircuits(config: { host: string; apiKey: string }): Promise<InnoveraCircuit[]> {
  const response = await fetch(`https://${config.host}/pbx/api/front/index/?ckey=circuit&akey=search`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ api_key: config.apiKey }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("innovera_unreachable");
  const body = await response.json() as { result?: unknown; error_code?: unknown; data?: unknown };
  if (body.result !== true) throw new Error(`innovera_unreachable:${String(body.error_code ?? "")}`);
  if (!Array.isArray(body.data)) throw new Error("innovera_unreachable");
  return body.data as InnoveraCircuit[];
}

async function writeAction(config: { appId: string; token: string }, action: InnoveraDiffAction) {
  if (!action.writeRecord) return;
  if (action.kind === "added") {
    try {
      await createRecord(config.appId, config.token, action.writeRecord);
    } catch (error) {
      if (error instanceof Error && error.message === "kintone_400") {
        await createRecord(config.appId, config.token, stripHistoryUser(action.writeRecord));
        return;
      }
      throw error;
    }
    return;
  }

  if (!action.kintoneId) throw new Error("kintone_missing_record_id");
  try {
    await updateRecord(config.appId, config.token, action.kintoneId, action.writeRecord);
  } catch (error) {
    if (error instanceof Error && error.message === "kintone_400") {
      await updateRecord(config.appId, config.token, action.kintoneId, stripHistoryUser(action.writeRecord));
      return;
    }
    throw error;
  }
}

async function insertLog(result: InnoveraSyncResult, actorEmployeeId: string | null) {
  if (!result.applied) return;
  const shouldLog = result.trigger === "manual" || !result.ok || result.actions.length > 0 || result.counts.failed > 0;
  if (!shouldLog) return;
  await getSupabaseAdmin().from("system_innovera_sync_log").insert({
    trigger: result.trigger,
    applied: result.applied,
    ok: result.ok,
    innovera_count: result.innoveraCount,
    kintone_count: result.kintoneCount,
    added: result.counts.added,
    renamed: result.counts.renamed,
    retired: result.counts.retired,
    needs_review: result.counts.needsReview,
    failed: result.counts.failed,
    details: result.details,
    error: result.error ?? null,
    actor_employee_id: actorEmployeeId,
  });
}

export async function loadInnoveraSyncLogs(limit = 20): Promise<InnoveraSyncLogRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("system_innovera_sync_log")
    .select("*")
    .order("ran_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as InnoveraSyncLogRow[];
}

function failureMessage(error: string) {
  const primary = error.split(";")[0]?.trim() ?? error;
  if (primary === "not_configured") return "設定が終わっていません。管理者へ問い合わせてください";
  if (primary === "innovera_empty") return "INNOVERA から回線が 1 件も返りませんでした（安全のため何も書いていません）";
  if (primary.startsWith("innovera_")) return "INNOVERA に接続できませんでした";
  if (primary.startsWith("kintone_")) return "Kintone の読み書きに失敗しました";
  return "反映できませんでした";
}

function actionLine(action: InnoveraSyncDetail | InnoveraDiffAction) {
  if (action.kind === "added") return `新規：${action.circuitNum} ${action.lineNumber} ${action.fdNumber ?? ""}`.trim();
  if (action.kind === "renamed") return `名称変更：${action.circuitNum} ${action.previousName ?? ""} → ${action.nextName ?? ""}`;
  if (action.kind === "retired") return `廃止：${action.circuitNum} ${action.lineNumber} ${action.previousName ?? ""}`.trim();
  const reason = action.reason === "restored_deleted" ? "削除済みの番号が戻っています" : "回線番号が Kintone と違います";
  return `要確認：${action.circuitNum} ${action.lineNumber} ${reason}`;
}

function appendLimitedLines(lines: string[], label: string, items: Array<InnoveraSyncDetail | InnoveraDiffAction>) {
  const shown = items.slice(0, 10);
  for (const item of shown) lines.push(actionLine(item));
  if (items.length > shown.length) lines.push(`${label}：ほか ${items.length - shown.length} 件`);
}

export function buildInnoveraChatworkBody(result: InnoveraSyncResult, now = new Date()) {
  const { minute } = nowParts(now);
  const triggerLabel = result.trigger === "cron" ? "自動" : "手動";
  const lines = [
    `[info][title]INNOVERA番号の同期（INNOVERA → Kintone）[/title]${minute} ${triggerLabel}`,
  ];
  if (!result.ok && result.error) lines.push(`反映できませんでした：${failureMessage(result.error)}`);
  lines.push(`新規 ${result.counts.added}件・名称変更 ${result.counts.renamed}件・廃止 ${result.counts.retired}件・要確認 ${result.counts.needsReview}件`);
  lines.push("");

  const source = result.details.length ? result.details : result.actions;
  appendLimitedLines(lines, "新規", source.filter((item) => item.kind === "added"));
  appendLimitedLines(lines, "名称変更", source.filter((item) => item.kind === "renamed"));
  appendLimitedLines(lines, "廃止", source.filter((item) => item.kind === "retired"));
  appendLimitedLines(lines, "要確認", source.filter((item) => item.kind === "needs_review"));
  lines.push("");
  lines.push("確認：https://garden-os.net/system/innovera[/info]");
  return lines.join("\n");
}

async function notifyIfNeeded(result: InnoveraSyncResult, now: Date) {
  const wrote = result.details.some((detail) => detail.result === "created" || detail.result === "updated");
  if (!wrote && result.ok && result.counts.failed === 0) return result;
  const token = process.env.CHATWORK_API_TOKEN;
  if (!token) return { ...result, error: result.error ? `${result.error}; chatwork_not_configured` : "chatwork_not_configured" };
  try {
    await new ChatworkClient(token).sendMessage(process.env.GARDEN_NOTICE_CHATWORK_ROOM_ID || DEFAULT_CHATWORK_ROOM_ID, buildInnoveraChatworkBody(result, now));
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ...result, error: result.error ? `${result.error}; ${message}` : message };
  }
}

export async function runInnoveraSync(options: RunInnoveraSyncOptions): Promise<InnoveraSyncResult> {
  const now = options.now ?? new Date();
  const { today } = nowParts(now);
  const config = envConfig();
  if (!config) {
    const result = await notifyIfNeeded(emptyResult(options, now, "not_configured"), now);
    await insertLog(result, options.actorEmployeeId ?? null).catch(() => undefined);
    return result;
  }

  let circuits: InnoveraCircuit[];
  let records: KintoneInnoveraRecord[];
  try {
    circuits = await fetchInnoveraCircuits(config);
    if (circuits.length === 0) throw new Error("innovera_empty");
  } catch (error) {
    const code = error instanceof Error && error.message === "innovera_empty" ? "innovera_empty" : "innovera_unreachable";
    const result = await notifyIfNeeded({ ...emptyResult(options, now, code), innoveraCount: code === "innovera_empty" ? 0 : null }, now);
    await insertLog(result, options.actorEmployeeId ?? null).catch(() => undefined);
    return result;
  }

  try {
    records = await getAllRecords<KintoneInnoveraRecord>(config.appId, config.token, "", KINTONE_FIELDS);
  } catch {
    const result = await notifyIfNeeded({ ...emptyResult(options, now, "kintone_read_failed"), innoveraCount: circuits.length }, now);
    await insertLog(result, options.actorEmployeeId ?? null).catch(() => undefined);
    return result;
  }

  const actions = diffInnoveraKintone(circuits, records, { nowIso: now.toISOString(), today });
  const details: InnoveraSyncDetail[] = [];
  let failed = 0;
  if (options.apply) {
    for (const action of actions) {
      if (action.kind === "needs_review") {
        details.push(detailFor(action, "skipped"));
        continue;
      }
      try {
        await writeAction(config, action);
        details.push(detailFor(action, action.kind === "added" ? "created" : "updated"));
      } catch (error) {
        failed += 1;
        details.push(detailFor(action, "failed", error instanceof Error ? error.message : String(error)));
      }
    }
  } else {
    details.push(...actions.map((action) => detailFor(action, action.kind === "needs_review" ? "skipped" : "pending")));
  }

  let result: InnoveraSyncResult = {
    ok: failed === 0,
    error: failed > 0 ? "kintone_write_failed" : undefined,
    applied: options.apply,
    trigger: options.trigger,
    ranAt: now.toISOString(),
    innoveraCount: circuits.length,
    kintoneCount: records.length,
    counts: countActions(actions, failed),
    actions,
    details,
  };

  result = await notifyIfNeeded(result, now);
  await insertLog(result, options.actorEmployeeId ?? null).catch(() => undefined);
  if (options.includeLogs) {
    result.latestLogs = await loadInnoveraSyncLogs().catch(() => []);
  }
  return result;
}
