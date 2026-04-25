/**
 * Garden Root — KING OF TIME（KoT）Web API 型定義
 *
 * 根拠: https://developer.kingoftime.jp/
 *   - ベース: https://api.kingtime.jp/v1.0
 *   - 認証: Authorization: Bearer <KOT_API_TOKEN>
 *   - 単位: 時間は原則「分」(minutes)
 *   - 社員識別: employeeKey（不変のハッシュ）/ code（社員コード、root_employees.employee_number と一致する想定）
 *
 * ⚠️ 本ファイルは 2026-04-24 時点の公式 API Doc 概観から起こした推定型。
 *    実機レスポンス到着時に微調整する（不足フィールドは読み取り時にオプショナル扱い）。
 */

// ------------------------------------------------------------
// 従業員一覧（GET /employees）
// ------------------------------------------------------------

export interface KotEmployee {
  /** 従業員コード（社員番号相当） */
  code: string;
  /** 従業員識別キー（不変。monthly-workings の employeeKey と対応） */
  key: string;
  lastName?: string;
  firstName?: string;
  lastNamePhonetics?: string;
  firstNamePhonetics?: string;
  divisionCode?: string;
  typeCode?: string;
  email?: string;
  employmentType?: string;
  hireDate?: string;   // YYYY-MM-DD
  retireDate?: string; // YYYY-MM-DD
}

// ------------------------------------------------------------
// 月別勤怠（GET /monthly-workings/{date}）
// ------------------------------------------------------------

/** KoT が持つ休暇種別カウント */
export interface KotHolidayObtained {
  /** 休暇名（例: "有休", "特休", "欠勤" 等） */
  name: string;
  /** 取得日数 */
  dayCount?: number;
  /** 取得時間（分） */
  minutes?: number;
}

/** 休日勤務の内訳（法定休日 / 一般休日 / 割増等） */
export interface KotHolidayWorkBlock {
  minutes?: number;
  dayCount?: number;
  [k: string]: unknown;
}

/**
 * 月別勤怠 1 行（1 従業員 1 月）
 *
 * 実機レスポンス（2026-04-24 疎通確認時点）で確認されたフィールドを反映。
 * 公式 API Doc の初期仕様に無かった（= 推測だった）項目は、実機で空だったため
 * オプショナル扱いのまま残している（将来 API 拡張時の互換性確保）。
 */
export interface KotMonthlyWorking {
  year: number;
  month: number;
  employeeKey: string;
  /** 集計対象期間の開始日（YYYY-MM-DD） */
  startDate?: string;
  /** 集計対象期間の終了日（YYYY-MM-DD） */
  endDate?: string;
  /** 締処理済か */
  isClosing?: boolean;

  // --- 日数・回数 ---
  /** 総勤務回数（打刻ベース） */
  workingCount?: number;
  /** 総勤務日数 */
  workingdayCount?: number;
  /** 平日勤務回数 */
  weekdayWorkingCount?: number;
  /** 平日勤務日数 */
  weekdayWorkingdayCount?: number;
  /** 遅刻回数 */
  lateCount?: number;
  /** 早退回数 */
  earlyLeaveCount?: number;
  /** 勤務間インターバル不足回数 */
  intervalShortageCount?: number;

  // --- 分単位の時間 ---
  /** 所定時間（分） */
  assigned?: number;
  /** 所定外時間（分） */
  unassigned?: number;
  /** 残業時間（分、法定外相当） */
  overtime?: number;
  /** 深夜労働時間（分） */
  night?: number;
  /** 深夜残業時間（分） */
  nightOvertime?: number;
  /** 深夜所定外時間（分） */
  nightUnassigned?: number;
  /** 遅刻時間（分） */
  late?: number;
  /** 早退時間（分） */
  earlyLeave?: number;
  /** 休憩時間合計（分） */
  breakSum?: number;
  /** みなし労働等の拘束時間（分） */
  bind?: number;
  /** 対象外時間（分） */
  regarding?: number;

  // --- 休日勤務 ---
  /** 休日勤務（総括） */
  holidayWork?: KotHolidayWorkBlock;
  /** 法定休日勤務 */
  legalHolidayWork?: KotHolidayWorkBlock;
  /** 一般休日（所定休日）勤務 */
  generalHolidayWork?: KotHolidayWorkBlock;
  /** 割増対象時間 */
  premiumWork?: KotHolidayWorkBlock;

  // --- 休暇（旧仕様／将来拡張用。現行レスポンスには無いが互換のため残す） ---
  /** 欠勤日数（現行レスポンスには含まれない可能性あり） */
  absentdayCount?: number;
  /** 休暇取得（有休等）。実機では `customMonthlyWorkings` に入っているケースあり */
  holidaysObtained?: KotHolidayObtained[];

