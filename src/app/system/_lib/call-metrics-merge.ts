import type { CallMetricsResponse, EmployeeCallMetricRow, LpBusinessMetricRow, LpMetricsPayload } from "./call-metrics";
import { normalizeLpAssigneeName, type LpScopeBusiness } from "./lp-kintone";

export type RootEmployeeForCallMetrics = {
  employee_id?: string | null;
  name?: string | null;
  filemaker_employee_name?: string | null;
  innovera_extension?: string | null;
  innovera_mobile_extension?: string | null;
  is_active?: boolean | null;
  deleted_at?: string | null;
};

type InnoveraEmployeeMetric = {
  employee_id?: unknown;
  talk_seconds_other?: unknown;
  lp_answered?: unknown;
  lp_outbound?: unknown;
  lp_talk_seconds?: unknown;
};

type InnoveraUnassignedMetric = Omit<InnoveraEmployeeMetric, "employee_id"> & { extension?: unknown };
type InnoveraCircuitMetric = {
  circuit_id?: unknown;
  inbound?: unknown;
  answered?: unknown;
  missed?: unknown;
  voicemail?: unknown;
  outbound?: unknown;
  outbound_answered?: unknown;
  talk_seconds?: unknown;
};

export type InnoveraMetricsPayload = {
  employee_metrics?: InnoveraEmployeeMetric[];
  unassigned?: InnoveraUnassignedMetric[];
  circuit_metrics?: InnoveraCircuitMetric[];
  last_sync_at?: unknown;
  has_rows?: unknown;
};

type MergeInput = {
  filemaker: CallMetricsResponse;
  innovera: InnoveraMetricsPayload | null;
  lpScope: LpScopeBusiness[] | null;
  lpApplicationCountsByBiz: Map<string, Map<string, number> | null>;
  rootEmployees: RootEmployeeForCallMetrics[];
  now?: Date;
  notes?: string[];
};

const n = (value: unknown) => Number(value ?? 0) || 0;

function normalizeName(value: string | null | undefined) {
  return value?.replace(/[\s\u3000]+/g, "").trim() || "";
}

// \u5728\u7c4d\u306e\u884c\uff08\u7121\u52b9\u3067\u3082\u524a\u9664\u3067\u3082\u306a\u3044\uff09
function isActiveRoot(employee: RootEmployeeForCallMetrics) {
  return employee.is_active !== false && !employee.deleted_at;
}

// Root \u306b\u56fa\u5b9a\u306e\u5185\u7dda\uff08PC \u304b\u30e2\u30d0\u30a4\u30eb\uff09\u304c\u767b\u9332\u3055\u308c\u3066\u3044\u308b\u304b
function hasFixedExtension(employee: RootEmployeeForCallMetrics | null | undefined) {
  return Boolean(String(employee?.innovera_extension ?? "").trim() || String(employee?.innovera_mobile_extension ?? "").trim());
}

// \u540c\u59d3\u540c\u540d\u304c\u8907\u6570\u884c\u3042\u308b\u3068\u304d\uff08\u9000\u8077\u306e\u884c\u304c\u6b8b\u3063\u3066\u3044\u308b\u7b49\uff09\u306f\u5728\u7c4d\u306e\u884c\u3092\u512a\u5148\u3059\u308b\u3002\u5728\u7c4d\u306e\u884c\u304c\u7121\u3051\u308c\u3070\u6700\u5f8c\u306e\u884c
function buildRootMap(employees: RootEmployeeForCallMetrics[], keyOf: (employee: RootEmployeeForCallMetrics) => string) {
  const map = new Map<string, RootEmployeeForCallMetrics>();
  for (const employee of employees) {
    const key = keyOf(employee);
    if (!key) continue;
    const current = map.get(key);
    if (current && isActiveRoot(current) && !isActiveRoot(employee)) continue;
    map.set(key, employee);
  }
  return map;
}

// \u901a\u8a71\u6642\u9593\u30fbLP\u5fdc\u7b54\u30fbLP\u767a\u4fe1\u30fbLP\u901a\u8a71\u6642\u9593\u306e\u300c-\u300d\u3068 0 \u306e\u533a\u5225\uff08\u00a75.5.5\uff09
// \u2460 INNOVERA \u306e\u884c\u304c\u671f\u9593\u306b 1 \u4ef6\u3082\u7121\u3044 \u2192 null\uff08\u300c-\u300d\uff09
// \u2461 INNOVERA \u306e\u6570\u5b57\u304c\u305d\u306e\u4eba\u306b\u4ed8\u3044\u3066\u3044\u308b\uff08\u56fa\u5b9a\u3067\u3082\u65e5\u3054\u3068\u306e\u5185\u7dda\u3067\u3082\uff09\u2192 \u305d\u306e\u5024
// \u2462 \u4ed8\u3044\u3066\u3044\u306a\u3044\u304c Root \u306b\u56fa\u5b9a\u306e\u5185\u7dda\u304c\u3042\u308b \u2192 0\uff08\u767b\u9332\u306f\u3042\u308b\u304c\u901a\u8a71\u304c\u7121\u3044\uff09
// \u2463 Root \u306b\u5185\u7dda\u306e\u767b\u9332\u304c\u7121\u3044 \u2192 null\uff08\u300c-\u300d\uff09
function innoveraValue(value: unknown, innoveraRow: InnoveraEmployeeMetric | null | undefined, root: RootEmployeeForCallMetrics | null | undefined, hasRows: boolean) {
  if (!hasRows) return null;
  if (innoveraRow) return n(value);
  return hasFixedExtension(root) ? 0 : null;
}

