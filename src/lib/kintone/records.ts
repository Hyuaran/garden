import "server-only";

export type KintoneRecord = Record<string, { value: unknown } | unknown>;

const PAGE_SIZE = 500;

function kintoneBaseUrl() {
  const subdomain = process.env.KINTONE_SUBDOMAIN;
  if (!subdomain) throw new Error("kintone_config_missing");
  return `https://${subdomain}.cybozu.com/k/v1/records.json`;
}

function asKintoneError(response: Response) {
  return new Error(`kintone_${response.status}`);
}

function appendFields(params: URLSearchParams, fields: readonly string[]) {
  fields.forEach((field, index) => params.set(`fields[${index}]`, field));
}

export async function getRecords<T extends KintoneRecord = KintoneRecord>(
  app: string | number,
  token: string,
  query: string,
  fields: readonly string[],
): Promise<T[]> {
  if (!token) throw new Error("kintone_token_missing");
  const params = new URLSearchParams();
  params.set("app", String(app));
  params.set("query", query);
  appendFields(params, fields);

  const response = await fetch(`${kintoneBaseUrl()}?${params.toString()}`, {
    // GET に Content-Type を付けると Kintone が 400（CB_IL02 Invalid request）を返す。付けない。
    headers: { "X-Cybozu-API-Token": token },
    cache: "no-store",
  });
  if (!response.ok) throw asKintoneError(response);
  const body = await response.json() as { records?: T[] };
  return Array.isArray(body.records) ? body.records : [];
}

export async function getAllRecords<T extends KintoneRecord = KintoneRecord>(
  app: string | number,
  token: string,
  condition: string,
  fields: readonly string[],
): Promise<T[]> {
  const records: T[] = [];
  const pageFields = fields.includes("$id") ? fields : [...fields, "$id"];
  let lastId: string | null = null;

  while (true) {
    const baseCondition: string = condition.trim() ? `(${condition.trim()})` : "";
    const idCondition: string = lastId ? `$id > ${lastId}` : "";
    const where: string = [baseCondition, idCondition].filter(Boolean).join(" and ");
    const query: string = `${where ? `${where} ` : ""}order by $id asc limit ${PAGE_SIZE}`;
    const page: T[] = await getRecords<T>(app, token, query, pageFields);
    records.push(...page);
    if (page.length < PAGE_SIZE) break;

    const rawId: unknown = (page.at(-1)?.$id as { value?: unknown } | undefined)?.value;
    const nextId: string = typeof rawId === "string" || typeof rawId === "number" ? String(rawId) : "";
    if (!/^\d+$/.test(nextId) || (lastId && BigInt(nextId) <= BigInt(lastId))) {
      throw new Error("kintone_pagination_stalled");
    }
    lastId = nextId;
  }

  return records;
}
