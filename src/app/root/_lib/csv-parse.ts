/**
 * Garden Root — CSV パース（KoT 手動フォールバック用）
 *
 * 【保留ステータス】
 *   当初 Phase A-2 段階1（CSV 手動取込）向けに実装したが、
 *   2026-04-24 方針転換で案C（KoT API 直接連携）採択のため、現在 UI からは未参照。
 *   KoT API 障害時の手動フォールバック、またはテスト用資産として保留する。
 *   廃棄判断は Phase A-2 安定後に再検討。
 *
 * 月次集計 CSV を 1行ずつ `Attendance` 行に変換する。
 * Server Action と Client 双方から呼ばれるピュア関数で、外部依存なし。
 *
 * 想定 CSV フォーマット（KoT 実機 CSV 到着前の推定）:
 *
 *   社員番号,対象月,出勤日数,欠勤日数,有給取得日数,所定労働時間,実労働時間,所定外時間,法定外時間,深夜時間,休日出勤時間,遅刻時間,早退時間,研修時間,事務時間,KoT元ID
 *   0008,2026-04,20,0,1,140,145,5,2,0,0,0.25,0,,,kot-rec-20260430-0008
 *
 * - ヘッダーは日本語（KoT エクスポートの慣例）。英名マッピング表を持つため、英名ヘッダーも許容。
 * - 対象月が列に無ければ、呼出側で指定した既定月（UIで選んだ月）を適用。
 * - 社員番号は `root_employees.employee_number`（4桁）を検索キーに、`employee_id` を解決する。
 */

import type { Attendance } from "../_constants/types";

// ------------------------------------------------------------
// 型
// ------------------------------------------------------------

/** パース結果の 1 行（未検証＋未解決 employee_id の中間表現） */
export type KotCsvRow = {
  row_index: number;        // 1-origin（ヘッダ除く）
  raw: Record<string, string>;
  employee_number: string;  // 4桁の社員番号
  target_month: string;     // YYYY-MM
  values: {
    working_days: number;
    absence_days: number;
    paid_leave_days: number;
    scheduled_hours: number;
    actual_hours: number;
    overtime_hours: number;
    legal_overtime_hours: number;
    night_hours: number;
    holiday_hours: number;
    late_hours: number;
    early_leave_hours: number;
    training_hours: number | null;
    office_hours: number | null;
  };
  kot_record_id: string | null;
};

export type RowError = {
  row_index: number;
  field?: string;
  message: string;
};

export type ParseResult = {
  detected_headers: string[];
  header_mapping: Partial<Record<keyof HeaderAliasTable, string>>;
  rows: KotCsvRow[];
  errors: RowError[];
};

// ------------------------------------------------------------
// ヘッダー別名マップ（KoT 汎用エクスポートの列名揺れに対応）
// ------------------------------------------------------------

/** Garden 正規キー → 受理するヘッダー候補 */
export const HEADER_ALIASES = {
  employee_number:     ["社員番号", "従業員番号", "employee_no", "employee_code", "社員コード"],
  target_month:        ["対象月", "年月", "target_month"],
  working_days:        ["出勤日数", "出勤", "working_days"],
  absence_days:        ["欠勤日数", "欠勤", "absence_days"],
  paid_leave_days:     ["有給取得日数", "有給", "有給日数", "paid_leave_days"],
  scheduled_hours:     ["所定労働時間", "所定時間", "scheduled_hours"],
  actual_hours:        ["実労働時間", "実働時間", "actual_hours"],
  overtime_hours:      ["所定外時間", "所定外労働時間", "overtime_hours"],
  legal_overtime_hours:["法定外時間", "法定外労働時間", "legal_overtime_hours"],
  night_hours:         ["深夜時間", "深夜労働時間", "night_hours"],
  holiday_hours:       ["休日出勤時間", "休日出勤", "holiday_hours"],
  late_hours:          ["遅刻時間", "遅刻", "late_hours"],
  early_leave_hours:   ["早退時間", "早退", "early_leave_hours"],
  training_hours:      ["研修時間", "研修", "training_hours"],
  office_hours:        ["事務時間", "事務", "office_hours"],
  kot_record_id:       ["KoT元ID", "KoTレコードID", "kot_record_id", "元データID"],
} as const;

type HeaderAliasTable = typeof HEADER_ALIASES;
type CanonicalKey = keyof HeaderAliasTable;

