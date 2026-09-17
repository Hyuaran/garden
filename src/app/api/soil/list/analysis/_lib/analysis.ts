import { queryPg } from "@/lib/db/pg";

export type DbError = { message: string } | null;

export type AnalysisAxis = "vendor" | "line_type" | "contract_year";
export type AnalysisBlock = AnalysisAxis | "active_list" | "contract";

export type AnalysisCellRow = {
  block: AnalysisBlock;
  segment: string;
  result: string;
  list_name: string;
  list_loaded_on: string | null;
  row_count: number;
  called_count: number;
  call_total: number;
  invalid_count: number;
  order_count: number;
  order_case_count?: number;
  acquired_count: number;
  last_called_on: string | null;
  segment_last_called_on: string | null;
};

export type AnalysisStateRow = {
  refreshed_at: string | null;
  last_elapsed_ms: number | null;
  last_error: string | null;
  rows: number | null;
};

export type AnalysisResultBreakdown = {
  result: string;
  rowCount: number;
};

export type AnalysisSegment = {
  segment: string;
  rowCount: number;
  calledCount: number;
  callTotal: number;
  invalidCount: number;
  validCount: number;
  orderCount: number;
  orderCaseCount: number;
  acquiredCount: number;
  lastCalledOn: string | null;
  segmentLastCalledOn: string | null;
  rotation: number;
  orderRateValid: number;
  orderRateTotal: number;
  results: AnalysisResultBreakdown[];
  repurchaseCount?: number;
  repurchaseSources?: string;
};

export type AnalysisRepurchasePair = {
  sourceVendor: string;
  targetVendor: string;
  phoneCount: number;
  orderCount: number;
};

export type AnalysisPayload = {
  refreshedAt: string | null;
  elapsedMs: number;
  lastError: string | null;
  blocks: {
    vendor: { segments: AnalysisSegment[] };
    lineType: { segments: AnalysisSegment[] };
    contractYear: { segments: AnalysisSegment[] };
    activeList: { segments: AnalysisSegment[] };
    contract: { segments: AnalysisSegment[]; snapshotAt: string | null };
  };
  repurchasePairs: AnalysisRepurchasePair[];
};

export type AnalysisDetailRow = {
  listName: string;
  listLoadedOn: string | null;
  rowCount: number;
  calledCount: number;
  callTotal: number;
  orderCount: number;
  orderCaseCount: number;
  acquiredCount: number;
  lastCalledOn: string | null;
};

type QueryPgResult = Awaited<ReturnType<typeof queryPg>>;

type QueryResult<T> = Promise<{ data: T[] | null; error: DbError }>;
type MaybeSingleResult<T> = Promise<{ data: T | null; error: DbError }>;

export type AnalysisDb = {
  from(table: string): {
    select(columns: string): {
      order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): {
        range(from: number, to: number): QueryResult<AnalysisCellRow>;
        limit(count: number): {
          maybeSingle<T>(): MaybeSingleResult<T>;
        };
      };
      eq(column: string, value: unknown): {
        maybeSingle<T>(): MaybeSingleResult<T>;
        order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): {
          limit(count: number): {
            maybeSingle<T>(): MaybeSingleResult<T>;
          };
        };
      };
      limit(count: number): QueryResult<Record<string, unknown>>;
    };
    update(values: Record<string, unknown>): {
      eq(column: string, value: unknown): Promise<{ error: DbError }>;
    };
  };
  rpc(name: string, args?: Record<string, unknown>): Promise<{ data: unknown; error: DbError }>;
};

export type RefreshResult = {
  ok: true;
  refreshed_at: string | null;
  rows: number;
  elapsed_ms: number;
};

const PAGE_SIZE = 1000;
const FIXED_RESULTS = ["留守", "担不", "無効", "NG", "前確OK", "見込", "獲得", "未コール", "（結果なし）"] as const;
const RESULT_ORDER = ["留守", "担不", "無効", "NG", "前確OK", "見込", "獲得", "未コール", "その他", "（結果なし）"];

