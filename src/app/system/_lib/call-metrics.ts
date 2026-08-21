export const CALL_METRICS_MAX_DAYS = 366;

export const KNOWN_RESULT_FLAGS = [
  "留守", "担不", "見込", "無効", "獲得", "トス", "NG", "前確OK", "前確NG",
] as const;

export function classifyResultFlag(value: string | null | undefined) {
  const normalized = value?.trim() || null;
  return {
    normalized,
    isEffective: normalized !== null && normalized !== "留守" && normalized !== "無効",
    isExpected: normalized === null || (KNOWN_RESULT_FLAGS as readonly string[]).includes(normalized),
    isOrder: normalized === "前確OK",
    isAcquired: normalized === "獲得",
    isToss: normalized === "トス",
  };
}

export function aggregateDefinitionFixture(rows: Array<{ listName: string | null; resultFlag: string | null }>) {
  const grouped = new Map<string, { callCount: number; effectiveCount: number; orderCount: number; acquiredCount: number; tossCount: number }>();
  for (const row of rows) {
    const listName = row.listName?.trim() || "リスト名なし";
    const current = grouped.get(listName) ?? { callCount: 0, effectiveCount: 0, orderCount: 0, acquiredCount: 0, tossCount: 0 };
    const flag = classifyResultFlag(row.resultFlag);
    current.callCount++;
    if (flag.isEffective) current.effectiveCount++;
    if (flag.isOrder) current.orderCount++;
    if (flag.isAcquired) current.acquiredCount++;
    if (flag.isToss) current.tossCount++;
    grouped.set(listName, current);
  }
  return grouped;
}

export function aggregateEmployeeDefinitionFixture(rows: Array<{ employeeName: string | null; resultFlag: string | null }>) {
  return aggregateDefinitionFixture(rows.map((row) => ({ listName: row.employeeName?.trim() || "氏名なし", resultFlag: row.resultFlag })));
}

export type CallMetricRow = {
  listName: string;
  callCount: number;
  effectiveCount: number;
  effectiveRate: number;
  tossCount: number;
  orderCount: number;
  acquiredCount: number;
  callOrderRate: number;
  callAcquiredRate: number;
};

export type EmployeeCallMetricRow = Omit<CallMetricRow, "listName"> & {
  employeeName: string;
  prospectCount: number;
  absentCount: number;
  awayCount: number;
  invalidCount: number;
  workSeconds: number;
};

export type CallMetricsResponse = {
  from: string;
  to: string;
  listName: string | null;
  employeeName: string | null;
  metrics: CallMetricRow[];
  employeeMetrics: EmployeeCallMetricRow[];
  lastImportedAt: string | null;
};

export type CallMetricsSummary = {
  employeeCount: number;
  totalCalls: number;
  totalEffective: number;
  /** result_flag='前確OK'。ポータル表示は「前確OK」。 */
  totalOrders: number;
  /** result_flag='獲得'。ポータル表示は「受注」。 */
  totalAcquired: number;
  /** result_flag='トス'。ポータル表示は「トス数」。 */
  totalTosses: number;
  averageCalls: number;
  effectiveRate: number;
  acquiredRate: number;
  preconfirmRate: number;
};

export function summarizeCallMetrics(data: CallMetricsResponse): CallMetricsSummary {
  const totalCalls = data.metrics.reduce((sum, row) => sum + row.callCount, 0);
  const employeeCount = data.employeeMetrics.length;
  const totalEffective = data.employeeMetrics.reduce((sum, row) => sum + row.effectiveCount, 0);
  const totalOrders = data.employeeMetrics.reduce((sum, row) => sum + row.orderCount, 0);
  const totalAcquired = data.employeeMetrics.reduce((sum, row) => sum + row.acquiredCount, 0);
  const totalTosses = data.employeeMetrics.reduce((sum, row) => sum + row.tossCount, 0);
  return {
    employeeCount,
    totalCalls,
    totalEffective,
    totalOrders,
    totalAcquired,
    totalTosses,
    averageCalls: employeeCount ? totalCalls / employeeCount : 0,
    effectiveRate: totalCalls ? totalEffective / totalCalls : 0,
    acquiredRate: totalCalls ? totalAcquired / totalCalls : 0,
    preconfirmRate: totalCalls ? totalOrders / totalCalls : 0,
  };
}

