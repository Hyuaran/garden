import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { normalizeKanriNo } from "../../src/lib/leaf-kanden/kanri-no";

async function readLabels(file: string) {
  const rows: unknown = JSON.parse((await readFile(file, "utf8")).replace(/^\uFEFF/, ""));
  if (!Array.isArray(rows)) throw new Error("TimeTree の一覧は JSON 配列で指定してください。");
  const labels = new Map<string, string>();
  for (const [index, row] of rows.entries()) {
    const number = typeof row?.no === "string" ? normalizeKanriNo(row.no) : null;
    const label = typeof row?.label === "string" ? row.label.trim() : "";
    if (!number || !label) throw new Error(`TimeTree 一覧の ${index + 1} 件目を確認してください。`);
    if (labels.has(number) && labels.get(number) !== label) throw new Error("同じ管理番号に異なるラベルがあります。");
    labels.set(number, label);
  }
  return Object.fromEntries(labels);
}

async function main() {
  const { values } = parseArgs({
    options: { file: { type: "string" }, "apply-legacy-cancel": { type: "boolean" }, "dry-run": { type: "boolean" } },
  });
  if (!values.file && !values["apply-legacy-cancel"]) {
    throw new Error("--file に TimeTree の JSON を指定するか、--apply-legacy-cancel を指定してください。");
  }
  const labels = values.file ? await readLabels(values.file) : {};
  loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase の接続設定がありません。");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.rpc("leaf_kanden_apply_timetree", {
    p_labels: labels, p_legacy: !!values["apply-legacy-cancel"], p_dry_run: !!values["dry-run"],
  });
  if (error?.message === "No payment statements") throw new Error("入金明細の取り込み後に実行してください。");
  if (error || !data) throw new Error("TimeTree ラベル・旧受注の処理に失敗しました。");
  console.log(`${values["dry-run"] ? "確認" : "処理"}完了：TimeTree ラベル更新 ${data.labels} 件。`);
  if (values["apply-legacy-cancel"]) {
    console.log(`対象の受注日：${data.cutoff} 以前。キャンセル ${data.cancelled} 件、要確認 ${data.review} 件、対象外 ${data.untouched} 件。`);
  }
}

main().catch(error => {
  console.error(error instanceof SyntaxError ? "TimeTree 一覧の JSON を確認してください。"
    : error instanceof Error && !("code" in error) ? error.message : "処理に失敗しました。");
  process.exitCode = 1;
});
