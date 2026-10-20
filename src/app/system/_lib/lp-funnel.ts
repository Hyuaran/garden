// WEBインバウンドの「対応」と「結果」（仕様書 v1.7 §5.6）
// INNOVERA の通話履歴（RPC system_innovera_funnel_calls の返り）と kintone 顧客アプリのレコードを
// 電話番号で突き合わせ、事業ごとの表A（対応）・表B（結果）・本文の 1 行・記録なしの一覧を作る純粋な計算部品。
// 画面・配信・PDF が共用する。外部サービスは呼ばない。判断はすべて JST。

import type { LpCustomerRecord, LpScopeBusiness } from "./lp-kintone";

// ---------- 入力の型（RPC の返り） ----------

export type LpFunnelInboundCall = {
  circuit_id: number;
  caller_num_norm: string | null;
  start_time: string;
  dial_status: number | null;
  callee_num: string | null;
};

export type LpFunnelOutboundCall = {
  callee_num_norm: string | null;
  start_time: string;
  dial_status: number | null;
  caller_num: string | null;
  circuit_id: number | null;
};

export type LpFunnelCalls = {
  inbound: LpFunnelInboundCall[];
  outbound: LpFunnelOutboundCall[];
};

// ---------- 出力の型 ----------

// 繋がった・繋がらない・発信なし
export type LpFunnelCounts = { connected: number; notConnected: number; noCall: number };

export type LpFunnelBusiness = {
  bizCode: string;
  bizName: string;
  total: number | null; // 入電＋フォーム
  inbound: number | null; // 入電（番号あり・フォームと重なる番号を除く）
  answered: number | null; // うち応答できた
  unanswered: number | null; // うち応答できなかった
  callbackConnected: number | null;
  callbackNotConnected: number | null;
  noCallback: number | null;
  forms: number | null; // フォーム
  withSlot: number | null;
  onTime: LpFunnelCounts | null;
  late: LpFunnelCounts | null;
  pendingWithSlot: LpFunnelCounts | null;
  noSlot: number | null;
  noSlotOnTime: LpFunnelCounts | null;
  noSlotLate: LpFunnelCounts | null;
  noSlotPending: LpFunnelCounts | null;
  invalidNumberForms: number | null; // 番号不備
  unknownInboundCalls: number | null; // （参考）番号不明・形式外の着信の回数（総数に含めない）
  answerRate: number | null; // 応答できた÷入電（0〜1）
  spoke: number | null; // 応答（話せた）
  spokeInbound: number | null;
  spokeCallback: number | null;
  spokeForm: number | null;
  won: number | null;
  inProgress: number | null;
  lost: number | null;
  excluded: number | null;
  noRecord: number | null;
  contactRate: number | null; // 話せた÷総数
  wonRate: number | null; // 受注÷話せた
  excludedRate: number | null; // 対象外÷話せた
  effectiveWonRate: number | null; // 受注÷（話せた−対象外）
  pendingCount: number | null; // 判定待ちの合計
  noRecordList: Array<{ startTime: string; number: string; extension: string | null }>;
  calcNotes: string[];
};

export type LpFunnelResult = {
  businesses: LpFunnelBusiness[];
  totals: LpFunnelBusiness | null;
  asOf: string;
  notes: string[];
};

export type LpFunnelInput = {
  from: string; // JST の日付 'YYYY-MM-DD'
  to: string; // JST の日付 'YYYY-MM-DD'（両端を含む）
  asOf: Date; // 集計した時点
  scope: LpScopeBusiness[];
  recordsByApp: Map<number, LpCustomerRecord[] | null>; // 読めなかったアプリは null
  calls: LpFunnelCalls | null; // null＝INNOVERA の行なし
};

// ---------- 定数 ----------

// 受付時間（指定なしのフォームの締切に使う）
const RECEPTION_START_HOUR = 10;
const RECEPTION_END_HOUR = 21;
const NO_SLOT_DEADLINE_HOURS = 2;
const AFTER_HOURS_DEADLINE_HOUR = 12; // 受付時間外は次の 10:00 から 2 時間＝12:00

