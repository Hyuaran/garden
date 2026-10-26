"use client";
import FilterRow from "@/app/system/_components/FilterBox/FilterRow";
import FilterBox from "@/app/system/_components/FilterBox/FilterBox";
import ChoiceFilter from "@/app/system/_components/ChoiceFilter";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import type { TransferStatus } from "../../_constants/transfer-status";
import type { TransferCategory } from "../../_constants/types";
import { TRANSFER_STATUSES } from "../../_constants/transfer-status";

interface FilterBarProps {
  companies: Array<{ company_id: string; company_name: string }>;
  currentFilter: {
    category?: TransferCategory;
    statuses?: TransferStatus[];
    execute_company_id?: string;
    search?: string;
  };
}

export function FilterBar({ companies, currentFilter }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 space-y-3">
      <FilterRow className="flex flex-wrap gap-3 items-end">
        {/* 振込種別 */}
        <div>
          
          <ChoiceFilter label="振込種別" value={currentFilter.category ?? ""} onValueChange={value => updateParam("category", value || null)}>
            <option value="">すべて</option>
            <option value="regular">通常振込（FK-）</option>
            <option value="cashback">キャッシュバック（CB-）</option>
          </ChoiceFilter>
        </div>

        {/* ステータス（単一選択） */}
        <div>
          
          <ChoiceFilter label="ステータス" value={currentFilter.statuses?.[0] ?? ""} onValueChange={value => updateParam("status", value || null)}>
            <option value="">すべて</option>
            {TRANSFER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </ChoiceFilter>
        </div>

        {/* 実行会社 */}
        <div>
          
          <ChoiceFilter label="実行会社" value={currentFilter.execute_company_id ?? ""} onValueChange={value => updateParam("execute_company_id", value || null)}>
            <option value="">すべて</option>
            {companies.map((c) => (
              <option key={c.company_id} value={c.company_id}>
                {c.company_name}
              </option>
            ))}
          </ChoiceFilter>
        </div>

        {/* 検索 */}
        <div className="flex-1 min-w-[200px]">
          
          <FilterBox label="検索（受取人名・備考）" search><input
            type="text"
            defaultValue={currentFilter.search ?? ""}
            onBlur={(e) => updateParam("search", e.target.value || null)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                updateParam("search", e.currentTarget.value || null);
              }
            }}
            placeholder="Enter で検索"
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 bg-white"
          /></FilterBox>
        </div>

        {/* クリア */}
        <button
          type="button"
          onClick={() => router.push(pathname)}
          className="px-3 py-1 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
        >
          クリア
        </button>
      </FilterRow>
    </div>
  );
}
