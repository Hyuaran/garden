"use client";

import { useEffect, useState } from "react";
import { supabase } from "../_lib/supabase";

export interface StatementBankAccount {
  id: string;
  bank_name: string;
  branch_name: string | null;
  account_number: string | null;
  sub_account_label: string | null;
}

export function statementAccountLabel(account: StatementBankAccount): string {
  // 口座の名前に銀行名まで入っているときは、名前だけを出す（銀行・支店・番号を重ねない）
  if (account.sub_account_label && account.sub_account_label.includes(account.bank_name)) return account.sub_account_label;
  return [
    account.sub_account_label,
    account.bank_name,
    account.branch_name,
    account.account_number ? `下4桁 ${account.account_number.slice(-4)}` : null,
  ].filter(Boolean).join(" / ");
}

// 各画面の初回に1回だけ取得。定期取得・cronの追加なし。
export function useStatementAccounts() {
  const [bankAccounts, setBankAccounts] = useState<StatementBankAccount[]>([]);
  const [accountError, setAccountError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("root_bank_accounts")
          .select("id, bank_name, branch_name, account_number, sub_account_label")
          .is("deleted_at", null)
          .order("bank_name");
        if (error) throw error;
        if (!cancelled) setBankAccounts((data ?? []) as StatementBankAccount[]);
      } catch {
        if (!cancelled) setAccountError("口座の一覧を取得できませんでした。画面を開き直してください。");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { bankAccounts, accountError };
}