// 対応状況 → 結果（§5.6.4 の対応表）
type ResultKey = "won" | "inProgress" | "lost" | "excluded";
const RESULT_BY_STATUS: Record<string, ResultKey> = {
  申込み: "won",
  // ヒカリのプロ・電気開始受付センターの顧客アプリは「申込み」が「前確OK」に変わった（2026-10-20 確認）。どちらも受注として数える
  前確OK: "won",
  未対応: "inProgress",
  対応中: "inProgress",
  前確待ち: "inProgress",
  見送り: "lost",
  前確NG: "lost",
  "対象外（現アナ等）": "excluded",
  "対象外（契約不可）": "excluded",
  "対象外（連絡つかず）": "excluded",
};
const DUPLICATE_STATUS = "重複";
const FORM_SOURCE = "HP";

const DIAL_ANSWERED = 1;
const DIAL_MISSED = new Set([2, 3]);

const PHONE_FIELDS = ["phone", "電話番号_ハイフンなし", "携帯番号_ハイフンなし", "架電連絡先"] as const;

// ---------- 番号の正規化（SQL の system_innovera_norm_number と同じ規則） ----------

/** 数字だけにし、先頭が 81 で 11 桁以上なら先頭の 81 を 0 に置き換える。空なら null */
export function normalizePhoneNumber(value: unknown): string | null {
  if (value == null) return null;
  const digits = String(value).replace(/[^0-9]/g, "");
  if (!digits) return null;
  if (digits.startsWith("81") && digits.length >= 11) return `0${digits.slice(2)}`;
  return digits;
}

/** 正規化後に先頭が 0 で 9 桁以上なら「番号あり」。それ以外は「番号不明・形式外」 */
export function isValidPhoneNumber(normalized: string | null): normalized is string {
  return !!normalized && normalized.startsWith("0") && normalized.length >= 9;
}

// 担当の内線＝3〜5 桁の数字（固定の内線も日ごとの席も。外線は 9 桁以上）
function isStaffExtension(callerNum: string | null): boolean {
  return !!callerNum && /^\d{3,5}$/.test(callerNum.trim());
}

// ---------- JST の時刻 ----------

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

type JstParts = { y: number; m: number; d: number; h: number; min: number; s: number };

function jstParts(date: Date): JstParts {
  const shifted = new Date(date.getTime() + JST_OFFSET_MS);
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth() + 1,
    d: shifted.getUTCDate(),
    h: shifted.getUTCHours(),
    min: shifted.getUTCMinutes(),
    s: shifted.getUTCSeconds(),
  };
}

// JST の年月日時分秒から Date を作る（日の繰り上がりは Date.UTC に任せる）
function jstDate(y: number, m: number, d: number, h = 0, min = 0, s = 0): Date {
  return new Date(Date.UTC(y, m - 1, d, h, min, s) - JST_OFFSET_MS);
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function jstDateString(date: Date): string {
  const p = jstParts(date);
  return `${p.y}-${pad2(p.m)}-${pad2(p.d)}`;
}

function parseTime(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// ---------- kintone の値の読み方 ----------

function textOf(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "number") {
    const normalized = String(value).trim();
    return normalized || null;
  }
  return null;
}

// source（流入元）が HP か。文字列でも複数選択（配列）でもよい
function isFormSource(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => textOf(item) === FORM_SOURCE);
  return textOf(value) === FORM_SOURCE;
}

// slot（希望時間帯・複数選択）を文字列の配列に
function slotsOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(textOf).filter((item): item is string => !!item);
  const single = textOf(value);
  return single ? [single] : [];
}

// 「10:00-12:00」→ 00:00 からの分（始まり・終わり）。読めない形は null
function parseSlot(slot: string): { start: number; end: number } | null {
  const match = slot.replace(/[：]/g, ":").match(/^\s*(\d{1,2}):(\d{2})\s*[-〜~ー－]\s*(\d{1,2}):(\d{2})\s*$/);
  if (!match) return null;
  const start = Number(match[1]) * 60 + Number(match[2]);
  const end = Number(match[3]) * 60 + Number(match[4]);
  if (end <= start) return null;
  return { start, end };
}

