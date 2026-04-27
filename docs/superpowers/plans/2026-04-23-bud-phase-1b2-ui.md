# Garden-Bud Phase 1b.2 — 振込管理 UI 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 1b.1 Foundation（queries/mutations/types）の上に、振込管理の 5 画面 UI を構築する。Kintone 置換を完全に Bud 内で完結させる。

**Architecture:**
- Next.js 16 App Router：Server Components を基本、Client Components は対話が必要な箇所だけ
- フォーム送信は Server Actions（`use server`）で実装し、Supabase Auth の cookie が自動で伝わる安全経路を確保
- バリデーションはクライアント側（UX）+ サーバー側（セキュリティ）両方で実施、共通ロジックは純関数として `_lib/transfer-form.ts` に分離してテスト
- CSV 出力は Phase 1a の `generateZenginCsv` を呼び出し、`Buffer` をクライアントへダウンロード

**Tech Stack:**
- Next.js 16.2.3 App Router（Phase 0 の Tree/Bud パターン踏襲）
- TypeScript 5 strict mode
- Tailwind CSS 4（既存）
- Supabase JS（既存）
- Vitest（純関数テストのみ。UI は手動確認）

**参照 Spec:** `docs/superpowers/specs/2026-04-22-bud-design-v2.md` §6（Phase 1b）

**前提 Phase:**
- Phase 0 認証基盤（完了）
- Phase 1a 全銀協 CSV ライブラリ（完了、95 tests）
- Phase 1b.1 Foundation（完了、125 tests、queries/mutations 利用可能）

**見積工数:** 1.4d（Phase 1b 全体 2.2d のうち UI 分）

---

## 前提条件

- [x] Phase 1b.1 完了・commit 済み（transfer-queries.ts / transfer-mutations.ts が使える）
- [ ] 東海林さんが `scripts/bud-transfers-v2.sql` を Supabase に適用済み（Phase 1b.1 Task 0 の手動作業）
- [ ] 東海林さんが `scripts/bud-rls-v2.sql` を Supabase に適用済み
- [ ] `root_employees` / `root_companies` / `root_bank_accounts` / `root_vendors` に最低限の seed データが入っている

---

## ファイル構成

```
src/app/bud/
  transfers/
    page.tsx                         — 振込一覧
    new-regular/
      page.tsx                       — 通常振込 新規作成
    new-cashback/
      page.tsx                       — CB 新規作成
    [transfer_id]/
      page.tsx                       — 振込詳細
    csv-export/
      page.tsx                       — CSV 出力（super_admin 専用）
    _components/
      StatusBadge.tsx                — ステータスバッジ表示
      FilterBar.tsx                  — 一覧フィルタ（Client）
      MonthlySummary.tsx             — 月別合計サマリ
      TransferFormRegular.tsx        — 通常振込フォーム（Client）
      TransferFormCashback.tsx       — CB フォーム（Client）
      DuplicateWarning.tsx           — 重複警告バナー
      StatusActionButtons.tsx        — ステータス遷移ボタン群
      BankPicker.tsx                 — 会社×銀行口座選択
      KanaPreview.tsx                — 半角カナ変換プレビュー
    _lib/
      transfer-form-schema.ts        — 入力値バリデーション（純関数）
      __tests__/
        transfer-form-schema.test.ts

  _server-actions/
    transfer-actions.ts              — Server Actions（createTransfer, approve, reject 等）

  _components/
    BudShell.tsx                     — [変更] サイドバーメニューに「振込管理」追加
```

---

## Task 1: StatusBadge と状態ヘルパー

**Files:**
- Create: `src/app/bud/transfers/_components/StatusBadge.tsx`
- Create: `src/app/bud/transfers/_lib/status-display.ts`
- Test: `src/app/bud/transfers/_lib/__tests__/status-display.test.ts`

### Step 1: ヘルパーのテスト

- [ ] Create `src/app/bud/transfers/_lib/__tests__/status-display.test.ts` with:

```typescript
import { describe, it, expect } from "vitest";
import {
  getStatusColor,
  getStatusOrder,
  isTerminalStatus,
} from "../status-display";

describe("getStatusColor", () => {
  it("下書き → gray", () => {
    expect(getStatusColor("下書き")).toBe("gray");
  });
  it("確認済み → blue", () => {
    expect(getStatusColor("確認済み")).toBe("blue");
  });
  it("承認待ち → yellow", () => {
    expect(getStatusColor("承認待ち")).toBe("yellow");
  });
  it("承認済み → emerald", () => {
    expect(getStatusColor("承認済み")).toBe("emerald");
  });
  it("CSV出力済み → indigo", () => {
    expect(getStatusColor("CSV出力済み")).toBe("indigo");
  });
  it("振込完了 → green", () => {
    expect(getStatusColor("振込完了")).toBe("green");
  });
  it("差戻し → red", () => {
    expect(getStatusColor("差戻し")).toBe("red");
  });
});

describe("getStatusOrder", () => {
  it("進行順に番号を返す", () => {
    expect(getStatusOrder("下書き")).toBe(1);
    expect(getStatusOrder("確認済み")).toBe(2);
    expect(getStatusOrder("承認待ち")).toBe(3);
    expect(getStatusOrder("承認済み")).toBe(4);
    expect(getStatusOrder("CSV出力済み")).toBe(5);
    expect(getStatusOrder("振込完了")).toBe(6);
    expect(getStatusOrder("差戻し")).toBe(0);
  });
});

describe("isTerminalStatus", () => {
  it("振込完了は terminal", () => {
    expect(isTerminalStatus("振込完了")).toBe(true);
  });
  it("他のステータスは non-terminal", () => {
    expect(isTerminalStatus("下書き")).toBe(false);
    expect(isTerminalStatus("差戻し")).toBe(false);
  });
});
```

### Step 2: テスト失敗確認

- [ ] Run: `cd C:/garden/b-main/.claude/worktrees/romantic-robinson-657015 && npm test -- status-display`
- [ ] Expected: FAIL（モジュール未存在）

### Step 3: ヘルパー実装

- [ ] Create `src/app/bud/transfers/_lib/status-display.ts` with:

```typescript
/**
 * Garden-Bud / 振込ステータスの表示補助
 *
 * ステータスごとの色分け・進行順・終端判定。
 * UI での見た目統一のため純関数として切り出し。
 */

import type { TransferStatus } from "../../_constants/transfer-status";

/** Tailwind の色名（bg-{color}-100 text-{color}-800 等で使う） */
export type StatusColor =
  | "gray"
  | "blue"
  | "yellow"
  | "emerald"
  | "indigo"
  | "green"
  | "red";

const STATUS_COLOR_MAP: Record<TransferStatus, StatusColor> = {
  下書き: "gray",
  確認済み: "blue",
  承認待ち: "yellow",
  承認済み: "emerald",
  CSV出力済み: "indigo",
  振込完了: "green",
  差戻し: "red",
};

export function getStatusColor(status: TransferStatus): StatusColor {
  return STATUS_COLOR_MAP[status];
}

const STATUS_ORDER_MAP: Record<TransferStatus, number> = {
  下書き: 1,
  確認済み: 2,
  承認待ち: 3,
  承認済み: 4,
  CSV出力済み: 5,
  振込完了: 6,
  差戻し: 0, // 正規フローから外れる
};

export function getStatusOrder(status: TransferStatus): number {
  return STATUS_ORDER_MAP[status];
}

export function isTerminalStatus(status: TransferStatus): boolean {
  return status === "振込完了";
}
```

### Step 4: テスト通過

- [ ] Run: `npm test -- status-display`
- [ ] Expected: 11 tests PASS

### Step 5: StatusBadge コンポーネント

- [ ] Create `src/app/bud/transfers/_components/StatusBadge.tsx` with:

```tsx
import type { TransferStatus } from "../../_constants/transfer-status";
import { getStatusColor } from "../_lib/status-display";

interface StatusBadgeProps {
  status: TransferStatus;
  size?: "sm" | "md";
}

const SIZE_CLASSES = {
  sm: "text-xs px-2 py-0.5",
  md: "text-sm px-3 py-1",
};

const COLOR_CLASSES = {
  gray: "bg-gray-100 text-gray-700 border-gray-300",
  blue: "bg-blue-100 text-blue-800 border-blue-300",
  yellow: "bg-yellow-100 text-yellow-800 border-yellow-300",
  emerald: "bg-emerald-100 text-emerald-800 border-emerald-300",
  indigo: "bg-indigo-100 text-indigo-800 border-indigo-300",
  green: "bg-green-100 text-green-800 border-green-300",
  red: "bg-red-100 text-red-800 border-red-300",
} as const;

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const color = getStatusColor(status);
  return (
    <span
      className={`inline-flex items-center border rounded-full font-medium ${SIZE_CLASSES[size]} ${COLOR_CLASSES[color]}`}
    >
      {status}
    </span>
  );
}
```

