# Tree Phase B-β B 経路 マイページ誕生日変更モーダル 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** マイページから誕生日を変更すると `root_employees.birthday` と Supabase Auth パスワードが一体的に更新される機能を、Server Action + RLS 安全な権限委譲 + Vitest/RTL TDD で実装する。

**Architecture:**
- **UI**: `/tree/mypage` に「誕生日を変更する」ボタン → `ChangeBirthdayModal` コンポーネントで「新誕生日 + 現パスワード」入力 → Server Action 呼出
- **API**: `changeBirthdayWithPassword` Server Action がサーバー側で本人確認・birthday UPDATE・Auth password 更新・監査ログ記録を一体トランザクションで実行（②失敗時は①を逆方向 UPDATE で補償、③ best-effort）
- **Test**: Vitest で Supabase クライアントを mock し errorCode 7 種を網羅、RTL でモーダル UI 動作を検証

**Tech Stack:** Next.js 16 App Router (Server Actions) / Supabase JS v2 (admin + anon) / Vitest 4 / @testing-library/react / TypeScript strict

**仕様書参照:** `docs/specs/2026-04-25-tree-phase-b-beta-mypage-birthday-modal.md`（§1〜§8 + 付録A/B）

---

## 前提条件（プラン実行前にチェック）

実装着手日に develop の最新状態で以下が揃っていることを確認する。揃っていないものがあれば、本プランを保留して a-main にエスカレーション：

- [ ] `src/lib/supabase/admin.ts` に `getSupabaseAdmin()` がある（確認済 2026-04-25）
- [ ] `supabase/migrations/` 系で `root_audit_log` テーブルがプロジェクトに存在する（develop の garden Supabase に SQL 適用済か東海林さんに確認）
- [ ] PostgreSQL 関数 `is_user_active()` / `garden_role_of(uuid)` が garden Supabase に存在する（migration `20260425000002_root_employees_outsource_extension.sql` が apply 済か東海林さんに確認）
- [ ] PR #45（feature/tree-phase-b-release）が merge 済（A 経路の API route が develop に存在する）

PR #45 merge 済との確認は a-main から既に共有済（2026-04-25）。

---

## ファイル構成（全体像）

### 新規作成

| ファイル | 責務 |
|---|---|
| `src/app/tree/_actions/change-birthday-with-password.ts` | Server Action 本体。型定義 + サーバー処理 |
| `src/app/tree/_actions/__tests__/change-birthday-with-password.test.ts` | Vitest（7 ケース） |
| `src/app/tree/mypage/_components/ChangeBirthdayModal.tsx` | モーダル UI（クライアントコンポーネント） |
| `src/app/tree/mypage/_components/__tests__/ChangeBirthdayModal.test.tsx` | RTL（6 ケース） |

### 既存変更

| ファイル | 変更内容 |
|---|---|
| `src/app/tree/mypage/page.tsx` | 「誕生日を変更する」ボタン追加、モーダル配置、成功時の `refreshAuth` + 成功メッセージ表示 |
| `docs/phase-b-beta-e2e-checklist.md` | §B 経路 STEP 12-15 の「次フェーズ実装後に有効化」前置きを削除 |

---

## Task 0: effort-tracking 予定行追加（プラン着手宣言）

**Files:**
- Modify: `docs/effort-tracking.md`

- [ ] **Step 1: develop 最新化**

```bash
cd C:/garden/a-tree
git fetch origin develop
git pull origin develop
git checkout feature/tree-phase-b-beta-mypage-modal
git rebase origin/develop  # 競合あれば手動解消（effort-tracking.md は develop 側採用）
```

- [ ] **Step 2: 既存 effort-tracking.md フォーマットを目視確認**

```bash
head -25 docs/effort-tracking.md
```

期待: `| module | phase / task | estimated_days | actual_days | diff | session | started | finished | notes |` のヘッダ行を確認

- [ ] **Step 3: Tree B 経路実装の予定行を追加**

`docs/effort-tracking.md` の `## 履歴` セクション末尾（最後の `|` 行の直後）に以下 1 行を追記：

```markdown
| Tree | Phase B-β B 経路: マイページ誕生日変更モーダル | 0.5 | | | a-tree (A) | 2026-04-25 | | TDD（Server Action + ChangeBirthdayModal）。docs/specs/2026-04-25-tree-phase-b-beta-mypage-birthday-modal.md 準拠、案 C 一体トランザクション採用。 |
```

- [ ] **Step 4: Commit**

```bash
git add docs/effort-tracking.md
git commit -m "docs: effort-tracking 更新 (tree) — Phase B-β B 経路実装着手予定"
```

---

## Task 1: Server Action 雛形（型定義 + 失敗専用スケルトン）

**Files:**
- Create: `src/app/tree/_actions/change-birthday-with-password.ts`

- [ ] **Step 1: Server Action ファイルを作成（型定義 + 必ず UNKNOWN を返すスケルトン）**

```typescript
"use server";

/**
 * Tree Phase B-β B 経路：マイページから誕生日を変更し、
 * Auth パスワードも MMDD に同期する Server Action。
 *
 * 仕様書: docs/specs/2026-04-25-tree-phase-b-beta-mypage-birthday-modal.md
 * 親仕様: docs/specs/2026-04-24-tree-phase-b-beta-birthday-password.md §2.1 B 経路
 */

import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type ChangeBirthdayWithPasswordInput = {
  /** YYYY-MM-DD 形式 */
  newBirthday: string;
  /** 本人確認用の現在のパスワード */
  currentPassword: string;
  /** クライアント側 supabase.auth.getSession().access_token */
  accessToken: string;
};

export type ChangeBirthdayErrorCode =
  | "UNAUTHENTICATED"
  | "INVALID_FORMAT"
  | "SAME_AS_CURRENT"
  | "WRONG_PASSWORD"
  | "RATE_LIMITED"
  | "TRANSACTION_FAILED"
  | "UNKNOWN";

export type ChangeBirthdayWithPasswordResult =
  | { success: true }
  | {
      success: false;
      errorCode: ChangeBirthdayErrorCode;
      errorMessage: string;
    };

const ERROR_MESSAGES: Record<ChangeBirthdayErrorCode, string> = {
  UNAUTHENTICATED: "認証が切れました。再ログインしてください",
  INVALID_FORMAT: "誕生日の形式が正しくありません",
  SAME_AS_CURRENT:
    "現在の誕生日と同じ値です。異なる日付を入力してください",
  WRONG_PASSWORD: "現在のパスワードが違います",
  RATE_LIMITED:
    "短時間に連続しての変更はできません。10 分以上空けて再度お試しください",
  TRANSACTION_FAILED:
    "一時的な障害が発生しました。少し待ってから再度お試しください",
  UNKNOWN:
    "不明なエラーが発生しました。時間をおいて再度お試しください",
};

function fail(
  errorCode: ChangeBirthdayErrorCode,
  override?: string,
): ChangeBirthdayWithPasswordResult {
  return {
    success: false,
    errorCode,
    errorMessage: override ?? ERROR_MESSAGES[errorCode],
  };
}

export async function changeBirthdayWithPassword(
  _input: ChangeBirthdayWithPasswordInput,
): Promise<ChangeBirthdayWithPasswordResult> {
  return fail("UNKNOWN");
}
```

