import { pointFor, resolveChannel, validDate, type Channel, type PointRow } from "./index";

const fields = ["product", "master", "business", "list", "date"] as const;
type Field = (typeof fields)[number];
export type KintonePointInput = Record<Field, string>;
export type KintonePointResult = {
  points: number | null;
  toss: number | null;
  product: string | null;
  channel: Channel | null;
};

export function parseKintonePointQuery(params: URLSearchParams): KintonePointInput | null {
  const input: KintonePointInput = { product: "", master: "", business: "", list: "", date: "" };
  const seen = new Set<string>();
  for (const [key, value] of params) {
    if (!fields.includes(key as Field) || seen.has(key) || value.length > 256 ||
        /[\u0000-\u001f\u007f\ufffd]/u.test(value)) return null;
    seen.add(key);
    input[key as Field] = value.trim();
  }
  return validDate(input.date) && (input.product || input.master) ? input : null;
}

export function resolveKintonePoints(
  rows: readonly PointRow[],
  input: KintonePointInput,
): KintonePointResult {
  const channel = resolveChannel({ 事業名: input.business.trim(), リスト名: input.list.trim() });
  const productName = input.product.trim();
  const master = input.master.trim();
  const order = { channel, orderDate: input.date, productName };
  const row = (productName ? pointFor(rows, order) : null) ??
    (master ? pointFor(rows, { ...order, productName: master }) : null);
  return { points: row?.total_points ?? null, toss: row ? Number(row.toss_points ?? 0) : null, product: row?.product ?? null, channel };
}
