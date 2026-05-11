# Garden-wide Unified Auth Implementation Plan

> **起草**: a-root-003 (subagent-driven、subagent 1/2/3 並列起草 + 統合)
> **起草日**: 2026-05-11
> **対応 dispatch**: main- No. 280 (§C Task 1-6 GO) / main- No. 282 (誤情報訂正 + 採用)
> **For agentic workers**: REQUIRED SUB-SKILL `superpowers:subagent-driven-development` を推奨。Task 1-6 は依存関係に従って順次着手。

---

## Goal

Garden Series 12 モジュール（Soil / Root / Tree / Leaf / Bud / Bloom / Seed / Forest / Rill / Fruit / Sprout / Calendar）の認証フローを **「ログイン画面 → シリーズ Home → 各モジュール entry」** の単一動線に統一する。

**現状の課題**:
- 各モジュールに独立した `/login` 系画面が乱立（`/login` / `/forest/login` / `/bud/login` / `/tree/login` / `/root/login`、計 5 画面）
- 各モジュールの認証 Gate（`ForestGate.tsx` / `BloomGate.tsx` / `TreeAuthGate.tsx` 等）が個別実装
- `BloomGate` は当面の workaround で `/forest/login` へ redirect
- `getPostLoginRedirect()` は実装済だが、各モジュール内 redirect ロジックがバラバラ
- super_admin への昇格を UI から block する仕組みが未実装

**統一後の動線**:
1. **ユーザーは `/login` に到達**（モジュール内未認証アクセスは全て `/login?returnTo=...` に 1 hop で集約）
2. **ロール別 redirect**: `getPostLoginRedirect()` に従い、`returnTo` を優先しつつ次を判定
   - super_admin / admin / manager / staff / cs → `/`（Series Home）
   - closer / toss → `/tree`
   - outsource → `/leaf/kanden`
3. **Series Home（`/`）は 12 モジュール grid + Sidebar を role 別に表示**（getModuleVisibility）
4. **各モジュール entry は共通 ModuleGate で min_role チェック**（role 不足は `/access-denied`）
5. **RLS は PR #154 で merged の `has_role_at_least()` を活用、統一テンプレート整備**
6. **super_admin 昇格は東海林さん本人 SQL のみ**（UI 全 block + DB trigger 二重保険）

---

## Architecture

- **認証**: Supabase Auth（既存）、擬似メール `emp{4桁}@garden.internal` + パスワード
- **権限**: `root_employees.garden_role` (8 段階 enum) + PR #154 `has_role_at_least()` SQL function
- **UI**: Next.js 16 App Router、React 19、既存 inline-style デザイン、6 atmospheres カルーセル背景
- **テストフレームワーク**: Vitest（既存）+ Chrome MCP（手動 E2E）
- **branch**: 各 Task で `feature/garden-unified-auth-task-N` を develop から分岐、PR は workspace/a-root-003 経由でも可

---

## Tech Stack

| 項目 | バージョン / 場所 |
|---|---|
| Next.js | 16（App Router） |
| React | 19 |
| Supabase JS | v2.103 |
| TypeScript | 5 |
| Vitest | 既存 (`npm test`) |
| Chrome MCP | `mcp__Claude_in_Chrome__*`（手動 E2E） |
| Helper SQL functions | `has_role_at_least(role_min text)` / `auth_employee_number()`（PR #154 merged commit `12f59cd`） |
| 既存 GardenRole 型 | `src/app/root/_constants/types.ts`（要追加: `outsource`） |

---

## File Structure Summary

### 新規ファイル (本 Plan 全体で 12 ファイル)

| パス | 役割 | Task |
|---|---|---|
| `src/app/_lib/auth-unified.ts` | signIn / signOut / isAuthSessionUnlocked / touchAuthSession + `useAuthUnified()` Hook | 1 |
| `src/app/_lib/module-visibility.ts` | `getVisibleModules(role)` / `MODULE_KEYS` / `DEFAULT_VISIBILITY_MATRIX` | 2 |
| `src/app/_lib/__tests__/module-visibility.test.ts` | 8 role × 12 module 単体テスト | 2/6 |
| `src/app/_lib/__tests__/auth-unified.test.ts` | useAuthUnified Hook 単体テスト | 6 |
| `src/app/_lib/__tests__/module-gate-redirect.test.ts` | ModuleGate redirect ロジック単体テスト | 6 |
| `src/app/_components/ModuleGate.tsx` | 共通モジュールゲート | 3 |
| `src/app/_components/AuthLoadingScreen.tsx` | モジュール別絵文字スピナー | 3 |
| `src/app/_constants/module-min-roles.ts` | 12 モジュール minRole 一元管理 | 3 |
| `src/app/access-denied/page.tsx` | role 不足時の遷移先 | 3 |
| `scripts/garden-rls-unified-template.sql` | RLS 統一テンプレート（5 pattern） | 4 |
| `scripts/garden-super-admin-lockdown.sql` | super_admin 昇格 / 降格 block trigger | 5 |
| `docs/qa/unified-auth-test-scenarios-20260511.md` | E2E シナリオ集（S1-S13 + 96 マトリクス） | 6 |
| `docs/specs/cross-cutting/2026-05-11-garden-rls-design-guide.md` | RLS 設計ガイド | 4 |

### 修正ファイル (主要)

| パス | 修正内容 | Task |
|---|---|---|
| `src/app/login/page.tsx` | `returnTo` クエリ尊重 + `signInUnified` に置換 + Suspense boundary | 1 |
| `src/app/page.tsx` | server component 化 + role 取得 + 強制 redirect + GardenHomeClient 分離 | 2 |
| `src/app/_components/home/OrbGrid.tsx` | `visibleModules` prop + filter | 2 |
| `src/app/_components/layout/Sidebar.tsx` | モジュール直リンク化 + filter（旧 NAV_ITEMS は LEGACY 保管） | 2 |
| `src/app/bloom/_components/BloomGate.tsx` | ModuleGate ラッパー化（redirect 先 `/forest/login` のまま、Task 1 後に `/login` へ） | 1→3 |
| `src/app/forest/_components/ForestGate.tsx` | redirect-only shell → ModuleGate ラッパー化 | 1→3 |
| `src/app/tree/_components/TreeAuthGate.tsx` | ModuleGate ラッパー化 + 誕生日 2 段判定 | 3 |
| `src/app/bloom/_constants/routes.ts` | `GARDEN_LOGIN: "/login"` 追加 | 1 |
| `src/app/root/_constants/types.ts` | `GARDEN_ROLE_SELECTABLE_OPTIONS`（super_admin 除外） | 5 |
| `scripts/root-rls-phase1.sql` | 末尾コメントに将来計画追記 | 4 |

### Legacy rename (削除禁止、`*.legacy-20260511.tsx` 保管)

memory `feedback_no_delete_keep_legacy.md` に従い、以下を物理削除せず legacy 改名:

| 旧 path | 新 path (legacy 保管) | Task |
|---|---|---|
| `src/app/forest/_components/ForestGate.tsx`（237 行） | `ForestGate.legacy-20260511.tsx` | 1 |
| `src/app/bloom/_components/BloomGate.tsx`（77 行） | `BloomGate.legacy-20260511.tsx` | 3 |
| `src/app/tree/_components/TreeAuthGate.tsx`（要 Read） | `TreeAuthGate.legacy-20260511.tsx` | 3 |
| `src/app/forest/login/page.tsx`（57 行） | `forest/login/page.legacy-20260511.tsx` | 1 |
| `src/app/bud/login/page.tsx`（144 行） | `bud/login/page.legacy-20260511.tsx` | 1 |
| `src/app/tree/login/page.tsx`（251 行） | `tree/login/page.legacy-20260511.tsx` | 1 |
| `src/app/root/login/page.tsx`（236 行） | `root/login/page.legacy-20260511.tsx` | 1 |

---

## Task 1-6 Overview

| Task | タイトル | 想定工数 | 主要成果物 | 依存 |
|---|---|---|---|---|
| **1** | Login 統一画面 | 0.5d | `/login` 一本化 + `auth-unified.ts` + `useAuthUnified()` Hook + 7 legacy rename | PR #154 |
| **2** | Series Home 権限別表示 | 0.5d | `module-visibility.ts` + page.tsx server 化 + OrbGrid/Sidebar filter | Task 1 |
| **3** | 各モジュール entry 共通 ModuleGate | 0.5d | `ModuleGate.tsx` + 12 module layout 装着 + `/access-denied` | Task 1 / 2 |
| **4** | RLS 統一テンプレート | 0.3d | template SQL + 設計ガイド md（実 migration は別 PR） | PR #154 |
| **5** | super_admin 権限固定 | 0.2d | trigger 2 件 + UI selectable から除外 | 独立 |
| **6** | 動作テスト + Vitest | 0.5d | Vitest 104 ケース + S1-S13 + 96 マトリクス | Task 1-5 |

**合計**: 2.5d (12h)、subagent 並列で 1-1.5d 圧縮可（Task 4 / 5 は他と独立、並列 dispatch 可）

---

## Integration Notes（subagent 間整合性、最重要）

本 Plan は subagent 1 / 2 / 3 並列起草の統合版。以下 3 件の整合性問題を **本 §で解決確定**:

### IN-1: `useAuthUnified()` Hook の所在
- subagent 1: `_lib/auth-unified.ts` に `signInUnified` / `signOutUnified` / `isAuthSessionUnlocked` / `touchAuthSession` を export
- subagent 3: ModuleGate が `useAuthUnified()` Hook（loading / isAuthenticated / role / isUnlocked 返却）を import 前提

→ **解決**: Task 1 で `_lib/auth-unified.ts` に **以下も追加 export** する:
  - `useAuthUnified()` Hook（React Context 経由で auth state を返す）
  - `AuthProvider` Component（layout で wrap）
  - 内部実装は既存 `BloomStateContext` を参考にしつつ、モジュール非依存化

### IN-2: `getModuleVisibility` 関数の取扱い
- subagent 2: `getVisibleModules(role)` 関数（返り値: `ModuleKey[]`）
- subagent 3: `getModuleVisibility(role, module)` 関数（返り値: `{ canView: boolean }`、Task 6 のテストで利用）

