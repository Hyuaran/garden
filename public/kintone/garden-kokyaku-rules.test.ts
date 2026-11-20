import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

type User = { code: string; name?: string };
type Values = Record<string, string | number | null | string[] | User[]>;
const require = createRequire(import.meta.url);
const { applyKokyakuRules } = require("./garden-kokyaku-rules.js") as {
  applyKokyakuRules: (values: Values, today: string, user?: User) => Values;
};
const { applyJissekiRules } = require("./garden-jisseki-rules.js") as {
  applyJissekiRules: (values: Values) => Values;
};

const today = "2026-11-20";
const user = { code: "test-user", name: "担当者" };
const apply = (values: Values) => applyKokyakuRules(values, today, user);

describe("顧客一覧の条件分岐", () => {
  it.each([
    [1, "一括削除する", ""],
    [2, "上位店連携依頼へ変更", "上位店連携依頼"],
    [5, "キャンセル依頼へ変更", "キャンセル依頼"],
    [6, "書類郵送依頼へ変更", "書類郵送依頼"],
  ])("ルール %i の処理内容チェック", (_rule, option, division) => {
    expect(apply({
      チェックボックス: [option],
      処理区分: "変更前",
      処理希望日: today,
      処理希望時間から: "09:00",
      処理希望時間まで: "10:00",
      処理詳細: "詳細",
      処理共有事項: "共有",
    })).toEqual({
      処理区分: division,
      処理希望日: "",
      処理希望時間から: "",
      処理希望時間まで: "",
      処理詳細: "",
      処理共有事項: "",
    });
  });

  it("チェックの並びに関係なく設定順で後の処理区分を使う", () => {
    expect(apply({ チェックボックス: ["書類郵送依頼へ変更", "一括削除する"] }))
      .toEqual({ 処理区分: "書類郵送依頼" });
  });

  it.each(["トスアップ", "成約ベース"])("ルール 3 は %s の詳細を初期化する", (kind) => {
    expect(apply({ ドロップダウン_9: kind, 商材詳細ステータス: "" })).toEqual({
      商材詳細ステータス: "アポ待ち", 商材ステータス: "受注待ち",
    });
    expect(apply({ ドロップダウン_9: kind, 商材詳細ステータス: "高齢者フロー" })).toEqual({});
    expect(apply({ ドロップダウン_9: kind, 商材詳細ステータス: "不明" })).toEqual({});
  });

  it("ルール 3 は選択肢の一部分だけが一致する場合を除外する", () => {
    expect(apply({ ドロップダウン_9: "トスアップ対象外" })).toEqual({});
  });

  it("ルール 4 は 1 以上の数値を文字列のコードにコピーする", () => {
    expect(apply({ 数値_0: "001" })).toEqual({ パートナーコード: "001" });
    expect(apply({ 数値_0: 1 })).toEqual({ パートナーコード: "1" });
    expect(apply({ 数値_0: "0.99" })).toEqual({});
    expect(apply({ 数値_0: "abc" })).toEqual({});
    expect(apply({ 数値_0: "1", パートナーコード: "1" })).toEqual({});
  });

  it.each(["2026-11-19", today])("ルール 7 は開通日 %s を入金待ちにする", (date) => {
    expect(apply({
      開通日: date, ドロップダウン_39: "転用",
      ドロップダウン_9: "トスアップ", 商材詳細ステータス: "",
    })).toEqual({
      商材詳細ステータス: "入金待ち", 商材ステータス: "入金待ち", 開通日カウント_宮永テスト: "〇",
    });
  });

  it.each(["新設", "新規・新設", "流用", "新設　新規", "新設　流用"])("ルール 7 は工事種別 %s を除外する", (kind) => {
    expect(apply({ 開通日: today, ドロップダウン_39: kind }))
      .toEqual({ 開通日カウント_宮永テスト: "〇" });
  });

  it("ルール 7 は開通日が空欄または翌日なら作動しない", () => {
    expect(apply({ 開通日: null })).toEqual({});
    expect(apply({ 開通日: "2026-11-21" })).toEqual({ 開通日カウント_宮永テスト: "〇" });
  });

  it.each([
    [14, "ET日", "ET者名", { ET日カウント＿宮永テスト: "〇" }],
    [15, "決済登録日", "決済登録者名", {}],
    [16, "後確OK日", "後確者名", { 後確OK日カウント_宮永テスト: "〇" }],
    [17, "開通前FC日", "開通前FC者名", {}],
  ] as const)("ルール %i は %s が今日なら担当者を入力する", (_rule, field, output, counts) => {
    expect(apply({ [field]: today })).toEqual({ [output]: [user], ...counts });
    expect(apply({ [field]: "2026-11-19" })).not.toHaveProperty(output);
  });

  it("ルール 14 は同じユーザーコードとカウントを差分に含めない", () => {
    expect(apply({ ET日: today, ET者名: [{ code: user.code }], ET日カウント＿宮永テスト: "〇" }))
      .toEqual({});
  });

  it.each([
    [18, "解約", "解約"],
    [19, "完了", "完了"],
    [20, "支払待ち", "支払待ち"],
    [21, "工事後FC待ち", "入金待ち"],
    [21, "入金待ち", "入金待ち"],
    [22, "後確コール待ち", "後確待ち"],
    [22, "後確待ち", "後確待ち"],
    [23, "エントリー待ち", "エントリー待ち"],
    [24, "決済登録待ち", "開通待ち"],
    [24, "開通予定日待ち", "開通待ち"],
    [24, "工事前FC待ち", "開通待ち"],
    [24, "開通待ち", "開通待ち"],
    [25, "リトライ", "キャンセル"],
    [25, "キャンセル", "キャンセル"],
    [26, "アポ待ち", "受注待ち"],
  ])("ルール %i は %s を %s に対応させる", (_rule, detail, status) => {
    expect(apply({ ドロップダウン_9: "トスアップ", 商材詳細ステータス: detail }))
      .toEqual({ 商材ステータス: status });
  });

  it.each([
    [27, "後確OK日", "2023-01-01", "2022-12-31"],
    [28, "開通予定日", "2022-01-01", "2021-12-31"],
    [29, "キャンセル日", "2023-01-01", "2022-12-31"],
    [30, "開通日", "2022-01-01", "2021-12-31"],
  ])("ルール %i は %s の基準日を含む", (_rule, field, threshold, previous) => {
    const output = field + "カウント_宮永テスト";
    const values = { ドロップダウン_39: "新設" };
    expect(apply({ ...values, [field]: threshold })).toEqual({ [output]: "〇" });
    expect(apply({ ...values, [field]: previous })).toEqual({});
    expect(apply({ ...values, [field]: "", [output]: "〇" })).toEqual({});
  });

  it("実績ルールの結果を保ち、付与件数を変更しない", () => {
    const values = Object.freeze({
      立ち上げ日: today, リトライ日: today, キャンセル日: today,
      商材詳細ステータス: "キャンセル", 商材名区分2: "JUST光", 付与件数: "2",
    });
    const jisseki = applyJissekiRules(values);
    const kokyaku = apply({ ...values, ...jisseki });
    expect(kokyaku).toEqual({ 商材ステータス: "キャンセル", キャンセル日カウント_宮永テスト: "〇" });
    expect({ ...values, ...jisseki, ...kokyaku }).toMatchObject({ 実績日: today, 実績可否: "否", 付与件数: "2" });
    expect(applyJissekiRules({ ...values, ...apply(values) })).toEqual(jisseki);
  });
});

