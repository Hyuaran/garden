import { expect, it } from "vitest";
import { listHeaders, readListCsv } from "./import-list.core";

it("BOM 付き CSV の番号と枝番、引用符内の改行、日付を扱う", () => {
  const fields: Record<string, string> = {
    ROWID: "1234567890123456789012",
    管理番号: " PD００１２（2） ",
    お客様番号: "00123456789012",
    電話番号1: "0123456789",
    供給地点特定番号: "0012345678901234567890",
    需要開始年月日: "(日付不正)",
    修正日: "2026/11/3",
    電気使用量1: "0001",
    電気使用量12: "0012",
    リスト名: "テスト,リスト\nテスト行",
  };
  const headers = [...listHeaders, "供給地点特定番号"];
  const csv = "\uFEFF" + headers.join(",") + "\r\n"
    + headers.map(header => `"${fields[header] ?? ""}"`).join(",") + "\r\n";
  const rows = [...readListCsv(csv)];
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    fm_rowid: fields.ROWID, kanri_no_raw: fields.管理番号, kanri_no: "12",
    customer_no: fields.お客様番号, phone1: fields.電話番号1, supply_point: fields.供給地点特定番号,
    supply_started_on: null, fm_updated_on: "2026-11-03", list_name: fields.リスト名,
    electricity_usage: ["0001", ...Array(10).fill(null), "0012"],
  });
});
