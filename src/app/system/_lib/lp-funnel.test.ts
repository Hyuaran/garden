// WEBインバウンドの「対応」と「結果」（仕様書 v1.7 §5.6）＝§13 の検算表を偽データで再現する
import { describe, expect, it } from "vitest";

import type { LpCustomerRecord, LpScopeBusiness } from "./lp-kintone";
import {
  buildLpFunnel,
  formCountInRange,
  lpFunnelLine,
  normalizePhoneNumber,
  type LpFunnelBusiness,
  type LpFunnelCalls,
  type LpFunnelInboundCall,
  type LpFunnelOutboundCall,
} from "./lp-funnel";

// ---------- 偽データの作り方 ----------

// JST の「2026-10-13 10:00」→ UTC の ISO 文字列
const jst = (text: string) => new Date(`${text.replace(" ", "T")}:00+09:00`).toISOString();
const AS_OF = new Date("2026-10-13T23:59:59+09:00");
const DAY = "2026-10-13";

const HIKARI: LpScopeBusiness = { bizCode: "hikari-pro", bizName: "ヒカリのプロ", customerApp: 226, circuitIds: [164, 165], recordOrder: 1 };
const DENKI: LpScopeBusiness = { bizCode: "denki", bizName: "電気開始受付センター", customerApp: 235, circuitIds: [166, 133], recordOrder: 2 };
const SCOPE = [HIKARI, DENKI];

function inboundCall(circuit: number, number: string, time: string, status: number, callee: string | null = status === 1 ? "2003" : ""): LpFunnelInboundCall {
  return { circuit_id: circuit, caller_num_norm: normalizePhoneNumber(number), start_time: jst(time), dial_status: status, callee_num: callee };
}

function outboundCall(ext: string, number: string, time: string, status: number, circuit = 168): LpFunnelOutboundCall {
  return { callee_num_norm: normalizePhoneNumber(number), start_time: jst(time), dial_status: status, caller_num: ext, circuit_id: circuit };
}

let recordSeq = 0;
function record(
  phone: string | null,
  status: string | null,
  options: { createdAt?: string; source?: unknown; slot?: unknown; phones?: Record<string, unknown> } = {},
): LpCustomerRecord {
  recordSeq += 1;
  return {
    id: String(recordSeq),
    createdAt: options.createdAt ? jst(options.createdAt) : jst("2026-10-01 10:00"),
    status,
    assignee: "担当A",
    source: "source" in options ? options.source : "",
    slot: options.slot ?? [],
    phones: { phone, "電話番号_ハイフンなし": "", "携帯番号_ハイフンなし": "", 架電連絡先: "", ...(options.phones ?? {}) },
  };
}

// フォーム（source=HP・期間内）
function form(phone: string | null, status: string | null, createdAt: string, slot: string[] = []) {
  return record(phone, status, { createdAt, source: "HP", slot });
}

// ---------- ヒカリのプロ（§13） ----------
// 入電 12（応答 10・不在 2→折り返し繋がった 2）・形式外 2 回・フォーム 3（指定あり 2 どおり・指定なし 1 締切まで）

const H = (n: number) => `0900000${String(n).padStart(3, "0")}`; // H(1)=0900000001
const HF1 = "0900000101"; // フォームと入電が重なる番号
const HF2 = "0900000102";
const HF3 = "0900000103";

const hikariInbound: LpFunnelInboundCall[] = [
  // 応答できた 10（H1 は不在のあとに応答＝応答できた側）
  inboundCall(164, H(1), "2026-10-13 10:00", 3),
  inboundCall(164, H(1), "2026-10-13 10:30", 1, "2011"),
  ...[2, 3, 4, 5, 6, 7, 8, 9].map((n) => inboundCall(164, H(n), `2026-10-13 ${10 + (n % 8)}:${String(n * 5).padStart(2, "0")}`, 1)),
  inboundCall(165, H(10), "2026-10-13 12:34", 1, "2034"), // 記録なしになる応答
  // 応答できなかった 2（折り返して繋がった）
  inboundCall(164, H(11), "2026-10-13 11:00", 3),
  inboundCall(164, H(12), "2026-10-13 11:10", 2),
  // 形式外（北米の形・1＋10 桁）2 回＝入電に含めない
  inboundCall(164, "12125551234", "2026-10-13 13:00", 3),
  inboundCall(165, "12125559999", "2026-10-13 13:30", 3),
  // フォームと重なる番号からの着信（フォームより前）＝入電では数えない
  inboundCall(164, HF1, "2026-10-13 09:00", 1),
];