// ------------------------------------------------------------
// CSV 1行パース（RFC 4180 準拠の最小実装：引用符と改行埋め込みを許容）
// ------------------------------------------------------------

/** CSV テキスト全体を 2次元配列にする。空行はスキップ。 */
export function splitCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  // BOM 除去
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') { inQuotes = true; continue; }
    if (c === ",") { cur.push(field); field = ""; continue; }
    if (c === "\r") {
      // CRLF を一緒に扱う
      if (text[i + 1] === "\n") i++;
      cur.push(field); field = "";
      if (cur.some((f) => f.length > 0)) rows.push(cur);
      cur = [];
      continue;
    }
    if (c === "\n") {
      cur.push(field); field = "";
      if (cur.some((f) => f.length > 0)) rows.push(cur);
      cur = [];
      continue;
    }
    field += c;
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    if (cur.some((f) => f.length > 0)) rows.push(cur);
  }
  return rows;
}

// ------------------------------------------------------------
// ヘッダーマッピング
// ------------------------------------------------------------

function mapHeaders(headers: string[]): Partial<Record<CanonicalKey, string>> {
  const normalized = headers.map((h) => h.trim());
  const result: Partial<Record<CanonicalKey, string>> = {};
  for (const key of Object.keys(HEADER_ALIASES) as CanonicalKey[]) {
    const aliases: readonly string[] = HEADER_ALIASES[key];
    const match = normalized.find((h) => aliases.some((a) => a === h || a.toLowerCase() === h.toLowerCase()));
    if (match) result[key] = match;
  }
  return result;
}

// ------------------------------------------------------------
// バリデーション用の値変換
// ------------------------------------------------------------

