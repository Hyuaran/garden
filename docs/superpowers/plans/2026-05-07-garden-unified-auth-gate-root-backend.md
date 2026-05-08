# Garden Unified Auth Gate — Root Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Garden Series 統一認証ゲートの backend 実装（a-root-002 担当範囲）— 共通 signIn helper + role 別自動振分け + RootGate redirect 統一 + 既存 `/root/login` 即削除。

**Architecture:** `src/lib/auth/` 配下に共通 helper を抽出（signInGarden / resolveLandingPath / fetchGardenUser）。既存 `signInRoot / signInForest / signInBloom / signInTree` は同 helper を呼ぶ薄いラッパーへ縮退。`/login` は a-bloom-004 担当の UI で `signInGarden()` を呼び、成功時に `resolveLandingPath(role)` で行先を解決。各モジュール Gate は redirect 先を `/[module]/login` から `/login` に変更し、各モジュール `/login/page.tsx` は legacy 保持で削除。

**Tech Stack:** Next.js 16 App Router / React 19 / Supabase Auth (email+password、擬似 email 方式) / TypeScript / Vitest

**Scope (本 plan で含むもの):**
- 共通 `signInGarden()` helper（Root の signInRoot を共通化、互換性維持）
- 共通 `resolveLandingPath(role)` helper（role 別自動振分け）
- 共通 `fetchGardenUser(userId)` helper（root_employees から GardenRole 取得）
- RootGate.tsx の redirect 先を `/login` に変更
- `/root/login` 即削除（legacy 保持）
- root_employees スキーマの追加要否確認（last_login_at / login_count 等）
- Vitest 単体テスト（resolveLandingPath / fetchGardenUser モック / signInGarden）

**Scope (本 plan で含まないもの = 別担当・別 plan):**
- `/login` ルート UI 実装（a-bloom-004 担当）
- `/`（garden-home）UI 実装（a-bloom-004 担当）
- ForestGate / BloomGate / TreeAuthGate の redirect 変更（各モジュール担当）
- `/forest/login` / `/bloom/login` / `/tree/login` 削除（各モジュール担当）
- signInForest / signInBloom / signInTree の共通 helper 利用への切替（時間あれば Phase B、本 plan の Task 7-9）

**前提:**
- main- No. 83 §3 設計判断 5 件確定（特に #4: 既存 `/[module]/login` 即削除 OK、#3: role 別振分け）
- root_employees.garden_role は 8 段階（toss/closer/cs/staff/outsource/manager/admin/super_admin、Phase A-3-g 反映済）
- Bloom 側 `roleRank()` / `hasAccess()` は 7 段階のまま（outsource 未反映）→ Task 8 で同期

---

## File Structure

### 新規作成

```
src/lib/auth/
├── sign-in.ts            # signInGarden(empId, password) 共通実装
├── landing-paths.ts      # resolveLandingPath(role, returnTo?) + ROLE_LANDING_MAP
├── garden-user.ts        # fetchGardenUser(userId) + GardenRole 型 (8 段階)
├── synthetic-email.ts    # toSyntheticEmail(empId) 共通実装（既存 4 箇所からマージ）
└── __tests__/
    ├── landing-paths.test.ts
    ├── garden-user.test.ts
    ├── sign-in.test.ts
    └── synthetic-email.test.ts
```

### 修正

```
src/app/root/_components/RootGate.tsx              # redirect 先 /root/login → /login
src/app/root/_lib/auth.ts                          # signInRoot を共通 helper のラッパーに縮退
src/app/root/_lib/__tests__/                       # 既存テストは維持、新規テスト追加なし
```

### 削除（legacy 保持）

```
src/app/root/login/page.tsx
  → src/app/root/login/page.legacy-20260507.tsx (rename only)
```

---

## Task 1: GardenRole 型 + 8 段階定義の共通化

既存に類似定義が複数箇所（src/app/bloom/_lib/auth.ts は 7 段階、src/app/root/_constants/types.ts は 8 段階）あるため、共通の正本を `src/lib/auth/garden-user.ts` に置く。

**Files:**
- Create: `src/lib/auth/garden-user.ts`
- Test: `src/lib/auth/__tests__/garden-user.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/auth/__tests__/garden-user.test.ts
import { describe, it, expect } from "vitest";
import {
  GARDEN_ROLES,
  isGardenRole,
  roleRank,
  hasAccess,
  type GardenRole,
} from "@/lib/auth/garden-user";

describe("GARDEN_ROLES", () => {
  it("contains exactly 8 roles in hierarchy order", () => {
    expect(GARDEN_ROLES).toEqual([
      "toss", "closer", "cs", "staff",
      "outsource", "manager", "admin", "super_admin",
    ]);
  });
});

describe("isGardenRole", () => {
  it("accepts all 8 valid roles", () => {
    for (const role of GARDEN_ROLES) {
      expect(isGardenRole(role)).toBe(true);
    }
  });

  it("rejects unknown values", () => {
    expect(isGardenRole(null)).toBe(false);
    expect(isGardenRole(undefined)).toBe(false);
    expect(isGardenRole("ceo")).toBe(false);
    expect(isGardenRole("")).toBe(false);
    expect(isGardenRole(42)).toBe(false);
  });
});

describe("roleRank", () => {
  it("returns 0 for null / undefined / unknown", () => {
    expect(roleRank(null)).toBe(0);
    expect(roleRank(undefined)).toBe(0);
  });

  it("returns 1..8 for known roles in order", () => {
    expect(roleRank("toss")).toBe(1);
    expect(roleRank("closer")).toBe(2);
    expect(roleRank("cs")).toBe(3);
    expect(roleRank("staff")).toBe(4);
    expect(roleRank("outsource")).toBe(5);
    expect(roleRank("manager")).toBe(6);
    expect(roleRank("admin")).toBe(7);
    expect(roleRank("super_admin")).toBe(8);
  });
});

describe("hasAccess", () => {
  it("super_admin has access to all baselines", () => {
    for (const baseline of GARDEN_ROLES) {
      expect(hasAccess("super_admin", baseline)).toBe(true);
    }
  });

  it("toss has access only to toss", () => {
    expect(hasAccess("toss", "toss")).toBe(true);
    expect(hasAccess("toss", "closer")).toBe(false);
    expect(hasAccess("toss", "manager")).toBe(false);
  });

  it("manager has access to manager+ but not admin+", () => {
    expect(hasAccess("manager", "manager")).toBe(true);
    expect(hasAccess("manager", "outsource")).toBe(true);
    expect(hasAccess("manager", "admin")).toBe(false);
  });

  it("returns false for null / undefined target", () => {
    expect(hasAccess(null, "toss")).toBe(false);
    expect(hasAccess(undefined, "toss")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/lib/auth/__tests__/garden-user.test.ts`
