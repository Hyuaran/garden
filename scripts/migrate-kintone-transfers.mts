#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import type {
  BankAccountMaster,
  CompanyMaster,
  CorpMaster,
  KintoneRecord,
  MigrationMasters,
  TransferInsertPayload,
} from "../src/app/bud/transfers/_lib/kintone-transfer-migration";

type Args = {
  apply: boolean;
  out: string | null;
};

type ScriptSupabaseClient = ReturnType<typeof createClient<any>>;

const KINTONE_APP_ID = 51;
const PAGE_SIZE = 500;

async function main() {
  loadEnvLocal();
  const args = parseArgs(process.argv.slice(2));
  const requiredEnv = ["KINTONE_SUBDOMAIN", "KINTONE_TRANSFER_REQUEST_TOKEN", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const missingEnv = requiredEnv.filter((key) => !process.env[key]);
  if (missingEnv.length > 0) throw new Error(`Missing env: ${missingEnv.join(", ")}`);

  const supabase: ScriptSupabaseClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const { analyzeKintoneTransfers } = await loadMigrationModule();

  const [records, masters] = await Promise.all([fetchAllKintoneRecords(), loadMasters(supabase)]);
  const beforeCount = await countBudTransfers(supabase);
  const analysis = analyzeKintoneTransfers(records, masters);

  let inserted = 0;
  let afterCount: number | null = null;
  if (args.apply) {
    inserted = await insertTransfers(supabase, analysis.insertable.map((row) => row.payload));
    afterCount = await countBudTransfers(supabase);
  }

  const report = {
    mode: args.apply ? "apply" : "dry-run",
    generatedAt: new Date().toISOString(),
    kintone: {
      appId: KINTONE_APP_ID,
      total: analysis.total,
      statusCounts: analysis.statusCounts,
    },
    garden: {
      beforeCount,
      afterCount,
      inserted,
    },
    planned: {
      insertable: analysis.insertable.length,
      duplicates: analysis.duplicates.length,
      skipped: analysis.skipped.length,
      missingRequired: analysis.missingRequired.length,
      sourceAccountUnresolved: analysis.sourceAccountUnresolved.length,
    },
    skipped: analysis.skipped,
    duplicates: analysis.duplicates,
    missingRequired: analysis.missingRequired,
    sourceAccountUnresolved: analysis.sourceAccountUnresolved,
    sourceAccountSupplements: analysis.sourceAccountSupplements,
    executedDateSupplements: analysis.executedDateSupplements,
    samples: analysis.samples.map(sanitizeSample),
  };

  const outPath = args.out ?? defaultReportPath(args.apply);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  printSummary(report, outPath);
}

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i <= 0) continue;
    const key = trimmed.slice(0, i);
    let value = trimmed.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseArgs(argv: string[]): Args {
  let out: string | null = null;
  for (const arg of argv) {
    if (arg.startsWith("--out=")) out = arg.slice("--out=".length);
  }
  return { apply: argv.includes("--apply"), out };
}

