"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { BudGate } from "../_components/BudGate";
import { BudShell } from "../_components/BudShell";
import { useBudState } from "../_state/BudStateContext";
import { supabase } from "../_lib/supabase";
import {
  fetchTransferList,
  type TransferListFilter,
} from "../_lib/transfer-queries";
import type { BudTransfer } from "../_constants/types";
import type { TransferStatus } from "../_constants/transfer-status";
import { StatusBadge } from "./_components/StatusBadge";
import { FilterBar } from "./_components/FilterBar";
import { MonthlySummary } from "./_components/MonthlySummary";

interface Company {
  company_id: string;
  company_name: string;
}

function TransfersContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { sessionUser } = useBudState();
  const [transfers, setTransfers] = useState<BudTransfer[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filter = useMemo<TransferListFilter>(() => {
    const f: TransferListFilter = {};
    const category = searchParams?.get("category");
    if (category === "regular" || category === "cashback") {
      f.category = category;
    }
    const status = searchParams?.get("status");
    if (status) {
      f.statuses = [status as TransferStatus];
    }
    const execute_company_id = searchParams?.get("execute_company_id");
    if (execute_company_id) {
      f.execute_company_id = execute_company_id;
    }
    const search = searchParams?.get("search");
    if (search) {
      f.search = search;
    }
    f.limit = 200;
    return f;
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        // 会社マスタ取得（フィルタ用）
        const { data: companyData } = await supabase
          .from("root_companies")
          .select("company_id, company_name")
          .order("company_id");
        if (!cancelled) setCompanies((companyData ?? []) as Company[]);

        // 振込一覧取得
        const { rows } = await fetchTransferList(filter);
        if (!cancelled) setTransfers(rows);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [filter]);

  if (!sessionUser) return null;

  const canCreate = true; // bud_has_access() すなわちこの画面に居る時点で OK

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">振込管理</h1>
          <p className="text-sm text-gray-500 mt-1">
            通常振込（FK-）・キャッシュバック（CB-）の一覧と操作
          </p>
        </div>
        {canCreate && (
          <div className="flex gap-2">
            <Link
              href="/bud/transfers/new-regular"
              className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700"
            >
              + 通常振込
            </Link>
            <Link
              href="/bud/transfers/new-cashback"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              + キャッシュバック
            </Link>
          </div>
        )}
      </div>

      <FilterBar
        companies={companies}
        currentFilter={{
          category: filter.category ?? undefined,
          statuses: filter.statuses,
          execute_company_id: filter.execute_company_id ?? undefined,
          search: filter.search ?? undefined,
        }}
      />

      {loading ? (
        <div className="text-center py-8 text-gray-500">読み込み中...</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded p-4">
          エラー: {error}
        </div>
      ) : (
        <>
          <MonthlySummary transfers={transfers} />

          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs">
                <tr>
                  <th className="px-3 py-2 text-left">振込ID</th>
                  <th className="px-3 py-2 text-left">状態</th>
                  <th className="px-3 py-2 text-left">お支払い先</th>
                  <th className="px-3 py-2 text-right">金額</th>
                  <th className="px-3 py-2 text-left">支払期日</th>
                  <th className="px-3 py-2 text-left">実行会社</th>
                  <th className="px-3 py-2 text-left">種別</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-900">
                {transfers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-8 text-center text-gray-400"
                    >
                      該当する振込がありません
                    </td>
                  </tr>
                ) : (
                  transfers.map((t) => (
                    <tr
                      key={t.transfer_id}
                      className="hover:bg-emerald-50 cursor-pointer"
                      onClick={() =>
                        router.push(`/bud/transfers/${t.transfer_id}`)
                      }
                    >
                      <td className="px-3 py-2 font-mono text-xs">
                        {t.transfer_id}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={t.status} size="sm" />
                      </td>
                      <td className="px-3 py-2">{t.payee_name}</td>
                      <td className="px-3 py-2 text-right font-medium">
                        ¥{t.amount.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {t.due_date ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {t.execute_company_id ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {t.transfer_category === "regular"
                          ? "通常"
                          : t.transfer_category === "cashback"
                            ? "CB"
                            : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 text-xs text-gray-400">
            {transfers.length} 件表示
          </div>
        </>
      )}
    </div>
  );
}

export default function TransfersPage() {
  return (
    <BudGate>
      <BudShell>
        <TransfersContent />
      </BudShell>
    </BudGate>
  );
}