const hikariOutbound: LpFunnelOutboundCall[] = [
  outboundCall("2003", H(11), "2026-10-13 11:20", 1),
  outboundCall("2011", H(12), "2026-10-13 11:30", 3),
  outboundCall("2011", H(12), "2026-10-13 12:00", 1),
  outboundCall("2003", HF1, "2026-10-13 13:00", 1), // 枠 12:00-15:00 の中
  outboundCall("2006", HF2, "2026-10-13 16:00", 1), // 枠 15:00-18:00 の中
  outboundCall("2005", HF3, "2026-10-13 09:00", 1), // 5 時台受付→締切 12:00。その前に繋がった
  outboundCall("2003", H(11), "2026-10-14 10:00", 1), // 翌日の発信（as_of より後）＝見ない
];

const hikariRecords: LpCustomerRecord[] = [
  form(HF1, "申込み", "2026-10-13 10:00", ["12:00-15:00"]),
  form(HF2, "申込み", "2026-10-13 11:00", ["15:00-18:00", "18:00-20:00"]),
  form(HF3, "対応中", "2026-10-13 05:30"),
  // 入電の相手（全レコードから番号で突き合わせ）
  record(H(1), "見送り", { createdAt: "2026-09-01 10:00" }), // 古い方
  record(null, "申込み", { createdAt: "2026-10-13 11:00", phones: { "携帯番号_ハイフンなし": "0900-000-001" } }), // 新しい方＝こちらを採る
  ...[2, 3, 4, 5, 6].map((n) => record(H(n), "申込み")),
  record(H(7), "未対応"),
  record(null, "未対応", { phones: { 架電連絡先: "+81-900-000-008" } }), // 国番号の形でも一致
  record(H(9), "見送り"),
  record(H(10), "重複", { createdAt: "2026-10-13 13:00", source: "HP", slot: [] }), // 重複は候補から除く → 記録なし（フォームにも数えない）
  record(H(11), "申込み"),
  record(H(12), "前確待ち"),
  // フォームに数えないもの
  form("0900000999", "申込み", "2026-10-12 23:50"), // 前日の受付
  record("0900000998", "重複", { createdAt: "2026-10-13 12:00", source: "HP" }), // 重複
  record("0900000997", "未対応", { createdAt: "2026-10-13 12:00", source: "" }), // 流入元が空＝手入力
];

// ---------- 電気開始受付センター（§13） ----------
// 入電 10（応答 8・不在 2→折り返し繋がった 2）・フォーム 8（全件 指定なし＝締切まで 5・締切超 1・判定待ち 2）

const D = (n: number) => `0800000${String(n).padStart(3, "0")}`;
const DF = (n: number) => `0800000${String(200 + n)}`; // DF(1)=0800000201

const denkiInbound: LpFunnelInboundCall[] = [
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => inboundCall(166, D(n), `2026-10-13 ${10 + n}:00`, 1, "2006")),
  inboundCall(166, D(9), "2026-10-13 15:00", 3),
  inboundCall(133, D(10), "2026-10-13 15:30", 3),
  // フォームと重なる 3 番号
  inboundCall(166, DF(1), "2026-10-13 14:30", 1, "2034"), // フォーム受付（14:00）のあとお客様から電話＝話せた
  inboundCall(166, DF(2), "2026-10-13 10:05", 3), // 不在→担当が発信して繋がる
  inboundCall(166, DF(3), "2026-10-13 09:00", 1), // フォームより前の着信
];

const denkiOutbound: LpFunnelOutboundCall[] = [
  outboundCall("2006", D(9), "2026-10-13 15:20", 1),
  outboundCall("2034", D(10), "2026-10-13 15:40", 1),
  outboundCall("2034", DF(2), "2026-10-13 10:30", 1),
  outboundCall("2006", DF(3), "2026-10-13 11:30", 1),
  outboundCall("2005", DF(4), "2026-10-13 15:10", 3),
  outboundCall("2005", DF(4), "2026-10-13 16:00", 1),
  outboundCall("2003", DF(5), "2026-10-13 18:30", 1),
  outboundCall("2011", DF(6), "2026-10-13 16:00", 1), // 受付 12:00→締切 14:00 を過ぎてから繋がった
];