// ---------- 締切と枠（§5.6.3） ----------

type Window = { start: Date; end: Date };
type Deadline = { deadline: Date; windows: Window[]; hasSlot: boolean };

function deadlineOf(createdAt: Date, slots: string[]): Deadline {
  const parsed = slots.map(parseSlot).filter((item): item is { start: number; end: number } => item !== null);
  const p = jstParts(createdAt);
  if (parsed.length > 0) {
    // 指定あり＝選んだ枠の終わり（複数なら最後の枠）。受付が枠の終わりより後なら翌日の同じ枠
    const last = parsed.reduce((acc, item) => (item.end >= acc.end ? item : acc));
    const endToday = jstDate(p.y, p.m, p.d, 0, last.end);
    const dayOffset = createdAt.getTime() > endToday.getTime() ? 1 : 0;
    const windows = parsed.map((item) => ({
      start: jstDate(p.y, p.m, p.d + dayOffset, 0, item.start),
      end: jstDate(p.y, p.m, p.d + dayOffset, 0, item.end),
    }));
    return { deadline: jstDate(p.y, p.m, p.d + dayOffset, 0, last.end), windows, hasSlot: true };
  }
  // 指定なし＝受付＋2 時間。受付時間（10:00〜21:00）の外は次の 10:00 から 2 時間
  let deadline: Date;
  if (p.h < RECEPTION_START_HOUR) deadline = jstDate(p.y, p.m, p.d, AFTER_HOURS_DEADLINE_HOUR);
  else if (p.h >= RECEPTION_END_HOUR) deadline = jstDate(p.y, p.m, p.d + 1, AFTER_HOURS_DEADLINE_HOUR);
  else deadline = new Date(createdAt.getTime() + NO_SLOT_DEADLINE_HOURS * HOUR_MS);
  return { deadline, windows: [{ start: createdAt, end: deadline }], hasSlot: false };
}

// ---------- 内部の型 ----------

type FormItem = {
  record: LpCustomerRecord;
  createdAt: Date;
  number: string | null; // 正規化した phone。形式外・空は null
};

type InboundNumber = {
  number: string;
  calls: LpFunnelInboundCall[]; // start_time 昇順
};

type Judgement = "onTime" | "late" | "pending";
type ConnectState = "connected" | "notConnected" | "noCall";

function emptyCounts(): LpFunnelCounts {
  return { connected: 0, notConnected: 0, noCall: 0 };
}

function sumCounts(counts: LpFunnelCounts) {
  return counts.connected + counts.notConnected + counts.noCall;
}

function rate(numerator: number | null, denominator: number | null): number | null {
  if (numerator == null || denominator == null || denominator <= 0) return null;
  return numerator / denominator;
}

function timeOf(call: { start_time: string }): number {
  return parseTime(call.start_time)?.getTime() ?? Number.NaN;
}

function byStartTime<T extends { start_time: string }>(a: T, b: T) {
  return timeOf(a) - timeOf(b);
}

// 対応状況 → 結果。定義表に無い値は「対応中」に入れて呼び出し側が注記する
function resultOf(status: string | null): { key: ResultKey; unknown: boolean } {
  const normalized = status?.trim() ?? "";
  const key = RESULT_BY_STATUS[normalized];
  if (key) return { key, unknown: false };
  return { key: "inProgress", unknown: true };
}

// ---------- 事業ごとの計算 ----------

