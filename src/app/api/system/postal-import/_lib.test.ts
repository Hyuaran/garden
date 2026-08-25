import { describe, expect, it } from "vitest";
import { JAPAN_POST_UTF8_URL, parseJapanPostCsv, postalSourceDate } from "./_lib";

describe("postal import", () => {
  it("uses the current Japan Post UTF-8 download URL", () => {
    expect(JAPAN_POST_UTF8_URL).toBe("https://www.post.japanpost.jp/service/search/zipcode/download/utf/zip/utf_ken_all.zip");
  });
  it("parses duplicate candidates and special rows", () => {
    const csv = [
      '"13101","100  ","1000001","ﾄｳｷｮｳﾄ","ﾁﾖﾀﾞｸ","ﾁﾖﾀﾞ","東京都","千代田区","千代田",0,0,0,0,0,0',
      '"13101","100  ","1000001","ﾄｳｷｮｳﾄ","ﾁﾖﾀﾞｸ","ｲｶﾆｹｲｻｲｶﾞﾅｲﾊﾞｱｲ","東京都","千代田区","以下に掲載がない場合",0,0,0,0,0,0',
    ].join("\n");
    const rows = parseJapanPostCsv(csv); expect(rows).toHaveLength(2); expect(rows[1].is_special).toBe(true);
  });
  it("uses the first day of the source month", () => expect(postalSourceDate("Tue, 25 Aug 2026 00:00:00 GMT")).toBe("2026-08-01"));
});
