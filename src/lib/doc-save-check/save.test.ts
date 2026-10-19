import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/app/api/bud/expense-drive/_lib/drive", () => ({ findOrCreateSubfolder: vi.fn(async () => "folder"), uploadToFolder: vi.fn(async () => ({ id: "id", webViewLink: null })) }));
import { findOrCreateSubfolder, uploadToFolder } from "@/app/api/bud/expense-drive/_lib/drive";
import { createSaver, savedFilename } from "./save";
import { mail } from "./test-fixtures";
describe("未整理フォルダへの保存", () => {
  afterEach(() => vi.clearAllMocks());
  it("JST受信日・差出人・元の名前を使い、使えない文字を置換", async () => {
    expect(savedFilename(mail, '契約書?.pdf')).toBe("20261028_A_B_契約書_.pdf");
    const save = createSaver();
    await save("root", mail, "契約書.pdf", Buffer.from("x"), "application/pdf");
    await save("root", mail, "条件表.xlsx", Buffer.from("y"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(findOrCreateSubfolder).toHaveBeenCalledExactlyOnceWith("root", "00_自動保存（未整理）");
    expect(uploadToFolder).toHaveBeenCalledTimes(2);
  });
});
