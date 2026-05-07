# Bloom Phase A-2 統合 KPI ダッシュボード Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bloom 内で Tree / Leaf / Bud / Forest 4 モジュールの KPI を横断表示する統合ダッシュボードを `/bloom/kpi` に新設する。

**Architecture:** Phase A-2 全体を 4 段階 (A-2.1 〜 A-2.4) に分割。本 plan は **Phase A-2.1（スケルトン UI + Forest 法人別売上推移の実データ統合）** のみを TDD 形式で完全実装する。後続 Phase A-2.2 (Tree)、A-2.3 (Bud)、A-2.4 (Leaf) は各モジュール側のデータ整備完了後に別 plan として起草する。

**Tech Stack:** Next.js 16.2.3 (App Router) / TypeScript / Supabase JS v2 / styled-jsx / Vitest（既存 Bloom テストパターン準拠）

**起草経緯:**
- dispatch main- No. 90（2026-05-07 18:46、a-main-013 → a-bloom-004）J 案修正版 GO の #2 として writing-plans skill 起動
- 既存実装調査結果（Explore subagent 報告、本 plan 末尾「調査サマリ」参照）から、Phase A-2.1 のみが「今すぐ実装可能」と判断
- a-root-002 認証統合（5/9-12）と並行で進められる「データ取得 + UI レイヤー」のみを対象

---

## Phase A-2 全体設計（high-level spec）

### A-2 の目的

後道さん（経営者）+ 槙さん（東海林さん相当）が **1 画面で全モジュールの健康状態を俯瞰** できるダッシュボード。Bloom が「業務全体の花を咲かせる役」（memory `project_garden_3layer_visual_model.md` 樹冠層）として、各モジュールの実データを統合表示する。

### A-2 を 4 段階に分割する理由

Explore 調査結果（2026-05-07 18:50 a-bloom-004 実施）:

| モジュール | KPI 実装状況 | 実データ取得 | A-2.X 着手可能時期 |
|---|---|---|---|
| **Forest** | 既存 dashboard あり、forest_corporations / forest_balance_sheets / forest_fiscal_periods 実在 | ✅ 今すぐ可能 | **A-2.1（本 plan）**|
| Tree | dashboard 既存だが全 mock、root_call_logs 等の架電ログ未実装 | ⏳ Tree 側 API 整備後 | A-2.2（Tree Phase D 完了後 = 5/13 以降）|
| Bud | dashboard プレースホルダーのみ、bud_transactions/bud_pl テーブル未確認 | ⏳ Bud Phase 1-3 順次 | A-2.3（Bud Phase 1 完了後 = 5/13 以降）|
| Leaf | Coming Soon のみ、商材別テーブル未実装 | ⏳ Leaf Phase B 完了後 | A-2.4（Leaf 関電実装完了後 = 5/13 以降）|

→ 5/13 統合テストまでに **A-2.1 のみ完成** = Bloom β投入時の最低限の見せ場。A-2.2-4 は post-デモで段階追加。

### Phase A-2.1 のスコープ（本 plan で実装）

1. `/bloom/kpi` 新規ルート + BloomShell ナビ追加
2. UnifiedKpiGrid component（4 モジュール KPI カードの grid layout）
3. **Forest KpiCard 実データ統合** = 法人別月次売上推移（forest_corporations + forest_balance_sheets から集計）
4. Tree / Bud / Leaf KpiCard は **「準備中」placeholder**（A-2.2-4 で実装予定の旨明示）
5. ローディング / エラー / 空データ 各 state の UI
6. dev mock 切替（DEV_MOCK_USER と同じパターン、`process.env.NODE_ENV === "development"`）
7. Vitest 単体テスト（forest-fetcher のロジック + UnifiedKpiGrid の render）

### Phase A-2.2-4 の方針（後続 plan で実装）

- A-2.2 Tree KPI: Tree 側で `/api/tree/kpi/monthly` 整備後、BloomKpi 側で fetch 連携
- A-2.3 Bud 損益: Bud Phase 1-3 で売上/原価/粗利テーブル完成後、月次 PL VIEW 経由で fetch
- A-2.4 Leaf 案件: Leaf 商材別テーブル完成後、商材横断 VIEW 経由で集計

---

## File Structure

新規作成・変更するファイル一覧（A-2.1 のみ、絶対パスは省略、リポジトリルート相対）:

| ファイル | 作成/変更 | 役割 |
|---|---|---|
| `src/app/bloom/kpi/page.tsx` | Create | `/bloom/kpi` のエントリポイント、UnifiedKpiGrid を render |
| `src/app/bloom/kpi/layout.tsx` | Create | metadata.title = "統合 KPI — Garden Bloom" |
| `src/app/bloom/kpi/_components/UnifiedKpiGrid.tsx` | Create | 4 モジュール KpiCard の grid 配置、各カードへのデータ受渡し |
| `src/app/bloom/kpi/_components/ForestKpiCard.tsx` | Create | Forest 法人別月次売上推移を表示（実データ統合）|
| `src/app/bloom/kpi/_components/PlaceholderKpiCard.tsx` | Create | Tree / Bud / Leaf 用「準備中」カード（共通）|
| `src/app/bloom/kpi/_lib/forest-fetcher.ts` | Create | forest_corporations + forest_balance_sheets から月次売上を集計、Supabase fetch |
| `src/app/bloom/kpi/_lib/types.ts` | Create | UnifiedKpiData / ForestMonthlyRevenue / KpiCardStatus 型定義 |
| `src/app/bloom/kpi/_lib/__tests__/forest-fetcher.test.ts` | Create | forest-fetcher のロジック単体テスト |
| `src/app/bloom/kpi/_components/__tests__/UnifiedKpiGrid.test.tsx` | Create | UnifiedKpiGrid の render テスト |
| `src/app/bloom/_components/BloomShell.tsx` | Modify | NAV_ITEMS に `/bloom/kpi` 追加 |
| `src/app/bloom/_components/BloomSidebar.tsx` | Modify | NAV_PAGES に `/bloom/kpi` 追加 |
| `src/app/bloom/_constants/routes.ts` | Modify | BLOOM_PATHS に `KPI: "/bloom/kpi"` 追加 |

**legacy 保持ルール（memory `feedback_no_delete_keep_legacy.md` 厳守）:**
- BloomShell / BloomSidebar / routes.ts は最小差分追加（既存項目変更なし）= legacy 保持不要
- 新規ファイルのみ create、既存削除・破壊なし

---

## Tasks

### Task 1: 型定義

**Files:**
- Create: `src/app/bloom/kpi/_lib/types.ts`

- [ ] **Step 1: types.ts 作成**

```typescript
/**
 * Bloom Phase A-2 統合 KPI ダッシュボード 型定義
 *
 * dispatch main- No. 90 (2026-05-07) writing-plans plan §Task 1 実装
 */

export type KpiCardStatus = "loading" | "ready" | "error" | "placeholder";

export type ForestMonthlyRevenue = {
  /** 法人 ID (forest_corporations.id) */
  corporation_id: string;
  /** 法人名 (forest_corporations.name) */
  corporation_name: string;
  /** 年月 (YYYY-MM 形式) */
  year_month: string;
  /** 月次売上 (forest_balance_sheets.revenue 等から集計、円単位) */
  revenue: number;
};

export type ForestKpiData = {
  /** 直近 6 ヶ月の法人別月次売上 */
  monthly_revenues: ForestMonthlyRevenue[];
  /** データ取得元 ('supabase' or 'mock') */
  source: "supabase" | "mock";
  /** 取得時刻 ISO 8601 */
  fetched_at: string;
};

export type UnifiedKpiData = {
  forest: ForestKpiData | null;
  /** Tree / Bud / Leaf は Phase A-2.2-4 で実装、当面は null */
  tree: null;
  bud: null;
  leaf: null;
};
```

- [ ] **Step 2: TypeScript コンパイル確認**

Run: `npx tsc --noEmit src/app/bloom/kpi/_lib/types.ts`
Expected: エラーなし

- [ ] **Step 3: Commit**

```bash
git add src/app/bloom/kpi/_lib/types.ts
git commit -m "feat(bloom): Phase A-2.1 統合 KPI 型定義 (UnifiedKpiData / ForestMonthlyRevenue) [Task 1]"
```

---

### Task 2: forest-fetcher 単体テスト（先行 TDD）

**Files:**
- Create: `src/app/bloom/kpi/_lib/__tests__/forest-fetcher.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchForestMonthlyRevenue, buildMockForestData } from "../forest-fetcher";

describe("buildMockForestData", () => {
  it("直近 6 ヶ月分の mock データを 2 法人分返す", () => {
    const data = buildMockForestData();
    expect(data.source).toBe("mock");
    expect(data.monthly_revenues).toHaveLength(12); // 2 法人 × 6 ヶ月
    const corpIds = new Set(data.monthly_revenues.map((r) => r.corporation_id));
    expect(corpIds.size).toBe(2);
  });

  it("各 month 値は YYYY-MM 形式", () => {
    const data = buildMockForestData();
    for (const r of data.monthly_revenues) {
      expect(r.year_month).toMatch(/^\d{4}-\d{2}$/);
    }
  });

  it("revenue は正の整数", () => {
    const data = buildMockForestData();
    for (const r of data.monthly_revenues) {
      expect(r.revenue).toBeGreaterThan(0);
      expect(Number.isInteger(r.revenue)).toBe(true);
    }
  });
});

describe("fetchForestMonthlyRevenue (dev mode)", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
  });

  it("dev mode では mock データを返す", async () => {
    const data = await fetchForestMonthlyRevenue();
    expect(data.source).toBe("mock");
    expect(data.monthly_revenues.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run src/app/bloom/kpi/_lib/__tests__/forest-fetcher.test.ts`