- [ ] **Step 2: 型チェック**

```bash
npx tsc --noEmit
```

期待: エラー無し（`getSupabaseAdmin` と `createClient` の import が解決される、`_input` は未使用警告だが TS 的には OK）

- [ ] **Step 3: Commit**

```bash
git add src/app/tree/_actions/change-birthday-with-password.ts
git commit -m "feat(tree): change-birthday-with-password Server Action 雛形（型定義 + スケルトン）"
```

---

## Task 2: Vitest テスト基盤 + UNAUTHENTICATED ケース

**Files:**
- Create: `src/app/tree/_actions/__tests__/change-birthday-with-password.test.ts`
- Modify: `src/app/tree/_actions/change-birthday-with-password.ts`

- [ ] **Step 1: 失敗テストを書く**

`src/app/tree/_actions/__tests__/change-birthday-with-password.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@supabase/supabase-js", () => {
  return {
    createClient: vi.fn(),
  };
});
vi.mock("@/lib/supabase/admin", () => {
  return {
    getSupabaseAdmin: vi.fn(),
  };
});

import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { changeBirthdayWithPassword } from "../change-birthday-with-password";

const mockedCreateClient = vi.mocked(createClient);
const mockedGetSupabaseAdmin = vi.mocked(getSupabaseAdmin);

type AnonClientMock = {
  auth: {
    getUser: ReturnType<typeof vi.fn>;
    signInWithPassword: ReturnType<typeof vi.fn>;
  };
};
type AdminClientMock = {
  from: ReturnType<typeof vi.fn>;
  auth: { admin: { updateUserById: ReturnType<typeof vi.fn> } };
};

function buildAnonClient(): AnonClientMock {
  return {
    auth: {
      getUser: vi.fn(),
      signInWithPassword: vi.fn(),
    },
  };
}
function buildAdminClient(): AdminClientMock {
  return {
    from: vi.fn(),
    auth: { admin: { updateUserById: vi.fn() } },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("changeBirthdayWithPassword - UNAUTHENTICATED", () => {
  it("無効な access_token なら UNAUTHENTICATED を返す", async () => {
    const anon = buildAnonClient();
    anon.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "invalid token" },
    });
    mockedCreateClient.mockReturnValue(anon as never);
    mockedGetSupabaseAdmin.mockReturnValue(buildAdminClient() as never);

    const result = await changeBirthdayWithPassword({
      newBirthday: "1990-05-07",
      currentPassword: "0507",
      accessToken: "bad-token",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe("UNAUTHENTICATED");
    }
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
npx vitest run src/app/tree/_actions/__tests__/change-birthday-with-password.test.ts
```

期待: FAIL（現状はスケルトンが常に UNKNOWN を返すため）

- [ ] **Step 3: Server Action に access_token 検証を実装**

`src/app/tree/_actions/change-birthday-with-password.ts` の `changeBirthdayWithPassword` を以下に置換：

```typescript
export async function changeBirthdayWithPassword(
  input: ChangeBirthdayWithPasswordInput,
): Promise<ChangeBirthdayWithPasswordResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return fail("UNKNOWN");

  const verifyClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } =
    await verifyClient.auth.getUser(input.accessToken);
  if (userError || !userData?.user) return fail("UNAUTHENTICATED");

  return fail("UNKNOWN");
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npx vitest run src/app/tree/_actions/__tests__/change-birthday-with-password.test.ts
```