Expected: FAIL with "Cannot find module '@/lib/auth/garden-user'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/auth/garden-user.ts
/**
 * Garden Series 共通 GardenRole 型 + ヘルパー
 *
 * 8 段階ロール（Phase A-3-g で outsource 追加）:
 *   toss < closer < cs < staff < outsource < manager < admin < super_admin
 *
 * 既存定義の正本:
 *   - src/app/root/_constants/types.ts (GARDEN_ROLE_ORDER)
 *   - src/app/bloom/_lib/auth.ts (旧 7 段階、Task 8 で本ファイル参照に変更)
 *
 * 本ファイルが Garden Series の単一情報源（Single Source of Truth）。
 */

import { supabase } from "./supabase-client";

export const GARDEN_ROLES = [
  "toss",
  "closer",
  "cs",
  "staff",
  "outsource",
  "manager",
  "admin",
  "super_admin",
] as const;

export type GardenRole = (typeof GARDEN_ROLES)[number];

export function isGardenRole(value: unknown): value is GardenRole {
  return typeof value === "string" && (GARDEN_ROLES as readonly string[]).includes(value);
}

export function roleRank(role: GardenRole | null | undefined): number {
  if (!role) return 0;
  const idx = GARDEN_ROLES.indexOf(role);
  return idx === -1 ? 0 : idx + 1;
}

export function hasAccess(
  target: GardenRole | null | undefined,
  baseline: GardenRole,
): boolean {
  return roleRank(target) >= roleRank(baseline);
}

export type GardenUser = {
  user_id: string;
  employee_id: string;
  employee_number: string;
  name: string;
  garden_role: GardenRole;
  birthday: string | null;
};

/**
 * 認証済 user_id から GardenUser を取得（root_employees から）。
 *
 * - is_active = false / deleted_at IS NOT NULL の従業員は null を返す
 * - garden_role が enum 外の値の場合 null を返す（防御的）
 * - エラー時は null を返してログ出力
 */
export async function fetchGardenUser(userId: string): Promise<GardenUser | null> {
  const { data, error } = await supabase
    .from("root_employees")
    .select("user_id, employee_id, employee_number, name, garden_role, birthday, is_active, deleted_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[garden-auth] fetchGardenUser failed:", error.message);
    return null;
  }
  if (!data) return null;
  if (!data.is_active) return null;
  if (data.deleted_at) return null;
  if (!isGardenRole(data.garden_role)) {
    console.warn("[garden-auth] unknown garden_role:", data.garden_role);
    return null;
  }
  return {
    user_id: data.user_id,
    employee_id: data.employee_id,
    employee_number: data.employee_number,
    name: data.name,
    garden_role: data.garden_role,
    birthday: data.birthday,
  };
}
```

```typescript
// src/lib/auth/supabase-client.ts (Task 1 の最小依存。Task 4 で確認後、各 module の supabase client と統合検討)
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});
```

- [ ] **Step 4: Run test to verify GardenRole/roleRank/hasAccess pass**

Run: `npm run test:run -- src/lib/auth/__tests__/garden-user.test.ts -t "GARDEN_ROLES|isGardenRole|roleRank|hasAccess"`
Expected: PASS（GARDEN_ROLES / isGardenRole / roleRank / hasAccess の各テスト）

`fetchGardenUser` は Supabase mock が必要なので Task 4 で test 追加。

- [ ] **Step 5: Run typecheck**

Run: `npx tsc --noEmit`
Expected: 新規エラーなし（事前エラー TreeStateContext.tsx:150 は無視）

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth/garden-user.ts src/lib/auth/supabase-client.ts src/lib/auth/__tests__/garden-user.test.ts
git commit -m "feat(auth): GardenRole 型 + 8 段階ロール + fetchGardenUser 共通 helper ([a-root])

Phase A Task 1: src/lib/auth/garden-user.ts に GARDEN_ROLES (8 段階)
+ isGardenRole / roleRank / hasAccess + GardenUser 型 + fetchGardenUser を集約。
既存 Bloom の 7 段階定義は Task 8 で本ファイル参照に切替予定。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: synthetic-email helper の共通化

既存 4 箇所（root / forest / bloom / tree）に同一実装の `toSyntheticEmail` がある。共通化して 1 箇所に集約。

**Files:**
- Create: `src/lib/auth/synthetic-email.ts`
- Test: `src/lib/auth/__tests__/synthetic-email.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/auth/__tests__/synthetic-email.test.ts
import { describe, it, expect } from "vitest";
import { toSyntheticEmail } from "@/lib/auth/synthetic-email";

