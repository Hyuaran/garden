import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { checkBankAccount, type BankAccountPayload } from "@/lib/bank-master/check";
import { loadBankMasterLookup, latestBankDataset } from "@/lib/bank-master/lookup.server";
import { getCurrentProfile, insertProfileHistoryIfChanged, todayJst } from "@/app/root/_lib/profile-history.server";

type EmployeeRow = { employee_id: string; employee_number: string; name: string; employment_type?: string | null; is_active?: boolean; deleted_at?: string | null };
type BudAccountRow = {
  id?: string | number;
  employee_id?: string | null;
  employee_number?: string | null;
  employee_name?: string | null;
  name?: string | null;
  bank_name?: string | null;
  bank_code?: string | null;
  branch_name?: string | null;
  branch_code?: string | null;
  account_type?: string | null;
  account_number?: string | null;
  account_holder_kana?: string | null;
};

export type BankCheckFinding = {
  id: string;
  source: "history" | "bud";
  employeeId: string | null;
  employeeName: string;
  employeeNumber: string | null;
  sourceLabel: string;
  registeredLabel: string;
  issues: string[];
  issueLabel: string;
  candidateLabel: string;
  candidate: Partial<BankAccountPayload>;
  canApply: boolean;
  payload: BankAccountPayload;
};