期待: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/tree/_actions/
git commit -m "feat(tree): change-birthday Server Action: UNAUTHENTICATED 検証"
```

---

## Task 3: INVALID_FORMAT ケース

**Files:**
- Modify: `src/app/tree/_actions/__tests__/change-birthday-with-password.test.ts`
- Modify: `src/app/tree/_actions/change-birthday-with-password.ts`

- [ ] **Step 1: 失敗テストを追加**

既存 test ファイルの末尾（`describe(...)` の後）に追加：

```typescript
describe("changeBirthdayWithPassword - INVALID_FORMAT", () => {
  function setupAuthenticated() {
    const anon = buildAnonClient();
    anon.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "emp1324@garden.internal" } },
      error: null,
    });
    mockedCreateClient.mockReturnValue(anon as never);
    mockedGetSupabaseAdmin.mockReturnValue(buildAdminClient() as never);
    return anon;
  }

  it("YYYY-MM-DD 形式以外なら INVALID_FORMAT", async () => {
    setupAuthenticated();
    const result = await changeBirthdayWithPassword({
      newBirthday: "1990/05/07",
      currentPassword: "0507",
      accessToken: "ok-token",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errorCode).toBe("INVALID_FORMAT");
  });

  it("未来日付なら INVALID_FORMAT", async () => {
    setupAuthenticated();
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const result = await changeBirthdayWithPassword({
      newBirthday: future,
      currentPassword: "0507",
      accessToken: "ok-token",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errorCode).toBe("INVALID_FORMAT");
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
npx vitest run src/app/tree/_actions/__tests__/change-birthday-with-password.test.ts
```

期待: 既存 1 PASS + 新規 2 FAIL（INVALID_FORMAT 検証が無いため UNKNOWN を返す）

- [ ] **Step 3: 形式検証を実装**

`src/app/tree/_actions/change-birthday-with-password.ts` の Server Action 末尾の `return fail("UNKNOWN");` の前に挿入：

```typescript
  const dateMatch = input.newBirthday.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) return fail("INVALID_FORMAT");
  const todayStr = new Date().toISOString().slice(0, 10);
  if (input.newBirthday > todayStr) return fail("INVALID_FORMAT");
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npx vitest run src/app/tree/_actions/__tests__/change-birthday-with-password.test.ts
```

期待: 3 件全 PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/tree/_actions/
git commit -m "feat(tree): change-birthday Server Action: INVALID_FORMAT 検証（YYYY-MM-DD + 未来日付禁止）"
```

---

## Task 4: SAME_AS_CURRENT ケース

**Files:**
- Modify: `src/app/tree/_actions/__tests__/change-birthday-with-password.test.ts`
- Modify: `src/app/tree/_actions/change-birthday-with-password.ts`

- [ ] **Step 1: モック helper 追加 + 失敗テスト**

既存 test ファイルの先頭付近（`buildAdminClient` 関数の下）に helper を追加：

```typescript
type FromMock = {
  select: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
};
function buildFrom(): FromMock {
  const m: FromMock = {
    select: vi.fn().mockReturnThis() as never,
    update: vi.fn().mockReturnThis() as never,
    insert: vi.fn().mockReturnThis() as never,
    eq: vi.fn().mockReturnThis() as never,
    gte: vi.fn().mockReturnThis() as never,
    maybeSingle: vi.fn(),
  };
  return m;
}
```

そして describe ブロックを追加：

```typescript
describe("changeBirthdayWithPassword - SAME_AS_CURRENT", () => {
  it("新誕生日が現誕生日と同じなら SAME_AS_CURRENT", async () => {
    const anon = buildAnonClient();
    anon.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "emp1324@garden.internal" } },
      error: null,
    });
    const admin = buildAdminClient();
    const employeesFrom = buildFrom();
    employeesFrom.maybeSingle.mockResolvedValue({
      data: { birthday: "1990-05-07", employee_number: "1324" },
      error: null,
    });
    admin.from.mockImplementation((table: string) => {
      if (table === "root_employees") return employeesFrom;
      return buildFrom();
    });
    mockedCreateClient.mockReturnValue(anon as never);
    mockedGetSupabaseAdmin.mockReturnValue(admin as never);

    const result = await changeBirthdayWithPassword({
      newBirthday: "1990-05-07",
      currentPassword: "0507",
      accessToken: "ok-token",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.errorCode).toBe("SAME_AS_CURRENT");
  });
});
```

- [ ] **Step 2: テスト実行で失敗確認**

```bash
npx vitest run src/app/tree/_actions/__tests__/change-birthday-with-password.test.ts
```

期待: 既存 3 PASS + 新規 1 FAIL

- [ ] **Step 3: 現 birthday 取得 + 同値チェックを実装**

`src/app/tree/_actions/change-birthday-with-password.ts` の `if (input.newBirthday > todayStr)` 行の直後に挿入：

```typescript
  const admin = getSupabaseAdmin();
  const { data: employee, error: empError } = await admin
    .from("root_employees")
    .select("birthday, employee_number")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (empError || !employee) return fail("UNAUTHENTICATED");

  if (employee.birthday === input.newBirthday) return fail("SAME_AS_CURRENT");
```

- [ ] **Step 4: テスト全 PASS 確認**

```bash
npx vitest run src/app/tree/_actions/__tests__/change-birthday-with-password.test.ts
```

期待: 4 件全 PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/tree/_actions/
git commit -m "feat(tree): change-birthday Server Action: SAME_AS_CURRENT 検証 + employee 取得"
```

---

## Task 5: WRONG_PASSWORD ケース（現パス検証）

**Files:**
- Modify: `src/app/tree/_actions/__tests__/change-birthday-with-password.test.ts`
- Modify: `src/app/tree/_actions/change-birthday-with-password.ts`

- [ ] **Step 1: 失敗テスト**

```typescript
describe("changeBirthdayWithPassword - WRONG_PASSWORD", () => {
  it("現パス検証が失敗したら WRONG_PASSWORD", async () => {
    const anon = buildAnonClient();
    anon.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "emp1324@garden.internal" } },
      error: null,
    });
    // signInWithPassword は新規 anon クライアントで呼ばれる想定 →
    // mockedCreateClient が複数回呼ばれるため、2 回目以降は別の mock を返す
    const verifyClient = buildAnonClient();
    verifyClient.auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials" },
    });

    let createClientCalls = 0;
    mockedCreateClient.mockImplementation(() => {
      createClientCalls += 1;
      return (createClientCalls === 1 ? anon : verifyClient) as never;
    });

    const admin = buildAdminClient();
    const employeesFrom = buildFrom();
    employeesFrom.maybeSingle.mockResolvedValue({
      data: { birthday: "1990-05-07", employee_number: "1324" },
      error: null,
    });
    admin.from.mockImplementation(() => employeesFrom);
    mockedGetSupabaseAdmin.mockReturnValue(admin as never);

    const result = await changeBirthdayWithPassword({
      newBirthday: "1985-12-03",
      currentPassword: "wrong-pass",
      accessToken: "ok-token",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.errorCode).toBe("WRONG_PASSWORD");
  });
});
```

- [ ] **Step 2: テスト実行で失敗確認**

```bash
npx vitest run src/app/tree/_actions/__tests__/change-birthday-with-password.test.ts
```

期待: 4 PASS + 1 FAIL

- [ ] **Step 3: 現パス検証を実装**

`employee.birthday === input.newBirthday` の return の直後に挿入：

```typescript
  const passwordVerifyClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInError } =
    await passwordVerifyClient.auth.signInWithPassword({
      email: userData.user.email!,
      password: input.currentPassword,
    });
  if (signInError) return fail("WRONG_PASSWORD");
```

- [ ] **Step 4: テスト全 PASS 確認**

```bash
npx vitest run src/app/tree/_actions/__tests__/change-birthday-with-password.test.ts
```

期待: 5 件全 PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/tree/_actions/
git commit -m "feat(tree): change-birthday Server Action: WRONG_PASSWORD 検証（現パス再確認）"
```

---

## Task 6: RATE_LIMITED ケース

**Files:**
- Modify: `src/app/tree/_actions/__tests__/change-birthday-with-password.test.ts`
- Modify: `src/app/tree/_actions/change-birthday-with-password.ts`

- [ ] **Step 1: 失敗テスト**

```typescript
describe("changeBirthdayWithPassword - RATE_LIMITED", () => {
  function setupSuccessUntilRateCheck() {
    const anon = buildAnonClient();
    anon.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "emp1324@garden.internal" } },
      error: null,
    });
    const verifyClient = buildAnonClient();
    verifyClient.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: "user-123" }, session: { access_token: "x" } },
      error: null,
    });
    let calls = 0;
    mockedCreateClient.mockImplementation(() => {
      calls += 1;
      return (calls === 1 ? anon : verifyClient) as never;
    });
    return { anon, verifyClient };
  }

  it("直近 10 分以内に password_change 履歴があれば RATE_LIMITED", async () => {
    setupSuccessUntilRateCheck();
    const admin = buildAdminClient();
    const employeesFrom = buildFrom();
    employeesFrom.maybeSingle.mockResolvedValue({
      data: { birthday: "1990-05-07", employee_number: "1324" },
      error: null,
    });
    const auditFrom = buildFrom();
    // .select(..).eq(..).eq(..).gte(..).maybeSingle() で 1 件返す
    auditFrom.maybeSingle.mockResolvedValue({
      data: { audit_id: 999 },
      error: null,
    });
    admin.from.mockImplementation((table: string) => {
      if (table === "root_employees") return employeesFrom;
      if (table === "root_audit_log") return auditFrom;
      return buildFrom();
    });
    mockedGetSupabaseAdmin.mockReturnValue(admin as never);

    const result = await changeBirthdayWithPassword({
      newBirthday: "1985-12-03",
      currentPassword: "0507",
      accessToken: "ok-token",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.errorCode).toBe("RATE_LIMITED");
  });
});
```

- [ ] **Step 2: テスト実行で失敗確認**

