# ShojiStatus MVP + cross-ui-01/06 Skeleton 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GW α 完走条件「`/login` + `/` + ShojiStatusWidget 稼働」を 1.0d（≒ 8h）で達成する。

**Architecture:**
- Track A：`bloom_ceo_status` 1 テーブル + Route Handler（GET/PUT）+ React Context (30s polling) + Widget/Editor/詳細画面
- Track B：cross-ui-01/06 spec の skeleton 実装（共通 Header / `/login` / `/` 9 アイコンホーム）
- 統合：`<ShojiStatusProvider>` を root layout に配置 → Header rightActions に compact widget 注入

**Tech Stack:** Next.js 16.2.3 (App Router) / React 19 / @supabase/ssr 0.10.2 / Supabase Auth (synthetic email) / Vitest 4.1.5 + React Testing Library + jsdom / Tailwind CSS v4

**ブランチ:** `feature/garden-common-ui-and-shoji-status`（既存、develop ベース）
**コミット規約:** 全コミットメッセージに `[a-bloom]` タグ含む。push は GitHub 復旧後（`push-plan-20260426-github-recovery.md` §8.3.2 順序）。

---

## Phase 0：前提確認（5 min）

### Task 0: root_employees PK 確認 + migration 微調整

**Files:**
- Read: `scripts/root-auth-schema.sql`
- Modify (作成前): plan 内の Task 1 SQL

- [ ] **Step 1: root_employees の PK 列名を確認**

```bash
grep -n "PRIMARY KEY\|CREATE TABLE root_employees\|ADD COLUMN IF NOT EXISTS user_id" scripts/root-auth-schema.sql scripts/root-schema*.sql
```

期待：`root_employees` 本体は別 schema、`user_id` は `auth.users(id)` への FK として後から追加されている。

- [ ] **Step 2: `bloom_ceo_status.updated_by` の参照先を `auth.users(id)` に確定**

理由：`root_employees.user_id` の UNIQUE 制約有無に依存しない、Supabase Auth 標準パターン。
表示名は JOIN で取得（`root_employees ON root_employees.user_id = bloom_ceo_status.updated_by`）。

---

## Phase 1：DB + API（Track A、約 2h）

### Task 1: migration 作成 + 適用

**Files:**
- Create: `scripts/bloom-ceo-status-schema.sql`

- [ ] **Step 1: migration ファイル作成**

```sql
-- scripts/bloom-ceo-status-schema.sql
-- 東海林さんの現在ステータスを保持する単一行テーブル
-- 関連 spec: docs/specs/bloom/spec-shoji-status-visibility.md

CREATE TABLE IF NOT EXISTS bloom_ceo_status (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status      text NOT NULL CHECK (status IN ('available','busy','focused','away')),
  summary     text CHECK (summary IS NULL OR length(summary) <= 200),
  updated_by  uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bloom_ceo_status_updated_at_idx
  ON bloom_ceo_status (updated_at DESC);

-- updated_at 自動更新 trigger
CREATE OR REPLACE FUNCTION bloom_ceo_status_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bloom_ceo_status_updated_at ON bloom_ceo_status;
CREATE TRIGGER bloom_ceo_status_updated_at
  BEFORE UPDATE ON bloom_ceo_status
  FOR EACH ROW EXECUTE FUNCTION bloom_ceo_status_set_updated_at();

-- RLS
ALTER TABLE bloom_ceo_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ceo_status_select_all ON bloom_ceo_status;
CREATE POLICY ceo_status_select_all
  ON bloom_ceo_status FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS ceo_status_update_super_admin ON bloom_ceo_status;
CREATE POLICY ceo_status_update_super_admin
  ON bloom_ceo_status FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM root_employees
      WHERE user_id = auth.uid()
        AND garden_role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM root_employees
      WHERE user_id = auth.uid()
        AND garden_role = 'super_admin'
    )
  );

-- INSERT/DELETE policy なし → 拒否（migration seed のみ）

-- 初期 seed（super_admin が 1 名以上いる前提）
INSERT INTO bloom_ceo_status (status, summary, updated_by)
SELECT 'available', '初期化', user_id
FROM root_employees
WHERE garden_role = 'super_admin'
  AND user_id IS NOT NULL
LIMIT 1
ON CONFLICT DO NOTHING;
```

- [ ] **Step 2: garden-dev に適用（東海林さん手動 or 私が SQL inline 提示で代行）**

memory `feedback_sql_inline_display` 準拠：上記 SQL をセッション内に表示済み、東海林さんが Supabase SQL Editor にコピペで適用。
適用後、以下で確認：

```sql
SELECT * FROM bloom_ceo_status;
-- 期待：1 行、status='available', summary='初期化'
```

- [ ] **Step 3: commit**

```bash
git add scripts/bloom-ceo-status-schema.sql
git commit -m "feat(bloom): [a-bloom] bloom_ceo_status migration (1 行運用 + RLS)"
```

---

### Task 2: GET /api/ceo-status の失敗テスト

**Files:**
- Create: `src/app/api/ceo-status/__tests__/route.test.ts`

- [ ] **Step 1: テストファイル作成**

```ts
// src/app/api/ceo-status/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// supabase ssr クライアントを mock
const mockFrom = vi.fn();
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    from: mockFrom,
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } }, error: null }) },
  })),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({ get: vi.fn(), set: vi.fn() })),
}));

import { GET } from "../route";

describe("GET /api/ceo-status", () => {
  beforeEach(() => { mockFrom.mockReset(); });

  it("returns 200 with status payload", async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        order: () => ({
          limit: () => ({
            maybeSingle: () => Promise.resolve({
              data: {
                status: "busy",
                summary: "Root Phase B",
                updated_at: "2026-04-26T05:00:00Z",
                updated_by: "u1",
              },
              error: null,
            }),
          }),
        }),
      }),
    });

    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe("busy");
    expect(body.summary).toBe("Root Phase B");
  });
});
```

