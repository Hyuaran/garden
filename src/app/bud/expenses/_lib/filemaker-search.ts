export const DATE_FIELDS = ["receipt_date"] as const;
export const NUMERIC_FIELDS = ["amount"] as const;

export type SearchField =
  | "corp_id"
  | "expense_kind"
  | "category_id"
  | "qualified_class"
  | "receipt_date"
  | "receipt_time"
  | "amount"
  | "store_name"
  | "qualified_number"
  | "description"
  | "applicant_employee_id";

export type SearchRequest = Partial<Record<SearchField, string>>;
export type SearchSheet = SearchRequest & { mode?: "include" | "omit" };
export type SearchRecord = Partial<Record<SearchField, string | number | null>> & { id: string };

const SEARCH_FIELDS: SearchField[] = [
  "corp_id",
  "expense_kind",
  "category_id",
  "qualified_class",
  "receipt_date",
  "receipt_time",
  "amount",
  "store_name",
  "qualified_number",
  "description",
  "applicant_employee_id",
];

export type ParsedSearchOp =
  | { op: "empty" }
  | { op: "today" }
  | { op: "literal"; value: string }
  | { op: "exact"; value: string }
  | { op: "gt" | "gte" | "lt" | "lte"; value: string }
  | { op: "exclude"; inner: ParsedSearchOp }
  | { op: "range"; from: string; to: string }
  | { op: "starts"; value: string }
  | { op: "wildcard"; pattern: string }
  | { op: "contains"; value: string };

export function parseSearchOp(input: unknown): ParsedSearchOp {
  if (input == null) return { op: "empty" };
  const trimmed = String(input).trim();
  if (trimmed === "") return { op: "empty" };
  if (trimmed === "//") return { op: "today" };
  if (trimmed.startsWith("\\=")) return { op: "literal", value: trimmed.slice(1) };
  if (trimmed.startsWith("==")) return { op: "exact", value: trimmed.slice(2) };
  if (trimmed.startsWith(">=")) return { op: "gte", value: trimmed.slice(2) };
  if (trimmed.startsWith("<=")) return { op: "lte", value: trimmed.slice(2) };
  if (trimmed.startsWith(">")) return { op: "gt", value: trimmed.slice(1) };
  if (trimmed.startsWith("<")) return { op: "lt", value: trimmed.slice(1) };
  if (trimmed.startsWith("!")) return { op: "exclude", inner: parseSearchOp(trimmed.slice(1)) };
  if (trimmed.includes("...")) {
    const parts = trimmed.split("...");
    return { op: "range", from: parts[0]?.trim() ?? "", to: parts[1]?.trim() ?? "" };
  }
  if (trimmed.startsWith("=")) {
    const value = trimmed.slice(1);
    if (value.includes("*")) return { op: "wildcard", pattern: wildcardToRegex(value) };
    return { op: "starts", value };
  }
  if (trimmed.includes("*")) return { op: "wildcard", pattern: wildcardToRegex(trimmed) };
  return { op: "contains", value: trimmed };
}

export function wildcardToRegex(s: string) {
  return s.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
}