Expected: FAIL（forest-fetcher.ts が存在しない、または module not found）

- [ ] **Step 3: Commit（テストのみ、実装はまだ）**

```bash
git add src/app/bloom/kpi/_lib/__tests__/forest-fetcher.test.ts
git commit -m "test(bloom): Phase A-2.1 forest-fetcher 単体テスト先行 TDD [Task 2]"
```

---

### Task 3: forest-fetcher 実装（テストを通す）

**Files:**
- Create: `src/app/bloom/kpi/_lib/forest-fetcher.ts`

- [ ] **Step 1: 最小実装（mock + Supabase fetcher）**

```typescript
/**
 * Forest 法人別月次売上 fetcher
 *
 * Phase A-2.1 (dispatch main- No. 90, 2026-05-07) writing-plans plan §Task 3 実装
 *
 * - dev (NODE_ENV=development): buildMockForestData() で 2 法人 × 6 ヶ月の固定値返却
 * - 本番: Supabase forest_corporations + forest_balance_sheets から集計
 *
 * 注意: forest_balance_sheets のスキーマは a-forest-002 が B-min で整備中、
 *       本 fetcher は revenue カラムが直接ある前提で実装。実カラム名差異は
 *       Phase A-2.1 着手時に a-forest-002 と確認 (5/9 朝想定)。
 */

import { supabase } from "../../../bloom/_lib/supabase";
import type { ForestKpiData, ForestMonthlyRevenue } from "./types";

const MOCK_CORPORATIONS = [
  { id: "mock-corp-1", name: "株式会社ヒュアラン" },
  { id: "mock-corp-2", name: "ヒュアラングループ HD" },
];

export function buildMockForestData(): ForestKpiData {
  const now = new Date();
  const months: string[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push(ym);
  }

  const monthly_revenues: ForestMonthlyRevenue[] = [];
  for (const corp of MOCK_CORPORATIONS) {
    for (const ym of months) {
      // 月によって少し変動する mock 値 (8M-15M 円)
      const seed = ym.charCodeAt(5) + ym.charCodeAt(6) + corp.id.length;
      const revenue = 8_000_000 + (seed % 7) * 1_000_000;
      monthly_revenues.push({
        corporation_id: corp.id,
        corporation_name: corp.name,
        year_month: ym,
        revenue,
      });
    }
  }

  return {
    monthly_revenues,
    source: "mock",
    fetched_at: new Date().toISOString(),
  };
}

export async function fetchForestMonthlyRevenue(): Promise<ForestKpiData> {
  const isDev = process.env.NODE_ENV === "development";
  if (isDev) {
    return buildMockForestData();
  }

  // 本番: Supabase 経由で実データ取得
  // Phase A-2.1 着手時にスキーマ詳細を a-forest-002 と確認、適宜カラム名調整
  try {
    const { data, error } = await supabase
      .from("forest_corporations")
      .select("id, name, forest_balance_sheets!inner(year_month, revenue)")
      .order("name");

    if (error || !data) {
      // フォールバックで mock 返却（UI 側 source=mock を表示）
      return buildMockForestData();
    }

    const monthly_revenues: ForestMonthlyRevenue[] = [];
    for (const corp of data as Array<{
      id: string;
      name: string;
      forest_balance_sheets: Array<{ year_month: string; revenue: number }>;
    }>) {
      for (const bs of corp.forest_balance_sheets ?? []) {
        monthly_revenues.push({
          corporation_id: corp.id,
          corporation_name: corp.name,
          year_month: bs.year_month,
          revenue: bs.revenue,
        });
      }
    }

    return {
      monthly_revenues,
      source: "supabase",
      fetched_at: new Date().toISOString(),
    };
  } catch {
    return buildMockForestData();
  }
}
```

- [ ] **Step 2: テストを実行して PASS を確認**

Run: `npx vitest run src/app/bloom/kpi/_lib/__tests__/forest-fetcher.test.ts`
Expected: PASS（4 tests）