async function fetchAllKintoneRecords() {
  const host = kintoneHost();
  const records: KintoneRecord[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const query = `order by $id asc limit ${PAGE_SIZE} offset ${offset}`;
    const url = new URL(`https://${host}/k/v1/records.json`);
    url.searchParams.set("app", String(KINTONE_APP_ID));
    url.searchParams.set("query", query);
    const res = await fetch(url, {
      headers: { "X-Cybozu-API-Token": process.env.KINTONE_TRANSFER_REQUEST_TOKEN! },
    });
    const json = (await res.json()) as { records?: KintoneRecord[]; message?: string };
    if (!res.ok) throw new Error(`Kintone fetch failed: ${json.message ?? res.statusText}`);
    const page = json.records ?? [];
    records.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return records;
}

async function loadMigrationModule(): Promise<{
  analyzeKintoneTransfers: (records: KintoneRecord[], masters: MigrationMasters) => {
    total: number;
    statusCounts: Record<string, number>;
    insertable: Array<{ payload: TransferInsertPayload }>;
    skipped: unknown[];
    duplicates: unknown[];
    missingRequired: unknown[];
    sourceAccountUnresolved: unknown[];
    sourceAccountSupplements: unknown[];
    executedDateSupplements: unknown[];
    samples: TransferInsertPayload[];
  };
}> {
  return import("../src/app/bud/transfers/_lib/kintone-transfer-migration" + ".ts");
}

function kintoneHost() {
  const subdomain = process.env.KINTONE_SUBDOMAIN!;
  return subdomain.includes(".") ? subdomain : `${subdomain}.cybozu.com`;
}

async function loadMasters(supabase: ScriptSupabaseClient) {
  const [companiesRes, corpsRes, accountsRes, existingRes] = await Promise.all([
    supabase.from("root_companies").select("company_id,company_name").order("company_id"),
    supabase.from("bud_corporations").select("id,name_short").order("id"),
    supabase.from("root_bank_accounts").select("id,corp_code,bank_name,branch_name,account_number,sub_account_label").order("corp_code"),
    supabase.from("bud_transfers").select("transfer_id"),
  ]);

  if (companiesRes.error) throw new Error(`root_companies fetch failed: ${companiesRes.error.message}`);
  if (corpsRes.error) throw new Error(`bud_corporations fetch failed: ${corpsRes.error.message}`);
  if (accountsRes.error) throw new Error(`root_bank_accounts fetch failed: ${accountsRes.error.message}`);
  if (existingRes.error) throw new Error(`bud_transfers fetch failed: ${existingRes.error.message}`);

  return {
    companies: (companiesRes.data ?? []) as CompanyMaster[],
    corps: (corpsRes.data ?? []) as CorpMaster[],
    bankAccounts: (accountsRes.data ?? []) as BankAccountMaster[],
    existingTransferIds: new Set(((existingRes.data ?? []) as Array<{ transfer_id: string }>).map((row) => row.transfer_id)),
  };
}

async function countBudTransfers(supabase: ScriptSupabaseClient) {
  const { count, error } = await supabase.from("bud_transfers").select("transfer_id", { count: "exact", head: true });
  if (error) throw new Error(`bud_transfers count failed: ${error.message}`);
  return count ?? 0;
}

async function insertTransfers(supabase: ScriptSupabaseClient, payloads: TransferInsertPayload[]) {
  let inserted = 0;
  for (let i = 0; i < payloads.length; i += 100) {
    const chunk = payloads.slice(i, i + 100);
    const { error } = await supabase.from("bud_transfers").insert(chunk);
    if (error) throw new Error(`insert failed at ${i}: ${error.message}`);
    inserted += chunk.length;
  }
  return inserted;
}

function sanitizeSample(payload: TransferInsertPayload) {
  return {
    ...payload,
    payee_account_number: payload.payee_account_number ? maskTail(payload.payee_account_number) : null,
    payee_account_holder_kana: payload.payee_account_holder_kana ? "(set)" : null,
  };
}

function maskTail(value: string) {
  return value.length <= 3 ? "***" : `${"*".repeat(value.length - 3)}${value.slice(-3)}`;
}

function defaultReportPath(apply: boolean) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(".codex", `kintone-transfer-migration-${apply ? "apply" : "dry-run"}-${stamp}.json`);
}

function printSummary(report: {
  mode: string;
  kintone: { total: number; statusCounts: Record<string, number> };
  garden: { beforeCount: number; afterCount: number | null; inserted: number };
  planned: Record<string, number>;
}, outPath: string) {
  console.log(`mode: ${report.mode}`);
  console.log(`kintone total: ${report.kintone.total}`);
  console.log(`status counts: ${JSON.stringify(report.kintone.statusCounts)}`);
  console.log(`planned: ${JSON.stringify(report.planned)}`);
  console.log(`bud_transfers before: ${report.garden.beforeCount}`);
  if (report.garden.afterCount != null) console.log(`bud_transfers after: ${report.garden.afterCount}`);
  console.log(`inserted: ${report.garden.inserted}`);
  console.log(`report: ${outPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