- [ ] **Step 2: 失敗確認**

```bash
npm run test:run -- src/app/api/ceo-status
```
期待：FAIL（`route.ts` が存在しない）

---

### Task 3: GET /api/ceo-status 実装

**Files:**
- Create: `src/app/api/ceo-status/route.ts`

- [ ] **Step 1: 実装**

```ts
// src/app/api/ceo-status/route.ts
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getServerSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) { return cookieStore.get(name)?.value; },
        set() { /* Route Handler では no-op */ },
        remove() { /* no-op */ },
      },
    },
  );
}

export async function GET() {
  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from("bloom_ceo_status")
    .select("status, summary, updated_at, updated_by")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { status: "available", summary: null, updated_at: null, updated_by_name: null },
      { status: 200 },
    );
  }

  // updated_by_name を JOIN（別クエリ）
  let updated_by_name: string | null = null;
  if (data.updated_by) {
    const { data: emp } = await supabase
      .from("root_employees")
      .select("name")
      .eq("user_id", data.updated_by)
      .maybeSingle();
    updated_by_name = emp?.name ?? null;
  }

  return NextResponse.json({
    status: data.status,
    summary: data.summary,
    updated_at: data.updated_at,
    updated_by_name,
  });
}
```

- [ ] **Step 2: テスト pass 確認**

```bash
npm run test:run -- src/app/api/ceo-status
```
期待：1 test pass

- [ ] **Step 3: commit**

```bash
git add src/app/api/ceo-status/
git commit -m "feat(bloom): [a-bloom] GET /api/ceo-status (RLS server-side, JOIN root_employees)"
```

---

### Task 4: PUT /api/ceo-status の失敗テスト

**Files:**
- Modify: `src/app/api/ceo-status/__tests__/route.test.ts`

- [ ] **Step 1: テスト追加**

```ts
// 同ファイル末尾に追加
describe("PUT /api/ceo-status", () => {
  beforeEach(() => { mockFrom.mockReset(); });

  it("rejects non-super_admin with 403", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "root_employees") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({
                data: { garden_role: "manager" }, error: null,
              }),
            }),
          }),
        };
      }
      throw new Error("unexpected table " + table);
    });

    const { PUT } = await import("../route");
    const req = new Request("http://x/api/ceo-status", {
      method: "PUT",
      body: JSON.stringify({ status: "busy", summary: "test" }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(403);
  });

  it("rejects invalid status with 400", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "root_employees") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { garden_role: "super_admin" }, error: null }) }) }),
        };
      }
      throw new Error("unexpected");
    });

    const { PUT } = await import("../route");
    const req = new Request("http://x/api/ceo-status", {
      method: "PUT",
      body: JSON.stringify({ status: "invalid" }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it("rejects summary > 200 chars with 400", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "root_employees") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { garden_role: "super_admin" }, error: null }) }) }),
        };
      }
      throw new Error("unexpected");
    });

    const { PUT } = await import("../route");
    const req = new Request("http://x/api/ceo-status", {
      method: "PUT",
      body: JSON.stringify({ status: "busy", summary: "a".repeat(201) }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it("returns 200 on valid super_admin update", async () => {
    const updateMock = vi.fn(() => ({
      select: () => ({
        order: () => ({
          limit: () => ({
            maybeSingle: () => Promise.resolve({
              data: { status: "focused", summary: "updated", updated_at: "2026-04-26T06:00:00Z", updated_by: "u1" },
              error: null,
            }),
          }),
        }),
      }),
    }));

    mockFrom.mockImplementation((table: string) => {
      if (table === "root_employees") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: { garden_role: "super_admin", name: "東海林" }, error: null }),
            }),
          }),
        };
      }
      if (table === "bloom_ceo_status") {
        return {
          select: () => ({
            order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: { id: "row1" }, error: null }) }) }),
          }),
          update: updateMock,
        };
      }
      throw new Error("unexpected table " + table);
    });

    const { PUT } = await import("../route");
    const req = new Request("http://x/api/ceo-status", {
      method: "PUT",
      body: JSON.stringify({ status: "focused", summary: "updated" }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("focused");
  });
});
```

- [ ] **Step 2: 失敗確認**

```bash
npm run test:run -- src/app/api/ceo-status
```
期待：4 件中 GET 1 pass + PUT 4 件 FAIL（PUT 未実装）

---

### Task 5: PUT /api/ceo-status 実装

**Files:**
- Modify: `src/app/api/ceo-status/route.ts`

- [ ] **Step 1: PUT 実装を追加**

```ts
// src/app/api/ceo-status/route.ts に PUT を追加
const VALID_STATUS = new Set(["available", "busy", "focused", "away"] as const);
type CeoStatusKey = "available" | "busy" | "focused" | "away";

export async function PUT(req: Request) {
  const supabase = getServerSupabase();

  // 1. auth check
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  // 2. role check（Route Handler 側で二重防御。RLS は最終の砦）
  const { data: emp } = await supabase
    .from("root_employees")
    .select("garden_role")
    .eq("user_id", userId)
    .maybeSingle();
  if (emp?.garden_role !== "super_admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // 3. body parse + validate
  let body: { status?: string; summary?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.status || !VALID_STATUS.has(body.status as CeoStatusKey)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }
  if (body.summary != null && body.summary.length > 200) {
    return NextResponse.json({ error: "summary too long" }, { status: 400 });
  }

  // 4. 既存 row 取得（1 行運用）
  const { data: existing } = await supabase
    .from("bloom_ceo_status")
    .select("id")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!existing?.id) {
    return NextResponse.json({ error: "no row to update (run migration seed)" }, { status: 500 });
  }

  // 5. update
  const { data: updated, error: updateErr } = await supabase
    .from("bloom_ceo_status")
    .update({
      status: body.status,
      summary: body.summary ?? null,
      updated_by: userId,
    })
    .eq("id", existing.id)
    .select("status, summary, updated_at, updated_by")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // 6. updated_by_name JOIN
  const { data: empName } = await supabase
    .from("root_employees")
    .select("name")
    .eq("user_id", userId)
    .maybeSingle();

  return NextResponse.json({
    status: updated?.status,
    summary: updated?.summary,
    updated_at: updated?.updated_at,
    updated_by_name: empName?.name ?? null,
  });
}
```