const ISSUE_LABELS: Record<string, string> = {
  missing_code: "コード無し",
  not_found: "台帳に無い",
  expired: "廃止済み",
  name_mismatch: "名前が違う",
  missing_branch_name: "支店名なし",
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function payloadLabel(payload: BankAccountPayload) {
  const bank = [text(payload.bank_name) || "銀行名なし", text(payload.bank_code)].filter(Boolean).join(" ");
  const branch = [text(payload.branch_name) || "支店名なし", text(payload.branch_code)].filter(Boolean).join(" ");
  return `${bank} ／ ${branch}`;
}

function publicPayload(payload: BankAccountPayload): BankAccountPayload {
  const { account_number: _accountNumber, ...rest } = payload;
  return rest;
}

function firstIssueLabel(issues: string[]) {
  return ISSUE_LABELS[issues[0]] ?? "要確認";
}

export async function runBankAccountCheck(admin: SupabaseClient = getSupabaseAdmin()) {
  const [lookup, employeesResponse, allEmployeesResponse, budResponse, datasets] = await Promise.all([
    loadBankMasterLookup(admin),
    admin.from("root_employees").select("employee_id,employee_number,name,employment_type,is_active,deleted_at").eq("is_active", true).is("deleted_at", null),
    admin.from("root_employees").select("employee_id,employee_number,name"),
    admin.from("bud_employee_bank_accounts").select("*"),
    latestBankDataset(admin),
  ]);
  if (employeesResponse.error) throw employeesResponse.error;
  if (allEmployeesResponse.error) throw allEmployeesResponse.error;
  if (budResponse.error) throw budResponse.error;
  const nameByEmployeeId = new Map(((allEmployeesResponse.data ?? []) as EmployeeRow[]).map((row) => [row.employee_id, row]));

  const findings: BankCheckFinding[] = [];
  const employees = ((employeesResponse.data ?? []) as EmployeeRow[]).filter((row) => row.employee_number !== "9999" && row.employment_type !== "outsource");
  for (const employee of employees) {
    const current = await getCurrentProfile(admin as never, employee.employee_id, true);
    for (const [slot, raw] of [["main", current.bank_account?.payload], ["sub", (current.bank_account?.payload as BankAccountPayload | undefined)?.sub_account]] as const) {
      if (!raw || typeof raw !== "object") continue;
      const payload = raw as BankAccountPayload;
      const result = checkBankAccount(payload, lookup);
      if (result.issues.length === 0) continue;
      findings.push({
        id: `history:${employee.employee_id}:${slot}`,
        source: "history",
        employeeId: employee.employee_id,
        employeeName: employee.name,
        employeeNumber: employee.employee_number,
        sourceLabel: slot === "sub" ? "履歴（サブ）" : "履歴",
        registeredLabel: payloadLabel(payload),
        issues: result.issues,
        issueLabel: firstIssueLabel(result.issues),
        candidateLabel: result.candidateLabel,
        candidate: result.candidate,
        canApply: Object.keys(result.candidate).length > 0,
        payload: publicPayload(payload),
      });
    }
  }

  for (const [index, row] of ((budResponse.data ?? []) as BudAccountRow[]).entries()) {
    const payload: BankAccountPayload = {
      bank_name: row.bank_name,
      bank_code: row.bank_code,
      branch_name: row.branch_name,
      branch_code: row.branch_code,
      account_type: row.account_type,
      account_holder_kana: row.account_holder_kana,
    };
    const result = checkBankAccount(payload, lookup);
    if (result.issues.length === 0) continue;
    findings.push({
      id: `bud:${row.id ?? index}`,
      source: "bud",
      employeeId: row.employee_id ?? null,
      employeeName: row.employee_name ?? row.name ?? nameByEmployeeId.get(row.employee_id ?? "")?.name ?? row.employee_id ?? "Bud 口座",
      employeeNumber: row.employee_number ?? nameByEmployeeId.get(row.employee_id ?? "")?.employee_number ?? null,
      sourceLabel: "Bud 口座",
      registeredLabel: payloadLabel(payload),
      issues: result.issues,
      issueLabel: firstIssueLabel(result.issues),
      candidateLabel: result.candidateLabel,
      candidate: result.candidate,
      canApply: false,
      payload: publicPayload(payload),
    });
  }

  return { findings, datasets };
}

export async function applyBankCheckFinding(admin: SupabaseClient, actorEmployeeNumber: string, input: { employee_id?: unknown; payload?: unknown; issue?: unknown }) {
  const employeeId = text(input.employee_id);
  if (!employeeId || !input.payload || typeof input.payload !== "object") throw new Error("invalid_payload");
  const current = await getCurrentProfile(admin as never, employeeId, true);
  const base = (current.bank_account?.payload ?? {}) as Record<string, unknown>;
  const next = { ...base, ...(input.payload as Record<string, unknown>) };
  const added = await insertProfileHistoryIfChanged(admin as never, {
    employee_id: employeeId,
    category: "bank_account",
    payload: next,
    source: "admin",
    source_ref: null,
    effective_from: todayJst(),
    recorded_by: actorEmployeeNumber,
    note: `口座の点検で補正（指摘：${text(input.issue) || "要確認"}）`,
  });
  if (added) {
    await admin.from("root_audit_log").insert({
      actor_emp_num: actorEmployeeNumber,
      action: "bank_check_apply",
      target_type: "root_employee_profile_history",
      target_id: employeeId,
      payload: { employee_id: employeeId, issue: text(input.issue) || null },
    });
  }
  return { ok: true, added };
}

export async function addBankSuccessor(admin: SupabaseClient, actorEmployeeNumber: string, body: Record<string, unknown>) {
  const row = {
    old_bank_code: text(body.old_bank_code),
    old_branch_code: text(body.old_branch_code) || null,
    new_bank_code: text(body.new_bank_code),
    new_branch_code: text(body.new_branch_code) || null,
    effective_date: text(body.effective_date) || null,
    note: text(body.note) || null,
    created_by: actorEmployeeNumber,
  };
  if (!row.old_bank_code || !row.new_bank_code) throw new Error("invalid_payload");
  const { error } = await admin.from("system_bank_successors").insert(row);
  if (error) throw error;
  await admin.from("root_audit_log").insert({
    actor_emp_num: actorEmployeeNumber,
    action: "bank_successor_add",
    target_type: "system_bank_successors",
    target_id: `${row.old_bank_code}:${row.old_branch_code ?? ""}`,
    payload: { old_bank_code: row.old_bank_code, old_branch_code: row.old_branch_code, new_bank_code: row.new_bank_code, new_branch_code: row.new_branch_code },
  });
  return { ok: true };
}