→ **解決**: Task 2 で **両方** export する:
  - `getVisibleModules(role): ModuleKey[]`（subagent 2 主導、OrbGrid / Sidebar で利用）
  - `getModuleVisibility(role, module): { canView: boolean }`（薄い wrapper、Task 6 テスト互換）

### IN-3: 権限マトリクスの確定版
- subagent 2: staff = 10 module（Soil/Rill 不可）、cs = 4 module（Bloom/Tree/Leaf/Calendar）
- subagent 3 (Task 6 テスト EXPECTED): staff = 8 module、cs = 2 module（Tree/Rill のみ）

→ **解決**: **subagent 2 の matrix を確定版とする**（CLAUDE.md §「モジュール構成」の役割定義 + memory `project_garden_dual_axis_navigation.md` の rationale が明確）。

**確定マトリクス（Task 2 / Task 6 共通の唯一の参照源）**:

|       | Bloom | Tree | Forest | Root | Bud | Leaf | Seed | Soil | Sprout | Fruit | Rill | Calendar | `/home` 到達 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **super_admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **manager** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **staff** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ |
| **cs** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **closer** | — | — | — | — | — | — | — | — | — | — | — | — | ❌（強制 `/tree`） |
| **toss** | — | — | — | — | — | — | — | — | — | — | — | — | ❌（強制 `/tree`） |
| **outsource** | — | — | — | — | — | — | — | — | — | — | — | — | ❌（強制 `/leaf/kanden`） |

Task 6 §S1 マトリクス検証セクションも本表に合わせて再現すること。

### IN-4: ForestGate / BloomGate / 各 module login page の rename 順序
- Task 1 で legacy rename + 単純 redirect shell 化
- Task 3 で **更に** ModuleGate ラッパー化

→ **解決**: rename は **Task 1 で 1 回だけ** 実施。Task 3 は新規 `xxxGate.tsx`（Task 1 で作成された redirect shell）を **書き換えのみ**（rename しない、二重 legacy を避ける）。

### IN-5: `signInBloom` / `signInForest` / `signInTree` / `signInBud` / `signInRoot` 既存ヘルパー
- Task 1 は既存ヘルパー削除せず維持
- Task 6 はクリーンアップ対象外

→ **解決**: 本 Plan のスコープ外。将来 Phase B-5（Auth セキュリティ強化）または独立 PR で deprecated 化 → 1 年後削除予定。

---

## Task 1: Login 統一画面

### Goal

Garden Series 12 モジュールに散在する認証画面（`/login`, `/forest/login`, `/bud/login`, `/tree/login`, `/root/login`, `BloomGate` 経由の forest/login redirect）を **単一の `/login` 画面に統合**する。

統合方針:

1. **`/login` を Garden Series 全モジュール共通の認証エントリ**として確定（既存 `src/app/login/page.tsx` v7 Group B 改訂、300 行を維持）
2. 各モジュールの `xxxGate.tsx`（ForestGate / BloomGate / 将来の TreeGate / BudGate / RootGate）は **未認証なら `/login?returnTo=<現在パス>` へ単一 redirect** に統一
3. 各モジュール `xxx/login/page.tsx` は **legacy 改名 + `/login?returnTo=<元 module 既定 path>` redirect stub** に変更（後方互換を保つ）
4. 認証ヘルパーをモジュール非依存の `src/app/_lib/auth-unified.ts` に集約 + **`useAuthUnified()` Hook + `AuthProvider` も同ファイルで export**（IN-1 解決）
5. `getPostLoginRedirect()` を `/login` から呼び出して権限別 redirect（既存ヘルパーをそのまま再利用）

### Files

#### Modify

- `src/app/login/page.tsx`（300 行、既存維持 + returnTo 対応 + `signInUnified` 置換）
- `src/app/bloom/_components/BloomGate.tsx`（L42 redirect 先を `/login` に変更、Task 3 でラッパー化されるまでの暫定）
- `src/app/forest/_components/ForestGate.tsx`（237 行 → redirect-only shell に簡略化、Task 3 でラッパー化）
- `src/app/bloom/_constants/routes.ts`（13 行、`GARDEN_LOGIN: "/login"` 追加、`FOREST_LOGIN` は互換用残置）

#### Create

- `src/app/_lib/auth-unified.ts`（新規、想定 200-250 行）
  - `signInUnified(empId, password)` / `signOutUnified()` / `isAuthSessionUnlocked(moduleKey)` / `touchAuthSession(moduleKey)` / `clearAuthSession(moduleKey?)` / `toSyntheticEmail(empId)`
  - **`useAuthUnified()` Hook + `AuthProvider` Component**（IN-1 解決）
  - `sanitizeReturnTo(raw): string | null`（open redirect 対策）

#### Legacy rename + stub redirect

memory `feedback_no_delete_keep_legacy.md` 準拠で以下 5 ファイルを `.legacy-20260511.tsx` 改名 + 新規 stub 作成:

- `forest/_components/ForestGate.tsx` → 新規 ForestGate.tsx は `/login?returnTo=/forest/dashboard` redirect shell
- `forest/login/page.tsx` → 新規 stub `redirect("/login?returnTo=/forest/dashboard")`
- `bud/login/page.tsx` → 新規 stub（`?reason=expired` クエリは forward）
- `tree/login/page.tsx` → 新規 stub
- `root/login/page.tsx` → 新規 stub（`popReturnTo()` の値は `searchParams.returnTo` に転送、不能なら `/root` フォールバック）

### Step-by-step

#### Step 1: `_lib/auth-unified.ts` を新規作成

```typescript
// src/app/_lib/auth-unified.ts
"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from "react";
import { supabase } from "../bloom/_lib/supabase";
import type { GardenRole } from "../root/_constants/types";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export type ModuleKey = "bloom" | "forest" | "tree" | "bud" | "root" | "leaf";

const SESSION_KEY = (m: ModuleKey) => `${m}:unlockedAt`;

// ============== Synthetic Email ==============

export function toSyntheticEmail(empId: string): string {
  const digits = empId.replace(/\D/g, "").padStart(4, "0");
  return `emp${digits}@garden.internal`;
}

// ============== returnTo sanitize ==============

export function sanitizeReturnTo(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const decoded = decodeURIComponent(raw);
    if (!decoded.startsWith("/")) return null;
    if (decoded.startsWith("//")) return null;
    return decoded;
  } catch {
    return null;
  }
}

// ============== signIn / signOut ==============

export async function signInUnified(
  empId: string,
  password: string,
): Promise<{ success: boolean; error?: string; userId?: string }> {
  if (!empId || !password) {
    return { success: false, error: "社員番号とパスワードを入力してください" };
  }
  const email = toSyntheticEmail(empId.trim());
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return { success: false, error: "社員番号またはパスワードが正しくありません" };
  }
  if (typeof window !== "undefined") {
    const now = Date.now().toString();
    (["bloom", "forest", "tree", "bud", "root", "leaf"] as ModuleKey[]).forEach((m) => {
      sessionStorage.setItem(SESSION_KEY(m), now);
    });
  }
  return { success: true, userId: data.user.id };
}

export async function signOutUnified(): Promise<void> {
  if (typeof window !== "undefined") {
    (["bloom", "forest", "tree", "bud", "root", "leaf"] as ModuleKey[]).forEach((m) => {
      sessionStorage.removeItem(SESSION_KEY(m));
    });
  }
  await supabase.auth.signOut();
}

export function isAuthSessionUnlocked(moduleKey: ModuleKey = "bloom"): boolean {
  if (typeof window === "undefined") return false;
  const raw = sessionStorage.getItem(SESSION_KEY(moduleKey));
  if (!raw) return false;
  return Date.now() - parseInt(raw, 10) < TWO_HOURS_MS;
}

export function touchAuthSession(moduleKey: ModuleKey): void {
  if (typeof window === "undefined") return;
  if (isAuthSessionUnlocked(moduleKey)) {
    sessionStorage.setItem(SESSION_KEY(moduleKey), Date.now().toString());
  }
}

export function clearAuthSession(moduleKey?: ModuleKey): void {
  if (typeof window === "undefined") return;
  if (moduleKey) {
    sessionStorage.removeItem(SESSION_KEY(moduleKey));
  } else {
    (["bloom", "forest", "tree", "bud", "root", "leaf"] as ModuleKey[]).forEach((m) => {
      sessionStorage.removeItem(SESSION_KEY(m));
    });
  }
}

// ============== useAuthUnified Hook + AuthProvider (IN-1) ==============

type AuthState = {
  loading: boolean;
  isAuthenticated: boolean;
  userId: string | null;
  role: GardenRole | null;
  employeeNumber: string | null;
  signIn: (empId: string, password: string) => Promise<{ success: boolean; error?: string; userId?: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<GardenRole | null>(null);
  const [employeeNumber, setEmployeeNumber] = useState<string | null>(null);

  const fetchRole = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("root_employees")
      .select("garden_role, employee_number")
      .eq("user_id", uid)
      .single();
    setRole((data?.garden_role as GardenRole) ?? null);
    setEmployeeNumber(data?.employee_number ?? null);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user.id ?? null;
      if (!mounted) return;
      setUserId(uid);
      if (uid) await fetchRole(uid);
      setLoading(false);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user.id ?? null;
      setUserId(uid);
      if (uid) fetchRole(uid);
      else { setRole(null); setEmployeeNumber(null); }
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [fetchRole]);

  const signIn = useCallback(async (empId: string, password: string) => {
    const result = await signInUnified(empId, password);
    if (result.success && result.userId) await fetchRole(result.userId);
    return result;
  }, [fetchRole]);

  const signOut = useCallback(async () => {
    await signOutUnified();
    setUserId(null); setRole(null); setEmployeeNumber(null);
  }, []);

  const value: AuthState = useMemo(() => ({
    loading, isAuthenticated: !!userId, userId, role, employeeNumber, signIn, signOut,
  }), [loading, userId, role, employeeNumber, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthUnified(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthUnified must be used within AuthProvider");
  return ctx;
}
```

**Provider 設置箇所**: `src/app/layout.tsx`（root layout）で `<AuthProvider>{children}</AuthProvider>` でラップ。

#### Step 2: `/login` page で `returnTo` を尊重

`src/app/login/page.tsx` の onSubmit 内、redirect 部分を以下に置換:

- `signInBloom` の import を `signInUnified` に置換（中身同等）
- `useSearchParams()` で `returnTo` クエリ取得 → `sanitizeReturnTo()` 通過後、`returnTo` を優先（`roleBasedTarget` より上）
- 既存全体を `<Suspense>` boundary でラップ（`bud/login/page.tsx` L138-144 と同パターン）

#### Step 3: BloomGate redirect 先を `/login` に変更

`src/app/bloom/_components/BloomGate.tsx` L42 の `BLOOM_PATHS.FOREST_LOGIN` を `BLOOM_PATHS.GARDEN_LOGIN`（routes.ts に新規追加）に変更。dev バイパス（L30 `isDevBypass`）は維持（memory `project_bloom_auth_independence.md` 準拠）。

**注**: BloomGate / ForestGate の **本格的な ModuleGate ラッパー化は Task 3** で実施（IN-4）。Task 1 では「redirect 先の修正」と「ForestGate を redirect-only shell に簡略化」までを行う。

#### Step 4: ForestGate を redirect-only shell に簡略化

`git mv src/app/forest/_components/ForestGate.tsx src/app/forest/_components/ForestGate.legacy-20260511.tsx`

新規 `ForestGate.tsx`:

```tsx
"use client";
import { useEffect } from "react";
import { FOREST_THEME } from "../_constants/theme";

export function ForestGate() {
  useEffect(() => {
    const current = typeof window !== "undefined"
      ? window.location.pathname + window.location.search : "/forest/dashboard";
    window.location.replace(`/login?returnTo=${encodeURIComponent(current)}`);
  }, []);
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: FOREST_THEME.loginBackground, fontFamily: "'Noto Sans JP', sans-serif",
    }}>
      <p style={{ color: "#fff" }}>ログインページに移動しています…</p>
    </div>
  );
}
```

#### Step 5: モジュール login page を stub に置換（4 ファイル）

`forest/login/page.tsx`, `bud/login/page.tsx`, `tree/login/page.tsx`, `root/login/page.tsx` の 4 ファイルそれぞれで:
1. `git mv ... → .legacy-20260511.tsx`
2. 新規 stub:

```tsx
import { redirect } from "next/navigation";

export default function ForestLoginRedirect({
  searchParams,
}: { searchParams: { returnTo?: string; reason?: string } }) {
  const returnTo = searchParams.returnTo ?? "/forest/dashboard";
  const reason = searchParams.reason;
  const qs = new URLSearchParams({ returnTo });
  if (reason) qs.set("reason", reason);
  redirect(`/login?${qs.toString()}`);
}
```

（Bud は `/bud/dashboard`、Tree は `/tree/dashboard`、Root は `/root` をそれぞれデフォルト `returnTo` に。Root の `popReturnTo()` は本 Task では未対応、Phase B-5 で再検討）

#### Step 6: 統合動作確認

```
npm run build
npm run dev
# Browser で各パスにアクセス（未認証で）:
#   /bloom         → /login?returnTo=%2Fbloom
#   /forest        → /login?returnTo=%2Fforest
#   /forest/login  → /login?returnTo=%2Fforest%2Fdashboard
#   /bud/login     → /login?returnTo=%2Fbud%2Fdashboard
#   /tree/login    → /login?returnTo=%2Ftree%2Fdashboard
#   /root/login    → /login?returnTo=%2Froot
# ログイン後に returnTo へ遷移することを確認
```

### Acceptance

1. **未認証 redirect の単一化**: `/bloom`, `/forest`, `/bud/*`, `/tree/*`, `/root/*` のいずれも `/login?returnTo=<元 path>` へ 1 hop で到達
2. **ロール別 redirect**: `returnTo` 無しなら `getPostLoginRedirect` 通り、`returnTo` ありなら sanitize 通過後の値を優先
3. **互換性**: 既存ブックマーク `/forest/login` 等が stub 経由で動作
4. **open redirect 対策**: `returnTo=https://evil.com/x` / `returnTo=//evil.com` は却下、role redirect へフォールバック
5. **後方互換**: 全 5 ファイル `.legacy-20260511.tsx` が物理存在、既存 `signInBloom` 等 API 互換維持
6. **社内 PC 限定**: 既存 middleware 層の IP check を破壊しない（`/login` 自体には IP check 追加せず）

### 想定工数

**0.5d (4h)**: Step 1 = 1.5h（Hook 追加分込み）/ Step 2 = 0.5h / Step 3 = 0.25h / Step 4 = 0.5h / Step 5 = 1h / Step 6 = 0.75h

### 依存

- PR #154 merged（has_role_at_least、本 Task は SQL helper 不要だが Task 4 と並走）
- Task 2 / 3 と直列（Task 1 → 2 → 3 の順で develop 投入）

### Subagent dispatch prompt

```
Task: Garden 統一認証 Task 1 (Login 統一画面) 実装

リポジトリ: C:\garden\a-root-003
branch: feature/garden-unified-auth-task1-login（develop or workspace/a-root-003 から分岐）
仕様: docs/specs/plans/2026-05-11-garden-unified-auth-plan.md の Task 1

着手前必読 (推測禁止、必ず Read):
- 本 plan の Task 1 セクション全文
- src/app/login/page.tsx (300 行)
- src/app/_lib/auth-redirect.ts (37 行)
- src/app/bloom/_lib/auth.ts (178 行)
- src/app/bloom/_components/BloomGate.tsx (77 行)
- src/app/bloom/_constants/routes.ts (13 行)
- src/app/forest/_components/ForestGate.tsx (237 行)
- src/app/forest/login/page.tsx (57 行)
- src/app/bud/login/page.tsx (144 行)
- src/app/tree/login/page.tsx (251 行)
- src/app/root/login/page.tsx (236 行)

実装内容 (Step 1〜Step 6):
1. src/app/_lib/auth-unified.ts 新規作成（signInUnified / signOutUnified / isAuthSessionUnlocked / touchAuthSession / clearAuthSession / toSyntheticEmail / sanitizeReturnTo + useAuthUnified Hook + AuthProvider）
2. src/app/layout.tsx に AuthProvider wrap 追加
3. src/app/login/page.tsx を returnTo 対応に改修
4. src/app/bloom/_components/BloomGate.tsx の redirect 先を /login に変更
5. src/app/bloom/_constants/routes.ts に GARDEN_LOGIN: "/login" 追加
6. ForestGate.tsx を git mv で .legacy-20260511.tsx に + 新規 redirect-only shell
7. 4 モジュール login page を legacy 改名 + redirect stub

制約 (厳守):
- memory feedback_no_delete_keep_legacy.md: 削除禁止、.legacy-20260511.tsx 改名
- memory project_garden_login_office_only.md: middleware の IP check 維持
- 既存 signInBloom / signInForest / signInTree / signInBud / signInRoot は削除しない
- npm install 禁止
- main / develop 直接 push 禁止

完了条件 (self-check):
- npm run build 緑
- Acceptance 6 項目すべて満たす
- commit を Step 単位で分け、メッセージに [a-root-003] タグ付け
- docs/effort-tracking.md に予定 0.5d / 実績 Xh 追記
- PR 起票 (base: develop) + 本 plan Task 1 セクション link
```

---

## Task 2: Series Home 画面（権限別 12 モジュール grid + Sidebar filter）

### Goal

`/` (GardenHomePage) を **garden_role 8 段階の権限別に表示制御**できるようにする。

- 既存 `OrbGrid` は MODULES 12 件を全 role 一律に描画 → 権限別に visibleModules を絞る
- 既存 `Sidebar` は 7 generic NAV_ITEMS（dummy `href: "#"`）→ **モジュール直リンク + 横断抜粋ビューに置き換える**（memory `project_garden_dual_axis_navigation.md`「staff 以上に集約サイドバー」準拠）
- closer / toss / outsource は `getPostLoginRedirect` で `/` に来ない設計だが、**直 URL 叩き等で `/` に到達した場合は強制 redirect**（保険）
- 権限閾値ハードコード禁止（memory `project_configurable_permission_policies.md`）→ MVP は constant、Phase B-2 で `root_settings.module_visibility_overrides` JSON 移行 TODO 明記

### Files

| 種別 | パス | 内容 |
|---|---|---|
| Create | `src/app/_lib/module-visibility.ts` | `getVisibleModules(role)` + `getModuleVisibility(role, module)` (IN-2) + `MODULE_KEYS` + `DEFAULT_VISIBILITY_MATRIX` + `isHomeForbidden` |
| Modify | `src/app/page.tsx` | server-side で current user role 取得 → OrbGrid / Sidebar に prop で流す。outsource/closer/toss は redirect |
| Create | `src/app/_components/home/GardenHomeClient.tsx` | 旧 page.tsx の全 client ロジック移管先（機能後退なし、行単位コピー） |
| Modify | `src/app/_components/home/OrbGrid.tsx` | `visibleModules: string[]` prop 追加、MODULES filter |
| Modify | `src/app/_components/layout/Sidebar.tsx` | NAV_ITEMS をモジュール直リンク化、`visibleModules` prop filter、active 判定を pathname ベース |
| Create | `src/app/_lib/__tests__/module-visibility.test.ts` | 8 role × 12 module visibility matrix 単体テスト |

### 権限マトリクス（IN-3 確定版を再掲）

|       | Bloom | Tree | Forest | Root | Bud | Leaf | Seed | Soil | Sprout | Fruit | Rill | Calendar | `/home` 到達 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **super_admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **manager** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **staff** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ |
| **cs** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **closer** | — | — | — | — | — | — | — | — | — | — | — | — | ❌（強制 `/tree`） |
| **toss** | — | — | — | — | — | — | — | — | — | — | — | — | ❌（強制 `/tree`） |
| **outsource** | — | — | — | — | — | — | — | — | — | — | — | — | ❌（強制 `/leaf/kanden`） |

設計メモ:
- super_admin / admin / manager は表示権限上は同一。差分は **編集権限**（別 Task で `root_change_requests` 承認フロー、memory `project_garden_change_request_pattern.md`）
- staff: Soil（DB 基盤）は admin 専用、Rill（社内メッセージング）は Phase 最後着手のため staff 一般公開は β 後に有効化
- cs: 顧客対応に必要な Bloom / Tree / Leaf / Calendar の 4 module のみ
- closer / toss / outsource は `getPostLoginRedirect` で `/` に来ないが、直叩き保険として page.tsx server side で再判定 + redirect