- [ ] **Step 2: 全テスト pass 確認**

```bash
npm run test:run -- src/app/api/ceo-status
```
期待：5 件全 pass

- [ ] **Step 3: commit**

```bash
git add src/app/api/ceo-status/
git commit -m "feat(bloom): [a-bloom] PUT /api/ceo-status (super_admin only, validation)"
```

---

## Phase 2：ShojiStatus UI（Track A 後半、約 2h）

### Task 6: ShojiStatusContext + polling provider

**Files:**
- Create: `src/components/shared/ShojiStatusContext.tsx`

- [ ] **Step 1: Provider 実装**

```tsx
// src/components/shared/ShojiStatusContext.tsx
"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type CeoStatusKey = "available" | "busy" | "focused" | "away";
export type CeoStatus = {
  status: CeoStatusKey;
  summary: string | null;
  updated_at: string | null;
  updated_by_name: string | null;
};

const POLL_INTERVAL_MS = 30_000;

type ContextValue = {
  status: CeoStatus | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const ShojiStatusContext = createContext<ContextValue>({
  status: null,
  loading: false,
  error: null,
  refresh: async () => {},
});

export function ShojiStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<CeoStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/ceo-status", { cache: "no-store" });
      if (!res.ok) {
        // 401 (login 前) や 5xx は silent retry
        if (res.status !== 401) setError(`HTTP ${res.status}`);
        return;
      }
      const data = (await res.json()) as CeoStatus;
      setStatus(data);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      if (cancelled) return;
      await fetchStatus();
    };
    tick();
    const id = setInterval(tick, POLL_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <ShojiStatusContext.Provider value={{ status, loading, error, refresh: fetchStatus }}>
      {children}
    </ShojiStatusContext.Provider>
  );
}

export function useShojiStatus(): ContextValue {
  return useContext(ShojiStatusContext);
}
```

- [ ] **Step 2: commit**

```bash
git add src/components/shared/ShojiStatusContext.tsx
git commit -m "feat(bloom): [a-bloom] ShojiStatusContext (30s polling provider)"
```

---

### Task 7: 相対時刻フォーマッタ + テスト

**Files:**
- Create: `src/components/shared/_lib/formatRelativeTime.ts`
- Create: `src/components/shared/_lib/__tests__/formatRelativeTime.test.ts`

- [ ] **Step 1: 失敗テスト作成**

```ts
// src/components/shared/_lib/__tests__/formatRelativeTime.test.ts
import { describe, it, expect } from "vitest";
import { formatRelativeTime, isStale } from "../formatRelativeTime";

describe("formatRelativeTime", () => {
  const now = new Date("2026-04-26T10:00:00Z");

  it("returns '今' for < 1 min", () => {
    expect(formatRelativeTime("2026-04-26T09:59:30Z", now)).toBe("今");
  });
  it("returns 'N 分前' for < 1 hour", () => {
    expect(formatRelativeTime("2026-04-26T09:55:00Z", now)).toBe("5 分前");
  });
  it("returns 'N 時間前' for < 1 day", () => {
    expect(formatRelativeTime("2026-04-26T07:00:00Z", now)).toBe("3 時間前");
  });
  it("returns 'N 日前' for >= 1 day", () => {
    expect(formatRelativeTime("2026-04-25T10:00:00Z", now)).toBe("1 日前");
  });
  it("returns '不明' for null", () => {
    expect(formatRelativeTime(null, now)).toBe("不明");
  });
});

describe("isStale", () => {
  const now = new Date("2026-04-26T10:00:00Z");
  it("returns false for < 30 min old", () => {
    expect(isStale("2026-04-26T09:35:00Z", now)).toBe(false);
  });
  it("returns true for >= 30 min old", () => {
    expect(isStale("2026-04-26T09:25:00Z", now)).toBe(true);
  });
  it("returns true for null (unknown is stale)", () => {
    expect(isStale(null, now)).toBe(true);
  });
});
```

- [ ] **Step 2: 失敗確認**

```bash
npm run test:run -- src/components/shared/_lib
```
期待：FAIL（モジュール未存在）

- [ ] **Step 3: 実装**

```ts
// src/components/shared/_lib/formatRelativeTime.ts
export function formatRelativeTime(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "不明";
  const t = new Date(iso).getTime();
  const diffSec = Math.floor((now.getTime() - t) / 1000);
  if (diffSec < 60) return "今";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分前`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} 時間前`;
  return `${Math.floor(diffSec / 86400)} 日前`;
}

const STALE_MS = 30 * 60 * 1000;

export function isStale(iso: string | null, now: Date = new Date()): boolean {
  if (!iso) return true;
  return now.getTime() - new Date(iso).getTime() >= STALE_MS;
}
```

- [ ] **Step 4: テスト pass + commit**