const denkiRecords: LpCustomerRecord[] = [
  form(DF(1), "申込み", "2026-10-13 14:00"),
  form(DF(2), "申込み", "2026-10-13 10:00"),
  form(DF(3), "申込み", "2026-10-13 11:00"),
  form(DF(4), "見送り", "2026-10-13 15:00"),
  form(DF(5), "対象外（連絡つかず）", "2026-10-13 17:00"),
  form(DF(6), "対象外（現アナ等）", "2026-10-13 12:00"),
  form(DF(7), "未対応", "2026-10-13 22:10"), // 22 時台→締切 翌日 12:00＝判定待ち
  form(DF(8), "未対応", "2026-10-13 22:40"),
  ...[1, 2, 3].map((n) => record(D(n), "申込み")),
  record(D(4), "見送り"),
  record(D(5), "前確NG"),
  record(D(6), "対象外（契約不可）"),
  record(D(7), "未対応"),
  // D(8) は記録なし
  record(D(9), "申込み"),
  record(D(10), "対象外（契約不可）"),
];

const CALLS: LpFunnelCalls = {
  inbound: [...hikariInbound, ...denkiInbound],
  outbound: [...hikariOutbound, ...denkiOutbound],
};

function recordsMap(entries: Array<[number, LpCustomerRecord[] | null]>) {
  return new Map<number, LpCustomerRecord[] | null>(entries);
}

const RECORDS = recordsMap([
  [226, hikariRecords],
  [235, denkiRecords],
]);

function build(overrides: Partial<Parameters<typeof buildLpFunnel>[0]> = {}) {
  return buildLpFunnel({ from: DAY, to: DAY, asOf: AS_OF, scope: SCOPE, recordsByApp: RECORDS, calls: CALLS, ...overrides });
}

const counts = (connected: number, notConnected: number, noCall: number) => ({ connected, notConnected, noCall });

// ---------- テスト ----------

describe("normalizePhoneNumber（番号の正規化）", () => {
  it("数字だけにし、先頭 81 で 11 桁以上なら 0 に置き換える", () => {
    expect(normalizePhoneNumber("090-1234-5678")).toBe("09012345678");
    expect(normalizePhoneNumber("+81 90 1234 5678")).toBe("09012345678");
    expect(normalizePhoneNumber("819012345678")).toBe("09012345678");
    expect(normalizePhoneNumber("81901234")).toBe("81901234"); // 11 桁未満はそのまま
    expect(normalizePhoneNumber("")).toBeNull();
    expect(normalizePhoneNumber(null)).toBeNull();
    expect(normalizePhoneNumber("abc")).toBeNull();
  });
});