- [ ] **Step 3: Commit**

```bash
git add src/app/bloom/kpi/_lib/forest-fetcher.ts
git commit -m "feat(bloom): Phase A-2.1 forest-fetcher 実装 (dev mock + Supabase fetch) [Task 3]"
```

---

### Task 4: PlaceholderKpiCard 実装

**Files:**
- Create: `src/app/bloom/kpi/_components/PlaceholderKpiCard.tsx`

- [ ] **Step 1: 共通 placeholder カード実装**

```typescript
"use client";

/**
 * Tree / Bud / Leaf 用「準備中」KPI カード
 *
 * Phase A-2.1 (dispatch main- No. 90, 2026-05-07) writing-plans plan §Task 4 実装
 *
 * 各モジュールが Phase A-2.2-4 で実装するまでの暫定 UI。
 * モジュール名 + 実装予定時期 + 担当セッション名 + dispatch 番号を表示。
 */

import type { CSSProperties } from "react";

type Props = {
  moduleName: string;
  moduleNameJp: string;
  scheduledPhase: string;
  scheduledTime: string;
  dispatchRef?: string;
  icon?: string;
};

const cardStyle: CSSProperties = {
  position: "relative",
  background: "linear-gradient(135deg, rgba(120,100,70,0.08) 0%, rgba(212,165,65,0.05) 100%)",
  border: "1px dashed rgba(120,100,70,0.25)",
  borderRadius: 12,
  padding: "24px 20px",
  minHeight: 220,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  fontFamily: "var(--font-noto-serif-jp), system-ui, sans-serif",
  color: "#5c6e5f",
};

const titleStyle: CSSProperties = {
  fontFamily: "var(--font-cormorant), serif",
  fontSize: 18,
  fontWeight: 600,
  letterSpacing: "0.04em",
  color: "#3a2a1a",
  marginBottom: 4,
};

const jpStyle: CSSProperties = {
  fontFamily: "var(--font-shippori), serif",
  fontSize: 13,
  letterSpacing: "0.08em",
  color: "#7a8b7e",
  marginBottom: 16,
};

const labelStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.06em",
  color: "#9aa89d",
  marginTop: 8,
  fontStyle: "italic",
};

export function PlaceholderKpiCard({
  moduleName,
  moduleNameJp,
  scheduledPhase,
  scheduledTime,
  dispatchRef,
  icon,
}: Props) {
  return (
    <article style={cardStyle} data-testid={`kpi-placeholder-${moduleName.toLowerCase()}`}>
      {icon && <div style={{ fontSize: 32, marginBottom: 8 }}>{icon}</div>}
      <h3 style={titleStyle}>{moduleName}</h3>
      <p style={jpStyle}>{moduleNameJp}</p>
      <p style={{ fontSize: 12, color: "#5c6e5f", margin: 0 }}>
        実装予定: <strong>{scheduledPhase}</strong>
      </p>
      <p style={labelStyle}>{scheduledTime}</p>
      {dispatchRef && <p style={{ ...labelStyle, marginTop: 4 }}>{dispatchRef}</p>}
    </article>
  );
}
```

- [ ] **Step 2: TypeScript コンパイル確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: Commit**

```bash
git add src/app/bloom/kpi/_components/PlaceholderKpiCard.tsx
git commit -m "feat(bloom): Phase A-2.1 PlaceholderKpiCard (Tree/Bud/Leaf 準備中表示) [Task 4]"
```

---

### Task 5: ForestKpiCard 実装

**Files:**
- Create: `src/app/bloom/kpi/_components/ForestKpiCard.tsx`

- [ ] **Step 1: Forest 法人別月次売上カード実装**

