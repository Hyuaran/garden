import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { convertOrder, parseOrderCsv } from "./import-fm-csv.core";

async function main() {
  const { values } = parseArgs({
    options: { csv: { type: "string" }, "dry-run": { type: "boolean" } },
  });
  if (!values.csv) throw new Error("--csv に取り込むファイルを指定してください。");

  const startedAt = new Date().toISOString();
  const rows = parseOrderCsv(await readFile(values.csv, "utf8")).map((row, index) => {
    try {
      return { ...convertOrder(row), imported_at: startedAt };
    } catch {
      throw new Error(`CSV の ${index + 2} レコード目の主キーが不正です。`);
    }
  });
  if (values["dry-run"]) {
    console.log(`確認完了：${rows.length} 件`);
    return;
  }

  loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase の接続設定がありません。");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  for (let offset = 0; offset < rows.length; offset += 1000) {
    const { error } = await db.from("leaf_kanden_orders")
      .upsert(rows.slice(offset, offset + 1000), { onConflict: "fm_pk" });
    if (error) throw new Error(`${offset + 1} 件目からの保存に失敗しました（${error.code}）。`);
  }

  const { error } = await db.from("leaf_kanden_import_runs").insert({
    source: "filemaker", rows: rows.length, started_at: startedAt, finished_at: new Date().toISOString(),
  });
  if (error) throw new Error(`取り込みの記録を保存できませんでした（${error.code}）。`);
  console.log(`取り込み完了：${rows.length} 件`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : "取り込みに失敗しました。");
  process.exitCode = 1;
});