### Step 6: 型チェック + Commit

- [ ] Run: `npx tsc --noEmit`
- [ ] Expected: clean
- [ ] Commit:

```bash
git add src/app/bud/transfers/
git commit -m "feat(bud): StatusBadge コンポーネントとステータス表示ヘルパーを追加"
```

---

## Task 2: FilterBar コンポーネント

**Files:**
- Create: `src/app/bud/transfers/_components/FilterBar.tsx`

### Step 1: 実装

- [ ] Create `src/app/bud/transfers/_components/FilterBar.tsx` with:

```tsx
"use client";

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
      <div className="flex flex-wrap gap-3 items-end">
        {/* 振込種別 */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            振込種別
          </label>
          <select
            value={currentFilter.category ?? ""}
            onChange={(e) => updateParam("category", e.target.value || null)}
            className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 bg-white min-w-[140px]"
          >
            <option value="">すべて</option>
            <option value="regular">通常振込（FK-）</option>
            <option value="cashback">キャッシュバック（CB-）</option>
          </select>
        </div>

        {/* ステータス（単一選択） */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            ステータス
          </label>
          <select
            value={currentFilter.statuses?.[0] ?? ""}
            onChange={(e) => updateParam("status", e.target.value || null)}
            className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 bg-white min-w-[140px]"
          >
            <option value="">すべて</option>
            {TRANSFER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* 実行会社 */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            実行会社
          </label>
          <select
            value={currentFilter.execute_company_id ?? ""}
            onChange={(e) =>
              updateParam("execute_company_id", e.target.value || null)
            }
            className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 bg-white min-w-[180px]"
          >
            <option value="">すべて</option>
            {companies.map((c) => (
              <option key={c.company_id} value={c.company_id}>
                {c.company_name}
              </option>
            ))}
          </select>
        </div>

        {/* 検索 */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            検索（受取人名・備考）
          </label>
          <input
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
          />
        </div>

        {/* クリア */}
        <button
          type="button"
          onClick={() => router.push(pathname)}
          className="px-3 py-1 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
        >
          クリア
        </button>
      </div>
    </div>
  );
}
```

### Step 2: 型チェック + Commit

- [ ] Run: `npx tsc --noEmit`
- [ ] Expected: clean
- [ ] Commit:

```bash
git add src/app/bud/transfers/_components/FilterBar.tsx
git commit -m "feat(bud): 振込一覧用フィルタバーコンポーネントを追加"
```

---

## Task 3: 月別合計サマリコンポーネント

**Files:**
- Create: `src/app/bud/transfers/_components/MonthlySummary.tsx`

### Step 1: 実装

- [ ] Create `src/app/bud/transfers/_components/MonthlySummary.tsx` with:

```tsx
import type { BudTransfer } from "../../_constants/types";

interface MonthlySummaryProps {
  transfers: BudTransfer[];
}

function formatYen(n: number): string {
  return `¥${n.toLocaleString()}`;
}

export function MonthlySummary({ transfers }: MonthlySummaryProps) {
  const total = transfers.reduce((sum, t) => sum + t.amount, 0);
  const count = transfers.length;
  const pendingCount = transfers.filter(
    (t) => !["振込完了", "差戻し"].includes(t.status),
  ).length;

  return (
    <div className="grid grid-cols-3 gap-4 mb-4">
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="text-xs text-gray-500">件数</div>
        <div className="text-2xl font-bold text-gray-800">{count}</div>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="text-xs text-gray-500">合計金額</div>
        <div className="text-2xl font-bold text-gray-800">
          {formatYen(total)}
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="text-xs text-gray-500">処理中（未完了・未差戻し）</div>
        <div className="text-2xl font-bold text-amber-600">{pendingCount}</div>
      </div>
    </div>
  );
}
```

### Step 2: 型チェック + Commit

- [ ] Run: `npx tsc --noEmit`
- [ ] Commit:

```bash
git add src/app/bud/transfers/_components/MonthlySummary.tsx
git commit -m "feat(bud): 振込一覧の月別合計サマリコンポーネントを追加"
```

---

## Task 4: 振込一覧画面（/bud/transfers）

**Files:**
- Create: `src/app/bud/transfers/page.tsx`

Phase 0 の Bud ダッシュボードに倣い、`"use client"` + `BudGate` + `BudShell` パターンで実装。Server Components ではなく、Supabase クライアントの session 依存を扱いやすい Client で組む。

### Step 1: 一覧画面実装

- [ ] Create `src/app/bud/transfers/page.tsx` with:

```tsx
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
```

### Step 2: 型チェック + Commit

- [ ] Run: `npx tsc --noEmit`
- [ ] Commit:

```bash
git add src/app/bud/transfers/page.tsx
git commit -m "feat(bud): 振込一覧画面を追加（/bud/transfers）"
```

---

## Task 5: 入力値バリデーション（TDD）

**Files:**
- Create: `src/app/bud/transfers/_lib/transfer-form-schema.ts`
- Test: `src/app/bud/transfers/_lib/__tests__/transfer-form-schema.test.ts`

### Step 1: テスト

- [ ] Create the test file with:

```typescript
import { describe, it, expect } from "vitest";
import { validateRegularForm, validateCashbackForm } from "../transfer-form-schema";

function makeRegularInput() {
  return {
    request_company_id: "COMP-001",
    execute_company_id: "COMP-001",
    source_account_id: "ACC-001",
    payee_name: "株式会社山田",
    payee_bank_code: "0001",
    payee_branch_code: "100",
    payee_account_type: "1",
    payee_account_number: "1234567",
    payee_account_holder_kana: "ヤマダ タロウ",
    amount: 10000,
    scheduled_date: "2026-04-25",
  };
}

describe("validateRegularForm", () => {
  it("正常なデータなら valid", () => {
    const r = validateRegularForm(makeRegularInput());
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual({});
  });

  it("payee_name が空ならエラー", () => {
    const r = validateRegularForm({ ...makeRegularInput(), payee_name: "" });
    expect(r.valid).toBe(false);
    expect(r.errors).toHaveProperty("payee_name");
  });

  it("amount が 0 以下ならエラー", () => {
    const r = validateRegularForm({ ...makeRegularInput(), amount: 0 });
    expect(r.valid).toBe(false);
    expect(r.errors).toHaveProperty("amount");
  });

  it("銀行コード 4 桁未満はエラー", () => {
    const r = validateRegularForm({ ...makeRegularInput(), payee_bank_code: "123" });
    expect(r.valid).toBe(false);
    expect(r.errors).toHaveProperty("payee_bank_code");
  });

  it("口座番号が 8 桁超はエラー", () => {
    const r = validateRegularForm({ ...makeRegularInput(), payee_account_number: "12345678" });
    expect(r.valid).toBe(false);
    expect(r.errors).toHaveProperty("payee_account_number");
  });

  it("支払期日未指定はエラー", () => {
    const r = validateRegularForm({ ...makeRegularInput(), scheduled_date: "" });
    expect(r.valid).toBe(false);
    expect(r.errors).toHaveProperty("scheduled_date");
  });
});

describe("validateCashbackForm", () => {
  function makeCashbackInput() {
    return {
      ...makeRegularInput(),
      cashback_applicant_name: "山田太郎",
      cashback_applicant_name_kana: "ヤマダ タロウ",
      cashback_product_name: "au光sonnet",
      cashback_channel_name: "DPリンク",
    };
  }

  it("正常なデータなら valid", () => {
    expect(validateCashbackForm(makeCashbackInput()).valid).toBe(true);
  });

  it("申込者名が空ならエラー", () => {
    const r = validateCashbackForm({
      ...makeCashbackInput(),
      cashback_applicant_name: "",
    });
    expect(r.valid).toBe(false);
    expect(r.errors).toHaveProperty("cashback_applicant_name");
  });

  it("商材名が空ならエラー", () => {
    const r = validateCashbackForm({
      ...makeCashbackInput(),
      cashback_product_name: "",
    });
    expect(r.valid).toBe(false);
  });
});
```

### Step 2: テスト失敗確認

- [ ] Run: `npm test -- transfer-form-schema`
- [ ] Expected: FAIL

### Step 3: 実装

- [ ] Create `src/app/bud/transfers/_lib/transfer-form-schema.ts` with:

