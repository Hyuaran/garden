import { describe, expect, it } from "vitest";

import { mapFileMakerShineigyoRow, normalizeShineigyoPhone, parseShineigyoIngestBody } from "./shineigyo-ingest";

const runId = "123e4567-e89b-42d3-a456-426614174000";
const baseRow = {
  主キー: "1001.000",
  電話番号_ハイフンなし: "０３-１２３４-５６７８",
  携帯番号_ハイフンなし: "090 1111 2222",
  リスト名: "【光回線】フレッツ_20260911",
  営業ID: "2027231.0",
  受注日: "2026-09-11T00:00:00",
  既契約情報: "ドコモ光",
  既契約回線タイプ: "",
  既契約継続有無: null,
  修正日: "2026/09/11 10:00",
};

describe("shineigyo ingest mapping", () => {
  it("normalizes identifiers, dates, and phone numbers for the snapshot table", () => {
    const row = mapFileMakerShineigyoRow(baseRow, runId, "2026-09-13T00:00:00.000Z");
    expect(row).toMatchObject({
      "主キー": "1001",
      "電話番号": "0312345678",
      "携帯番号": "09011112222",
      "営業ID": "2027231",
      "受注日": "2026-09-11",
      "既契約情報": "ドコモ光",
      "既契約回線タイプ": null,
      run_id: runId,
    });
  });

  it("keeps only digits in phone numbers after NFKC normalization", () => {
    expect(normalizeShineigyoPhone("０９０-１２３４-５６７８")).toBe("09012345678");
    expect(normalizeShineigyoPhone("")).toBeNull();
  });

  it("accepts the PowerShell camelCase payload and reports invalid rows without values", () => {
    const result = parseShineigyoIngestBody({
      runId,
      batchIndex: 0,
      rows: [baseRow, { ...baseRow, 主キー: "" }],
    }, "2026-09-13T00:00:00.000Z");
    expect(result.valid).toHaveLength(1);
    expect(result.rejected).toEqual([{ index: 1, code: "INVALID_PRIMARY_KEY", message: "主キーが有効なDECIMALではありません" }]);
  });
});