```bash
npx vitest run src/app/tree/_actions/__tests__/change-birthday-with-password.test.ts
```

期待: 5 PASS + 1 FAIL

- [ ] **Step 3: レート制限を実装**

WRONG_PASSWORD return の直後に挿入：

```typescript
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: rateRow, error: rateError } = await admin
    .from("root_audit_log")
    .select("audit_id")
    .eq("actor_user_id", userData.user.id)
    .eq("action", "password_change")
    .gte("created_at", tenMinAgo)
    .maybeSingle();
  if (rateError) return fail("UNKNOWN");
  if (rateRow) return fail("RATE_LIMITED");
```

- [ ] **Step 4: テスト全 PASS 確認**

```bash
npx vitest run src/app/tree/_actions/__tests__/change-birthday-with-password.test.ts
```

期待: 6 件全 PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/tree/_actions/
git commit -m "feat(tree): change-birthday Server Action: RATE_LIMITED 検証（直近10分の重複拒否）"
```

---

## Task 7: 成功パス（一体トランザクション + 監査ログ）

**Files:**
- Modify: `src/app/tree/_actions/__tests__/change-birthday-with-password.test.ts`
- Modify: `src/app/tree/_actions/change-birthday-with-password.ts`

- [ ] **Step 1: 成功テストを書く**

```typescript
describe("changeBirthdayWithPassword - 成功パス", () => {
  it("birthday UPDATE → Auth password 更新 → audit log INSERT が順に成功すれば success: true", async () => {
    const anon = buildAnonClient();
    anon.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "emp1324@garden.internal" } },
      error: null,
    });
    const verifyClient = buildAnonClient();
    verifyClient.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: "user-123" }, session: { access_token: "x" } },
      error: null,
    });
    let calls = 0;
    mockedCreateClient.mockImplementation(() => {
      calls += 1;
      return (calls === 1 ? anon : verifyClient) as never;
    });

    const admin = buildAdminClient();

    // root_employees: select で現 birthday、update で新 birthday
    const employeesSelect = buildFrom();
    employeesSelect.maybeSingle.mockResolvedValue({
      data: { birthday: "1990-05-07", employee_number: "1324" },
      error: null,
    });
    const employeesUpdate = buildFrom();
    employeesUpdate.eq.mockResolvedValue({ error: null });

    // root_audit_log: rate-limit 用 select は null、insert は成功
    const auditSelect = buildFrom();
    auditSelect.maybeSingle.mockResolvedValue({ data: null, error: null });
    const auditInsert = buildFrom();
    auditInsert.insert.mockResolvedValue({ error: null });

    let employeesCalls = 0;
    let auditCalls = 0;
    admin.from.mockImplementation((table: string) => {
      if (table === "root_employees") {
        employeesCalls += 1;
        return employeesCalls === 1 ? employeesSelect : employeesUpdate;
      }
      if (table === "root_audit_log") {
        auditCalls += 1;
        return auditCalls === 1 ? auditSelect : auditInsert;
      }
      return buildFrom();
    });
    admin.auth.admin.updateUserById.mockResolvedValue({ error: null });
    mockedGetSupabaseAdmin.mockReturnValue(admin as never);

    const result = await changeBirthdayWithPassword({
      newBirthday: "1985-12-03",
      currentPassword: "0507",
      accessToken: "ok-token",
    });

    expect(result.success).toBe(true);
    expect(admin.auth.admin.updateUserById).toHaveBeenCalledWith(
      "user-123",
      { password: "1203" },
    );
    expect(auditInsert.insert).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: テスト実行で失敗確認**

```bash
npx vitest run src/app/tree/_actions/__tests__/change-birthday-with-password.test.ts
```

期待: 6 PASS + 1 FAIL

- [ ] **Step 3: 一体トランザクション実装**

RATE_LIMITED return の直後に挿入：

```typescript
  const newMMDD = `${dateMatch[2]}${dateMatch[3]}`;

  // ① root_employees.birthday を新値で UPDATE
  const { error: birthdayUpdateError } = await admin
    .from("root_employees")
    .update({ birthday: input.newBirthday })
    .eq("user_id", userData.user.id);
  if (birthdayUpdateError) return fail("TRANSACTION_FAILED");

  // ② Auth password を新 MMDD に更新
  const { error: authUpdateError } = await admin.auth.admin.updateUserById(
    userData.user.id,
    { password: newMMDD },
  );
  if (authUpdateError) {
    // 補償 UPDATE: birthday を旧値に戻す
    const { error: rollbackError } = await admin
      .from("root_employees")
      .update({ birthday: employee.birthday })
      .eq("user_id", userData.user.id);
    if (rollbackError) {
      console.error(
        "[changeBirthdayWithPassword] rollback FAILED — birthday=newBirthday, password=oldMMDD のまま",
        { userId: userData.user.id, attempted: input.newBirthday },
      );
    }
    return fail("TRANSACTION_FAILED");
  }

  // ③ 監査ログ（best-effort、失敗しても success を返す）
  const { error: auditInsertError } = await admin
    .from("root_audit_log")
    .insert({
      actor_user_id: userData.user.id,
      actor_emp_num: employee.employee_number,
      action: "password_change",
      target_type: "auth.users",
      target_id: userData.user.id,
      payload: { via: "mypage_birthday" },
    });
  if (auditInsertError) {
    console.warn(
      "[changeBirthdayWithPassword] audit log insert failed (non-fatal)",
      { userId: userData.user.id, error: auditInsertError.message },
    );
  }

  return { success: true };
```

- [ ] **Step 4: テスト全 PASS 確認**

```bash
npx vitest run src/app/tree/_actions/__tests__/change-birthday-with-password.test.ts
```