function isPositiveLp(row: Pick<EmployeeCallMetricRow, "lpAnswered" | "lpOutbound" | "lpTalkSeconds" | "lpApplications" | "talkSecondsOther">) {
  return [row.lpAnswered, row.lpOutbound, row.lpTalkSeconds, row.lpApplications, row.talkSecondsOther].some((value) => (value ?? 0) > 0);
}

export function resolveEmployeeIdForCallMetrics(employeeName: string | null, rootEmployees: RootEmployeeForCallMetrics[]) {
  const target = normalizeName(employeeName);
  if (!target) return null;
  const byName = buildRootMap(rootEmployees, (employee) => normalizeName(employee.name));
  const byFmName = buildRootMap(rootEmployees, (employee) => normalizeName(employee.filemaker_employee_name));
  const found = byName.get(target) ?? byFmName.get(target);
  return found?.employee_id ? String(found.employee_id) : null;
}

export function mergeCallMetrics(input: MergeInput): CallMetricsResponse {
  const hasRows = input.innovera?.has_rows === true;
  const innoveraByEmployee = new Map((input.innovera?.employee_metrics ?? []).map((row) => [String(row.employee_id ?? ""), row]));
  const rootByFmName = buildRootMap(input.rootEmployees, (employee) => normalizeName(employee.filemaker_employee_name ?? employee.name));
  const rootByName = buildRootMap(input.rootEmployees, (employee) => normalizeName(employee.name));
  const applicationsByAssignee = new Map<string, number>();
  const notes = [...(input.notes ?? [])];

  for (const counts of input.lpApplicationCountsByBiz.values()) {
    if (!counts) continue;
    for (const [name, count] of counts) applicationsByAssignee.set(name, (applicationsByAssignee.get(name) ?? 0) + count);
  }

  const rows: EmployeeCallMetricRow[] = input.filemaker.employeeMetrics.map((row) => {
    const root = rootByName.get(normalizeName(row.employeeName)) ?? rootByFmName.get(normalizeName(row.employeeName));
    const innoveraRow = root?.employee_id ? innoveraByEmployee.get(String(root.employee_id)) : null;
    const appCount = applicationsByAssignee.get(normalizeLpAssigneeName(root?.name ?? row.employeeName));
    applicationsByAssignee.delete(normalizeLpAssigneeName(root?.name ?? row.employeeName));
    return {
      ...row,
      talkSecondsOther: innoveraValue(innoveraRow?.talk_seconds_other, innoveraRow, root, hasRows),
      lpAnswered: innoveraValue(innoveraRow?.lp_answered, innoveraRow, root, hasRows),
      lpOutbound: innoveraValue(innoveraRow?.lp_outbound, innoveraRow, root, hasRows),
      lpTalkSeconds: innoveraValue(innoveraRow?.lp_talk_seconds, innoveraRow, root, hasRows),
      lpApplications: appCount ?? 0,
    };
  });

  for (const [name, count] of applicationsByAssignee) {
    if (name === "担当者未設定" || count <= 0) continue;
    const root = rootByName.get(normalizeName(name));
    if (!root) continue;
    const innoveraRow = root.employee_id ? innoveraByEmployee.get(String(root.employee_id)) : null;
    rows.push({
      employeeName: root.name ?? name,
      callCount: 0,
      effectiveCount: 0,
      effectiveRate: 0,
      tossCount: 0,
      orderCount: 0,
      acquiredCount: 0,
      callOrderRate: 0,
      callAcquiredRate: 0,
      prospectCount: 0,
      absentCount: 0,
      awayCount: 0,
      invalidCount: 0,
      workSeconds: 0,
      talkSecondsOther: innoveraValue(innoveraRow?.talk_seconds_other, innoveraRow, root, hasRows),
      lpAnswered: innoveraValue(innoveraRow?.lp_answered, innoveraRow, root, hasRows),
      lpOutbound: innoveraValue(innoveraRow?.lp_outbound, innoveraRow, root, hasRows),
      lpTalkSeconds: innoveraValue(innoveraRow?.lp_talk_seconds, innoveraRow, root, hasRows),
      lpApplications: count,
    });
  }

  const unassigned = (input.innovera?.unassigned ?? []).filter((row) => [row.lp_answered, row.lp_outbound, row.lp_talk_seconds, row.talk_seconds_other].some((value) => n(value) > 0));
  if (unassigned.length && hasRows) {
    rows.push({
      employeeName: `（内線未登録）${unassigned.length}席`,
      callCount: 0,
      effectiveCount: 0,
      effectiveRate: 0,
      tossCount: 0,
      orderCount: 0,
      acquiredCount: 0,
      callOrderRate: 0,
      callAcquiredRate: 0,
      prospectCount: 0,
      absentCount: 0,
      awayCount: 0,
      invalidCount: 0,
      workSeconds: 0,
      talkSecondsOther: unassigned.reduce((sum, row) => sum + n(row.talk_seconds_other), 0),
      lpAnswered: unassigned.reduce((sum, row) => sum + n(row.lp_answered), 0),
      lpOutbound: unassigned.reduce((sum, row) => sum + n(row.lp_outbound), 0),
      lpTalkSeconds: unassigned.reduce((sum, row) => sum + n(row.lp_talk_seconds), 0),
      lpApplications: null,
      unregisteredExtensionDetails: unassigned.map((row) => String(row.extension ?? "番号不明")),
    });
  }

  const circuitById = new Map((input.innovera?.circuit_metrics ?? []).map((row) => [String(row.circuit_id ?? ""), row]));
  const businessRows: LpBusinessMetricRow[] = (input.lpScope ?? []).map((biz) => {
    const counts = biz.circuitIds.map((id) => circuitById.get(String(id))).filter(Boolean) as InnoveraCircuitMetric[];
    const appCounts = input.lpApplicationCountsByBiz.get(biz.bizCode);
    const applications = appCounts ? [...appCounts.values()].reduce((sum, value) => sum + value, 0) : null;
    return {
      bizCode: biz.bizCode,
      bizName: biz.bizName,
      recordOrder: biz.recordOrder,
      inbound: hasRows ? counts.reduce((sum, row) => sum + n(row.inbound), 0) : null,
      answered: hasRows ? counts.reduce((sum, row) => sum + n(row.answered), 0) : null,
      missed: hasRows ? counts.reduce((sum, row) => sum + n(row.missed), 0) : null,
      voicemail: hasRows ? counts.reduce((sum, row) => sum + n(row.voicemail), 0) : null,
      outbound: hasRows ? counts.reduce((sum, row) => sum + n(row.outbound), 0) : null,
      outboundAnswered: hasRows ? counts.reduce((sum, row) => sum + n(row.outbound_answered), 0) : null,
      talkSeconds: hasRows ? counts.reduce((sum, row) => sum + n(row.talk_seconds), 0) : null,
      applications,
      unassignedApplications: appCounts?.get("担当者未設定") ?? 0,
    };
  }).sort((a, b) => a.recordOrder - b.recordOrder);

  const total = sumLpBusinessRows(businessRows);
  const lastSyncAt = input.innovera?.last_sync_at ? String(input.innovera.last_sync_at) : null;
  const stopped = isInnoveraStopped(lastSyncAt, input.now ?? new Date());
  const lp: LpMetricsPayload = {
    businesses: businessRows,
    totals: total,
    notes,
    unregisteredExtensionSummary: unassigned.length ? `（内線未登録）：${unassigned.map((row) => String(row.extension ?? "番号不明")).join("、")}` : null,
  };
  return { ...input.filemaker, employeeMetrics: rows.filter((row) => row.callCount > 0 || isPositiveLp(row)), innovera: { lastSyncAt, stopped, hasRows }, lp };
}