describe("toSyntheticEmail", () => {
  it("pads single digit to 4 digits", () => {
    expect(toSyntheticEmail("8")).toBe("emp0008@garden.internal");
  });

  it("keeps 4 digit input as-is", () => {
    expect(toSyntheticEmail("0123")).toBe("emp0123@garden.internal");
    expect(toSyntheticEmail("9999")).toBe("emp9999@garden.internal");
  });

  it("strips non-digits before padding", () => {
    expect(toSyntheticEmail("emp-008")).toBe("emp0008@garden.internal");
    expect(toSyntheticEmail(" 1234 ")).toBe("emp1234@garden.internal");
  });

  it("handles empty string by padding to 0000", () => {
    expect(toSyntheticEmail("")).toBe("emp0000@garden.internal");
  });

  it("handles 5+ digit input by NOT truncating (defensive: rare case)", () => {
    // 5 桁以上は社員番号としては不正だが、padStart は伸ばさないので元の長さで通る
    expect(toSyntheticEmail("12345")).toBe("emp12345@garden.internal");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/lib/auth/__tests__/synthetic-email.test.ts`
Expected: FAIL with "Cannot find module '@/lib/auth/synthetic-email'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/auth/synthetic-email.ts
/**
 * Garden Series 共通 擬似 email 生成
 *
 * 社員番号 → 擬似 email アドレスに変換。Supabase Auth の
 * email + password 認証を社員番号運用で行うための変換層。
 *
 * 例:
 *   "8"      → "emp0008@garden.internal"
 *   "0123"   → "emp0123@garden.internal"
 *   "12345"  → "emp12345@garden.internal" （5 桁以上は社員番号としては不正だが、
 *                                            防御的に通す。validation は呼出側責任）
 *
 * 既存 4 箇所（root / forest / bloom / tree の _lib/auth.ts）に同一実装あり。
 * Task 7-9 で各モジュールから本ファイルを参照するよう変更。
 */

const SYNTHETIC_EMAIL_DOMAIN = "garden.internal";

export function toSyntheticEmail(empId: string): string {
  const digits = empId.replace(/\D/g, "").padStart(4, "0");
  return `emp${digits}@${SYNTHETIC_EMAIL_DOMAIN}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/lib/auth/__tests__/synthetic-email.test.ts`
Expected: PASS（5 件）

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/synthetic-email.ts src/lib/auth/__tests__/synthetic-email.test.ts
git commit -m "feat(auth): toSyntheticEmail を共通 helper に集約 ([a-root])

Phase A Task 2: 既存 4 箇所（root/forest/bloom/tree）の同一実装を
src/lib/auth/synthetic-email.ts に集約。Task 7-9 で各モジュール側を
本ファイル参照に切替予定。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: resolveLandingPath helper の実装

main- No. 83 §3 設計判断 #3 で確定の role 別振分け表を実装。

**Files:**
- Create: `src/lib/auth/landing-paths.ts`
- Test: `src/lib/auth/__tests__/landing-paths.test.ts`

**設計**:

| role | 既定行先 | 理由 |
|---|---|---|
| toss | `/tree` | 架電業務専従 |
| closer | `/tree` | 架電業務（クロージング） |
| cs | `/tree` | 前確/後確閲覧、架電画面起点 |
| staff | `/tree` | 一般社員、架電拠点 |
| outsource | `/leaf/kanden` | 槙さん例外、leaf-kanden 専従 |
| manager | `/root` | マスタ確認・管理者業務 |
| admin | `/` | garden-home（横断ダッシュボード）|
| super_admin | `/` | garden-home（横断、東海林さん本人）|

**例外**: `returnTo` クエリパラメータが渡された場合、role が landing 先 path 以上の権限を持つときは `returnTo` を優先。

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/auth/__tests__/landing-paths.test.ts
import { describe, it, expect } from "vitest";
import { resolveLandingPath, ROLE_LANDING_MAP } from "@/lib/auth/landing-paths";

describe("ROLE_LANDING_MAP", () => {
  it("maps each of 8 roles to a path", () => {
    expect(ROLE_LANDING_MAP.toss).toBe("/tree");
    expect(ROLE_LANDING_MAP.closer).toBe("/tree");
    expect(ROLE_LANDING_MAP.cs).toBe("/tree");
    expect(ROLE_LANDING_MAP.staff).toBe("/tree");
    expect(ROLE_LANDING_MAP.outsource).toBe("/leaf/kanden");
    expect(ROLE_LANDING_MAP.manager).toBe("/root");
    expect(ROLE_LANDING_MAP.admin).toBe("/");
    expect(ROLE_LANDING_MAP.super_admin).toBe("/");
  });
});

describe("resolveLandingPath without returnTo", () => {
  it("returns role-specific landing path for each role", () => {
    expect(resolveLandingPath("toss")).toBe("/tree");
    expect(resolveLandingPath("outsource")).toBe("/leaf/kanden");
    expect(resolveLandingPath("manager")).toBe("/root");
    expect(resolveLandingPath("super_admin")).toBe("/");
  });

  it("falls back to / for null / undefined role", () => {
    expect(resolveLandingPath(null)).toBe("/");
    expect(resolveLandingPath(undefined)).toBe("/");
  });
});

describe("resolveLandingPath with returnTo", () => {
  it("uses returnTo when it points to a path the role can access", () => {
    // admin → /root を希望
    expect(resolveLandingPath("admin", "/root")).toBe("/root");
    // super_admin → /tree を希望
    expect(resolveLandingPath("super_admin", "/tree")).toBe("/tree");
  });

  it("ignores returnTo when role lacks access (falls back to role landing)", () => {
    // toss が /root にアクセスしようとしても、role landing /tree にフォールバック
    expect(resolveLandingPath("toss", "/root")).toBe("/tree");
    // staff が / (admin only) にアクセスしようとしても、staff landing /tree にフォールバック
    expect(resolveLandingPath("staff", "/")).toBe("/tree");
  });

  it("rejects external URLs (security)", () => {
    expect(resolveLandingPath("admin", "https://evil.com")).toBe("/");
    expect(resolveLandingPath("admin", "//evil.com")).toBe("/");
    expect(resolveLandingPath("admin", "javascript:alert(1)")).toBe("/");
  });

  it("rejects empty / whitespace returnTo", () => {
    expect(resolveLandingPath("manager", "")).toBe("/root");
    expect(resolveLandingPath("manager", "   ")).toBe("/root");
  });

  it("preserves query / hash in returnTo", () => {
    expect(resolveLandingPath("admin", "/root/employees?page=2")).toBe("/root/employees?page=2");
    expect(resolveLandingPath("admin", "/root#section")).toBe("/root#section");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/lib/auth/__tests__/landing-paths.test.ts`
Expected: FAIL with "Cannot find module '@/lib/auth/landing-paths'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/auth/landing-paths.ts
/**
 * Garden Series role 別 自動振分けロジック
 *
 * main- No. 83 §3 設計判断 #3 確定:
 *   ログイン後 = role 別自動振分け
 *
 * 振分け表:
 *   toss / closer / cs / staff   → /tree         (架電業務拠点)
 *   outsource                    → /leaf/kanden  (槙さん例外、関電専従)
 *   manager                      → /root         (マスタ確認・管理者業務)
 *   admin / super_admin          → /             (garden-home 横断)
 *
 * returnTo の扱い:
 *   - role が returnTo path にアクセス可能なら returnTo を優先
 *   - アクセス不可なら role 別 landing にフォールバック
 *   - 外部 URL / javascript: は SECURITY 観点で全て reject
 */

import { hasAccess, type GardenRole } from "./garden-user";

export const ROLE_LANDING_MAP: Record<GardenRole, string> = {
  toss:        "/tree",
  closer:      "/tree",
  cs:          "/tree",
  staff:       "/tree",
  outsource:   "/leaf/kanden",
  manager:     "/root",
  admin:       "/",
  super_admin: "/",
};

/**
 * path が role でアクセス可能かを判定する。
 * landing 候補となるパス階層と最低 role の対応:
 *   /            → admin+
 *   /root        → manager+
 *   /forest      → manager+
 *   /bloom       → manager+
 *   /tree        → toss+ (= 全員)
 *   /leaf/kanden → outsource+ (cs/staff/outsource/manager+)
 *   /leaf 他     → cs+
 */
function pathRequiresRole(path: string): GardenRole {
  if (path === "/" || path === "") return "admin";
  if (path.startsWith("/root")) return "manager";
  if (path.startsWith("/forest")) return "manager";
  if (path.startsWith("/bloom")) return "manager";
  if (path.startsWith("/tree")) return "toss";
  if (path.startsWith("/leaf/kanden")) return "outsource";
  if (path.startsWith("/leaf")) return "cs";
  // 不明 path はデフォルトで admin 必須（最も厳しい）
  return "admin";
}

/**
 * returnTo が安全な内部 path かを判定する。
 * - "/" で始まるが "//" で始まらない（protocol-relative URL を弾く）
 * - "javascript:" / "data:" / "vbscript:" を弾く
 * - 空文字 / 空白のみは reject
 */
function isSafeInternalPath(returnTo: string): boolean {
  const trimmed = returnTo.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("//")) return false; // protocol-relative
  if (!trimmed.startsWith("/")) return false; // 相対 path はサポート外
  if (/^javascript:/i.test(trimmed)) return false;
  if (/^data:/i.test(trimmed)) return false;
  if (/^vbscript:/i.test(trimmed)) return false;
  return true;
}

export function resolveLandingPath(
  role: GardenRole | null | undefined,
  returnTo?: string,
): string {
  // role 既定 landing
  const roleLanding = role ? ROLE_LANDING_MAP[role] : "/";

  // returnTo 検証
  if (!returnTo || !isSafeInternalPath(returnTo)) {
    return roleLanding;
  }

  // returnTo にアクセス可能か
  const required = pathRequiresRole(returnTo);
  if (!hasAccess(role ?? null, required)) {
    return roleLanding;
  }

  return returnTo;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/lib/auth/__tests__/landing-paths.test.ts`
Expected: PASS（全件）

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/landing-paths.ts src/lib/auth/__tests__/landing-paths.test.ts
git commit -m "feat(auth): resolveLandingPath + ROLE_LANDING_MAP 実装 ([a-root])

Phase A Task 3: main- No. 83 §3 #3 確定の role 別自動振分けロジック。
8 ロール × 行先 + returnTo 安全性検証 (protocol-relative / javascript: 弾き) +
hasAccess による権限チェック (returnTo path 必要 role を超えていれば優先)。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: signInGarden 共通 helper の実装 + fetchGardenUser モックテスト

**Files:**
- Create: `src/lib/auth/sign-in.ts`
- Modify: `src/lib/auth/__tests__/garden-user.test.ts`（fetchGardenUser テスト追加）
- Test: `src/lib/auth/__tests__/sign-in.test.ts`

- [ ] **Step 1: Write the failing test for signInGarden**

```typescript
// src/lib/auth/__tests__/sign-in.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/auth/supabase-client", () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
    },
  },
}));