type RpcMetricRow = {
  list_name?: unknown;
  call_count?: unknown;
  effective_count?: unknown;
  effective_rate?: unknown;
  toss_count?: unknown;
  order_count?: unknown;
  acquired_count?: unknown;
  call_order_rate?: unknown;
  call_acquired_rate?: unknown;
};

type RpcEmployeeMetricRow = Omit<RpcMetricRow, "list_name"> & {
  employee_name?: unknown;
  prospect_count?: unknown;
  absent_count?: unknown;
  away_count?: unknown;
  invalid_count?: unknown;
  work_seconds?: unknown;
};

type RpcPayload = { metrics?: unknown; employee_metrics?: unknown; last_imported_at?: unknown };

function dateOnly(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

export function defaultCallMetricDates(now = new Date()) {
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const today = to.toISOString().slice(0, 10);
  return { from: today, to: today };
}

export function parseCallMetricParams(searchParams: URLSearchParams, now = new Date()) {
  const defaults = defaultCallMetricDates(now);
  const fromText = searchParams.get("from") ?? defaults.from;
  const toText = searchParams.get("to") ?? defaults.to;
  const from = dateOnly(fromText);
  const to = dateOnly(toText);
  if (!from || !to) throw new Error("日付はYYYY-MM-DD形式で指定してください");
  if (from > to) throw new Error("開始日は終了日以前にしてください");
  const days = Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;
  if (days > CALL_METRICS_MAX_DAYS) throw new Error(`集計期間は最大${CALL_METRICS_MAX_DAYS}日です`);
  const listName = searchParams.get("listName")?.trim() || null;
  const employeeName = searchParams.get("employeeName")?.trim() || null;
  if (listName && listName.length > 200) throw new Error("リスト名が長すぎます");
  if (employeeName && employeeName.length > 200) throw new Error("従業員名が長すぎます");
  return { from: fromText, to: toText, listName, employeeName };
}

const number = (value: unknown) => Number(value ?? 0);

export function formatWorkTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function callsPerWorkHour(callCount: number, workSeconds: number) {
  return workSeconds > 0 ? callCount / (workSeconds / 3600) : null;
}

export function normalizeCallMetricsRpc(
  raw: unknown,
  range: { from: string; to: string; listName: string | null; employeeName: string | null },
): CallMetricsResponse {
  const payload = (raw && typeof raw === "object" ? raw : {}) as RpcPayload;
  const metrics = Array.isArray(payload.metrics) ? payload.metrics as RpcMetricRow[] : [];
  const employeeMetrics = Array.isArray(payload.employee_metrics) ? payload.employee_metrics as RpcEmployeeMetricRow[] : [];
  return {
    from: range.from,
    to: range.to,
    listName: range.listName,
    employeeName: range.employeeName,
    lastImportedAt: payload.last_imported_at ? String(payload.last_imported_at) : null,
    metrics: metrics.map((row) => ({
      listName: String(row.list_name ?? "リスト名なし"),
      callCount: number(row.call_count),
      effectiveCount: number(row.effective_count),
      effectiveRate: number(row.effective_rate),
      tossCount: number(row.toss_count),
      orderCount: number(row.order_count),
      acquiredCount: number(row.acquired_count),
      callOrderRate: number(row.call_order_rate),
      callAcquiredRate: number(row.call_acquired_rate),
    })),
    employeeMetrics: employeeMetrics.map((row) => ({
      employeeName: String(row.employee_name ?? "氏名なし"),
      callCount: number(row.call_count),
      effectiveCount: number(row.effective_count),
      effectiveRate: number(row.effective_rate),
      tossCount: number(row.toss_count),
      orderCount: number(row.order_count),
      acquiredCount: number(row.acquired_count),
      callOrderRate: number(row.call_order_rate),
      callAcquiredRate: number(row.call_acquired_rate),
      prospectCount: number(row.prospect_count),
      absentCount: number(row.absent_count),
      awayCount: number(row.away_count),
      invalidCount: number(row.invalid_count),
      workSeconds: number(row.work_seconds),
    })),
  };
}
