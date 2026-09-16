import JSZip from "jszip";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { countDiff, diffBankMaster, flattenBranchesByBank, type BankMasterBank, type BankMasterBranch, type BankMasterSnapshot } from "@/lib/bank-master/diff";
import { runBankAccountCheck } from "@/app/api/root/bank-check/_lib";

export const ZENGIN_ZIP_URL = "https://codeload.github.com/zengin-code/source-data/zip/refs/heads/master";
export const ZENGIN_UPDATED_AT_URL = "https://raw.githubusercontent.com/zengin-code/source-data/master/data/updated_at";
export const ZENGIN_MD5_URL = "https://raw.githubusercontent.com/zengin-code/source-data/master/data/md5";

export type BankImportStatus = "ok" | "skipped_same" | "failed";

export function parseZenginDate(value: string) {
  const compact = value.trim();
  if (!/^\d{8}$/.test(compact)) throw new Error("invalid_source_date");
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
}

type ZenginEntry = { code: string; name: string; kana?: string };

export async function parseZenginZip(zipBytes: ArrayBuffer): Promise<BankMasterSnapshot> {
  const zip = await JSZip.loadAsync(zipBytes);
  const bankEntry = zip.file("source-data-master/data/banks.json");
  if (!bankEntry) throw new Error("banks_json_not_found");
  const bankJson = JSON.parse(await bankEntry.async("string")) as Record<string, ZenginEntry>;
  const banks: BankMasterBank[] = Object.values(bankJson).map((row) => ({
    bank_code: row.code,
    bank_name: row.name,
    bank_kana: row.kana ?? null,
    valid_to: null,
  }));
  const branchesByBank: Record<string, BankMasterBranch[]> = {};
  const branchFiles = Object.values(zip.files).filter((file) => !file.dir && /^source-data-master\/data\/branches\/\d{4}\.json$/.test(file.name));
  for (const file of branchFiles) {
    const bankCode = file.name.match(/(\d{4})\.json$/)?.[1] ?? "";
    const branchJson = JSON.parse(await file.async("string")) as Record<string, ZenginEntry>;
    branchesByBank[bankCode] = Object.values(branchJson).map((row) => ({
      bank_code: bankCode,
      branch_code: row.code,
      branch_name: row.name,
      branch_kana: row.kana ?? null,
      valid_to: null,
    }));
  }
  return { banks, branchesByBank };
}

export function assertMinimumCounts(snapshot: BankMasterSnapshot) {
  const branchCount = flattenBranchesByBank(snapshot.branchesByBank).length;
  if (snapshot.banks.length < 1000 || branchCount < 25000) {
    throw new Error(`unexpected_row_count:banks=${snapshot.banks.length}:branches=${branchCount}`);
  }
}

async function fetchText(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`fetch_failed:${url}`);
  return response.text();
}

async function fetchLatestSourceMeta() {
  const [updatedAt, md5] = await Promise.all([fetchText(ZENGIN_UPDATED_AT_URL), fetchText(ZENGIN_MD5_URL)]);
  return { sourceDate: parseZenginDate(updatedAt), sourceMd5: md5.trim() };
}

async function loadCurrent(admin: SupabaseClient): Promise<BankMasterSnapshot> {
  const [banks, branches] = await Promise.all([
    admin.from("system_bank_master").select("bank_code,bank_name,bank_kana,valid_to"),
    admin.from("system_bank_branches").select("bank_code,branch_code,branch_name,branch_kana,valid_to"),
  ]);
  if (banks.error) throw banks.error;
  if (branches.error) throw branches.error;
  const branchesByBank: Record<string, BankMasterBranch[]> = {};
  for (const row of (branches.data ?? []) as BankMasterBranch[]) {
    (branchesByBank[row.bank_code] ??= []).push(row);
  }
  return { banks: (banks.data ?? []) as BankMasterBank[], branchesByBank };
}

