import { SOIL_LIST_TABLES } from "@/app/system/list/_lib/list-fields";
import { getAllRecords, type KintoneRecord } from "@/lib/kintone/records";

export const ORDER_FIELDS = [
  "レコード番号",
  "電話番号_ハイフンなし",
  "携帯番号_ハイフンなし",
  "営業ID",
  "チーム名",
  "商材名区分1",
  "商材名区分2",
  "商流名",
  "受注日",
  "実績日",
  "開通日",
  "キャンセル日",
] as const;

export type DbError = { message: string } | null;

export type OrderRow = {
  電話番号: string;
  顧客一覧レコード番号: string;
  営業ID: string | null;
  チーム名: string | null;
  商材名区分1: string | null;
  商材名区分2: string | null;
  商流名: string | null;
  受注日: string | null;
  実績日: string | null;
  開通日: string | null;
  キャンセル日: string | null;
  取込日時: string;
};

export type OrderSyncStateRow = {
  id: number;
  last_run_at: string | null;
  last_records: number | null;
  last_order_rows: number | null;
  last_phone_updates: number | null;
  last_deleted_rows: number | null;
  last_elapsed_ms: number | null;
  last_error: string | null;
};

type DeleteMissingResult = {
  deleted_rows: number | null;
  phones: string[] | null;
};

type RefreshLatestResult = {
  updated: number | null;
};

export type OrderSyncDb = {
  from(table: string): {
    upsert(values: Record<string, unknown>[], options?: { onConflict?: string }): Promise<{ error: DbError }>;
    update(values: Record<string, unknown>): { eq(column: string, value: unknown): Promise<{ error: DbError }> };
    select(columns: string): {
      eq(column: string, value: unknown): {
        maybeSingle<T>(): Promise<{ data: T | null; error: DbError }>;
      };
    };
  };
  rpc(name: string, args?: Record<string, unknown>): Promise<{
    data: DeleteMissingResult[] | DeleteMissingResult | RefreshLatestResult[] | RefreshLatestResult | null;
    error: DbError;
  }>;
};

type SyncOrdersInput = {
  db: OrderSyncDb;
  now?: Date;
  appId?: string;
  token?: string;
};