function buildBusiness(
  biz: LpScopeBusiness,
  input: LpFunnelInput,
  outboundByNumber: Map<string, LpFunnelOutboundCall[]> | null,
  notes: string[],
): LpFunnelBusiness {
  const asOfMs = input.asOf.getTime();
  const calcNotes: string[] = [];
  const records = input.recordsByApp.get(biz.customerApp) ?? null;
  const hasRecords = records !== null;
  const hasCalls = input.calls !== null && outboundByNumber !== null;

  if (!hasRecords) notes.push(`${biz.bizName}：顧客アプリ（kintone）を読めませんでした。フォームと結果の行は「-」です`);

  // --- フォームの母集団（§5.6.1） ---
  const forms: FormItem[] = [];
  if (records) {
    for (const record of records) {
      if (!isFormSource(record.source)) continue;
      if ((record.status?.trim() ?? "") === DUPLICATE_STATUS) continue;
      const createdAt = parseTime(record.createdAt);
      if (!createdAt) continue;
      const day = jstDateString(createdAt);
      if (day < input.from || day > input.to) continue;
      const normalized = normalizePhoneNumber(record.phones?.phone);
      forms.push({ record, createdAt, number: isValidPhoneNumber(normalized) ? normalized : null });
    }
  }
  const formNumbers = new Set(forms.map((form) => form.number).filter((item): item is string => item !== null));

  // --- 入電の母集団（§5.6.1） ---
  const circuitIds = new Set(biz.circuitIds);
  const inboundByNumber = new Map<string, LpFunnelInboundCall[]>();
  let unknownInboundCalls = 0;
  let unknownStatusCalls = 0;
  if (input.calls) {
    const rows = input.calls.inbound.filter((call) => circuitIds.has(call.circuit_id)).sort(byStartTime);
    for (const call of rows) {
      const number = call.caller_num_norm;
      if (!isValidPhoneNumber(number)) {
        unknownInboundCalls += 1;
        continue;
      }
      if (call.dial_status !== DIAL_ANSWERED && !DIAL_MISSED.has(call.dial_status ?? -1)) unknownStatusCalls += 1;
      const list = inboundByNumber.get(number);
      if (list) list.push(call);
      else inboundByNumber.set(number, [call]);
    }
  }
  if (unknownStatusCalls > 0) calcNotes.push(`着信の結果が応答でも不在でもない通話が ${unknownStatusCalls} 件あり、応答・不在のどちらにも数えていません`);

  // 入電＝番号ごと 1 件。フォームと重なる番号はフォームに寄せる
  const inboundNumbers: InboundNumber[] = [];
  for (const [number, calls] of inboundByNumber) {
    if (formNumbers.has(number)) continue;
    const judged = calls.filter((call) => call.dial_status === DIAL_ANSWERED || DIAL_MISSED.has(call.dial_status ?? -1));
    if (judged.length === 0) continue; // 応答でも不在でもない通話しか無い番号は数えない（注記済み）
    inboundNumbers.push({ number, calls: judged });
  }
  if (!hasRecords && inboundNumbers.length > 0) {
    calcNotes.push("顧客アプリを読めなかったため、フォームと重なる番号を入電から除いていません");
  }

  // --- 入電の対応（§5.6.2） ---
  let answered = 0;
  let unanswered = 0;
  const callback = emptyCounts();
  const spokeItems: Array<{ kind: "inbound" | "callback" | "form"; number: string | null; form: FormItem | null; firstCall: LpFunnelInboundCall | null; extension: string | null }> = [];
  for (const item of inboundNumbers) {
    const answeredCall = item.calls.find((call) => call.dial_status === DIAL_ANSWERED);
    if (answeredCall) {
      answered += 1;
      spokeItems.push({ kind: "inbound", number: item.number, form: null, firstCall: item.calls[0], extension: textOf(answeredCall.callee_num) });
      continue;
    }
    unanswered += 1;
    const firstMissedMs = timeOf(item.calls[0]);
    const callbacks = (outboundByNumber?.get(item.number) ?? []).filter((call) => timeOf(call) > firstMissedMs && timeOf(call) <= asOfMs);
    const connectedCall = callbacks.find((call) => call.dial_status === DIAL_ANSWERED);
    if (connectedCall) {
      callback.connected += 1;
      spokeItems.push({ kind: "callback", number: item.number, form: null, firstCall: item.calls[0], extension: textOf(connectedCall.caller_num) });
    } else if (callbacks.length > 0) callback.notConnected += 1;
    else callback.noCall += 1;
  }

  // --- フォームの対応（§5.6.3） ---
  let withSlot = 0;
  let noSlot = 0;
  let invalidNumberForms = 0;
  const slotGroups: Record<Judgement, LpFunnelCounts> = { onTime: emptyCounts(), late: emptyCounts(), pending: emptyCounts() };
  const noSlotGroups: Record<Judgement, LpFunnelCounts> = { onTime: emptyCounts(), late: emptyCounts(), pending: emptyCounts() };
  for (const form of forms) {
    if (form.number === null) {
      invalidNumberForms += 1;
      continue;
    }
    const { deadline, windows, hasSlot } = deadlineOf(form.createdAt, slotsOf(form.record.slot));
    if (hasSlot) withSlot += 1;
    else noSlot += 1;
    if (!hasCalls) continue;
    const createdMs = form.createdAt.getTime();
    const deadlineMs = deadline.getTime();
    // 発信＝担当の内線からフォームの番号へ（受付以降・as_of まで・回線は問わない）
    const dials = (outboundByNumber?.get(form.number) ?? []).filter((call) => timeOf(call) >= createdMs && timeOf(call) <= asOfMs);
    // 通話成功＝発信の応答、またはフォームの番号からの着信に応答した分
    const successMs = dials
      .filter((call) => call.dial_status === DIAL_ANSWERED)
      .map(timeOf)
      .concat(
        (inboundByNumber.get(form.number) ?? [])
          .filter((call) => call.dial_status === DIAL_ANSWERED && timeOf(call) >= createdMs && timeOf(call) <= asOfMs)
          .map(timeOf),
      );
    const dialInWindow = dials.some((call) => {
      const ms = timeOf(call);
      return ms <= deadlineMs && windows.some((w) => ms >= w.start.getTime() && ms <= w.end.getTime());
    });
    const successByDeadline = successMs.some((ms) => ms <= deadlineMs);
    let judgement: Judgement;
    if (dialInWindow || successByDeadline) judgement = "onTime";
    else if (asOfMs < deadlineMs) judgement = "pending";
    else judgement = "late";
    const state: ConnectState = successMs.length > 0 ? "connected" : dials.length > 0 ? "notConnected" : "noCall";
    (hasSlot ? slotGroups : noSlotGroups)[judgement][state] += 1;
    if (state === "connected") spokeItems.push({ kind: "form", number: form.number, form, firstCall: null, extension: null });
  }

  // --- 結果（§5.6.4） ---
  const recordIndex = hasRecords ? buildRecordIndex(records) : null;
  const results = { won: 0, inProgress: 0, lost: 0, excluded: 0, noRecord: 0 };
  const unknownStatuses = new Map<string, number>();
  const noRecordList: LpFunnelBusiness["noRecordList"] = [];
  if (hasRecords && hasCalls) {
    for (const item of spokeItems) {
      let record: LpCustomerRecord | null = null;
      if (item.kind === "form") record = item.form?.record ?? null;
      else record = item.number ? (recordIndex?.get(item.number) ?? null) : null;
      if (!record) {
        results.noRecord += 1;
        noRecordList.push({ startTime: item.firstCall?.start_time ?? "", number: item.number ?? "", extension: item.extension });
        continue;
      }
      const { key, unknown } = resultOf(record.status);
      results[key] += 1;
      if (unknown) {
        const label = record.status?.trim() || "（空）";
        unknownStatuses.set(label, (unknownStatuses.get(label) ?? 0) + 1);
      }
    }
  }
  for (const [label, count] of unknownStatuses) {
    calcNotes.push(`対応状況「${label}」は定義表に無い値のため「対応中」に数えました（${count} 件）`);
  }

  // --- 組み立て（読めない行は null） ---
  const phone = <T>(value: T): T | null => (hasCalls ? value : null);
  const form = <T>(value: T): T | null => (hasRecords ? value : null);
  const both = <T>(value: T): T | null => (hasCalls && hasRecords ? value : null);

  const inbound = phone(inboundNumbers.length);
  const formsCount = form(forms.length);
  const spokeInbound = phone(answered);
  const spokeCallback = phone(callback.connected);
  const spokeForm = both(
    sumConnected(slotGroups) + sumConnected(noSlotGroups),
  );
  const spoke = both((spokeInbound ?? 0) + (spokeCallback ?? 0) + (spokeForm ?? 0));
  const total = both((inbound ?? 0) + (formsCount ?? 0));
  const pendingCount = both(sumCounts(slotGroups.pending) + sumCounts(noSlotGroups.pending));

  return {
    bizCode: biz.bizCode,
    bizName: biz.bizName,
    total,
    inbound,
    answered: phone(answered),
    unanswered: phone(unanswered),
    callbackConnected: phone(callback.connected),
    callbackNotConnected: phone(callback.notConnected),
    noCallback: phone(callback.noCall),
    forms: formsCount,
    withSlot: form(withSlot),
    onTime: both(slotGroups.onTime),
    late: both(slotGroups.late),
    pendingWithSlot: both(slotGroups.pending),
    noSlot: form(noSlot),
    noSlotOnTime: both(noSlotGroups.onTime),
    noSlotLate: both(noSlotGroups.late),
    noSlotPending: both(noSlotGroups.pending),
    invalidNumberForms: form(invalidNumberForms),
    unknownInboundCalls: phone(unknownInboundCalls),
    answerRate: rate(phone(answered), inbound),
    spoke,
    spokeInbound,
    spokeCallback,
    spokeForm,
    won: both(results.won),
    inProgress: both(results.inProgress),
    lost: both(results.lost),
    excluded: both(results.excluded),
    noRecord: both(results.noRecord),
    contactRate: rate(spoke, total),
    wonRate: rate(both(results.won), spoke),
    excludedRate: rate(both(results.excluded), spoke),
    effectiveWonRate: rate(both(results.won), spoke == null ? null : spoke - results.excluded),
    pendingCount,
    noRecordList,
    calcNotes,
  };
}

