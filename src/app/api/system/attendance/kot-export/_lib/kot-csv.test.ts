import iconv from "iconv-lite";
import { describe, expect, it } from "vitest";
import { buildKotCsvText, encodeKotCsv, formatKotJstDateTime, getKotImportRange, toKotPunchCode, type KotExportRow } from "./kot-csv";

const row = (overrides:Partial<KotExportRow>={}):KotExportRow => ({ id:1, punch_type:"clock_in", punched_at:"2026-08-12T15:01:59.999Z", root_employees:{name:"山田 太郎",kot_employee_id:"EMP001"}, ...overrides });

describe("KOT punch CSV", () => {
  it("maps all punch types", () => { expect(["clock_in","clock_out","break_start","break_end"].map((type)=>toKotPunchCode(type as KotExportRow["punch_type"]))).toEqual(["1","2","3","4"]); });
  it("formats UTC as JST and drops seconds across a day boundary", () => { expect(formatKotJstDateTime("2026-08-12T15:01:59.999Z")).toBe("202608130001"); });
  it("builds headerless CRLF rows and encodes Japanese names as Shift-JIS without BOM", () => { const buffer=encodeKotCsv([row()]); expect(iconv.decode(buffer,"Shift_JIS")).toBe("EMP001,山田 太郎,1,202608130001\r\n"); expect(buffer.subarray(0,3).equals(Buffer.from([0xef,0xbb,0xbf]))).toBe(false); });
  it("quotes CSV metacharacters", () => { expect(buildKotCsvText([row({root_employees:{name:'山田, "太郎"',kot_employee_id:"EMP001"}})])).toContain('"山田, ""太郎"""'); });
  it("rejects missing/invalid employee codes and unrepresentable characters", () => { expect(()=>encodeKotCsv([row({root_employees:{name:"山田",kot_employee_id:null}})])).toThrow("未設定"); expect(()=>encodeKotCsv([row({root_employees:{name:"😀",kot_employee_id:"EMP001"}})])).toThrow("Shift-JIS"); });
  it("uses inclusive six/one calendar month boundaries", () => { expect(getKotImportRange(new Date("2026-08-31T12:34:56Z"))).toEqual({from:"2026-02-28T12:34:56.000Z",to:"2026-09-30T12:34:56.000Z"}); });
  it("calculates calendar-month boundaries in JST", () => { expect(getKotImportRange(new Date("2026-08-31T16:00:00Z"))).toEqual({from:"2026-02-28T16:00:00.000Z",to:"2026-09-30T16:00:00.000Z"}); });
});
