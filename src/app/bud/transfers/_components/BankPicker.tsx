"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../_lib/supabase";

interface Company {
  company_id: string;
  company_name: string;
}

interface BankAccount {
  id: string;
  company_id: string;
  bank_name: string;
  bank_code: string;
  branch_name: string;
  branch_code: string;
  account_type: string;
  account_number: string;
  account_holder_kana: string | null;
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
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("root_companies")
        .select("company_id, company_name")
        .order("company_id");
      if (!cancelled) setCompanies((data ?? []) as Company[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!executeCompanyId) {
      setAccounts([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("root_bank_accounts")
        .select(
          "id, company_id, bank_name, bank_code, branch_name, branch_code, account_type, account_number, account_holder_kana",
        )
        .eq("company_id", executeCompanyId)
        .order("bank_name");
      if (!cancelled) {
        setAccounts((data ?? []) as BankAccount[]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [executeCompanyId]);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === sourceAccountId) ?? null,
    [accounts, sourceAccountId],
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
            const acc = accounts.find((a) => a.id === e.target.value) ?? null;
            onAccountChange(acc);
          }}
          disabled={disabled || !executeCompanyId || accounts.length === 0}
          className="mt-1 block w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:bg-gray-100"
        >
          <option value="">
            {!executeCompanyId
              ? "先に法人を選択してください"
              : accounts.length === 0
                ? "登録された口座がありません"
                : "選択してください"}
          </option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.bank_name} {a.branch_name} ({a.account_type}) {a.account_number}
            </option>
          ))}
        </select>
        {selectedAccount && (
          <p className="text-xs text-gray-500 mt-1">
            {selectedAccount.account_holder_kana ?? "（名義カナ未登録）"}
          </p>
        )}
      </label>
    </div>
  );
}