function sumConnected(groups: Record<Judgement, LpFunnelCounts>) {
  return groups.onTime.connected + groups.late.connected + groups.pending.connected;
}

// 番号 → レコード（全レコード・番号 4 項目のどれか・重複は除く・複数は作成日時が最新）
function buildRecordIndex(records: LpCustomerRecord[]): Map<string, LpCustomerRecord> {
  const index = new Map<string, LpCustomerRecord>();
  for (const record of records) {
    if ((record.status?.trim() ?? "") === DUPLICATE_STATUS) continue;
    const numbers = new Set<string>();
    for (const field of PHONE_FIELDS) {
      const normalized = normalizePhoneNumber(record.phones?.[field]);
      if (isValidPhoneNumber(normalized)) numbers.add(normalized);
    }
    for (const number of numbers) {
      const current = index.get(number);
      if (!current || (parseTime(record.createdAt)?.getTime() ?? 0) >= (parseTime(current.createdAt)?.getTime() ?? 0)) {
        index.set(number, record);
      }
    }
  }
  return index;
}

// ---------- 合計列 ----------

const NUMBER_KEYS = [
  "total", "inbound", "answered", "unanswered", "callbackConnected", "callbackNotConnected", "noCallback",
  "forms", "withSlot", "noSlot", "invalidNumberForms", "unknownInboundCalls",
  "spoke", "spokeInbound", "spokeCallback", "spokeForm",
  "won", "inProgress", "lost", "excluded", "noRecord", "pendingCount",
] as const;
const COUNTS_KEYS = ["onTime", "late", "pendingWithSlot", "noSlotOnTime", "noSlotLate", "noSlotPending"] as const;