```typescript
"use client";

/**
 * Forest 法人別月次売上 KPI カード
 *
 * Phase A-2.1 (dispatch main- No. 90, 2026-05-07) writing-plans plan §Task 5 実装
 *
 * forest_corporations + forest_balance_sheets から取得した直近 6 ヶ月の月次売上を、
 * 法人別に sparkline 形式で表示。
 */

import { useEffect, useState, type CSSProperties } from "react";
import type { ForestKpiData, ForestMonthlyRevenue } from "../_lib/types";
import { fetchForestMonthlyRevenue } from "../_lib/forest-fetcher";

const cardStyle: CSSProperties = {
  background: "linear-gradient(135deg, rgba(122,153,104,0.08) 0%, rgba(212,165,65,0.06) 100%)",
  border: "1px solid rgba(122,153,104,0.3)",
  borderRadius: 12,
  padding: "24px 20px",
  minHeight: 220,
  display: "flex",
  flexDirection: "column",
  fontFamily: "var(--font-noto-serif-jp), system-ui, sans-serif",
  color: "#3a2a1a",
};

const titleStyle: CSSProperties = {
  fontFamily: "var(--font-cormorant), serif",
  fontSize: 18,
  fontWeight: 600,
  letterSpacing: "0.04em",
  marginBottom: 2,
};

const jpStyle: CSSProperties = {
  fontFamily: "var(--font-shippori), serif",
  fontSize: 13,
  letterSpacing: "0.08em",
  color: "#7a8b7e",
  marginBottom: 14,
};

const sourceBadgeStyle = (source: "supabase" | "mock"): CSSProperties => ({
  display: "inline-block",
  fontSize: 10,
  padding: "2px 8px",
  borderRadius: 999,
  marginLeft: 8,
  background: source === "supabase" ? "rgba(31,92,58,0.12)" : "rgba(212,165,65,0.18)",
  color: source === "supabase" ? "#1f5c3a" : "#8a6c1d",
  letterSpacing: "0.06em",
});

function groupByCorporation(rows: ForestMonthlyRevenue[]): Map<string, ForestMonthlyRevenue[]> {
  const map = new Map<string, ForestMonthlyRevenue[]>();
  for (const row of rows) {
    const list = map.get(row.corporation_id) ?? [];
    list.push(row);
    map.set(row.corporation_id, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.year_month.localeCompare(b.year_month));
  }
  return map;
}

function formatYen(value: number): string {
  if (value >= 10_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${(value / 10_000).toFixed(0)}万`;
  return `${value.toLocaleString()}`;
}

export function ForestKpiCard() {
  const [data, setData] = useState<ForestKpiData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fetched = await fetchForestMonthlyRevenue();
        if (!cancelled) setData(fetched);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <article style={cardStyle} data-testid="kpi-forest-error">
        <h3 style={titleStyle}>Forest</h3>
        <p style={jpStyle}>全法人決算</p>
        <p style={{ color: "#c1121f", fontSize: 13 }}>⚠️ 取得失敗: {error}</p>
      </article>
    );
  }

  if (!data) {
    return (
      <article style={cardStyle} data-testid="kpi-forest-loading">
        <h3 style={titleStyle}>Forest</h3>
        <p style={jpStyle}>全法人決算</p>
        <p style={{ color: "#9aa89d", fontSize: 13, fontStyle: "italic" }}>読み込み中…</p>
      </article>
    );
  }

  const grouped = groupByCorporation(data.monthly_revenues);

  return (
    <article style={cardStyle} data-testid="kpi-forest-ready">
      <h3 style={titleStyle}>
        Forest
        <span style={sourceBadgeStyle(data.source)}>{data.source}</span>
      </h3>
      <p style={jpStyle}>全法人決算 — 直近 6 ヶ月 月次売上</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        {Array.from(grouped.entries()).map(([corpId, rows]) => {
          const latest = rows[rows.length - 1];
          return (
            <div key={corpId} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 13, color: "#4a4233" }}>{latest?.corporation_name ?? corpId}</span>
              <span style={{ fontFamily: "var(--font-eb-garamond), serif", fontSize: 16, fontWeight: 500, color: "#1f5c3a" }}>
                ¥{formatYen(latest?.revenue ?? 0)}
              </span>
            </div>
          );
        })}
      </div>
    </article>
  );
}
```

- [ ] **Step 2: TypeScript コンパイル確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: Commit**

```bash
git add src/app/bloom/kpi/_components/ForestKpiCard.tsx
git commit -m "feat(bloom): Phase A-2.1 ForestKpiCard (法人別月次売上、dev mock + Supabase fetch) [Task 5]"
```

---

### Task 6: UnifiedKpiGrid 実装 + テスト

**Files:**
- Create: `src/app/bloom/kpi/_components/UnifiedKpiGrid.tsx`
- Create: `src/app/bloom/kpi/_components/__tests__/UnifiedKpiGrid.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UnifiedKpiGrid } from "../UnifiedKpiGrid";

