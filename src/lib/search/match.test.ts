import { describe, expect, it } from "vitest";
import { limitHits, matchRange, normalizeSearch, searchRank, validSearch, type SearchHit } from "./match";
describe("Garden search matching", () => {
  it("matches numeric columns, commas, full width and case", () => {
    for (const query of ["1000", "1,000", "１，０００"]) for (const value of [1000, "1,000", "１０００"]) expect(searchRank(value, query)).toBe(0);
    expect(searchRank("Ｇａｒｄｅｎ", "garden")).toBe(0);
  });
  it("normalizes phone separators and dates", () => {
    expect(searchRank("03-1234-5678", "0312345678", true)).toBe(0);
    expect(searchRank("2026-11-02", "2026/11/02")).toBe(0);
    expect(normalizeSearch("２０２６／１１／０２")).toBe("2026-11-02");
  });
  it("allows one Japanese character and requires two Latin/digit characters", () => {
    for (const text of ["氏", "あ", "10", "ab", "ＡＢ"]) expect(validSearch(text)).toBe(true);
    for (const text of ["", " ", "1", "a", "１", ","]) expect(validSearch(text)).toBe(false);
  });
  it("sorts exact before prefix before substring, newest first, limits each group", () => {
    const hits = Array.from({length:25}, (_, i) => ({id:String(i), rank:i%3, updated:`2026-10-${String(i+1).padStart(2,"0")}`} as SearchHit));
    const result = limitHits(hits,5);
    expect(result.hits).toHaveLength(5); expect(result.more).toBe(true);
    expect(result.hits[0].id).toBe("24"); expect(result.hits.every(hit=>hit.rank===0)).toBe(true);
    expect(limitHits(hits,20).hits).toHaveLength(20);
  });
  it("highlights the original fullwidth/comma/phone text", () => {
    expect(matchRange("金額１，０００円", "1000")).toEqual([2,7]);
    expect(matchRange("電話 03-1234-5678", "0312345678", true)).toEqual([3,15]);
  });
});