describe("buildLpFunnel（§13 の検算表・as_of=2026-10-13 23:59:59）", () => {
  const result = build();
  const hikari = result.businesses[0];
  const denki = result.businesses[1];

  it("事業はレコード番号順に並び、注記は無い", () => {
    expect(result.businesses.map((biz) => biz.bizName)).toEqual(["ヒカリのプロ", "電気開始受付センター"]);
    expect(result.notes).toEqual([]);
    expect(result.asOf).toBe(AS_OF.toISOString());
  });

  it("ヒカリのプロ：表A（対応）", () => {
    expect(hikari).toMatchObject({
      total: 15,
      inbound: 12,
      answered: 10,
      unanswered: 2,
      callbackConnected: 2,
      callbackNotConnected: 0,
      noCallback: 0,
      forms: 3,
      withSlot: 2,
      onTime: counts(2, 0, 0),
      late: counts(0, 0, 0),
      pendingWithSlot: counts(0, 0, 0),
      noSlot: 1,
      noSlotOnTime: counts(1, 0, 0),
      noSlotLate: counts(0, 0, 0),
      noSlotPending: counts(0, 0, 0),
      invalidNumberForms: 0,
      unknownInboundCalls: 2,
      pendingCount: 0,
    });
    expect(hikari.answerRate).toBeCloseTo(10 / 12, 10);
  });

  it("ヒカリのプロ：表B（結果）＝話せた 15＝10＋2＋3・受注 9／対応中 4／見送り 1／対象外 0／記録なし 1", () => {
    expect(hikari).toMatchObject({
      spoke: 15,
      spokeInbound: 10,
      spokeCallback: 2,
      spokeForm: 3,
      won: 9,
      inProgress: 4,
      lost: 1,
      excluded: 0,
      noRecord: 1,
    });
    expect(hikari.contactRate).toBeCloseTo(15 / 15, 10);
    expect(hikari.wonRate).toBeCloseTo(9 / 15, 10);
    expect(hikari.excludedRate).toBe(0);
    expect(hikari.effectiveWonRate).toBeCloseTo(9 / 15, 10);
    expect(hikari.calcNotes).toEqual([]);
  });

  it("ヒカリのプロ：記録なしの一覧＝着信日時・発信元番号・応答した内線", () => {
    expect(hikari.noRecordList).toEqual([{ startTime: jst("2026-10-13 12:34"), number: H(10), extension: "2034" }]);
  });

  it("電気開始受付センター：表A（対応）", () => {
    expect(denki).toMatchObject({
      total: 18,
      inbound: 10,
      answered: 8,
      unanswered: 2,
      callbackConnected: 2,
      callbackNotConnected: 0,
      noCallback: 0,
      forms: 8,
      withSlot: 0,
      onTime: counts(0, 0, 0),
      late: counts(0, 0, 0),
      pendingWithSlot: counts(0, 0, 0),
      noSlot: 8,
      noSlotOnTime: counts(5, 0, 0),
      noSlotLate: counts(1, 0, 0),
      noSlotPending: counts(0, 0, 2),
      invalidNumberForms: 0,
      unknownInboundCalls: 0,
      pendingCount: 2,
    });
    expect(denki.answerRate).toBeCloseTo(8 / 10, 10);
  });

  it("電気開始受付センター：表B（結果）＝話せた 16＝8＋2＋6・受注 7／対応中 1／見送り 3／対象外 4／記録なし 1", () => {
    expect(denki).toMatchObject({
      spoke: 16,
      spokeInbound: 8,
      spokeCallback: 2,
      spokeForm: 6,
      won: 7,
      inProgress: 1,
      lost: 3,
      excluded: 4,
      noRecord: 1,
    });
    expect(denki.contactRate).toBeCloseTo(16 / 18, 10);
    expect(denki.wonRate).toBeCloseTo(7 / 16, 10);
    expect(denki.excludedRate).toBeCloseTo(4 / 16, 10);
    expect(denki.effectiveWonRate).toBeCloseTo(7 / 12, 10);
    expect(denki.noRecordList).toEqual([{ startTime: jst("2026-10-13 18:00"), number: D(8), extension: "2006" }]);
  });

  it("合計列＝2 事業の和・率は和から計算", () => {
    expect(result.totals).toMatchObject({
      bizName: "合計",
      total: 33,
      inbound: 22,
      answered: 18,
      forms: 11,
      noSlotOnTime: counts(6, 0, 0),
      noSlotPending: counts(0, 0, 2),
      spoke: 31,
      won: 16,
      excluded: 4,
      noRecord: 2,
      pendingCount: 2,
    });
    expect(result.totals?.answerRate).toBeCloseTo(18 / 22, 10);
    expect(result.totals?.effectiveWonRate).toBeCloseTo(16 / 27, 10);
    expect(result.totals?.noRecordList).toHaveLength(2);
  });

  it("本文の 1 行（lpFunnelLine）＝判定待ち・⚠記録なし を末尾に", () => {
    expect(lpFunnelLine(hikari)).toBe(
      "ヒカリのプロ：応答率 83.3％（10/12）／話せた 15／受注率 60.0％（9/15）・対象外率 0.0％・有効受注率 60.0％ ⚠記録なし 1件＝kintone に登録の無い応答。ポータルで番号を確かめて登録",
    );
    expect(lpFunnelLine(denki)).toBe(
      "電気開始受付センター：応答率 80.0％（8/10）／話せた 16／受注率 43.8％（7/16）・対象外率 25.0％・有効受注率 58.3％（判定待ち 2） ⚠記録なし 1件＝kintone に登録の無い応答。ポータルで番号を確かめて登録",
    );
  });
});

