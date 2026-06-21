"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../_lib/supabase";
import {
  buildCompanyToCorp,
  type Company,
  type Corp,
} from "../../expenses/_components/expenseCorpUtils";

interface BankAccount {
  id: string;
  corp_code: string;
  bank_name: string;
  branch_name: string;
  branch_code: string;
  account_type: string;
  account_number: string;
  sub_account_label: string | null;
}

interface Props {
  executeCompanyId: string;
  onCompanyChange: (companyId: string) => void;
  sourceAccountId: string;
  onAccountChange: (account: BankAccount | null) => void;
  disabled?: boolean;
}

export function BankPicker({
  executeCompanyId,
  onCompanyChange,
  sourceAccountId,
  onAccountChange,
  disabled,
}: Props) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [corps, setCorps] = useState<Corp[]>([]);
  const [accountState, setAccountState] = useState<{
    corpCode: string;
    rows: BankAccount[];
  }>({ corpCode: "", rows: [] });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [companyResult, corpResult] = await Promise.all([
        supabase
          .from("root_companies")
          .select("company_id, company_name")
          .order("company_id"),
        supabase
          .from("bud_corporations")
          .select("id, name_short")
          .order("id"),
      ]);
      if (!cancelled) {
        setCompanies((companyResult.data ?? []) as Company[]);
        setCorps((corpResult.data ?? []) as Corp[]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const companyToCorp = useMemo(
    () => buildCompanyToCorp(companies, corps),
    [companies, corps],
  );

  const executeCorpCode = useMemo(() => {
    if (!executeCompanyId) return "";
    if (companyToCorp[executeCompanyId]) return companyToCorp[executeCompanyId];
    if (corps.some((corp) => corp.id === executeCompanyId)) return executeCompanyId;
    return executeCompanyId;
  }, [companyToCorp, corps, executeCompanyId]);

  useEffect(() => {
    if (!executeCompanyId) {
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("root_bank_accounts")
        .select(
          "id, corp_code, bank_name, branch_name, branch_code, account_type, account_number, sub_account_label",
        )
        .eq("corp_code", executeCorpCode)
        .order("bank_name");
      if (!cancelled) {
        setAccountState({
          corpCode: executeCorpCode,
          rows: (data ?? []) as BankAccount[],
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [executeCompanyId, executeCorpCode]);

  const loading =
    Boolean(executeCompanyId) && accountState.corpCode !== executeCorpCode;
  const visibleAccounts = useMemo(
    () =>
      executeCompanyId && accountState.corpCode === executeCorpCode
        ? accountState.rows
        : [],
    [accountState, executeCompanyId, executeCorpCode],
  );

  const selectedAccount = useMemo(
    () => visibleAccounts.find((a) => a.id === sourceAccountId) ?? null,
    [visibleAccounts, sourceAccountId],
  );

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-xs text-gray-600">起票法人 *</span>
        <select
          value={executeCompanyId}
          onChange={(e) => {
            onCompanyChange(e.target.value);
            onAccountChange(null);
          }}
          disabled={disabled}
          className="mt-1 block w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
        >
          <option value="">選択してください</option>
          {companies.map((c) => (
            <option key={c.company_id} value={c.company_id}>
              {c.company_name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-xs text-gray-600">
          支払元口座 * {loading && <span className="ml-2 text-gray-400">読み込み中…</span>}
        </span>
        <select
          value={sourceAccountId}
          onChange={(e) => {
            const acc =
              visibleAccounts.find((a) => a.id === e.target.value) ?? null;
            onAccountChange(acc);
          }}
          disabled={disabled || !executeCompanyId || visibleAccounts.length === 0}
          className="mt-1 block w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:bg-gray-100"
        >
          <option value="">
            {!executeCompanyId
              ? "先に法人を選択してください"
              : visibleAccounts.length === 0
                ? "登録された口座がありません"
                : "選択してください"}
          </option>
          {visibleAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.bank_name} {a.branch_name} ({a.account_type}){" "}
              {a.account_number}
              {a.sub_account_label ? ` / ${a.sub_account_label}` : ""}
            </option>
          ))}
        </select>
        {selectedAccount && (
          <p className="text-xs text-gray-500 mt-1">
            corp_code: {selectedAccount.corp_code}
            {selectedAccount.branch_code
              ? ` / 支店コード ${selectedAccount.branch_code}`
              : ""}
          </p>
        )}
      </label>
    </div>
  );
}
