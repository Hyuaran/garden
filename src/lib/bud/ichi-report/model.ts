export type Row = Record<string, unknown>;
export const object = (v: unknown): Row => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Row : {};
export const rows = (v: unknown): Row[] => Array.isArray(v) ? v.filter(x => x !== null && typeof x === "object" && !Array.isArray(x)) : [];
export const number = (v: unknown): number | null => typeof v === "number" && Number.isFinite(v) ? v : null;
export const text = (v: unknown): string => typeof v === "string" ? v : "";
export function extractReport(html: string): Row {

  const matches = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)]
    .flatMap(script => [...script[1].matchAll(/\bconst\s+D\s*=\s*(\{[\s\S]*?\})\s*;/g)]);

  if(matches.length !== 1) throw new Error("報告のデータを読み取れませんでした");

  const value: unknown = JSON.parse(matches[0][1]);

  if(!value || typeof value !== "object" || Array.isArray(value)) throw new Error("報告の形式が違います");

  return object(value);
}
export function profit(row: Row) {

  const t = object(row["合計"]), c = object(row.cost);

  const amt = number(t.amt), paid = number(t.paid), carry = t.carry === undefined ? 0 : number(t.carry);

  const ntt = number(c.ntt), isp = number(c.isp), fee = number(c.fee), out = number(c.out);

  const sales = amt !== null && carry !== null ? amt - carry : null;

  const cost = ntt !== null && isp !== null ? ntt + isp : null;

  const exp = fee !== null && out !== null ? fee + out : null;

  const gross = sales !== null && cost !== null ? sales - cost : null;

  const op = gross !== null && exp !== null ? gross - exp : null;

  return {
    billed: amt, carry, sales, paid, cost, exp, gross, op,
    unpaid: amt !== null && paid !== null ? amt - paid : null,
    grossPaid: paid !== null && cost !== null ? paid - cost : null,
    opPaid: paid !== null && cost !== null && exp !== null ? paid - cost - exp : null
  };
}
export const ratio = (a: unknown, b: unknown): number | null => {

  const x = number(a), y = number(b);

  return x !== null && y !== null && y > 0 ? Math.round(x / y * 1000) / 10 : null;
};
export const perPerson = (t: Row): number | null => {

  const amt = number(t.amt), n = number(t.n), carry = t.carry === undefined ? 0 : number(t.carry);

  return amt !== null && n !== null && n > 0 && carry !== null ? (amt - carry) / n : null;
};
export const billingMonths = (data: Row) => rows(object(data.billing).months).filter(r => (number(object(r["合計"]).n) ?? 0) > 0);
export function updatedDate(value: unknown) {

  const match = text(value).match(/^(\d{4})年(\d{1,2})月(\d{1,2})日\s+(\d{2}:\d{2})$/);

  return match ? `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}T${match[4]}:00+09:00` : null;
}

export function sum(values: unknown[]): number | null {

  if(values.some(v => number(v) === null)) return null;

  return (values as number[]).reduce((total, v) => total + v, 0);
}
export function missingCost(months: Row[], index: number, key: "isp" | "fee") {

  const r = months[index];

  return index > 0 && (key === "isp" ? r.open === true : !r.open)
    && object(r.cost)[key] === 0 && (number(object(months[index - 1].cost)[key]) ?? 0) > 0;
}
