import type { SupabaseClient } from "@supabase/supabase-js";
import { getGraphToken, graphFetch } from "@/lib/mail-payment-check/graph-mail";
import type { MfAccount } from "./types";

export type ParsedAlert = { mail_account_name: string; last_success_date: string; reason: string; reason_text: string };
export type LinkAlert = ParsedAlert & { id: string; message_id: string; received_at: string; mf_account_id: string | null; dismissed_at: string | null; dismissed_by: string | null; active: boolean };
export function parseLinkAlerts(text: string): ParsedAlert[] {
 const [table, explanations = ""] = text.split("取得停止の理由");
 const reasons = new Map<string,string>();
 for (const m of explanations.matchAll(/[（(]([^()（）]+)[）)]\s*([^\r\n]+)/g)) reasons.set(m[1].trim(), m[2].trim());
 const rows: ParsedAlert[] = [];
 for (const m of table.matchAll(/^\s*(.+?)\s+(\d{4})年(\d{1,2})月(\d{1,2})日\s*[（(]([^()（）]+)[）)]/gm)) {
  const date = `${m[2]}-${m[3].padStart(2,"0")}-${m[4].padStart(2,"0")}`;
  if (!Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date) throw new Error("メールの日付を確認してください");
  rows.push({ mail_account_name: m[1].trim(), last_success_date: date, reason: m[5].trim(), reason_text: reasons.get(m[5].trim()) ?? "" });
 }
 return rows;
}
export function matchLinkAccount(name: string, accounts: Pick<MfAccount,"mf_account_id" | "mail_alias" | "book_sub_account_name">[]): string | null {
 const aliases = accounts.filter(a => a.mail_alias === name);
 const matches = aliases.length ? aliases : accounts.filter(a => a.book_sub_account_name.startsWith(name));
 return matches.length === 1 ? matches[0].mf_account_id : null;
}
export function visibleLinkAlerts(rows: LinkAlert[], now = new Date()): LinkAlert[] {
 return rows.filter(r => r.active && Date.parse(r.received_at) > now.getTime()-8*86400000 && Date.parse(r.received_at) <= now.getTime() && (!r.dismissed_at || Date.parse(r.received_at) > Date.parse(r.dismissed_at)));
}
export async function syncLinkAlerts(db: SupabaseClient, now = new Date()) {
 const token = await getGraphToken();
 const messages = new Map<string, { message_id: string; received_at: string; alerts: ParsedAlert[] }>();
 for (const mailbox of ["shoji@hyuaran.com", "keiri@hyuaran.com"]) {
  const params = new URLSearchParams({ $filter: `receivedDateTime ge ${new Date(now.getTime()-30*86400000).toISOString()} and from/emailAddress/address eq 'biz.feedback@moneyforward.com'`, $select: "id,internetMessageId,receivedDateTime,subject,body", $top: "100" });
  let url: string | null = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/mailFolders/inbox/messages?${params}`;
  while (url) {
   const response = await graphFetch(url, { headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.body-content-type="text"' }, cache: "no-store" });
   if (!response.ok) throw new Error("知らせメールを読み込めませんでした");
   const data: { value: { id: string; internetMessageId?: string; receivedDateTime: string; subject: string; body: { content: string; contentType: string } }[]; "@odata.nextLink"?: string } = await response.json();
   for (const m of data.value) {
    if (!m.subject.includes("自動取得が行なわれていない")) continue;
    if (m.body.contentType.toLowerCase() !== "text") throw new Error("知らせメールの本文を確認してください");
    const id = m.internetMessageId || m.id;
    messages.set(id, { message_id: id, received_at: m.receivedDateTime, alerts: parseLinkAlerts(m.body.content) });
   }
   url = data["@odata.nextLink"] ?? null;
  }
 }
 const accounts = await db.from("bud_mf_accounts").select("mf_account_id,mail_alias,book_sub_account_name");
 if (accounts.error) throw new Error("口座を読み込めませんでした");
 const batches = [...messages.values()].map(m => ({ ...m, alerts: m.alerts.map(a => ({ ...a, mf_account_id: matchLinkAccount(a.mail_account_name, accounts.data) })) }));
 const result = await db.rpc("bud_mf_apply_link_alerts", { p_messages: batches });
 if (result.error) throw new Error("知らせメールを保存できませんでした");
 return { ok: true, messages: batches.length };
}
