import { describe, expect, it } from "vitest";

import { classifyMail } from "./classify";
import type { MailItem } from "./graph-mail";
import { alertFrom, estimateDue, judgeMails } from "./judge";
import type { Lookups } from "./lookups";
import { findVendor } from "./vendors";

function mail(partial: Partial<MailItem>): MailItem {
  return {
    id: partial.id ?? "m1",
    internetMessageId: partial.internetMessageId ?? partial.id ?? "m1",
    mailboxes: ["keiri@hyuaran.com"],
    receivedAt: "2026-10-10T01:00:00Z",
    sender: "info@topway.co.jp",
    senderName: "",
    subject: "ご請求書のご案内",
    ...partial,
  };
}

function lookups(reserved: boolean, saved: boolean): Lookups {
  return {
    reservations: async () => (reserved ? [{ id: "1700", dueDate: "2026-10-30", amount: 60500 }] : []),
    savedFiles: async () => (saved ? [{ id: "f", name: "トップウェイ_ヒュアラン_1031.pdf", createdAt: "2026-10-14T00:00:00Z", url: "u" }] : []),
  };
}

describe("classifyMail", () => {
  it("外部の請求書は支払う側", () => expect(classifyMail("a@topway.co.jp", "御請求書")).toBe("payable"));
  it("支払明細は入金側で対象外", () => expect(classifyMail("m.kusamiya@prodelight.co.jp", "お支払明細書")).toBe("excluded"));
  it("返信は対象外（当社の請求書へのやり取り）", () => expect(classifyMail("sato@fado.co.jp", "Re:  【NLC賃貸御請求書】202610")).toBe("excluded"));
  it("暫定通知書は入金側で対象外", () => expect(classifyMail("hasegawa@prodelight.co.jp", "10月末暫定通知書")).toBe("excluded"));
  it("自社発の請求書は売上側", () => expect(classifyMail("keiri@centerrise.co.jp", "御請求書")).toBe("own"));
});

describe("findVendor", () => {
  it("インフォマート経由の楽天カード", () => expect(findVendor("post-master@infomart.co.jp", "楽天カード様から請求書が届きました")?.key).toBe("楽天カード(リンクサポート)"));
  it("知らない差出人は null", () => expect(findVendor("x@unknown.jp", "請求書")).toBeNull());
});

describe("estimateDue / alertFrom", () => {
  it("月末：中旬の受信は当月末", () => expect(estimateDue("month-end", "2026-10-10")).toBe("2026-10-31"));
  it("月末：25 日以降の受信は翌月末", () => expect(estimateDue("month-end", "2026-10-26")).toBe("2026-11-30"));
  it("月の 27 日頃", () => expect(estimateDue("day:27", "2026-10-28")).toBe("2026-11-27"));
  it("翌々月 10 日頃", () => expect(estimateDue("plus2:10", "2026-11-05")).toBe("2027-01-10"));
  it("期日が決まらない", () => expect(estimateDue("unknown", "2026-10-05")).toBeNull());
  // 2026-10-31 は土曜→振込は 10-30（金）→ 3 営業日前は 10-27
  it("3 営業日前から要対応", () => expect(alertFrom("2026-10-31")).toBe("2026-10-27"));
});

describe("judgeMails", () => {
  const base = { newSince: "2026-10-09T01:00:00Z" };

  it("予約・保存とも有れば確認済み", async () => {
    const { counts } = await judgeMails({ ...base, mails: [mail({})], today: "2026-10-28", lookups: lookups(true, true) });
    expect(counts.ok).toBe(1);
    expect(counts.action).toBe(0);
  });

  it("期日前は要対応にしない", async () => {
    const { counts } = await judgeMails({ ...base, mails: [mail({})], today: "2026-10-15", lookups: lookups(false, true) });
    expect(counts.upcoming).toBe(1);
  });

  it("期日が近いのに予約が無ければ要対応（同じ業者・同じ期日は 1 件にまとめる）", async () => {
    const { items } = await judgeMails({
      ...base,
      mails: [mail({ id: "a" }), mail({ id: "b", mailboxes: ["kanri_honbu@hyuaran.com"] })],
      today: "2026-10-28",
      lookups: lookups(false, true),
    });
    expect(items.filter((item) => item.kind === "action")).toHaveLength(1);
    expect(items[0].reason).toBe("予約：なし／保存：あり");
  });

  it("業者マスタに無い請求書は新着だけ人の確認", async () => {
    const mails = [
      mail({ id: "new", sender: "x@unknown.jp", receivedAt: "2026-10-14T02:00:00Z" }),
      mail({ id: "old", sender: "y@unknown.jp", receivedAt: "2026-10-01T02:00:00Z" }),
    ];
    const { items } = await judgeMails({ ...base, mails, today: "2026-10-15", lookups: lookups(false, false) });
    expect(items.map((item) => item.sender)).toEqual(["x@unknown.jp"]);
    expect(items[0].kind).toBe("human");
  });

  it("請求と関係ない件名は数えない", async () => {
    const { counts } = await judgeMails({ ...base, mails: [mail({ subject: "打合せの件" })], today: "2026-10-15", lookups: lookups(false, false) });
    expect(counts.invoiceRelated).toBe(0);
  });
});