```bash
npm run test:run -- src/components/shared/_lib
git add src/components/shared/_lib/
git commit -m "feat(bloom): [a-bloom] formatRelativeTime helper + tests (7 cases)"
```

---

### Task 8: ShojiStatusWidget（compact + full）

**Files:**
- Create: `src/components/shared/ShojiStatusWidget.tsx`
- Create: `src/components/shared/__tests__/ShojiStatusWidget.test.tsx`

- [ ] **Step 1: 失敗テスト作成**

```tsx
// src/components/shared/__tests__/ShojiStatusWidget.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ShojiStatusWidget } from "../ShojiStatusWidget";
import { ShojiStatusContext } from "../ShojiStatusContext";

function withCtx(ui: React.ReactNode, status: any) {
  return (
    <ShojiStatusContext.Provider value={{ status, loading: false, error: null, refresh: async () => {} }}>
      {ui}
    </ShojiStatusContext.Provider>
  );
}

describe("ShojiStatusWidget compact", () => {
  it("renders status icon + label + summary", () => {
    render(withCtx(<ShojiStatusWidget mode="compact" />, {
      status: "busy", summary: "Root Phase B", updated_at: new Date().toISOString(), updated_by_name: "東海林",
    }));
    expect(screen.getByText(/取り込み中/)).toBeInTheDocument();
    expect(screen.getByText(/Root Phase B/)).toBeInTheDocument();
  });
  it("renders 'メモなし' when summary is null", () => {
    render(withCtx(<ShojiStatusWidget mode="compact" />, {
      status: "available", summary: null, updated_at: new Date().toISOString(), updated_by_name: "東海林",
    }));
    expect(screen.getByText(/メモなし/)).toBeInTheDocument();
  });
  it("renders skeleton when status is null", () => {
    render(withCtx(<ShojiStatusWidget mode="compact" />, null));
    expect(screen.getByTestId("ceo-status-skeleton")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 失敗確認**

```bash
npm run test:run -- src/components/shared
```
期待：FAIL

- [ ] **Step 3: 実装 + Context export 修正**

まず `ShojiStatusContext.tsx` の `ShojiStatusContext` を export に変更：

```ts
// src/components/shared/ShojiStatusContext.tsx の以下行を修正
export const ShojiStatusContext = createContext<ContextValue>({  // export 追加
  status: null,
  loading: false,
  error: null,
  refresh: async () => {},
});
```

```tsx
// src/components/shared/ShojiStatusWidget.tsx
"use client";

import Link from "next/link";
import { useShojiStatus, type CeoStatusKey } from "./ShojiStatusContext";
import { formatRelativeTime, isStale } from "./_lib/formatRelativeTime";

const STATUS_META: Record<CeoStatusKey, { icon: string; label: string }> = {
  available: { icon: "🟢", label: "対応可能" },
  busy:      { icon: "🟡", label: "取り込み中" },
  focused:   { icon: "🔴", label: "集中業務中" },
  away:      { icon: "⚪", label: "外出中" },
};

const SUMMARY_TRUNCATE = 30;

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max) + "…";
}

