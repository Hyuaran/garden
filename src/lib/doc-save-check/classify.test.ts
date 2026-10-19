import { describe, expect, it } from "vitest";
import { classifyAttachment, MIN_ATTACHMENT_BYTES, direction } from "./classify";
import type { MailItem, MailAttachment } from "../mail-payment-check/graph-mail";
export const mail: MailItem = { id: "m", internetMessageId: "im", mailboxes: ["keiri@hyuaran.com"], receivedAt: "2026-10-27T16:00:00Z", sender: "vendor@example.jp", senderName: "A/B", subject: "契約書送付", toRecipients: ["keiri@hyuaran.com"], hasAttachments: true };
export const attachment: MailAttachment = { id: "a", name: "契約書.pdf", size: MIN_ATTACHMENT_BYTES, contentType: "application/pdf", contentBytes: Buffer.alloc(MIN_ATTACHMENT_BYTES, 1).toString("base64") };
describe("添付の分類", () => {
  it.each(["FW:", " Fw： ", "FWD:", "Fwd:", "転送：", "Re: Fw:", " RE： Re: 転送："])("自社の転送 %s は添付名だけで判定", prefix => {
    const forwarded = { ...mail, sender: "m-ueda@hyuaran.com", subject: `${prefix} 【KOSMO 請求書・契約書】契約書通知メール` };
    expect(direction(forwarded)).toBe("in");
    expect(classifyAttachment(forwarded, { ...attachment, name: "株式会社ＫＯＳＭＯ_請求書.pdf" })).toBeNull();
    expect(classifyAttachment(forwarded, { ...attachment, name: "業務委託契約書.pdf" })).toBe("contract");
    expect(classifyAttachment(forwarded, { ...attachment, name: "条件表.xlsx" })).toBe("terms-in");
    expect(classifyAttachment(forwarded, { ...attachment, name: "雇用契約書.pdf" })).toBeNull();
  });
  it.each(["契約書", "覚書", "合意書", "締結", "契約更新", "申込書兼契約書"])("契約の言葉 %s", word => expect(classifyAttachment({ ...mail, subject: word }, { ...attachment, name: "添付.pdf" })).toBe("contract"));
  it.each(["条件表", "条件書", "インセンティブ", "単価表", "報酬表", "手数料表"])("条件表の言葉 %s", word => expect(classifyAttachment({ ...mail, subject: word }, { ...attachment, name: "添付.xlsx" })).toBe("terms-in"));
  it("送信は外部の宛先が必要・ドメインは完全一致", () => {
    const own = { ...mail, sender: "keiri@hyuaran.com", toRecipients: ["a@garden-os.net"] };
    expect(direction(own)).toBeNull();
    expect(classifyAttachment(own, attachment)).toBeNull();
    expect(classifyAttachment({ ...own, toRecipients: ["external@example.jp"] }, { ...attachment, name: "条件表.xls" })).toBe("terms-out");
    expect(direction({ ...mail, sender: "x@evilhyuaran.com" })).toBe("in");
  });
  it("契約書は PDF だけ（Word の下書きは除く）・条件表は Excel も対象", () => {
    expect(classifyAttachment(mail, { ...attachment, name: "260828_業務委託基本契約書.docx" })).toBeNull();
    expect(classifyAttachment(mail, { ...attachment, name: "秘密保持契約書.doc" })).toBeNull();
    expect(classifyAttachment(mail, { ...attachment, name: "業務委託基本契約書.pdf" })).toBe("contract");
    expect(classifyAttachment({ ...mail, subject: "条件表" }, { ...attachment, name: "添付.docx" })).toBe("terms-in");
  });
  it("添付名の種類を件名より優先", () => {
    expect(classifyAttachment(mail, { ...attachment, name: "条件表.xlsx" })).toBe("terms-in");
    expect(classifyAttachment({ ...mail, subject: "条件表" }, attachment)).toBe("contract");
  });
  it.each(["雇用契約", "誓約書", "入社", "退職"])("従業員書類 %s を除外", word => {
    expect(classifyAttachment({ ...mail, subject: `契約書 ${word}` }, attachment)).toBeNull();
    expect(classifyAttachment(mail, { ...attachment, name: `${word}契約書.pdf` })).toBeNull();
  });
  it("電子契約・inline・画像・小さいもの・言葉のないものを除外", () => {
    expect(classifyAttachment({ ...mail, sender: "notice@contract.moneyforward.com" }, attachment)).toBeNull();
    expect(classifyAttachment({ ...mail, sender: "notice@cloudsign.jp" }, attachment)).toBeNull();
    for (const a of [{ ...attachment, isInline: true }, { ...attachment, name: "契約書.png" }, { ...attachment, size: 10 }]) expect(classifyAttachment(mail, a)).toBeNull();
    expect(classifyAttachment({ ...mail, subject: "お知らせ" }, { ...attachment, name: "資料.docx" })).toBeNull();
  });
});
