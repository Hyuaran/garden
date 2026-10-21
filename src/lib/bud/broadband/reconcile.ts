import type { KintoneRecord } from "@/lib/kintone/records";
import { corporationName } from "../mf/corporations";

export const value = (r: KintoneRecord, k: string): unknown => (r[k] as { value?: unknown })?.value;
export const text = (r: KintoneRecord, k: string) => String(value(r, k) ?? "");
export type Mirror = { kintone_record_id: string; revision: string; raw: KintoneRecord; mf_transaction_id?: string | null };
export type Settings = { record_master: "kintone" | "garden"; recon_from: string; notify_from: string; date_window_before: number; date_window_after: number; excluded_partners: string[] };
export type Bank = { mf_transaction_id: string; mf_account_id: string; date: string; side: string; value: number; content: string; corp_code: string; bank_name: string };
export type Rule = { partner: string; keywords: string[] };
export type Kind = "matched" | "amount_mismatch" | "not_arrived" | "ambiguous" | "excluded" | "pending";
export type Result = { row: Mirror; kind: Kind; expected: number; notify: boolean; bank?: Bank; candidates: Bank[]; fee?: number; combined?: number };
export const shiftDate = (date: string, days: number) => new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10);
// 行の種類で金額の欄が違う（2026-10-21 実測）：売上・支払額・原価は税抜×(1+税率)、
// ストックは自社ストック額（税込）−委託費（税込）。どれにも当たらなければ利益額（税抜）×(1+税率)
const num = (raw: KintoneRecord, k: string) => { const v = text(raw, k); return v === "" ? 0 : Number(v); };
export function side(raw: KintoneRecord): "INCOME" | "EXPENSE" {
  if (num(raw,"売上_税抜_") > 0) return "INCOME";
  if (num(raw,"支払額_税抜_") > 0 || num(raw,"原価_税抜_") > 0) return "EXPENSE";
  return num(raw,"利益額_税抜_") < 0 ? "EXPENSE" : "INCOME";
}
export function grossCandidates(raw: KintoneRecord): number[] {
  const tax = Number(value(raw, "消費税率"));
  if (text(raw, "消費税率") === "" || !Number.isFinite(tax) || tax < 0) return [];
  const rate = 1 + tax / 100;
  for (const k of ["売上_税抜_", "支払額_税抜_", "原価_税抜_"]) if (num(raw,k) > 0) return [num(raw,k) * rate];
  const stock = num(raw,"自社ストック額_税込_") - num(raw,"委託費_税込_");
  const profit = Math.abs(num(raw,"利益額_税抜_")) * rate;
  return [stock, profit].filter(v => Number.isFinite(v) && v > 0);
}
export function gross(raw: KintoneRecord) { return grossCandidates(raw)[0] ?? NaN; }
// 東海林さん 2026-10-21：相手の端数処理による 1 円の差は一致とみなす
export const exact = (bank: number, unroundedGross: number) => Math.abs(Math.abs(bank) - Math.round(unroundedGross)) <= 1;
// 入金は振込手数料（880 円まで）を引かれて届くことがある。差額を手数料として一致とみなす
export const MAX_TRANSFER_FEE = 880;
export const feeOf = (bank: number, amounts: number[]) => { const fees = amounts.map(a => Math.round(a) - Math.abs(bank)).filter(f => f >= 100 && f <= MAX_TRANSFER_FEE && (f % 11 === 0 || f % 5 === 0)); return fees.length ? Math.min(...fees) : 0; };
// 届くのを待つのは予定日の翌月末まで（東海林さん 2026-10-21）
export const endOfNextMonth = (date: string) => new Date(Date.UTC(Number(date.slice(0,4)), Number(date.slice(5,7)) + 1, 0)).toISOString().slice(0,10);
// 一致した明細の摘要から、取引先の口座での名前を取り出す（覚えさせる用）
export function payeeKeyword(content: string) {
  return content.replace(/\(依頼人名.*$/, "").replace(/^(振込入金|振込|入金|出金)\s+/, "")
    .replace(/^.*(普通|当座)(預金)?\s+\d+\s+/, "").replace(/,[0-9,]*$/, "").trim();
}
const exactAny = (bank: number, amounts: number[]) => amounts.some(a => exact(bank, a));
export function reconcile(rows: Mirror[], bank: Bank[], rules: Rule[], settings: Settings, today: string): Result[] {
  const used = new Set(rows.map(r => r.mf_transaction_id).filter(Boolean));
  const results: Result[] = [...rows].sort((a,b) => text(a.raw,"入出金予定日").localeCompare(text(b.raw,"入出金予定日")) || a.kintone_record_id.localeCompare(b.kintone_record_id, undefined, { numeric: true })).map(row => {
    const raw = row.raw, date = text(raw,"入出金予定日"), partner = text(raw,"取引先会社名"), amounts = grossCandidates(raw), amount = amounts[0] ?? NaN;
    const base = { row, expected: Math.round(amount), notify: date >= settings.notify_from, candidates: [] as Bank[] };
    if (partner.startsWith("NTT原価") || ["関電経費合計","決済費用（壱）","決済費用(壱)"].includes(partner) || !date || date < settings.recon_from || settings.excluded_partners.includes(partner) || text(raw,"入金確認") || !Number.isFinite(amount)) return { ...base, kind: "excluded" };
        const keywords = rules.filter(r => r.partner === partner).flatMap(r => r.keywords).filter(Boolean);
    const until = [shiftDate(date,settings.date_window_after), endOfNextMonth(date)].sort().at(-1)!;
    // ほかの取引先の名前（決まり・覚えた名前）の明細は当てない
    const others = rules.filter(r => r.partner !== partner).flatMap(r => r.keywords).filter(k => k && !keywords.some(own => own.includes(k) || k.includes(own)));
    const candidates = bank.filter(b => !used.has(b.mf_transaction_id) && !others.some(k => b.content.includes(k)) && b.side === side(raw) && b.date >= shiftDate(date,-settings.date_window_before) && b.date <= until); // 法人では絞らない：[MF]社名は人の入力で、実際の入金口座と違うことがある（Fプレイン：リンクサポートと入っていてヒュアランに着金）
    const distance = (b: Bank) => Math.abs(Date.parse(b.date)-Date.parse(date));
    const matches = candidates.filter(b => exactAny(b.value,amounts)).sort((a,b) => distance(a)-distance(b));
    if (matches.length > 1 && distance(matches[0]) === distance(matches[1])) return { ...base, candidates: matches, kind: "ambiguous" };
    if (matches.length) { used.add(matches[0].mf_transaction_id); return { ...base, candidates, bank: matches[0], kind: "matched" }; }
    const feeMatches = side(raw) === "INCOME" ? candidates.filter(b => feeOf(b.value,amounts) > 0).sort((a,b) => distance(a)-distance(b)) : [];
    if (feeMatches.length > 1 && distance(feeMatches[0]) === distance(feeMatches[1])) return { ...base, candidates: feeMatches, kind: "ambiguous" };
    if (feeMatches.length) { used.add(feeMatches[0].mf_transaction_id); return { ...base, candidates, bank: feeMatches[0], fee: feeOf(feeMatches[0].value,amounts), kind: "matched" }; }
    // 覚えた名前は「金額が違う」を見分けるときだけ使う（一致の判定は金額と日付で行う）
    const named = keywords.length ? candidates.filter(b => keywords.some(k => b.content.includes(k))) : [];
    if (named.length) return { ...base, candidates: named, kind: "amount_mismatch" };
    return { ...base, candidates, kind: today > until ? "not_arrived" : "pending" };
  });
  // 同じ取引先・同じ予定日の行が 1 回の振込にまとまることがある（例：Crescere の 101_回線ショット＋103_クレカ。東海林さん 2026-10-21）。
  // 1 行ずつで合わなかった行を、取引先・予定日・入出金の向きでまとめ、合計が口座の 1 本と合えば全部を一致にする
  const open = (r: Result) => ["amount_mismatch","not_arrived","pending"].includes(r.kind);
  const groups = new Map<string, Result[]>();
  for (const r of results.filter(open)) { const key = [text(r.row.raw,"取引先会社名"), text(r.row.raw,"入出金予定日"), side(r.row.raw)].join("|"); groups.set(key, [...(groups.get(key) ?? []), r]); }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const raw = group[0].row.raw, date = text(raw,"入出金予定日"), sum = group.reduce((n,r) => n + r.expected, 0);
    const until = [shiftDate(date,settings.date_window_after), endOfNextMonth(date)].sort().at(-1)!;
    const distance = (b: Bank) => Math.abs(Date.parse(b.date)-Date.parse(date));
    const hits = bank.filter(b => !used.has(b.mf_transaction_id) && b.side === side(raw) && b.date >= shiftDate(date,-settings.date_window_before) && b.date <= until && (exact(b.value,sum) || (side(raw) === "INCOME" && feeOf(b.value,[sum]) > 0))).sort((a,b) => distance(a)-distance(b));
    if (!hits.length || (hits.length > 1 && distance(hits[0]) === distance(hits[1]))) continue;
    used.add(hits[0].mf_transaction_id);
    const fee = exact(hits[0].value,sum) ? undefined : feeOf(hits[0].value,[sum]);
    for (const r of group) Object.assign(r, { kind: "matched" as Kind, bank: hits[0], fee, combined: group.length });
  }
  return results;
}
export function buildPatch(result: Result, historyField: string): KintoneRecord | null {
  if (result.kind !== "matched" || !result.bank || text(result.row.raw,"入金確認")) return null;
  const b = result.bank, corp = corporationName(b.corp_code);
  const fields = Object.fromEntries(Object.entries({ 入金確認: b.side === "INCOME" ? "入金OK" : "支払OK", ドロップダウン_0: text(result.row.raw,"ドロップダウン_0") || (["ヒュアラン","ARATA","ストーンベース","たいよう","リンクサポート"].includes(corp) ? corp : ""), _MF_銀行: ["楽天銀行","みずほ銀行","PayPay銀行"].includes(b.bank_name) ? b.bank_name : "", _MF_摘要: b.content, _MF_取引日: b.date, _MF_取引額: String(Math.abs(b.value)) }).map(([k,v]) => [k,{ value:v }]));
  const history = value(result.row.raw,"テーブル");
  return { ...fields, テーブル: { value: [...(Array.isArray(history) ? history : []), { value: { [historyField]: { value: `Garden 口座照合（一致${result.combined ? `・同じ取引先の ${result.combined} 行をまとめて 1 回で着金` : ""}${result.fee ? `・振込手数料 ${result.fee.toLocaleString("ja-JP")} 円を引いて着金` : ""}）` } } }] } };
}
export type Issue = { kintone_record_id: string; kind: string; content: string; opened_at: string; notified_at: string | null; resolved_at: string | null; resolved_notified_at: string | null };
export function describeResult(r: Result) {
  const raw = r.row.raw, date = text(raw,"入出金予定日"), period = text(raw,"実績期間");
  const short = (d: string) => `${Number(d.slice(5,7))}/${Number(d.slice(8,10))}`;
  const label = `${text(raw,"事業内容")}／${text(raw,"取引先会社名")}（${period ? `${Number(period.slice(0,4))}年${Number(period.slice(5,7))}月分・` : ""}予定日 ${short(date)}）`;
  const money = (n: number) => Math.abs(n).toLocaleString("ja-JP");
  const detail = r.kind === "amount_mismatch" ? `予定 ${money(r.expected)} 円 → 口座 ${r.candidates.map(b => `${money(b.value)} 円（${b.bank_name} ${short(b.date)}）`).join("、")}` : r.kind === "ambiguous" ? "同じ金額の候補が複数あります" : `予定日を過ぎても${side(raw) === "INCOME" ? "入金" : "支払い"}がありません（予定 ${money(r.expected)} 円）`;
  return `${label}：${detail}`;
}
export function planIssues(existing: Issue[], results: Result[], rows: Mirror[], applied: Set<string>, now: string): Issue[] {
  const issues = existing.map(i => ({...i}));
  for (const i of issues) {
    const row = rows.find(r => r.kintone_record_id === i.kintone_record_id);
    if (!i.resolved_at && (!row || text(row.raw,"入金確認") || applied.has(i.kintone_record_id))) i.resolved_at = now;
  }
  for (const r of results.filter(r => r.notify && ["amount_mismatch","not_arrived","ambiguous"].includes(r.kind))) {
    if (!issues.some(i => i.kintone_record_id === r.row.kintone_record_id && i.kind === r.kind)) issues.push({ kintone_record_id:r.row.kintone_record_id, kind:r.kind, content:describeResult(r), opened_at:now, notified_at:null, resolved_at:null, resolved_notified_at:null });
  }
  return issues;
}
export function notification(issues: Issue[]) {
  const opened = issues.filter(i => !i.resolved_at && !i.notified_at), resolved = issues.filter(i => i.resolved_at && i.notified_at && !i.resolved_notified_at);
  if (!opened.length && !resolved.length) return "";
  return `[info][title]ブロードバンド事業：口座の確認（合わない行 ${opened.length} 件・直りました ${resolved.length} 件）[/title]\n${opened.map(i => `・${i.content}`).concat(resolved.map(i => `・直りました：${i.content.split("：")[0]}`)).join("\n")}\nKintone で金額か予定日を直すと、次の確認で自動で「直りました」と知らせます。\n[/info]`;
}