async function latestOkMd5(admin: SupabaseClient) {
  const { data, error } = await admin
    .from("system_bank_datasets")
    .select("source_md5")
    .eq("status", "ok")
    .order("imported_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return typeof data?.source_md5 === "string" ? data.source_md5 : null;
}

async function insertDataset(admin: SupabaseClient, row: Record<string, unknown>) {
  const { error } = await admin.from("system_bank_datasets").insert(row);
  if (error) throw error;
}

async function insertChunks(admin: SupabaseClient, table: string, rows: Record<string, unknown>[]) {
  for (let index = 0; index < rows.length; index += 1000) {
    const { error } = await admin.from(table).insert(rows.slice(index, index + 1000));
    if (error) throw error;
  }
}

async function updateEach(admin: SupabaseClient, table: string, rows: Record<string, unknown>[], keys: string[], patch: (row: Record<string, unknown>) => Record<string, unknown>) {
  for (const row of rows) {
    let query = admin.from(table).update(patch(row));
    for (const key of keys) query = query.eq(key, row[key]);
    const { error } = await query;
    if (error) throw error;
  }
}

export async function importBankMaster(admin: SupabaseClient = getSupabaseAdmin()) {
  let meta: { sourceDate: string; sourceMd5: string } | null = null;
  try {
    meta = await fetchLatestSourceMeta();
    if ((await latestOkMd5(admin)) === meta.sourceMd5) {
      await insertDataset(admin, { source_date: meta.sourceDate, source_md5: meta.sourceMd5, status: "skipped_same", note: "変更なし" });
      return { ok: true, status: "skipped_same" as const, sourceDate: meta.sourceDate, sourceMd5: meta.sourceMd5 };
    }
    const zipResponse = await fetch(ZENGIN_ZIP_URL, { cache: "no-store" });
    if (!zipResponse.ok) throw new Error("zip_download_failed");
    const incoming = await parseZenginZip(await zipResponse.arrayBuffer());
    assertMinimumCounts(incoming);
    const current = await loadCurrent(admin);
    const diff = diffBankMaster(current, incoming);
    const counts = countDiff(diff);
    const sourceFields = { valid_from: meta.sourceDate, valid_to: null, source_date: meta.sourceDate, updated_at: new Date().toISOString() };
    await insertChunks(admin, "system_bank_master", diff.banksAdded.map((row) => ({ ...row, ...sourceFields })));
    await insertChunks(admin, "system_bank_branches", diff.branchesAdded.map((row) => ({ ...row, ...sourceFields })));
    await updateEach(admin, "system_bank_master", [...diff.banksRenamed, ...diff.banksRestored] as unknown as Record<string, unknown>[], ["bank_code"], (row) => ({ bank_name: row.bank_name, bank_kana: row.bank_kana, valid_to: null, source_date: meta!.sourceDate, updated_at: new Date().toISOString() }));
    await updateEach(admin, "system_bank_branches", [...diff.branchesRenamed, ...diff.branchesRestored] as unknown as Record<string, unknown>[], ["bank_code", "branch_code"], (row) => ({ branch_name: row.branch_name, branch_kana: row.branch_kana, valid_to: null, source_date: meta!.sourceDate, updated_at: new Date().toISOString() }));
    await updateEach(admin, "system_bank_master", diff.banksExpired as unknown as Record<string, unknown>[], ["bank_code"], () => ({ valid_to: meta!.sourceDate, updated_at: new Date().toISOString() }));
    await updateEach(admin, "system_bank_branches", diff.branchesExpired as unknown as Record<string, unknown>[], ["bank_code", "branch_code"], () => ({ valid_to: meta!.sourceDate, updated_at: new Date().toISOString() }));
    const check = await runBankAccountCheck(admin);
    const bankCount = incoming.banks.length;
    const branchCount = flattenBranchesByBank(incoming.branchesByBank).length;
    await insertDataset(admin, {
      source_date: meta.sourceDate,
      source_md5: meta.sourceMd5,
      status: "ok",
      bank_count: bankCount,
      branch_count: branchCount,
      banks_added: counts.banksAdded,
      banks_expired: counts.banksExpired,
      banks_renamed: counts.banksRenamed,
      branches_added: counts.branchesAdded,
      branches_expired: counts.branchesExpired,
      branches_renamed: counts.branchesRenamed,
      check_findings: check.findings.length,
    });
    return { ok: true, status: "ok" as const, sourceDate: meta.sourceDate, sourceMd5: meta.sourceMd5, bankCount, branchCount, ...counts, checkFindings: check.findings.length };
  } catch (error) {
    if (meta) {
      await insertDataset(admin, { source_date: meta.sourceDate, source_md5: meta.sourceMd5, status: "failed", note: error instanceof Error ? error.message : String(error) }).catch(() => undefined);
    }
    throw error;
  }
}