function parseNumberOrNull(v: string | undefined): number | null {
  if (v === undefined) return null;
  const s = v.trim();
  if (s === "" || s === "-" || s === "—") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function parseNumberOrZero(v: string | undefined): number {
  const n = parseNumberOrNull(v);
  return n === null ? 0 : n;
}

const RE_YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const RE_EMP_NUMBER = /^\d{1,6}$/; // 実質 4 桁だが柔軟に

// ------------------------------------------------------------
// メイン：CSV テキストをパースして KotCsvRow[] を返す
// ------------------------------------------------------------

export type ParseOptions = {
  /** 対象月が CSV 列に無い場合の既定値（例: "2026-04"）。UI で選択中の月を渡す。 */
  fallbackTargetMonth?: string;
};

export function parseKotCsv(text: string, opts: ParseOptions = {}): ParseResult {
  const errors: RowError[] = [];
  const rawRows = splitCsv(text);

  if (rawRows.length === 0) {
    errors.push({ row_index: 0, message: "CSV が空です" });
    return { detected_headers: [], header_mapping: {}, rows: [], errors };
  }

  const headers = rawRows[0].map((h) => h.trim());
  const mapping = mapHeaders(headers);

  // 必須列: 社員番号 / 勤怠項目のいずれか
  if (!mapping.employee_number) {
    errors.push({
      row_index: 0,
      message: `必須列「社員番号」が見つかりません（受理する別名: ${HEADER_ALIASES.employee_number.join(" / ")}）`,
    });
  }
  if (!mapping.target_month && !opts.fallbackTargetMonth) {
    errors.push({
      row_index: 0,
      message: `必須列「対象月」が無く、呼出側の既定月も未指定です（UI で対象月を選択するか、CSV に「対象月」列を追加してください）`,
    });
  }

  const rows: KotCsvRow[] = [];

  // ヘッダ→列インデックスのマップ
  const indexOf = (canonical: CanonicalKey): number => {
    const header = mapping[canonical];
    if (!header) return -1;
    return headers.indexOf(header);
  };
  const cell = (rowArr: string[], canonical: CanonicalKey): string | undefined => {
    const idx = indexOf(canonical);
    return idx >= 0 ? rowArr[idx]?.trim() : undefined;
  };

  for (let i = 1; i < rawRows.length; i++) {
    const rowArr = rawRows[i];
    const row_index = i; // 1-origin
    const raw: Record<string, string> = {};
    headers.forEach((h, j) => { raw[h] = (rowArr[j] ?? "").trim(); });

    const empNum = cell(rowArr, "employee_number") ?? "";
    const target_month = cell(rowArr, "target_month") ?? opts.fallbackTargetMonth ?? "";

    if (!empNum) {
      errors.push({ row_index, field: "employee_number", message: "社員番号が空です" });
      continue;
    }
    if (!RE_EMP_NUMBER.test(empNum)) {
      errors.push({ row_index, field: "employee_number", message: `社員番号の形式が不正: "${empNum}"（半角数字のみ）` });
      continue;
    }
    if (!RE_YEAR_MONTH.test(target_month)) {
      errors.push({ row_index, field: "target_month", message: `対象月が YYYY-MM 形式でない: "${target_month}"` });
      continue;
    }

    const values = {
      working_days:         parseNumberOrZero(cell(rowArr, "working_days")),
      absence_days:         parseNumberOrZero(cell(rowArr, "absence_days")),
      paid_leave_days:      parseNumberOrZero(cell(rowArr, "paid_leave_days")),
      scheduled_hours:      parseNumberOrZero(cell(rowArr, "scheduled_hours")),
      actual_hours:         parseNumberOrZero(cell(rowArr, "actual_hours")),
      overtime_hours:       parseNumberOrZero(cell(rowArr, "overtime_hours")),
      legal_overtime_hours: parseNumberOrZero(cell(rowArr, "legal_overtime_hours")),
      night_hours:          parseNumberOrZero(cell(rowArr, "night_hours")),
      holiday_hours:        parseNumberOrZero(cell(rowArr, "holiday_hours")),
      late_hours:           parseNumberOrZero(cell(rowArr, "late_hours")),
      early_leave_hours:    parseNumberOrZero(cell(rowArr, "early_leave_hours")),
      training_hours:       parseNumberOrNull(cell(rowArr, "training_hours")),
      office_hours:         parseNumberOrNull(cell(rowArr, "office_hours")),
    };

    // NaN / 範囲外チェック
    const numericChecks: [string, number | null, number, number][] = [
      ["working_days", values.working_days, 0, 31],
      ["absence_days", values.absence_days, 0, 31],
      ["paid_leave_days", values.paid_leave_days, 0, 31],
      ["scheduled_hours", values.scheduled_hours, 0, 744],
      ["actual_hours", values.actual_hours, 0, 744],
      ["overtime_hours", values.overtime_hours, 0, 744],
      ["legal_overtime_hours", values.legal_overtime_hours, 0, 744],
      ["night_hours", values.night_hours, 0, 744],
      ["holiday_hours", values.holiday_hours, 0, 744],
      ["late_hours", values.late_hours, 0, 744],
      ["early_leave_hours", values.early_leave_hours, 0, 744],
      ["training_hours", values.training_hours, 0, 744],
      ["office_hours", values.office_hours, 0, 744],
    ];
    let hasRowError = false;
    for (const [field, v, min, max] of numericChecks) {
      if (v === null) continue;
      if (Number.isNaN(v)) {
        errors.push({ row_index, field, message: `${field} が数値でない` });
        hasRowError = true;
      } else if (v < min || v > max) {
        errors.push({ row_index, field, message: `${field} が範囲外（${min}〜${max}）: ${v}` });
        hasRowError = true;
      }
    }
    if (hasRowError) continue;

    rows.push({
      row_index,
      raw,
      employee_number: empNum,
      target_month,
      values,
      kot_record_id: cell(rowArr, "kot_record_id") || null,
    });
  }

  return { detected_headers: headers, header_mapping: mapping, rows, errors };
}

// ------------------------------------------------------------
// KotCsvRow → root_attendance の upsert 用オブジェクト変換
// ------------------------------------------------------------

export function buildAttendanceRow(
  row: KotCsvRow,
  employee_id: string,
): Attendance {
  const attendance_id = `ATT-${row.target_month}-${employee_id.replace("EMP-", "")}`;
  return {
    attendance_id,
    employee_id,
    target_month: row.target_month,
    working_days: row.values.working_days,
    absence_days: row.values.absence_days,
    paid_leave_days: row.values.paid_leave_days,
    scheduled_hours: row.values.scheduled_hours,
    actual_hours: row.values.actual_hours,
    overtime_hours: row.values.overtime_hours,
    legal_overtime_hours: row.values.legal_overtime_hours,
    night_hours: row.values.night_hours,
    holiday_hours: row.values.holiday_hours,
    late_hours: row.values.late_hours,
    early_leave_hours: row.values.early_leave_hours,
    training_hours: row.values.training_hours,
    office_hours: row.values.office_hours,
    imported_at: new Date().toISOString(),
    import_status: "取込済",
    kot_record_id: row.kot_record_id,
    created_at: "",
    updated_at: "",
  };
}
