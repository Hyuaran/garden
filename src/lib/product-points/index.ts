export const CHANNELS = {
  hakuchi: "白地",
  lp: "LP",
  alliance: "アライアンス",
} as const;
export const CATEGORIES = {
  kaisen: "回線",
  credit: "クレカ",
  denki: "電気ガス",
} as const;
export const REPORT_GROUPS = {
  collab: "コラボ",
  au: "AU",
  credit: "クレカ",
  nuro: "NURO",
  denki: "でんき",
  other: "その他",
} as const;
export type Channel = keyof typeof CHANNELS;
export type PointRow = {
  id: string;
  product: string;
  channel: Channel;
  category: keyof typeof CATEGORIES;
  report_group: keyof typeof REPORT_GROUPS;
  start_date: string;
  end_date: string | null;
  total_points: number;
  toss_points: number;
  closer_points: number;
  unit_price: number | null;
  has_option: string | null;
  kintone_names: string[];
  sort_order: number;
  note: string | null;
  updated_at: string;
  updated_by: string | null;
};
export type Order = {
  productName: string;
  orderDate: string;
  channel: Channel | null;
  // 顧客一覧の「商材区分2（マスタ）」。商材名で表に無いときだけ使う
  masterProduct?: string;
};
export const normalizeProduct = (name: string) =>
  name.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
export const roundPoints = (value: number) => Math.round(value * 100) / 100;
export function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function resolveChannel({
  事業名,
  リスト名,
}: {
  事業名: string;
  リスト名?: string | null;
}): Channel | null {
  if (事業名 === "アライアンス") return "alliance";
  if (事業名 !== "自社") return null;
  return リスト名?.startsWith("WEB_") ? "lp" : "hakuchi";
}
export function pointFor(
  rows: readonly PointRow[],
  order: Order,
): PointRow | null {
  if (!order.channel || !validDate(order.orderDate)) return null;
  const name = normalizeProduct(order.productName);
  return (
    rows.find(
      (row) =>
        row.channel === order.channel &&
        [row.product, ...row.kintone_names].some(
          (alias) => normalizeProduct(alias) === name,
        ) &&
        row.start_date <= order.orderDate &&
        (!row.end_date || order.orderDate <= row.end_date),
    ) ?? null
  );
}
export function overlapping(rows: readonly PointRow[], row: PointRow) {
  return rows.find(
    (other) =>
      other.id !== row.id &&
      normalizeProduct(other.product) === normalizeProduct(row.product) &&
      other.channel === row.channel &&
      other.start_date <= (row.end_date ?? "9999-12-31") &&
      row.start_date <= (other.end_date ?? "9999-12-31"),
  );
}
export function validateRow(row: PointRow): string | null {
  if (
    typeof row.product !== "string" ||
    typeof row.channel !== "string" ||
    typeof row.category !== "string" ||
    typeof row.report_group !== "string" ||
    typeof row.start_date !== "string" ||
    (row.end_date !== null && typeof row.end_date !== "string") ||
    (row.note !== null && typeof row.note !== "string")
  )
    return "入力内容を確認してください。";
  if (
    !row.product.trim() ||
    !(row.channel in CHANNELS) ||
    !(row.category in CATEGORIES) ||
    !(row.report_group in REPORT_GROUPS)
  )
    return "商材・獲得方法・区分・配信の内訳を確認してください。";
  if (
    !validDate(row.start_date) ||
    (row.end_date !== null &&
      (!validDate(row.end_date) || row.end_date < row.start_date))
  )
    return "開始日と終了日を確認してください。";
  if (
    ![row.total_points, row.toss_points].every(
      (value) =>
        Number.isFinite(value) &&
        value >= 0 &&
        value <= 9999.99 &&
        Math.abs(roundPoints(value) - value) < 1e-8,
    ) ||
    row.toss_points > row.total_points
  )
    return "トス付与ポイントは合計以下にし、小数第2位までで入力してください。";
  if (
    row.unit_price !== null &&
    (!Number.isSafeInteger(row.unit_price) ||
      row.unit_price < 0 ||
      row.unit_price > 2147483647)
  )
    return "金額は0以上の整数で入力してください。";
  if (![null, "", "あり", "なし"].includes(row.has_option))
    return "オプション有無を確認してください。";
  if (
    !Number.isInteger(row.sort_order) ||
    !Array.isArray(row.kintone_names) ||
    row.kintone_names.some((name) => typeof name !== "string")
  )
    return "入力内容を確認してください。";
  return null;
}
export function splitPeriod(
  rows: readonly PointRow[],
  source: PointRow,
  next: PointRow,
) {
  if (
    !validDate(next.start_date) ||
    next.start_date <= source.start_date ||
    (source.end_date && next.start_date > source.end_date)
  )
    throw new Error(
      "新しい開始日は今の期間内で、開始日の翌日以降にしてください。",
    );
  const previous = new Date(next.start_date + "T00:00:00Z");
  previous.setUTCDate(previous.getUTCDate() - 1);
  const closed = { ...source, end_date: previous.toISOString().slice(0, 10) };
  const created = {
    ...next,
    product: source.product,
    channel: source.channel,
    end_date: source.end_date,
  };
  const result = rows.filter((row) => row.id !== source.id).concat(closed);
  const error = validateRow(created);
  if (error) throw new Error(error);
  const conflict = overlapping(result, created);
  if (conflict)
    throw new Error(
      `同じ商材・獲得方法で期間が重なっています（${conflict.start_date}〜${conflict.end_date ?? ""}）`,
    );
  return result.concat(created);
}
export function sumPoints(orders: readonly Order[], rows: readonly PointRow[]) {
  const empty = () => ({ total: 0, toss: 0, closer: 0, count: 0 });
  const total = empty();
  const byChannel = Object.fromEntries(
    Object.keys(CHANNELS).map((key) => [key, empty()]),
  ) as Record<Channel, ReturnType<typeof empty>>;
  const byReportGroup = Object.fromEntries(
    Object.keys(REPORT_GROUPS).map((key) => [key, empty()]),
  ) as Record<keyof typeof REPORT_GROUPS, ReturnType<typeof empty>>;
  const missing = new Map<string, number>();
  for (const order of orders) {
    const row = pointFor(rows, order);
    if (!row) {
      missing.set(order.productName, (missing.get(order.productName) ?? 0) + 1);
      continue;
    }
    for (const bucket of [
      total,
      byChannel[row.channel],
      byReportGroup[row.report_group],
    ]) {
      bucket.total = roundPoints(bucket.total + row.total_points);
      bucket.toss = roundPoints(bucket.toss + row.toss_points);
      bucket.closer = roundPoints(
        bucket.closer + roundPoints(row.total_points - row.toss_points),
      );
      bucket.count++;
    }
  }
  return {
    total,
    byChannel,
    byReportGroup,
    missingProducts: [...missing].map(([productName, count]) => ({
      productName,
      count,
    })),
  };
}