describe("UnifiedKpiGrid", () => {
  it("4 つの KPI カード (Forest 実データ + Tree/Bud/Leaf placeholder) を render する", () => {
    render(<UnifiedKpiGrid />);
    // Forest カード (loading or ready のいずれか必ず存在)
    const forestCard =
      screen.queryByTestId("kpi-forest-ready") ?? screen.queryByTestId("kpi-forest-loading");
    expect(forestCard).not.toBeNull();
    // Placeholder カード 3 件
    expect(screen.getByTestId("kpi-placeholder-tree")).toBeTruthy();
    expect(screen.getByTestId("kpi-placeholder-bud")).toBeTruthy();
    expect(screen.getByTestId("kpi-placeholder-leaf")).toBeTruthy();
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run src/app/bloom/kpi/_components/__tests__/UnifiedKpiGrid.test.tsx`
Expected: FAIL（UnifiedKpiGrid が存在しない）

- [ ] **Step 3: UnifiedKpiGrid 実装**

```typescript
"use client";

/**
 * Bloom Phase A-2 統合 KPI ダッシュボード grid layout
 *
 * Phase A-2.1 (dispatch main- No. 90, 2026-05-07) writing-plans plan §Task 6 実装
 *
 * 4 モジュールの KPI カードを 2x2 grid 配置:
 *   - Forest: 実データ統合 (forest_corporations + balance_sheets)
 *   - Tree / Bud / Leaf: Phase A-2.2-4 で実装、当面は PlaceholderKpiCard
 */

import { ForestKpiCard } from "./ForestKpiCard";
import { PlaceholderKpiCard } from "./PlaceholderKpiCard";

export function UnifiedKpiGrid() {
  return (
    <section
      aria-label="統合 KPI ダッシュボード"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: 18,
        padding: "24px 0",
      }}
    >
      <ForestKpiCard />
      <PlaceholderKpiCard
        moduleName="Tree"
        moduleNameJp="架電業務"
        scheduledPhase="Phase A-2.2"
        scheduledTime="5/13 以降 (Tree Phase D 完了後)"
        dispatchRef="dispatch main- No. 90 §Phase A-2.2"
        icon="🌳"
      />
      <PlaceholderKpiCard
        moduleName="Bud"
        moduleNameJp="経理・収支"
        scheduledPhase="Phase A-2.3"
        scheduledTime="5/13 以降 (Bud Phase 1 完了後)"
        dispatchRef="dispatch main- No. 90 §Phase A-2.3"
        icon="💰"
      />
      <PlaceholderKpiCard
        moduleName="Leaf"
        moduleNameJp="商材・案件"
        scheduledPhase="Phase A-2.4"
        scheduledTime="5/13 以降 (Leaf 関電実装完了後)"
        dispatchRef="dispatch main- No. 90 §Phase A-2.4"
        icon="🍃"
      />
    </section>
  );
}
```

- [ ] **Step 4: テストを実行して PASS を確認**

Run: `npx vitest run src/app/bloom/kpi/_components/__tests__/UnifiedKpiGrid.test.tsx`
Expected: PASS（1 test）

- [ ] **Step 5: Commit**

```bash
git add src/app/bloom/kpi/_components/UnifiedKpiGrid.tsx src/app/bloom/kpi/_components/__tests__/UnifiedKpiGrid.test.tsx
git commit -m "feat(bloom): Phase A-2.1 UnifiedKpiGrid (4 モジュール KPI grid) + テスト [Task 6]"
```

---

### Task 7: /bloom/kpi page + layout

**Files:**
- Create: `src/app/bloom/kpi/page.tsx`
- Create: `src/app/bloom/kpi/layout.tsx`

- [ ] **Step 1: layout.tsx 実装**

```typescript
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "統合 KPI — Garden Bloom",
  description: "Tree / Leaf / Bud / Forest 4 モジュールの KPI を横断表示する統合ダッシュボード",
};

export default function BloomKpiLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
```

- [ ] **Step 2: page.tsx 実装**

```typescript
"use client";

/**
 * /bloom/kpi — Bloom Phase A-2 統合 KPI ダッシュボード
 *
 * Phase A-2.1 (dispatch main- No. 90, 2026-05-07) writing-plans plan §Task 7 実装
 */

import { UnifiedKpiGrid } from "./_components/UnifiedKpiGrid";

export default function BloomKpiPage() {
  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 32px" }}>
      <header style={{ marginBottom: 18 }}>
        <h1
          style={{
            fontFamily: "var(--font-cormorant), serif",
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: "0.02em",
            color: "#1f5c3a",
            margin: 0,
          }}
        >
          🌸 統合 KPI ダッシュボード
        </h1>
        <p
          style={{
            fontFamily: "var(--font-shippori), serif",
            fontSize: 13,
            color: "#7a8b7e",
            marginTop: 6,
            letterSpacing: "0.06em",
          }}
        >
          Tree / Leaf / Bud / Forest 4 モジュールの KPI を 1 画面で俯瞰
        </p>
      </header>
      <UnifiedKpiGrid />
    </main>
  );
}
```

- [ ] **Step 3: dev server で 200 確認**

Run: `curl -s -o /dev/null -w "%{http_code} | /bloom/kpi\n" --max-time 60 http://localhost:3001/bloom/kpi`
Expected: `200 | /bloom/kpi`