type FormEvent = { record: Record<string, { value: Values[string]; lookup?: boolean }> };

it("PC・スマホの作成・編集で項目変更を処理し、日本時間とルックアップを使う", () => {
  const handlers = new Map<string, (event: FormEvent) => FormEvent>();
  const script = readFileSync(require.resolve("./garden-kokyaku-rules.js"), "utf8");
  class FixedDate extends Date {
    constructor() { super("2026-11-19T15:00:00Z"); }
  }
  runInNewContext(script, {
    Date: FixedDate,
    kintone: {
      getLoginUser: () => user,
      events: {
        on: (events: string[], handler: (event: FormEvent) => FormEvent) => {
          for (const event of events) handlers.set(event, handler);
        },
      },
    },
  });
  expect([...handlers.keys()]).toHaveLength(48);
  expect([...handlers.keys()].every((name) => name.includes(".change."))).toBe(true);
  for (const screen of ["app.record.create", "app.record.edit", "mobile.app.record.create", "mobile.app.record.edit"]) {
    const event = { record: {
      ET日: { value: today },
      ET者名: { value: [] },
      数値_0: { value: "123" },
      パートナーコード: { value: "123" },
    } };
    expect(handlers.get(screen + ".change.数値_0")?.(event)).toBe(event);
    expect(event.record.パートナーコード).toEqual({ value: "123", lookup: true });
    expect(event.record.ET者名.value).toEqual([]);
    expect(handlers.get(screen + ".change.ET日")?.(event)).toBe(event);
    expect(event.record.ET者名.value).toEqual([user]);
  }
});
