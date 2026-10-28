import { isK, isNtt } from "./references";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Kind } from "./reconcile";
import type { Bank } from "./reconcile";

export type TableRecord = {
  kintone_record_id: string; business: string; partner: string; product: string;
  scheduled_date: string | null; actual_period: string | null; profit_net: number | null;
  confirmation: string; recon_status: Kind | null; expected_gross: number | null;
  recon_fee: number | null; updated_at: string; mf_bank: string; mf_date: string | null;
  mf_content: string; mf_amount: number | null;
  drive_link?: string | null; // Kintone の「明細リンク」（Google ドライブの明細）
  recon_bank?: Bank[];
};
// Both record masters use the same local table. Never read Kintone here.
export async function readBroadbandTable(db: SupabaseClient): Promise<TableRecord[]> {
  const rows: TableRecord[] = [];
  for (let offset = 0;; offset += 1000) {
    const { data, error } = await db.from("bud_bb_records").select("kintone_record_id,business,partner,product,scheduled_date,actual_period,profit_net,confirmation,recon_status,expected_gross,recon_fee,updated_at,mf_bank,mf_date,mf_content,mf_amount,drive_link:raw->明細リンク->>value").order("kintone_record_id").range(offset, offset + 999);
    if (error) throw new Error("収支を読み込めませんでした");
    rows.push(...data as unknown as TableRecord[]); // 型の読み取りは日本語の欄名（明細リンク）を解けないので明示する
    if (data.length < 1000) return rows;
  }
}
export type SortMode = "cash" | "amount" | "name";
export const sortOptions = [{ value: "cash", label: "入金 → 支払い" }, { value: "amount", label: "金額の大きい順" }, { value: "name", label: "取引先名の順" }];
export function readSort(storage: Pick<Storage, "getItem">, user: string): SortMode {
  try { const value = storage.getItem(`bud-broadband-sort:${user}`); if (sortOptions.some(o => o.value === value)) return value as SortMode; } catch {}
  return "cash";
}
export function saveSort(storage: Pick<Storage, "setItem">, user: string, value: SortMode) {
  try { storage.setItem(`bud-broadband-sort:${user}`, value); } catch {}
}
export const fiscalYear = (date: string) => Number(date.slice(0,4)) - (Number(date.slice(5,7)) < 4 ? 1 : 0);
export function periodOptions(rows: TableRecord[], today: string) {
  const year = fiscalYear(today), years = rows.flatMap(r => r.scheduled_date ? [fiscalYear(r.scheduled_date)] : []);
  const earliest = Math.min(year - 1, ...years);
  // 「今年度」「前年度」とは書かない（東海林さん 2026-10-21：年度は「2026年度」の形で）
  return [{ value: "rolling", label: "直近12か月" }, ...Array.from({length: year-earliest+1}, (_,i) => ({ value: String(year-i), label: `${year-i}年度` }))];
}
export function periodMonths(periods: string[], today: string, rows?: TableRecord[]) {
  const months = new Set<string>(), year = fiscalYear(today);
  for (const period of periods) {
    const start = period === "rolling" ? Number(today.slice(0,4))*12 + Number(today.slice(5,7))-12 : (period === "current" ? year : period === "previous" ? year-1 : Number(period))*12+3;
    if (!Number.isFinite(start)) continue;
    for (let i=0;i<12;i++) { const n=start+i; months.add(`${Math.floor(n/12)}-${String(n%12+1).padStart(2,"0")}`); }
  }
  // 新しい月を左に（東海林さん 2026-10-21）。まだ来ていない月は、予定の行がある月まで
  const latest = [today.slice(0,7), ...(rows ?? []).map(r => r.scheduled_date?.slice(0,7) ?? "")].sort().at(-1)!;
  return [...months].filter(m => m <= latest).sort().reverse();
}
export const defaultPeriod = (today: string) => String(fiscalYear(today));
const tokyoToday = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());
// 入金確認があっても、マネーフォワードの取引日が今日より後なら、まだ届いていない＝予定日前（Kintone の入力を先回りしている・2026-10-28 Fプレイン 1099）
export function recordStatus(row: TableRecord, today = tokyoToday()): Kind | null {
  if (isK(row.partner) || isNtt(row.partner)) return "excluded";
  if (row.confirmation && row.mf_date && row.mf_date.slice(0,10) > today) return "pending";
  return row.confirmation ? "matched" : row.recon_status;
}
export function cellTone(rows: TableRecord[], today = tokyoToday()) {
  const states = rows.map(r => recordStatus(r, today)).filter(s => s !== "excluded");
  if (states.some(s => s === "amount_mismatch" || s === "not_arrived" || s === "ambiguous")) return "red";
  return states.length && states.every(s => s === "pending") ? "gray" : "normal";
}
// 明細リンクは Google ドライブのときだけ使う（仮の google.com・Kintone の集計表・口座の画面へのリンクは出さない）
export const driveLink = (url?: string | null) => url && /^https:\/\/(drive|docs)\.google\.com\//.test(url) ? url : null;
export const total = (rows: TableRecord[]) => rows.reduce((n,r) => n+Number(r.profit_net ?? 0),0);
export type PivotRow = { key: string; business: string; partner: string; subtotal: boolean; records: TableRecord[] };
export function buildPivot(records: TableRecord[], months: string[], sort: SortMode) {
  const rows = records.filter(r => r.scheduled_date && months.includes(r.scheduled_date.slice(0,7)));
  const result: PivotRow[] = [];
  for (const business of [...new Set(rows.map(r => r.business))].sort((a,b) => a.localeCompare(b,"ja"))) {
    const group = rows.filter(r => r.business === business);
    result.push({key: JSON.stringify([business]), business, partner: "小計", subtotal: true, records: group});
    const partners = [...new Set(group.map(r => r.partner))].map(partner => ({key: JSON.stringify([business,partner]), business, partner, subtotal:false, records:group.filter(r => r.partner === partner)}));
    partners.sort((a,b) => {
      const x=total(a.records), y=total(b.records), name=a.partner.localeCompare(b.partner,"ja");
      return sort === "name" ? name : sort === "amount" ? y-x || name : Number(y>0)-Number(x>0) || Math.abs(y)-Math.abs(x) || name;
    });
    result.push(...partners);
  }
  result.push({key:"grand", business:"総合計", partner:"", subtotal:true, records:rows});
  return result;
}
export const money = (n: number | null) => n == null ? "記録なし" : `${n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("ja-JP")} 円`;
export const statusLabels: Record<Kind,string> = { matched:"確認済み", amount_mismatch:"金額が口座と違う", not_arrived:"口座に見つからない（入金・支払いが届いていない）", ambiguous:"候補が複数", pending:"予定日前", excluded:"照合の対象外" };
export function kintoneLink(base: string, id: string) { return `${base}/show#record=${encodeURIComponent(id)}`; }

