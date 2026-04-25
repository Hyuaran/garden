#!/usr/bin/env node
/**
 * Garden Root — Phase 1 migration 適用状況チェッカ（read-only）
 *
 * REST API 経由で garden-dev の状態を確認する。書き込み・変更は一切しない。
 *
 * 確認項目：
 *   1. root_employees.user_id カラムの存在
 *   2. root_employees.garden_role カラムの存在
 *   3. root_audit_log テーブルの存在 + RLS 有効化
 *   4. 権限ヘルパー関数（current_garden_role / root_can_access / root_can_write）
 *   5. 7マスタの RLS ポリシー状態（anon での SELECT 挙動）
 *
 * 実行: node scripts/check-phase1-migration.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env.local");

if (!existsSync(envPath)) {
  console.error("ERROR: .env.local が見つかりません");
  process.exit(1);
}

// Minimal dotenv parser — avoid adding deps
const env = {};
for (const line of readFileSync(envPath, "utf-8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error("ERROR: .env.local に Supabase URL / キーがありません");
  process.exit(1);
}

const result = {
  project_url: SUPABASE_URL,
  checks: {},
};

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
async function rest(path, { key = SERVICE_KEY, method = "GET", headers = {}, body } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return { status: res.status, body: parsed };
}

async function rpc(fnName, args = {}) {
  return rest(`/rpc/${fnName}`, { method: "POST", body: args });
}

// ------------------------------------------------------------
// 1. root_employees カラム確認
// ------------------------------------------------------------
async function checkEmployeeColumns() {
  // select=user_id,garden_role,birthday を試す。カラム欠けは status 400 + "column does not exist" 相当
  const r = await rest(`/root_employees?select=user_id,garden_role,birthday&limit=0`);
  if (r.status === 200) {
    result.checks.employee_columns = { status: "applied", detail: "user_id / garden_role / birthday すべて存在" };
    return;
  }
  const msg = JSON.stringify(r.body);
  const missing = [];
  if (/user_id/.test(msg) && /column/.test(msg)) missing.push("user_id");
  if (/garden_role/.test(msg) && /column/.test(msg)) missing.push("garden_role");
  if (/birthday/.test(msg) && /column/.test(msg)) missing.push("birthday");
  result.checks.employee_columns = {
    status: missing.length > 0 ? "missing" : "unknown",
    detail: msg,
    missing,
  };
}

// ------------------------------------------------------------
// 2. root_audit_log テーブル存在
// ------------------------------------------------------------
async function checkAuditLog() {
  const r = await rest(`/root_audit_log?select=audit_id&limit=1`, { key: SERVICE_KEY });
  if (r.status === 200) {
    result.checks.audit_log_table = {
      status: "applied",
      detail: `SELECT 成功（行数: ${Array.isArray(r.body) ? r.body.length : "?"}）`,
    };
  } else if (r.status === 404) {
    result.checks.audit_log_table = { status: "missing", detail: "テーブル不存在 (PostgREST 404)" };
  } else {
    result.checks.audit_log_table = { status: "unknown", detail: JSON.stringify(r.body) };
  }

  // RLS policies on audit_log: anon の INSERT（テスト用の dry run にはならないので実際には行を追加してしまう）
  //   → INSERT はスキップ。SELECT ポリシーだけ anon 非成立で確認する。
  const anonSelect = await rest(`/root_audit_log?select=audit_id&limit=1`, { key: ANON_KEY });
  result.checks.audit_log_select_policy = {
    anon_select_status: anonSelect.status,
    anon_select_body_sample: Array.isArray(anonSelect.body)
      ? `rows=${anonSelect.body.length}`
      : JSON.stringify(anonSelect.body).slice(0, 120),
  };
}

// ------------------------------------------------------------
// 3. 権限ヘルパー関数
// ------------------------------------------------------------
async function checkHelperFunctions() {
  const fns = ["current_garden_role", "root_can_access", "root_can_write", "root_is_super_admin", "tree_can_view_confirm"];
  const results = {};
  for (const fn of fns) {
    const r = await rpc(fn);
    // 関数が存在しない → 404
    // 関数が存在する（未認証呼出） → 200 で null or false
    if (r.status === 404) {
      results[fn] = "missing";
    } else if (r.status === 200) {
      results[fn] = `exists (returned ${JSON.stringify(r.body)})`;
    } else {
      results[fn] = `unknown status=${r.status} body=${JSON.stringify(r.body).slice(0, 100)}`;
    }
  }
  result.checks.helper_functions = results;
}

// ------------------------------------------------------------
// 4. 7マスタ RLS ポリシー状態（anon SELECT の挙動で推定）
// ------------------------------------------------------------
async function checkRlsPolicies() {
  const tables = ["root_companies", "root_bank_accounts", "root_vendors", "root_employees", "root_salary_systems", "root_insurance", "root_attendance"];
  const results = {};
  for (const t of tables) {
    const r = await rest(`/${t}?select=*&limit=1`, { key: ANON_KEY });
    // Phase 1 適用後の期待:
    //   anon では root_can_access() が false → SELECT は status 200 で空配列（行数0）
    //   (PostgREST は RLS で弾かれた場合、エラーではなく空配列を返す)
    //
    // Phase 1 未適用で _dev ポリシーが残っている場合:
    //   anon でも行が返る可能性あり（全許可ポリシー）
    //
    // 注意: データが0件のテーブルでは区別不可 → service で件数を確認して比較
    const svc = await rest(`/${t}?select=*&limit=1`, { key: SERVICE_KEY });
    const anonRows = Array.isArray(r.body) ? r.body.length : -1;
    const svcRows = Array.isArray(svc.body) ? svc.body.length : -1;
    let verdict;
    if (svcRows === 0) {
      verdict = `svc でも 0 件 → 判定保留（データ無しのためポリシー挙動を区別不可）`;
    } else if (anonRows === 0 && svcRows > 0) {
      verdict = `phase1 適用済（anon で行が見えない、svc では見える）`;
    } else if (anonRows > 0 && svcRows > 0) {
      verdict = `_dev ポリシー残存の可能性（anon でも行が見える）`;
    } else {
      verdict = `判定困難 (anon status=${r.status}, svc status=${svc.status})`;
    }
    results[t] = { anon_status: r.status, anon_rows: anonRows, svc_status: svc.status, svc_rows: svcRows, verdict };
  }
  result.checks.rls_policy_behavior = results;
}

// ------------------------------------------------------------
// Main
// ------------------------------------------------------------
try {
  await checkEmployeeColumns();
  await checkAuditLog();
  await checkHelperFunctions();
  await checkRlsPolicies();
  console.log(JSON.stringify(result, null, 2));
} catch (e) {
  console.error("FATAL:", e);
  process.exit(1);
}
