import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { reportMessage } from "./notify";
import { judgeMails } from "./judge";
import { mail, attachment } from "./test-fixtures";
const md5 = createHash("md5").update(Buffer.from(attachment.contentBytes, "base64")).digest("hex");
describe("MD5 の照合", () => {
  it("ファイル名に関係なく照合し、同じMD5をまとめ、ルートの一覧を一度だけ取得", async () => {
    const index = vi.fn(async () => new Set([md5]));
    const result = await judgeMails([mail, { ...mail, id: "other" }], { content: async () => attachment.contentBytes, attachments: async () => [attachment, { ...attachment, name: "別名.pdf" }], index, wasSaved: async () => false });
    expect(result.items).toHaveLength(1);
    expect(result.counts).toMatchObject({ candidateMails: 2, attachments: 4, saved: 1 });
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