export function ShojiStatusWidget({ mode }: { mode: "compact" | "full" }) {
  const { status } = useShojiStatus();

  if (!status) {
    return (
      <div
        data-testid="ceo-status-skeleton"
        style={{ height: mode === "compact" ? 56 : 120, opacity: 0.5 }}
      >
        東海林ステータス 読込中…
      </div>
    );
  }

  const meta = STATUS_META[status.status];
  const stale = isStale(status.updated_at);
  const relTime = formatRelativeTime(status.updated_at);
  const summaryDisplay = status.summary ?? "メモなし";

  if (mode === "compact") {
    return (
      <Link
        href="/bloom/workboard/ceo-status"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          fontSize: 14,
          color: stale ? "#888" : "inherit",
          textDecoration: "none",
          border: "1px solid #ddd",
          borderRadius: 4,
          minHeight: 40,
        }}
        title={`東海林さん: ${meta.label} | ${summaryDisplay}`}
      >
        <span aria-hidden>{meta.icon}</span>
        <span>東海林：{meta.label}</span>
        <span style={{ opacity: 0.6 }}>｜</span>
        <span>{truncate(summaryDisplay, SUMMARY_TRUNCATE)}</span>
        <span style={{ opacity: 0.6, marginLeft: "auto" }}>{relTime}</span>
      </Link>
    );
  }

  // full
  return (
    <div
      style={{
        padding: 16,
        border: "1px solid #ddd",
        borderRadius: 8,
        color: stale ? "#888" : "inherit",
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
        <span aria-hidden>{meta.icon}</span> 東海林さん：{meta.label}
      </div>
      <hr style={{ border: 0, borderTop: "1px solid #eee", margin: "8px 0" }} />
      <div style={{ fontSize: 14, marginBottom: 12 }}>{summaryDisplay}</div>
      <div style={{ fontSize: 12, color: "#888" }}>
        最終更新: {status.updated_at ?? "—"} ({relTime})
      </div>
      <div style={{ fontSize: 12, color: "#888" }}>
        更新者: {status.updated_by_name ?? "—"}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: テスト pass + commit**

```bash
npm run test:run -- src/components/shared
git add src/components/shared/
git commit -m "feat(bloom): [a-bloom] ShojiStatusWidget (compact+full) + 3 tests"
```

---

### Task 9: CeoStatusEditor

**Files:**
- Create: `src/app/bloom/_components/CeoStatusEditor.tsx`
- Create: `src/app/bloom/_components/__tests__/CeoStatusEditor.test.tsx`

- [ ] **Step 1: 失敗テスト**

```tsx
// src/app/bloom/_components/__tests__/CeoStatusEditor.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CeoStatusEditor } from "../CeoStatusEditor";

global.fetch = vi.fn();

describe("CeoStatusEditor", () => {
  beforeEach(() => { (global.fetch as any).mockReset(); });

  it("renders 4 status radio options", () => {
    render(<CeoStatusEditor isSuperAdmin={true} />);
    expect(screen.getByLabelText(/対応可能/)).toBeInTheDocument();
    expect(screen.getByLabelText(/取り込み中/)).toBeInTheDocument();
    expect(screen.getByLabelText(/集中業務中/)).toBeInTheDocument();
    expect(screen.getByLabelText(/外出中/)).toBeInTheDocument();
  });

  it("does not render when not super_admin", () => {
    const { container } = render(<CeoStatusEditor isSuperAdmin={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("submits PUT on save click", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "busy", summary: "test" }),
    });
    render(<CeoStatusEditor isSuperAdmin={true} />);
    fireEvent.click(screen.getByLabelText(/取り込み中/));
    fireEvent.change(screen.getByLabelText(/メモ/), { target: { value: "test" } });
    fireEvent.click(screen.getByRole("button", { name: /更新/ }));
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/ceo-status",
        expect.objectContaining({ method: "PUT" }),
      ),
    );
  });
});
```

- [ ] **Step 2: 失敗確認**

```bash
npm run test:run -- src/app/bloom/_components/__tests__/CeoStatusEditor
```
期待：FAIL

- [ ] **Step 3: 実装**

```tsx
// src/app/bloom/_components/CeoStatusEditor.tsx
"use client";

import { useState } from "react";
import { useShojiStatus, type CeoStatusKey } from "../../../components/shared/ShojiStatusContext";

const OPTIONS: Array<{ key: CeoStatusKey; icon: string; label: string }> = [
  { key: "available", icon: "🟢", label: "対応可能" },
  { key: "busy",      icon: "🟡", label: "取り込み中" },
  { key: "focused",   icon: "🔴", label: "集中業務中" },
  { key: "away",      icon: "⚪", label: "外出中" },
];

export function CeoStatusEditor({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const { status, refresh } = useShojiStatus();
  const [selected, setSelected] = useState<CeoStatusKey>(status?.status ?? "available");
  const [summary, setSummary] = useState<string>(status?.summary ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!isSuperAdmin) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/ceo-status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: selected, summary: summary || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setMessage(`更新失敗: ${body.error ?? res.status}`);
        return;
      }
      setMessage("更新しました");
      await refresh();
    } catch (err) {
      setMessage(`通信エラー: ${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ padding: 16, border: "1px solid #ddd", borderRadius: 8 }}>
      <h3 style={{ marginTop: 0 }}>東海林さんステータス更新</h3>
      <fieldset style={{ border: 0, padding: 0, marginBottom: 12 }}>
        <legend style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>状態</legend>
        {OPTIONS.map((opt) => (
          <label key={opt.key} style={{ display: "block", padding: 4 }}>
            <input
              type="radio"
              name="status"
              value={opt.key}
              checked={selected === opt.key}
              onChange={() => setSelected(opt.key)}
            />
            {" "}{opt.icon} {opt.label}
          </label>
        ))}
      </fieldset>
      <label style={{ display: "block", marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: "#666" }}>メモ（200 字以内）</span>
        <textarea
          value={summary}
          maxLength={200}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="a-main 006 で Root Phase B 確定中"
          style={{ width: "100%", minHeight: 60, padding: 8, marginTop: 4 }}
        />
      </label>
      <button type="submit" disabled={submitting} style={{ padding: "8px 16px" }}>
        {submitting ? "更新中…" : "更新"}
      </button>
      {message && <p style={{ marginTop: 8, fontSize: 14 }}>{message}</p>}
    </form>
  );
}
```

- [ ] **Step 4: テスト pass + commit**

```bash
npm run test:run -- src/app/bloom/_components/__tests__/CeoStatusEditor
git add src/app/bloom/_components/CeoStatusEditor.tsx src/app/bloom/_components/__tests__/CeoStatusEditor.test.tsx
git commit -m "feat(bloom): [a-bloom] CeoStatusEditor (super_admin only form, PUT) + 3 tests"
```

---

### Task 10: /bloom/workboard/ceo-status 詳細画面

**Files:**
- Create: `src/app/bloom/workboard/ceo-status/page.tsx`

- [ ] **Step 1: 実装**

```tsx
// src/app/bloom/workboard/ceo-status/page.tsx
"use client";

import { useBloomState } from "../../_state/BloomStateContext";
import { ShojiStatusWidget } from "../../../../components/shared/ShojiStatusWidget";
import { CeoStatusEditor } from "../../_components/CeoStatusEditor";

export default function CeoStatusDetailPage() {
  const { user } = useBloomState();
  const isSuperAdmin = user?.garden_role === "super_admin";

  return (
    <main style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, maxWidth: 720 }}>
      <h1>東海林さん 現在のステータス</h1>
      <ShojiStatusWidget mode="full" />
      {isSuperAdmin && <CeoStatusEditor isSuperAdmin={true} />}
    </main>
  );
}
```

注：`useBloomState` の戻り値型を確認。もし `user` フィールドが異なる場合は実装中に調整（既存 `BloomStateContext.tsx` を grep）。

- [ ] **Step 2: 動作スモーク（dev server で URL アクセス確認）**

```bash
# 既に dev サーバが立ち上がっていなければ起動
npm run dev &
# ブラウザで http://localhost:3000/bloom/workboard/ceo-status を開く
# 期待：ヘッダー＋ ShojiStatusWidget full 表示、super_admin なら Editor も表示
```

- [ ] **Step 3: commit**

```bash
git add src/app/bloom/workboard/ceo-status/
git commit -m "feat(bloom): [a-bloom] /bloom/workboard/ceo-status detail page"
```

---

### Task 11: Bloom Workboard カードに ShojiStatusWidget を配置

**Files:**
- Modify: `src/app/bloom/workboard/page.tsx`（compact widget を上部に追加）

- [ ] **Step 1: page.tsx を読んで挿入位置を特定**

```bash
grep -n "return\|<main\|<section" src/app/bloom/workboard/page.tsx | head -20
```

- [ ] **Step 2: import 追加 + JSX 内の最上段にカード追加**

```tsx
// src/app/bloom/workboard/page.tsx の import 末尾に追加
import { ShojiStatusWidget } from "../../../components/shared/ShojiStatusWidget";