export function todayString(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

function isNumericField(field: string): field is (typeof NUMERIC_FIELDS)[number] {
  return NUMERIC_FIELDS.includes(field as (typeof NUMERIC_FIELDS)[number]);
}

function isDateField(field: string): field is (typeof DATE_FIELDS)[number] {
  return DATE_FIELDS.includes(field as (typeof DATE_FIELDS)[number]);
}

function normalizeDateForCompare(value: unknown, now = new Date()) {
  if (value == null || String(value).trim() === "") return "";
  const raw = String(value).replace(/-/g, "/").trim();
  const parts = raw.split("/").map((part) => part.trim());
  if (parts.length === 2) {
    const month = Number(parts[0]);
    const day = Number(parts[1]);
    if (Number.isFinite(month) && Number.isFinite(day)) {
      return `${now.getFullYear()}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
    }
  }
  if (parts.length === 3) {
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);
    if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
      return `${year}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
    }
  }
  return raw;
}

export function normalizeForCompare(field: string, val: unknown, now = new Date()) {
  if (val == null) return "";
  if (isNumericField(field)) {
    const n = Number.parseFloat(String(val).replace(/,/g, ""));
    return Number.isNaN(n) ? null : n;
  }
  if (isDateField(field)) return normalizeDateForCompare(val, now);
  return String(val);
}

export function compareValue(field: string, recordVal: unknown, opVal: unknown, now = new Date()) {
  const rv = normalizeForCompare(field, recordVal, now);
  const ov = normalizeForCompare(field, opVal, now);
  if (isNumericField(field)) return { rv: rv == null ? -Infinity : rv, ov: ov == null ? 0 : ov };
  return { rv: String(rv || ""), ov: String(ov || "") };
}

export function matchOp(field: string, recordVal: unknown, parsed: ParsedSearchOp, now = new Date()): boolean {
  if (parsed.op === "empty") return true;
  const rvStr = String(recordVal == null ? "" : recordVal);

  if (parsed.op === "exclude") return !matchOp(field, recordVal, parsed.inner, now);
  if (parsed.op === "today") return normalizeDateForCompare(rvStr, now) === todayString(now);
  if (parsed.op === "literal") return rvStr.includes(parsed.value);
  if (parsed.op === "exact") {
    if (isNumericField(field)) {
      const n = Number.parseFloat(rvStr.replace(/,/g, ""));
      const m = Number.parseFloat(parsed.value.replace(/,/g, ""));
      return !Number.isNaN(n) && !Number.isNaN(m) && n === m;
    }
    if (isDateField(field)) return normalizeDateForCompare(rvStr, now) === normalizeDateForCompare(parsed.value, now);
    return rvStr === parsed.value;
  }
  if (parsed.op === "starts") return rvStr.toLowerCase().startsWith(parsed.value.toLowerCase());
  if (parsed.op === "contains") return rvStr.toLowerCase().includes(parsed.value.toLowerCase());
  if (parsed.op === "wildcard") {
    try {
      return new RegExp(`^${parsed.pattern}$`, "i").test(rvStr);
    } catch {
      return false;
    }
  }
  if (parsed.op === "gt" || parsed.op === "gte" || parsed.op === "lt" || parsed.op === "lte") {
    const c = compareValue(field, recordVal, parsed.value, now);
    if (parsed.op === "gt") return c.rv > c.ov;
    if (parsed.op === "gte") return c.rv >= c.ov;
    if (parsed.op === "lt") return c.rv < c.ov;
    return c.rv <= c.ov;
  }
  if (parsed.op === "range") {
    const from = compareValue(field, recordVal, parsed.from, now);
    const to = compareValue(field, recordVal, parsed.to, now);
    return from.rv >= from.ov && to.rv <= to.ov;
  }
  return false;
}

export function hasSearchConditions(req: SearchRequest) {
  return SEARCH_FIELDS.some((field) => req[field] != null && String(req[field]).trim() !== "");
}

export function recordMatchesRequest(rec: SearchRecord, req: SearchRequest, now = new Date()) {
  const fields = SEARCH_FIELDS.filter((field) => {
    const value = req[field];
    return value != null && String(value).trim() !== "";
  });
  if (fields.length === 0) return false;

  for (const field of fields) {
    const parsed = parseSearchOp(req[field]);
    if (parsed.op === "empty") continue;
    if (!matchOp(field, rec[field], parsed, now)) return false;
  }
  return true;
}

export function executeFileMakerSearch<T extends SearchRecord>(records: T[], sheets: SearchSheet[], now = new Date()) {
  const validSheets = sheets.filter((sheet) => hasSearchConditions(sheet));
  if (validSheets.length === 0) return { records: [] as T[], summary: "", validSheets };

  const includeSheets = validSheets.filter((sheet) => sheet.mode !== "omit");
  const omitSheets = validSheets.filter((sheet) => sheet.mode === "omit");
  const included =
    includeSheets.length === 0
      ? records.slice()
      : records.filter((record) => includeSheets.some((sheet) => recordMatchesRequest(record, sheet, now)));
  const omittedIds = new Set(
    records.filter((record) => omitSheets.some((sheet) => recordMatchesRequest(record, sheet, now))).map((record) => record.id),
  );

  return {
    records: included.filter((record) => !omittedIds.has(record.id)),
    summary: summarizeSearchSheets(validSheets),
    validSheets,
  };
}

export function summarizeSearchSheets(sheets: SearchSheet[]) {
  const labels: Partial<Record<SearchField, string>> = {
    corp_id: "法人",
    category_id: "経費区分",
    qualified_class: "適格区分",
    receipt_date: "日付",
    receipt_time: "時刻",
    amount: "金額",
    store_name: "店名",
    qualified_number: "適格番号",
    description: "摘要",
    applicant_employee_id: "申請者",
  };

  return sheets
    .map((sheet) => {
      const parts = SEARCH_FIELDS
        .filter((field) => sheet[field] != null && String(sheet[field]).trim() !== "")
        .map((field) => `${labels[field] ?? field}=${String(sheet[field]).trim()}`);
      return `${sheet.mode === "omit" ? "除外" : "含む"}(${parts.join(" AND ")})`;
    })
    .join(" OR ");
}