function sumNullable(values: Array<number | null>): number | null {
  let sum = 0;
  for (const value of values) {
    if (value == null) return null; // どれかが「-」なら合計も「-」
    sum += value;
  }
  return sum;
}

function sumCountsNullable(values: Array<LpFunnelCounts | null>): LpFunnelCounts | null {
  const sum = emptyCounts();
  for (const value of values) {
    if (!value) return null;
    sum.connected += value.connected;
    sum.notConnected += value.notConnected;
    sum.noCall += value.noCall;
  }
  return sum;
}

function buildTotals(businesses: LpFunnelBusiness[]): LpFunnelBusiness | null {
  if (businesses.length === 0) return null;
  const totals = {
    bizCode: "total",
    bizName: "合計",
    noRecordList: businesses.flatMap((biz) => biz.noRecordList),
    calcNotes: businesses.flatMap((biz) => biz.calcNotes.map((note) => `${biz.bizName}：${note}`)),
  } as LpFunnelBusiness;
  for (const key of NUMBER_KEYS) totals[key] = sumNullable(businesses.map((biz) => biz[key]));
  for (const key of COUNTS_KEYS) totals[key] = sumCountsNullable(businesses.map((biz) => biz[key]));
  totals.answerRate = rate(totals.answered, totals.inbound);
  totals.contactRate = rate(totals.spoke, totals.total);
  totals.wonRate = rate(totals.won, totals.spoke);
  totals.excludedRate = rate(totals.excluded, totals.spoke);
  totals.effectiveWonRate = rate(totals.won, totals.spoke == null || totals.excluded == null ? null : totals.spoke - totals.excluded);
  return totals;
}

