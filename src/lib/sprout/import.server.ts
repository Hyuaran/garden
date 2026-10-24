import "server-only";
import { withPgClient } from "@/lib/db/pg";
import { requireSproutUser } from "./access.server";
import { applicant, hearing, type KRecord, type Relation } from "./model";

function config(kind: "APPLICANTS" | "HEARING") {
  const subdomain = process.env.KINTONE_SUBDOMAIN;
  const token = process.env[`KINTONE_RECRUIT_${kind}_TOKEN`];
  const app = process.env[`KINTONE_RECRUIT_${kind}_APP_ID`] || (kind === "APPLICANTS" ? "44" : "45");
  if (!subdomain || !/^[a-zA-Z0-9-]+$/.test(subdomain) || !token || !/^\d+$/.test(app)) throw new Error("取り込みの接続設定を確認してください");
  return { base: `https://${subdomain}.cybozu.com/k/v1`, token, app };
}
async function read(kind: "APPLICANTS" | "HEARING", path: string, params: Record<string,string>) {
  const c = config(kind);
  const response = await fetch(`${c.base}/${path}?${new URLSearchParams({ app: c.app, ...params })}`, {
    headers: { "X-Cybozu-API-Token": c.token }, cache: "no-store", signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error("採用情報を取得できませんでした。時間をおいてお試しください");
  return response.json();
}
// Keyset pagination has no offset limit and uses only read requests.
export async function fetchRecords(kind: "APPLICANTS" | "HEARING"): Promise<KRecord[]> {
  const all: KRecord[] = [];
  let last = "0";
  for (;;) {
    const { records } = await read(kind, "records.json", { query: `$id > ${last} order by $id asc limit 500` }) as { records: KRecord[] };
    if (!Array.isArray(records)) throw new Error("採用情報を確認できませんでした");
    all.push(...records);
    if (records.length < 500) return all;
    const next = String(records.at(-1)?.$id?.value);
    if (!/^\d+$/.test(next) || BigInt(next) <= BigInt(last)) throw new Error("採用情報を確認できませんでした");
    last = next;
  }
}
async function relation(): Promise<Relation | undefined> {
  try {
    const result = await read("APPLICANTS", "app/form/fields.json", {});
    const field = result.properties?.["関連レコード一覧"]?.referenceTable;
    if (String(field?.relatedApp?.app) === config("HEARING").app && field?.condition?.field && field?.condition?.relatedField)
      return { field: field.condition.field, relatedField: field.condition.relatedField };
  } catch { /* Read-only tokens may not permit form metadata; use name + phone. */ }
}
let importing = false;
export async function importRecruit() {
  const user = await requireSproutUser();
  if (importing) throw new Error("取り込み中です。しばらくお待ちください");
  importing = true;
  try { return await withPgClient(async client => {
    // Transaction-scoped lock works across processes and releases even on interruption.
    await client.query("begin");
    let runId: string | undefined;
    try {
      const lock = await client.query("select pg_try_advisory_xact_lock(42020261024) as acquired");
      if (!lock.rows[0].acquired) throw new Error("取り込み中です。しばらくお待ちください");
      runId = (await client.query("insert into sprout_import_runs(status,created_by) values('running',$1) returning id", [user.id])).rows[0].id;
      const local = (await client.query<{kintone_record_id:string;mirror_record_id:string;raw:Record<string,unknown>}>("select kintone_record_id,mirror_record_id,raw from sprout_applicants where source='baitoru' and mirror_record_id is not null")).rows;
      const applicants = (await fetchRecords("APPLICANTS")).map(applicant).map(a => {
        const saved=local.find(r=>r.mirror_record_id===a.kintone_record_id);
        return saved ? {...a,kintone_record_id:saved.kintone_record_id,raw:{...saved.raw,...a.raw}} : a;
      });
      const match = await relation();
      const hearings = (await fetchRecords("HEARING")).map(r => hearing(r, applicants, match));
      for (const [table, rows] of [["sprout_applicants", applicants], ["sprout_hearing_sheets", hearings]] as const) {
        if (rows.some(r => !r.kintone_record_id)) throw new Error("採用情報を確認できませんでした");
        if (rows.length) {
          const columns = Object.keys(rows[0]);
          await client.query(`insert into ${table} (${columns.join(",")},imported_at)
            select ${columns.join(",")},now() from jsonb_populate_recordset(null::${table},$1::jsonb)
            on conflict(kintone_record_id) do update set ${columns.filter(c => c !== "kintone_record_id").map(c => `${c}=excluded.${c}`).join(",")},imported_at=now()`, [JSON.stringify(rows)]);
        }
      }
      await client.query("delete from sprout_hearing_sheets where not(kintone_record_id=any($1::text[]))", [hearings.map(r => r.kintone_record_id)]);
      await client.query("delete from sprout_applicants where source='kintone' and not(kintone_record_id=any($1::text[]))", [applicants.map(r => r.kintone_record_id)]);
      await client.query("update sprout_import_runs set status='success',finished_at=now(),applicant_count=$2,hearing_count=$3 where id=$1", [runId, applicants.length, hearings.length]);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      if (runId) await client.query("insert into sprout_import_runs(status,created_by,finished_at) values('failed',$1,now())", [user.id]);
      throw error;
    }
  }); } finally { importing = false; }
}