function sumNullable(rows: LpBusinessMetricRow[], key: keyof LpBusinessMetricRow) {
  return rows.some((row) => row[key] == null) ? null : rows.reduce((sum, row) => sum + Number(row[key] ?? 0), 0);
}

function sumLpBusinessRows(rows: LpBusinessMetricRow[]): LpBusinessMetricRow | null {
  if (!rows.length) return null;
  return {
    bizCode: "total",
    bizName: "合計",
    recordOrder: Number.MAX_SAFE_INTEGER,
    inbound: sumNullable(rows, "inbound"),
    answered: sumNullable(rows, "answered"),
    missed: sumNullable(rows, "missed"),
    voicemail: sumNullable(rows, "voicemail"),
    outbound: sumNullable(rows, "outbound"),
    outboundAnswered: sumNullable(rows, "outboundAnswered"),
    talkSeconds: sumNullable(rows, "talkSeconds"),
    applications: sumNullable(rows, "applications"),
    unassignedApplications: rows.reduce((sum, row) => sum + row.unassignedApplications, 0),
  };
}

export function isInnoveraStopped(lastSyncAt: string | null, now = new Date()) {
  if (!lastSyncAt) return true;
  const sync = new Date(lastSyncAt);
  if (Number.isNaN(sync.getTime())) return true;
  return now.getTime() - sync.getTime() >= 20 * 60 * 1000;
}
