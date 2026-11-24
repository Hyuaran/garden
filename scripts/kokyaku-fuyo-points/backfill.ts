import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validDate, type PointRow } from "../../src/lib/product-points/index";
import { resolveKintonePoints } from "../../src/lib/product-points/kintone-points";
import { loadPoints } from "../../src/lib/product-points/load-points";
import { getSupabaseAdmin } from "../../src/lib/supabase/admin";

const endpoint = "https://9j11u0q829lg.cybozu.com/k/v1/records.json";
const app = 10;
const fields = [
  "$id", "$revision", "商材名区分2", "m_product", "事業名", "B_リスト名",
  "実績日", "受注日", "付与件数", "トス付与件数_Garden",
];
type RecordFields = Record<string, { value: string | null }>;
type Update = { id: string; revision: string; record: Record<string, { value: string }> };

export function parseArgs(args: string[]) {
  const fromIndex = args.indexOf("--from");
  const from = args[fromIndex + 1];
  const apply = args.includes("--apply");
  if (fromIndex < 0 || !from || !validDate(from) || args.length !== (apply ? 3 : 2) ||
      args.some((arg, index) => index !== fromIndex && index !== fromIndex + 1 && arg !== "--apply")) {
    throw new Error("使い方: --from YYYY-MM-DD [--apply]");
  }
  return { from, apply };
}

export function planRecord(record: RecordFields, rows: readonly PointRow[]) {
  if (fields.some((field) => !Object.hasOwn(record, field))) {
    throw new Error("アプリ 10 から必要な項目を読み取れませんでした。");
  }
  const value = (field: string) => String(record[field].value ?? "").trim();
  const id = value("$id");
  const revision = value("$revision");
  if (!/^[1-9]\d*$/.test(id) || !/^[1-9]\d*$/.test(revision)) {
    throw new Error("レコード番号またはリビジョンが不正です。");
  }
  const product = value("商材名区分2");
  const master = value("m_product");
  const date = value("実績日") || value("受注日");
  const previous = value("付与件数");
  const previousToss = value("トス付与件数_Garden");
  const { points, toss } = resolveKintonePoints(rows, {
    product, master, date, business: value("事業名"), list: value("B_リスト名"),
  });
  const tossValue = toss ?? 0;
  const pointsChanged = points !== null && (previous === "" || Number(previous) !== points);
  const tossChanged = points !== null && (previousToss === "" || Number(previousToss) !== tossValue);
  const changed = pointsChanged || tossChanged;
  const update: Update | null = changed
    ? { id, revision, record: {
      ...(pointsChanged ? { 付与件数: { value: String(points) } } : {}),
      ...(tossChanged ? { トス付与件数_Garden: { value: String(tossValue) } } : {}),
    } }
    : null;
  return {
    csv: [id, date, product, master, previous, points === null ? "" : String(points),
      previousToss, points === null ? "" : String(tossValue),
      points === null ? "表に該当なし" : changed ? "変更" : "変更なし"],
    missing: points === null,
    update,
  };
}

function csvCell(value: string) {
  const safeValue = /^[\s]*[=+\-@＝＋－＠]/u.test(value) || /^[\t\r\n]/u.test(value)
    ? "'" + value : value;
  return '"' + safeValue.replace(/"/g, '""') + '"';
}

async function kintoneRequest<T>(
  url: string | URL,
  init: RequestInit,
  deadline: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      redirect: "error",
      signal: AbortSignal.any([deadline, AbortSignal.timeout(15_000)]),
    });
  } catch {
    throw new Error(`Kintone の ${init.method} で通信が失敗しました。`);
  }
  if (!response.ok) {
    throw new Error(`Kintone の ${init.method} に失敗しました（HTTP ${response.status}）。`);
  }
  try {
    return await response.json() as T;
  } catch {
    throw new Error(`Kintone の ${init.method} の応答を読み取れませんでした。`);
  }
}