// ...既存 JSX の return の最初の直下に追加：
// <section aria-label="東海林さんステータス" style={{ marginBottom: 16 }}>
//   <ShojiStatusWidget mode="compact" />
// </section>
```

実装時は既存構造を壊さない最小差分で適用（ラッパー要素は既存パターンに合わせる）。

- [ ] **Step 3: 動作確認 + commit**

```bash
npm run dev  # まだ立ち上がってなければ
# /bloom/workboard を開いて compact widget が表示されること確認
git add src/app/bloom/workboard/page.tsx
git commit -m "feat(bloom): [a-bloom] add ShojiStatusWidget to Workboard top"
```

---

## Phase 3：cross-ui-01/06 Skeleton（Track B、約 3h）

### Task 12: Header skeleton（共通レイアウト）

**Files:**
- Create: `src/components/shared/Header.tsx`
- Create: `src/components/shared/__tests__/Header.test.tsx`

- [ ] **Step 1: 失敗テスト**

```tsx
// src/components/shared/__tests__/Header.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Header } from "../Header";

describe("Header skeleton", () => {
  it("renders appName and userName", () => {
    render(<Header appName="Bloom" userName="東海林" />);
    expect(screen.getByText("Bloom")).toBeInTheDocument();
    expect(screen.getByText("東海林")).toBeInTheDocument();
  });
  it("renders rightActions when provided", () => {
    render(<Header appName="Bloom" userName="X" rightActions={<span>RIGHT</span>} />);
    expect(screen.getByText("RIGHT")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 失敗確認**

```bash
npm run test:run -- src/components/shared/__tests__/Header
```

- [ ] **Step 3: 実装（cross-ui-01 §3.1 準拠の最小 skeleton）**

```tsx
// src/components/shared/Header.tsx
import type { ReactNode } from "react";

export type HeaderProps = {
  appName: string;
  brandColor?: string;
  userName?: string;
  userRole?: string;
  rightActions?: ReactNode;
};

export function Header({ appName, brandColor = "#3B9B5C", userName, userRole, rightActions }: HeaderProps) {
  return (
    <header
      style={{
        height: 64,
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        background: "linear-gradient(90deg, #87CEEB, #E0F6FF)",
        borderBottom: `4px solid ${brandColor}`,
        gap: 16,
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 18 }}>{appName}</div>
      <div style={{ flex: 1 }} />
      {rightActions}
      {userName && (
        <div style={{ fontSize: 14 }}>
          {userName}
          {userRole && <span style={{ marginLeft: 8, opacity: 0.7 }}>({userRole})</span>}
        </div>
      )}
    </header>
  );
}
```

- [ ] **Step 4: テスト pass + commit**

```bash
npm run test:run -- src/components/shared/__tests__/Header
git add src/components/shared/Header.tsx src/components/shared/__tests__/Header.test.tsx
git commit -m "feat(common): [a-bloom] Header skeleton (cross-ui-01 minimal) + 2 tests"
```

---

### Task 13: /login 共通ログインページ skeleton

**Files:**
- Create: `src/app/login/page.tsx`

- [ ] **Step 1: 既存 /tree/login を参考に実装パターン把握**

```bash
cat src/app/tree/login/page.tsx | head -80
cat src/app/root/login/page.tsx | head -80
```

- [ ] **Step 2: 共通 login 実装（synthetic email pattern）**

```tsx
// src/app/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInBloom } from "../bloom/_lib/auth";

export default function GardenLoginPage() {
  const router = useRouter();
  const [empId, setEmpId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await signInBloom(empId, password);
    setSubmitting(false);
    if (result.success) {
      router.push("/");
    } else {
      setError(result.error ?? "ログイン失敗");
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #FAF8F3 0%, #E0F6FF 100%)",
      }}
    >
      <form
        onSubmit={onSubmit}
        style={{
          padding: 32,
          background: "rgba(255,255,255,0.9)",
          borderRadius: 12,
          boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
          minWidth: 320,
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: 24 }}>Garden ログイン</h1>
        <label style={{ display: "block", marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: "#666" }}>社員番号</span>
          <input
            type="text"
            value={empId}
            onChange={(e) => setEmpId(e.target.value)}
            required
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>
        <label style={{ display: "block", marginBottom: 16 }}>
          <span style={{ fontSize: 12, color: "#666" }}>パスワード</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>
        {error && <p style={{ color: "red", fontSize: 14 }}>{error}</p>}
        <button type="submit" disabled={submitting} style={{ padding: "10px 16px", width: "100%" }}>
          {submitting ? "ログイン中…" : "ログイン"}
        </button>
        <p style={{ marginTop: 16, fontSize: 12, color: "#888" }}>
          社内 PC からのみアクセス可能です。
        </p>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: dev server で動作確認 + commit**

```bash
# http://localhost:3000/login で表示確認、入力 → / にリダイレクト確認
git add src/app/login/page.tsx
git commit -m "feat(common): [a-bloom] /login skeleton (synthetic email auth, redirect to /)"
```

---

### Task 14: / 9 アイコンホーム skeleton + ShojiStatusProvider 配置

**Files:**
- Modify: `src/app/page.tsx` (replace Hello World)
- Modify: `src/app/layout.tsx` (wrap with ShojiStatusProvider)
- Create: `src/components/shared/HomeIconGrid.tsx`

- [ ] **Step 1: HomeIconGrid 実装**

```tsx
// src/components/shared/HomeIconGrid.tsx
"use client";

import Link from "next/link";

type AppDef = { key: string; emoji: string; label: string; href: string; color: string; enabled: boolean };

const APPS: AppDef[] = [
  { key: "soil",   emoji: "🌱", label: "Soil",   href: "/soil",   color: "#8B6F47", enabled: false },
  { key: "root",   emoji: "🌿", label: "Root",   href: "/root",   color: "#5C4332", enabled: true  },
  { key: "tree",   emoji: "🌲", label: "Tree",   href: "/tree",   color: "#3B9B5C", enabled: true  },
  { key: "leaf",   emoji: "🍃", label: "Leaf",   href: "/leaf",   color: "#7FC66D", enabled: false },
  { key: "bud",    emoji: "🌸", label: "Bud",    href: "/bud",    color: "#E07A9B", enabled: false },
  { key: "bloom",  emoji: "🌺", label: "Bloom",  href: "/bloom/workboard", color: "#C3447A", enabled: true },
  { key: "seed",   emoji: "🌰", label: "Seed",   href: "/seed",   color: "#D9BC92", enabled: false },
  { key: "forest", emoji: "🌳", label: "Forest", href: "/forest", color: "#1F5C3A", enabled: true  },
  { key: "rill",   emoji: "🌊", label: "Rill",   href: "/rill",   color: "#4FA8C9", enabled: false },
];

export function HomeIconGrid() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 16,
        maxWidth: 480,
        margin: "0 auto",
      }}
    >
      {APPS.map((app) =>
        app.enabled ? (
          <Link
            key={app.key}
            href={app.href}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              background: "rgba(255,255,255,0.85)",
              borderRadius: 12,
              border: `2px solid ${app.color}`,
              textDecoration: "none",
              color: "#333",
              transition: "transform 0.15s",
            }}
          >
            <div style={{ fontSize: 48 }} aria-hidden>{app.emoji}</div>
            <div style={{ marginTop: 8, fontWeight: 600 }}>{app.label}</div>
          </Link>
        ) : (
          <div
            key={app.key}
            title="準備中"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              background: "rgba(200,200,200,0.4)",
              borderRadius: 12,
              border: "2px solid #ccc",
              opacity: 0.5,
              cursor: "not-allowed",
            }}
            aria-disabled="true"
          >
            <div style={{ fontSize: 48 }} aria-hidden>{app.emoji}</div>
            <div style={{ marginTop: 8 }}>{app.label}</div>
          </div>
        ),
      )}
    </div>
  );
}
```

- [ ] **Step 2: src/app/page.tsx を完全置換**

```tsx
// src/app/page.tsx
import { HomeIconGrid } from "../components/shared/HomeIconGrid";
import { ShojiStatusWidget } from "../components/shared/ShojiStatusWidget";

