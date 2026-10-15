/**
 * 件名・差出人から「当社が払う請求書か」を判定する（01_メール抽出.ps1 の Classify と同じ規則）。
 */
export type MailClass = "payable" | "excluded" | "own" | "unclear";

export const MAILBOX_DOMAINS = [
  "almalio.net",
  "ara-ta.net",
  "arata123.co.jp",
  "centerrise.co.jp",
  "hyuaran.com",
  "ichi-one.com",
  "just-hikari.com",
  "kanden.biz",
  "link-support-osaka.com",
  "ms-support-osaka.com",
  "stone-base.jp",
  "sunsun-taiyou.com",
] as const;

/** 各社の keiri@・kanri_honbu@（24 箱）。garden-os.net には無い */
export const MAILBOXES: string[] = ["keiri", "kanri_honbu"].flatMap((prefix) =>
  MAILBOX_DOMAINS.map((domain) => `${prefix}@${domain}`),
);

const KEYWORDS = /請求|ご請求|請求書|お支払|支払|インボイス|invoice|ご利用料金|利用料金|お引き落とし|口座振替|振込|お振込|料金のお知らせ|明細|通知書/i;
const NG_SUBJECT =
  /支払通知|お支払通知|御支払通知|支払明細|お支払明細|お支払い明細|支払通知書|振込予約のご確認|振込入金|振込先口座の登録|クレジットカード決済完了|ご請求予定|ご利用明細更新|ご利用料金|販売奨励金|奨励金|売上|請求依頼期限|請求依頼|パスワード|契約書|セミナー|登録料請求内訳|更改|暫定通知/;
// 返信（Re:）は当社が出した請求書へのやり取り（例：Re: 【NLC賃貸御請求書】＝売上側）。支払う請求書は返信では届かない
const REPLY_SUBJECT = /^\s*(re|ｒｅ)\s*[:：]/i;
// 「ご案内」は請求書の件名にもよく付く（例：ご請求書のご案内）。請求書と書いてあれば対象外にしない（01_メール抽出.ps1 より 1 点ゆるめた）
const SOFT_NG_SUBJECT = /ご案内/;
const OK_SUBJECT = /御請求書|ご請求書|請求書が届きました|請求書発行|請求書通知|Web請求書送付|ご請求書の件|請求書/;
const NG_SENDERS =
  /paypay-bank|orico|microsoft|cybozu|np-kakebarai|nike|github|cloudsign|collabo-portal|nf-h\.com|airid|infomart.*seminar|urm-seminar|justpayment|bb-connection|skys-web|wingrow|life-cr|broadband-support|b-quest|axis-com|cross-support|alliance-technology/i;
const OWN_DOMAINS = /almalio\.net|ara-ta\.net|arata123\.co\.jp|centerrise\.co\.jp|hyuaran\.com|hyuaran1\.onmicrosoft\.com|ichi-one\.com|just-hikari\.com|kanden\.biz|link-support-osaka\.com|ms-support-osaka\.com|stone-base\.jp|sunsun-taiyou\.com|garden-os\.net/i;

/** 件名が請求関連か（違えば対象外として数えもしない） */
export function isInvoiceRelated(subject: string): boolean {
  return KEYWORDS.test(subject);
}

export function classifyMail(sender: string, subject: string): MailClass {
  if (NG_SUBJECT.test(subject)) return "excluded";
  if (REPLY_SUBJECT.test(subject)) return "excluded";
  if (NG_SENDERS.test(sender)) return "excluded";
  if (SOFT_NG_SUBJECT.test(subject) && !OK_SUBJECT.test(subject)) return "excluded";
  if (OK_SUBJECT.test(subject)) return OWN_DOMAINS.test(sender) ? "own" : "payable";
  return OWN_DOMAINS.test(sender) ? "own" : "unclear";
}
