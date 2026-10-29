import { getAllRecords, type KintoneRecord } from "@/lib/kintone/records";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ChatworkClient } from "@/lib/chatwork/client";
import { buildPatch, notification, payeeKeyword, planIssues, reconcile, shiftDate, text, value, type Bank, type Issue, type Mirror, type Settings } from "./reconcile";

const env = (key: string) => { const v = process.env[key]; if (!v) throw new Error(`Missing ${key}`); return v; };
// Garden の写しでは、取引先名の頭の並び順用の番号（「01 」など）を外しておく（照合・表の判定は番号なしの名前で行う。Kintone へは書き戻さない）
const partnerBase = (name: string) => name.replace(/^\s*\d+\s+/, "").trim();
export function mirror(original: KintoneRecord, now: string) {
  const raw = { ...original, 取引先会社名: { ...(original.取引先会社名 as object), value: partnerBase(text(original,"取引先会社名")) } } as KintoneRecord;
  const num = (k: string) => text(raw,k) === "" ? null : Number(value(raw,k));
  return { kintone_record_id:text(raw,"$id"), revision:text(raw,"$revision"), source:"kintone", business:text(raw,"事業内容"), partner:text(raw,"取引先会社名"), product:text(raw,"商材名"), payment_type:text(raw,"入金区分"), scheduled_date:text(raw,"入出金予定日") || null, actual_period:text(raw,"実績期間") || null, tax_rate:num("消費税率"), sales_net:num("売上_税抜_"), payment_net:num("支払額_税抜_"), payment_gross:num("支払額_税込_"), profit_net:num("利益額_税抜_"), confirmation:text(raw,"入金確認"), mf_company:text(raw,"ドロップダウン_0"), mf_bank:text(raw,"_MF_銀行"), mf_content:text(raw,"_MF_摘要"), mf_date:text(raw,"_MF_取引日") || null, mf_amount:num("_MF_取引額"), updated_at:now, raw };
}
// 一致した明細から「この取引先は口座ではこの名前」を覚える（東海林さん 2026-10-21 OK）。決まりが既にある取引先は触らない
export function learnRules(results: ReturnType<typeof reconcile>, rules: {partner:string}[]) {
  const known = new Set(rules.map(r => r.partner)), counts = new Map<string, Map<string, number>>();
  for (const r of results) {
    if (r.kind !== "matched" || !r.bank) continue;
    const partner = text(r.row.raw,"取引先会社名"), keyword = payeeKeyword(r.bank.content);
    if (!partner || known.has(partner) || !keyword) continue;
    const m = counts.get(partner) ?? new Map<string, number>(); m.set(keyword,(m.get(keyword) ?? 0)+1); counts.set(partner,m);
  }
  // 2 回以上同じ名前で一致したときだけ覚える（偶然の 1 回を覚えない）
  return [...counts].map(([partner,m]) => [partner,[...m].sort((a,b) => b[1]-a[1])[0]] as const).filter(([,top]) => top[1] >= 2).map(([partner,top]) => ({ partner, keywords: [top[0]] }));
}
export async function applyMatches(results: ReturnType<typeof reconcile>, history: string, dryRun: boolean,
  write: (records: {id:string; revision:string; record:KintoneRecord}[]) => Promise<{id:string; revision:string}[]>,
  save: (row: Mirror, patch: KintoneRecord, revision: string, bankId: string) => Promise<void>) {
  const applied = new Set<string>();
  if (dryRun) return applied;
  const updates = results.flatMap(r => { const patch = buildPatch(r,history); return patch ? [{id:r.row.kintone_record_id,revision:r.row.revision,record:patch}] : []; });
  // A revision conflict aborts a Kintone batch. Split it to skip only the conflicting row.
  const batch = async (records: typeof updates): Promise<void> => {
    let written: {id:string; revision:string}[];
    try { written = await write(records); }
    catch (e) {
      if (!(e instanceof Error) || e.message !== "revision_conflict") throw e;
      if (records.length === 1) return;
      const middle = Math.ceil(records.length/2); await batch(records.slice(0,middle)); await batch(records.slice(middle)); return;
    }
    for (const item of written) {
      const result = results.find(r => r.row.kintone_record_id === item.id)!;
      const patch = records.find(r => r.id === item.id)!.record;
      await save(result.row,patch,item.revision,result.bank!.mf_transaction_id);
      applied.add(item.id);
    }
  };
  for (let i=0;i<updates.length;i+=100) await batch(updates.slice(i,i+100));
  return applied;
}
export async function saveReconResults(results: ReturnType<typeof reconcile>, now: string, dryRun: boolean, rpc: (rows: object[]) => Promise<void>) {
  if (dryRun) return;
  await rpc(results.map(r => ({kintone_record_id:r.row.kintone_record_id,
    recon_status:text(r.row.raw,"入金確認") ? "matched" : r.kind,
    expected_gross:Number.isFinite(r.expected) ? r.expected : null, recon_fee:r.fee ?? null,
    recon_checked_at:now, recon_bank:r.bank ? [r.bank] : r.kind === "amount_mismatch" || r.kind === "ambiguous" ? r.candidates : []})));
}
export async function runRecon(dryRun: boolean, now = new Date()) {
  const db = getSupabaseAdmin(), token = crypto.randomUUID();
  const claim = await db.rpc("bud_bb_claim",{p_token:token});
  if (claim.error) throw new Error("口座照合を開始できませんでした");
  if (!claim.data) return { skipped:true, reason:"確認中です" };
  try { return await executeRecon(dryRun,now); }
  finally { const released = await db.rpc("bud_bb_release",{p_token:token}); if (released.error) console.error("broadband recon release failed"); }
}
async function executeRecon(dryRun: boolean, now: Date) {
  const db = getSupabaseAdmin();
  const checked = <T>(r: {data:T; error:unknown}): NonNullable<T> => { if (r.error) throw new Error("口座照合の読み書きに失敗しました"); return r.data as NonNullable<T>; };
  const settings = checked(await db.from("bud_bb_settings").select("*").single()) as Settings;
  if (settings.record_master === "garden") return { error:"まだ使えません" };
  const app = env("KINTONE_BROADBAND_APP_ID"), token = env("KINTONE_BROADBAND_TOKEN"), base = `https://${env("KINTONE_SUBDOMAIN")}.cybozu.com/k/v1/`;
  const nowText = now.toISOString();
  const originals = await getAllRecords(app,token,"");
  checked(await db.rpc("bud_bb_replace_mirror",{p_rows:originals.map(r => mirror(r,nowText))}));
  const readAll = async <T>(table: string): Promise<T[]> => {
    const all: T[] = [];
    for (let offset=0;;offset+=1000) {
      const data = checked(await db.from(table).select("*").order(table === "bud_bb_records" || table === "bud_bb_recon_issues" ? "kintone_record_id" : "partner").range(offset,offset+999));
      all.push(...data as T[]); if (data.length<1000) return all;
    }
  };
  const rows = await readAll<Mirror>("bud_bb_records");
  const rules = await readAll<{partner:string;keywords:string[]}>("bud_bb_payee_rules");
  const accounts = checked(await db.from("bud_mf_accounts").select("mf_account_id,corp_code,bank_name").eq("kind","bank"));
  const bank: Bank[] = [];
  const dates = rows.map(r => text(r.raw,"入出金予定日")).filter(d => d >= settings.recon_from).sort();
  if (dates.length) for (let offset=0;;offset+=1000) {
    const page = checked(await db.from("bud_mf_bank_transactions").select("*").gte("date",shiftDate(dates[0],-settings.date_window_before)).lte("date",shiftDate(dates.at(-1)!,settings.date_window_after)).order("mf_transaction_id").range(offset,offset+999));
    for (const b of page) { const account = accounts.find(a => a.mf_account_id === b.mf_account_id); if (account) bank.push({...b,...account} as Bank); }
    if (page.length<1000) break;
  }
  const today = new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Tokyo"}).format(now);
  // 1 回目で覚えた名前を足して 2 回目を本番の結果にする（ほかの取引先の入金を当てないため）
  const learned = learnRules(reconcile(rows,bank,rules,settings,today), rules);
  const results = reconcile(rows,bank,[...rules,...learned],settings,today);
  const counts = Object.fromEntries(["matched","amount_mismatch","not_arrived","ambiguous","excluded","pending"].map(k => [k,results.filter(r => r.kind===k).length]));
  if (dryRun) return {dryRun,counts,results,learned};
  await saveReconResults(results,nowText,false,async p_rows => { checked(await db.rpc("bud_bb_save_recon",{p_rows})); });
  if (learned.length) checked(await db.from("bud_bb_payee_rules").upsert(learned,{onConflict:"partner"}));
  const schemaResponse = await fetch(`${base}app/form/fields.json?app=${encodeURIComponent(app)}`,{headers:{"X-Cybozu-API-Token":token},cache:"no-store"});
  if (!schemaResponse.ok) throw new Error("kintone_schema_failed");
  const schema = await schemaResponse.json() as {properties:Record<string,{type:string;fields?:Record<string,{code:string;label:string;type:string}>}>};
  const fields = Object.values(schema.properties.テーブル?.fields ?? {}).filter(f => ["SINGLE_LINE_TEXT","MULTI_LINE_TEXT"].includes(f.type));
  const preferred = fields.filter(f => /履歴|内容|備考|詳細/.test(f.label));
  const history = preferred.length ? preferred : fields;
  if (schema.properties.テーブル?.type !== "SUBTABLE" || history.length !== 1) throw new Error("History text field is ambiguous");
  const applied = await applyMatches(results,history[0].code,false,async records => {
    const response = await fetch(`${base}records.json`,{method:"PUT",headers:{"X-Cybozu-API-Token":token,"Content-Type":"application/json"},body:JSON.stringify({app,records}),cache:"no-store"});
    const body = await response.json();
    if (!response.ok) throw new Error(body.code === "GAIA_CO02" ? "revision_conflict" : "kintone_write_failed");
    return body.records;
  },async (row,patch,revision,bankId) => {
    const raw = {...row.raw,...patch,$revision:{value:revision}};
    checked(await db.from("bud_bb_records").update({...mirror(raw,nowText),mf_transaction_id:bankId}).eq("kintone_record_id",row.kintone_record_id));
  });
  const existing = await readAll<Issue>("bud_bb_recon_issues");
  const issues = planIssues(existing,results,rows,applied,nowText);
  if (issues.length) checked(await db.from("bud_bb_recon_issues").upsert(issues,{onConflict:"kintone_record_id,kind"}));
  // 知らせは日本時間 10:00 より前には送らない。朝の照合の分は 10:00 の定時（sendReconNotice）でまとめて送る。
  if (tokyoHour(now) >= 10) await deliverReconNotice(issues,nowText,async rows => { checked(await db.from("bud_bb_recon_issues").upsert(rows,{onConflict:"kintone_record_id,kind"})); });
  return {dryRun,counts,results,applied:[...applied]};
}
export const tokyoHour = (now: Date) => Number(new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Tokyo",hour:"numeric",hourCycle:"h23"}).format(now));
async function deliverReconNotice(issues: Issue[], nowText: string, save: (rows: Issue[]) => Promise<void>) {
  const message = notification(issues);
  if (!message) return 0;
  await new ChatworkClient(env("CHATWORK_API_TOKEN")).sendMessage(env("BUD_BB_RECON_CHATWORK_ROOM_ID"),message);
  const sent = issues.filter(i => (!i.resolved_at && !i.notified_at) || (i.resolved_at && i.notified_at && !i.resolved_notified_at)).map(i => i.resolved_at ? {...i,resolved_notified_at:nowText} : {...i,notified_at:nowText});
  await save(sent);
  return sent.length;
}
// 10:00 の定時：まだ知らせていない「合わない行」「直りました」を送る（照合はしない）。
export async function sendReconNotice(now = new Date()) {
  const db = getSupabaseAdmin(), token = crypto.randomUUID();
  const claim = await db.rpc("bud_bb_claim",{p_token:token});
  if (claim.error) throw new Error("口座照合の知らせを開始できませんでした");
  if (!claim.data) return { skipped:true, reason:"確認中です" };
  try {
    const issues: Issue[] = [];
    for (let offset=0;;offset+=1000) {
      const page = await db.from("bud_bb_recon_issues").select("*").order("kintone_record_id").range(offset,offset+999);
      if (page.error) throw new Error("口座照合の知らせを読めませんでした");
      issues.push(...page.data as Issue[]); if (page.data.length<1000) break;
    }
    const sent = await deliverReconNotice(issues,now.toISOString(),async rows => { const r = await db.from("bud_bb_recon_issues").upsert(rows,{onConflict:"kintone_record_id,kind"}); if (r.error) throw new Error("口座照合の知らせを記録できませんでした"); });
    return { sent };
  } finally { const released = await db.rpc("bud_bb_release",{p_token:token}); if (released.error) console.error("broadband recon release failed"); }
}
