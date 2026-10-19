// LP系（WEBインバウンド）の読み込みを 1 か所に（画面の API・配信の手動・配信の cron が共用）。
// kintone 239（LP系の範囲）と顧客アプリ（申込み・対応と結果）を同じ 1 回の実行の中だけ使い回し、
// INNOVERA の写し（RPC system_innovera_funnel_calls）と突き合わせて「対応と結果」（§5.6）を作る。

import { buildLpFunnel, formCountInRange, normalizePhoneNumber, isValidPhoneNumber, type LpFunnelCalls, type LpFunnelResult } from "./lp-funnel";
import { unmatchedLpOrders, loadLpCustomerOrderCounts, countLpRegisteredRecords, type LpRegisteredCounts, countLpApplications, loadLpCustomerRecords, loadLpScope, lpCustomerAppTokenEnv, type LpCustomerRecord, type LpScopeBusiness } from "./lp-kintone";

type RpcClient = { rpc: (name: string, params: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };

export type LpContext = {
  lpScope: LpScopeBusiness[] | null;
  lpCircuitIds: number[];
  recordsByApp: Map<number, LpCustomerRecord[] | null>;
  lpApplicationCountsByBiz: Map<string, Map<string, number> | null>;
  lpCustomerOrderCountsByBiz: Map<string, number> | null;
  lpUnmatchedOrders: Array<{ listName: string; count: number }>;
  lpRegisteredCountsByBiz: Map<string, LpRegisteredCounts | null>;
  notes: string[];
  funnel: LpFunnelResult | null;
  formCount: number | null;
};

// kintone 239 と顧客アプリを読む（RPC は呼ばない）
export async function loadLpKintoneContext(from: string, to: string) {
  const lpScope = await loadLpScope().catch(() => null);
  const lpCircuitIds = [...new Set((lpScope ?? []).flatMap((biz) => biz.circuitIds))];
  const notes: string[] = [];
  const recordsByApp = new Map<number, LpCustomerRecord[] | null>();
  const lpRegisteredCountsByBiz = new Map<string, LpRegisteredCounts | null>();
  const lpApplicationCountsByBiz = new Map<string, Map<string, number> | null>();
  const lpCustomerOrderCountsByBiz = lpScope ? await loadLpCustomerOrderCounts(lpScope, from, to) : null;
  if (lpScope && !lpCustomerOrderCountsByBiz) notes.push("顧客一覧（受注）を取得できませんでした");
  const lpUnmatchedOrders = lpCustomerOrderCountsByBiz ? [...(unmatchedLpOrders.get(lpCustomerOrderCountsByBiz) ?? new Map()).entries()].map(([listName, count]) => ({ listName, count })) : [];
  if (!lpScope) {
    notes.push("LP申込み（kintone）の事業マスタを取得できませんでした");
  } else {
    for (const biz of lpScope) {
      if (!lpCustomerAppTokenEnv(biz.customerApp)) {
        lpApplicationCountsByBiz.set(biz.bizCode, null);
        recordsByApp.set(biz.customerApp, null);
        notes.push(`LP申込み（kintone）の鍵が未設定：アプリ ${biz.customerApp}`);
        continue;
      }
      if (!recordsByApp.has(biz.customerApp)) recordsByApp.set(biz.customerApp, await loadLpCustomerRecords(biz.customerApp));
      const records = recordsByApp.get(biz.customerApp) ?? null;
      lpRegisteredCountsByBiz.set(biz.bizCode, countLpRegisteredRecords(records, from, to));
      if (!records) {
        lpApplicationCountsByBiz.set(biz.bizCode, null);
        notes.push(`LP申込み（kintone）を取得できませんでした：${biz.bizName}`);
      } else {
        lpApplicationCountsByBiz.set(biz.bizCode, countLpApplications(records, from, to));
      }
    }
  }
  return { lpUnmatchedOrders, lpCustomerOrderCountsByBiz, lpScope, lpCircuitIds, recordsByApp, lpApplicationCountsByBiz, lpRegisteredCountsByBiz, notes };
}

// 期間内のフォーム（流入元＝HP）の番号＝RPC の p_numbers（正規化して重複を除く）
function formNumbersInRange(scope: LpScopeBusiness[], recordsByApp: Map<number, LpCustomerRecord[] | null>, from: string, to: string) {
  const numbers = new Set<string>();
  const fromKey = `${from}`;
  const toKey = `${to}`;
  for (const biz of scope) {
    for (const record of recordsByApp.get(biz.customerApp) ?? []) {
      if (String(record.source ?? "") !== "HP" || !record.createdAt) continue;
      const day = jstDate(record.createdAt);
      if (!day || day < fromKey || day > toKey) continue;
      const normalized = normalizePhoneNumber(record.phones.phone);
      if (isValidPhoneNumber(normalized)) numbers.add(normalized);
    }
  }
  return [...numbers];
}

function jstDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function asFunnelCalls(data: unknown): LpFunnelCalls | null {
  if (!data || typeof data !== "object") return null;
  const payload = data as { inbound?: unknown; outbound?: unknown; authorized?: unknown };
  if (payload.authorized === false) return null;
  return {
    inbound: Array.isArray(payload.inbound) ? payload.inbound as LpFunnelCalls["inbound"] : [],
    outbound: Array.isArray(payload.outbound) ? payload.outbound as LpFunnelCalls["outbound"] : [],
  };
}

// kintone の読み込み＋INNOVERA の写しとの突き合わせ（対応と結果）
export async function loadLpContext(options: { client: RpcClient; from: string; to: string; asOf: Date; hasInnoveraRows: boolean }): Promise<LpContext> {
  const kintone = await loadLpKintoneContext(options.from, options.to);
  let funnel: LpFunnelResult | null = null;
  let formCount: number | null = null;
  if (kintone.lpScope) {
    formCount = formCountInRange(kintone.lpScope, kintone.recordsByApp, options.from, options.to);
    let calls: LpFunnelCalls | null = null;
    if (options.hasInnoveraRows) {
      try {
        const numbers = formNumbersInRange(kintone.lpScope, kintone.recordsByApp, options.from, options.to);
        const result = await options.client.rpc("system_innovera_funnel_calls", {
          p_from: options.from,
          p_to: options.to,
          p_as_of: options.asOf.toISOString(),
          p_lp_circuit_ids: kintone.lpCircuitIds,
          p_numbers: numbers,
        });
        calls = result.error ? null : asFunnelCalls(result.data);
      } catch {
        calls = null;
      }
    }
    funnel = buildLpFunnel({ from: options.from, to: options.to, asOf: options.asOf, scope: kintone.lpScope, recordsByApp: kintone.recordsByApp, calls });
  }
  return { ...kintone, funnel, formCount };
}
