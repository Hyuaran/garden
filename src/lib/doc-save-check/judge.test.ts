import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { reportMessage } from "./notify";
import { judgeMails, normalizedVersionName } from "./judge";
import { mail, attachment } from "./test-fixtures";
const md5 = createHash("md5").update(Buffer.from(attachment.contentBytes, "base64")).digest("hex");
describe("MD5 の照合", () => {
  it("転送が先に並んでいても外部の元メールを優先し、一件だけ数える", async () => {
    const forwarded = { ...mail, id: "forward", sender: "keiri@hyuaran.com", subject: "Re: Fw: 契約書" };
    const result = await judgeMails([forwarded, mail], { content: async () => attachment.contentBytes, attachments: async () => [attachment], index: async () => new Set(), wasSaved: async () => false });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].mail).toBe(mail);
    expect(result.counts).toMatchObject({ attachments: 1, missing: 1 });
  });
  it("エフプレインの保存済み再送版で古い3件を除外し、自動保存も通知もしない", async () => {
    const base = "【株式会社リンクサポート様】auひかりプラス条件表_2026年10月";
    const rows = [
      { date: "2026-10-13T19:53:00+09:00", names: [`${base}.pdf`, `${base}.xlsx`] },
      { date: "2026-10-13T21:06:00+09:00", names: [`再送${base}.xlsx`] },
      { date: "2026-10-14T19:52:00+09:00", names: [`再々送${base}.xlsx`, `再送${base}.pdf`] },
    ];
    const mails = rows.map((row, i) => ({ ...mail, id: String(i), sender: "takahashi@f-plain.co.jp", toRecipients: ["keiri@link-support-osaka.com"], receivedAt: row.date }));
    const bytes = (id: string) => Buffer.alloc(1024, Number(id) + 1);
    const save = vi.fn();
    const result = await judgeMails(mails, {
      attachments: async m => rows[Number(m.id)].names.map((name, i) => ({ ...attachment, id: String(Number(m.id) * 2 + i), name })),
      content: async (_, a) => bytes(a.id).toString("base64"),
      index: async () => new Set(["4", "5"].map(id => createHash("md5").update(bytes(id)).digest("hex"))),
      wasSaved: async () => false, save, record: vi.fn(),
    });
    expect(result.items.map(i => i.status)).toEqual(["superseded", "superseded", "superseded", "saved", "saved"]);
    expect(result.counts).toMatchObject({ missing: 0, superseded: 3, saved: 2 });
    expect(save).not.toHaveBeenCalled();
    const report = reportMessage("2026-10-19", result.items, result.counts);
    expect(report).toContain("新しい版が保存済みの古い版 3 件");
    expect(report).not.toContain(base);
  });
  it.each(["domain", "extension", "older", "history", "missing"])("%s は古い版の照合元にしない", async reason => {
    const newer = { ...mail, id: "new", sender: reason === "domain" ? "x@other.jp" : mail.sender, receivedAt: reason === "older" ? "2026-10-26T00:00:00Z" : mail.receivedAt };
    const other = Buffer.alloc(1024, 2).toString("base64");
    const save = vi.fn(async () => ({ id: "f", url: "test", fileName: "test" }));
    const result = await judgeMails([mail, newer], {
      attachments: async m => [{ ...attachment, name: m.id === "new" ? `再送契約書.${reason === "extension" ? "xlsx" : "pdf"}` : attachment.name }],
      content: async m => m.id === "new" ? other : attachment.contentBytes,
      index: async () => new Set([...(reason === "history" || reason === "missing" ? [] : [createHash("md5").update(Buffer.from(other, "base64")).digest("hex")])]),
      wasSaved: async hash => reason === "history" && hash !== md5, save, record: vi.fn(),
    });
    expect(result.counts.superseded).toBe(0);
    expect(result.items[0].status).toBe("autosaved");
  });
  it("再送表記と全角英数を整え、拡張子を残す", () => {
    for (const name of ["【再送】 ＡＢ契約書.PDF", "ＡＢ_（再々送）_契約書.PDF", "ＡＢ[再再送]契約書.PDF"]) expect(normalizedVersionName(name)).toBe("ab契約書.pdf");
  });
  it("ファイル名に関係なく照合し、同じMD5をまとめ、ルートの一覧を一度だけ取得", async () => {
    const index = vi.fn(async () => new Set([md5]));
    const result = await judgeMails([mail, { ...mail, id: "other" }], { content: async () => attachment.contentBytes, attachments: async () => [attachment, { ...attachment, name: "別名.pdf" }], index, wasSaved: async () => false });
    expect(result.items).toHaveLength(1);
    expect(result.counts).toMatchObject({ candidateMails: 2, attachments: 1, saved: 1 });
    expect(index).toHaveBeenCalledTimes(1);
  });
  it("Drive に無くても履歴があれば再保存しない", async () => {
    const save = vi.fn();
    const result = await judgeMails([mail], { content: async () => attachment.contentBytes, attachments: async () => [attachment], index: async () => new Set(), wasSaved: async () => true, save, record: vi.fn() });
    expect(result.items[0].status).toBe("previously-saved");
    expect(result.counts).toMatchObject({ previouslySaved: 1, missing: 0 });
    expect(reportMessage("2026-10-28", result.items, result.counts)).not.toContain(attachment.name);
    expect(save).not.toHaveBeenCalled();
  });
  it("読めない保存先を未保存扱いせず、保存前に失敗する", async () => {
    const save = vi.fn();
    await expect(judgeMails([mail], { content: async () => attachment.contentBytes, attachments: async () => [attachment], index: async () => { throw Error("Drive を読めません"); }, wasSaved: async () => false, save, record: vi.fn() })).rejects.toThrow("読めません");
    expect(save).not.toHaveBeenCalled();
  });
});

it("分類を通った添付だけ本文を取得する", async () => {
  const { contentBytes, ...metadata } = attachment;
  const content = vi.fn(async () => contentBytes);
  await judgeMails([mail], {
    attachments: async () => [metadata, { ...metadata, id: "image", name: "image.png" }, { ...metadata, id: "small", size: 1 }, { ...metadata, id: "excluded", name: "雇用契約.pdf" }],
    content, index: async () => new Set(), wasSaved: async () => false,
  });
  expect(content).toHaveBeenCalledExactlyOnceWith(mail, metadata);
});