```typescript
/**
 * Garden-Bud / 振込フォーム入力バリデーション
 *
 * クライアント側 UX のための事前バリデーション。
 * サーバー側の最終チェックは RLS と transfer-mutations で実施。
 */

export interface RegularFormInput {
  request_company_id: string;
  execute_company_id: string;
  source_account_id: string;
  vendor_id?: string | null;
  payee_name: string;
  payee_bank_code: string;
  payee_branch_code: string;
  payee_account_type: string;
  payee_account_number: string;
  payee_account_holder_kana: string;
  fee_bearer?: string | null;
  amount: number;
  description?: string | null;
  scheduled_date: string;
  due_date?: string | null;
  payee_mismatch_confirmed?: boolean;
  invoice_pdf_url?: string | null;
  scan_image_url?: string | null;
}

export interface CashbackFormInput extends RegularFormInput {
  cashback_applicant_name: string;
  cashback_applicant_name_kana: string;
  cashback_applicant_phone?: string | null;
  cashback_customer_id?: string | null;
  cashback_order_date?: string | null;
  cashback_opened_date?: string | null;
  cashback_product_name: string;
  cashback_channel_name: string;
  cashback_partner_code?: string | null;
}

export interface ValidationErrors {
  [field: string]: string;
}

export interface FormValidationResult {
  valid: boolean;
  errors: ValidationErrors;
}

function validateShared(input: RegularFormInput, errors: ValidationErrors): void {
  if (!input.request_company_id) errors.request_company_id = "依頼会社を選択してください";
  if (!input.execute_company_id) errors.execute_company_id = "実行会社を選択してください";
  if (!input.source_account_id) errors.source_account_id = "振込元口座を選択してください";
  if (!input.payee_name || input.payee_name.trim() === "")
    errors.payee_name = "お支払い先を入力してください";
  if (!/^\d{4}$/.test(input.payee_bank_code))
    errors.payee_bank_code = "銀行コードは 4 桁数字です";
  if (!/^\d{3}$/.test(input.payee_branch_code))
    errors.payee_branch_code = "支店コードは 3 桁数字です";
  if (!["1", "2", "4"].includes(input.payee_account_type))
    errors.payee_account_type = "預金種目を選択してください";
  if (!/^\d{1,7}$/.test(input.payee_account_number))
    errors.payee_account_number = "口座番号は 1〜7 桁数字です";
  if (!input.payee_account_holder_kana || input.payee_account_holder_kana.trim() === "")
    errors.payee_account_holder_kana = "口座名義カナを入力してください";
  if (!Number.isInteger(input.amount) || input.amount <= 0)
    errors.amount = "金額は 1 円以上の整数です";
  if (input.amount > 9_999_999_999)
    errors.amount = "金額が上限（9,999,999,999 円）を超えています";
  if (!input.scheduled_date)
    errors.scheduled_date = "支払期日（振込予定日）を選択してください";
}

export function validateRegularForm(input: RegularFormInput): FormValidationResult {
  const errors: ValidationErrors = {};
  validateShared(input, errors);
  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateCashbackForm(input: CashbackFormInput): FormValidationResult {
  const errors: ValidationErrors = {};
  validateShared(input, errors);
  if (!input.cashback_applicant_name || input.cashback_applicant_name.trim() === "")
    errors.cashback_applicant_name = "申込者名を入力してください";
  if (!input.cashback_applicant_name_kana || input.cashback_applicant_name_kana.trim() === "")
    errors.cashback_applicant_name_kana = "申込者名カナを入力してください";
  if (!input.cashback_product_name || input.cashback_product_name.trim() === "")
    errors.cashback_product_name = "商材名を入力してください";
  if (!input.cashback_channel_name || input.cashback_channel_name.trim() === "")
    errors.cashback_channel_name = "商流名を入力してください";
  return { valid: Object.keys(errors).length === 0, errors };
}
```

### Step 4: テスト通過

- [ ] Run: `npm test -- transfer-form-schema`
- [ ] Expected: 9 tests PASS

### Step 5: Commit

```bash
git add src/app/bud/transfers/_lib/transfer-form-schema.ts src/app/bud/transfers/_lib/__tests__/transfer-form-schema.test.ts
git commit -m "feat(bud): 振込フォーム入力バリデーションを追加"
```

---

## Task 6: 通常振込 新規作成画面 + フォームコンポーネント

**Files:**
- Create: `src/app/bud/transfers/new-regular/page.tsx`
- Create: `src/app/bud/transfers/_components/TransferFormRegular.tsx`
- Create: `src/app/bud/transfers/_components/KanaPreview.tsx`
- Create: `src/app/bud/transfers/_components/DuplicateWarning.tsx`

### Step 1: KanaPreview コンポーネント

- [ ] Create `src/app/bud/transfers/_components/KanaPreview.tsx` with:

```tsx
"use client";

import { toHalfWidthKana } from "@/lib/zengin";

interface KanaPreviewProps {
  rawInput: string;
}

export function KanaPreview({ rawInput }: KanaPreviewProps) {
  if (!rawInput.trim()) return null;
  const { kana, warnings } = toHalfWidthKana(rawInput);
  const tooLong = kana.length > 30;
  return (
    <div className="mt-1 text-xs">
      <div className="text-gray-600">
        変換結果 (半角 {kana.length}/30 桁):{" "}
        <span className={`font-mono ${tooLong ? "text-red-600" : "text-emerald-700"}`}>
          {kana || "(空)"}
        </span>
      </div>
      {warnings.length > 0 && (
        <div className="text-amber-600 mt-0.5">
          {warnings.join(" / ")}
        </div>
      )}
      {tooLong && (
        <div className="text-red-600 mt-0.5">30 桁を超えています</div>
      )}
    </div>
  );
}
```

### Step 2: DuplicateWarning コンポーネント

- [ ] Create `src/app/bud/transfers/_components/DuplicateWarning.tsx` with:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buildDuplicateKey } from "../../_lib/duplicate-key";
import { fetchTransferByDuplicateKey } from "../../_lib/transfer-queries";
import type { BudTransfer } from "../../_constants/types";

interface DuplicateWarningProps {
  scheduled_date: string | null;
  payee_bank_code: string;
  payee_branch_code: string;
  payee_account_number: string;
  amount: number;
}

