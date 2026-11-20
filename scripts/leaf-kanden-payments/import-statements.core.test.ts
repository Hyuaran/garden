import { expect, it } from "vitest";
import { indexPaymentOrders, isStatementFile, matchPayment, paymentKanriKey, paymentService, parseStatementRow, statementColumns, statementMonth, type MatchOrder } from "./import-statements.core";

const headers = ["No.", "獲得担当\nフルネーム", "営業手法", "データー送信日\n申込書発送日",
  "門標※", "管理番号", "リスト", "契約名義", "契約名義（ｶﾅ）", "囲込 奪還", "契約品目",
  "コミッション\n請求額", "備考"];
const columns = statementColumns(headers);
const file = "プロディライト 支払詳細 2026.11月 スポット案件.xlsx";

it("確定版とスポット案件を対象にし、暫定や削除候補を除外する", () => {
  expect(isStatementFile(file)).toBe(true);
  expect(isStatementFile(file.replace(".xlsx", " 暫定.xlsx"))).toBe(false);
  expect(isStatementFile(file.replace(".xlsx", " 削除候補.xlsx"))).toBe(false);
  expect(isStatementFile(file.replace(".xlsx", ".pdf"))).toBe(false);
  expect(statementMonth(file.replace(".11月", ".9月"))).toBe("2026-09");
});

it("見出しで列を特定し、管理番号、日付、戻入額を変換する", () => {
  const values = ["26064-0001", "担当", "訪問", "2026/10/01", "000005", "PD00123（2）", "対象",
    "名義", "カナ", "囲込", "動力", { formula: "0-12000", result: -12000 }, "摘要"];
  expect(parseStatementRow(values, columns, "2026-11", file)).toEqual({
    pd_row_no: "26064-0001", statement_month: "2026-11", sales_name: "担当", sales_method: "訪問",
    sent_on: "2026-10-01", customer_no: "000005", kanri_no: "123", kanri_no_raw: "PD00123（2）",
    list_flag: "対象", customer_name: "名義", customer_kana: "カナ", acquisition: "囲込",
    item: "動力", amount: -12000, note: "摘要", source_file: file,
  });
  expect(parseStatementRow(["合計"], columns, "2026-11", file)).toBeNull();
  expect(parseStatementRow([""], columns, "2026-11", file)).toBeNull();
});

it.each([
  ["PD9876543", "9876543"],
  ["PD9876543動", "9876543"],
  ["PD9876543（2）", "9876543-2"],
  ["PD9876543（2）動", "9876543-2"],
  ["0123456789", "123456789"],
  ["ＰＤ００１２３（２）動", "123-2"],
  ["-", null],
  ["", null],
  ["PD123x", null],
])("管理番号 %s を照合用に正規化する", (raw, key) => {
  expect(paymentKanriKey(raw)).toBe(key);
});

it.each([
  ["【奪還】ビジネス動力", null, "douryoku"],
  ["低圧電力", null, "douryoku"],
  ["動", null, "douryoku"],
  ["電灯", "PD123（2）動", "douryoku"],
  ["関電ガスのみ", null, "gas"],
  ["【奪還】ビジネス電灯", null, "denki"],
  ["【奪還】ｅおとくプラン", null, "denki"],
  ["【奪還】なっトクでんき+なっトクプラン", null, "denki"],
  ["【奪還】なっトクでんきBiz（ガス既契約の場合）", null, "denki"],
  [null, null, "denki"],
] as const)("品目 %s と管理番号 %s から種類を判定する", (item, raw, service) => {
  expect(paymentService(item, raw)).toBe(service);
});

const order: MatchOrder = {
  id: "electric", kanri_no_raw: "PD00123", ordered_on: "2026-10-01",
  denki_customer_no: null, douryoku_customer_no: null, gas_customer_no: null,
  contract_type: "従量電灯B", power_apply: "なし",
  has_denki: null, has_douryoku: null, has_gas: null,
};
const row = { kanri_no_raw: "123", item: "電灯", customer_no: null, sent_on: "2026-10-10" };
const customer = "00123456789012";

it("種類に対応する門標を管理番号より優先する", () => {
  const matching = { ...order, id: "customer", kanri_no_raw: null, denki_customer_no: customer };
  const wrongService = { ...order, id: "power", douryoku_customer_no: customer };
  const orders = indexPaymentOrders([order, matching, wrongService]);
  expect(matchPayment({ ...row, customer_no: "００１２-３４５６-７８９０１２" }, orders))
    .toMatchObject({ order_id: "customer", matched_by: "customer", narrowed_by_date: false });
  expect(matchPayment({ ...row, customer_no: customer, item: "動力" }, orders).order_id).toBe("power");
});

it("門標が同じなら管理番号の枝番で絞る", () => {
  const base = { ...order, denki_customer_no: customer };
  const branch = { ...base, id: "branch", kanri_no_raw: "PD123（2）", ordered_on: "2026-09-01" };
  expect(matchPayment({ ...row, customer_no: customer, kanri_no_raw: "123(2)" }, indexPaymentOrders([base, branch])))
    .toMatchObject({ order_id: "branch", matched_by: "customer", narrowed_by_date: false });
});

it("門標が見つからないときは枝番と種類で照合する", () => {
  const power = { ...order, id: "power", contract_type: null, power_apply: "あり", kanri_no_raw: "PD123（2）" };
  const gas = { ...order, id: "gas", contract_type: "ガス" };
  const orders = indexPaymentOrders([order, power, gas]);
  expect(matchPayment({ ...row, kanri_no_raw: "123(2)動" }, orders))
    .toMatchObject({ order_id: "power", matched_by: "number" });
  expect(matchPayment({ ...row, item: "関電ガスのみ" }, orders).order_id).toBe("gas");
  expect(matchPayment({ ...row, item: "動力" }, orders).match_note).toBe("契約品目が合う受注なし");
});

it.each(["customer", "number"] as const)("複数候補（%s）は送信日以前の最新受注に絞る", method => {
  const base = { ...order, denki_customer_no: customer };
  const latest = { ...base, id: "latest", ordered_on: row.sent_on };
  const future = { ...base, id: "future", ordered_on: "2026-10-11" };
  const payment = { ...row, customer_no: method === "customer" ? customer : null };
  const orders = indexPaymentOrders([future, latest, base]);
  expect(matchPayment(payment, orders))
    .toMatchObject({ order_id: "latest", matched_by: method, narrowed_by_date: true });
  expect(matchPayment({ ...payment, sent_on: null }, orders).order_id).toBeNull();
  expect(matchPayment({ ...payment, sent_on: "2026-09-30" }, orders).order_id).toBeNull();
  expect(matchPayment(payment, indexPaymentOrders([latest, { ...latest, id: "tie" }])))
    .toMatchObject({ order_id: null, match_note: expect.any(String) });
});
