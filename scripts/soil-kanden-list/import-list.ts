import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { readListCsv, type ListRow } from "./import-list.core";

const batchSize = 5_000;

async function main() {
  const { values } = parseArgs({ options: { file: { type: "string" }, "dry-run": { type: "boolean" } } });
  if (!values.file) throw new Error("--file に取り込む CSV を指定してください。");

  const startedAt = new Date().toISOString();
  const csv = await readFile(values.file)
    .catch(() => { throw new Error("CSV を開けませんでした。"); })
    .then(content => new TextDecoder("utf-8", { fatal: true }).decode(content));
  const seen = new Set<string>();
  for (const row of readListCsv(csv)) {
    if (seen.has(row.fm_rowid)) throw new Error(`CSV の ${seen.size + 2} レコード目で ROWID が重複しています。`);
    seen.add(row.fm_rowid);
  }
  const total = seen.size;
  seen.clear();
  if (values["dry-run"]) {
    console.log(`確認完了：${total} 件`);
    return;
  }

  loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase の接続設定がありません。");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const batch: ListRow[] = [];
  let scanned = 0;
  let changed = 0;

  async function flush() {
    const { data, error } = await db.rpc("soil_kanden_list_import", { p_rows: batch });
    if (error || typeof data !== "number") {
      throw new Error(`${scanned + 1} 件目からの保存に失敗しました。更新済み：${changed} 件。`);
    }
    scanned += batch.length;
    changed += data;
    batch.length = 0;
  }

  for (const row of readListCsv(csv)) {
    batch.push(row);
    if (batch.length === batchSize) await flush();
  }
  if (batch.length) await flush();

  const { error } = await db.from("leaf_kanden_import_runs").insert({
    source: "filemaker-kanden-list", rows: changed, started_at: startedAt, finished_at: new Date().toISOString(),
  });
  if (error) throw new Error(`取り込み履歴を保存できませんでした。更新済み：${changed} 件。`);
  console.log(`取り込み完了：確認 ${total} 件、更新 ${changed} 件、変更なし・旧データ ${total - changed} 件`);
}

main().catch(error => {
  // ファイル名、明細、接続エラーの本文をログに含めない。
  console.error(error instanceof Error && /^(?:--file に|CSV の|CSV を|Supabase の接続設定|\d+ 件目からの保存|取り込み履歴を保存)/.test(error.message)
    ? error.message : "取り込みに失敗しました。");
  process.exitCode = 1;
});