export function DuplicateWarning(props: DuplicateWarningProps) {
  const [existing, setExisting] = useState<BudTransfer | null>(null);

  useEffect(() => {
    const key = buildDuplicateKey({
      scheduled_date: props.scheduled_date,
      payee_bank_code: props.payee_bank_code,
      payee_branch_code: props.payee_branch_code,
      payee_account_number: props.payee_account_number,
      amount: props.amount,
    });
    if (!key) {
      setExisting(null);
      return;
    }
    let cancelled = false;
    fetchTransferByDuplicateKey(key).then((r) => {
      if (!cancelled) setExisting(r);
    });
    return () => {
      cancelled = true;
    };
  }, [
    props.scheduled_date,
    props.payee_bank_code,
    props.payee_branch_code,
    props.payee_account_number,
    props.amount,
  ]);

  if (!existing) return null;

  return (
    <div className="bg-amber-50 border border-amber-300 rounded p-3 text-sm">
      <div className="font-medium text-amber-800">
        ⚠ 重複の可能性があります
      </div>
      <div className="text-amber-700 mt-1">
        同じ支払期日・振込先・金額の振込が既に存在します：
        <Link
          href={`/bud/transfers/${existing.transfer_id}`}
          className="underline ml-1 font-mono"
        >
          {existing.transfer_id}
        </Link>
      </div>
    </div>
  );
}
```

### Step 3: TransferFormRegular コンポーネント

- [ ] Create `src/app/bud/transfers/_components/TransferFormRegular.tsx` with:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTransferAction } from "../../_server-actions/transfer-actions";
import {
  validateRegularForm,
  type RegularFormInput,
  type ValidationErrors,
} from "../_lib/transfer-form-schema";
import { KanaPreview } from "./KanaPreview";
import { DuplicateWarning } from "./DuplicateWarning";

interface Option {
  id: string;
  label: string;
}

interface TransferFormRegularProps {
  companies: Option[];
  bankAccounts: Option[];
  vendors: Option[];
}

const INPUT_CLASS =
  "w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400";
const LABEL_CLASS = "block text-xs font-medium text-gray-700 mb-1";
const ERROR_CLASS = "text-xs text-red-600 mt-0.5";

export function TransferFormRegular({
  companies,
  bankAccounts,
  vendors,
}: TransferFormRegularProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [form, setForm] = useState<RegularFormInput>({
    request_company_id: "",
    execute_company_id: "",
    source_account_id: "",
    vendor_id: null,
    payee_name: "",
    payee_bank_code: "",
    payee_branch_code: "",
    payee_account_type: "1",
    payee_account_number: "",
    payee_account_holder_kana: "",
    fee_bearer: "当方負担",
    amount: 0,
    description: "",
    scheduled_date: "",
    due_date: null,
    payee_mismatch_confirmed: false,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setSubmitError(null);

    const result = validateRegularForm(form);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }

    setSubmitting(true);
    try {
      const r = await createTransferAction({
        ...form,
        transfer_category: "regular",
      });
      if (r.ok) {
        router.push(`/bud/transfers/${r.transfer_id}`);
      } else {
        setSubmitError(r.error);
      }
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const update = <K extends keyof RegularFormInput>(
    key: K,
    value: RegularFormInput[K],
  ) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-3xl">
      {submitError && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded p-3 text-sm">
          エラー: {submitError}
        </div>
      )}

      {/* 会社・口座 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL_CLASS}>依頼会社（費用計上先）*</label>
          <select
            className={INPUT_CLASS}
            value={form.request_company_id}
            onChange={(e) => update("request_company_id", e.target.value)}
          >
            <option value="">選択してください</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          {errors.request_company_id && <div className={ERROR_CLASS}>{errors.request_company_id}</div>}
        </div>
        <div>
          <label className={LABEL_CLASS}>実行会社（振込元）*</label>
          <select
            className={INPUT_CLASS}
            value={form.execute_company_id}
            onChange={(e) => update("execute_company_id", e.target.value)}
          >
            <option value="">選択してください</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          {errors.execute_company_id && <div className={ERROR_CLASS}>{errors.execute_company_id}</div>}
        </div>
      </div>

      <div>
        <label className={LABEL_CLASS}>振込元口座*</label>
        <select
          className={INPUT_CLASS}
          value={form.source_account_id}
          onChange={(e) => update("source_account_id", e.target.value)}
        >
          <option value="">選択してください</option>
          {bankAccounts.map((a) => (
            <option key={a.id} value={a.id}>{a.label}</option>
          ))}
        </select>
        {errors.source_account_id && <div className={ERROR_CLASS}>{errors.source_account_id}</div>}
      </div>

      {/* 受取人 */}
      <div>
        <label className={LABEL_CLASS}>お支払い先（会社名/個人名）*</label>
        <input
          type="text"
          className={INPUT_CLASS}
          value={form.payee_name}
          onChange={(e) => update("payee_name", e.target.value)}
        />
        {errors.payee_name && <div className={ERROR_CLASS}>{errors.payee_name}</div>}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={LABEL_CLASS}>取引先マスタ（任意）</label>
          <select
            className={INPUT_CLASS}
            value={form.vendor_id ?? ""}
            onChange={(e) => update("vendor_id", e.target.value || null)}
          >
            <option value="">選択しない</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL_CLASS}>手数料負担</label>
          <select
            className={INPUT_CLASS}
            value={form.fee_bearer ?? "当方負担"}
            onChange={(e) => update("fee_bearer", e.target.value)}
          >
            <option value="当方負担">当方負担</option>
            <option value="先方負担">先方負担</option>
          </select>
        </div>
      </div>

      {/* 振込先口座 */}
      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className={LABEL_CLASS}>銀行コード*</label>
          <input
            type="text"
            maxLength={4}
            className={INPUT_CLASS}
            value={form.payee_bank_code}
            onChange={(e) => update("payee_bank_code", e.target.value)}
          />
          {errors.payee_bank_code && <div className={ERROR_CLASS}>{errors.payee_bank_code}</div>}
        </div>
        <div>
          <label className={LABEL_CLASS}>支店コード*</label>
          <input
            type="text"
            maxLength={3}
            className={INPUT_CLASS}
            value={form.payee_branch_code}
            onChange={(e) => update("payee_branch_code", e.target.value)}
          />
          {errors.payee_branch_code && <div className={ERROR_CLASS}>{errors.payee_branch_code}</div>}
        </div>
        <div>
          <label className={LABEL_CLASS}>種別*</label>
          <select
            className={INPUT_CLASS}
            value={form.payee_account_type}
            onChange={(e) => update("payee_account_type", e.target.value)}
          >
            <option value="1">普通</option>
            <option value="2">当座</option>
            <option value="4">貯蓄</option>
          </select>
        </div>
        <div>
          <label className={LABEL_CLASS}>口座番号*</label>
          <input
            type="text"
            maxLength={7}
            className={INPUT_CLASS}
            value={form.payee_account_number}
            onChange={(e) => update("payee_account_number", e.target.value)}
          />
          {errors.payee_account_number && <div className={ERROR_CLASS}>{errors.payee_account_number}</div>}
        </div>
      </div>

      <div>
        <label className={LABEL_CLASS}>口座名義カナ*</label>
        <input
          type="text"
          className={INPUT_CLASS}
          value={form.payee_account_holder_kana}
          onChange={(e) => update("payee_account_holder_kana", e.target.value)}
          placeholder="ヤマダ タロウ / 株式会社でも自動で半角変換します"
        />
        {errors.payee_account_holder_kana && <div className={ERROR_CLASS}>{errors.payee_account_holder_kana}</div>}
        <KanaPreview rawInput={form.payee_account_holder_kana} />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="payee_mismatch_confirmed"
          checked={form.payee_mismatch_confirmed ?? false}
          onChange={(e) => update("payee_mismatch_confirmed", e.target.checked)}
        />
        <label htmlFor="payee_mismatch_confirmed" className="text-sm text-gray-700">
          お支払い先名と口座名義カナが別人でも確認済み
        </label>
      </div>

      {/* 金額・日付 */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={LABEL_CLASS}>金額*</label>
          <input
            type="number"
            className={INPUT_CLASS}
            value={form.amount || ""}
            onChange={(e) => update("amount", parseInt(e.target.value || "0", 10))}
          />
          {errors.amount && <div className={ERROR_CLASS}>{errors.amount}</div>}
        </div>
        <div>
          <label className={LABEL_CLASS}>支払期日（振込予定日）*</label>
          <input
            type="date"
            className={INPUT_CLASS}
            value={form.scheduled_date}
            onChange={(e) => update("scheduled_date", e.target.value)}
          />
          {errors.scheduled_date && <div className={ERROR_CLASS}>{errors.scheduled_date}</div>}
        </div>
        <div>
          <label className={LABEL_CLASS}>請求期日</label>
          <input
            type="date"
            className={INPUT_CLASS}
            value={form.due_date ?? ""}
            onChange={(e) => update("due_date", e.target.value || null)}
          />
        </div>
      </div>

      {/* 重複警告 */}
      <DuplicateWarning
        scheduled_date={form.scheduled_date || null}
        payee_bank_code={form.payee_bank_code}
        payee_branch_code={form.payee_branch_code}
        payee_account_number={form.payee_account_number}
        amount={form.amount}
      />

      {/* 備考 */}
      <div>
        <label className={LABEL_CLASS}>備考</label>
        <textarea
          rows={2}
          className={INPUT_CLASS}
          value={form.description ?? ""}
          onChange={(e) => update("description", e.target.value)}
        />
      </div>

      {/* 送信 */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
        >
          {submitting ? "作成中..." : "下書き保存"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}
```

### Step 4: 新規作成 page.tsx

- [ ] Create `src/app/bud/transfers/new-regular/page.tsx` with:

```tsx
"use client";

import { useEffect, useState } from "react";
import { BudGate } from "../../_components/BudGate";
import { BudShell } from "../../_components/BudShell";
import { useBudState } from "../../_state/BudStateContext";
import { supabase } from "../../_lib/supabase";
import { TransferFormRegular } from "../_components/TransferFormRegular";

interface Row {
  id: string;
  label: string;
}

function NewRegularContent() {
  const { sessionUser } = useBudState();
  const [companies, setCompanies] = useState<Row[]>([]);
  const [bankAccounts, setBankAccounts] = useState<Row[]>([]);
  const [vendors, setVendors] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [c, b, v] = await Promise.all([
        supabase.from("root_companies").select("company_id, company_name").order("company_id"),
        supabase.from("root_bank_accounts").select("account_id, bank_name, branch_name, account_number").order("account_id"),
        supabase.from("root_vendors").select("vendor_id, vendor_name").order("vendor_name"),
      ]);
      if (cancelled) return;
      setCompanies(
        (c.data ?? []).map((r) => ({ id: r.company_id, label: r.company_name })),
      );
      setBankAccounts(
        (b.data ?? []).map((r) => ({
          id: r.account_id,
          label: `${r.bank_name} / ${r.branch_name} / ${r.account_number}`,
        })),
      );
      setVendors(
        (v.data ?? []).map((r) => ({ id: r.vendor_id, label: r.vendor_name })),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!sessionUser) return null;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-800">通常振込 新規作成</h1>
        <p className="text-sm text-gray-500 mt-1">
          取引先への支払い振込を登録します。下書き保存後、確認 → 承認 → CSV 出力 → 振込完了 の順に進みます。
        </p>
      </div>

      {loading ? (
        <div className="text-gray-500">マスタデータ読み込み中...</div>
      ) : (
        <TransferFormRegular
          companies={companies}
          bankAccounts={bankAccounts}
          vendors={vendors}
        />
      )}
    </div>
  );
}

export default function NewRegularPage() {
  return (
    <BudGate>
      <BudShell>
        <NewRegularContent />
      </BudShell>
    </BudGate>
  );
}
```