function normalizeResultBreakdown(rows: AnalysisCellRow[]): Map<string, number> {
  const fixed = new Set<string>(FIXED_RESULTS);
  const results = new Map<string, number>();
  for (const result of FIXED_RESULTS) results.set(result, 0);
  results.set("その他", 0);

  for (const row of rows) {
    const result = fixed.has(row.result) ? row.result : "その他";
    results.set(result, (results.get(result) ?? 0) + numberValue(row.row_count));
  }

  return results;
}

let cached: { expiresAt: number; payload: AnalysisPayload; cells: AnalysisCellRow[] } | null = null;
const CACHE_MS = 10 * 60 * 1000;

export function clearAnalysisCache() {
  cached = null;
}

function numberValue(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function addSegmentTotals(target: AnalysisSegment, row: AnalysisCellRow) {
  target.rowCount += numberValue(row.row_count);
  target.calledCount += numberValue(row.called_count);
  target.callTotal += numberValue(row.call_total);
  target.invalidCount += numberValue(row.invalid_count);
  target.orderCount += numberValue(row.order_count);
  target.orderCaseCount += numberValue(row.order_case_count);
  target.acquiredCount += numberValue(row.acquired_count);
  if (row.last_called_on && (!target.lastCalledOn || row.last_called_on > target.lastCalledOn)) target.lastCalledOn = row.last_called_on;
  if (row.segment_last_called_on && (!target.segmentLastCalledOn || row.segment_last_called_on > target.segmentLastCalledOn)) {
    target.segmentLastCalledOn = row.segment_last_called_on;
  }
}

function emptySegment(segment: string): AnalysisSegment {
  return {
    segment,
    rowCount: 0,
    calledCount: 0,
    callTotal: 0,
    invalidCount: 0,
    validCount: 0,
    orderCount: 0,
    orderCaseCount: 0,
    acquiredCount: 0,
    lastCalledOn: null,
    segmentLastCalledOn: null,
    rotation: 0,
    orderRateValid: 0,
    orderRateTotal: 0,
    results: [],
    repurchaseCount: 0,
    repurchaseSources: "",
  };
}

function finalizeSegment(segment: AnalysisSegment, rows: AnalysisCellRow[]): AnalysisSegment {
  const results = normalizeResultBreakdown(rows);

  segment.validCount = Math.max(0, segment.rowCount - segment.invalidCount);
  segment.rotation = segment.rowCount > 0 ? segment.callTotal / segment.rowCount : 0;
  segment.orderRateValid = segment.validCount > 0 ? segment.orderCount / segment.validCount : 0;
  segment.orderRateTotal = segment.rowCount > 0 ? segment.orderCount / segment.rowCount : 0;
  // 前確OK と獲得は 0 件でも凡例に出す（受注に一番近い結果なので隠さない）。ほかは件数があるものだけ
  segment.results = [...results.entries()]
    .filter(([result, rowCount]) => rowCount > 0 || result === "前確OK" || result === "獲得")
    .map(([result, rowCount]) => ({ result, rowCount }))
    .sort((a, b) => {
      const left = RESULT_ORDER.indexOf(a.result);
      const right = RESULT_ORDER.indexOf(b.result);
      const leftOrder = left === -1 ? RESULT_ORDER.length : left;
      const rightOrder = right === -1 ? RESULT_ORDER.length : right;
      return leftOrder - rightOrder || b.rowCount - a.rowCount;
    });
  return segment;
}

function buildBlock(cells: AnalysisCellRow[], block: AnalysisBlock) {
  const blockRows = cells.filter((row) => row.block === block);
  const rowsBySegment = new Map<string, AnalysisCellRow[]>();
  const segments = new Map<string, AnalysisSegment>();
  const total = emptySegment("合計");
  rowsBySegment.set("合計", blockRows);

  for (const row of blockRows) {
    addSegmentTotals(total, row);
    const segment = segments.get(row.segment) ?? emptySegment(row.segment);
    segments.set(row.segment, segment);
    addSegmentTotals(segment, row);
    const rows = rowsBySegment.get(row.segment) ?? [];
    rows.push(row);
    rowsBySegment.set(row.segment, rows);
  }

  const finalized = [finalizeSegment(total, blockRows)];
  for (const segment of [...segments.values()].sort((a, b) => b.rowCount - a.rowCount || a.segment.localeCompare(b.segment, "ja-JP"))) {
    finalized.push(finalizeSegment(segment, rowsBySegment.get(segment.segment) ?? []));
  }
  return { segments: finalized };
}

type RepurchaseVendorRow = {
  segment: string;
  repurchase_count: number;
  source_summary: string | null;
};

type RepurchasePairRow = {
  source_vendor: string;
  target_vendor: string;
  phone_count: number;
  order_count: number;
};

function decorateVendorRepurchase(segments: AnalysisSegment[], rows: RepurchaseVendorRow[]): AnalysisSegment[] {
  const bySegment = new Map(rows.map((row) => [row.segment, row]));
  const total = rows.reduce((sum, row) => sum + numberValue(row.repurchase_count), 0);
  return segments.map((segment) => {
    if (segment.segment === "合計") return { ...segment, repurchaseCount: total, repurchaseSources: "" };
    const row = bySegment.get(segment.segment);
    return {
      ...segment,
      repurchaseCount: numberValue(row?.repurchase_count),
      repurchaseSources: row?.source_summary ?? "",
    };
  });
}

export async function loadAnalysisCells(db: AnalysisDb): Promise<AnalysisCellRow[]> {
  const rows: AnalysisCellRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await db
      .from("soil_list_analysis_cell")
      .select("block,segment,result,list_name,list_loaded_on,row_count,called_count,call_total,invalid_count,order_count,order_case_count,acquired_count,last_called_on,segment_last_called_on")
      .order("block", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

export async function loadAnalysisState(db: AnalysisDb): Promise<AnalysisStateRow> {
  const { data, error } = await db
    .from("soil_list_analysis_state")
    .select("refreshed_at,last_elapsed_ms,last_error,rows")
    .eq("id", 1)
    .maybeSingle<AnalysisStateRow>();
  if (error) throw new Error(error.message);
  return data ?? { refreshed_at: null, last_elapsed_ms: 0, last_error: null, rows: 0 };
}

export async function loadContractSnapshotAt(db: AnalysisDb): Promise<string | null> {
  const { data, error } = await db
    .from("system_fm_shineigyo_sync_log")
    .select("completed_at")
    .eq("status", "success")
    .order("completed_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle<{ completed_at: string | null }>();
  if (error) throw new Error(error.message);
  return data?.completed_at ?? null;
}

export async function loadRepurchaseVendors(db: AnalysisDb): Promise<RepurchaseVendorRow[]> {
  const { data, error } = await db
    .from("soil_list_analysis_vendor_repurchase")
    .select("segment,repurchase_count,source_summary")
    .order("repurchase_count", { ascending: false })
    .range(0, 999);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as RepurchaseVendorRow[];
}

export async function loadRepurchasePairs(db: AnalysisDb): Promise<AnalysisRepurchasePair[]> {
  const { data, error } = await db
    .from("soil_list_analysis_repurchase_pair")
    .select("source_vendor,target_vendor,phone_count,order_count")
    .order("phone_count", { ascending: false })
    .range(0, 49);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as RepurchasePairRow[]).map((row) => ({
    sourceVendor: row.source_vendor,
    targetVendor: row.target_vendor,
    phoneCount: numberValue(row.phone_count),
    orderCount: numberValue(row.order_count),
  }));
}

export async function loadAnalysisPayload(db: AnalysisDb): Promise<AnalysisPayload> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.payload;
  const [cells, state, contractSnapshotAt, repurchaseVendors, repurchasePairs] = await Promise.all([
    loadAnalysisCells(db),
    loadAnalysisState(db),
    loadContractSnapshotAt(db),
    loadRepurchaseVendors(db),
    loadRepurchasePairs(db),
  ]);
  const vendor = buildBlock(cells, "vendor");
  const payload: AnalysisPayload = {
    refreshedAt: state.refreshed_at,
    elapsedMs: numberValue(state.last_elapsed_ms),
    lastError: state.last_error,
    blocks: {
      vendor: { segments: decorateVendorRepurchase(vendor.segments, repurchaseVendors) },
      lineType: buildBlock(cells, "line_type"),
      contractYear: buildBlock(cells, "contract_year"),
      activeList: buildBlock(cells, "active_list"),
      contract: { ...buildBlock(cells, "contract"), snapshotAt: contractSnapshotAt },
    },
    repurchasePairs,
  };
  cached = { expiresAt: now + CACHE_MS, payload, cells };
  return payload;
}

export async function loadAnalysisDetail(
  db: AnalysisDb,
  block: AnalysisBlock,
  segment: string,
  result: string,
): Promise<AnalysisDetailRow[]> {
  const now = Date.now();
  const cells = cached && cached.expiresAt > now ? cached.cells : await loadAnalysisCells(db);
  const blockRows = cells.filter((row) => row.block === block && (segment === "__all__" || row.segment === segment));
  const fixedResults = new Set<string>(FIXED_RESULTS);
  const detailRows = blockRows.filter((row) => {
    if (result === "その他") return !fixedResults.has(row.result);
    return row.result === result;
  });
  const byList = new Map<string, AnalysisDetailRow>();
  for (const row of detailRows) {
    const current = byList.get(row.list_name) ?? {
      listName: row.list_name,
      listLoadedOn: row.list_loaded_on,
      rowCount: 0,
      calledCount: 0,
      callTotal: 0,
      orderCount: 0,
      orderCaseCount: 0,
      acquiredCount: 0,
      lastCalledOn: null,
    };
    current.rowCount += numberValue(row.row_count);
    current.calledCount += numberValue(row.called_count);
    current.callTotal += numberValue(row.call_total);
    current.orderCount += numberValue(row.order_count);
    current.orderCaseCount += numberValue(row.order_case_count);
    current.acquiredCount += numberValue(row.acquired_count);
    if (row.list_loaded_on && (!current.listLoadedOn || row.list_loaded_on > current.listLoadedOn)) current.listLoadedOn = row.list_loaded_on;
    if (row.last_called_on && (!current.lastCalledOn || row.last_called_on > current.lastCalledOn)) current.lastCalledOn = row.last_called_on;
    byList.set(row.list_name, current);
  }
  return [...byList.values()].sort((a, b) => String(b.listLoadedOn ?? "").localeCompare(String(a.listLoadedOn ?? "")) || a.listName.localeCompare(b.listName, "ja-JP"));
}

function normalizeVendorFilters(vendors: string[]): string[] {
  return [...new Set(vendors.map((vendor) => vendor.trim()).filter(Boolean))];
}

export function isAnalysisAxis(value: string | null): value is AnalysisAxis {
  return value === "vendor" || value === "line_type" || value === "contract_year";
}

export function isVendorAndTooBroadError(error: unknown): boolean {
  return error instanceof Error && /statement timeout|canceling statement due to statement timeout/i.test(error.message);
}

export async function loadVendorAndAnalysis(vendors: string[], axis: AnalysisAxis): Promise<{ segments: AnalysisSegment[] }> {
  const normalized = normalizeVendorFilters(vendors);
  if (normalized.length < 2) throw new Error("購入先を 2 つ以上選んでください");

  return loadFilteredAnalysis({ vendors: normalized, lineTypes: [], contractYears: [], axis });
}

function normalizeSimpleFilters(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function usesPurchaseFilterCell(filters: { vendors: string[] }): boolean {
  return normalizeVendorFilters(filters.vendors).length <= 1;
}

function purchaseFilterCellSql(axis: AnalysisAxis): string {
  const segmentColumn = axis === "vendor" ? "vendor" : axis === "line_type" ? "line_type" : "contract_year";
  return `
    select
      $4::text as block,
      ${segmentColumn} as segment,
      result,
      '（詳細なし）'::text as list_name,
      null::date as list_loaded_on,
      sum(row_count)::integer as row_count,
      sum(called_count)::integer as called_count,
      sum(call_total)::integer as call_total,
      sum(invalid_count)::integer as invalid_count,
      sum(order_count)::integer as order_count,
      sum(order_case_count)::integer as order_case_count,
      sum(acquired_count)::integer as acquired_count,
      null::date as last_called_on,
      null::date as segment_last_called_on
    from public.soil_list_analysis_purchase_filter_cell
    where (cardinality($1::text[]) = 0 or vendor = any($1::text[]))
      and (cardinality($2::text[]) = 0 or line_type = any($2::text[]))
      and (cardinality($3::text[]) = 0 or contract_year = any($3::text[]))
    group by ${segmentColumn}, result
  `;
}

async function purchaseFilterCellHasRows(): Promise<boolean> {
  const { rows } = await queryPg("select exists(select 1 from public.soil_list_analysis_purchase_filter_cell) as has_rows", []);
  return Boolean((rows[0] as { has_rows?: boolean } | undefined)?.has_rows);
}

async function loadFilteredAnalysisFromPurchaseCell(filters: { vendors: string[]; lineTypes: string[]; contractYears: string[]; axis: AnalysisAxis }): Promise<QueryPgResult | null> {
  const vendors = normalizeVendorFilters(filters.vendors);
  const lineTypes = normalizeSimpleFilters(filters.lineTypes);
  const contractYears = normalizeSimpleFilters(filters.contractYears);
  const result = await queryPg(purchaseFilterCellSql(filters.axis), [vendors, lineTypes, contractYears, filters.axis]);
  if (result.rows.length > 0 || (await purchaseFilterCellHasRows())) return result;
  return null;
}

async function loadFilteredAnalysisDirect(filters: { vendors: string[]; lineTypes: string[]; contractYears: string[]; axis: AnalysisAxis }): Promise<QueryPgResult> {
  return queryPg(
    "select * from public.soil_list_analysis_filtered($1::text[], $2::text[], $3::text[], $4::text)",
    [normalizeVendorFilters(filters.vendors), normalizeSimpleFilters(filters.lineTypes), normalizeSimpleFilters(filters.contractYears), filters.axis],
  );
}

export async function loadFilteredAnalysis(filters: { vendors: string[]; lineTypes: string[]; contractYears: string[]; axis: AnalysisAxis }): Promise<{ segments: AnalysisSegment[] }> {
  try {
    const result = usesPurchaseFilterCell(filters)
      ? (await loadFilteredAnalysisFromPurchaseCell(filters)) ?? await loadFilteredAnalysisDirect(filters)
      : await loadFilteredAnalysisDirect(filters);
    const { rows } = result;
    return buildBlock((rows as AnalysisCellRow[]).map((row) => ({ ...row, block: filters.axis })), filters.axis);
  } catch (error) {
    if (isVendorAndTooBroadError(error)) {
      throw new Error("条件が広すぎます。絞り込みを減らしてください");
    }
    throw error;
  }
}

function normalizeFinish(data: unknown): RefreshResult {
  const row = Array.isArray(data) ? data[0] : data;
  const value = row as { refreshed_at?: string | null; rows?: number | null; elapsed_ms?: number | null } | null;
  return {
    ok: true,
    refreshed_at: value?.refreshed_at ?? null,
    rows: numberValue(value?.rows),
    elapsed_ms: numberValue(value?.elapsed_ms),
  };
}

export async function saveAnalysisFailure(db: AnalysisDb, message: string) {
  const { error } = await db.rpc("soil_list_analysis_fail", { p_error: message });
  if (error) throw new Error(error.message);
}

export async function refreshAnalysis(db: AnalysisDb): Promise<RefreshResult> {
  const startedAt = new Date().toISOString();
  const begin = await db.rpc("soil_list_analysis_begin");
  if (begin.error) throw new Error(begin.error.message);

  try {
    // 台帳を物理的な位置で 100 等分して 1 つずつ足し込む（1 回 0.1 秒。電話番号の先頭桁での分割は 8 秒に収まらなかった）
    for (let index = 0; index < 100; index += 1) {
      const collected = await db.rpc("soil_list_analysis_collect", { p_chunk: index, p_chunks: 100 });
      if (collected.error) throw new Error(collected.error.message);
    }
    const finished = await db.rpc("soil_list_analysis_finish", { p_started_at: startedAt });
    if (finished.error) throw new Error(finished.error.message);
    clearAnalysisCache();
    return normalizeFinish(finished.data);
  } catch (error) {
    await saveAnalysisFailure(db, error instanceof Error ? error.message : "analysis_refresh_failed").catch(() => undefined);
    throw error;
  }
}
