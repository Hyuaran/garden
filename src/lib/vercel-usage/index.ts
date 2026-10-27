import { gunzipSync } from "node:zlib";

export type UsageRow = { day: string; service: string; usage: number; unit: string; cost_usd: number };
export type Alert = { key: string; active: boolean; since: string | null; last_notified_at: string | null; detail: Record<string, unknown> };
const DAY = 86400000;
export const INCLUDED_USAGE_USD = 20;
const seat = (service: string) => ["Pro", "Additional Team Seats"].includes(service);
export function billingPeriod(now: Date) {
  // Vercel の 1 日はアメリカ西海岸の 0 時で区切られる（明細の ChargePeriodStart＝07:00Z／冬は 08:00Z）。
  // 日本の朝に見ると西海岸はまだ前の日なので、8 時間引いた日付を「今日」とし、締まった日だけを数える
  const la = new Date(now.getTime() - 8 * 3600000);
  const today = new Date(Date.UTC(la.getUTCFullYear(), la.getUTCMonth(), la.getUTCDate()));
  const month = now.getUTCMonth() - (now.getUTCDate() < 20 ? 1 : 0);
  return { today, start: new Date(Date.UTC(now.getUTCFullYear(), month, 20)), end: new Date(Date.UTC(now.getUTCFullYear(), month + 1, 20)) };
}

