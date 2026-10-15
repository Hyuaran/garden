/**
 * メール 1 通ずつを「予約（Kintone）・保存（Drive）」と突き合わせて判定する。
 * 要対応＝期日の 3 営業日前を過ぎたのに予約か保存が無い（直るまで毎日知らせる）
 * 人の確認＝業者マスタに無い／実績が足りない業者／期日が決まらない／件名だけでは分からない（新着だけ・1 回）
 * 期日前＝まだ登録前で普通の状態（数だけ）
 */
import { addDays, effectivePaymentDate, isBusinessDay, parseDate, formatDate } from "@/lib/pl-payments/business-day";

import { classifyMail, isInvoiceRelated } from "./classify";
import type { MailItem } from "./graph-mail";
import type { Lookups, Reservation, SavedFile } from "./lookups";
import { findVendor, type DueRule, type Vendor } from "./vendors";

export type JudgeKind = "action" | "human" | "upcoming" | "ok";

export type JudgedItem = {
  kind: JudgeKind;
  vendor: string | null;
  mailbox: string;
  receivedAt: string;
  sender: string;
  subject: string;
  dueDate: string | null;
  reserved: Reservation | null;
  saved: SavedFile | null;
  reason: string;
};

export type JudgeCounts = {
  mails: number;
  invoiceRelated: number;
  excluded: number;
  own: number;
  action: number;
  human: number;
  upcoming: number;
  ok: number;
};

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function jstDate(iso: string): string {
  return formatDate(new Date(new Date(iso).getTime() + JST_OFFSET_MS));
}

export function jstDateTime(iso: string): string {
  const shifted = new Date(new Date(iso).getTime() + JST_OFFSET_MS);
  const hh = String(shifted.getUTCHours()).padStart(2, "0");
  const mm = String(shifted.getUTCMinutes()).padStart(2, "0");
  const ss = String(shifted.getUTCSeconds()).padStart(2, "0");
  return `${formatDate(shifted)} ${hh}:${mm}:${ss}`;
}

function endOfMonth(year: number, monthIndex: number): string {
  return formatDate(new Date(Date.UTC(year, monthIndex + 1, 0)));
}

function dayOfMonth(year: number, monthIndex: number, day: number): string {
  const last = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return formatDate(new Date(Date.UTC(year, monthIndex, Math.min(day, last))));
}

/** 受信日と業者の期日ルールから「支払期日の目安」を出す。決まらなければ null */
export function estimateDue(rule: DueRule, receivedDate: string): string | null {
  const date = parseDate(receivedDate);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  if (rule === "month-end") return day >= 25 ? endOfMonth(year, month + 1) : endOfMonth(year, month);
  // 受信月の 2 か月後の月末（ディップ：利用月の末に届き 2 か月後の月末払い）
  if (rule === "plus2-end") return endOfMonth(year, month + 2);
  const dayRule = /^day:(\d+)$/.exec(rule);
  if (dayRule) {
    const target = Number(dayRule[1]);
    return day < target ? dayOfMonth(year, month, target) : dayOfMonth(year, month + 1, target);
  }
  const plus2 = /^plus2:(\d+)$/.exec(rule);
  if (plus2) return dayOfMonth(year, month + 2, Number(plus2[1]));
  return null;
}

/** 実際の振込日（休みなら前の営業日）の 3 営業日前から「要対応」にする */
export function alertFrom(dueDate: string): string {
  let cursor = effectivePaymentDate(dueDate);
  let left = 3;
  while (left > 0) {
    cursor = addDays(cursor, -1);
    if (isBusinessDay(cursor)) left -= 1;
  }
  return cursor;
}

function emptyCounts(): JudgeCounts {
  return { mails: 0, invoiceRelated: 0, excluded: 0, own: 0, action: 0, human: 0, upcoming: 0, ok: 0 };
}

export async function judgeMails(input: {
  mails: MailItem[];
  today: string;
  newSince: string;
  lookups: Lookups;
}): Promise<{ items: JudgedItem[]; counts: JudgeCounts }> {
  const counts = emptyCounts();
  counts.mails = input.mails.length;
  const items: JudgedItem[] = [];
  const sorted = [...input.mails].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
  const seenVendorDue = new Set<string>();

  for (const mail of sorted) {
    if (!isInvoiceRelated(mail.subject)) continue;
    counts.invoiceRelated += 1;
    const isNew = Date.parse(mail.receivedAt) >= Date.parse(input.newSince);
    const base = {
      mailbox: mail.mailboxes.join("・"),
      receivedAt: mail.receivedAt,
      sender: mail.sender,
      subject: mail.subject,
    };
    const cls = classifyMail(mail.sender, mail.subject);
    if (cls === "excluded") {
      counts.excluded += 1;
      continue;
    }
    if (cls === "own") {
      counts.own += 1;
      continue;
    }
    if (cls === "unclear") {
      if (isNew) items.push({ ...base, kind: "human", vendor: null, dueDate: null, reserved: null, saved: null, reason: "件名だけでは、当社が払う請求書か分かりません" });
      continue;
    }

    const vendor: Vendor | null = findVendor(mail.sender, mail.subject);
    if (!vendor) {
      if (isNew) items.push({ ...base, kind: "human", vendor: null, dueDate: null, reserved: null, saved: null, reason: "業者マスタに無い差出人です（予約と保存を確かめてください）" });
      continue;
    }

    const received = jstDate(mail.receivedAt);
    const dueDate = estimateDue(vendor.dueRule, received);
    const dedupeKey = `${vendor.key}:${dueDate ?? received.slice(0, 7)}`;
    if (seenVendorDue.has(dedupeKey)) continue;
    seenVendorDue.add(dedupeKey);

    const reservations = await input.lookups.reservations(vendor);
    // 期日の目安が分かれば前後 10 日、分からなければ受信日から 75 日以内の支払期日を「この請求の予約」とみなす（先月分の予約を拾わない）
    const [from, to] = dueDate ? [addDays(dueDate, -10), addDays(dueDate, 10)] : [received, addDays(received, 75)];
    const reserved = reservations.find((row) => row.dueDate >= from && row.dueDate <= to) ?? null;
    const files = await input.lookups.savedFiles(vendor);
    const saved = files.find((file) => jstDate(file.createdAt) >= addDays(received, -10)) ?? null;
    const judged = { ...base, vendor: vendor.key, dueDate, reserved, saved };

    if (reserved && saved) {
      items.push({ ...judged, kind: "ok", reason: "予約・保存とも確認できました" });
    } else if (!vendor.confirmed || !dueDate) {
      if (isNew) {
        const why = !vendor.confirmed ? "まだ実績が少ない業者です" : "期日が請求書を見ないと決まりません";
        items.push({ ...judged, kind: "human", reason: `${why}（${missingText(reserved, saved)}）` });
      }
    } else if (input.today >= alertFrom(dueDate)) {
      items.push({ ...judged, kind: "action", reason: missingText(reserved, saved) });
    } else {
      items.push({ ...judged, kind: "upcoming", reason: `期日前（${missingText(reserved, saved)}）` });
    }
  }

  for (const item of items) counts[item.kind] += 1;
  return { items, counts };
}

function missingText(reserved: Reservation | null, saved: SavedFile | null): string {
  return `予約：${reserved ? "あり" : "なし"}／保存：${saved ? "あり" : "なし"}`;
}