async function readRecords(
  token: string,
  query: string,
  requestedFields: string[],
  deadline: AbortSignal,
) {
  const url = new URL(endpoint);
  url.searchParams.set("app", String(app));
  url.searchParams.set("query", query);
  requestedFields.forEach((field, index) => url.searchParams.set(`fields[${index}]`, field));
  const { records } = await kintoneRequest<{ records: RecordFields[] }>(url, {
    method: "GET", headers: { "X-Cybozu-API-Token": token },
  }, deadline);
  if (!Array.isArray(records)) throw new Error("Kintone からレコードを読み取れませんでした。");
  return records;
}

async function main() {
  const { from, apply } = parseArgs(process.argv.slice(2));
  const token = process.env.KINTONE_KANRI_CUSTOMER_TOKEN;
  const robotAuth = process.env.KINTONE_ROBOT_AUTH;
  if (!token) throw new Error(".env.local の KINTONE_KANRI_CUSTOMER_TOKEN が必要です。");
  if (apply && !robotAuth) throw new Error("--apply には KINTONE_ROBOT_AUTH が必要です。");

  const deadline = AbortSignal.timeout(15 * 60_000);
  const rows = await loadPoints(
    getSupabaseAdmin(),
    AbortSignal.any([deadline, AbortSignal.timeout(15_000)]),
  );
  const csv = ["レコード番号,判定日,商材名区分2,m_product,現在の付与件数,表の付与件数,現在のトス付与件数,表のトス付与件数,判定"];
  const updates: Update[] = [];
  let missing = 0;
  let lastId = "0";
  const dateFilter = `実績日 >= "${from}"`;
  const [lastRecord] = await readRecords(token, `${dateFilter} order by $id desc limit 1`, ["$id"], deadline);
  const upperId = lastRecord ? String(lastRecord.$id?.value ?? "") : "0";
  if (!/^(0|[1-9]\d*)$/.test(upperId)) throw new Error("取得範囲のレコード番号が不正です。");
  while (BigInt(lastId) < BigInt(upperId)) {
    const records = await readRecords(
      token,
      `${dateFilter} and $id > ${lastId} and $id <= ${upperId} order by $id asc limit 500`,
      fields,
      deadline,
    );
    for (const record of records) {
      const plan = planRecord(record, rows);
      if (BigInt(plan.csv[0]) <= BigInt(lastId) || BigInt(plan.csv[0]) > BigInt(upperId)) {
        throw new Error("Kintone のレコード順が不正です。");
      }
      lastId = plan.csv[0];
      csv.push(plan.csv.map(csvCell).join(","));
      if (plan.update) updates.push(plan.update);
      if (plan.missing) missing++;
    }
    if (records.length < 500) break;
  }

  const directory = new URL("./logs/", import.meta.url);
  await mkdir(directory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const log = new URL(`backfill-${timestamp}.csv`, directory);
  await writeFile(log, "\ufeff" + csv.join("\n") + "\n", { encoding: "utf8", flag: "wx" });
  console.log(`CSV: ${fileURLToPath(log)}`);
  console.log(`対象 ${csv.length - 1} 件、変更 ${updates.length} 件、表に該当なし ${missing} 件`);
  if (!apply) return;

  for (let offset = 0; offset < updates.length; offset += 100) {
    const records = updates.slice(offset, offset + 100);
    try {
      const result = await kintoneRequest<{ records: unknown[] }>(endpoint, {
        method: "PUT",
        headers: { "X-Cybozu-Authorization": robotAuth!, "Content-Type": "application/json" },
        body: JSON.stringify({ app, records }),
      }, deadline);
      if (!Array.isArray(result.records) || result.records.length !== records.length) {
        throw new Error("Kintone の更新結果を確認できませんでした。");
      }
    } catch (error) {
      throw new Error(`確認済みの更新は ${offset} 件です。次のバッチで停止しました（${(error as Error).message}）。`);
    }
    console.log(`更新済み ${offset + records.length} / ${updates.length} 件`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    // リクエストや認証ヘッダーを含む可能性がある外部エラーは展開しない。
    console.error(error instanceof Error ? error.message : "処理に失敗しました。");
    process.exitCode = 1;
  });
}