describe("buildLpFunnel（個別の決まり）", () => {
  const BIZ: LpScopeBusiness = { bizCode: "x", bizName: "テスト事業", customerApp: 226, circuitIds: [164], recordOrder: 1 };

  function single(records: LpCustomerRecord[] | null, calls: LpFunnelCalls | null, asOf = AS_OF): LpFunnelBusiness {
    return buildLpFunnel({ from: DAY, to: DAY, asOf, scope: [BIZ], recordsByApp: recordsMap([[226, records]]), calls }).businesses[0];
  }

  it("同じ番号が入電とフォームに重なる→フォームの 1 件に寄せ、入電では数えない", () => {
    const biz = single(
      [form("09011110001", "申込み", "2026-10-13 10:00", ["10:00-12:00"])],
      { inbound: [inboundCall(164, "09011110001", "2026-10-13 10:30", 1)], outbound: [] },
    );
    expect(biz.inbound).toBe(0);
    expect(biz.forms).toBe(1);
    expect(biz.total).toBe(1);
    expect(biz.onTime).toEqual(counts(1, 0, 0)); // お客様からの着信に応答＝通話成功と同じ
    expect(biz.spokeForm).toBe(1);
    expect(biz.won).toBe(1);
  });

  it("枠より前に話せたフォーム→「時間指定どおり」", () => {
    const biz = single(
      [form("09011110002", "未対応", "2026-10-13 11:00", ["15:00-18:00"])],
      { inbound: [], outbound: [outboundCall("2003", "09011110002", "2026-10-13 12:00", 1)] },
    );
    expect(biz.onTime).toEqual(counts(1, 0, 0));
    expect(biz.inProgress).toBe(1);
  });

  it("指定ありで枠の中に発信が無く締切を過ぎた→「どおりでない」（枠より前の不在の発信は繋がらない）", () => {
    const biz = single(
      [form("09011110003", "未対応", "2026-10-13 09:00", ["10:00-12:00"])],
      { inbound: [], outbound: [outboundCall("2003", "09011110003", "2026-10-13 09:30", 3)] },
    );
    expect(biz.onTime).toEqual(counts(0, 0, 0));
    expect(biz.late).toEqual(counts(0, 1, 0));
    expect(biz.pendingWithSlot).toEqual(counts(0, 0, 0));
    expect(biz.spoke).toBe(0);
  });

  it("指定ありで枠の中に発信があれば繋がらなくても「どおり」", () => {
    const biz = single(
      [form("09011110004", "未対応", "2026-10-13 09:00", ["10:00-12:00"])],
      { inbound: [], outbound: [outboundCall("2003", "09011110004", "2026-10-13 10:30", 3)] },
    );
    expect(biz.onTime).toEqual(counts(0, 1, 0));
  });

  it("受付が枠の終わりより後→翌日の同じ枠が締切＝当日の as_of では「判定待ち」", () => {
    const biz = single([form("09011110005", "未対応", "2026-10-13 13:00", ["10:00-12:00"])], { inbound: [], outbound: [] });
    expect(biz.pendingWithSlot).toEqual(counts(0, 0, 1));
    expect(biz.pendingCount).toBe(1);
    // 翌日 12:00 を過ぎれば「どおりでない」
    const later = single([form("09011110005", "未対応", "2026-10-13 13:00", ["10:00-12:00"])], { inbound: [], outbound: [] }, new Date("2026-10-14T12:00:01+09:00"));
    expect(later.late).toEqual(counts(0, 0, 1));
  });

  it("指定なし：受付時間内は受付＋2 時間が締切。as_of が締切前なら「判定待ち」、過ぎれば「どおりでない」", () => {
    const forms = [form("09011110006", "未対応", "2026-10-13 14:00")];
    const calls = { inbound: [], outbound: [outboundCall("2003", "09011110006", "2026-10-13 16:30", 3)] };
    expect(single(forms, calls, new Date("2026-10-13T15:59:59+09:00")).noSlotPending).toEqual(counts(0, 0, 1)); // 16:30 の発信は as_of より後＝見ない
    expect(single(forms, calls, new Date("2026-10-13T17:00:00+09:00")).noSlotLate).toEqual(counts(0, 1, 0));
    expect(single(forms, { inbound: [], outbound: [outboundCall("2003", "09011110006", "2026-10-13 15:00", 3)] }).noSlotOnTime).toEqual(counts(0, 1, 0));
  });

  it("指定なし：21:00 以降の受付は翌日 12:00・10:00 前の受付は当日 12:00 が締切", () => {
    const night = single([form("09011110007", "未対応", "2026-10-13 21:00")], { inbound: [], outbound: [] }, new Date("2026-10-14T11:59:00+09:00"));
    expect(night.noSlotPending).toEqual(counts(0, 0, 1));
    const nightLate = single([form("09011110007", "未対応", "2026-10-13 21:00")], { inbound: [], outbound: [] }, new Date("2026-10-14T12:00:01+09:00"));
    expect(nightLate.noSlotLate).toEqual(counts(0, 0, 1));
    const morning = single([form("09011110008", "未対応", "2026-10-13 05:30")], { inbound: [], outbound: [] }, new Date("2026-10-13T11:59:00+09:00"));
    expect(morning.noSlotPending).toEqual(counts(0, 0, 1));
    const morningLate = single([form("09011110008", "未対応", "2026-10-13 05:30")], { inbound: [], outbound: [] }, new Date("2026-10-13T12:00:01+09:00"));
    expect(morningLate.noSlotLate).toEqual(counts(0, 0, 1));
  });

  it("番号不備のフォーム＝総数に入れるが指定あり／なしの内訳と判定には入れない", () => {
    const biz = single([form("", "未対応", "2026-10-13 10:00"), form("12125550000", "未対応", "2026-10-13 10:00")], { inbound: [], outbound: [] });
    expect(biz.forms).toBe(2);
    expect(biz.invalidNumberForms).toBe(2);
    expect(biz.withSlot).toBe(0);
    expect(biz.noSlot).toBe(0);
    expect(biz.total).toBe(2);
    expect(biz.spoke).toBe(0);
    expect(biz.contactRate).toBe(0);
  });

  it("折り返し＝最初の不在より後の担当の内線からの発信だけ。外線からの発信や不在より前の発信は数えない", () => {
    const calls: LpFunnelCalls = {
      inbound: [inboundCall(164, "09011110009", "2026-10-13 12:00", 3), inboundCall(164, "09011110010", "2026-10-13 12:00", 3)],
      outbound: [
        outboundCall("2003", "09011110009", "2026-10-13 11:00", 1), // 不在より前
        outboundCall("0312345678", "09011110009", "2026-10-13 13:00", 1), // 外線＝担当の内線ではない
        outboundCall("2003", "09011110010", "2026-10-13 13:00", 3),
      ],
    };
    const biz = single([], calls);
    expect(biz.unanswered).toBe(2);
    expect(biz.noCallback).toBe(1);
    expect(biz.callbackNotConnected).toBe(1);
    expect(biz.callbackConnected).toBe(0);
  });

  it("対応状況が未知の値→「対応中」に入れて calcNotes に残す", () => {
    const biz = single(
      [record("09011110011", "保留中", { createdAt: "2026-10-01 10:00" })],
      { inbound: [inboundCall(164, "09011110011", "2026-10-13 12:00", 1)], outbound: [] },
    );
    expect(biz.inProgress).toBe(1);
    expect(biz.calcNotes).toEqual(["対応状況「保留中」は定義表に無い値のため「対応中」に数えました（1 件）"]);
  });

  it("着信の dial_status が 1・2・3 以外→応答にも不在にも数えず calcNotes", () => {
    const biz = single([], { inbound: [inboundCall(164, "09011110012", "2026-10-13 12:00", 9)], outbound: [] });
    expect(biz.inbound).toBe(0);
    expect(biz.calcNotes).toEqual(["着信の結果が応答でも不在でもない通話が 1 件あり、応答・不在のどちらにも数えていません"]);
  });

  it("入電の番号→レコードは複数一致なら作成日時が最新、重複は候補から除く", () => {
    const biz = single(
      [
        record("09011110013", "申込み", { createdAt: "2026-09-01 10:00" }),
        record("09011110013", "見送り", { createdAt: "2026-10-10 10:00" }),
        record("09011110013", "申込み", { createdAt: "2026-10-12 10:00" }),
      ],
      { inbound: [inboundCall(164, "09011110013", "2026-10-13 12:00", 1)], outbound: [] },
    );
    expect(biz.won).toBe(1);
    expect(biz.lost).toBe(0);
    const duplicated = single(
      [record("09011110013", "見送り", { createdAt: "2026-10-10 10:00" }), record("09011110013", "重複", { createdAt: "2026-10-12 10:00" })],
      { inbound: [inboundCall(164, "09011110013", "2026-10-13 12:00", 1)], outbound: [] },
    );
    expect(duplicated.lost).toBe(1);
  });

  it("INNOVERA の行が無い（calls=null）→電話に関わる行は null・notes に注記。フォームの数は出る", () => {
    const result = buildLpFunnel({
      from: DAY,
      to: DAY,
      asOf: AS_OF,
      scope: [BIZ],
      recordsByApp: recordsMap([[226, [form("09011110014", "申込み", "2026-10-13 10:00", ["10:00-12:00"]), form("09011110015", "申込み", "2026-10-13 10:00")]]]),
      calls: null,
    });
    const biz = result.businesses[0];
    expect(result.notes).toEqual(["この期間は通話履歴（INNOVERA）がありません。電話に関わる行は「-」です"]);
    expect(biz.forms).toBe(2);
    expect(biz.withSlot).toBe(1);
    expect(biz.noSlot).toBe(1);
    expect(biz.invalidNumberForms).toBe(0);
    for (const key of ["total", "inbound", "answered", "unanswered", "callbackConnected", "onTime", "noSlotOnTime", "unknownInboundCalls", "answerRate", "spoke", "won", "noRecord", "contactRate", "wonRate", "pendingCount"] as const) {
      expect(biz[key], key).toBeNull();
    }
    expect(result.totals?.inbound).toBeNull();
    expect(result.totals?.forms).toBe(2);
  });

  it("kintone が読めない（records=null）→フォームと結果の行は null・notes に注記。入電の数は出る", () => {
    const result = buildLpFunnel({
      from: DAY,
      to: DAY,
      asOf: AS_OF,
      scope: [BIZ],
      recordsByApp: recordsMap([[226, null]]),
      calls: { inbound: [inboundCall(164, "09011110016", "2026-10-13 10:00", 1), inboundCall(164, "09011110017", "2026-10-13 10:00", 3)], outbound: [] },
    });
    const biz = result.businesses[0];
    expect(result.notes).toEqual(["テスト事業：顧客アプリ（kintone）を読めませんでした。フォームと結果の行は「-」です"]);
    expect(biz.inbound).toBe(2);
    expect(biz.answered).toBe(1);
    expect(biz.noCallback).toBe(1);
    expect(biz.answerRate).toBeCloseTo(0.5, 10);
    for (const key of ["total", "forms", "withSlot", "noSlot", "invalidNumberForms", "onTime", "spoke", "spokeForm", "won", "noRecord", "contactRate", "wonRate", "pendingCount"] as const) {
      expect(biz[key], key).toBeNull();
    }
    expect(biz.calcNotes).toEqual(["顧客アプリを読めなかったため、フォームと重なる番号を入電から除いていません"]);
  });

  it("事業が無ければ合計は null", () => {
    const result = buildLpFunnel({ from: DAY, to: DAY, asOf: AS_OF, scope: [], recordsByApp: recordsMap([]), calls: CALLS });
    expect(result.businesses).toEqual([]);
    expect(result.totals).toBeNull();
  });
});

describe("lpFunnelLine（読めないときの「-」）", () => {
  it("null の値は「-」で出し、判定待ち・記録なしの付け足しは無い", () => {
    const biz = buildLpFunnel({ from: DAY, to: DAY, asOf: AS_OF, scope: [HIKARI], recordsByApp: RECORDS, calls: null }).businesses[0];
    expect(lpFunnelLine(biz)).toBe("ヒカリのプロ：応答率 -（-/-）／話せた -／受注率 -（-/-）・対象外率 -・有効受注率 -");
  });
});

describe("formCountInRange（当日のフォーム受付数＝0 件判定用）", () => {
  it("source=HP・期間内・重複以外を事業横断で数える。読めないアプリは 0", () => {
    expect(formCountInRange(SCOPE, RECORDS, DAY, DAY)).toBe(11);
    expect(formCountInRange(SCOPE, RECORDS, "2026-10-12", "2026-10-12")).toBe(1);
    expect(formCountInRange(SCOPE, recordsMap([[226, null], [235, denkiRecords]]), DAY, DAY)).toBe(8);
  });
});