- [ ] **Step 4: Commit**

```bash
git add src/app/bloom/kpi/page.tsx src/app/bloom/kpi/layout.tsx
git commit -m "feat(bloom): Phase A-2.1 /bloom/kpi page + layout [Task 7]"
```

---

### Task 8: BLOOM_PATHS / BloomShell / BloomSidebar に KPI ナビ追加

**Files:**
- Modify: `src/app/bloom/_constants/routes.ts`
- Modify: `src/app/bloom/_components/BloomShell.tsx`
- Modify: `src/app/bloom/_components/BloomSidebar.tsx`

- [ ] **Step 1: routes.ts に KPI 追加**

`src/app/bloom/_constants/routes.ts` の BLOOM_PATHS object に下記行を追加（既存 PROGRESS の下、UNIFIED_LOGIN の上）:

```typescript
  KPI: "/bloom/kpi",
```

- [ ] **Step 2: BloomShell の NAV_ITEMS に KPI 追加**

`src/app/bloom/_components/BloomShell.tsx` を Read して、NAV_ITEMS 配列の適切な位置（PROGRESS の後）に KPI エントリを追加:

```typescript
  { label: "統合 KPI", href: BLOOM_PATHS.KPI },
```

注: 既存項目の label 表記揺れに合わせる（既存が "ワークボード" 等の日本語なら "統合 KPI"、英語なら "Unified KPI"）。

- [ ] **Step 3: BloomSidebar の NAV_PAGES に KPI 追加**

`src/app/bloom/_components/BloomSidebar.tsx` の NAV_PAGES 配列に同様に追加。アイコン絵文字は 📊 推奨。

- [ ] **Step 4: dev server で /bloom (Workboard) → ナビに「統合 KPI」表示確認**

Run: `curl -s --max-time 30 http://localhost:3001/bloom | grep -oE "(統合 KPI|/bloom/kpi)" | head`
Expected: `統合 KPI` または `/bloom/kpi` 文字列含有

- [ ] **Step 5: Commit**

```bash
git add src/app/bloom/_constants/routes.ts src/app/bloom/_components/BloomShell.tsx src/app/bloom/_components/BloomSidebar.tsx
git commit -m "feat(bloom): Phase A-2.1 BLOOM_PATHS + BloomShell + BloomSidebar に KPI ナビ追加 [Task 8]"
```

---

### Task 9: Chrome MCP 視覚確認

**Files:**
- なし（dev server で動作確認のみ）

- [ ] **Step 1: Chrome MCP で /bloom/kpi にアクセス**

Run: `mcp__Claude_in_Chrome__navigate http://localhost:3001/bloom/kpi`

- [ ] **Step 2: screenshot 撮影 + 4 カード表示確認**

期待:
- 「🌸 統合 KPI ダッシュボード」見出し表示
- Forest カード: 「Forest」+ 「mock」バッジ + 2 法人の月次売上表示
- Tree / Bud / Leaf placeholder カード: 各「Phase A-2.X」+「5/13 以降」表示
- BloomShell ナビに「統合 KPI」が active 状態で表示

- [ ] **Step 3: regression なし確認**

Run: `curl -s -o /dev/null -w "%{http_code} | /bloom\n" --max-time 60 http://localhost:3001/bloom`
Run: `curl -s -o /dev/null -w "%{http_code} | /bloom/workboard\n" --max-time 60 http://localhost:3001/bloom/workboard`
Expected: 両方 200

- [ ] **Step 4: Commit (報告用、コード変更なし)**

```bash
git commit --allow-empty -m "test(bloom): Phase A-2.1 Chrome MCP 視覚確認完了 + regression check OK [Task 9]"
```

---

### Task 10: Phase A-2.1 完成 + 全 test green 最終確認

**Files:**
- なし（全 test 走行のみ）

- [ ] **Step 1: 全 vitest 走行**

Run: `npx vitest run src/app/bloom/kpi/`
Expected: 全 PASS（forest-fetcher.test.ts 4 + UnifiedKpiGrid.test.tsx 1 = 5 tests）

- [ ] **Step 2: TypeScript 全体コンパイル確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: 既存 Bloom テスト regression 確認**

Run: `npx vitest run src/app/bloom/`
Expected: 既存 tests + 新規 5 tests 全 PASS

- [ ] **Step 4: dispatch counter +1 + bloom-004- No. NN で完了報告**

