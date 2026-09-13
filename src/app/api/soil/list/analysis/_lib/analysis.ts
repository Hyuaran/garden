export type DbError = { message: string } | null;

export type AnalysisCellRow = {
  block: "vendor" | "active_list" | "contract";
  segment: string;
  result: string;
  list_name: string;
  list_loaded_on: string | null;
  row_count: number;
  called_count: number;
  call_total: number;
  invalid_count: number;
  order_count: number;
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
  acquiredCount: number;
  lastCalledOn: string | null;
  segmentLastCalledOn: string | null;
  rotation: number;
  orderRateValid: number;
  orderRateTotal: number;
  results: AnalysisResultBreakdown[];
};

export type AnalysisPayload = {
  refreshedAt: string | null;
  elapsedMs: number;
  lastError: string | null;
  blocks: {
    vendor: { segments: AnalysisSegment[] };
    activeList: { segments: AnalysisSegment[] };
    contract: { segments: AnalysisSegment[]; snapshotAt: string | null };
  };
};

export type AnalysisDetailRow = {
  listName: string;
  listLoadedOn: string | null;
  rowCount: number;
  calledCount: number;
  callTotal: number;
  orderCount: number;
  acquiredCount: number;
  lastCalledOn: string | null;
};

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
const TOP_RESULT_LIMIT = 6;
const RESULT_ORDER = ["留守", "担不", "無効", "NG", "前確OK", "見込", "未コール", "その他"];

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
    acquiredCount: 0,
    lastCalledOn: null,
    segmentLastCalledOn: null,
    rotation: 0,
    orderRateValid: 0,
    orderRateTotal: 0,
    results: [],
  };
}

function finalizeSegment(segment: AnalysisSegment, rows: AnalysisCellRow[]): AnalysisSegment {
  const rawResults = new Map<string, number>();
  for (const row of rows) rawResults.set(row.result, (rawResults.get(row.result) ?? 0) + numberValue(row.row_count));

  const ranked = [...rawResults.entries()]
    .filter(([result]) => result !== "未コール")
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja-JP"));
  const top = new Set(ranked.slice(0, TOP_RESULT_LIMIT).map(([result]) => result));
  const results = new Map<string, number>();
  for (const [result, count] of rawResults) {
    if (result === "未コール" || top.has(result)) results.set(result, (results.get(result) ?? 0) + count);
    else results.set("その他", (results.get("その他") ?? 0) + count);
  }

  segment.validCount = Math.max(0, segment.rowCount - segment.invalidCount);
  segment.rotation = segment.rowCount > 0 ? segment.callTotal / segment.rowCount : 0;
  segment.orderRateValid = segment.validCount > 0 ? segment.orderCount / segment.validCount : 0;
  segment.orderRateTotal = segment.rowCount > 0 ? segment.orderCount / segment.rowCount : 0;
  segment.results = [...results.entries()]
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

function buildBlock(cells: AnalysisCellRow[], block: AnalysisCellRow["block"]) {
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

export async function loadAnalysisCells(db: AnalysisDb): Promise<AnalysisCellRow[]> {
  const rows: AnalysisCellRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await db
      .from("soil_list_analysis_cell")
      .select("block,segment,result,list_name,list_loaded_on,row_count,called_count,call_total,invalid_count,order_count,acquired_count,last_called_on,segment_last_called_on")
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

export async function loadAnalysisPayload(db: AnalysisDb): Promise<AnalysisPayload> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.payload;
  const [cells, state, contractSnapshotAt] = await Promise.all([loadAnalysisCells(db), loadAnalysisState(db), loadContractSnapshotAt(db)]);
  const payload: AnalysisPayload = {
    refreshedAt: state.refreshed_at,
    elapsedMs: numberValue(state.last_elapsed_ms),
    lastError: state.last_error,
    blocks: {
      vendor: buildBlock(cells, "vendor"),
      activeList: buildBlock(cells, "active_list"),
      contract: { ...buildBlock(cells, "contract"), snapshotAt: contractSnapshotAt },
    },
  };
  cached = { expiresAt: now + CACHE_MS, payload, cells };
  return payload;
}

export async function loadAnalysisDetail(
  db: AnalysisDb,
  block: AnalysisCellRow["block"],
  segment: string,
  result: string,
): Promise<AnalysisDetailRow[]> {
  const now = Date.now();
  const cells = cached && cached.expiresAt > now ? cached.cells : await loadAnalysisCells(db);
  const blockRows = cells.filter((row) => row.block === block && (segment === "__all__" || row.segment === segment));
  const rawResults = new Map<string, number>();
  for (const row of blockRows) rawResults.set(row.result, (rawResults.get(row.result) ?? 0) + numberValue(row.row_count));
  const topResults = new Set(
    [...rawResults.entries()]
      .filter(([name]) => name !== "未コール")
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja-JP"))
      .slice(0, TOP_RESULT_LIMIT)
      .map(([name]) => name),
  );
  const detailRows = blockRows.filter((row) => {
    if (result === "その他") return row.result !== "未コール" && !topResults.has(row.result);
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
      acquiredCount: 0,
      lastCalledOn: null,
    };
    current.rowCount += numberValue(row.row_count);
    current.calledCount += numberValue(row.called_count);
    current.callTotal += numberValue(row.call_total);
    current.orderCount += numberValue(row.order_count);
    current.acquiredCount += numberValue(row.acquired_count);
    if (row.list_loaded_on && (!current.listLoadedOn || row.list_loaded_on > current.listLoadedOn)) current.listLoadedOn = row.list_loaded_on;
    if (row.last_called_on && (!current.lastCalledOn || row.last_called_on > current.lastCalledOn)) current.lastCalledOn = row.last_called_on;
    byList.set(row.list_name, current);
  }
  return [...byList.values()].sort((a, b) => String(b.listLoadedOn ?? "").localeCompare(String(a.listLoadedOn ?? "")) || a.listName.localeCompare(b.listName, "ja-JP"));
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