export default function GardenHomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "32px 16px",
        background: "linear-gradient(180deg, #87CEEB 0%, #E0F6FF 60%, #FAF8F3 100%)",
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      <header style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 32, margin: 0 }}>Garden</h1>
        <p style={{ color: "#666", marginTop: 8 }}>9 アプリ ホーム</p>
      </header>

      <section
        aria-label="東海林さん現在のステータス"
        style={{ maxWidth: 720, margin: "0 auto", width: "100%" }}
      >
        <ShojiStatusWidget mode="compact" />
      </section>

      <section style={{ marginTop: 16 }}>
        <HomeIconGrid />
      </section>
    </main>
  );
}
```

- [ ] **Step 3: src/app/layout.tsx に ShojiStatusProvider 追加**

```tsx
// src/app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ShojiStatusProvider } from "../components/shared/ShojiStatusContext";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Garden",
  description: "Garden シリーズ — 社内アプリケーション",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ShojiStatusProvider>{children}</ShojiStatusProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: dev server 動作確認**

```bash
npm run dev
# http://localhost:3000/ を開く
# 未ログイン → API 401 → widget は skeleton 表示
# ログイン → / で widget 表示、9 アイコン表示
```

- [ ] **Step 5: commit**

```bash
git add src/app/page.tsx src/app/layout.tsx src/components/shared/HomeIconGrid.tsx
git commit -m "feat(common): [a-bloom] / 9 icon home + ShojiStatusProvider in root layout"
```

---

### Task 15: Bloom レイアウトに Header + ShojiStatusWidget 注入

**Files:**
- Modify: `src/app/bloom/_components/BloomShell.tsx`（または `src/app/bloom/layout.tsx`、既存構造に応じて選択）

- [ ] **Step 1: 既存 BloomShell の構造確認**

```bash
cat src/app/bloom/_components/BloomShell.tsx
```

- [ ] **Step 2: BloomShell 内に共通 Header を呼び、rightActions に compact widget を渡す**

実装方針：
- 既存 BloomShell が独自ヘッダーを持っているなら、そこに ShojiStatusWidget を `rightActions` 相当として追加
- 持っていなければ `<Header appName="Bloom" rightActions={<ShojiStatusWidget mode="compact" />} userName={...} />` を上部に挿入
- 既存 UI を壊さない最小差分

- [ ] **Step 3: dev server で /bloom/workboard を開いて Header 上の widget 動作確認 + commit**

