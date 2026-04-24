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
      const sample = { ...body[0] };
      // トークンやキーに見えるものだけ伏字にする（念のため）
      if (typeof sample.key === "string" && sample.key.length > 12) sample.key = sample.key.slice(0, 6) + "...(masked)";
      console.log("  sample[0] keys:", Object.keys(body[0]).sort());
      console.log("  sample[0] (masked):", JSON.stringify(sample));
    }
  } else if (body && typeof body === "object") {
    console.log("  type: object, keys:", Object.keys(body));
  }
  return body;
}

try {
  await probe("/employees?limit=1", "employees-1");

  // 当月1日を YYYY-MM-DD で構築（2026-04 の場合 "2026-04-01"）
  const d = new Date();
  const first = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  await probe(`/monthly-workings/${first}`, `monthly-workings-${first}`);
} catch (e) {
  console.error("FATAL:", e.message);
  process.exit(1);
}