### Step 5: 型チェック（未解決参照ありでOK、Task 8で server actions 実装）

- [ ] Run: `npx tsc --noEmit`
- [ ] Expected: `createTransferAction` 未定義エラー → Task 8 で解決する旨をコメント付きで commit

### Step 6: Commit（暫定）

```bash
git add src/app/bud/transfers/new-regular/ src/app/bud/transfers/_components/TransferFormRegular.tsx src/app/bud/transfers/_components/KanaPreview.tsx src/app/bud/transfers/_components/DuplicateWarning.tsx
git commit -m "feat(bud): 通常振込 新規作成画面とフォームコンポーネントを追加（Server Action 連携は Task 8）"
```

---

## Task 7: キャッシュバック 新規作成画面

**Files:**
- Create: `src/app/bud/transfers/_components/TransferFormCashback.tsx`
- Create: `src/app/bud/transfers/new-cashback/page.tsx`

### Step 1: TransferFormCashback コンポーネント

CB フォームは Regular の全項目に加え、申込者・商材・商流を追加する。実装は TransferFormRegular をほぼコピーして CB 固有フィールドを追加。

- [ ] Create `src/app/bud/transfers/_components/TransferFormCashback.tsx`:

  **内容**: TransferFormRegular.tsx と同じ構造だが、以下の差分を加える：

  1. 型を `CashbackFormInput` に変更
  2. バリデーションを `validateCashbackForm` に
  3. submit 時に `transfer_category: "cashback"` を設定
  4. 初期 state に CB 専用フィールドを含める：
     ```typescript
     cashback_applicant_name: "",
     cashback_applicant_name_kana: "",
     cashback_applicant_phone: null,
     cashback_customer_id: null,
     cashback_order_date: null,
     cashback_opened_date: null,
     cashback_product_name: "",
     cashback_channel_name: "",
     cashback_partner_code: null,
     ```
  5. 「申込者情報」セクションを金額セクションの前に追加：

     ```tsx
     <div className="border-t border-gray-200 pt-5">
       <h2 className="text-sm font-semibold text-gray-700 mb-3">申込者情報</h2>
       <div className="grid grid-cols-2 gap-4">
         <div>
           <label className={LABEL_CLASS}>申込者名*</label>
           <input type="text" className={INPUT_CLASS}
             value={form.cashback_applicant_name}
             onChange={(e) => update("cashback_applicant_name", e.target.value)} />
           {errors.cashback_applicant_name && <div className={ERROR_CLASS}>{errors.cashback_applicant_name}</div>}
         </div>
         <div>
           <label className={LABEL_CLASS}>申込者名カナ*</label>
           <input type="text" className={INPUT_CLASS}
             value={form.cashback_applicant_name_kana}
             onChange={(e) => update("cashback_applicant_name_kana", e.target.value)} />
         </div>
         <div>
           <label className={LABEL_CLASS}>電話番号</label>
           <input type="tel" className={INPUT_CLASS}
             value={form.cashback_applicant_phone ?? ""}
             onChange={(e) => update("cashback_applicant_phone", e.target.value || null)} />
         </div>
         <div>
           <label className={LABEL_CLASS}>顧客番号</label>
           <input type="text" className={INPUT_CLASS}
             value={form.cashback_customer_id ?? ""}
             onChange={(e) => update("cashback_customer_id", e.target.value || null)} />
         </div>
         <div>
           <label className={LABEL_CLASS}>受注日</label>
           <input type="date" className={INPUT_CLASS}
             value={form.cashback_order_date ?? ""}
             onChange={(e) => update("cashback_order_date", e.target.value || null)} />
         </div>
         <div>
           <label className={LABEL_CLASS}>開通日</label>
           <input type="date" className={INPUT_CLASS}
             value={form.cashback_opened_date ?? ""}
             onChange={(e) => update("cashback_opened_date", e.target.value || null)} />
         </div>
         <div>
           <label className={LABEL_CLASS}>商材名*</label>
           <input type="text" className={INPUT_CLASS}
             value={form.cashback_product_name}
             onChange={(e) => update("cashback_product_name", e.target.value)} />
           {errors.cashback_product_name && <div className={ERROR_CLASS}>{errors.cashback_product_name}</div>}
         </div>
         <div>
           <label className={LABEL_CLASS}>商流名*</label>
           <input type="text" className={INPUT_CLASS}
             value={form.cashback_channel_name}
             onChange={(e) => update("cashback_channel_name", e.target.value)} />
           {errors.cashback_channel_name && <div className={ERROR_CLASS}>{errors.cashback_channel_name}</div>}
         </div>
         <div>
           <label className={LABEL_CLASS}>パートナーコード</label>
           <input type="text" className={INPUT_CLASS}
             value={form.cashback_partner_code ?? ""}
             onChange={(e) => update("cashback_partner_code", e.target.value || null)} />
         </div>
       </div>
     </div>
     ```

  実装の都合上、TransferFormRegular.tsx の完全コピーをベースに、以下を変更する：
  - `import`: `CashbackFormInput`, `validateCashbackForm` に変更
  - `state`: CB 専用フィールドを初期化
  - `handleSubmit`: `transfer_category: "cashback"` + `validateCashbackForm(form)` 呼び出し
  - 「申込者情報」セクションを「金額・日付」の前に挿入
  - コンポーネント名を `TransferFormCashback` に変更

### Step 2: new-cashback/page.tsx を作成

- [ ] Create `src/app/bud/transfers/new-cashback/page.tsx`:

  TransferFormRegular の `page.tsx` と同じ構造。`<TransferFormCashback />` を render する。タイトルを「キャッシュバック 新規作成」に変更。

### Step 3: 型チェック + Commit（Server Actions 未解決含む）

```bash
git add src/app/bud/transfers/new-cashback/ src/app/bud/transfers/_components/TransferFormCashback.tsx
git commit -m "feat(bud): キャッシュバック 新規作成画面とフォームを追加"
```

---

## Task 8: Server Actions（createTransferAction 等）

**Files:**
- Create: `src/app/bud/_server-actions/transfer-actions.ts`

### Step 1: Server Actions 実装

- [ ] Create `src/app/bud/_server-actions/transfer-actions.ts` with:

```typescript
"use server";

import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createTransfer, updateTransferStatus, selfApproveAsSuperAdmin } from "../_lib/transfer-mutations";
import type { CreateTransferInput } from "../_lib/transfer-mutations";
import type { TransferStatus } from "../_constants/transfer-status";

// Server-side Supabase client は Service Role を使わず、Auth cookie を介した
// ユーザーコンテキスト付きで作る。RLS が正しく効く。
async function getSupabaseForUser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("sb-access-token")?.value;

  return createClient(url, anon, {
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  });
}

type ActionResult<T = undefined> =
  | { ok: true; transfer_id: string; data?: T }
  | { ok: false; error: string };

/**
 * 新規振込作成 Server Action。
 * クライアントからフォームを受け取り、RLS 付きの supabase クライアントで INSERT。
 */
export async function createTransferAction(
  input: CreateTransferInput,
): Promise<ActionResult> {
  try {
    const supabase = await getSupabaseForUser();
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      return { ok: false, error: "ログインが必要です" };
    }
    const userId = session.session.user.id;

    const created = await createTransfer(input, userId);
    return { ok: true, transfer_id: created.transfer_id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * ステータス遷移 Server Action。
 */
export async function updateStatusAction(params: {
  transfer_id: string;
  current_status: TransferStatus;
  next_status: TransferStatus;
  rejection_reason?: string;
}): Promise<ActionResult> {
  try {
    const supabase = await getSupabaseForUser();
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      return { ok: false, error: "ログインが必要です" };
    }
    const userId = session.session.user.id;

    await updateTransferStatus({
      transfer_id: params.transfer_id,
      current_status: params.current_status,
      next_status: params.next_status,
      actor_user_id: userId,
      rejection_reason: params.rejection_reason,
    });
    return { ok: true, transfer_id: params.transfer_id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * super_admin 自起票即承認 Server Action。
 */
export async function selfApproveAction(
  transferId: string,
): Promise<ActionResult> {
  try {
    const supabase = await getSupabaseForUser();
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      return { ok: false, error: "ログインが必要です" };
    }
    const userId = session.session.user.id;

    await selfApproveAsSuperAdmin(transferId, userId);
    return { ok: true, transfer_id: transferId };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
```