### Step-by-step

#### Step 2-1: `module-visibility.ts` を新規作成

```ts
// src/app/_lib/module-visibility.ts
/**
 * Garden 12 モジュール × 8 role の表示マトリクス
 *
 * memory project_garden_dual_axis_navigation §「staff 以上に集約サイドバー」準拠
 * memory project_configurable_permission_policies §「ハードコード禁止」
 *   → MVP は constant、Phase B-2 で root_settings.module_visibility_overrides (jsonb) に移行
 */

export const MODULE_KEYS = [
  "Bloom", "Fruit", "Seed", "Forest",
  "Bud", "Leaf", "Tree", "Sprout",
  "Soil", "Root", "Rill", "Calendar",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];
export type GardenRole =
  | "super_admin" | "admin" | "manager" | "staff"
  | "cs" | "closer" | "toss" | "outsource";

const ALL_MODULES: ModuleKey[] = [...MODULE_KEYS];

export const DEFAULT_VISIBILITY_MATRIX: Record<GardenRole, ModuleKey[]> = {
  super_admin: ALL_MODULES,
  admin:       ALL_MODULES,
  manager:     ALL_MODULES,
  staff:       ["Bloom", "Fruit", "Seed", "Forest",
                "Bud", "Leaf", "Tree", "Sprout",
                "Root", "Calendar"], // Soil / Rill 不可
  cs:          ["Bloom", "Tree", "Leaf", "Calendar"],
  closer:      [],
  toss:        [],
  outsource:   [],
};

export function getVisibleModules(role: string | null | undefined): ModuleKey[] {
  if (!role) return DEFAULT_VISIBILITY_MATRIX.staff;
  if (role in DEFAULT_VISIBILITY_MATRIX) {
    return DEFAULT_VISIBILITY_MATRIX[role as GardenRole];
  }
  return DEFAULT_VISIBILITY_MATRIX.staff;
}

/** Task 6 テストや ModuleGate.tsx 互換のための薄い wrapper (IN-2) */
export function getModuleVisibility(
  role: string | null | undefined,
  module: ModuleKey,
): { canView: boolean } {
  return { canView: getVisibleModules(role).includes(module) };
}

export const HOME_FORBIDDEN_ROLES: GardenRole[] = ["closer", "toss", "outsource"];

export function isHomeForbidden(role: string | null | undefined): boolean {
  if (!role) return false;
  return (HOME_FORBIDDEN_ROLES as string[]).includes(role);
}

// TODO(Phase B-2): root_settings.module_visibility_overrides を読む。
```

#### Step 2-2: `page.tsx` を server component 化 + `GardenHomeClient.tsx` 分離

既存 `page.tsx`（"use client"）の全 client ロジック（theme/sound/bg carousel/weather/activity）を **`_components/home/GardenHomeClient.tsx` に行単位でコピー**。新 `page.tsx` は server component で role 取得 + 強制 redirect:

```ts
// src/app/page.tsx (新規 server component)
import { redirect } from "next/navigation";
import { createServerClient } from "./_lib/supabase/server"; // 既存 or Task 1 で整備
import { getPostLoginRedirect } from "./_lib/auth-redirect";
import { getVisibleModules, isHomeForbidden } from "./_lib/module-visibility";
import GardenHomeClient from "./_components/home/GardenHomeClient";

export default async function GardenHomePage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: emp } = await supabase
    .from("root_employees")
    .select("garden_role")
    .eq("user_id", user.id)
    .single();
  const role = emp?.garden_role ?? null;

  if (isHomeForbidden(role)) {
    redirect(getPostLoginRedirect(role));
  }
  const visibleModules = getVisibleModules(role);
  return <GardenHomeClient role={role} visibleModules={visibleModules} />;
}
```

`createServerClient` が未整備の場合は Task 1 で `src/app/_lib/supabase/server.ts` を追加（`@supabase/ssr` でラップ、cookies 経由）。

#### Step 2-3: `OrbGrid.tsx` に visibleModules filter 追加

```ts
type Props = {
  visibleModules?: readonly string[];
  onOrbHover?: (moduleKey: string) => void;
  onOrbClick?: (moduleKey: string) => void;
};

export default function OrbGrid({ visibleModules, onOrbHover, onOrbClick }: Props = {}) {
  const filtered = visibleModules
    ? MODULES.filter((m) => visibleModules.includes(m.moduleKey))
    : MODULES;
  return (
    <section className="orb-grid" data-visible-count={filtered.length}
             data-role-filtered={visibleModules ? "true" : "false"}>
      {filtered.map((m) => <OrbCard key={m.moduleKey} {/* ...既存 props... */} />)}
    </section>
  );
}
```

CSS 配置: 4 列 × 3 行 grid、cs (4 module) など少数時は 1 行になる。崩れる場合は `globals.css` の `.orb-grid[data-visible-count="4"]` 等で調整。

#### Step 2-4: `Sidebar.tsx` をモジュール直リンク化

旧 generic 7 NAV_ITEMS は **`_LEGACY_NAV_ITEMS_V28A_STEP3` として保管**（memory `feedback_no_delete_keep_legacy.md`、削除禁止）。新 NAV_ITEMS は「ホーム + 12 module 直リンク + Help」構成、`visibleModules` prop で filter、`usePathname` で active 判定:

```ts
const ALL_NAV_ITEMS: NavItem[] = [
  { label: "ホーム", iconSrc: "/images/menu_icons/menu_01_home.png", href: "/" },
  { label: "Bloom",    iconSrc: "/images/icons/bloom.png",    href: "/bloom/workboard", moduleKey: "Bloom" },
  { label: "Tree",     iconSrc: "/images/icons/tree.png",     href: "/tree",     moduleKey: "Tree" },
  { label: "Leaf",     iconSrc: "/images/icons/leaf.png",     href: "/leaf",     moduleKey: "Leaf" },
  { label: "Bud",      iconSrc: "/images/icons/bud.png",      href: "/bud",      moduleKey: "Bud" },
  { label: "Root",     iconSrc: "/images/icons/root.png",     href: "/root",     moduleKey: "Root" },
  { label: "Forest",   iconSrc: "/images/icons/forest.png",   href: "/forest",   moduleKey: "Forest" },
  { label: "Sprout",   iconSrc: "/images/icons/sprout.png",   href: "/sprout",   moduleKey: "Sprout" },
  { label: "Fruit",    iconSrc: "/images/icons/fruit.png",    href: "/fruit",    moduleKey: "Fruit" },
  { label: "Calendar", iconSrc: "/images/icons/calendar.png", href: "/calendar", moduleKey: "Calendar" },
  { label: "Seed",     iconSrc: "/images/icons/seed.png",     href: "/seed",     moduleKey: "Seed" },
  { label: "Soil",     iconSrc: "/images/icons/soil.png",     href: "/soil",     moduleKey: "Soil" },
  { label: "Rill",     iconSrc: "/images/icons/rill.png",     href: "/rill",     moduleKey: "Rill" },
];

const _LEGACY_NAV_ITEMS_V28A_STEP3: NavItem[] = [ /* 旧 generic 7 メニュー、未使用化 */ ];
```

Help カードの `href="#"` → `/help`（memory `project_garden_help_module.md`）

#### Step 2-5: `module-visibility.test.ts` で matrix 検証

```ts
import { describe, it, expect } from "vitest";
import {
  getVisibleModules, isHomeForbidden, DEFAULT_VISIBILITY_MATRIX, MODULE_KEYS,
} from "./module-visibility";

describe("module-visibility", () => {
  describe("getVisibleModules", () => {
    it.each([
      ["super_admin", 12], ["admin", 12], ["manager", 12],
      ["staff", 10], ["cs", 4],
      ["closer", 0], ["toss", 0], ["outsource", 0],
    ])("role=%s で %d module 可視", (role, count) => {
      expect(getVisibleModules(role)).toHaveLength(count);
    });

    it("staff は Soil / Rill 非可視", () => {
      const v = getVisibleModules("staff");
      expect(v).not.toContain("Soil");
      expect(v).not.toContain("Rill");
      expect(v).toContain("Bloom");
    });

    it("cs は Bloom/Tree/Leaf/Calendar の 4 module のみ", () => {
      expect(getVisibleModules("cs").sort()).toEqual(["Bloom", "Calendar", "Leaf", "Tree"]);
    });

    it("不明 role は staff にフォールバック", () => {
      expect(getVisibleModules("unknown_role")).toEqual(DEFAULT_VISIBILITY_MATRIX.staff);
      expect(getVisibleModules(null)).toEqual(DEFAULT_VISIBILITY_MATRIX.staff);
    });
  });

  describe("isHomeForbidden", () => {
    it.each(["closer", "toss", "outsource"])("%s は禁止", (role) => {
      expect(isHomeForbidden(role)).toBe(true);
    });
    it.each(["super_admin", "admin", "manager", "staff", "cs"])("%s は許可", (role) => {
      expect(isHomeForbidden(role)).toBe(false);
    });
  });

  describe("MODULE_KEYS", () => {
    it("12 モジュール完備", () => {
      expect(MODULE_KEYS).toHaveLength(12);
    });
  });
});
```

### Acceptance

| # | 検証項目 | 期待結果 |
|---|---|---|
| 1 | `npm test src/app/_lib/__tests__/module-visibility.test.ts` | 全 pass |
| 2 | super_admin / admin / manager で `/` 表示 | OrbGrid 12 個、Sidebar 12 module |
| 3 | staff で `/` 表示 | OrbGrid 10 個（Soil/Rill 欠落）、Sidebar 同様 |
| 4 | cs で `/` 表示 | OrbGrid 4 個（Bloom/Tree/Leaf/Calendar）、Sidebar 同様 |
| 5 | closer / toss → 直接 `/` URL 入力 | `/tree` に強制 redirect |
| 6 | outsource → 直接 `/` URL 入力 | `/leaf/kanden` に強制 redirect |
| 7 | 未ログインで `/` | `/login` に redirect |
| 8 | Sidebar active 判定 | `/` で「ホーム」のみ active、`/bloom/workboard` で「Bloom」のみ active |
| 9 | OrbGrid CSS 崩れなし（cs 4 module / staff 10 module）| Chrome MCP screenshot 比較で確認 |
| 10 | v2.8a Step 5 動的機能（theme/sound/bg/weather/activity）| 後退なし |