```bash
echo "$(($(cat docs/dispatch-counter.txt) + 1))" > docs/dispatch-counter.txt
git add docs/dispatch-counter.txt
git commit -m "chore(bloom): Phase A-2.1 完成 + dispatch counter +1 [Task 10 final]"
git push origin feature/bloom-6screens-vercel-2026-05
```

別途 `docs/dispatch-bloom-004-no-NN-phase-a2-1-complete.md` を起草して a-main-013 へ報告。

---

## 調査サマリ（Explore subagent 報告、2026-05-07 18:50 a-bloom-004 実施）

各モジュールの KPI 実装状況・DB 実在性・Phase A-2.X 着手可能時期。本 plan の Phase 分割根拠。

| モジュール | 既存 KPI 実装 | DB スキーマ | Bloom 連携可否 | A-2.X |
|---|---|---|---|---|
| **Tree** | dashboard 既存だが全 mock、KPIHeader.tsx 存在 | root_employees / root_attendance_daily / root_kot_sync_log のみ実在、root_call_logs 未実装 | ⏳ Tree 側 API 整備後 | A-2.2（5/13 以降）|
| **Leaf** | Coming Soon のみ | 商材別テーブル未実装 | ⏳ Leaf Phase B 完了後 | A-2.4（5/13 以降）|
| **Bud** | dashboard プレースホルダー、BudStateContext 存在 | bud_transactions / bud_pl 未確認 | ⏳ Bud Phase 1-3 順次 | A-2.3（5/13 以降）|
| **Forest** | dashboard 実装中、SummaryCards / MacroChart 存在 | forest_corporations / forest_balance_sheets / forest_fiscal_periods 実在 | ✅ 今すぐ可能 | **A-2.1（本 plan）**|

**Bloom 既存 KPI**: BloomKpiGrid.tsx の 4 指標すべて mock、Supabase 連携は Phase 2-Step 5 予定。

---

## Self-Review チェック

1. **Spec coverage**: Phase A-2.1 の全 6 スコープ（ルート / nav / UnifiedKpiGrid / Forest 実データ / Tree-Bud-Leaf placeholder / dev mock / テスト）→ Task 1-10 で全カバー ✅
2. **Placeholder scan**: 各 step に完全なコード掲載済み、TBD/TODO なし ✅
3. **Type consistency**: ForestKpiData / ForestMonthlyRevenue / KpiCardStatus は Task 1 で定義 → Task 3, 5, 6 で同名・同形式で使用 ✅
4. **Dispatch ref consistency**: 全 task header コメントに `dispatch main- No. 90 (2026-05-07)` 統一参照 ✅

---

## Execution 選択肢

実行方式：
1. **Subagent-Driven**（推奨）: a-bloom-004 が fresh subagent per task で順次実行、task 間 review
2. **Inline Execution**: a-bloom-004 が直接 Task 1-10 を順次実行、checkpoint で push

dispatch main- No. 90 「ガンガンモード」+「苦戦時は明朝送り判断」整合 → **Inline Execution 推奨**（subagent dispatch の overhead < 直接実行）。実装着手は 5/8 朝（spec 起草で今夜は完走、5/8 朝に Task 1-10 着手）。

苦戦判断発動条件:
- vitest が想定外に失敗 → Task 単位で commit + 5/8 朝 続行判断
- TypeScript コンパイルエラーが解消困難 → 設計判断要なら停止 → bloom-004- No. NN で報告

---

## 後続 Phase A-2.2-4（高レベル方針、別 plan で詳細起草）

### Phase A-2.2 Tree KPI 統合（5/13 以降、Tree Phase D 完了後）
- Tree 側で `/api/tree/kpi/monthly` 整備（root_call_logs 等の架電ログ集計）
- BloomKpi 側で TreeKpiCard 実装、placeholder を実カード置換
- 想定 KPI: 架電数 / 成約率 / 稼働率 / リスト消化率

### Phase A-2.3 Bud 損益統合（5/13 以降、Bud Phase 1 完了後）
- Bud Phase 1-3 で売上/原価/粗利テーブル整備
- 月次 PL VIEW 経由で BloomKpi 側 fetch
- 想定 KPI: 売上 / 原価 / 粗利 / 営業利益 / 月次推移

### Phase A-2.4 Leaf 案件統合（5/13 以降、Leaf 関電実装完了後）
- Leaf 商材別テーブル（kanden / hikari / 等）整備
- 商材横断 VIEW 経由で BloomKpi 側 fetch
- 想定 KPI: 商材別案件数 / 月次トスアップ数 / 確定率
