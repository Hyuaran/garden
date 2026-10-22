import { getAllRecords, type KintoneRecord } from "@/lib/kintone/records";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type RecordFields = Record<string, { value: unknown }>;
export type BankRow = { date: string; content: string; value: number; side: string };
export type Action = { action: "add" | "update" | "unchanged" | "conflict"; key: string; id?: string; revision?: string; record: RecordFields };
const MARK = "Garden 自動転記";
const BUSINESS = "102_関西電力";
const START = "2024-07-01";
const companies = ["関電経費合計", "株式会社トップウェイ", "トップモビリティ（ヒラノジュンヤ）"];
const products = ["関西電力", "関電バイク代", "関電レンタカー代"];
const money = ["支払額_税込_", "支払額_税抜_", "利益額_税込_", "利益額_税抜_"];
const val = (r: KintoneRecord, k: string): unknown => (r[k] as { value?: unknown } | undefined)?.value;
const text = (r: KintoneRecord, k: string) => String(val(r, k) ?? "");
const fields = (o: Record<string, unknown>): RecordFields => Object.fromEntries(Object.entries(o).map(([k, value]) => [k, { value }]));
function amount(v: unknown) {
  if (v === "" || v == null || !Number.isFinite(Number(v))) throw new Error("Invalid source amount");
  return Number(v);
}
export function monthEnd(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

// まとめて払った月を、実際の月に分ける（今回に限り・2026-10-21 東海林さん）。トップモビリティ（ヒラノジュンヤ）の振込月 → 分ける先の月
export const MANUAL_SPLITS: Record<number, Record<string, string[]>> = {
  2: { "2024-11": ["2024-08", "2024-09", "2024-10", "2024-11"], "2025-02": ["2025-01", "2025-02"] },
};

// 明細リンク（174 では必須）：関電経費＝アプリ 95 のグラフ／振込＝Garden の口座の明細（その月）
export type DetailLinks = { expenses: string; bank: (month: string) => string };
const NO_LINKS: DetailLinks = { expenses: "https://garden-os.net/bud/bank", bank: () => "https://garden-os.net/bud/bank" };
export function buildRows(expenses: KintoneRecord[], bank: BankRow[], throughMonth: string, links: DetailLinks = NO_LINKS): RecordFields[] {
  const groups = new Map<string, { month: string; kind: number; total: number; date: string; content: string; mfDate: string }>();
  const add = (month: string, kind: number, total: number, date: string, content = "", mfDate = date) => {
    if (month < "2024-07" || month > throughMonth) return;
    const key = `${month}:${kind}`;
    const group = groups.get(key);
    if (group) { group.total += total; if (date > group.date) group.date = date; if (mfDate > group.mfDate) group.mfDate = mfDate; }
    else groups.set(key, { month, kind, total, date, content, mfDate });
  };
  for (const r of expenses) {
    if (text(r, "日付") < START || !(val(r, "事業選択") as string[] | undefined)?.includes("関電")) continue;
    const ym = text(r, "文字列__1行__4");
    if (!/^\d{4}(0[1-9]|1[0-2])$/.test(ym)) throw new Error("Invalid settlement month");
    const month = `${ym.slice(0, 4)}-${ym.slice(4)}`;
    add(month, 0, amount(val(r, "数値")), monthEnd(month));
  }
  for (const r of [...bank].sort((a, b) => a.date.localeCompare(b.date))) {
    if (r.side !== "EXPENSE") continue;
    const kind = r.content.includes("カ)トツプウエイ") ? 1 : r.content.includes("ヒラノ ジユンヤ") ? 2 : -1;
    if (kind < 0) continue;
    const paid = Math.abs(amount(r.value)), payMonth = r.date.slice(0, 7);
    const split = MANUAL_SPLITS[kind]?.[payMonth];
    if (split) {
      // 均等に分ける（端数は最後の月へ）。入出金予定日＝分けた先の月の末日・[MF]取引日＝実際に振り込んだ日
      const share = Math.floor(paid / split.length);
      split.forEach((m, i) => add(m, kind, i === split.length - 1 ? paid - share * (split.length - 1) : share, monthEnd(m), `${r.content}（${paid.toLocaleString("ja-JP")} 円を ${split.length} か月に分けた分）`, r.date));
    } else add(payMonth, kind, paid, r.date, r.content);
  }
  return [...groups.values()].filter(g => g.total !== 0).sort((a, b) => a.month.localeCompare(b.month) || a.kind - b.kind).map(g => {
    const net = Math.round(g.total / 1.1);
    return fields({ 事業内容: BUSINESS, 商材名: products[g.kind], 取引先会社名: companies[g.kind], 入金区分: "ショット", 消費税率: "10",
      入出金予定日: g.date, 実績期間: `${g.month}-01`, ドロップダウン_0: "ヒュアラン", 明細リンク: g.kind ? links.bank(g.month) : links.expenses,
      売上_税抜_: "0", 原価_税抜_: "0", 支払額_税込_: String(g.total), 支払額_税抜_: String(net), 利益額_税込_: String(-g.total), 利益額_税抜_: String(-net),
      ...(g.kind ? { _MF_銀行: "楽天銀行", _MF_取引日: g.mfDate, _MF_取引額: String(g.total), _MF_摘要: g.content } : {}) });
  });
}
// Kintone のグラフの並び順のために取引先名の頭へ「01 」などの番号が付けられることがある（2026-10-22 実害：番号付きに変わった行を見つけられず 81 行を二重に作った）。
// 番号は取引先の違いではないので、探すときは外して比べる
export const partnerBase = (name: string) => name.replace(/^\s*\d+\s+/, "").trim();
const keyOf = (r: KintoneRecord) => [text(r, "事業内容"), partnerBase(text(r, "取引先会社名")), text(r, "実績期間")].join("|");
function marked(r: KintoneRecord, historyField: string) {
  const rows = val(r, "テーブル");
  return Array.isArray(rows) && rows.some(row => row?.value?.[historyField]?.value === MARK);
}
export function reconcile(desired: RecordFields[], existing: KintoneRecord[], historyField: string): Action[] {
  return desired.map(record => {
    const key = keyOf(record);
    const matches = existing.filter(r => keyOf(r) === key);
    if (!matches.length) return { action: "add", key, record: { ...record, テーブル: { value: [{ value: fields({ [historyField]: MARK }) }] } } };
    const old = matches[0];
    if (matches.length !== 1 || !marked(old, historyField)) return { action: "conflict", key, record };
    const patch = Object.fromEntries(money.filter(k => Number(val(old, k)) !== Number(record[k].value)).map(k => [k, record[k]]));
    return { action: Object.keys(patch).length ? "update" : "unchanged", key, id: text(old, "$id"), revision: text(old, "$revision"), record: patch };
  });
}

export async function applyActions(actions: Action[], dryRun: boolean, write: (method: "POST" | "PUT", records: unknown[]) => Promise<void>) {
  if (dryRun) return;
  for (const action of ["add", "update"] as const) {
    const rows = actions.filter(a => a.action === action).map(a => action === "add" ? a.record : { id: a.id, revision: a.revision, record: a.record });
    for (let i = 0; i < rows.length; i += 100) await write(action === "add" ? "POST" : "PUT", rows.slice(i, i + 100));
  }
}

function env(name: string) { const v = process.env[name]; if (!v) throw new Error(`Missing ${name}`); return v; }
export async function runKandenSync(dryRun: boolean, now = new Date()) {
  const app = env("KINTONE_BROADBAND_APP_ID"), token = env("KINTONE_BROADBAND_TOKEN");
  const sourceApp = env("KINTONE_LEAF_KANDEN_EXPENSES_APP_ID"), sourceToken = env("KINTONE_LEAF_KANDEN_EXPENSES_TOKEN");
  const base = `https://${env("KINTONE_SUBDOMAIN")}.cybozu.com/k/v1/`;
  const through = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit" }).format(now);
  const end = monthEnd(through);
  // Resolve the actual history child code; refuse ambiguous schemas rather than writing a guessed field.
  const schemaResponse = await fetch(`${base}app/form/fields.json?app=${encodeURIComponent(app)}`, { headers: { "X-Cybozu-API-Token": token }, cache: "no-store" });
  if (!schemaResponse.ok) throw new Error(`kintone_schema_${schemaResponse.status}`);
  const schema = await schemaResponse.json() as { properties: Record<string, { type: string; fields?: Record<string, { code: string; label: string; type: string }> }> };
  const history = Object.values(schema.properties.テーブル?.fields ?? {}).filter(f => ["SINGLE_LINE_TEXT", "MULTI_LINE_TEXT"].includes(f.type));
  const preferred = history.filter(f => /履歴|内容|備考/.test(f.label));
  const candidates = preferred.length ? preferred : history;
  if (schema.properties.テーブル?.type !== "SUBTABLE" || candidates.length !== 1) throw new Error("History text field is ambiguous");
  const historyField = candidates[0].code;
  const expenses = await getAllRecords(sourceApp, sourceToken, `日付 >= "${START}" and 事業選択 in ("関電")`);
  const existing = await getAllRecords(app, token, `事業内容 in ("${BUSINESS}") and 実績期間 >= "${START}" and 実績期間 <= "${end}"`);
  const db = getSupabaseAdmin();
  const accounts = await db.from("bud_mf_accounts").select("mf_account_id").eq("bank_name", "楽天銀行").eq("corp_code", "HR").eq("kind", "bank");
  if (accounts.error) throw new Error("Bank account read failed");
  if (!accounts.data?.length) throw new Error("Rakuten HR account missing");
  const bank: BankRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await db.from("bud_mf_bank_transactions").select("date,content,value,side").in("mf_account_id", accounts.data.map(a => a.mf_account_id)).eq("side", "EXPENSE").gte("date", START).lte("date", end).order("date").order("mf_transaction_id").range(offset, offset + 999);
    if (page.error) throw new Error("Bank transaction read failed");
    bank.push(...page.data);
    if (page.data.length < 1000) break;
  }
  const subdomain = env("KINTONE_SUBDOMAIN");
  const rakuten = encodeURIComponent(accounts.data[0].mf_account_id);
  const links: DetailLinks = {
    expenses: `https://${subdomain}.cybozu.com/k/${sourceApp}/report?report=13320760`,
    bank: (month) => { const y = Number(month.slice(0, 4)), m = Number(month.slice(5, 7)); const fy = m >= 4 ? y : y - 1; return `https://garden-os.net/bud/bank/accounts/${rakuten}?period=fy:${fy}`; },
  };
  const actions = reconcile(buildRows(expenses, bank, through, links), existing, historyField);
  for (const a of actions.filter(a => a.action === "conflict")) console.warn("kanden-sync conflict", a.key);
  await applyActions(actions, dryRun, async (method, records) => {
    const response = await fetch(`${base}records.json`, { method, headers: { "X-Cybozu-API-Token": token, "Content-Type": "application/json" }, body: JSON.stringify({ app, records }), cache: "no-store" });
    if (!response.ok) { const body = await response.text().catch(() => ""); throw new Error(`kintone_write_${response.status} ${body.slice(0, 600)}`); }
  });
  return { dryRun, throughMonth: through, actions };
}