**Chrome MCP visual check**（memory `feedback_self_visual_check_with_chrome_mcp.md`）: 8 role 全てで `/` をスクリーンショット → `docs/visual-snapshots/2026-05-11-home-by-role/<role>.png`、差分は Claude 自身が判定。

### 想定工数

**0.5d (4h)**: Step 2-1 = 0.5h / 2-2 = 1.0h / 2-3 = 0.5h / 2-4 = 0.75h / 2-5 = 0.5h / Acceptance = 0.75h

### 依存

- **Task 1 完了が前提**: `createServerClient` / `getPostLoginRedirect` / `AuthProvider`
- **Task 1 と直列**（Task 2 単独 merge 不可）

### Subagent dispatch prompt

```
Task: Garden 統一認証 Task 2 (Series Home 権限別) 実装

リポジトリ: C:\garden\a-root-003
branch: feature/garden-unified-auth-task2-home（Task 1 完了後に develop から分岐）
仕様: docs/specs/plans/2026-05-11-garden-unified-auth-plan.md の Task 2

着手前必読:
- 本 plan の Task 1 + Task 2 セクション
- src/app/page.tsx (GardenHomePage)
- src/app/_components/home/OrbGrid.tsx
- src/app/_components/home/KpiGrid.tsx
- src/app/_components/layout/Sidebar.tsx
- src/app/_lib/auth-redirect.ts

実装内容 (Step 2-1〜2-5):
1. src/app/_lib/module-visibility.ts 新規作成（getVisibleModules + getModuleVisibility + isHomeForbidden + MODULE_KEYS）
2. src/app/page.tsx を server 化 + GardenHomeClient.tsx に既存 client ロジック移動
3. OrbGrid.tsx に visibleModules prop + filter
4. Sidebar.tsx をモジュール直リンク化（LEGACY 保管）
5. module-visibility.test.ts

制約:
- Task 1 の AuthProvider / createServerClient / getPostLoginRedirect が前提
- memory feedback_no_delete_keep_legacy.md / project_configurable_permission_policies.md
- v2.8a Step 5 動的機能完全維持

完了条件:
- Vitest pass
- 8 role の visual check (Chrome MCP) で matrix 通り
- npm run build 緑

完了後: PR 発行 (base: develop or Task 1 PR の後追い)
```

---

## Task 3: 各モジュール entry の共通 ModuleGate 統一

### Goal

Garden 12 モジュールの entry コンポーネントを **共通 `ModuleGate.tsx`** に統一する。

現状:
- `ForestGate.tsx`（Task 1 で redirect-only shell 化済）
- `BloomGate.tsx`（forest/login redirect workaround、Task 1 で `/login` redirect 化済）
- `TreeAuthGate.tsx`（`/tree/login` redirect + 誕生日未登録チェック）
- 他モジュール（Bud / Root / Leaf / Soil / Seed / Rill / Fruit / Sprout / Calendar）は未統一

統一後: 共通 ModuleGate に集約、各モジュール固有 Gate は薄いラッパー（min_role / loginPath 渡し）。

### Files

| 種別 | パス | 内容 |
|---|---|---|
| Create | `src/app/_components/ModuleGate.tsx` | 共通ゲート本体 |
| Create | `src/app/_components/AuthLoadingScreen.tsx` | モジュール別絵文字スピナー |
| Create | `src/app/_constants/module-min-roles.ts` | 12 モジュール minRole 一元管理 |
| Create | `src/app/access-denied/page.tsx` | role 不足時の遷移先 |
| Modify | `src/app/forest/_components/ForestGate.tsx` | ModuleGate ラッパー化（Task 1 の redirect shell から置換、IN-4） |
| Modify | `src/app/bloom/_components/BloomGate.tsx` | ModuleGate ラッパー化 + `git mv` で legacy 保管 |
| Modify | `src/app/tree/_components/TreeAuthGate.tsx` | ModuleGate + 誕生日 2 段判定 + legacy 保管 |
| Create | `src/app/{soil,root,leaf,bud,seed,rill,fruit,sprout,calendar}/layout.tsx` | 9 module の layout で ModuleGate 装着 |

minRole はハードコード禁止のため `module-min-roles.ts` で一元管理 + Phase B-2 で `root_settings` 移行 TODO。

### Step-by-step

#### Step 3-1: 共通 `ModuleGate.tsx` 作成

```tsx
// src/app/_components/ModuleGate.tsx
"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuthUnified } from "../_lib/auth-unified";
import { isRoleAtLeast, type GardenRole } from "../root/_constants/types";
import { AuthLoadingScreen } from "./AuthLoadingScreen";
import { MODULE_MIN_ROLES, type GardenModule } from "../_constants/module-min-roles";

type ModuleGateProps = {
  children: ReactNode;
  module: GardenModule;
  minRole?: GardenRole;
  loginPath?: string;
  returnToParam?: string;
  allowDevBypass?: boolean;
};

export function ModuleGate({
  children, module, minRole,
  loginPath = "/login",
  returnToParam = "returnTo",
  allowDevBypass = true,
}: ModuleGateProps) {
  const router = useRouter();
  const { loading, isAuthenticated, role } = useAuthUnified();
  const effectiveMinRole: GardenRole = minRole ?? MODULE_MIN_ROLES[module];

  const isDevBypass =
    allowDevBypass &&
    typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_AUTH_DEV_BYPASS === "1";

  const hasRequiredRole = !!role && isRoleAtLeast(role, effectiveMinRole);
  const allowed = isDevBypass || (isAuthenticated && hasRequiredRole);

  useEffect(() => {
    if (loading || allowed) return;
    if (!isAuthenticated) {
      const current = typeof window !== "undefined"
        ? window.location.pathname + window.location.search : "/";
      router.replace(`${loginPath}?${returnToParam}=${encodeURIComponent(current)}`);
      return;
    }
    router.replace(`/access-denied?module=${module}`);
  }, [loading, allowed, isAuthenticated, hasRequiredRole, loginPath, returnToParam, module, router]);

  if (allowed) return <>{children}</>;
  if (loading) return <AuthLoadingScreen module={module} message="認証確認中..." />;
  return <AuthLoadingScreen module={module} message="ログインページに移動しています..." />;
}
```

#### Step 3-2: `module-min-roles.ts` 作成

```ts
import type { GardenRole } from "../root/_constants/types";

export type GardenModule =
  | "soil" | "root" | "tree" | "leaf" | "bud" | "bloom"
  | "seed" | "forest" | "rill" | "fruit" | "sprout" | "calendar";

/**
 * NOTE (memory project_configurable_permission_policies.md):
 *   将来 admin が UI から閾値変更できる設計余地、
 *   Phase B-2 で root_settings.module_min_roles_overrides 経由で override 可能化予定。
 */
export const MODULE_MIN_ROLES: Record<GardenModule, GardenRole> = {
  soil:     "admin",     // staff には Soil 不可視
  root:     "manager",
  tree:     "toss",
  leaf:     "staff",
  bud:      "manager",
  bloom:    "staff",
  seed:     "staff",
  forest:   "manager",
  rill:     "admin",     // staff には Rill 不可視（β 後に staff 化検討）
  fruit:    "manager",
  sprout:   "staff",
  calendar: "staff",
};
```

#### Step 3-3: `AuthLoadingScreen.tsx` 作成

```tsx
// src/app/_components/AuthLoadingScreen.tsx
"use client";

import type { GardenModule } from "../_constants/module-min-roles";

const MODULE_EMOJI: Record<GardenModule, string> = {
  soil: "🟫", root: "🌱", tree: "🌳", leaf: "🍃", bud: "🌷", bloom: "🌸",
  seed: "🌾", forest: "🌲", rill: "💧", fruit: "🍎", sprout: "🌱", calendar: "📅",
};

export function AuthLoadingScreen({
  module, message,
}: { module: GardenModule; message: string }) {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg,#f8fafc 0%,#f1f5f9 100%)",
      fontFamily: "'Noto Sans JP', sans-serif",
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, padding: "32px 28px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.12)", textAlign: "center",
      }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>{MODULE_EMOJI[module]}</div>
        <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>{message}</p>
      </div>
    </div>
  );
}
```

#### Step 3-4: ForestGate を ModuleGate ラッパー化（Task 1 の redirect shell から置換、IN-4）

Task 1 で既に `.legacy-20260511.tsx` 改名済のため **二重 rename しない**。新 `ForestGate.tsx`（Task 1 で作成した redirect shell）を以下に置換:

```tsx
"use client";
import type { ReactNode } from "react";
import { ModuleGate } from "../../_components/ModuleGate";

export function ForestGate({ children }: { children: ReactNode }) {
  return (
    <ModuleGate module="forest" loginPath="/forest/login">
      {children}
    </ModuleGate>
  );
}
```

`loginPath="/forest/login"` 指定により stub 経由で `/login?returnTo=` に到達（後方互換）。直接 `/login` 指定でも OK だが、ブックマーク互換のため stub 経由を推奨。

#### Step 3-5: BloomGate を ModuleGate ラッパー化

```
git mv src/app/bloom/_components/BloomGate.tsx \
       src/app/bloom/_components/BloomGate.legacy-20260511.tsx
```

新規 `BloomGate.tsx`:

```tsx
"use client";
import type { ReactNode } from "react";
import { ModuleGate } from "../../_components/ModuleGate";
import { BLOOM_PATHS } from "../_constants/routes";

export function BloomGate({ children }: { children: ReactNode }) {
  // memory project_bloom_auth_independence.md: 当面は Forest login 経由
  return (
    <ModuleGate module="bloom" loginPath={BLOOM_PATHS.FOREST_LOGIN}>
      {children}
    </ModuleGate>
  );
}
```

#### Step 3-6: TreeAuthGate を 2 段構えラッパー化

```
git mv src/app/tree/_components/TreeAuthGate.tsx \
       src/app/tree/_components/TreeAuthGate.legacy-20260511.tsx
```

新規 `TreeAuthGate.tsx`:

```tsx
"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { ModuleGate } from "../../_components/ModuleGate";
import { TREE_PATHS } from "../_constants/screens";
import { useTreeState } from "../_state/TreeStateContext";

export function TreeAuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { treeUser } = useTreeState();
  const isLoginPage = pathname === TREE_PATHS.LOGIN;
  const isBirthdayPage = pathname === TREE_PATHS.BIRTHDAY;
  const needsBirthday = !!treeUser && treeUser.birthday === null;

  if (isLoginPage) return <>{children}</>;

  useEffect(() => {
    if (!treeUser) return;
    if (needsBirthday && !isBirthdayPage) {
      router.replace(TREE_PATHS.BIRTHDAY);
    }
  }, [treeUser, needsBirthday, isBirthdayPage, router]);

  return (
    <ModuleGate module="tree" loginPath={TREE_PATHS.LOGIN}>
      {needsBirthday && !isBirthdayPage ? null : children}
    </ModuleGate>
  );
}
```

#### Step 3-7: 残り 9 モジュール layout に ModuleGate 装着

各 `src/app/<module>/layout.tsx` を作成 or 修正:

```tsx
// 例: src/app/soil/layout.tsx
import { ModuleGate } from "../_components/ModuleGate";

export default function SoilLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGate module="soil">{children}</ModuleGate>;
}
```

12 モジュール（forest / bloom / tree は既存 Gate 経由、他 9 module は layout 直接装着）の対応:

| Module | layout 装着方法 |
|---|---|
| forest / bloom / tree | 既存 Gate.tsx 経由（Step 3-4/5/6） |
| soil | 新規 layout で ModuleGate |
| root | layout に ModuleGate 追加（既存 RootGate あれば legacy 化 + ラッパー化） |
| leaf | layout に ModuleGate 追加 |
| bud | layout に ModuleGate 追加 |
| seed | 新規 layout（モジュール自体 stub）|
| rill | 同上 |
| fruit | 同上 |
| sprout | 同上 |
| calendar | 同上 |

#### Step 3-8: `/access-denied` ページ作成

```tsx
// src/app/access-denied/page.tsx
"use client";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const MODULE_LABEL: Record<string, string> = {
  forest: "経営ダッシュボード (Forest)", bud: "経理 (Bud)", root: "マスタ (Root)",
  tree: "架電 (Tree)", bloom: "業務管理 (Bloom)", soil: "DB 基盤 (Soil)",
  leaf: "商材 (Leaf)", seed: "新事業 (Seed)", rill: "メッセージ (Rill)",
  fruit: "法人情報 (Fruit)", sprout: "採用 (Sprout)", calendar: "暦 (Calendar)",
};

export default function AccessDeniedPage() {
  const params = useSearchParams();
  const module = params.get("module") ?? "";
  const label = MODULE_LABEL[module] ?? module;
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Noto Sans JP', sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "40px 32px", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", maxWidth: 420, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🚫</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>権限がありません</h2>
        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
          {label} へのアクセス権限がアカウントに付与されていません。<br />
          管理者にお問い合わせください。
        </p>
        <Link href="/" style={{ color: "#16a34a", fontSize: 13 }}>Home へ戻る</Link>
      </div>
    </div>
  );
}
```

### Acceptance

- [ ] 12 モジュール各 layout が ModuleGate 装着済（forest/bloom/tree は既存 Gate 経由、他 9 は layout 直接）
- [ ] ForestGate.tsx / BloomGate.tsx / TreeAuthGate.tsx の 3 ファイルが薄いラッパー（10 行以内）に縮退
- [ ] `*.legacy-20260511.tsx`: ForestGate（Task 1） + BloomGate / TreeAuthGate（Task 3）の 3 ファイル存在
- [ ] 主要 entry（/forest, /bloom, /tree/dashboard, /bud, /root, /leaf/kanden）ログアウト状態で `?returnTo=` 付きでログインへ
- [ ] role 不足の閲覧者は `/access-denied?module=...` へ
- [ ] `NEXT_PUBLIC_AUTH_DEV_BYPASS=1` で全モジュール開発時バイパス可
- [ ] `npm run build` 緑（lint / type-check 全緑）

### 想定工数

**0.5d (4h)**: Step 3-1〜3-3 共通基盤 = 1h / 3-4〜3-6 既存 3 Gate = 1h / 3-7 残り 9 module = 1h / 3-8 access-denied = 0.5h / 動作確認 + commit = 0.5h

### 依存

- **Task 1**（`useAuthUnified()` Hook、AuthProvider）
- **Task 2**（getVisibleModules、minRole 整合性確認）
- 既存 Forest/Bloom/Tree state context はそのまま残置

### Subagent dispatch prompt

```
Task: Garden 12 モジュール共通 ModuleGate 統一実装

リポジトリ: C:\garden\a-root-003
branch: feature/garden-unified-auth-task3-modulegate（Task 1/2 完了後）
仕様: docs/specs/plans/2026-05-11-garden-unified-auth-plan.md の Task 3

着手前必読:
- 本 plan の Task 1 + Task 2 + Task 3 セクション
- src/app/forest/_components/ForestGate.tsx (Task 1 後の redirect shell)
- src/app/bloom/_components/BloomGate.tsx (現状 redirect workaround)
- src/app/tree/_components/TreeAuthGate.tsx (Tree 固有 2 段判定)
- memory feedback_no_delete_keep_legacy.md

実装内容 (Step 3-1〜3-8):
1. ModuleGate.tsx + AuthLoadingScreen.tsx + module-min-roles.ts 新規作成
2. ForestGate.tsx を ModuleGate ラッパー化（Task 1 で legacy 済、二重 rename しない）
3. BloomGate.tsx / TreeAuthGate.tsx を git mv で legacy 化 + ModuleGate ラッパー化
4. 残り 9 モジュール layout 装着
5. /access-denied/page.tsx 新規

制約:
- memory project_configurable_permission_policies.md: minRole 一元管理ファイル必須
- memory feedback_no_delete_keep_legacy.md: 削除禁止、.legacy-20260511.tsx 改名
- Task 1 の useAuthUnified / Task 2 の matrix と整合

Acceptance:
- 12 モジュール entry がログアウト時に returnTo 付きでログインへ
- role 不足は /access-denied
- NEXT_PUBLIC_AUTH_DEV_BYPASS=1 で全モジュールバイパス可
- npm run build 緑

完了後: feature/garden-unified-auth-task3-modulegate ブランチで PR
```

---

## Task 4: RLS 統一テンプレート整備

### Goal

PR #154 で merged された `has_role_at_least(role_min text)` と `auth_employee_number()` を活用し、今後追加されるテーブルの RLS policy を **統一テンプレート** で記述できる SQL ファイル + 設計指針を整備する。

**本 Phase のスコープ**: template SQL + 設計ガイド md + 既存 helper との対応表のみ。**既存テーブルへの実マイグレーションは行わない**（破壊リスク回避、各 module spec 改訂タイミングで段階適用）。

### Files

| 種別 | パス | 内容 |
|---|---|---|
| Create | `scripts/garden-rls-unified-template.sql` | 新規追加テーブル雛形 SQL（5 pattern + アンチパターン集） |
| Create | `docs/specs/cross-cutting/2026-05-11-garden-rls-design-guide.md` | RLS 設計ガイド md（6 章構成） |
| Modify | `scripts/root-rls-phase1.sql` | 末尾コメントに将来計画追記 |

### Step-by-step

#### Step 4-1: `garden-rls-unified-template.sql` 起草

```sql
-- ============================================================
-- Garden — 統一 RLS テンプレート（新規テーブル追加時の雛形）
-- ============================================================
-- 作成日: 2026-05-11
-- 関連: PR #154 (has_role_at_least / auth_employee_number)
-- 設計指針: docs/specs/cross-cutting/2026-05-11-garden-rls-design-guide.md
--
-- 8 段階 garden_role 階層:
--   toss(1) < closer(2) < cs(3) < staff(4) < outsource(5) < manager(6) < admin(7) < super_admin(8)
--
-- 利用可能な helper:
--   auth_employee_number()           現ユーザの employee_number (text)
--   has_role_at_least(role_min text) 現ユーザが role_min 以上か (boolean)
--   既存互換: root_can_access() ≈ has_role_at_least('manager')
--             root_can_write()  ≈ has_role_at_least('admin')
--             root_is_super_admin() ≈ has_role_at_least('super_admin')
-- ============================================================

-- Pattern A: 全員閲覧可 / admin のみ書込
--   適用例: 法人マスタ / 給与体系マスタ / バンクマスタ
-- ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY <table_name>_select ON <table_name>
--   FOR SELECT USING (has_role_at_least('staff'));
-- CREATE POLICY <table_name>_write ON <table_name>
--   FOR ALL USING (has_role_at_least('admin'))
--   WITH CHECK (has_role_at_least('admin'));

-- Pattern B: 本人 only 閲覧 + manager 以上は全件閲覧 + admin のみ書込
--   適用例: root_employees / 給与明細 / 個人勤怠
-- CREATE POLICY <table_name>_select_own ON <table_name>
--   FOR SELECT USING (employee_number = auth_employee_number());
-- CREATE POLICY <table_name>_select_manager ON <table_name>
--   FOR SELECT USING (has_role_at_least('manager'));
-- CREATE POLICY <table_name>_write_admin ON <table_name>
--   FOR ALL USING (has_role_at_least('admin')) WITH CHECK (has_role_at_least('admin'));

-- Pattern C: 自分担当 only 閲覧 + manager 全件閲覧 + 自分担当 only 書込
--   適用例: tree_prospects / leaf_cases
-- (同様 4 policy: select_own_assignment / select_manager / write_own_assignment / write_admin)

-- Pattern D: admin only（機密マスタ・監査ログ等）
--   適用例: audit_log / kot_sync_log
-- CREATE POLICY <table_name>_admin ON <table_name>
--   FOR ALL USING (has_role_at_least('admin')) WITH CHECK (has_role_at_least('admin'));

-- Pattern E: super_admin only（極秘）
--   詳細は scripts/garden-super-admin-lockdown.sql 参照（Task 5）

-- アンチパターン（memory project_rls_server_client_audit.md より）:
-- ❌ Route Handler でブラウザ用 anon supabase 流用 → RLS 100% block
-- ❌ INSERT 時に WITH CHECK 書き忘れ → 意図しない INSERT
-- ❌ 巨大テーブル WHERE で has_role_at_least() 多用 → index lost
```

