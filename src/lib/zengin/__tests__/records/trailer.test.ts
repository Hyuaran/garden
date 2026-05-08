import { describe, it, expect } from "vitest";
import { buildTrailerRecord } from "../../records/trailer";

describe("buildTrailerRecord", () => {
  it("トレーラレコードが 120 byte 固定長", () => {
    expect(buildTrailerRecord(3, 150000).length).toBe(120);
  });

  it("レコード種別が '8'（トレーラ）で始まる", () => {
    expect(buildTrailerRecord(3, 150000)[0]).toBe("8");
  });

  it("合計件数（6桁・右寄せ 0 埋め）", () => {
    const record = buildTrailerRecord(5, 150000);
    expect(record.substring(1, 7)).toBe("000005");
  });

  it("合計金額（12桁・右寄せ 0 埋め）", () => {
    const record = buildTrailerRecord(5, 150000);
    expect(record.substring(7, 19)).toBe("000000150000");
  });

  it("ダミー（101桁）", () => {
    const record = buildTrailerRecord(5, 150000);
    expect(record.substring(19, 120)).toBe(" ".repeat(101));
  });
});