期待: 7 件全 PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/tree/_actions/
git commit -m "feat(tree): change-birthday Server Action: 一体トランザクション（birthday + Auth + audit log）"
```

---

## Task 8: TRANSACTION_FAILED + 補償ロールバック

**Files:**
- Modify: `src/app/tree/_actions/__tests__/change-birthday-with-password.test.ts`

- [ ] **Step 1: 失敗テスト（② Auth 更新失敗時に ① が逆方向 UPDATE される）**

```typescript
describe("changeBirthdayWithPassword - TRANSACTION_FAILED + 補償", () => {
  it("Auth password 更新が失敗したら birthday が旧値に巻き戻る", async () => {
    const anon = buildAnonClient();
    anon.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "emp1324@garden.internal" } },
      error: null,
    });
    const verifyClient = buildAnonClient();
    verifyClient.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: "user-123" }, session: { access_token: "x" } },
      error: null,
    });
    let calls = 0;
    mockedCreateClient.mockImplementation(() => {
      calls += 1;
      return (calls === 1 ? anon : verifyClient) as never;
    });

    const admin = buildAdminClient();
    const employeesSelect = buildFrom();
    employeesSelect.maybeSingle.mockResolvedValue({
      data: { birthday: "1990-05-07", employee_number: "1324" },
      error: null,
    });
    const employeesUpdate1 = buildFrom();
    employeesUpdate1.eq.mockResolvedValue({ error: null });
    const employeesUpdateRollback = buildFrom();
    employeesUpdateRollback.eq.mockResolvedValue({ error: null });

    const auditSelect = buildFrom();
    auditSelect.maybeSingle.mockResolvedValue({ data: null, error: null });

    let employeesCalls = 0;
    admin.from.mockImplementation((table: string) => {
      if (table === "root_employees") {
        employeesCalls += 1;
        if (employeesCalls === 1) return employeesSelect;
        if (employeesCalls === 2) return employeesUpdate1;
        return employeesUpdateRollback;
      }
      if (table === "root_audit_log") return auditSelect;
      return buildFrom();
    });
    admin.auth.admin.updateUserById.mockResolvedValue({
      error: { message: "Auth update failed" },
    });
    mockedGetSupabaseAdmin.mockReturnValue(admin as never);

    const result = await changeBirthdayWithPassword({
      newBirthday: "1985-12-03",
      currentPassword: "0507",
      accessToken: "ok-token",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe("TRANSACTION_FAILED");
    }
    // 補償 UPDATE が呼ばれたこと
    expect(employeesUpdateRollback.update).toHaveBeenCalledWith({
      birthday: "1990-05-07",
    });
  });
});
```

- [ ] **Step 2: テスト実行で確認**

```bash
npx vitest run src/app/tree/_actions/__tests__/change-birthday-with-password.test.ts
```

期待: 7 PASS + 1 PASS（既に Task 7 で実装した補償ロジックが動くため即 PASS のはず）

もし FAIL した場合、補償呼出に渡す値（`employee.birthday` = "1990-05-07"）が正しいことを Server Action で再確認。

- [ ] **Step 3: 全 PASS 確認**

8 件全 PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/tree/_actions/__tests__/change-birthday-with-password.test.ts
git commit -m "test(tree): change-birthday Server Action TRANSACTION_FAILED + 補償ロールバックを検証"
```

---

## Task 9: 監査ログ best-effort（③ 失敗でも success）

**Files:**
- Modify: `src/app/tree/_actions/__tests__/change-birthday-with-password.test.ts`

- [ ] **Step 1: テスト追加**

```typescript
describe("changeBirthdayWithPassword - 監査ログ best-effort", () => {
  it("audit log insert が失敗しても success を返す", async () => {
    const anon = buildAnonClient();
    anon.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "emp1324@garden.internal" } },
      error: null,
    });
    const verifyClient = buildAnonClient();
    verifyClient.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: "user-123" }, session: { access_token: "x" } },
      error: null,
    });
    let calls = 0;
    mockedCreateClient.mockImplementation(() => {
      calls += 1;
      return (calls === 1 ? anon : verifyClient) as never;
    });

    const admin = buildAdminClient();
    const employeesSelect = buildFrom();
    employeesSelect.maybeSingle.mockResolvedValue({
      data: { birthday: "1990-05-07", employee_number: "1324" },
      error: null,
    });
    const employeesUpdate = buildFrom();
    employeesUpdate.eq.mockResolvedValue({ error: null });
    const auditSelect = buildFrom();
    auditSelect.maybeSingle.mockResolvedValue({ data: null, error: null });
    const auditInsert = buildFrom();
    auditInsert.insert.mockResolvedValue({
      error: { message: "audit log insert failed" },
    });

    let employeesCalls = 0;
    let auditCalls = 0;
    admin.from.mockImplementation((table: string) => {
      if (table === "root_employees") {
        employeesCalls += 1;
        return employeesCalls === 1 ? employeesSelect : employeesUpdate;
      }
      if (table === "root_audit_log") {
        auditCalls += 1;
        return auditCalls === 1 ? auditSelect : auditInsert;
      }
      return buildFrom();
    });
    admin.auth.admin.updateUserById.mockResolvedValue({ error: null });
    mockedGetSupabaseAdmin.mockReturnValue(admin as never);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await changeBirthdayWithPassword({
      newBirthday: "1985-12-03",
      currentPassword: "0507",
      accessToken: "ok-token",
    });

    expect(result.success).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
```

- [ ] **Step 2: テスト実行**

```bash
npx vitest run src/app/tree/_actions/__tests__/change-birthday-with-password.test.ts
```

期待: 9 件全 PASS（Task 7 で best-effort を既に実装しているため即 PASS）

- [ ] **Step 3: Commit**

```bash
git add src/app/tree/_actions/__tests__/change-birthday-with-password.test.ts
git commit -m "test(tree): change-birthday Server Action 監査ログ best-effort を検証"
```

---

## Task 10: ChangeBirthdayModal 雛形 + 開閉 RTL

**Files:**
- Create: `src/app/tree/mypage/_components/ChangeBirthdayModal.tsx`
- Create: `src/app/tree/mypage/_components/__tests__/ChangeBirthdayModal.test.tsx`

- [ ] **Step 1: 失敗テスト（モーダルが開く・閉じる）**

`src/app/tree/mypage/_components/__tests__/ChangeBirthdayModal.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChangeBirthdayModal } from "../ChangeBirthdayModal";

describe("ChangeBirthdayModal - 開閉", () => {
  it("open=false なら何も描画しない", () => {
    render(
      <ChangeBirthdayModal
        open={false}
        onClose={vi.fn()}
        currentBirthday="1990-05-07"
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.queryByText("誕生日の変更")).toBeNull();
  });

  it("open=true ならタイトル・閉じるボタンを描画する", () => {
    render(
      <ChangeBirthdayModal
        open
        onClose={vi.fn()}
        currentBirthday="1990-05-07"
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByText("誕生日の変更")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /キャンセル|閉じる|✕/ }),
    ).toBeInTheDocument();
  });

  it("キャンセルクリックで onClose が呼ばれる", async () => {
    const onClose = vi.fn();
    render(
      <ChangeBirthdayModal
        open
        onClose={onClose}
        currentBirthday="1990-05-07"
        onSubmit={vi.fn()}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "キャンセル" }),
    );
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: テスト実行で失敗確認**

```bash
npx vitest run src/app/tree/mypage/_components/__tests__/ChangeBirthdayModal.test.tsx
```

期待: FAIL（コンポーネント未作成）

- [ ] **Step 3: モーダル雛形を実装**

`src/app/tree/mypage/_components/ChangeBirthdayModal.tsx`:

```typescript
"use client";

import { useState, type CSSProperties, type FormEvent } from "react";

import type { ChangeBirthdayWithPasswordResult } from "../../_actions/change-birthday-with-password";

export type ChangeBirthdayModalProps = {
  open: boolean;
  onClose: () => void;
  currentBirthday: string;
  onSubmit: (input: {
    newBirthday: string;
    currentPassword: string;
  }) => Promise<ChangeBirthdayWithPasswordResult>;
  onSuccess?: () => void;
};

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};
const panelStyle: CSSProperties = {
  width: "min(480px, 92vw)",
  background: "#fff",
  borderRadius: 12,
  padding: 24,
  boxShadow: "0 16px 32px rgba(0,0,0,0.2)",
  fontFamily: "'Noto Sans JP', sans-serif",
  color: "#222",
};