#### Step 4-2: `garden-rls-design-guide.md` 起草（6 章）

1. 目的
2. helper 関数対応表（既存 ↔ 新）
3. RLS pattern 選択フローチャート（A-E）
4. 既存テーブル RLS 現状監査表（リストアップのみ、詳細は別 spec）
5. 段階的移行ロードマップ（Phase 1 = template、Phase 2 = wrapper 化、Phase 3 = module 別、Phase 4 = deprecated）
6. アンチパターン集（memory + Task 4 で発見した 3 件）

#### Step 4-3: `root-rls-phase1.sql` 末尾コメント追記

```sql
-- ============================================================
-- 将来計画 (2026-05-11 追加)
-- ============================================================
-- root_can_access() / root_can_write() は Phase B-5 で has_role_at_least() wrapper に置換予定。
-- 詳細: scripts/garden-rls-unified-template.sql
--       docs/specs/cross-cutting/2026-05-11-garden-rls-design-guide.md
```

### Acceptance

- [ ] `scripts/garden-rls-unified-template.sql` 5 pattern + アンチパターン集を含む
- [ ] `docs/specs/cross-cutting/2026-05-11-garden-rls-design-guide.md` 6 章構成
- [ ] 既存 RLS 動作（Forest / Bloom / Tree / Root）に変更なし
- [ ] PR 説明文に「実マイグレーションは別 PR」明記

### 想定工数

**0.3d (2.5h)**: Step 4-1 = 1h / 4-2 = 1h / 4-3 = 0.2h / commit + PR = 0.3h

### 依存

- PR #154 merged 済
- Task 1-3 / 5 と独立（並列可）

### Subagent dispatch prompt

```
Task: Garden 統一 RLS テンプレート + 設計ガイド整備

リポジトリ: C:\garden\a-root-003
branch: feature/garden-unified-auth-task4-rls-template
仕様: docs/specs/plans/2026-05-11-garden-unified-auth-plan.md の Task 4

着手前必読:
- scripts/root-rls-phase1.sql
- supabase/migrations/*cross_rls_helpers*.sql (PR #154 helper)
- memory project_rls_server_client_audit.md

実装内容:
1. scripts/garden-rls-unified-template.sql 新規（5 pattern）
2. docs/specs/cross-cutting/2026-05-11-garden-rls-design-guide.md 新規（6 章）
3. scripts/root-rls-phase1.sql 末尾コメント追記

スコープ外（本 Phase で実施しない）:
- 既存テーブルの実マイグレーション
- module ごとの個別 RLS 改訂

Acceptance: 既存 RLS 動作不変、npm test 既存 root テスト群緑

完了後: PR 発行
```

---

## Task 5: super_admin 権限固定（東海林さん本人専任）

### 設計方針: ハードコード採択（2026-05-11 確定、bloom-006 # 18 review + main- No. 304 §E 採択）

**ハードコード**: `super_admin = 東海林さん本人 1 名（employee_number=0008）`を SQL / コード / spec に直書きし、UI / root_settings から動的変更不可とする。

| 案 | 内容 | 採否 |
|---|---|---|
| A. ハードコード | super_admin = 東海林さん本人 1 名を SQL/コード/spec に直書き | ✅ **採択** |
| B. root_settings 可変 | admin 画面から super_admin 切替可能 | ❌ 不採択 |

採択理由:
1. super_admin 操作 = 東海林さん本人専任（memory `project_super_admin_operation.md` で恒久確定）
2. 可変化は admin → super_admin 昇格事故リスク（B 案では admin が super_admin を作れてしまう）
3. memory `project_configurable_permission_policies.md`「権限ポリシー設定変更可能設計」は admin 以下の閾値が対象、super_admin 自体は別ポリシー
4. ハードコード化で audit log の明確性向上

### Goal

memory `project_super_admin_operation.md` に従い、super_admin 昇格は東海林さん（employee_number=0008）のみ手動 SQL で実施する設計を **DB trigger + UI 制限** の 2 層 + **ハードコード方針**で固定化。

- アプリ UI からの `garden_role = 'super_admin'` UPDATE は完全禁止
- DB trigger で super_admin への変更を block（UI 改ざんバイパス防止）
- 唯一の昇格経路 = Supabase Dashboard SQL Editor（service_role）で東海林さんが直接実行
- root_settings からの動的閾値変更は **本ポリシー対象外**（admin 以下の閾値のみ対象）

### Files

| 種別 | パス | 内容 |
|---|---|---|
| Create | `scripts/garden-super-admin-lockdown.sql` | UPDATE / INSERT trigger 2 件 |
| Modify | `src/app/root/_constants/types.ts` | `GARDEN_ROLE_SELECTABLE_OPTIONS`（super_admin 除外）+ `isSuperAdminLockEnabled()` |
| Modify | `docs/specs/2026-04-25-root-phase-b-01-permissions-matrix.md` | Phase B-1 spec に申し送り追記 |
| Create | `src/app/root/_constants/__tests__/super-admin-lockdown.test.ts` | Vitest 3 件 |

### Step-by-step

#### Step 5-1: `garden-super-admin-lockdown.sql` 起草

```sql
-- ============================================================
-- Garden — super_admin 権限固定（東海林さん本人専任）
-- ============================================================
-- 作成日: 2026-05-11
-- 仕様: memory project_super_admin_operation.md
--
-- 設計:
--   1. UI からの super_admin 昇格 / 降格を DB trigger で block
--   2. 唯一の昇格経路 = Supabase Dashboard SQL Editor（service_role）
--   3. service_role 以外の更新は SQLSTATE 42501 で拒否
-- ============================================================

CREATE OR REPLACE FUNCTION prevent_super_admin_role_change()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE caller_role text := current_setting('role', true);
BEGIN
  IF caller_role = 'service_role' THEN RETURN NEW; END IF;
  IF NEW.garden_role = 'super_admin' AND
     (OLD.garden_role IS DISTINCT FROM 'super_admin') THEN
    RAISE EXCEPTION 'super_admin への昇格はアプリ UI から不可。Supabase Dashboard SQL Editor で東海林さん本人が直接 SQL 実行してください' USING ERRCODE = '42501';
  END IF;
  IF OLD.garden_role = 'super_admin' AND
     (NEW.garden_role IS DISTINCT FROM 'super_admin') THEN
    RAISE EXCEPTION 'super_admin の降格もアプリ UI から不可' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_super_admin_role_change ON root_employees;
CREATE TRIGGER trg_prevent_super_admin_role_change
  BEFORE UPDATE OF garden_role ON root_employees
  FOR EACH ROW
  WHEN (OLD.garden_role IS DISTINCT FROM NEW.garden_role)
  EXECUTE FUNCTION prevent_super_admin_role_change();

-- INSERT 時の super_admin 直接挿入も block
CREATE OR REPLACE FUNCTION prevent_super_admin_insert()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE caller_role text := current_setting('role', true);
BEGIN
  IF caller_role = 'service_role' THEN RETURN NEW; END IF;
  IF NEW.garden_role = 'super_admin' THEN
    RAISE EXCEPTION 'super_admin の UI 経由 INSERT は不可' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_super_admin_insert ON root_employees;
CREATE TRIGGER trg_prevent_super_admin_insert
  BEFORE INSERT ON root_employees
  FOR EACH ROW
  WHEN (NEW.garden_role = 'super_admin')
  EXECUTE FUNCTION prevent_super_admin_insert();
```

#### Step 5-2: `types.ts` に SELECTABLE_OPTIONS 追加

```ts
export const GARDEN_ROLE_SELECTABLE_OPTIONS: Array<{ value: GardenRole; label: string }> = [
  { value: "toss",      label: GARDEN_ROLE_LABELS.toss },
  { value: "closer",    label: GARDEN_ROLE_LABELS.closer },
  { value: "cs",        label: GARDEN_ROLE_LABELS.cs },
  { value: "staff",     label: GARDEN_ROLE_LABELS.staff },
  { value: "outsource", label: GARDEN_ROLE_LABELS.outsource },
  { value: "manager",   label: GARDEN_ROLE_LABELS.manager },
  { value: "admin",     label: GARDEN_ROLE_LABELS.admin },
  // super_admin は意図的に除外（project_super_admin_operation.md）
];

export function isSuperAdminLockEnabled(): boolean {
  return true; // 将来 root_settings 経由で override 可能化（Phase B-2）
}
```

#### Step 5-3: Phase B-1 spec に申し送り追記

`docs/specs/2026-04-25-root-phase-b-01-permissions-matrix.md` 末尾:

```markdown
## 追記: super_admin 編集 UI 禁止 (2026-05-11)

garden_role 編集 UI を実装する際は `GARDEN_ROLE_SELECTABLE_OPTIONS` を使用し、
super_admin を selectable から除外すること。
DB 側でも `scripts/garden-super-admin-lockdown.sql` で block 済。
詳細: docs/specs/plans/2026-05-11-garden-unified-auth-plan.md Task 5
```

#### Step 5-4: Vitest 3 件

```ts
// src/app/root/_constants/__tests__/super-admin-lockdown.test.ts
import { describe, it, expect } from "vitest";
import { GARDEN_ROLE_SELECTABLE_OPTIONS, isSuperAdminLockEnabled, GARDEN_ROLE_ORDER } from "../types";

describe("super_admin lockdown", () => {
  it("SELECTABLE_OPTIONS に super_admin が含まれない", () => {
    expect(GARDEN_ROLE_SELECTABLE_OPTIONS.map((o) => o.value)).not.toContain("super_admin");
  });
  it("SELECTABLE_OPTIONS は super_admin 以外の 7 ロール全部を含む", () => {
    const values = GARDEN_ROLE_SELECTABLE_OPTIONS.map((o) => o.value);
    const expected = GARDEN_ROLE_ORDER.filter((r) => r !== "super_admin");
    expect(values.sort()).toEqual(expected.sort());
  });
  it("isSuperAdminLockEnabled は true", () => {
    expect(isSuperAdminLockEnabled()).toBe(true);
  });
});
```

#### Step 5-5: SQL 適用手順（手動、東海林さん）