**重要**: transfer-mutations.ts のインポートは `../_lib/supabase` を使っているが、これはブラウザ専用 client。Server Action で使うと RLS 判定が auth.uid() にならないので、mutations を server-safe に refactor するか、server action 内で直接 supabase を呼ぶ必要がある。

→ 上記は暫定案。動作確認時に RLS が効かない場合は、transfer-mutations の各関数に `client: SupabaseClient` 引数を追加して DI する形に refactor する。この fallback は Task 11 の手動確認時に判断する。

### Step 2: 型チェック + Commit

- [ ] Run: `npx tsc --noEmit`
- [ ] Expected: no errors（全てのフォーム側の `createTransferAction` 参照が解決される）
- [ ] Commit:

```bash
git add src/app/bud/_server-actions/transfer-actions.ts
git commit -m "feat(bud): 振込 Server Actions を追加（作成・遷移・自承認）"
```

---

## Task 9: 振込詳細画面 + StatusActionButtons

**Files:**
- Create: `src/app/bud/transfers/[transfer_id]/page.tsx`
- Create: `src/app/bud/transfers/_components/StatusActionButtons.tsx`

### Step 1: StatusActionButtons

- [ ] Create `src/app/bud/transfers/_components/StatusActionButtons.tsx` with:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateStatusAction,
  selfApproveAction,
} from "../../_server-actions/transfer-actions";
import type { TransferStatus } from "../../_constants/transfer-status";
import type { GardenRole } from "@/app/root/_constants/types";

interface StatusActionButtonsProps {
  transferId: string;
  currentStatus: TransferStatus;
  createdBy: string;
  currentUserId: string;
  gardenRole: GardenRole;
}

