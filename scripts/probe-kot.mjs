#!/usr/bin/env node
/**
 * Garden Root — KoT API 疎通テスト（read-only）
 *
 * .env.local の KOT_API_TOKEN を使って GET /employees?limit=1 を叩く。
 * トークン値は絶対に出力しない。存在チェックと件数・上位 1 件の構造のみを返す。
 *
 * 実行: node scripts/probe-kot.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env.local");

if (!existsSync(envPath)) {
  console.error("ERROR: .env.local not found");
  process.exit(1);
}

const env = {};
for (const line of readFileSync(envPath, "utf-8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const token = env.KOT_API_TOKEN;
console.log("token present:", !!token, "length:", token ? token.length : 0);

if (!token) {
  console.error("KOT_API_TOKEN missing in .env.local");
  process.exit(1);
}

async function probe(path, label) {
  const url = `https://api.kingtime.jp/v1.0${path}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  const status = res.status;
  let body;
  try { body = await res.json(); } catch { body = await res.text().catch(() => ""); }
  console.log(`\n[${label}] ${path}`);
  console.log("  HTTP", status, res.ok ? "OK" : "FAILED");
  if (!res.ok) {
    console.log("  error body:", JSON.stringify(body).slice(0, 300));
    return null;
  }
  if (Array.isArray(body)) {
    console.log("  type: array, length:", body.length);
    if (body.length > 0) {
      // PII 全面マスキング：存在する事実のみを出し、値は一切出さない
      const keys = Object.keys(body[0]).sort();
      console.log("  sample[0] keys:", keys);
      const maskedSummary = {};
      for (const k of keys) {
        const v = body[0][k];
        if (v === null || v === undefined) maskedSummary[k] = "null";
        else if (Array.isArray(v)) maskedSummary[k] = `array(len=${v.length})`;
        else if (typeof v === "object") maskedSummary[k] = "object";
        else if (typeof v === "string") maskedSummary[k] = `string(len=${v.length})`;
        else maskedSummary[k] = typeof v;
      }
      console.log("  sample[0] shape:", JSON.stringify(maskedSummary));
    }
  } else if (body && typeof body === "object") {
    console.log("  type: object, keys:", Object.keys(body));
  }
  return body;
}

try {
  await probe("/employees?limit=1", "employees-1");

  // /monthly-workings は yyyy-MM 形式（実機確認 2026-04-24: yyyy-MM-DD は HTTP 400 code 2）
  const d = new Date();
  const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  await probe(`/monthly-workings/${ym}`, `monthly-workings-${ym}`);

  // Phase A-3-d: /daily-workings probe（実機フィールド名確認用）
  // YYYY-MM-DD 形式で前日を指定。レスポンス shape から実フィールド名を採取し、
  // `src/app/root/_types/kot.ts` の KotDailyWorking 型の推定値との差分を確認する。
  const yesterday = new Date(d.getTime() - 24 * 60 * 60 * 1000);
  const ymd = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
  await probe(`/daily-workings/${ymd}`, `daily-workings-${ymd}`);
} catch (e) {
  console.error("FATAL:", e.message);
  process.exit(1);
}