1. garden-dev で SQL Editor 実行
2. trigger 2 件作成確認（pg_trigger）
3. authenticated session UPDATE で 42501 確認
4. garden-prod に適用

PR 説明文に手順明記。

### Acceptance

- [ ] trigger 2 件 garden-dev 適用済
- [ ] authenticated session で `UPDATE ... garden_role='super_admin'` が 42501
- [ ] `SET ROLE service_role` でバイパス可
- [ ] SELECTABLE_OPTIONS に super_admin なし
- [ ] Vitest 3 件緑
- [ ] Phase B-1 spec 申し送り追記済

### 想定工数

**0.2d (1.5h)**

### 依存

- 独立（Task 1-4 / 6 と並列可）
- 既存 `root_employees.garden_role` 列存在

### Subagent dispatch prompt

```
Task: super_admin 権限を東海林さん本人専任に固定

リポジトリ: C:\garden\a-root-003
branch: feature/garden-unified-auth-task5-super-admin
仕様: docs/specs/plans/2026-05-11-garden-unified-auth-plan.md の Task 5

着手前必読:
- memory project_super_admin_operation.md
- scripts/root-auth-schema.sql
- scripts/root-rls-phase1.sql
- src/app/root/_constants/types.ts

実装内容 (Step 5-1〜5-5):
1. scripts/garden-super-admin-lockdown.sql trigger 2 件
2. types.ts に GARDEN_ROLE_SELECTABLE_OPTIONS + isSuperAdminLockEnabled()
3. Phase B-1 spec 申し送り
4. Vitest 3 件
5. garden-dev 適用 + 動作確認（東海林さん依頼）

制約:
- service_role バイパス削除禁止（唯一の昇格経路）
- 既存 super_admin (employee_number=0008) は変更しない

Acceptance: trigger 動作、Vitest 緑、npm run build 緑

完了後: PR 発行
```

---

## Task 6: 動作テスト + Vitest 単体テスト

### Goal

Garden 統一認証の全体動作を **8 garden_role × 12 module = 96 マトリクス + 異常系シナリオ 13 件** で網羅検証。Vitest 単体 + Chrome MCP 手動 E2E の 2 層。

### Files

| 種別 | パス | 内容 |
|---|---|---|
| Create | `src/app/_lib/__tests__/auth-unified.test.ts` | useAuthUnified Hook 単体（Task 1 対象） |
| Create | `src/app/_lib/__tests__/module-gate-redirect.test.ts` | ModuleGate redirect ロジック（Task 3 対象） |
| Create | `docs/qa/unified-auth-test-scenarios-20260511.md` | E2E シナリオ S1-S13 + 96 マトリクス |

Task 2 の `module-visibility.test.ts` は Task 2 で作成済（本 Task ではテストカバレッジ追加なし、Task 2 のテストを実行確認のみ）。

### Step-by-step

#### Step 6-1: `auth-unified.test.ts` 起草（Hook 単体 4 件）

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAuthUnified, AuthProvider } from "../auth-unified";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
  })),
}));

describe("useAuthUnified", () => {
  beforeEach(() => vi.clearAllMocks());
  it("初期: loading=true", () => { /* ... */ });
  it("signIn 成功 → isAuthenticated=true, role 取得", async () => { /* ... */ });
  it("signIn 失敗 → error", async () => { /* ... */ });
  it("signOut → state クリア", async () => { /* ... */ });
});
```

#### Step 6-2: `module-gate-redirect.test.ts` 起草（4 件）

```ts
describe("ModuleGate redirect", () => {
  it("未認証 → loginPath?returnTo", async () => { /* ... */ });
  it("role 不足 → /access-denied", async () => { /* ... */ });
  it("dev バイパス → children 描画", () => { /* ... */ });
  it("loading 中はリダイレクトしない", () => { /* ... */ });
});
```

#### Step 6-3: E2E シナリオ集起草

```markdown
# Garden 統一認証 E2E テストシナリオ集（2026-05-11）

## 0. 前提
- garden-dev で 8 ロール各 1 名のテストアカウント（社員番号 9001-9008）事前作成
- Chrome MCP 実行
- 各シナリオ ✅ / ⚠️ / ❌ で記録

## 1. ロールマトリクス（8 × 12 = 96）
（IN-3 確定版マトリクスをここに再掲、ASCII テーブル形式）

## 2. 異常系シナリオ 1-13
S1: 未認証で全 module URL 直アクセス → login redirect
S2: returnTo クエリで遷移先復元
S3: パスワード誤りで audit 記録
S4: dev バイパス挙動
S5: signOut 後の state clear
S6: 退職者ログイン block
S7: 削除済社員ログイン block
S8: 同時複数 module タブで signOut
S9: super_admin 昇格 UI block（Task 5）
S10: super_admin 降格 UI block（Task 5）
S11: service_role バイパス成功（Task 5）
S12: TreeAuthGate の誕生日未登録 2 段判定
S13: BloomGate の forest-login workaround

## 3. パフォーマンス目標
- ModuleGate render → redirect 完了 < 200ms
- /access-denied 表示 < 100ms

## 4. 不合格時調査ポイント
（略）
```

#### Step 6-4: 実行

```bash
npm test -- --run src/app/_lib/__tests__/
npm test -- --run src/app/_lib/__tests__/module-visibility.test.ts  # Task 2
npm test -- --run src/app/root/_constants/__tests__/super-admin-lockdown.test.ts  # Task 5
# Chrome MCP で S1-S13 実行、結果を md ファイルに ✅/⚠️/❌ で追記
```

### Acceptance

- [ ] Vitest 全緑（Task 2 の 12 + 本 Task の 4 + 4 + Task 5 の 3 = 23 程度）
- [ ] Chrome MCP で S1-S13 全 PASS
- [ ] 96 マトリクスの実画面検証 100% 期待値通り
- [ ] 不合格は同 md ファイルに ❌ + 詳細記録
- [ ] パフォーマンス目標クリア

### 想定工数

**0.5d (4h)**

### 依存

- **Task 1-5 全完了**
- 8 ロール各 1 名のテストアカウント garden-dev で事前作成

### Subagent dispatch prompt

```
Task: Garden 統一認証 Vitest + E2E シナリオ集

リポジトリ: C:\garden\a-root-003
branch: feature/garden-unified-auth-task6-tests
仕様: docs/specs/plans/2026-05-11-garden-unified-auth-plan.md の Task 6

着手前必読:
- Task 1-5 全成果物
- src/app/root/_constants/__tests__/garden-role.test.ts (既存 Vitest pattern)
- memory feedback_self_visual_check_with_chrome_mcp.md

実装内容 (Step 6-1〜6-4):
1. auth-unified.test.ts (Hook 単体 4 件)
2. module-gate-redirect.test.ts (4 件)
3. docs/qa/unified-auth-test-scenarios-20260511.md (S1-S13 + マトリクス)
4. Vitest 実行 + Chrome MCP E2E

事前準備（東海林さん依頼）:
- garden-dev に 8 ロール各 1 名のテストアカウント（9001-9008）
- NEXT_PUBLIC_AUTH_DEV_BYPASS=1 切替手順

Acceptance: Vitest 全緑、S1-S13 全 PASS、96 マトリクス 100%、パフォーマンス < 200ms/100ms

完了後: PR 発行
```

---

## Dependencies + Timeline

### 依存グラフ

```
Task 1 (Login 統一)        ──┬─→ Task 2 (Series Home)
                              ├─→ Task 3 (ModuleGate)
                              └─→ Task 6 (テスト)
Task 4 (RLS テンプレート)  ──→ Task 6
Task 5 (super_admin)        ──→ Task 6
                                 ↑
PR #154 (merged) ──────────────┘
```

### Timeline（圧縮版 5/11-14）

| 日 | アクション |
|---|---|
| 5/11 残り | plan 完成 + commit + push + PR 起票（本ファイル） |
| 5/12 | Task 1（login 統一）+ Task 4（RLS template、並列 subagent）+ Task 5（super_admin、並列 subagent）|
| 5/13 | Task 2（Series Home）+ Task 3（ModuleGate）|
| 5/14 | Task 6（テスト）+ a-bloom-006 review 依頼 |
| 5/15-18 | 余裕 + 後道さんデモ前 fix |

### Timeline（標準版 5/12-15）

Task 1 → 2 → 3 直列、Task 4/5 並列、Task 6 最後で 2.5d 連続。

---

## Acceptance Criteria 全体

- [ ] 12 モジュール entry がログアウト時に `/login?returnTo=` へ 1 hop で到達
- [ ] `getPostLoginRedirect` 通りに 8 ロール別 redirect 機能
- [ ] Series Home `/` で 8 ロール × 12 module visibility が IN-3 確定マトリクス通り
- [ ] role 不足は `/access-denied?module=` へ
- [ ] super_admin 昇格 / 降格が UI + DB 両層で block
- [ ] RLS 統一テンプレート + 設計ガイド整備済
- [ ] Vitest 全緑（23 程度）
- [ ] Chrome MCP E2E S1-S13 全 PASS
- [ ] 8 ロール × 12 module = 96 マトリクス実画面検証 100%
- [ ] パフォーマンス目標達成
- [ ] memory `feedback_no_delete_keep_legacy.md` 遵守（全 legacy ファイル物理存在）
- [ ] `npm run build` 緑
- [ ] PR description に Task 1-6 各セクション link 同梱
- [ ] docs/effort-tracking.md に Task 1-6 予定 / 実績 / 差分追記

---

## Handoff Template（各 Task 完了時）

```markdown
# Handoff - YYYY-MM-DD - Task N 完走

## 今やったこと
Task N（タイトル）の Step X〜Y を実装。Acceptance N 項目を満たした。

## PR
#XXX (base: develop, head: feature/garden-unified-auth-taskN-...)

## 注意点
- legacy ファイル X 件、すべて物理存在確認済
- 既存テスト Y 件、新規 Z 件で全緑
- Vercel preview で動作確認済

## 次のタスク
Task N+1 (タイトル) を開始。依存待ち: Task N の develop merge

## 関連
- plan: docs/specs/plans/2026-05-11-garden-unified-auth-plan.md
- 関連 memory: 略
```

---

## 変更履歴

- **2026-05-11 16:30** v1.0 起草（a-root-003、subagent 1/2/3 並列 + 統合）

