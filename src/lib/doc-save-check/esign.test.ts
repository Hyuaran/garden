import { describe, expect, it, vi } from "vitest";
import { judgeMails } from "./judge";
import { reportMessage } from "./notify";
import { electronicService } from "./classify";
import { mail, attachment } from "./test-fixtures";
import type { MailItem, MailAttachmentMetadata } from "../mail-payment-check/graph-mail";

const mf = { ...mail, sender: "do_not_reply_contract@moneyforward.com", subject: "「秘密保持契約書_相互NDA 【株式会社ストーンベース様】」の電子署名完了のお知らせ（マネーフォワード クラウド契約）" };
const gmo = { ...mail, sender: "noreply@gmosign.com", subject: "電子署名完了のお知らせ（[株式会社リンクサポート様]業務委託契約書）" };
const cloud = { ...mail, sender: "support@cloudsign.jp", subject: "「株式会社ストーンベース御中　アフィリエイト業務委託契約書」の合意締結が完了しました", hasAttachments: false };
function deps() {
  return { attachments: vi.fn(async () => [attachment]), content: vi.fn(async (_mail: MailItem, _attachment: MailAttachmentMetadata) => attachment.contentBytes), index: vi.fn(async () => new Set<string>()), wasSaved: vi.fn(async () => false) };
}
describe("電子契約の締結完了", () => {
  it("MF の PDF 全てを契約書として自動保存できる", async () => {
    const d = deps();
    d.attachments.mockResolvedValue([{ ...attachment, name: "添付.pdf" }, { ...attachment, id: "b", name: "相互NDA_合意締結証明書.pdf" }]);
    d.content.mockImplementation(async (_, a) => Buffer.alloc(1024, a.id === "b" ? 2 : 1).toString("base64"));
    const save = vi.fn(async () => ({ id: "file", url: "https://drive.test/file", fileName: "saved.pdf" }));
    const result = await judgeMails([mf], { ...d, save, record: vi.fn() });
    expect(result.items.map(i => [i.kind, i.status])).toEqual([["contract", "autosaved"], ["contract", "autosaved"]]);
    expect(save).toHaveBeenCalledTimes(2);
  });
  it.each([gmo, cloud])("PDF が無い場合は取り出しを知らせ、MD5 照合しない: $sender", async m => {
    const d = deps();
    d.attachments.mockResolvedValue([{ ...attachment, name: "smime.p7m" }]);
    const result = await judgeMails([m], d);
    expect(result.counts.needsDownload).toBe(1);
    expect(result.items[0].status).toBe("needs-download");
    for (const fn of [d.content, d.index, d.wasSaved]) expect(fn).not.toHaveBeenCalled();
    const message = reportMessage("2026-10-19", result.items, result.counts);
    expect(message).toContain("13_契約書 に保存してください");
    expect(message).toContain(electronicService(m)!.name);
    expect(message).toContain(m.mailboxes[0]);
    expect(message).toContain(m.subject.replace(/\[/g, "［").replace(/\]/g, "］"));
  });
  it.each(["業務委託契約書への署名依頼が届いています", "【再送】業務委託契約書への署名依頼が届いています", "業務委託契約書の確認依頼が届いています", "アカウント登録のご案内", "署名完了の確認依頼", "雇用契約の電子署名完了"])("対象外: %s", async subject => {
    const result = await judgeMails([{ ...gmo, subject }], deps());
    expect(result.items).toEqual([]);
  });
  it.each([[undefined, 1], ["2026-10-27T15:00:00Z", 1], [mail.receivedAt, 0], ["2026-10-27T17:00:00Z", 0]] as const)("前回成功日時 %s 以降の新着だけ通知", async (previous, count) => {
    expect((await judgeMails([cloud], deps(), previous)).counts.needsDownload).toBe(count);
  });
  it("サービスのサブドメインと freee の sign 制限", () => {
    expect(electronicService({ ...mf, sender: "notice@contract.moneyforward.com" })?.name).toBe(electronicService(mf)?.name);
    expect(electronicService({ ...mf, sender: "notice@evilmoneyforward.com" })).toBeUndefined();
    expect(electronicService({ ...mf, sender: "notice@freee.co.jp" })).toBeUndefined();
    expect(electronicService({ ...mf, sender: "sign@freee.co.jp" })?.name).toBe("freee サイン");
  });
});