export type OrderSyncResult = {
  ok: true;
  records: number;
  orderRows: number;
  phoneUpdates: number;
  deletedRows: number;
  elapsedMs: number;
};

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name}_missing`);
  return value;
}

function fieldValue(record: KintoneRecord, field: string): string {
  const raw = record[field];
  const value = raw && typeof raw === "object" && "value" in raw ? raw.value : raw;
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

function nullableText(value: string): string | null {
  return value === "" ? null : value;
}

function nullableDate(value: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export function orderRowsFromRecord(record: KintoneRecord, importedAt: string): OrderRow[] {
  const recordId = fieldValue(record, "レコード番号") || fieldValue(record, "$id");
  if (!recordId) return [];

  const phones = [
    normalizePhone(fieldValue(record, "電話番号_ハイフンなし")),
    normalizePhone(fieldValue(record, "携帯番号_ハイフンなし")),
    // 「0000000000」のような仮の番号は受注履歴に入れない（顧客一覧の番号なし案件に入っている）
  ].filter((phone) => phone && !/^0+$/.test(phone));
  const uniquePhones = [...new Set(phones)];

  return uniquePhones.map((phone) => ({
    電話番号: phone,
    顧客一覧レコード番号: recordId,
    営業ID: nullableText(fieldValue(record, "営業ID")),
    チーム名: nullableText(fieldValue(record, "チーム名")),
    商材名区分1: nullableText(fieldValue(record, "商材名区分1")),
    商材名区分2: nullableText(fieldValue(record, "商材名区分2")),
    商流名: nullableText(fieldValue(record, "商流名")),
    受注日: nullableDate(fieldValue(record, "受注日")),
    実績日: nullableDate(fieldValue(record, "実績日")),
    開通日: nullableDate(fieldValue(record, "開通日")),
    キャンセル日: nullableDate(fieldValue(record, "キャンセル日")),
    取込日時: importedAt,
  }));
}

function normalizeDeleted(data: OrderSyncDb extends never ? never : unknown): DeleteMissingResult {
  const row = Array.isArray(data) ? data[0] : data;
  const value = row as DeleteMissingResult | null;
  return { deleted_rows: value?.deleted_rows ?? 0, phones: value?.phones ?? [] };
}

function normalizeRefresh(data: OrderSyncDb extends never ? never : unknown): RefreshLatestResult {
  const row = Array.isArray(data) ? data[0] : data;
  const value = row as RefreshLatestResult | null;
  return { updated: value?.updated ?? 0 };
}

export function chunk<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size));
  return chunks;
}

export async function loadOrderSyncState(db: OrderSyncDb) {
  const { data, error } = await db
    .from(SOIL_LIST_TABLES.orderSyncState)
    .select("id,last_run_at,last_records,last_order_rows,last_phone_updates,last_deleted_rows,last_elapsed_ms,last_error")
    .eq("id", 1)
    .maybeSingle<OrderSyncStateRow>();
  if (error) throw new Error(error.message);
  return {
    lastRunAt: data?.last_run_at ?? null,
    records: data?.last_records ?? 0,
    orderRows: data?.last_order_rows ?? 0,
    phoneUpdates: data?.last_phone_updates ?? 0,
    deletedRows: data?.last_deleted_rows ?? 0,
    elapsedMs: data?.last_elapsed_ms ?? 0,
    error: data?.last_error ?? null,
  };
}

export async function saveOrderSyncState(db: OrderSyncDb, values: Record<string, unknown>) {
  const { error } = await db.from(SOIL_LIST_TABLES.orderSyncState).update({ ...values, updated_at: new Date().toISOString() }).eq("id", 1);
  if (error) throw new Error(error.message);
}

export async function syncOrders({ db, now = new Date(), appId, token }: SyncOrdersInput): Promise<OrderSyncResult> {
  const started = Date.now();
  const importedAt = now.toISOString();
  const records = await getAllRecords(
    appId ?? required(process.env.KINTONE_KANRI_CUSTOMER_APP_ID, "KINTONE_KANRI_CUSTOMER_APP_ID"),
    token ?? required(process.env.KINTONE_KANRI_CUSTOMER_TOKEN, "KINTONE_KANRI_CUSTOMER_TOKEN"),
    "",
    ORDER_FIELDS,
  );
  const rows = records.flatMap((record) => orderRowsFromRecord(record, importedAt));
  const recordIds = records.map((record) => fieldValue(record, "レコード番号") || fieldValue(record, "$id")).filter(Boolean);

  for (const rowsChunk of chunk(rows, 1000)) {
    const { error } = await db.from(SOIL_LIST_TABLES.order).upsert(rowsChunk, { onConflict: "顧客一覧レコード番号,電話番号" });
    if (error) throw new Error(error.message);
  }

  const deleted = await db.rpc("soil_list_delete_missing_orders", { p_record_ids: recordIds });
  if (deleted.error) throw new Error(deleted.error.message);
  const deletedResult = normalizeDeleted(deleted.data);
  const phones = [...new Set([...rows.map((row) => row.電話番号), ...(deletedResult.phones ?? [])])];

  let phoneUpdates = 0;
  for (const phoneChunk of chunk(phones, 1000)) {
    const refreshed = await db.rpc("soil_list_refresh_phone_latest", { p_phones: phoneChunk });
    if (refreshed.error) throw new Error(refreshed.error.message);
    phoneUpdates += normalizeRefresh(refreshed.data).updated ?? 0;
  }

  const elapsedMs = Date.now() - started;
  await saveOrderSyncState(db, {
    last_run_at: importedAt,
    last_records: records.length,
    last_order_rows: rows.length,
    last_phone_updates: phoneUpdates,
    last_deleted_rows: deletedResult.deleted_rows ?? 0,
    last_elapsed_ms: elapsedMs,
    last_error: null,
  });

  return {
    ok: true,
    records: records.length,
    orderRows: rows.length,
    phoneUpdates,
    deletedRows: deletedResult.deleted_rows ?? 0,
    elapsedMs,
  };
}
