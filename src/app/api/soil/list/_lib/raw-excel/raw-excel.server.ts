import { SOIL_LIST_TABLES } from "@/app/system/list/_lib/list-fields";

import type { ExistingHit } from "./check";
import type { PostalHit } from "./normalize";

type QueryResult<T> = Promise<{ data: T[] | null; error: { message: string } | null }>;
type RawDb = {
  from(table: string): {
    select(columns: string): {
      in(column: string, values: string[]): QueryResult<Record<string, unknown>>;
      eq(column: string, value: string): { limit(count: number): QueryResult<Record<string, unknown>> };
    };
  };
};

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

export async function lookupPostal(db: RawDb, postal7: string): Promise<PostalHit> {
  const { data } = await db.from("system_postal_addresses").select("prefecture,city").eq("postal_code", postal7).limit(1);
  const row = data?.[0] as { prefecture?: string; city?: string } | undefined;
  return row?.prefecture ? { prefecture: row.prefecture, city: row.city ?? null } : null;
}

export async function findExistingPhones(db: RawDb, phones: string[]): Promise<ExistingHit[]> {
  const unique = [...new Set(phones.filter(Boolean))];
  const hits: ExistingHit[] = [];
  for (const phoneChunk of chunks(unique, 1000)) {
    const assignment = await db.from(SOIL_LIST_TABLES.assignment).select("電話番号,リスト名,リスト投入日").in("電話番号", phoneChunk);
    if (!assignment.error) {
      for (const row of assignment.data ?? []) {
        hits.push({ phone: String(row["電話番号"] ?? ""), source: "assignment", listName: String(row["リスト名"] ?? ""), occurredOn: String(row["リスト投入日"] ?? "") });
      }
    }
    const order = await db.from(SOIL_LIST_TABLES.order).select("電話番号,受注日").in("電話番号", phoneChunk);
    if (!order.error) {
      for (const row of order.data ?? []) {
        hits.push({ phone: String(row["電話番号"] ?? ""), source: "order", occurredOn: String(row["受注日"] ?? "") });
      }
    }
  }
  return hits;
}