export function StatusActionButtons({
  transferId,
  currentStatus,
  createdBy,
  currentUserId,
  gardenRole,
}: StatusActionButtonsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const isAdmin = gardenRole === "admin" || gardenRole === "super_admin";
  const isSuperAdmin = gardenRole === "super_admin";
  const isCreator = createdBy === currentUserId;

  async function act(next_status: TransferStatus, rejection_reason?: string) {
    setBusy(true);
    setError(null);
    const r = await updateStatusAction({
      transfer_id: transferId,
      current_status: currentStatus,
      next_status,
      rejection_reason,
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    router.refresh();
  }

  async function selfApprove() {
    setBusy(true);
    setError(null);
    const r = await selfApproveAction(transferId);
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    router.refresh();
  }

  const btn = "px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50";

  return (
    <div className="space-y-2">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded p-2 text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {/* 下書き */}
        {currentStatus === "下書き" && (
          <>
            {isAdmin && !isCreator && (
              <button className={`${btn} bg-blue-600 text-white hover:bg-blue-700`} disabled={busy}
                onClick={() => act("確認済み")}>
                確認済みへ
              </button>
            )}
            {isCreator && (
              <button className={`${btn} bg-blue-600 text-white hover:bg-blue-700`} disabled={busy}
                onClick={() => act("確認済み")}>
                確認済みへ
              </button>
            )}
            {isSuperAdmin && isCreator && (
              <button className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`} disabled={busy}
                onClick={selfApprove}>
                即承認（super_admin スキップ）
              </button>
            )}
          </>
        )}

        {/* 確認済み */}
        {currentStatus === "確認済み" && isAdmin && (
          <>
            <button className={`${btn} bg-yellow-500 text-white hover:bg-yellow-600`} disabled={busy}
              onClick={() => act("承認待ち")}>
              承認待ちへ
            </button>
            <button className={`${btn} bg-gray-500 text-white hover:bg-gray-600`} disabled={busy}
              onClick={() => act("下書き")}>
              下書きに戻す
            </button>
          </>
        )}

        {/* 承認待ち */}
        {currentStatus === "承認待ち" && isAdmin && (
          <>
            <button className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`} disabled={busy}
              onClick={() => act("承認済み")}>
              承認する
            </button>
            <button className={`${btn} bg-red-600 text-white hover:bg-red-700`} disabled={busy}
              onClick={() => setShowRejectModal(true)}>
              差戻し
            </button>
          </>
        )}

        {/* 承認済み */}
        {currentStatus === "承認済み" && isSuperAdmin && (
          <div className="text-sm text-gray-600">
            CSV 出力は <a href="/bud/transfers/csv-export" className="underline text-indigo-600">CSV 出力画面</a> から
          </div>
        )}

        {/* 差戻し */}
        {currentStatus === "差戻し" && isCreator && (
          <button className={`${btn} bg-blue-600 text-white hover:bg-blue-700`} disabled={busy}
            onClick={() => act("下書き")}>
            下書きに戻して修正
          </button>
        )}
      </div>

      {/* 差戻しモーダル */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-5 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">差戻し理由</h3>
            <textarea
              rows={4}
              className="w-full border border-gray-300 rounded p-2 text-sm text-gray-900 bg-white"
              placeholder="修正してほしい内容を記入"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex gap-2 mt-3 justify-end">
              <button className={`${btn} border border-gray-300 text-gray-700 hover:bg-gray-50`}
                onClick={() => { setShowRejectModal(false); setRejectReason(""); }}>
                キャンセル
              </button>
              <button className={`${btn} bg-red-600 text-white hover:bg-red-700`}
                disabled={busy || !rejectReason.trim()}
                onClick={async () => {
                  await act("差戻し", rejectReason);
                  setShowRejectModal(false);
                  setRejectReason("");
                }}>
                差戻す
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

### Step 2: 詳細 page.tsx

- [ ] Create `src/app/bud/transfers/[transfer_id]/page.tsx` with:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { BudGate } from "../../_components/BudGate";
import { BudShell } from "../../_components/BudShell";
import { useBudState } from "../../_state/BudStateContext";
import { fetchTransferById } from "../../_lib/transfer-queries";
import type { BudTransfer } from "../../_constants/types";
import { StatusBadge } from "../_components/StatusBadge";
import { StatusActionButtons } from "../_components/StatusActionButtons";

function formatYen(n: number): string {
  return `¥${n.toLocaleString()}`;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-gray-500 mb-0.5">{label}</dt>
      <dd className="text-sm text-gray-900">{value ?? "—"}</dd>
    </div>
  );
}

function DetailContent() {
  const params = useParams();
  const transferId = params?.transfer_id as string;
  const { sessionUser } = useBudState();
  const [transfer, setTransfer] = useState<BudTransfer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!transferId) return;
    let cancelled = false;
    setLoading(true);
    fetchTransferById(transferId)
      .then((t) => {
        if (!cancelled) setTransfer(t);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [transferId]);

  if (!sessionUser) return null;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-4">
        <Link href="/bud/transfers" className="text-sm text-emerald-600 hover:underline">
          ← 振込一覧に戻る
        </Link>
      </div>

      {loading ? (
        <div className="text-gray-500">読み込み中...</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded p-4">
          エラー: {error}
        </div>
      ) : !transfer ? (
        <div className="text-gray-500">振込が見つかりません: {transferId}</div>
      ) : (
        <>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                振込詳細 <span className="font-mono text-lg text-gray-500">{transfer.transfer_id}</span>
              </h1>
              <div className="mt-2">
                <StatusBadge status={transfer.status} />
                <span className="ml-2 text-xs text-gray-500">
                  {transfer.transfer_category === "regular" ? "通常振込" :
                   transfer.transfer_category === "cashback" ? "キャッシュバック" : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* ステータス操作 */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">ステータス操作</h2>
            <StatusActionButtons
              transferId={transfer.transfer_id}
              currentStatus={transfer.status}
              createdBy={transfer.created_by ?? ""}
              currentUserId={sessionUser.user_id}
              gardenRole={sessionUser.garden_role}
            />
          </div>

          {/* 基本情報 */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">基本情報</h2>
            <dl className="grid grid-cols-3 gap-4">
              <Field label="お支払い先" value={transfer.payee_name} />
              <Field label="振込金額" value={<span className="font-bold">{formatYen(transfer.amount)}</span>} />
              <Field label="手数料負担" value={transfer.fee_bearer} />
              <Field label="依頼会社" value={transfer.request_company_id} />
              <Field label="実行会社" value={transfer.execute_company_id} />
              <Field label="取引先" value={transfer.vendor_id} />
              <Field label="依頼日" value={transfer.request_date} />
              <Field label="支払期日（予定日）" value={transfer.scheduled_date} />
              <Field label="請求期日" value={transfer.due_date} />
              <Field label="備考" value={transfer.description} />
            </dl>
          </div>

          {/* 振込先口座 */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">振込先口座</h2>
            <dl className="grid grid-cols-3 gap-4">
              <Field label="銀行コード" value={transfer.payee_bank_code} />
              <Field label="支店コード" value={transfer.payee_branch_code} />
              <Field label="預金種目" value={transfer.payee_account_type} />
              <Field label="口座番号" value={transfer.payee_account_number} />
              <Field label="口座名義カナ" value={<span className="font-mono">{transfer.payee_account_holder_kana}</span>} />
              <Field label="受取人相違確認" value={transfer.payee_mismatch_confirmed ? "✔ 確認済み" : "—"} />
            </dl>
          </div>

          {/* キャッシュバック情報 */}
          {transfer.transfer_category === "cashback" && (
            <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">キャッシュバック情報</h2>
              <dl className="grid grid-cols-3 gap-4">
                <Field label="申込者名" value={transfer.cashback_applicant_name} />
                <Field label="申込者名カナ" value={transfer.cashback_applicant_name_kana} />
                <Field label="電話番号" value={transfer.cashback_applicant_phone} />
                <Field label="顧客番号" value={transfer.cashback_customer_id} />
                <Field label="受注日" value={transfer.cashback_order_date} />
                <Field label="開通日" value={transfer.cashback_opened_date} />
                <Field label="商材名" value={transfer.cashback_product_name} />
                <Field label="商流名" value={transfer.cashback_channel_name} />
                <Field label="パートナーコード" value={transfer.cashback_partner_code} />
              </dl>
            </div>
          )}

          {/* 承認履歴 */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">承認・実行履歴</h2>
            <dl className="grid grid-cols-2 gap-4">
              <Field label="起票者" value={transfer.created_by} />
              <Field label="起票日時" value={transfer.created_at} />
              <Field label="確認者" value={transfer.confirmed_by} />
              <Field label="確認日時" value={transfer.confirmed_at} />
              <Field label="承認者" value={transfer.approved_by} />
              <Field label="承認日時" value={transfer.approved_at} />
              <Field label="CSV出力者" value={transfer.csv_exported_by} />
              <Field label="CSV出力日時" value={transfer.csv_exported_at} />
              <Field label="振込実行者" value={transfer.executed_by} />
              <Field label="振込実行日" value={transfer.executed_date} />
              {transfer.rejection_reason && (
                <div className="col-span-2 bg-red-50 border border-red-200 rounded p-2">
                  <dt className="text-xs text-red-700 mb-0.5">差戻し理由</dt>
                  <dd className="text-sm text-red-900">{transfer.rejection_reason}</dd>
                </div>
              )}
            </dl>
          </div>
        </>
      )}
    </div>
  );
}

export default function TransferDetailPage() {
  return (
    <BudGate>
      <BudShell>
        <DetailContent />
      </BudShell>
    </BudGate>
  );
}
```

### Step 3: 型チェック + Commit

- [ ] Run: `npx tsc --noEmit`
- [ ] Expected: clean
- [ ] Commit:

```bash
git add src/app/bud/transfers/[transfer_id]/ src/app/bud/transfers/_components/StatusActionButtons.tsx
git commit -m "feat(bud): 振込詳細画面とステータス遷移ボタンを追加"
```

---

## Task 10: CSV 出力画面（super_admin 専用）

**Files:**
- Create: `src/app/bud/transfers/csv-export/page.tsx`
- Create: `src/app/bud/_server-actions/csv-export-action.ts`

### Step 1: CSV 出力 Server Action

- [ ] Create `src/app/bud/_server-actions/csv-export-action.ts` with:

```typescript
"use server";

import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import {
  generateZenginCsv,
  type ZenginTransferInput,
  type ZenginSourceAccount,
  type BankType,
} from "@/lib/zengin";

async function getSupabaseForUser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("sb-access-token")?.value;
  return createClient(url, anon, {
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  });
}

export async function exportCsvAction(params: {
  transfer_ids: string[];
  bank: BankType;
  source_account_id: string;
  transfer_date: string; // MMDD
}): Promise<
  | { ok: true; filename: string; base64: string; recordCount: number; totalAmount: number }
  | { ok: false; error: string }
> {
  try {
    const supabase = await getSupabaseForUser();

    // 1. 選択された振込を取得
    const { data: transfers, error: tErr } = await supabase
      .from("bud_transfers")
      .select("*")
      .in("transfer_id", params.transfer_ids)
      .eq("status", "承認済み");

    if (tErr) return { ok: false, error: `振込取得失敗: ${tErr.message}` };
    if (!transfers || transfers.length === 0) {
      return { ok: false, error: "承認済みの振込が選択されていません" };
    }

    // 2. 振込元口座情報を取得
    const { data: account, error: aErr } = await supabase
      .from("root_bank_accounts")
      .select("*")
      .eq("account_id", params.source_account_id)
      .single();

    if (aErr || !account) {
      return { ok: false, error: `振込元口座取得失敗: ${aErr?.message}` };
    }

    // 3. ZenginSourceAccount に変換
    const source: ZenginSourceAccount = {
      consignor_code: account.consignor_code ?? "0000000000",
      consignor_name: account.consignor_name_kana ?? "",
      transfer_date: params.transfer_date,
      source_bank_code: account.bank_code ?? "",
      source_bank_name: account.bank_name_kana ?? "",
      source_branch_code: account.branch_code ?? "",
      source_branch_name: account.branch_name_kana ?? "",
      source_account_type: (account.account_type ?? "1") as "1" | "2" | "4",
      source_account_number: account.account_number ?? "",
    };

    // 4. ZenginTransferInput に変換
    const zenginInputs: ZenginTransferInput[] = transfers.map((t) => ({
      payee_bank_code: t.payee_bank_code,
      payee_branch_code: t.payee_branch_code,
      payee_account_type: t.payee_account_type as "1" | "2" | "4",
      payee_account_number: t.payee_account_number,
      payee_account_holder_kana: t.payee_account_holder_kana,
      amount: t.amount,
      edi_info: t.description ?? undefined,
    }));

    // 5. CSV 生成
    const result = generateZenginCsv(zenginInputs, source, { bank: params.bank });

    // 6. 選択された振込のステータスを「CSV出力済み」に更新
    const now = new Date().toISOString();
    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user.id;

    await supabase
      .from("bud_transfers")
      .update({
        status: "CSV出力済み",
        csv_exported_by: userId,
        csv_exported_at: now,
      })
      .in("transfer_id", params.transfer_ids)
      .eq("status", "承認済み");

    return {
      ok: true,
      filename: result.filename,
      base64: result.content.toString("base64"),
      recordCount: result.recordCount,
      totalAmount: result.totalAmount,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
```

### Step 2: CSV 出力画面

- [ ] Create `src/app/bud/transfers/csv-export/page.tsx` with:

```tsx
"use client";

import { useEffect, useState } from "react";
import { BudGate } from "../../_components/BudGate";
import { BudShell } from "../../_components/BudShell";
import { useBudState } from "../../_state/BudStateContext";
import { supabase } from "../../_lib/supabase";
import { fetchTransferList } from "../../_lib/transfer-queries";
import type { BudTransfer } from "../../_constants/types";
import type { BankType } from "@/lib/zengin";
import { exportCsvAction } from "../../_server-actions/csv-export-action";

interface Account {
  account_id: string;
  bank_name: string;
  branch_name: string;
  account_number: string;
  bank_type: BankType | null;
}

function CsvExportContent() {
  const { sessionUser } = useBudState();
  const [transfers, setTransfers] = useState<BudTransfer[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [bank, setBank] = useState<BankType>("rakuten");
  const [transferDate, setTransferDate] = useState<string>(""); // MMDD
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [{ rows }, { data: accs }] = await Promise.all([
        fetchTransferList({ statuses: ["承認済み"], limit: 500 }),
        supabase.from("root_bank_accounts").select("*").order("account_id"),
      ]);
      setTransfers(rows);
      setAccounts((accs ?? []) as Account[]);
      setSelectedIds(new Set(rows.map((r) => r.transfer_id)));
      // 今日の MMDD
      const d = new Date();
      setTransferDate(
        String(d.getMonth() + 1).padStart(2, "0") +
          String(d.getDate()).padStart(2, "0"),
      );
    })();
  }, []);

  if (!sessionUser) return null;

  const isSuperAdmin = sessionUser.garden_role === "super_admin";
  if (!isSuperAdmin) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-800 rounded p-4">
          この画面は super_admin（東海林さん）のみ利用できます
        </div>
      </div>
    );
  }

  const selectedTransfers = transfers.filter((t) => selectedIds.has(t.transfer_id));
  const totalAmount = selectedTransfers.reduce((sum, t) => sum + t.amount, 0);

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleExport() {
    if (selectedIds.size === 0) {
      setError("振込を 1 件以上選択してください");
      return;
    }
    if (!selectedAccount) {
      setError("振込元口座を選択してください");
      return;
    }
    setSubmitting(true);
    setError(null);
    const r = await exportCsvAction({
      transfer_ids: Array.from(selectedIds),
      bank,
      source_account_id: selectedAccount,
      transfer_date: transferDate,
    });
    setSubmitting(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    // base64 → Blob → ダウンロード
    const bytes = Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = r.filename;
    a.click();
    URL.revokeObjectURL(url);
    alert(
      `CSV を出力しました。\nファイル: ${r.filename}\n件数: ${r.recordCount}\n合計: ¥${r.totalAmount.toLocaleString()}`,
    );
    // 再読込
    location.reload();
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800">CSV 出力（super_admin 専用）</h1>
      <p className="text-sm text-gray-500 mt-1 mb-4">
        承認済みの振込を選択し、銀行別の全銀協フォーマット CSV をダウンロードします。
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded p-3 text-sm mb-4">
          {error}
        </div>
      )}

      {/* 出力条件 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">銀行</label>
            <select
              value={bank}
              onChange={(e) => setBank(e.target.value as BankType)}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900 bg-white"
            >
              <option value="rakuten">楽天銀行</option>
              <option value="mizuho">みずほ銀行</option>
              <option value="paypay">PayPay 銀行</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">振込元口座</label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900 bg-white"
            >
              <option value="">選択してください</option>
              {accounts.map((a) => (
                <option key={a.account_id} value={a.account_id}>
                  {a.bank_name} / {a.branch_name} / {a.account_number}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              振込指定日（MMDD）
            </label>
            <input
              type="text"
              maxLength={4}
              value={transferDate}
              onChange={(e) => setTransferDate(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900 bg-white"
            />
          </div>
        </div>
      </div>

      {/* 承認済み振込一覧 */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs">
            <tr>
              <th className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={selectedIds.size === transfers.length && transfers.length > 0}
                  onChange={(e) =>
                    setSelectedIds(
                      e.target.checked
                        ? new Set(transfers.map((t) => t.transfer_id))
                        : new Set(),
                    )
                  }
                />
              </th>
              <th className="px-3 py-2 text-left">振込ID</th>
              <th className="px-3 py-2 text-left">お支払い先</th>
              <th className="px-3 py-2 text-right">金額</th>
              <th className="px-3 py-2 text-left">振込先</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-900">
            {transfers.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400">
                承認済みの振込がありません
              </td></tr>
            ) : (
              transfers.map((t) => (
                <tr key={t.transfer_id} className={selectedIds.has(t.transfer_id) ? "bg-emerald-50" : ""}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(t.transfer_id)}
                      onChange={() => toggle(t.transfer_id)}
                    />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{t.transfer_id}</td>
                  <td className="px-3 py-2">{t.payee_name}</td>
                  <td className="px-3 py-2 text-right font-medium">¥{t.amount.toLocaleString()}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {t.payee_bank_code}-{t.payee_branch_code}-{t.payee_account_number}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* サマリ & 実行 */}
      <div className="mt-4 flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="text-sm text-gray-700">
          選択中: <span className="font-bold">{selectedIds.size}</span> 件 / 合計 <span className="font-bold">¥{totalAmount.toLocaleString()}</span>
        </div>
        <button
          onClick={handleExport}
          disabled={submitting || selectedIds.size === 0 || !selectedAccount}
          className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {submitting ? "出力中..." : "CSV ダウンロード + ステータス更新"}
        </button>
      </div>
    </div>
  );
}

export default function CsvExportPage() {
  return (
    <BudGate>
      <BudShell>
        <CsvExportContent />
      </BudShell>
    </BudGate>
  );
}
```

### Step 3: 型チェック + Commit

- [ ] Run: `npx tsc --noEmit`
- [ ] Commit:

```bash
git add src/app/bud/transfers/csv-export/ src/app/bud/_server-actions/csv-export-action.ts
git commit -m "feat(bud): CSV 出力画面を追加（Phase 1a zengin ライブラリ連携）"
```

---

## Task 11: BudShell メニューに「振込管理」追加

**Files:**
- Modify: `src/app/bud/_components/BudShell.tsx`

### Step 1: BudShell を読んで構造確認

- [ ] Read `src/app/bud/_components/BudShell.tsx` to see current menu items

### Step 2: 「振込管理」メニューエントリを追加

BudShell のサイドバーメニュー配列に、`{ href: "/bud/transfers", label: "振込管理", icon: "💸" }` 等のエントリを追加する。既存の「ダッシュボード」等と同じパターンに従う。

### Step 3: Commit

```bash
git add src/app/bud/_components/BudShell.tsx
git commit -m "feat(bud): サイドバーメニューに「振込管理」を追加"
```

---

## Task 12: 手動動作確認手順書

**Files:**
- Create: `docs/superpowers/plans/2026-04-23-bud-phase-1b-manual-verification.md`

### Step 1: 手順書作成

- [ ] Create the file with manual test scenarios covering:
  - Login as 上田さん (admin) → 通常振込を起票 → 確認済みへ → 承認待ちへ
  - Login as 東海林さん (super_admin) → 上田さん起票の承認 → CSV 出力 → 振込完了マーク
  - Login as 東海林さん → 自分で起票 → 即承認（スキップ）ボタン検証
  - Login as 上田さん → 差戻し → 起票者が下書きに戻して修正再提出
  - Login as staff ユーザー → 下書き作成 → 編集 → 削除不可確認
  - 重複振込登録試行 → 警告表示確認
  - 受取人相違確認チェック → 確認なしで登録試行時の挙動
  - カナ自動変換プレビュー表示確認（漢字/ひらがな/全角カナ混在）
  - CSV 出力 → 生成された .csv / .txt の内容を確認（バイトダンプ、全銀協仕様との整合）
  - 銀行ネットバンキングへの取込テスト（Phase 1a verification doc 参照）

### Step 2: Commit

```bash
git add docs/superpowers/plans/2026-04-23-bud-phase-1b-manual-verification.md
git commit -m "docs(bud): Phase 1b 手動動作確認手順書を追加"
```

---

## Task 13: 工数実績記録

**Files:**
- Modify: `docs/effort-tracking.md`

### Step 1: Phase 1b.2 行を追加

- [ ] Edit `docs/effort-tracking.md` ログ表に:

```markdown
| 2026-04-23 | 2026-04-XX | Bud | Phase 1b.2 振込管理 UI | 1.4 | X.X | ±X.X | b-main (B) | Claude | 5画面（一覧/新規regular/新規cashback/詳細/CSV出力）＋Server Actions。手動動作確認は東海林さん側未実施。 |
```

### Step 2: Commit

```bash
git add docs/effort-tracking.md
git commit -m "docs(bud): Phase 1b.2 工数実績を記録"
```

---

## 完了チェックリスト

- [ ] Task 1: StatusBadge + 状態ヘルパー（11 tests）
- [ ] Task 2: FilterBar コンポーネント
- [ ] Task 3: MonthlySummary コンポーネント
- [ ] Task 4: 振込一覧画面
- [ ] Task 5: 入力バリデーション（9 tests）
- [ ] Task 6: 通常振込 新規作成画面＋フォーム
- [ ] Task 7: キャッシュバック 新規作成画面＋フォーム
- [ ] Task 8: Server Actions（createTransferAction 等）
- [ ] Task 9: 振込詳細画面＋StatusActionButtons
- [ ] Task 10: CSV 出力画面
- [ ] Task 11: BudShell メニュー追加
- [ ] Task 12: 手動動作確認手順書
- [ ] Task 13: 工数実績記録
- [ ] 全テスト緑（Phase 1a/1b.1 の既存 125 + 本Phase 追加約 20 = 約 145）
- [ ] TypeScript チェック通過
- [ ] `npm run lint` クリーン（警告は許容）

---

## 次の Phase

Phase 1b 全体完了後、**Phase 1c（Leaf 連携）** のプランを書く:
- 共通コンポーネント（CashbackApplicationButton / CashbackStatusViewer）
- Bud 側受け口 API
- 関電アプリへの組込み

その後 **Phase 2a（銀行明細取込）** へ。