// ---------- 入口 ----------

export function buildLpFunnel(input: LpFunnelInput): LpFunnelResult {
  const notes: string[] = [];
  const asOfMs = input.asOf.getTime();

  // 発信を宛先の番号ごとに（担当の内線から・as_of まで・回線は問わない）
  let outboundByNumber: Map<string, LpFunnelOutboundCall[]> | null = null;
  if (input.calls) {
    outboundByNumber = new Map();
    const rows = input.calls.outbound
      .filter((call) => isStaffExtension(call.caller_num) && isValidPhoneNumber(call.callee_num_norm) && timeOf(call) <= asOfMs)
      .sort(byStartTime);
    for (const call of rows) {
      const number = call.callee_num_norm as string;
      const list = outboundByNumber.get(number);
      if (list) list.push(call);
      else outboundByNumber.set(number, [call]);
    }
  } else {
    notes.push("この期間は通話履歴（INNOVERA）がありません。電話に関わる行は「-」です");
  }

  const scope = [...input.scope].sort((a, b) => a.recordOrder - b.recordOrder);
  const businesses = scope.map((biz) => buildBusiness(biz, input, outboundByNumber, notes));
  return { businesses, totals: buildTotals(businesses), asOf: input.asOf.toISOString(), notes };
}

// ---------- 本文の 1 行（§5.6.5） ----------

function formatPercent(value: number | null): string {
  if (value == null) return "-";
  return `${(Math.round(value * 1000) / 10).toFixed(1)}％`;
}

function formatCount(value: number | null): string {
  return value == null ? "-" : String(value);
}

export function lpFunnelLine(biz: LpFunnelBusiness): string {
  let line =
    `${biz.bizName}：応答率 ${formatPercent(biz.answerRate)}（${formatCount(biz.answered)}/${formatCount(biz.inbound)}）` +
    `／話せた ${formatCount(biz.spoke)}` +
    `／受注率 ${formatPercent(biz.wonRate)}（${formatCount(biz.won)}/${formatCount(biz.spoke)}）` +
    `・対象外率 ${formatPercent(biz.excludedRate)}` +
    `・有効受注率 ${formatPercent(biz.effectiveWonRate)}`;
  if (biz.pendingCount != null && biz.pendingCount > 0) line += `（判定待ち ${biz.pendingCount}）`;
  if (biz.noRecord != null && biz.noRecord > 0) {
    line += ` ⚠記録なし ${biz.noRecord}件＝kintone に登録の無い応答。ポータルで番号を確かめて登録`;
  }
  return line;
}

// ---------- フォーム受付数（0 件スキップの判定用・§7） ----------

export function formCountInRange(
  scope: LpScopeBusiness[],
  recordsByApp: Map<number, LpCustomerRecord[] | null>,
  from: string,
  to: string,
): number {
  let count = 0;
  for (const biz of scope) {
    const records = recordsByApp.get(biz.customerApp);
    if (!records) continue;
    for (const record of records) {
      if (!isFormSource(record.source)) continue;
      if ((record.status?.trim() ?? "") === DUPLICATE_STATUS) continue;
      const createdAt = parseTime(record.createdAt);
      if (!createdAt) continue;
      const day = jstDateString(createdAt);
      if (day >= from && day <= to) count += 1;
    }
  }
  return count;
}
