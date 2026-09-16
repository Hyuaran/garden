import "server-only";

import { bankSearchTerms } from "@/app/system/onboarding/_lib/bank-search";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BankMasterLookup, BankSuccessor, MasterBank, MasterBranch } from "./check";
import { normalizeBankNameForCompare, normalizeBranchNameForCompare } from "./normalize";

type BankRow = { bank_code: string; bank_name: string; bank_kana?: string | null; valid_to?: string | null };
type BranchRow = { bank_code: string; branch_code: string; branch_name: string; branch_kana?: string | null; valid_to?: string | null };
type SuccessorRow = { old_bank_code: string; old_branch_code: string | null; new_bank_code: string; new_branch_code: string | null; effective_date?: string | null; note?: string | null };

const branchKey = (bankCode: string, branchCode: string) => `${bankCode}:${branchCode}`;

// Supabase REST は 1 回 1,000 行まで（支店は 28,944 行）。range で最後まで読む
const PAGE_SIZE = 1000;
async function fetchAllRows<T>(admin: SupabaseClient, table: string, columns: string, orderBy: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = admin.from(table).select(columns).range(from, from + PAGE_SIZE - 1);
    for (const column of orderBy.split(",")) query = query.order(column.trim(), { ascending: true });
    const { data, error } = await query;
    if (error) throw error;
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

export function rowToBank(row: BankRow): MasterBank {
  return { bankCode: row.bank_code, bankName: row.bank_name, bankKana: row.bank_kana ?? null, validTo: row.valid_to ?? null };
}

export function rowToBranch(row: BranchRow): MasterBranch {
  return { bankCode: row.bank_code, branchCode: row.branch_code, branchName: row.branch_name, branchKana: row.branch_kana ?? null, validTo: row.valid_to ?? null };
}

export async function loadBankMasterLookup(admin: SupabaseClient = getSupabaseAdmin()): Promise<BankMasterLookup> {
  const [banksResponse, branchRows, successorsResponse] = await Promise.all([
    fetchAllRows<BankRow>(admin, "system_bank_master", "bank_code,bank_name,bank_kana,valid_to", "bank_code"),
    fetchAllRows<BranchRow>(admin, "system_bank_branches", "bank_code,branch_code,branch_name,branch_kana,valid_to", "bank_code,branch_code"),
    admin.from("system_bank_successors").select("old_bank_code,old_branch_code,new_bank_code,new_branch_code,effective_date,note"),
  ]);
  if (successorsResponse.error) throw successorsResponse.error;

  const banks = banksResponse.map(rowToBank);
  const branches = branchRows.map(rowToBranch);
  const successors: BankSuccessor[] = ((successorsResponse.data ?? []) as SuccessorRow[]).map((row) => ({
    oldBankCode: row.old_bank_code,
    oldBranchCode: row.old_branch_code,
    newBankCode: row.new_bank_code,
    newBranchCode: row.new_branch_code,
    effectiveDate: row.effective_date ?? null,
    note: row.note ?? null,
  }));
  return {
    banksByCode: new Map(banks.map((row) => [row.bankCode, row])),
    branchesByCode: new Map(branches.map((row) => [branchKey(row.bankCode, row.branchCode), row])),
    successors,
    findBanksByName: (name) => {
      const terms = bankSearchTerms(name).map(normalizeBankNameForCompare).filter(Boolean);
      // 「みずほ」は「みずほ」「みずほ信託」の 2 件に当たるので、完全一致があればそれだけを返す
      const exact = banks.filter((bank) => terms.some((term) => normalizeBankNameForCompare(bank.bankName) === term));
      if (exact.length > 0) return exact;
      return banks.filter((bank) => terms.some((term) => normalizeBankNameForCompare(bank.bankName).includes(term)));
    },
    findBranchesByName: (bankCode, name) => {
      const target = normalizeBranchNameForCompare(name);
      if (!target) return [];
      const inBank = branches.filter((branch) => branch.bankCode === bankCode);
      const exact = inBank.filter((branch) => normalizeBranchNameForCompare(branch.branchName) === target);
      return exact.length > 0 ? exact : inBank.filter((branch) => normalizeBranchNameForCompare(branch.branchName).includes(target));
    },
  };
}

export async function latestBankDataset(admin: SupabaseClient = getSupabaseAdmin()) {
  const { data, error } = await admin
    .from("system_bank_datasets")
    .select("*")
    .order("imported_at", { ascending: false })
    .limit(12);
  if (error) throw error;
  return data ?? [];
}