export function ChangeBirthdayModal(props: ChangeBirthdayModalProps) {
  const { open, onClose, currentBirthday } = props;
  const [newBirthday, setNewBirthday] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    // 実装は Task 12 で
  };

  return (
    <div style={overlayStyle}>
      <div style={panelStyle} role="dialog" aria-modal="true">
        <h2 style={{ margin: "0 0 16px", fontSize: 18 }}>誕生日の変更</h2>
        <form onSubmit={handleSubmit}>
          <p>現在の誕生日: {currentBirthday}</p>
          <p style={{ fontSize: 12, color: "#666" }}>
            （以後 Task 11 で入力欄を追加）
          </p>
          <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose}>
              キャンセル
            </button>
            <button type="submit" disabled>変更する</button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: テスト全 PASS 確認**

```bash
npx vitest run src/app/tree/mypage/_components/__tests__/ChangeBirthdayModal.test.tsx
```

期待: 3 件 PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/tree/mypage/_components/
git commit -m "feat(tree): ChangeBirthdayModal 雛形（開閉・タイトル・キャンセルのみ）"
```

---

## Task 11: フォームフィールド + バリデーション

**Files:**
- Modify: `src/app/tree/mypage/_components/__tests__/ChangeBirthdayModal.test.tsx`
- Modify: `src/app/tree/mypage/_components/ChangeBirthdayModal.tsx`

- [ ] **Step 1: 失敗テストを追加**

```typescript
describe("ChangeBirthdayModal - フォーム", () => {
  it("新誕生日と現パスワードが空の状態では『変更する』が disabled", () => {
    render(
      <ChangeBirthdayModal
        open
        onClose={vi.fn()}
        currentBirthday="1990-05-07"
        onSubmit={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "変更する" }),
    ).toBeDisabled();
  });

  it("両方入力すると『変更する』が活性化", async () => {
    render(
      <ChangeBirthdayModal
        open
        onClose={vi.fn()}
        currentBirthday="1990-05-07"
        onSubmit={vi.fn()}
      />,
    );
    await userEvent.type(
      screen.getByLabelText("新しい誕生日"),
      "1985-12-03",
    );
    await userEvent.type(
      screen.getByLabelText("現在のパスワード"),
      "0507",
    );
    expect(
      screen.getByRole("button", { name: "変更する" }),
    ).toBeEnabled();
  });
});
```

- [ ] **Step 2: テスト実行で失敗確認**

```bash
npx vitest run src/app/tree/mypage/_components/__tests__/ChangeBirthdayModal.test.tsx
```

期待: 既存 3 PASS + 新規 2 FAIL

- [ ] **Step 3: フォームフィールドと活性化制御を実装**

`ChangeBirthdayModal.tsx` の `<p style={{ fontSize: 12, color: "#666" }}>` の代わりに以下を入れる：

```tsx
          <div style={{ marginTop: 12 }}>
            <label htmlFor="cbm-new-birthday" style={{ display: "block", fontSize: 12, color: "#666" }}>
              新しい誕生日
            </label>
            <input
              id="cbm-new-birthday"
              type="date"
              value={newBirthday}
              onChange={(e) => setNewBirthday(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              required
              style={{ width: "100%", padding: 10, fontSize: 14, color: "#222", background: "#fff" }}
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <label htmlFor="cbm-current-pw" style={{ display: "block", fontSize: 12, color: "#666" }}>
              現在のパスワード
            </label>
            <input
              id="cbm-current-pw"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              style={{ width: "100%", padding: 10, fontSize: 14, color: "#222", background: "#fff" }}
            />
            <p style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
              ※本人確認のため入力してください
            </p>
          </div>
```

`<button type="submit" disabled>変更する</button>` を以下に置換：

```tsx
            <button
              type="submit"
              disabled={!newBirthday || !currentPassword}
            >
              変更する
            </button>
```

- [ ] **Step 4: テスト全 PASS 確認**

```bash
npx vitest run src/app/tree/mypage/_components/__tests__/ChangeBirthdayModal.test.tsx
```

期待: 5 件全 PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/tree/mypage/_components/
git commit -m "feat(tree): ChangeBirthdayModal フォーム入力欄 + 活性化制御"
```

---

## Task 12: submit 成功パス + ローディング

**Files:**
- Modify: `src/app/tree/mypage/_components/__tests__/ChangeBirthdayModal.test.tsx`
- Modify: `src/app/tree/mypage/_components/ChangeBirthdayModal.tsx`

- [ ] **Step 1: 失敗テスト**

```typescript
describe("ChangeBirthdayModal - submit 成功", () => {
  it("成功時に onSubmit が正しい引数で呼ばれ、onSuccess + onClose が呼ばれる", async () => {
    const onSubmit = vi
      .fn()
      .mockResolvedValue({ success: true });
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    render(
      <ChangeBirthdayModal
        open
        onClose={onClose}
        currentBirthday="1990-05-07"
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />,
    );
    await userEvent.type(
      screen.getByLabelText("新しい誕生日"),
      "1985-12-03",
    );
    await userEvent.type(
      screen.getByLabelText("現在のパスワード"),
      "0507",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "変更する" }),
    );
    expect(onSubmit).toHaveBeenCalledWith({
      newBirthday: "1985-12-03",
      currentPassword: "0507",
    });
    expect(onSuccess).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("送信中は『変更中...』表示で disabled", async () => {
    const onSubmit = vi
      .fn()
      .mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ success: true }), 50),
          ),
      );
    render(
      <ChangeBirthdayModal
        open
        onClose={vi.fn()}
        currentBirthday="1990-05-07"
        onSubmit={onSubmit}
      />,
    );
    await userEvent.type(
      screen.getByLabelText("新しい誕生日"),
      "1985-12-03",
    );
    await userEvent.type(
      screen.getByLabelText("現在のパスワード"),
      "0507",
    );
    userEvent.click(
      screen.getByRole("button", { name: "変更する" }),
    );
    expect(
      await screen.findByRole("button", { name: "変更中..." }),
    ).toBeDisabled();
  });
});
```

- [ ] **Step 2: テスト実行で失敗確認**

```bash
npx vitest run src/app/tree/mypage/_components/__tests__/ChangeBirthdayModal.test.tsx
```

期待: 5 PASS + 2 FAIL

- [ ] **Step 3: submit 処理とローディング状態を実装**

`ChangeBirthdayModal.tsx` の関数本体先頭付近に追加：

```typescript
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
```

`handleSubmit` を以下に置換：

```typescript
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting || !newBirthday || !currentPassword) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await props.onSubmit({ newBirthday, currentPassword });
      if (result.success) {
        props.onSuccess?.();
        setNewBirthday("");
        setCurrentPassword("");
        onClose();
        return;
      }
      setError(result.errorMessage);
    } finally {
      setSubmitting(false);
    }
  };
```

`<button type="submit" ...>` を以下に置換：

```tsx
            <button
              type="submit"
              disabled={!newBirthday || !currentPassword || submitting}
            >
              {submitting ? "変更中..." : "変更する"}
            </button>
```

- [ ] **Step 4: テスト全 PASS 確認**

```bash
npx vitest run src/app/tree/mypage/_components/__tests__/ChangeBirthdayModal.test.tsx
```

期待: 7 件全 PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/tree/mypage/_components/
git commit -m "feat(tree): ChangeBirthdayModal submit 成功パスとローディング表示"
```

---

## Task 13: エラー表示

**Files:**
- Modify: `src/app/tree/mypage/_components/__tests__/ChangeBirthdayModal.test.tsx`
- Modify: `src/app/tree/mypage/_components/ChangeBirthdayModal.tsx`

- [ ] **Step 1: 失敗テスト**

```typescript
describe("ChangeBirthdayModal - エラー表示", () => {
  it("WRONG_PASSWORD 時にエラーメッセージが表示される", async () => {
    const onSubmit = vi.fn().mockResolvedValue({
      success: false,
      errorCode: "WRONG_PASSWORD",
      errorMessage: "現在のパスワードが違います",
    });
    render(
      <ChangeBirthdayModal
        open
        onClose={vi.fn()}
        currentBirthday="1990-05-07"
        onSubmit={onSubmit}
      />,
    );
    await userEvent.type(
      screen.getByLabelText("新しい誕生日"),
      "1985-12-03",
    );
    await userEvent.type(
      screen.getByLabelText("現在のパスワード"),
      "wrong",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "変更する" }),
    );
    expect(
      await screen.findByText("現在のパスワードが違います"),
    ).toBeInTheDocument();
    // モーダルは閉じない
    expect(screen.getByText("誕生日の変更")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: テスト実行**

```bash
npx vitest run src/app/tree/mypage/_components/__tests__/ChangeBirthdayModal.test.tsx
```

期待: 7 PASS + 1 FAIL

- [ ] **Step 3: エラー表示要素を実装**

フォーム末尾の `<div style={{ marginTop: 16, display: "flex", ...}}>` の直前に追加：

```tsx
          {error && (
            <div
              role="alert"
              style={{
                marginTop: 12,
                padding: 8,
                background: "#fee",
                color: "#a00",
                fontSize: 12,
                borderRadius: 6,
              }}
            >
              {error}
            </div>
          )}
```

- [ ] **Step 4: テスト全 PASS 確認**

期待: 8 件全 PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/tree/mypage/_components/
git commit -m "feat(tree): ChangeBirthdayModal エラー表示（role=alert）"
```

---

## Task 14: マイページ統合（ボタン + モーダル + 成功メッセージ）

**Files:**
- Modify: `src/app/tree/mypage/page.tsx`

- [ ] **Step 1: 既存マイページの構造確認**

```bash
grep -n "displayBirthday\|登録情報\|treeUser\?\.birthday" src/app/tree/mypage/page.tsx | head -20
```

期待: `displayBirthday` を表示している箇所を特定（76 行目付近）

- [ ] **Step 2: Server Action 呼出ヘルパーを作る**

`src/app/tree/mypage/page.tsx` の他 import の後ろに追加：

```typescript
import { useState } from "react";
import { ChangeBirthdayModal } from "./_components/ChangeBirthdayModal";
import { changeBirthdayWithPassword } from "../_actions/change-birthday-with-password";
import { supabase } from "../_lib/supabase";
```

`MyPageScreen` 関数（または該当の export default 関数）の本体の先頭で以下の state とハンドラを追加：

```typescript
  const [modalOpen, setModalOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string>("");

  const handleChangeBirthdaySubmit = async (input: {
    newBirthday: string;
    currentPassword: string;
  }) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token ?? "";
    return await changeBirthdayWithPassword({
      newBirthday: input.newBirthday,
      currentPassword: input.currentPassword,
      accessToken,
    });
  };

  const handleChangeBirthdaySuccess = () => {
    setSuccessMsg(
      "誕生日を変更しました。次回ログインからは新しい誕生日のパスワードでログインしてください",
    );
    setTimeout(() => setSuccessMsg(""), 5000);
    refreshAuth?.();
  };
```

`refreshAuth` は `useTreeState()` から既に取得しているはず。なければ取得する：

```typescript
  const { treeUser, refreshAuth } = useTreeState();
```

- [ ] **Step 3: 「誕生日を変更する」ボタンを登録情報セクションに追加**

既存の `displayBirthday` を表示している箇所の直後に：

```tsx
          {treeUser?.birthday && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              style={{
                marginTop: 8,
                padding: "6px 12px",
                fontSize: 12,
                background: "#fff",
                border: "1px solid #ccc",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              誕生日を変更する
            </button>
          )}
```

- [ ] **Step 4: モーダル + 成功メッセージを return ツリー末尾に配置**

`return (` の最も外側の容器（`<>` または `<div>`）の中、画面本体の後に：

```tsx
      <ChangeBirthdayModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        currentBirthday={treeUser?.birthday ?? ""}
        onSubmit={handleChangeBirthdaySubmit}
        onSuccess={handleChangeBirthdaySuccess}
      />
      {successMsg && (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "12px 24px",
            background: "#234d20",
            color: "#fff",
            borderRadius: 8,
            zIndex: 1100,
            fontSize: 13,
          }}
        >
          {successMsg}
        </div>
      )}
```

- [ ] **Step 5: 型チェック**

```bash
npx tsc --noEmit
```

期待: エラー無し

- [ ] **Step 6: Commit**

```bash
git add src/app/tree/mypage/page.tsx
git commit -m "feat(tree): マイページに『誕生日を変更する』ボタン + ChangeBirthdayModal 統合"
```

---

## Task 15: E2E チェックリスト有効化

**Files:**
- Modify: `docs/phase-b-beta-e2e-checklist.md`

- [ ] **Step 1: STEP 12-15 の前置きを実機テスト前提に書換**

`docs/phase-b-beta-e2e-checklist.md` の該当ブロックを置換：

**変更前**：
```markdown
## ■ B 経路（マイページ誕生日変更）の同期確認 — 次フェーズ実装後に有効化

> **現時点では `/tree/mypage` に誕生日変更 UI は実装されていない**（`treeUser?.birthday ?? "（未登録）"` の読み取り表示のみ）。以下は次フェーズ実装後に有効となる検証手順の**先行仕様**。実装が入り次第、各 STEP の「期待状態」を実測で確認する。
>
> **確定方針（2026-04-24）**: マイページから誕生日を変更したとき、Auth パスワードも新しい MMDD へ**同期更新**する（仕様書 §2.1 B 経路）。

### STEP 12（将来）. マイページを開く
```

**変更後**：
```markdown
## ■ B 経路（マイページ誕生日変更）の同期確認

> **2026-04-25 時点で `/tree/mypage` に誕生日変更 UI が実装済**（`ChangeBirthdayModal`）。STEP 12-15 を順に通して B 経路の同期動作を検証する。
>
> **方針**: マイページから誕生日を変更したとき、Auth パスワードも新しい MMDD へ**同期更新**する（仕様書 §2.1 B 経路、案 C 一体トランザクション）。

### STEP 12. マイページを開く
```

`### STEP 13（将来）. ` → `### STEP 13. `（同様に 14・15 も `（将来）` を削除）

`### B 経路チェックリスト（次フェーズ有効化）` → `### B 経路チェックリスト`

- [ ] **Step 2: Commit**

```bash
git add docs/phase-b-beta-e2e-checklist.md
git commit -m "docs(tree): E2E チェックリスト B 経路セクションを実機テスト前提に有効化"
```

---

## Task 16: 全体型チェック・ESLint・実装まとめコミット

**Files:**
- Verify only

- [ ] **Step 1: 全体型チェック**

```bash
npx tsc --noEmit
```

期待: エラー無し

- [ ] **Step 2: ESLint**

```bash
npx eslint src/app/tree/_actions src/app/tree/mypage 2>&1
```

期待: エラー無し（warning は許容、ただし unused-import などは Task 内で消しておく）

- [ ] **Step 3: 全テストランナー**

```bash
npx vitest run src/app/tree/
```

期待: Server Action 9 件 + Modal 8 件 = 17 件全 PASS（既存 Tree テストがあれば加算）

- [ ] **Step 4: 動作確認用 dev 起動の事前 sanity（任意）**

東海林さん側で実機検証する前に：

```bash
npm run dev
```

`http://localhost:3000/tree/mypage` を開き、社員番号 1324 で手動ログイン → 「誕生日を変更する」ボタン → モーダル → 動作確認。`docs/phase-b-beta-e2e-checklist.md` STEP 12-15 を東海林さんに渡す。

- [ ] **Step 5: effort-tracking 実績を記入**

`docs/effort-tracking.md` の Task 0 で追加した行の `actual_days` / `diff` / `finished` カラムを埋める：

```bash
git add docs/effort-tracking.md
git commit -m "docs: effort-tracking 更新 (tree) — Phase B-β B 経路実装完了、実績記入"
```

- [ ] **Step 6: Push & PR ドラフト作成**

```bash
git push origin feature/tree-phase-b-beta-mypage-modal
gh pr create --base develop --head feature/tree-phase-b-beta-mypage-modal --draft \
  --title "feat(tree): Phase B-β B 経路 — マイページ誕生日変更モーダル" \
  --body "実装プラン: docs/superpowers/plans/2026-04-25-tree-phase-b-beta-mypage-birthday-modal.md
実装 spec: docs/specs/2026-04-25-tree-phase-b-beta-mypage-birthday-modal.md

## 概要
マイページから誕生日を変更すると、root_employees.birthday と Supabase Auth パスワードを一体トランザクション（案 C）で同期する Server Action + ChangeBirthdayModal を実装。

## 主な変更
- 新規: src/app/tree/_actions/change-birthday-with-password.ts（errorCode 7 種、補償ロールバック、監査ログ best-effort）
- 新規: src/app/tree/mypage/_components/ChangeBirthdayModal.tsx
- 既存変更: src/app/tree/mypage/page.tsx に統合、docs/phase-b-beta-e2e-checklist.md 有効化
- テスト: Vitest 9 件、RTL 8 件、全 PASS

## レビュー観点
- 一体トランザクションの補償ロジック（Auth 失敗時に birthday 巻き戻し）
- レート制限（10 分以内の重複拒否）
- 現パス検証で既存セッションへの影響なし（新 anon クライアント生成）

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

a-main に PR URL 報告 → admin merge 判断。

---

## Self-Review

このプランを書き終えた後、自己レビューを実施しました。

### Spec coverage
- §1 目的 → Task 0（プラン宣言） + 全タスクで実装
- §2 UI 仕様 → Task 10/11/12/13/14 で全項目（モーダル構成・3 フィールド・遷移・レスポンシブ）カバー（レスポンシブは inline style + min/vw 指定で最低限。本格対応は次タスクで）
- §3 API 仕様 → Task 1/2/3/4/5/6/7/8/9 で全項目（Server Action 構造・一体トランザクション・ロールバック戦略・現パス検証選択肢 1）
- §4 セキュリティ → Task 2（access_token 検証）、Task 5（現パス）、Task 6（レート制限）、Task 7（監査ログ）でカバー
- §5 エラーハンドリング → errorCode 7 種を Task 2-9 で全網羅
- §6 テスト観点 → Vitest 9 件（spec の 7 ケース + 補償 + best-effort）、RTL 8 件（spec の 6 ケース + α）でカバー
- §7 実装ステップ → Task 1〜16 で実装順序通り
- §8 見込み時間 → Task 0 で予定行追加、Task 16 で実績記入

### Placeholder scan
- Task 11 で「以後 Task 11 で入力欄を追加」とコメントを残した箇所 → Task 11 の Step 3 で実際に置換するため、placeholder ではない（プラン進行で確実に消える）
- TBD/TODO/「適切な〜」「妥当な〜」のような曖昧表現なし

### Type consistency
- `ChangeBirthdayWithPasswordResult` の型は Task 1 で定義、後続タスクで一貫使用 ✅
- `ChangeBirthdayErrorCode` の 7 値は Task 1 定義、Task 2-9 で各 1 件ずつカバー ✅
- `ChangeBirthdayModalProps` の `onSubmit` シグネチャ（`onSubmit: (input: { newBirthday, currentPassword }) => Promise<Result>`）は Task 10 定義、Task 12/14 で同一形 ✅
- Supabase クライアント変数名: anon = `verifyClient` または初回 `anon`、admin = `getSupabaseAdmin()` の `admin` で統一 ✅

### スコープ・干渉回避
- 新規ファイル: `src/app/tree/_actions/` `src/app/tree/mypage/_components/` のみ
- 既存変更: `src/app/tree/mypage/page.tsx` `docs/phase-b-beta-e2e-checklist.md` のみ
- `src/lib/supabase/admin.ts` は import のみ（Leaf 領域、変更しない）
- `src/app/leaf/` `src/app/forest/` `src/app/root/` 非接触
- Phase D 要素なし

検出された改善点はインラインで修正済。

---

## 変更履歴

| 日付 | 版 | 改訂内容 | 担当セッション |
|---|---|---|---|
| 2026-04-25 | 1.0（初版） | 起草。Tree Phase B-β B 経路の実装プラン。spec § 全項目カバー、Vitest 9 + RTL 8 ケース、bite-sized 16 タスク構成。 | a-tree |
