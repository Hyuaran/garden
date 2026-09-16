import JSZip from "jszip";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { assertMinimumCounts, parseZenginDate, parseZenginZip } from "./_lib";

describe("bank master import helpers", () => {
  it("updated_at を日付に直す", () => {
    expect(parseZenginDate("20260824")).toBe("2026-08-24");
  });

  it("件数の下限で失敗する", () => {
    expect(() => assertMinimumCounts({ banks: Array.from({ length: 999 }, (_, i) => ({ bank_code: String(i), bank_name: "b", bank_kana: null })), branchesByBank: {} })).toThrow(/unexpected_row_count/);
    expect(() => assertMinimumCounts({ banks: Array.from({ length: 1000 }, (_, i) => ({ bank_code: String(i), bank_name: "b", bank_kana: null })), branchesByBank: { "0001": Array.from({ length: 24999 }, (_, i) => ({ bank_code: "0001", branch_code: String(i), branch_name: "s", branch_kana: null })) } })).toThrow(/unexpected_row_count/);
  });

  it("zip から banks と銀行ごとの branches を読む", async () => {
    const zip = new JSZip();
    zip.file("source-data-master/data/banks.json", JSON.stringify({ "0036": { code: "0036", name: "楽天", kana: "ラクテン" } }));
    zip.file("source-data-master/data/branches/0036.json", JSON.stringify({ "244": { code: "244", name: "オンプ", kana: "オンプ" } }));
    const parsed = await parseZenginZip(await zip.generateAsync({ type: "arraybuffer" }));
    expect(parsed.banks[0].bank_code).toBe("0036");
    expect(parsed.branchesByBank["0036"][0].branch_code).toBe("244");
  });
});
