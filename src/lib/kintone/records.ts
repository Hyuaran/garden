export type KintoneRecord = Record<string, { value: unknown } | unknown>;

const PAGE_SIZE = 500;

function kintoneApiUrl(path: string) {
  const subdomain = process.env.KINTONE_SUBDOMAIN;
  if (!subdomain) throw new Error("kintone_config_missing");
  return `https://${subdomain}.cybozu.com/k/v1/${path}`;
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
  fields?: readonly string[] | null,
): Promise<T[]> {
  if (!token) throw new Error("kintone_token_missing");
  const params = new URLSearchParams();
  params.set("app", String(app));
  params.set("query", query);
  if (fields?.length) appendFields(params, fields);

  const response = await fetch(`${kintoneApiUrl("records.json")}?${params.toString()}`, {
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
  fields?: readonly string[] | null,
): Promise<T[]> {
  const records: T[] = [];
  const pageFields = fields?.length ? (fields.includes("$id") ? fields : [...fields, "$id"]) : null;
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

export async function createRecord(
  app: string | number,
  token: string,
  record: KintoneRecord,
): Promise<{ id: string; revision?: string }> {
  if (!token) throw new Error("kintone_token_missing");
  const response = await fetch(kintoneApiUrl("record.json"), {
    method: "POST",
    headers: {
      "X-Cybozu-API-Token": token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ app: String(app), record }),
    cache: "no-store",
  });
  if (!response.ok) throw asKintoneError(response);
  const body = await response.json() as { id?: unknown; revision?: unknown };
  return {
    id: String(body.id ?? ""),
    revision: body.revision == null ? undefined : String(body.revision),
  };
}

export type KintoneFormField = {
  code: string;
  label: string;
  type: string;
};

export async function getFormFields(
  app: string | number,
  token: string,
): Promise<KintoneFormField[]> {
  if (!token) throw new Error("kintone_token_missing");
  const params = new URLSearchParams();
  params.set("app", String(app));
  const response = await fetch(`${kintoneApiUrl("app/form/fields.json")}?${params.toString()}`, {
    headers: { "X-Cybozu-API-Token": token },
    cache: "no-store",
  });
  if (!response.ok) throw asKintoneError(response);
  const body = await response.json() as { properties?: Record<string, { code?: string; label?: string; type?: string }> };
  return Object.entries(body.properties ?? {}).map(([fallbackCode, field]) => ({
    code: String(field.code ?? fallbackCode),
    label: String(field.label ?? field.code ?? fallbackCode),
    type: String(field.type ?? ""),
  }));
}