```bash
git add src/app/bloom/_components/BloomShell.tsx
git commit -m "feat(bloom): [a-bloom] inject Header + ShojiStatusWidget into BloomShell"
```

---

## Phase 4：α 完走確認 + handoff（約 30 min）

### Task 16: α 完走スモークテスト

**Files:**
- Create: `docs/handoff-bloom-002-202604261600.md`（時刻は実装完了時に調整）

- [ ] **Step 1: 全テスト走行（regression check）**

```bash
npm run test:run
```
期待：全テスト pass（既存 570 + 今回追加 ≒ 14 件）

- [ ] **Step 2: build 確認**

```bash
npm run build
```
期待：success（型エラー / lint エラーなし）

- [ ] **Step 3: dev server で α 完走条件 3 点を確認**

| 確認項目 | 期待 |
|---|---|
| `/login` 表示 | ✅ ログインフォーム表示、ログイン成功で `/` リダイレクト |
| `/` 表示 | ✅ 9 アイコン + ShojiStatusWidget（compact）+ 東海林さんログインなら最新ステータス |
| `/bloom/workboard` | ✅ 既存画面 + ShojiStatusWidget compact 上部表示 |
| `/bloom/workboard/ceo-status` | ✅ full widget + Editor（super_admin のみ） |
| Editor 動作（super_admin） | ✅ status 変更 → 30 秒以内に Widget 反映 |
| Editor 非表示（manager 等） | ✅ Editor 非表示、Widget は表示 |

- [ ] **Step 4: handoff doc 作成**

```markdown
# Handoff - 2026-04-26 - a-bloom-002

## 今やっていること
GW α 完走条件 3 点（/login + / + ShojiStatusWidget）達成、commit 全完了

## 完了タスク
- spec-shoji-status-visibility v1 (MVP) 起草 + commit
- bloom_ceo_status migration 適用
- GET/PUT /api/ceo-status 実装 + 5 tests
- ShojiStatusContext (30s polling) + ShojiStatusWidget (compact+full) + 5 tests
- CeoStatusEditor + 3 tests
- /bloom/workboard/ceo-status 詳細画面
- Bloom Workboard カードに widget 配置
- Header skeleton + 2 tests
- /login 共通ログインページ skeleton
- / 9 アイコンホーム + ShojiStatusProvider 配置
- BloomShell に Header + widget 注入

## 次にやるべきこと（GW 後半）
- 後道さん FB 受け（UI 完成後 §17 準拠）
- B（Garden Calendar 連動）/ C（アラート検知）/ 日報自動連動 を Phase 2 で起草
- cross-ui-02〜05 の skeleton（Phase 2）

## 注意点・詰まっている点
- bloom_ceo_status seed が super_admin 不在時に row 0 件 → API GET で skeleton 表示で対処済
- BloomShell 構造は既存の独自 Header と整合性確認要

## 関連情報
- ブランチ: feature/garden-common-ui-and-shoji-status
- spec: docs/specs/bloom/spec-shoji-status-visibility.md
- plan: docs/specs/bloom/plan-shoji-status-and-cross-ui-skeleton-20260426.md
- push 順序: push-plan-20260426-github-recovery.md §8.3.2（追加追記予定）
```

- [ ] **Step 5: effort-tracking 実績更新 + handoff commit**

```bash
# effort-tracking.md の Bloom 行に実績(d) と完了日 を入力
git add docs/effort-tracking.md docs/handoff-bloom-002-*.md
git commit -m "docs(bloom): [a-bloom] handoff + effort-tracking 実績更新"
```

---

## Self-Review

### 1. Spec coverage
- [✓] §2.1 DB 定義 → Task 1
- [✓] §2.2 4 ステータス → Task 6 (Context types) + Task 8 (Widget)
- [✓] §2.3 RLS → Task 1
- [✓] §3 ファイル構成 → Task 6/8/9/10/12/13/14（全パスを実装でカバー）
- [✓] §4.1 GET → Task 2/3
- [✓] §4.2 PUT → Task 4/5
- [✓] §4.3 RLS server/client 監査 → Task 3 で `@supabase/ssr` の `createServerClient` + Route Handler 採用
- [✓] §5.1 compact widget → Task 8
- [✓] §5.2 full widget → Task 8
- [✓] §5.3 Editor → Task 9
- [✓] §5.4 表示権限 → Task 9（isSuperAdmin gate）+ Task 10
- [✓] §6 polling → Task 6
- [✓] §7.3 共通ホーム未実装の暫定対応 → Task 11（Workboard 配置）+ Task 14（共通ホーム配置）
- [✓] §8 実装ステップ 7 件 → Task 1〜11 で完全カバー
- [✓] §9 テスト観点 → Task 16 のスモークテストで網羅

### 2. Placeholder scan
- "TBD" / "TODO" / "後で" → なし
- "適切なエラー処理" → なし、すべて具体的なステータスコード明示
- "tests for the above" → 各テストコード本体を全提示
- "Similar to Task N" → なし

### 3. Type consistency
- `CeoStatusKey` を Context で定義 → Widget / Editor で同名 import
- `CeoStatus` 型を Context で定義 → API レスポンス型と一致
- `STATUS_META` のキー = `CeoStatusKey` の 4 値で統一
- API パス `/api/ceo-status` を Context / Editor で同一文字列使用
- `useShojiStatus()` フックのみ export（context 直接 import は Task 8 step 3 で example 内に export 修正を明記）

### 4. 注意点
- Task 10 の `useBloomState().user.garden_role` プロパティは既存 BloomStateContext を確認して微調整必要（実装ステップ内に明記）
- Task 15 の BloomShell 構造は既存実装次第（実装ステップ内に明記）

---

— plan v1 end —
