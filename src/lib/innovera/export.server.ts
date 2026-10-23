import type { SupabaseClient } from "@supabase/supabase-js";

import type { InnoveraCallRaw } from "@/lib/innovera/client";
import { parseInnoveraJst } from "@/lib/innovera/ingest";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

// WEBインバウンド事業（ヒカリのプロ・電気開始受付センター・フレッツ光）の夜間処理に、Garden が写した INNOVERA の通話履歴を渡す（読むだけ）。
//   夜間処理は Vercel から INNOVERA へ直接つなぐと途切れる（2026-10-16〜）ため、ホスト PC 中継で写した system_innovera_call を読む。
//   返す行は INNOVERA の検索の返事 1 件そのまま（raw）。期間の書き方も INNOVERA の検索と同じ（JST の "YYYY-MM-DD HH:MM:SS"・両端を含む）
export const EXPORT_MAX_CIRCUITS = 20;
export const EXPORT_MAX_DAYS = 31;
const PAGE_SIZE = 1000;

/**
 * この入口で渡してよい回線（WEBインバウンド事業の回線だけ。ほかの事業の通話は渡さない）。
 *   許可外の回線の指定は 400 で断る。回線を足すときはここに足す（hikari-pro-lp は kintone 239 の回線表の回線を渡してくるので、239 に足したらこちらも）
 *   2026-10-23 の 239：ヒカリのプロ 164・165／電気開始受付センター 166・133／フレッツ光 186・185（準備中。稼働中にした晩に断らないよう先に許可）
 */
export const EXPORT_ALLOWED_CIRCUITS: readonly number[] = [133, 164, 165, 166, 185, 186];

export type InnoveraExportParams = { circuits: number[]; from: string; to: string };

export type InnoveraExportResult = {
  rows: InnoveraCallRaw[];
  /** 取り込み（5 分ごと・深夜の読み返し）が最後に成功したときの読み終わりの時刻。これより後の通話はまだ写っていない */
  covered_until: string | null;
  last_success_at: string | null;
};

/** 回線は数（正の整数）か、数字だけの文字列だけを受ける（true・"164.0"・" 164"・"1e2" などは断る） */
function parseCircuitId(value: unknown): number | null {
  if (typeof value === "number") return Number.isSafeInteger(value) && value > 0 ? value : null;
  if (typeof value === "string" && /^\d{1,9}$/.test(value)) {
    const id = Number(value);
    return id > 0 ? id : null;
  }
  return null;
}

function assertAllowedCircuits(circuits: number[]) {
  const denied = circuits.filter((id) => !EXPORT_ALLOWED_CIRCUITS.includes(id));
  if (denied.length > 0) throw new Error(`circuits not allowed: ${denied.join(", ")}`);
}

/** JST の "YYYY-MM-DD HH:MM:SS" を、実在する日時のときだけ UTC の ISO にする（2026-02-30 や 25:61:61 を繰り上げて読まない） */
function parseExistingJst(value: string): string | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [y, mo, d, h, mi, s] = match.slice(1).map(Number);
  const asUtc = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  const exists = asUtc.getUTCFullYear() === y
    && asUtc.getUTCMonth() === mo - 1
    && asUtc.getUTCDate() === d
    && asUtc.getUTCHours() === h
    && asUtc.getUTCMinutes() === mi
    && asUtc.getUTCSeconds() === s;
  return exists ? parseInnoveraJst(value) : null;
}

export function parseExportParams(body: unknown): InnoveraExportParams {
  if (!body || typeof body !== "object") throw new Error("body must be an object");
  const { circuits, from, to } = body as { circuits?: unknown; from?: unknown; to?: unknown };
  if (!Array.isArray(circuits) || circuits.length === 0) throw new Error("circuits must be a non-empty array");
  if (circuits.length > EXPORT_MAX_CIRCUITS) throw new Error(`circuits must contain at most ${EXPORT_MAX_CIRCUITS} items`);
  const parsed = circuits.map(parseCircuitId);
  if (parsed.some((id) => id === null)) throw new Error("circuits must be positive integers or digit strings");
  const ids = [...new Set(parsed as number[])];
  assertAllowedCircuits(ids);
  if (typeof from !== "string" || typeof to !== "string") throw new Error("from and to are required");
  const fromIso = parseExistingJst(from);
  const toIso = parseExistingJst(to);
  if (!fromIso || !toIso) throw new Error('from and to must be existing "YYYY-MM-DD HH:MM:SS" (JST)');
  const span = new Date(toIso).getTime() - new Date(fromIso).getTime();
  if (span < 0) throw new Error("from must not be after to");
  if (span > EXPORT_MAX_DAYS * 24 * 60 * 60 * 1000) throw new Error(`range must be at most ${EXPORT_MAX_DAYS} days`);
  return { circuits: ids, from, to };
}

export async function exportInnoveraCalls(
  params: InnoveraExportParams,
  supabase: SupabaseClient = getSupabaseAdmin(),
): Promise<InnoveraExportResult> {
  assertAllowedCircuits(params.circuits);
  const fromIso = parseExistingJst(params.from);
  const toIso = parseExistingJst(params.to);
  if (!fromIso || !toIso) throw new Error("invalid range");

  // 取り込みの「どこまで写っているか」は、行より先に読む。行を読んでいる間に取り込みが成功しても、
  //   返す covered_until は読む前に写し終わっていた所までになり、返した行に無い通話を「写っている」と言わない。
  //   見るのは 5 分ごと（poll）と深夜の読み返し（daily）の成功だけ（getCronRange と同じ。backfill は過去を読むだけ）
  const { data: log, error: logError } = await supabase
    .from("system_innovera_ingest_log")
    .select("range_to, finished_at")
    .eq("status", "success")
    .in("mode", ["poll", "daily"])
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ range_to: string | null; finished_at: string | null }>();
  if (logError) throw new Error(`system_innovera_ingest_log select failed: ${logError.message}`);

  // 並びは開始時刻→INNOVERA の id（主キー＝重ならない）。並びが決まらないと、1000 件ずつ読む境目で重なり・抜けが出る。
  //   読んでいる間の取り込みで足された行は重なり（同じ行が 2 回）にはなりうるが、抜けにはならない。
  //   抜けるのは既にある行の start_time・circuit_id が変わるときだけで、どちらも INNOVERA の通話 1 件で決まっていて読み返しでも同じ値が入る
  const rows: InnoveraCallRaw[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("system_innovera_call")
      .select("raw")
      .in("circuit_id", params.circuits)
      .gte("start_time", fromIso)
      .lte("start_time", toIso)
      .order("start_time", { ascending: true })
      .order("innovera_id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`system_innovera_call select failed: ${error.message}`);
    const page = (data ?? []) as { raw: InnoveraCallRaw | null }[];
    for (const row of page) if (row.raw) rows.push(row.raw);
    if (page.length < PAGE_SIZE) break;
  }

  return { rows, covered_until: log?.range_to ?? null, last_success_at: log?.finished_at ?? null };
}