// FOCUS v1.3: https://vercel.com/docs/rest-api/billing/list-focus-billing-charges
export async function fetchBillingCharges(from: Date, to: Date, token = process.env.VERCEL_BILLING_TOKEN, request: typeof fetch = fetch): Promise<{ skipped: "no_token"; rows: UsageRow[] } | { rows: UsageRow[] }> {
  if (!token) return { skipped: "no_token", rows: [] };
  const url = new URL("https://api.vercel.com/v1/billing/charges");
  url.searchParams.set("from", from.toISOString()); url.searchParams.set("to", to.toISOString()); url.searchParams.set("slug", "hyuaran-5e506769");
  const response = await request(url, { headers: { Authorization: `Bearer ${token}`, "Accept-Encoding": "gzip" }, cache: "no-store", signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Billing request failed (${response.status})`);
  let bytes = Buffer.from(await response.arrayBuffer());
  // Native fetch already decompresses; magic bytes also support raw gzip responses.
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = gunzipSync(bytes);
  const rows = new Map<string, UsageRow>();
  for (const line of bytes.toString("utf8").split(/\r?\n/).filter(l => l.trim())) {
    const item = JSON.parse(line);
    if (seat(item.ServiceName)) continue;
    const date = new Date(item.ChargePeriodStart);
    // BilledCost は込み分（月 20 ドル）を差し引いた後の請求額。使用額は EffectiveCost（差し引く前）で数える
    const cost = Number(item.EffectiveCost ?? item.BilledCost), usage = Number(item.ConsumedQuantity ?? 0);
    if (!item.ServiceName || !Number.isFinite(date.getTime()) || !Number.isFinite(cost) || !Number.isFinite(usage) || item.BillingCurrency !== "USD") throw new Error("Invalid billing charge");
    if (date < from || date >= to) continue;
    const day = date.toISOString().slice(0, 10), service = String(item.ServiceName), key = `${day}:${service}`;
    const old = rows.get(key);
    if (old && old.unit !== (item.ConsumedUnit ?? "")) throw new Error("Inconsistent billing units");
    rows.set(key, { day, service, usage: (old?.usage ?? 0) + usage, unit: item.ConsumedUnit ?? "", cost_usd: (old?.cost_usd ?? 0) + cost });
  }
  return { rows: [...rows.values()] };
}

export function judgeUsage(rows: UsageRow[], previous: Alert[], now = new Date(), included = INCLUDED_USAGE_USD) {
  const { today, start, end } = billingPeriod(now);
  const day = (offset: number) => new Date(today.getTime() - offset * DAY).toISOString().slice(0,10);
  const valid = rows.filter(r => !seat(r.service) && r.day < day(0));
  const current = valid.filter(r => r.day >= start.toISOString().slice(0,10));
  const spent = current.reduce((sum,r) => sum + r.cost_usd, 0);
  const recent = valid.filter(r => r.day >= day(3)).reduce((sum,r) => sum + r.cost_usd, 0);
  const projected = spent + recent / 3 * ((end.getTime() - today.getTime()) / DAY);
  const conditions = [{ key: "projected_over", active: projected > included }, { key: "spent_over", active: spent > included }];
  const spikes: { service: string; cost: number; median: number }[] = [];
  for (const service of new Set(valid.map(r => r.service))) {
    const total = (d: string) => valid.filter(r => r.day === d && r.service === service).reduce((s,r) => s+r.cost_usd,0);
    const baseline = Array.from({length:7},(_,i)=>total(day(i+2))).sort((a,b)=>a-b);
    const cost = total(day(1)), median = baseline[3];
    if (cost >= 0.20 && cost >= median * 2) { spikes.push({ service, cost, median }); conditions.push({key:`spike:${service}:${day(1)}`,active:true}); }
  }
  const changes = conditions.flatMap(c => {
    const old = previous.find(p => p.key === c.key);
    if ((old?.active ?? false) === c.active) return [];
    return [{ ...c, since: c.active ? now.toISOString() : null, last_notified_at: now.toISOString(), detail: { spent, projected, included } } satisfies Alert];
  });
  const jst = new Date(now.getTime()+9*3600000);
  const weeklyKey = `weekly:${jst.toISOString().slice(0,10)}`;
  const monday = jst.getUTCDay() === 1;
  if (monday && !previous.some(p=>p.key===weeklyKey)) changes.push({key:weeklyKey,active:true,since:now.toISOString(),last_notified_at:now.toISOString(),detail:{spent,projected,included}});
  const totals = new Map<string,number>();
  current.forEach(r=>totals.set(r.service,(totals.get(r.service)??0)+r.cost_usd));
  return { spent, projected, included, start, end, spikes, changes, top: [...totals].sort((a,b)=>b[1]-a[1]).slice(0,3) };
}

const labels: Record<string,string> = { "Fluid Provisioned Memory":"関数のメモリ", "Fast Origin Transfer":"送受信データ", "Observability Events":"観測イベント", "Function Invocations":"関数の呼び出し", "Fluid Active CPU":"関数の CPU", "Build CPU Minutes":"配備の作業時間" };
export function usageNotice(result: ReturnType<typeof judgeUsage>, change: Alert, now = new Date()) {
  const money = (n:number)=>n.toFixed(2);
  const date = (d:Date)=>`${d.getUTCMonth()+1}/${d.getUTCDate()}`;
  if (change.key.startsWith("weekly:")) return `[info][title]Vercel の料金（Garden のサーバー）[/title]今週のまとめ：今の請求期間（${date(result.start)}〜${date(result.end)}）の使用量 ${money(result.spent)} ドル／込み分 ${money(result.included)} ドル・見込み ${money(result.projected)} ドル・多い順：${result.top.map(([s,c])=>`${labels[s]??s} ${money(c)} ドル`).join("・") || "使用なし"}[/info]`;
  const status = change.key.startsWith("weekly:") ? "今週のまとめ" : !change.active ? "落ち着きました" : change.key === "spent_over" ? "込み分を超えました。追加料金が出ます" : change.key === "projected_over" ? "込み分を超える見込みです" : "昨日の使用量が急に増えました";
  const spike = result.spikes.find(s=>change.key===`spike:${s.service}:${new Date(now.getTime()-DAY).toISOString().slice(0,10)}`);
  return `[info][title]Vercel の料金（Garden のサーバー）[/title]${now.toLocaleString("sv-SE",{timeZone:"Asia/Tokyo"}).slice(0,16)} 自動\n${status}\n今の請求期間（${date(result.start)}〜${date(result.end)}）の使用量：${money(result.spent)} ドル（込み分 ${money(result.included)} ドル）\n請求期間の終わりに ${money(result.projected)} ドルの見込み\n${spike ? `昨日増えたもの：${labels[spike.service]??spike.service} ${money(spike.cost)} ドル（${spike.median ? `いつもの ${(spike.cost/spike.median).toFixed(1)} 倍` : "これまでの使用なし"}）\n` : ""}多い順：${result.top.map(([s,c])=>`${labels[s]??s} ${money(c)} ドル`).join("・")}\n確認：https://vercel.com/hyuaran-5e506769/garden/observability/vercel-functions[/info]`;
}
