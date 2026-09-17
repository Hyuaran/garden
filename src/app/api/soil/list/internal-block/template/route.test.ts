import ExcelJS from "exceljs";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../_lib/auth", () => ({
  requireSoilListUser: vi.fn(async () => ({ ok: true })),
}));

import { GET } from "./route";

describe("internal block template route", () => {
  it("returns an xlsx template whose headers match the parser", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(response.headers.get("Content-Disposition")).toContain(encodeURIComponent("自社アポ禁_一括登録テンプレート.xlsx"));

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await response.arrayBuffer());
    const sheet = workbook.getWorksheet("一括登録");
    expect(sheet?.getRow(1).values).toEqual([, "電話番号", "理由"]);
    expect(sheet?.getRow(2).getCell(1).value).toBe("03-1234-5678");
    expect(workbook.getWorksheet("書き方")?.getRow(2).getCell(2).value).toContain("ハイフンあり");
  });
});
