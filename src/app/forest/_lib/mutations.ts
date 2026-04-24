/**
 * Forest データ更新ミューテーション
 *
 * - updateShinkouki: 進行期の数値更新（admin 限定、RLS で enforced）
 * - rolloverPeriod: 期切り替え（shinkouki → fiscal_periods 昇格）
 *
 * トランザクションは RPC で実装するのが理想だが、現段階では逐次実行。
 * 失敗時は呼び出し元に例外を投げる。
 */
import type {
  PeriodRolloverInput,
  ShinkoukiUpdateInput,
} from "./types";
import { writeAuditLog } from "./audit";
import { fetchShinkouki } from "./queries";
import { supabase } from "./supabase";

/**
 * shinkouki テーブルを company_id で UPDATE する。
 */
export async function updateShinkouki(
  companyId: string,
  payload: ShinkoukiUpdateInput
): Promise<void> {
  const { error } = await supabase
    .from("shinkouki")
    .update(payload)
    .eq("company_id", companyId);

  if (error) {
    throw new Error(`updateShinkouki(${companyId}) failed: ${error.message}`);
  }

  await writeAuditLog("update_shinkouki", companyId);
}

/**
 * shinkouki.range (例: "2025/4~2026/3") を period_from/period_to の
 * ISO 日付に変換する。
 *
 * @returns [period_from, period_to] 例: ["2025-04-01", "2026-03-31"]
 */
function parseRange(range: string): [string, string] {
  const match = range.match(/^(\d{4})\/(\d{1,2})~(\d{4})\/(\d{1,2})$/);
  if (!match) {
    throw new Error(`parseRange: invalid format "${range}" (expected "YYYY/M~YYYY/M")`);
  }
  const [, fromY, fromM, toY, toM] = match;
  const fromMonth = parseInt(fromM, 10);
  const toMonth = parseInt(toM, 10);

  const fromDate = `${fromY}-${String(fromMonth).padStart(2, "0")}-01`;
  // 月末日を計算: 翌月1日 - 1日
  const nextMonth = toMonth === 12 ? 1 : toMonth + 1;
  const nextMonthYear = toMonth === 12 ? parseInt(toY, 10) + 1 : parseInt(toY, 10);
  const nextMonthFirst = new Date(nextMonthYear, nextMonth - 1, 1);
  const lastDay = new Date(nextMonthFirst.getTime() - 24 * 60 * 60 * 1000);
  const toDate = `${toY}-${String(toMonth).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;

  return [fromDate, toDate];
}

/**
 * 進行期を確定決算期として fiscal_periods に昇格し、
 * shinkouki を次期用にリセットする。
 */
export async function rolloverPeriod(
  companyId: string,
  extra: PeriodRolloverInput
): Promise<void> {
  // 1. 現在の shinkouki を取得
  const shinkoukiList = await fetchShinkouki();
  const current = shinkoukiList.find((s) => s.company_id === companyId);
  if (!current) {
    throw new Error(`rolloverPeriod: shinkouki not found for ${companyId}`);
  }

  // 2. range を period_from / period_to に変換
  const [period_from, period_to] = parseRange(current.range);

  // 3. fiscal_periods へ INSERT
  const { error: insertErr } = await supabase.from("fiscal_periods").insert({
    company_id: companyId,
    ki: current.ki,
    yr: current.yr,
    period_from,
    period_to,
    uriage: current.uriage,
    gaichuhi: current.gaichuhi,
    rieki: current.rieki,
    junshisan: extra.junshisan,
    genkin: extra.genkin,
    yokin: extra.yokin,
    doc_url: extra.doc_url,
  });

  if (insertErr) {
    throw new Error(`rolloverPeriod INSERT failed: ${insertErr.message}`);
  }

  // 4. shinkouki を次期用にリセット
  // 新しい range: 翌期の range。既存 range の年を +1 して再構築。
  const nextRangeMatch = current.range.match(/^(\d{4})\/(\d{1,2})~(\d{4})\/(\d{1,2})$/);
  let nextRange = current.range;
  if (nextRangeMatch) {
    const [, fromY, fromM, toY, toM] = nextRangeMatch;
    nextRange = `${parseInt(fromY, 10) + 1}/${fromM}~${parseInt(toY, 10) + 1}/${toM}`;
  }

  const { error: updateErr } = await supabase
    .from("shinkouki")
    .update({
      ki: current.ki + 1,
      yr: current.yr + 1,
      label: `第${current.ki + 1}期`,
      range: nextRange,
      uriage: null,
      gaichuhi: null,
      rieki: null,
      reflected: "未反映",
      zantei: true,
    })
    .eq("company_id", companyId);

  if (updateErr) {
    throw new Error(`rolloverPeriod UPDATE failed: ${updateErr.message}`);
  }

  await writeAuditLog("period_rollover", companyId);
}