export type BroadbandOrder = { businesses: string[]; partners: Record<string,string[]> };
export function readOrder(storage: Pick<Storage,"getItem">, user:string): BroadbandOrder|null {
 try { const v=JSON.parse(storage.getItem('bud-broadband-order:'+user) ?? 'null');
 if(v && Array.isArray(v.businesses) && v.businesses.every((s:unknown)=>typeof s==='string') && v.partners && typeof v.partners==='object' && !Array.isArray(v.partners) && Object.values(v.partners).every(a=>Array.isArray(a) && a.every(s=>typeof s==='string'))) return v;
 } catch {} return null;
}
export function saveOrder(storage:Pick<Storage,"setItem">,user:string,order:BroadbandOrder) {try {storage.setItem('bud-broadband-order:'+user,JSON.stringify(order));}catch {}}
export function orderFromPivot(pivot:PivotRow[]):BroadbandOrder {const groups=pivot.filter(r=>r.subtotal && r.key!=='grand');return {businesses:groups.map(r=>r.business),partners:Object.fromEntries(groups.map(r=>[r.business,pivot.filter(p=>!p.subtotal && p.business===r.business).map(p=>p.partner)]))};}
export function applyOrder(pivot:PivotRow[],order:BroadbandOrder|null):PivotRow[] {
 if(!order) return pivot;
 const rank=(list:string[],v:string)=>{const i=list.indexOf(v);return i<0 ? list.length : i;};
 const groups=pivot.filter(r=>r.subtotal && r.key!=='grand').sort((a,b)=>rank(order.businesses,a.business)-rank(order.businesses,b.business));
 return [...groups.flatMap(r=>[r,...pivot.filter(p=>!p.subtotal && p.business===r.business).sort((a,b)=>rank((Object.hasOwn(order.partners,r.business) ? order.partners[r.business] : []),a.partner)-rank((Object.hasOwn(order.partners,r.business) ? order.partners[r.business] : []),b.partner))]),...pivot.filter(r=>r.key==='grand')];
}
export function movePivot(pivot:PivotRow[],source:string,target:string):BroadbandOrder {
 const order=orderFromPivot(pivot),a=pivot.find(r=>r.key===source),b=pivot.find(r=>r.key===target);
 if(!a || !b || a.key==='grand' || b.key==='grand' || a.subtotal!==b.subtotal || (!a.subtotal && a.business!==b.business)) return order;
 const list=a.subtotal ? order.businesses : order.partners[a.business], from=list.indexOf(a.subtotal ? a.business : a.partner),to=list.indexOf(b.subtotal ? b.business : b.partner);
 list.splice(to,0,...list.splice(from,1));return order;
}
