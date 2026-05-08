import type { BudStatementRow } from "./statement-queries";

export interface AggregateBucket {
  inflow: number;
  outflow: number;
  count: number;
  netChange: number;
}

export interface AggregateEntry<K> extends AggregateBucket {
  key: K;
}

function emptyBucket(): AggregateBucket {
  return { inflow: 0, outflow: 0, count: 0, netChange: 0 };
}

function addToBucket(bucket: AggregateBucket, amount: number): void {
  bucket.count += 1;
  if (amount > 0) bucket.inflow += amount;
  else bucket.outflow += -amount;
  bucket.netChange += amount;
}

export function aggregateByCategory(
  rows: Pick<BudStatementRow, "amount" | "category">[],
): AggregateEntry<string>[] {
  const map = new Map<string, AggregateBucket>();
  for (const r of rows) {
    const key = r.category ?? "（未分類）";
    const b = map.get(key) ?? emptyBucket();
    addToBucket(b, r.amount);
    map.set(key, b);
  }
  return Array.from(map.entries())
    .map(([key, bucket]) => ({ key, ...bucket }))
    .sort((a, b) => b.outflow + b.inflow - (a.outflow + a.inflow));
}

export function aggregateByDate(
  rows: Pick<BudStatementRow, "amount" | "transaction_date">[],
): AggregateEntry<string>[] {
  const map = new Map<string, AggregateBucket>();
  for (const r of rows) {
    const b = map.get(r.transaction_date) ?? emptyBucket();
    addToBucket(b, r.amount);
    map.set(r.transaction_date, b);
  }
  return Array.from(map.entries())
    .map(([key, bucket]) => ({ key, ...bucket }))
    .sort((a, b) => (a.key < b.key ? -1 : 1));
}

export function aggregateByBankAccount(
  rows: Pick<BudStatementRow, "amount" | "bank_account_id">[],
): AggregateEntry<string>[] {
  const map = new Map<string, AggregateBucket>();
  for (const r of rows) {
    const b = map.get(r.bank_account_id) ?? emptyBucket();
    addToBucket(b, r.amount);
    map.set(r.bank_account_id, b);
  }
  return Array.from(map.entries())
    .map(([key, bucket]) => ({ key, ...bucket }))
    .sort((a, b) => b.outflow + b.inflow - (a.outflow + a.inflow));
}

export function totalAggregate(
  rows: Pick<BudStatementRow, "amount">[],
): AggregateBucket {
  const bucket = emptyBucket();
  for (const r of rows) addToBucket(bucket, r.amount);
  return bucket;
}

export function monthBoundary(yyyymm: string): { from: string; to: string } | null {
  const match = yyyymm.match(/^(\d{4})-(\d{1,2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const fromDate = new Date(year, month - 1, 1);
  const toDate = new Date(year, month, 0);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: fmt(fromDate), to: fmt(toDate) };
}