  /** カスタム項目（企業ごとに任意定義。有休取得等が入る場合あり） */
  customMonthlyWorkings?: Array<{ code?: string; name?: string; minutes?: number; dayCount?: number }>;
}

// ------------------------------------------------------------
// 日次勤怠（GET /daily-workings/{date}）[Phase A-3-d]
// ------------------------------------------------------------

/**
 * KoT 日次勤怠 1 行（1 社員 1 日）。
 *
 * ⚠️ 実機レスポンス未確認の推定フィールド名（spec 通り camelCase / snake_case 混在可能性あり）。
 *   実機確認は `scripts/probe-kot.mjs` の daily probe（A-3-d で追加）を東海林 PC から
 *   実行して採取、差分があれば本型を調整する想定。すべての時間系は分 (minutes) 単位。
 */
export interface KotDailyWorking {
  /** 対象日（YYYY-MM-DD） */
  date: string;
  /** 社員識別キー（不変） */
  employeeKey: string;
  /** 社員コード（4 桁、employee_number と対応） */
  employeeCode?: string;

  /** 出勤打刻（未打刻は null / undefined） */
  clockIn?: string | null;
  /** 退勤打刻 */
  clockOut?: string | null;

  // --- 分単位の集計 ---
  /** 休憩合計（分） */
  breakMinutes?: number;
  /** 実労働（分） */
  workMinutes?: number;
  /** 残業（分、法定外相当） */
  overtimeMinutes?: number;
  /** 深夜（分） */
  nightMinutes?: number;
  /** 休日勤務（分） */
  holidayMinutes?: number;
  /** 遅刻（分） */
  lateMinutes?: number;
  /** 早退（分） */
  earlyLeaveMinutes?: number;

  /** 休暇種別（有休 / 特休 / 欠勤 / null 等） */
  leaveType?: string | null;
  /** 自由メモ */
  note?: string | null;

  /** 打刻履歴（出勤/退勤/休憩の開始/終了 の個別レコード） */
  timeRecords?: Array<{ type: string; time: string }>;
}

// ------------------------------------------------------------
// エラーレスポンス
// ------------------------------------------------------------

export interface KotApiErrorItem {
  message: string;
  code: number | string;
}
export interface KotApiError {
  errors?: KotApiErrorItem[];
  code?: string;
  message?: string;
}

/** エラーコード（公式 API Doc 抜粋） */
export const KOT_ERROR_CODES = {
  BAD_AUTHENTICATION: 111,
  RATE_LIMIT: 105,
  TOO_MANY_REQUESTS_303: 303,
  TOO_MANY_REQUESTS_308: 308,
  VALIDATION: 222,
  TIMESTAMP_FORMAT: 280,
  EMPLOYEE_KEY_MISSING: 526,
} as const;

// ------------------------------------------------------------
// Garden 内部の同期プレビュー表現
// ------------------------------------------------------------

export type KotSyncRowResolution =
  | { kind: "resolved"; employee_id: string; employee_name: string }
  | { kind: "warning"; employee_id: string; employee_name: string; reason: string }
  | { kind: "unresolved"; reason: string };

export interface KotSyncPreviewRow {
  /** プレビュー表示順（1-origin） */
  index: number;
  /** KoT 側の employeeKey（デバッグ用） */
  employee_key: string;
  /** KoT 側の code（分かれば、/employees から解決） */
  employee_code: string | null;
  /** 解決結果 */
  resolution: KotSyncRowResolution;
  /** 変換後の root_attendance 相当の値（resolution=unresolved の場合は null） */
  values: {
    target_month: string;     // YYYY-MM
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
  } | null;
  /** 元 KoT レスポンスのキー（冪等性担保のため root_attendance.kot_record_id に保存） */
  kot_record_id: string;
}

/** Server Action の戻り値 */
export type KotSyncPreviewResult =
  | {
      ok: true;
      /** mock モード識別 */
      source: "live" | "mock";
      target_month: string;
      /** プレビュー行 */
      rows: KotSyncPreviewRow[];
      /** KoT 側で行単位にエラーがあった場合の記述（ヘッダー欠落等） */
      warnings: string[];
      /** root_kot_sync_log に起票された行の id（クライアントから commit 時に再利用）。
       *  ログ挿入失敗時は undefined。 */
      log_id?: string;
    }
  | {
      ok: false;
      source: "live" | "mock";
      target_month: string;
      /** HTTP + エラーコード */
      error_code: string;
      /** ユーザー向けメッセージ */
      message: string;
      /** 開発時のみ詳細を入れる */
      detail?: unknown;
      /** 失敗時でも log_id は返す（client がログと紐付けて表示したいため） */
      log_id?: string;
    };

/**
 * KoT 月次勤怠 1 レコードを Garden の root_attendance 対応値へ変換する関数の入力。
 * 社員解決は呼出側で行う前提。
 */
export interface KotToAttendanceInput {
  target_month: string;
  monthly: KotMonthlyWorking;
}