import { signInGarden } from "@/lib/auth/sign-in";
import { supabase } from "@/lib/auth/supabase-client";

const mockSignIn = supabase.auth.signInWithPassword as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockSignIn.mockReset();
});

describe("signInGarden", () => {
  it("returns error when empId is empty", async () => {
    const result = await signInGarden("", "pw0801");
    expect(result.success).toBe(false);
    expect(result.error).toContain("社員番号");
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("returns error when password is empty", async () => {
    const result = await signInGarden("0008", "");
    expect(result.success).toBe(false);
    expect(result.error).toContain("社員番号");
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("calls Supabase with synthetic email", async () => {
    mockSignIn.mockResolvedValueOnce({
      data: { user: { id: "user-uuid-1" } },
      error: null,
    });
    const result = await signInGarden("8", "0801");
    expect(mockSignIn).toHaveBeenCalledWith({
      email: "emp0008@garden.internal",
      password: "0801",
    });
    expect(result.success).toBe(true);
    expect(result.userId).toBe("user-uuid-1");
  });

  it("returns generic error on Supabase auth failure", async () => {
    mockSignIn.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "Invalid login credentials" },
    });
    const result = await signInGarden("0008", "wrong");
    expect(result.success).toBe(false);
    expect(result.error).toContain("社員番号またはパスワードが正しくありません");
    // 内部エラーメッセージは漏洩させない
    expect(result.error).not.toContain("Invalid login credentials");
  });

  it("returns error when user is null without error", async () => {
    mockSignIn.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });
    const result = await signInGarden("0008", "0801");
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/lib/auth/__tests__/sign-in.test.ts`
Expected: FAIL with "Cannot find module '@/lib/auth/sign-in'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/auth/sign-in.ts
/**
 * Garden Series 共通 signIn helper
 *
 * 既存 signInRoot / signInForest / signInBloom / signInTree の共通基盤。
 * 認証のみ行う（権限 garden_role 取得は呼出側 refreshAuth() 責務）。
 *
 * Phase A: Root の signInRoot を本 helper のラッパーに変更（Task 5）。
 * Phase B: Forest / Bloom / Tree も同様にラッパー化（Task 7-9、時間あれば）。
 */

import { toSyntheticEmail } from "./synthetic-email";
import { supabase } from "./supabase-client";

export type SignInResult = {
  success: boolean;
  error?: string;
  userId?: string;
};

const ERR_MISSING_INPUT = "社員番号とパスワードを入力してください";
const ERR_AUTH_FAILED = "社員番号またはパスワードが正しくありません";

export async function signInGarden(
  empId: string,
  password: string,
): Promise<SignInResult> {
  if (!empId || !password) {
    return { success: false, error: ERR_MISSING_INPUT };
  }

  const email = toSyntheticEmail(empId);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    // 内部エラーメッセージはユーザーに漏洩させない
    return { success: false, error: ERR_AUTH_FAILED };
  }

  return { success: true, userId: data.user.id };
}
```

- [ ] **Step 4: Run test to verify signInGarden tests pass**

Run: `npm run test:run -- src/lib/auth/__tests__/sign-in.test.ts`
Expected: PASS（5 件）

- [ ] **Step 5: Add fetchGardenUser tests**

Append to `src/lib/auth/__tests__/garden-user.test.ts`:

```typescript
import { vi } from "vitest";
import { fetchGardenUser } from "@/lib/auth/garden-user";

vi.mock("@/lib/auth/supabase-client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from "@/lib/auth/supabase-client";

const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

function mockSupabaseSingle(data: unknown, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error });
  const eq = vi.fn().mockReturnValue({ maybeSingle: single });
  const select = vi.fn().mockReturnValue({ eq });
  mockFrom.mockReturnValue({ select });
}

describe("fetchGardenUser", () => {
  it("returns GardenUser for active employee with valid role", async () => {
    mockSupabaseSingle({
      user_id: "u1",
      employee_id: "EMP-0008",
      employee_number: "0008",
      name: "東海林 美琴",
      garden_role: "super_admin",
      birthday: "0801",
      is_active: true,
      deleted_at: null,
    });
    const user = await fetchGardenUser("u1");
    expect(user).not.toBeNull();
    expect(user?.garden_role).toBe("super_admin");
  });

  it("returns null when employee is inactive", async () => {
    mockSupabaseSingle({
      user_id: "u2",
      employee_id: "EMP-0099",
      employee_number: "0099",
      name: "退職者",
      garden_role: "staff",
      birthday: null,
      is_active: false,
      deleted_at: null,
    });
    expect(await fetchGardenUser("u2")).toBeNull();
  });

  it("returns null when employee is logically deleted", async () => {
    mockSupabaseSingle({
      user_id: "u3",
      employee_id: "EMP-0050",
      employee_number: "0050",
      name: "削除済",
      garden_role: "staff",
      birthday: null,
      is_active: true,
      deleted_at: "2026-01-01T00:00:00Z",
    });
    expect(await fetchGardenUser("u3")).toBeNull();
  });

  it("returns null when garden_role is unknown", async () => {
    mockSupabaseSingle({
      user_id: "u4",
      employee_id: "EMP-0010",
      employee_number: "0010",
      name: "謎ロール",
      garden_role: "ceo", // 不正値
      birthday: null,
      is_active: true,
      deleted_at: null,
    });
    expect(await fetchGardenUser("u4")).toBeNull();
  });

  it("returns null on Supabase error", async () => {
    mockSupabaseSingle(null, { message: "rls denied" });
    expect(await fetchGardenUser("u5")).toBeNull();
  });
});
```

- [ ] **Step 6: Run test to verify all auth tests pass**

Run: `npm run test:run -- src/lib/auth`
Expected: PASS（全件、概算 35-45 件）

- [ ] **Step 7: Run typecheck**

Run: `npx tsc --noEmit`
Expected: 新規エラーなし

- [ ] **Step 8: Commit**

```bash
git add src/lib/auth/sign-in.ts src/lib/auth/__tests__/sign-in.test.ts src/lib/auth/__tests__/garden-user.test.ts
git commit -m "feat(auth): signInGarden 共通 helper + fetchGardenUser テスト追加 ([a-root])

Phase A Task 4: signInGarden(empId, password) を src/lib/auth/sign-in.ts に実装。
Supabase auth エラーメッセージをユーザー向けに正規化（内部エラー漏洩防止）。
fetchGardenUser のテスト 5 件追加（active/inactive/deleted_at/unknown_role/error）。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: signInRoot を共通 helper のラッパーに縮退

既存 `src/app/root/_lib/auth.ts` の `signInRoot` を共通 `signInGarden` を呼ぶラッパーに変更。後方互換維持（呼出元は無修正）。

**Files:**
- Modify: `src/app/root/_lib/auth.ts:25-50`（signInRoot 関数本体）
- Modify: `src/app/root/_lib/auth.ts:20-23`（toSyntheticEmail を共通版から re-export に変更）

- [ ] **Step 1: Verify existing tests still pass before changes**

Run: `npm run test:run -- src/app/root`
Expected: PASS（事前状態確認、ベースライン記録）

- [ ] **Step 2: Modify signInRoot to delegate to signInGarden**

Replace:
```typescript
// src/app/root/_lib/auth.ts (lines 20-50 相当)
export function toSyntheticEmail(empId: string): string {
  const digits = empId.replace(/\D/g, "").padStart(4, "0");
  return `emp${digits}@garden.internal`;
}

export async function signInRoot(
  empId: string,
  password: string,
): Promise<{ success: boolean; error?: string; userId?: string }> {
  if (!empId || !password) {
    return { success: false, error: "社員番号とパスワードを入力してください" };
  }

  const email = toSyntheticEmail(empId);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return {
      success: false,
      error: "社員番号またはパスワードが正しくありません",
    };
  }

  if (typeof window !== "undefined") {
    sessionStorage.setItem(ROOT_UNLOCKED_KEY, Date.now().toString());
  }
  return { success: true, userId: data.user.id };
}
```

With:
```typescript
// src/app/root/_lib/auth.ts
import { signInGarden, type SignInResult } from "@/lib/auth/sign-in";
export { toSyntheticEmail } from "@/lib/auth/synthetic-email";

/**
 * @deprecated 新規コードは @/lib/auth/sign-in の signInGarden を直接使用してください。
 * 本 wrapper は ROOT_UNLOCKED_KEY セッション管理のため当面残置。
 */
export async function signInRoot(
  empId: string,
  password: string,
): Promise<SignInResult> {
  const result = await signInGarden(empId, password);
  if (result.success && typeof window !== "undefined") {
    sessionStorage.setItem(ROOT_UNLOCKED_KEY, Date.now().toString());
  }
  return result;
}
```

- [ ] **Step 3: Run existing Root tests to verify no regression**

Run: `npm run test:run -- src/app/root`
Expected: PASS（同件数、Task 4 までで増えた auth helper テストは別 dir）

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit`
Expected: 新規エラーなし

- [ ] **Step 5: Commit**

```bash
git add src/app/root/_lib/auth.ts
git commit -m "refactor(root): signInRoot を signInGarden 共通 helper のラッパーに縮退 ([a-root])

Phase A Task 5: 既存 signInRoot のロジックを @/lib/auth/sign-in.signInGarden に
委譲。toSyntheticEmail も @/lib/auth/synthetic-email から re-export。
ROOT_UNLOCKED_KEY セッション管理は本 wrapper に残置 (各モジュール固有の責務)。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: RootGate redirect 先変更 + /root/login 即削除（legacy 保持）

**Files:**
- Modify: `src/app/root/_components/RootGate.tsx`
- Rename: `src/app/root/login/page.tsx` → `src/app/root/login/page.legacy-20260507.tsx`

- [ ] **Step 1: Modify RootGate.tsx**

Read current RootGate.tsx (60 行) and update redirect destination:

Replace:
```typescript
const isLoginPage = pathname === "/root/login";

useEffect(() => {
  if (!loading && !isAuthenticated && !isLoginPage) {
    if (pathname) saveReturnTo(pathname);
    router.replace("/root/login");
  }
}, [loading, isAuthenticated, isLoginPage, pathname, router]);

if (isLoginPage) return <>{children}</>;
```

With:
```typescript
// /root/login は廃止 (main- No. 83 §3 #4)、/login へ統一
useEffect(() => {
  if (!loading && !isAuthenticated) {
    if (pathname) saveReturnTo(pathname);
    // returnTo はクエリ経由で /login に渡す (resolveLandingPath が処理)
    const qs = pathname ? `?returnTo=${encodeURIComponent(pathname)}` : "";
    router.replace(`/login${qs}`);
  }
}, [loading, isAuthenticated, pathname, router]);

// /login へのリダイレクト中は何も描画しない (旧 isLoginPage 分岐は廃止、
// /root/login 自体が削除されたため Root layout 配下に存在しない)
```

- [ ] **Step 2: Rename /root/login/page.tsx to legacy file**

```bash
git mv src/app/root/login/page.tsx src/app/root/login/page.legacy-20260507.tsx
```

`page.legacy-*.tsx` は Next.js App Router がルートとして認識しないため、`/root/login` は **404** になる（意図的）。Garden Gate 経由の遷移は `/login` に向かうため問題なし。

- [ ] **Step 3: Verify /root/login no longer exists as a route**

Manual check:
- `ls src/app/root/login/`
- Expected: `page.legacy-20260507.tsx` のみ（`page.tsx` 消滅）

- [ ] **Step 4: Run existing Root tests**

Run: `npm run test:run -- src/app/root`
Expected: PASS（RootGate のテストがあれば pathname 'isLoginPage' 関連は更新必要、なければそのまま PASS）

⚠️ もし RootGate に直接テストがあれば、`isLoginPage` への期待を取り除く更新が必要（事前 grep で確認、なければスキップ）。

```bash
grep -rn "isLoginPage\|/root/login" src/app/root --include="*.tsx" --include="*.ts" | grep -v "page.legacy"
```

該当 hit があれば本 task 内で修正、なければスキップ。

- [ ] **Step 5: Run typecheck**

Run: `npx tsc --noEmit`
Expected: 新規エラーなし

- [ ] **Step 6: Commit**

```bash
git add src/app/root/_components/RootGate.tsx src/app/root/login/page.legacy-20260507.tsx
git rm src/app/root/login/page.tsx
git commit -m "feat(root): RootGate redirect を /login に統一 + /root/login 即削除 ([a-root])

Phase A Task 6: main- No. 83 §3 #4 確定 - /[module]/login 完全廃止。
- RootGate.tsx: redirect 先 /root/login → /login?returnTo=<current>
- /root/login/page.tsx → page.legacy-20260507.tsx に rename (legacy 保持、404 化)
- /login UI 本体は a-bloom-004 担当 (claude.ai 起草版 Next.js 化)
- saveReturnTo は維持 (互換性、各モジュール固有 sessionStorage キー)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7 (Phase B 1/3): signInBloom を共通 helper のラッパーに縮退

> **時間制約**: Phase A (Task 1-6) を 5/9-5/10 で完走させた後、5/11-12 で Phase B Task 7-9 を実施。時間切れの場合 Task 7-9 は post-デモに延期可（5/13 以降）。

**Files:**
- Modify: `src/app/bloom/_lib/auth.ts`（signInBloom + GardenRole 型を共通 helper へ）

- [ ] **Step 1: Verify Bloom tests pass before changes**

Run: `npm run test:run -- src/app/bloom`
Expected: PASS（ベースライン）

- [ ] **Step 2: Modify Bloom auth.ts**

Replace `signInBloom` body:
```typescript
import { signInGarden, type SignInResult } from "@/lib/auth/sign-in";
export { toSyntheticEmail } from "@/lib/auth/synthetic-email";
export {
  GARDEN_ROLES,
  isGardenRole,
  roleRank,
  hasAccess,
  type GardenRole,
} from "@/lib/auth/garden-user";

/** @deprecated 新規コードは @/lib/auth/sign-in.signInGarden を使用 */
export async function signInBloom(
  empId: string,
  password: string,
): Promise<SignInResult> {
  const result = await signInGarden(empId, password);
  if (result.success && typeof window !== "undefined") {
    sessionStorage.setItem(BLOOM_UNLOCKED_KEY, Date.now().toString());
  }
  return result;
}
```

⚠️ Bloom の旧 `roleRank` は 7 段階ベース、新 `roleRank` は 8 段階。`outsource` を含む既存コードがあれば挙動が変わる（より厳密になる方向、安全寄り）。

- [ ] **Step 3: Run Bloom tests + auth tests**

Run: `npm run test:run -- src/app/bloom src/lib/auth`
Expected: PASS（既存 Bloom テストが 7 段階 enum に依存していれば一部要修正）

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit`
Expected: 新規エラーなし。Bloom 内で 7 段階を前提する型エラーがあれば修正。

- [ ] **Step 5: Commit**

```bash
git add src/app/bloom/_lib/auth.ts
git commit -m "refactor(bloom): signInBloom + GardenRole を共通 auth helper へ統合 ([a-root])

Phase B Task 7: 7 段階 → 8 段階 (outsource 追加) で Phase A-3-g に整合。
roleRank / hasAccess も 8 段階基準。BLOOM_UNLOCKED_KEY セッション管理は維持。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8 (Phase B 2/3): signInForest を共通 helper のラッパーに縮退

**Files:**
- Modify: `src/app/forest/_lib/auth.ts`

手順は Task 7 と同型（`FOREST_UNLOCKED_KEY` を保持しつつ signInForest を signInGarden ラッパー化）。詳細はテスト + diff の差分のみで十分。

- [ ] **Step 1: Verify Forest tests baseline**

Run: `npm run test:run -- src/app/forest`
Expected: PASS

- [ ] **Step 2: Modify signInForest**

```typescript
import { signInGarden, type SignInResult } from "@/lib/auth/sign-in";
export { toSyntheticEmail } from "@/lib/auth/synthetic-email";

/** @deprecated 新規コードは signInGarden を使用 */
export async function signInForest(
  empId: string,
  password: string,
): Promise<SignInResult> {
  const result = await signInGarden(empId, password);
  if (result.success && typeof window !== "undefined") {
    sessionStorage.setItem(FOREST_UNLOCKED_KEY, Date.now().toString());
  }
  return result;
}
```

- [ ] **Step 3: Run Forest tests + auth tests**

Run: `npm run test:run -- src/app/forest src/lib/auth`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/forest/_lib/auth.ts
git commit -m "refactor(forest): signInForest を共通 auth helper へ統合 ([a-root])

Phase B Task 8: signInGarden ラッパー化、FOREST_UNLOCKED_KEY セッション管理維持。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9 (Phase B 3/3): signInTree を共通 helper のラッパーに縮退

**Files:**
- Modify: `src/app/tree/_lib/auth.ts`

- [ ] **Step 1-4: Task 7-8 と同型手順**

```typescript
import { signInGarden, type SignInResult } from "@/lib/auth/sign-in";
export { toSyntheticEmail } from "@/lib/auth/synthetic-email";

/** @deprecated 新規コードは signInGarden を使用 */
export async function signInTree(
  empId: string,
  password: string,
): Promise<SignInResult> {
  const result = await signInGarden(empId, password);
  if (result.success && typeof window !== "undefined") {
    sessionStorage.setItem(TREE_UNLOCKED_KEY, Date.now().toString());
  }
  return result;
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/tree/_lib/auth.ts
git commit -m "refactor(tree): signInTree を共通 auth helper へ統合 ([a-root])

Phase B Task 9: signInGarden ラッパー化、TREE_UNLOCKED_KEY セッション管理維持。
Phase B (Task 7-9) 完走、Garden Series 4 モジュール全 signIn が共通基盤を使用。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: 統合確認 + handoff + dispatch

**Files:**
- Create: `docs/handoff-root-202605120000-unified-auth-backend.md`
- Create: `docs/dispatches/dispatch-root-002-N-no83-completion-20260512.md`
- Modify: `docs/dispatch-counter.txt`

- [ ] **Step 1: Run all tests**

Run: `npm run test:run`
Expected: PASS（既存 + 新規 auth helper の合計）

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: 既存エラー（TreeStateContext.tsx:150）以外なし

- [ ] **Step 3: Verify all 4 module sign-in delegation**

Manual: 各 `_lib/auth.ts` の `signIn*` が `signInGarden` を呼んでいることを目視確認。

- [ ] **Step 4: Write handoff**

dispatch ヘッダー v3 形式 + main- No. 83 完了報告フォーマットに沿って記述。

- [ ] **Step 5: Update dispatch counter**

`docs/dispatch-counter.txt` を次番号に更新。

- [ ] **Step 6: Final commit**

```bash
git add docs/handoff-root-202605120000-unified-auth-backend.md \
        docs/dispatches/dispatch-root-002-N-no83-completion-20260512.md \
        docs/dispatch-counter.txt
git commit -m "docs(root): main- No. 83 認証統一 backend 完成 handoff + dispatch counter ([a-root])"
```

---

## 実行ハンドオフ

**Plan complete and saved to `docs/superpowers/plans/2026-05-07-garden-unified-auth-gate-root-backend.md`.**

実行は **subagent-driven-development** を採用。理由:
- Task 1-6 は独立性高く、各 Task 単一ファイル中心
- Task 7-9 は同型 (Bloom/Forest/Tree)、subagent 並列で時短可
- 各 Task 完了時の spec compliance + code quality review でセキュリティ重要箇所（synthetic-email regex / returnTo 検証 / Supabase mock）を検証

---

## 判断保留 / 未確認事項（実装前に a-main-013 経由で東海林さんに確認推奨）

### 判断保留 5 件

1. **outsource ロールの landing 先を `/leaf/kanden` 固定でよいか**
   - 現状: 槙さん 1 名のみ outsource ロール、leaf-kanden 専従
   - 将来 outsource が増えた場合、`/leaf` ハブに変更検討
   - 暫定: 現状維持（spec 採用済）

2. **manager ロールの landing 先を `/root` でよいか**
   - 現状方針: マスタ確認業務の起点 = /root
   - 代替案: `/`（garden-home から各モジュール入口）
   - 暫定: `/root`（東海林さんの普段の遷移パターンに近い）

3. **returnTo の path-required-role マッピング詳細**
   - `/leaf/kanden` を outsource+ にするか cs+ にするか
     - cs+ 採用なら toss/closer は弾けるが outsource は許可
     - outsource+ 採用なら更に厳密
   - 暫定: outsource+（最も厳密、運用で広げる）

4. **Phase B Task 7-9 (signIn 共通化) の実施可否**
   - 5/9-5/10 で Phase A 完走、5/11-12 で Phase B
   - 統合テストとの兼ね合いで時間切れの場合 post-デモ延期
   - 暫定: 時間あれば実施、ダメなら延期

5. **root_employees スキーマ追加要否（last_login_at / login_count 等）**
   - 現状: 追加しない方針（Phase B-5 認証セキュリティ強化 spec で扱う）
   - Phase B-5 は別 PR で実装、本 plan の範囲外
   - 暫定: 本 plan では追加なし

### 未確認事項 3 件

1. **a-bloom-004 の `/login` UI 実装で signInGarden をどう呼ぶか**
   - login.html → Next.js 化時、`onSubmit` で `signInGarden` を直接呼ぶか、`signInRoot` 等のラッパー経由か
   - 直接 `signInGarden` 推奨（共通化の意味）、各モジュール sessionStorage キーは login 後に refreshAuth で各 GardenStateContext が個別に set
   - **a-bloom-004 へ確認**

2. **garden-home (`/`) UI 実装での認証要件**
   - admin / super_admin のみアクセス可能、それ以外は role landing にリダイレクト
   - GardenHomeGate（新規）が `/` 配下で resolveLandingPath を呼ぶ想定
   - **a-bloom-004 へ確認**（実装責務分担）

3. **既存 `src/lib/supabase` (Bloom 用) との共存**
   - `src/lib/auth/supabase-client.ts` を新規作成するが、既存 Bloom 等の supabase client と重複する可能性
   - 統合 or 並存は a-bloom-004 と相談
   - **a-bloom-004 へ確認**

---

## Self-Review

### Spec coverage

| main- No. 83 §3 確定事項 | 反映 Task |
|---|---|
| #1 パス: /login + / | Task 6 (RootGate redirect → /login) ※ /login UI は a-bloom-004 担当 |
| #2 ブランディング: Garden Series | a-bloom-004 担当（本 plan 対象外）|
| #3 ログイン後 = role 別自動振分け | Task 3 (resolveLandingPath) |
| #4 全 /[module]/login 即削除 | Task 6 (/root/login 削除) ※ 他モジュールは各担当 |
| #5 デザイン = claude.ai 起草版 | a-bloom-004 担当（本 plan 対象外）|

a-root-002 担当範囲（Task 1-10）は §3 #1 / #3 / #4 を Root 観点で全カバー。

### 残課題（Plan 範囲外、別 PR）

- /login UI 実装 → a-bloom-004
- /forest/login / /tree/login 等の各モジュール削除 → 各モジュール担当
- root_employees.last_login_at 等追加 → Phase B-5 認証セキュリティ強化 spec

---

## 5/9 朝 着手用 Subagent Dispatch Prompts（plan 補強、5/8 追加）

5/9 朝 subagent-driven-development で Phase A Task 1-6 を順次 dispatch するための prompt drafts。各 prompt は本 plan の対応 Task をベースに、subagent が独立して実行できる形に整理。

### 共通 context（全 Task で paste）

```
You are implementing one task from the Garden Unified Auth Gate plan
(docs/superpowers/plans/2026-05-07-garden-unified-auth-gate-root-backend.md).

Working directory: C:\garden\a-root-002
Branch: feature/garden-unified-auth-gate-20260509 (作成済、develop ベース)

前提:
- Next.js 16 / React 19 / Supabase Auth (擬似 email + password)
- Vitest + jsdom 環境（vitest.config.ts、path alias @/ → src/）
- 既存 root_employees スキーマ：8 段階 garden_role（A-3-g 反映済）
- 「東海林さん」表現統一（「社長」表現禁止、main- No. 83 §3 #4 確定）
- /[module]/login は即削除 OK（main- No. 83 §3 #4 確定）

Implementation discipline:
- TDD strict: failing test → minimal implementation → passing → commit
- 各 Step で commit (5 step / 1 task)
- commit message: feat(auth): / refactor(root): 等、末尾 [a-root] タグ
- Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

Verification:
- npm run test:run -- src/lib/auth (or 該当 path)
- npx tsc --noEmit (新規エラーなし、既存 TreeStateContext.tsx:150 は無視)

Report format:
- DONE / DONE_WITH_CONCERNS / BLOCKED
- 追加行数 / 変更行数 / commit SHA / 判断保留事項
```

### Task 1 prompt: GardenRole 型 + 8 段階定義の共通化

```
本 plan §"Task 1: GardenRole 型 + 8 段階定義の共通化" を実装してください。

成果物:
- src/lib/auth/garden-user.ts (GARDEN_ROLES / isGardenRole / roleRank /
  hasAccess / GardenUser 型 / fetchGardenUser)
- src/lib/auth/supabase-client.ts (Supabase client 単一インスタンス)
- src/lib/auth/__tests__/garden-user.test.ts

既存 src/app/root/_constants/types.ts の GARDEN_ROLE_ORDER (8 段階) と整合。
src/app/bloom/_lib/auth.ts の旧 7 段階定義は本 task では触らない (Task 7 で更新)。

Step 1-6 は plan の Task 1 通りに実行、各 Step で commit。
```

### Task 2 prompt: synthetic-email helper の共通化

```
本 plan §"Task 2: synthetic-email helper の共通化" を実装。

成果物:
- src/lib/auth/synthetic-email.ts (toSyntheticEmail のみ)
- src/lib/auth/__tests__/synthetic-email.test.ts

既存 4 箇所（root/forest/bloom/tree の _lib/auth.ts）の同一実装の一元化。
本 task では各モジュールの auth.ts は触らない (Task 5/7-9 で更新)。

Step 1-5 は plan 通り、各 Step で commit。
```

### Task 3 prompt: resolveLandingPath helper の実装

```
本 plan §"Task 3: resolveLandingPath helper の実装" を実装。

成果物:
- src/lib/auth/landing-paths.ts (ROLE_LANDING_MAP + resolveLandingPath +
  pathRequiresRole + isSafeInternalPath)
- src/lib/auth/__tests__/landing-paths.test.ts

確定済 振分け表（main- No. 83 §3 #3）:
  toss/closer/cs/staff → /tree
  outsource → /leaf/kanden (槙さん例外)
  manager → /root
  admin/super_admin → /

returnTo 安全性:
  - 非 "/" 始まり / "//" 始まり / javascript: / data: / vbscript: 弾き
  - hasAccess() で role ≥ pathRequiresRole(returnTo) 検証

Step 1-5 plan 通り、各 Step で commit。
```

### Task 4 prompt: signInGarden 共通 helper + fetchGardenUser テスト追加

```
本 plan §"Task 4: signInGarden 共通 helper の実装 + fetchGardenUser モックテスト"
を実装。

成果物:
- src/lib/auth/sign-in.ts (signInGarden + SignInResult 型)
- src/lib/auth/__tests__/sign-in.test.ts (5 件)
- src/lib/auth/__tests__/garden-user.test.ts に fetchGardenUser テスト 5 件追加

セキュリティ:
- 内部 Supabase エラーメッセージは「社員番号またはパスワードが正しくありません」
  に正規化（漏洩防止）。

Step 1-8 plan 通り、各 Step で commit。
```

### Task 5 prompt: signInRoot を共通 helper のラッパーに縮退

```
本 plan §"Task 5: signInRoot を共通 helper のラッパーに縮退" を実施。

修正:
- src/app/root/_lib/auth.ts:25-50 (signInRoot を signInGarden ラッパー化)
- src/app/root/_lib/auth.ts:20-23 (toSyntheticEmail を re-export)

ROOT_UNLOCKED_KEY セッション管理は wrapper に残置（モジュール固有責務）。
@deprecated コメント付与で将来の直接 signInGarden 呼び出しへ誘導。

Step 1-5 plan 通り、各 Step で commit。
```

### Task 6 prompt: RootGate redirect 先変更 + /root/login 即削除

```
本 plan §"Task 6: RootGate redirect 先変更 + /root/login 即削除（legacy 保持）"
を実施。

修正:
- src/app/root/_components/RootGate.tsx (redirect 先 /root/login → /login?returnTo=...)
- src/app/root/login/page.tsx → page.legacy-20260507.tsx (rename、404 化)

注意:
- isLoginPage 分岐は廃止（/root/login が消滅したため）
- saveReturnTo は維持（互換性、ROOT_RETURN_TO_KEY セッション）
- /login UI 本体は a-bloom-004 担当（本 task ではタッチしない）

Step 1-6 plan 通り、各 Step で commit。
```

### Phase B Task 7-9 prompt drafts（時間あれば 5/11-12）

各 task は plan §Task 7/8/9 通り。共通テンプレ:

```
本 plan §"Task <N> (Phase B <X>/3): signIn<Module> を共通 helper のラッパーに縮退"
を実施。

修正:
- src/app/<module>/_lib/auth.ts (signIn<Module> を signInGarden ラッパー化)

注意 (Task 7 のみ):
- Bloom 旧 7 段階 GardenRole / roleRank / hasAccess を Task 1 の共通版に置換
- @/lib/auth/garden-user から re-export

Step 1-5 plan 通り、各 Step で commit。
```

### Task 10 prompt: 統合確認 + handoff + dispatch

```
本 plan §"Task 10: 統合確認 + handoff + dispatch" を実施。

成果物:
- docs/handoff-root-202605120000-unified-auth-backend.md (handoff)
- docs/dispatches/dispatch-root-002-N-no83-completion-20260512.md (完了報告)
- docs/dispatch-counter.txt 更新

最終確認:
- npm run test:run (全テスト pass)
- npx tsc --noEmit (新規エラーなし)
- 4 モジュール signIn が signInGarden delegation 確認

Phase A 完走時に Phase B 未着手 / 部分着手の旨を handoff に明示。
```

### Subagent モデル選定指針

| Task | 推奨モデル | 理由 |
|---|---|---|
| Task 1 / 2 / 3 / 4 | sonnet | mechanical TDD task、定型 |
| Task 5 / 6 | sonnet | 既存ファイル小修正 |
| Task 7-9 | sonnet | Task 5 同型、繰返し |
| Task 10 | sonnet | docs 中心 |

opus は本 plan 範囲では不要（spec / plan は 5/7 起草済、設計判断は a-main-013 確定済）。

