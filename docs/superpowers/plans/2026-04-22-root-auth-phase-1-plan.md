# Garden-Root Phase 1 (認証・権限管理) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Garden-Root の 7 マスタ画面に Supabase Auth ベースの認証・権限ゲート・監査ログ・セッションタイマーを実装する。

**Architecture:** Tree Phase A の構造を踏襲する (擬似メール `emp{4桁}@garden.internal` + `root_employees.garden_role` 参照)。State は React Context、セッションは sessionStorage、監査は `root_audit_log` テーブルに書く。RLS は既存の `root_can_access()` / `root_can_write()` ヘルパーを使って切替。

**Tech Stack:** Next.js 16 (App Router) / React 19 / Supabase JS v2.103 / TypeScript 5 / 既存 inline-style デザイン。テストフレームワークなしの前提で、各タスク完了後に `npm run build` (型チェック) + 手動ブラウザ確認を行う。

**Branch:** `feature/root-auth-ui` (develop から分岐済み)

**Spec:** `docs/superpowers/specs/2026-04-22-root-auth-phase-1-design.md`

---

## File Structure

### 新規ファイル (10)

| パス | 役割 |
|---|---|
| `src/app/root/_lib/auth.ts` | signInRoot / signOutRoot / isRootUnlocked / touchRootSession / returnTo 管理 |
| `src/app/root/_lib/audit.ts` | writeAudit (root_audit_log INSERT) / 共通 IP/UA 取得 |
| `src/app/root/_lib/session-timer.ts` | タイムアウト定数 (本番2h / dev 30s) と警告オフセット |
| `src/app/root/_state/RootStateContext.tsx` | 認証 state + canWrite / hasRoleAtLeast ヘルパー + タイマー駆動 |
| `src/app/root/_components/RootGate.tsx` | 未認証時 login へリダイレクトする gate |
| `src/app/root/_components/SessionWarningModal.tsx` | 残り 10 分 (dev: 10 秒) 警告モーダル |
| `src/app/root/_components/UserHeader.tsx` | 右上のユーザー名 + ロール + ログアウトボタン |
| `src/app/root/login/page.tsx` | ログイン画面 |
| `scripts/root-rls-phase1.sql` | 7 マスタテーブルの RLS ポリシー更新 (dev 全許可 → role 制限) |
| `docs/handoff-20260423.md` | 次セッションへの引継ぎ (Phase 1 完了後に作成) |

### 修正ファイル (9)

| パス | 修正内容 |
|---|---|
| `src/app/root/_lib/queries.ts` | `fetchRootUser(userId)` 関数を追加 |
| `src/app/root/_components/RootShell.tsx` | ヘッダーに UserHeader 追加 |
| `src/app/root/layout.tsx` | RootStateProvider + RootGate でラップ |
| `src/app/root/companies/page.tsx` | canWrite で Button disable + tooltip |
| `src/app/root/bank-accounts/page.tsx` | 同上 |
| `src/app/root/vendors/page.tsx` | 同上 |
| `src/app/root/employees/page.tsx` | 同上 |
| `src/app/root/salary-systems/page.tsx` | 同上 |
| `src/app/root/insurance/page.tsx` | 同上 |
| `src/app/root/attendance/page.tsx` | 同上 |

---

## Task 0: 環境ベースライン確認

**Files:** なし

- [ ] **Step 1: 現在のブランチ・状態を確認**

```bash
cd C:/garden/b-main/.claude/worktrees/sharp-rosalind-24d212
git status
git branch --show-current
```

Expected: clean tree, on `feature/root-auth-ui`

- [ ] **Step 2: ベースライン build 確認**

```bash
npm run build
```

Expected: exit 0 (エラーなし)。もしエラーがあれば Phase 1 着手前に修正が必要。

- [ ] **Step 3: 開発サーバー起動テスト (バックグラウンド)**

```bash
npm run dev
```

Expected: `Ready in Xs` 表示後、ブラウザで `http://localhost:3000/root` を開いて現状の画面 (認証なし) が表示されることを確認。確認後 Ctrl+C で停止。

---

## Task 1: 認証ヘルパー `_lib/auth.ts`

**Files:**
- Create: `src/app/root/_lib/auth.ts`

- [ ] **Step 1: ファイル作成**

```typescript
/**
 * Garden-Root — 認証ヘルパー (社員番号 + パスワード)
 *
 * - signInRoot(empId, password): Supabase Auth にサインイン (認証のみ)
 *   権限 (garden_role) の検証は RootStateContext.refreshAuth で実施
 * - signOutRoot(): セッション終了 + returnTo 保存
 * - isRootUnlocked(): セッション有効か (最終操作から指定時間内か)
 * - touchRootSession(): 最終操作時刻を更新
 * - saveReturnTo / popReturnTo: ログアウト時に開いていた URL を保存・復元
 *
 * 設計方針: Tree Phase A (src/app/tree/_lib/auth.ts) を踏襲。
 */

import { supabase } from "./supabase";
import { SESSION_TIMEOUT_MS } from "./session-timer";

const ROOT_UNLOCKED_KEY = "rootUnlockedAt";
const ROOT_RETURN_TO_KEY = "rootReturnTo";

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

export async function signOutRoot(): Promise<void> {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(ROOT_UNLOCKED_KEY);
  }
  await supabase.auth.signOut();
}

export function isRootUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  const raw = sessionStorage.getItem(ROOT_UNLOCKED_KEY);
  if (!raw) return false;
  const unlockedAt = parseInt(raw, 10);
  return Date.now() - unlockedAt < SESSION_TIMEOUT_MS;
}

export function touchRootSession(): void {
  if (typeof window === "undefined") return;
  if (isRootUnlocked()) {
    sessionStorage.setItem(ROOT_UNLOCKED_KEY, Date.now().toString());
  }
}

/** 最終操作からの経過ミリ秒 (タイマー警告用) */
export function getSessionElapsedMs(): number {
  if (typeof window === "undefined") return 0;
  const raw = sessionStorage.getItem(ROOT_UNLOCKED_KEY);
  if (!raw) return 0;
  return Date.now() - parseInt(raw, 10);
}

export function clearRootUnlock(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(ROOT_UNLOCKED_KEY);
}

/** ログアウト時に開いていた URL を保存 (再ログイン後の復帰用) */
export function saveReturnTo(path: string): void {
  if (typeof window === "undefined") return;
  if (path === "/root/login") return;
  sessionStorage.setItem(ROOT_RETURN_TO_KEY, path);
}

/** 復帰 URL を取り出して削除 (なければ /root) */
export function popReturnTo(): string {
  if (typeof window === "undefined") return "/root";
  const path = sessionStorage.getItem(ROOT_RETURN_TO_KEY);
  sessionStorage.removeItem(ROOT_RETURN_TO_KEY);
  return path ?? "/root";
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}
```

- [ ] **Step 2: 型チェック**

```bash
npm run build
```

Expected: `SESSION_TIMEOUT_MS` 未定義のため失敗するはず → 次タスクで解決。build 失敗は想定内。もし別のエラーであれば修正。

- [ ] **Step 3: Commit**

```bash
git add src/app/root/_lib/auth.ts
git commit -m "feat(root): 認証ヘルパー (signInRoot/signOutRoot/touchRootSession) を追加"
```

---

## Task 2: セッションタイマー `_lib/session-timer.ts`

**Files:**
- Create: `src/app/root/_lib/session-timer.ts`

- [ ] **Step 1: ファイル作成**

```typescript
/**
 * Garden-Root — セッションタイマー定数
 *
 * 本番: 2 時間無操作で自動ログアウト / 残り 10 分で警告
 * 開発 (NODE_ENV === "development"): 30 秒 / 残り 10 秒で警告
 *
 * ⚠️ 本番リリース前に確認: NODE_ENV が production になっていること
 */

const IS_DEV = process.env.NODE_ENV === "development";

/** セッションタイムアウト (ミリ秒) */
export const SESSION_TIMEOUT_MS = IS_DEV
  ? 30 * 1000 // 開発: 30 秒
  : 2 * 60 * 60 * 1000; // 本番: 2 時間

/** 警告モーダル表示開始タイミング (タイムアウト前のミリ秒) */
export const WARNING_OFFSET_MS = IS_DEV
  ? 10 * 1000 // 開発: 残り 10 秒
  : 10 * 60 * 1000; // 本番: 残り 10 分

/** タイマー監視の polling 間隔 (ms) */
export const TIMER_POLL_INTERVAL_MS = IS_DEV ? 1000 : 10 * 1000;

/** 開発モードバッジ表示判定 */
export const IS_DEV_MODE = IS_DEV;
```

- [ ] **Step 2: 型チェック**

```bash
npm run build
```

Expected: Task 1 の build エラーが解消し、別の個所がまだ失敗する可能性あり (_lib/auth.ts のみ) → 一旦 OK。Task 3 へ進む。

- [ ] **Step 3: Commit**

```bash
git add src/app/root/_lib/session-timer.ts
git commit -m "feat(root): セッションタイマー定数 (本番2h/dev30s) を追加"
```

---

## Task 3: 監査ログ `_lib/audit.ts`

**Files:**
- Create: `src/app/root/_lib/audit.ts`

- [ ] **Step 1: ファイル作成**

```typescript
/**
 * Garden-Root — 監査ログ書込
 *
 * root_audit_log テーブルに INSERT する薄いラッパ。
 * 書込失敗時は console.error だけで main 処理は止めない (設計書 §7)。
 *
 * 利用パターン:
 *   await writeAudit({
 *     action: "login_success",
 *     actorEmpNum: "0008",
 *     payload: { loginDurationMs: 42 }
 *   });
 */

import { supabase } from "./supabase";

export type AuditAction =
  | "login_success"
  | "login_failed"
  | "login_denied"
  | "logout"
  | "master_update"
  | "permission_denied";

export type AuditParams = {
  action: AuditAction;
  actorUserId?: string | null;
  actorEmpNum?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  payload?: Record<string, unknown>;
};

function getUserAgent(): string | null {
  if (typeof navigator === "undefined") return null;
  return navigator.userAgent;
}

export async function writeAudit(params: AuditParams): Promise<void> {
  try {
    const { error } = await supabase.from("root_audit_log").insert({
      actor_user_id: params.actorUserId ?? null,
      actor_emp_num: params.actorEmpNum ?? null,
      action: params.action,
      target_type: params.targetType ?? null,
      target_id: params.targetId ?? null,
      payload: params.payload ?? null,
      user_agent: getUserAgent(),
      // ip_address はサーバ側 default 値に任せる (フロント取得不可)
    });
    if (error) {
      console.error("[writeAudit]", error.message, params);
    }
  } catch (e) {
    console.error("[writeAudit] unexpected", e, params);
  }
}
```

- [ ] **Step 2: 型チェック**

```bash
npm run build
```

Expected: auth.ts / audit.ts / session-timer.ts 単独では OK。他モジュールが import していない限り build は通る可能性あり。失敗しても次タスクで解決する。

- [ ] **Step 3: Commit**

```bash
git add src/app/root/_lib/audit.ts
git commit -m "feat(root): 監査ログ writeAudit ヘルパーを追加"
```

---

## Task 4: `queries.ts` に `fetchRootUser` を追加

**Files:**
- Modify: `src/app/root/_lib/queries.ts` (末尾に追加)

- [ ] **Step 1: 既存ファイル末尾に追記**

`src/app/root/_lib/queries.ts` の末尾に以下を追加:

```typescript

// ============================================================
// 認証: ログイン中ユーザーの root_employees 行を取得
// ============================================================

import type { GardenRole } from "../_constants/types";

export type RootUser = {
  employee_id: string;
  employee_number: string;
  name: string;
  email: string;
  garden_role: GardenRole;
  company_id: string;
  is_active: boolean;
  user_id: string;
};

export async function fetchRootUser(userId: string): Promise<RootUser | null> {
  const { data, error } = await supabase
    .from("root_employees")
    .select(
      [
        "employee_id",
        "employee_number",
        "name",
        "email",
        "garden_role",
        "company_id",
        "is_active",
        "user_id",
      ].join(","),
    )
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("[fetchRootUser]", error.message);
    return null;
  }
  if (!data) return null;

  return data as unknown as RootUser;
}
```

注意: `import type { GardenRole } ...` は既存 import があればそこにまとめる。別途 import を追加する必要がある場合はファイル冒頭に置く (末尾の import は動作するが見栄え悪い)。

- [ ] **Step 2: 型チェック**

```bash
npm run build
```

Expected: Task 1-4 すべて揃うと build が通るようになる。通らなければ型エラーを個別修正。

- [ ] **Step 3: Commit**

```bash
git add src/app/root/_lib/queries.ts
git commit -m "feat(root): fetchRootUser クエリを追加 (garden_role 取得用)"
```

---

## Task 5: `_state/RootStateContext.tsx`

**Files:**
- Create: `src/app/root/_state/RootStateContext.tsx`

- [ ] **Step 1: ディレクトリとファイル作成**

```bash
mkdir -p src/app/root/_state
```

ファイル内容:

```typescript
"use client";

/**
 * Garden-Root アプリ全体の認証状態
 *
 * - Supabase Auth セッション + root_employees 参照結果を保持
 * - canWrite / hasRoleAtLeast ヘルパーを公開
 * - タイマーを駆動し、残り WARNING_OFFSET_MS で警告 state を立てる
 * - 2 時間経過で自動ログアウト
 *
 * パターン: Tree の TreeStateContext を踏襲。Root は Tree にない
 *   「canWrite」「warningActive」「extendSession」を追加。
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  ROOT_VIEW_ROLES,
  ROOT_WRITE_ROLES,
  isRoleAtLeast,
  type GardenRole,
} from "../_constants/types";
import {
  clearRootUnlock,
  getSession,
  getSessionElapsedMs,
  isRootUnlocked,
  signOutRoot as signOutRootLib,
  touchRootSession,
} from "../_lib/auth";
import { writeAudit } from "../_lib/audit";
import { fetchRootUser, type RootUser } from "../_lib/queries";
import {
  SESSION_TIMEOUT_MS,
  TIMER_POLL_INTERVAL_MS,
  WARNING_OFFSET_MS,
} from "../_lib/session-timer";

export type LogoutReason = "manual" | "timeout" | "role_changed" | "forbidden";

type RootStateValue = {
  loading: boolean;
  isAuthenticated: boolean;
  rootUser: RootUser | null;
  gardenRole: GardenRole | null;
  canWrite: boolean;
  warningActive: boolean;
  remainingMs: number;
  refreshAuth: () => Promise<{ success: boolean; error?: string }>;
  signOut: (reason?: LogoutReason) => Promise<void>;
  extendSession: () => void;
  hasRoleAtLeast: (baseline: GardenRole) => boolean;
};

const RootStateContext = createContext<RootStateValue | null>(null);

export function RootStateProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [rootUser, setRootUser] = useState<RootUser | null>(null);
  const [warningActive, setWarningActive] = useState(false);
  const [remainingMs, setRemainingMs] = useState(SESSION_TIMEOUT_MS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshAuth = useCallback(async () => {
    setLoading(true);
    try {
      const session = await getSession();
      if (!session?.user) {
        setIsAuthenticated(false);
        setRootUser(null);
        return { success: false, error: "セッションがありません" };
      }
      const user = await fetchRootUser(session.user.id);
      if (!user) {
        setIsAuthenticated(false);
        setRootUser(null);
        return {
          success: false,
          error: "Garden-Root へのアクセス権限がありません",
        };
      }
      // 閲覧権限 (manager 以上) を確認
      if (!ROOT_VIEW_ROLES.includes(user.garden_role)) {
        await writeAudit({
          action: "login_denied",
          actorUserId: user.user_id,
          actorEmpNum: user.employee_number,
          payload: { role: user.garden_role, required: "manager" },
        });
        setIsAuthenticated(false);
        setRootUser(null);
        clearRootUnlock();
        return {
          success: false,
          error:
            "Garden-Root へのアクセス権限がありません。責任者以上の方にお問い合わせください",
        };
      }
      setRootUser(user);
      setIsAuthenticated(true);
      return { success: true };
    } catch (e) {
      console.error("[refreshAuth]", e);
      setIsAuthenticated(false);
      setRootUser(null);
      return { success: false, error: "認証エラーが発生しました" };
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(
    async (reason: LogoutReason = "manual") => {
      const actorUserId = rootUser?.user_id ?? null;
      const actorEmpNum = rootUser?.employee_number ?? null;
      await writeAudit({
        action: "logout",
        actorUserId,
        actorEmpNum,
        payload: { reason },
      });
      await signOutRootLib();
      setIsAuthenticated(false);
      setRootUser(null);
      setWarningActive(false);
    },
    [rootUser],
  );

  const extendSession = useCallback(() => {
    touchRootSession();
    setWarningActive(false);
    setRemainingMs(SESSION_TIMEOUT_MS);
  }, []);

  const hasRoleAtLeast = useCallback(
    (baseline: GardenRole) => {
      const gr = rootUser?.garden_role;
      if (!gr) return false;
      return isRoleAtLeast(gr, baseline);
    },
    [rootUser],
  );

  const canWrite = useMemo(() => {
    const gr = rootUser?.garden_role;
    if (!gr) return false;
    return ROOT_WRITE_ROLES.includes(gr);
  }, [rootUser]);

  // 初回マウント時に認証確認
  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  // ユーザー操作でタイマー延長
  useEffect(() => {
    if (!isAuthenticated) return;
    const handler = () => {
      touchRootSession();
      // 警告表示中でも操作があれば閉じる
      setWarningActive(false);
    };
    const events = ["mousedown", "keydown", "click"];
    events.forEach((ev) => window.addEventListener(ev, handler));
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, handler));
    };
  }, [isAuthenticated]);

  // タイマー駆動 (警告 + 自動ログアウト)
  useEffect(() => {
    if (!isAuthenticated) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      const elapsed = getSessionElapsedMs();
      const remaining = SESSION_TIMEOUT_MS - elapsed;
      setRemainingMs(Math.max(0, remaining));
      if (!isRootUnlocked()) {
        // タイムアウト
        void signOut("timeout");
        return;
      }
      if (remaining <= WARNING_OFFSET_MS) {
        setWarningActive(true);
      }
    }, TIMER_POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isAuthenticated, signOut]);

  const value = useMemo<RootStateValue>(
    () => ({
      loading,
      isAuthenticated,
      rootUser,
      gardenRole: rootUser?.garden_role ?? null,
      canWrite,
      warningActive,
      remainingMs,
      refreshAuth,
      signOut,
      extendSession,
      hasRoleAtLeast,
    }),
    [
      loading,
      isAuthenticated,
      rootUser,
      canWrite,
      warningActive,
      remainingMs,
      refreshAuth,
      signOut,
      extendSession,
      hasRoleAtLeast,
    ],
  );

  return (
    <RootStateContext.Provider value={value}>
      {children}
    </RootStateContext.Provider>
  );
}

export function useRootState(): RootStateValue {
  const ctx = useContext(RootStateContext);
  if (!ctx) {
    throw new Error("useRootState must be used within RootStateProvider");
  }
  return ctx;
}
```

- [ ] **Step 2: 型チェック**

```bash
npm run build
```

Expected: build 通る。

- [ ] **Step 3: Commit**

```bash
git add src/app/root/_state/RootStateContext.tsx
git commit -m "feat(root): RootStateContext を追加 (認証状態 + タイマー + canWrite)"
```

---

## Task 6: `SessionWarningModal` コンポーネント

**Files:**
- Create: `src/app/root/_components/SessionWarningModal.tsx`

- [ ] **Step 1: ファイル作成**

```typescript
"use client";

/**
 * 残り 10 分 (dev: 10 秒) でセッション切れを警告するモーダル。
 *
 * 表示条件: useRootState().warningActive === true
 * 操作:
 *   - [作業を続ける] → extendSession() 呼び出し (タイマーリセット)
 *   - [ログアウト] → signOut("manual") 呼び出し
 */

import { colors } from "../_constants/colors";
import { IS_DEV_MODE } from "../_lib/session-timer";
import { useRootState } from "../_state/RootStateContext";

function formatRemaining(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  if (min > 0) return `${min} 分 ${rem} 秒`;
  return `${rem} 秒`;
}

export function SessionWarningModal() {
  const { warningActive, remainingMs, extendSession, signOut } = useRootState();
  if (!warningActive) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: colors.bgPanel,
          padding: 32,
          borderRadius: 12,
          maxWidth: 480,
          width: "90%",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
        }}
      >
        {IS_DEV_MODE && (
          <div
            style={{
              background: colors.warningBg,
              color: colors.warning,
              padding: "4px 12px",
              borderRadius: 6,
              fontSize: 11,
              display: "inline-block",
              marginBottom: 12,
            }}
          >
            ⚠️ 開発モード中 (タイマー短縮)
          </div>
        )}
        <h2 style={{ margin: "0 0 12px", fontSize: 20, color: colors.text }}>
          ⏰ セッションの有効期限が近づいています
        </h2>
        <p
          style={{
            margin: "0 0 24px",
            color: colors.textMuted,
            lineHeight: 1.6,
          }}
        >
          あと <strong style={{ color: colors.danger }}>
            {formatRemaining(remainingMs)}
          </strong>{" "}
          で自動ログアウトします。作業を続けますか？
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={() => signOut("manual")}
            style={{
              padding: "10px 20px",
              background: colors.bgPanel,
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              cursor: "pointer",
              color: colors.textMuted,
            }}
          >
            ログアウト
          </button>
          <button
            type="button"
            onClick={extendSession}
            style={{
              padding: "10px 20px",
              background: colors.primary,
              color: colors.textOnDark,
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            作業を続ける
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 型チェック**

```bash
npm run build
```

Expected: build 通る。

- [ ] **Step 3: Commit**

```bash
git add src/app/root/_components/SessionWarningModal.tsx
git commit -m "feat(root): セッション警告モーダル (残り10分) を追加"
```

---

## Task 7: `RootGate` コンポーネント

**Files:**
- Create: `src/app/root/_components/RootGate.tsx`

- [ ] **Step 1: ファイル作成**

```typescript
"use client";

/**
 * RootGate
 *
 * layout.tsx の中で RootShell/children をラップ。
 * - 認証確認中: ローディング表示
 * - 未認証 & /root/login 以外: saveReturnTo で URL 保持 → /root/login へ
 * - /root/login: そのまま表示 (ログイン画面は認証チェック対象外)
 * - 認証済: 子を表示
 *
 * パターン: Tree の TreeAuthGate を踏襲。
 */

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { colors } from "../_constants/colors";
import { saveReturnTo } from "../_lib/auth";
import { useRootState } from "../_state/RootStateContext";

export function RootGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useRootState();
  const pathname = usePathname();
  const router = useRouter();

  const isLoginPage = pathname === "/root/login";

  useEffect(() => {
    if (!loading && !isAuthenticated && !isLoginPage) {
      if (pathname) saveReturnTo(pathname);
      router.replace("/root/login");
    }
  }, [loading, isAuthenticated, isLoginPage, pathname, router]);

  if (isLoginPage) return <>{children}</>;

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: colors.bg,
          color: colors.textMuted,
          fontSize: 14,
        }}
      >
        認証確認中...
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return <>{children}</>;
}
```

- [ ] **Step 2: 型チェック**

```bash
npm run build
```

Expected: build 通る。

- [ ] **Step 3: Commit**

```bash
git add src/app/root/_components/RootGate.tsx
git commit -m "feat(root): 認証ゲート RootGate を追加 (returnTo 保存付)"
```

---

## Task 8: `UserHeader` コンポーネント + `RootShell` 修正

**Files:**
- Create: `src/app/root/_components/UserHeader.tsx`
- Modify: `src/app/root/_components/RootShell.tsx`

- [ ] **Step 1: UserHeader 作成**

```typescript
"use client";

import { GARDEN_ROLE_LABELS } from "../_constants/types";
import { colors } from "../_constants/colors";
import { useRootState } from "../_state/RootStateContext";

export function UserHeader() {
  const { rootUser, gardenRole, signOut } = useRootState();
  if (!rootUser || !gardenRole) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "12px 24px",
        background: colors.bgPanel,
        borderBottom: `1px solid ${colors.border}`,
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 14, color: colors.text }}>
          👤 {rootUser.name}
        </span>
        <span
          style={{
            fontSize: 11,
            color: colors.textMuted,
            background: colors.bg,
            padding: "2px 8px",
            borderRadius: 4,
          }}
        >
          {GARDEN_ROLE_LABELS[gardenRole]}
        </span>
        <button
          type="button"
          onClick={() => signOut("manual")}
          style={{
            padding: "6px 12px",
            background: colors.bgPanel,
            border: `1px solid ${colors.border}`,
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 12,
            color: colors.textMuted,
          }}
        >
          ログアウト
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: RootShell 修正**

既存の `src/app/root/_components/RootShell.tsx` の `<main>` 内を以下のように修正:

```typescript
      {/* メインコンテンツ */}
      <main style={{ flex: 1, maxWidth: "100%", overflow: "auto", display: "flex", flexDirection: "column" }}>
        <UserHeader />
        <div style={{ padding: "24px 32px", flex: 1 }}>
          {children}
        </div>
        <SessionWarningModal />
      </main>
```

ファイル冒頭の import に追加:

```typescript
import { UserHeader } from "./UserHeader";
import { SessionWarningModal } from "./SessionWarningModal";
```

- [ ] **Step 3: 型チェック**

```bash
npm run build
```

Expected: build 通る。

- [ ] **Step 4: Commit**

```bash
git add src/app/root/_components/UserHeader.tsx src/app/root/_components/RootShell.tsx
git commit -m "feat(root): RootShell にユーザー情報ヘッダー + セッション警告を追加"
```

---

## Task 9: ログイン画面 `login/page.tsx`

**Files:**
- Create: `src/app/root/login/page.tsx`

- [ ] **Step 1: ディレクトリ作成**

```bash
mkdir -p src/app/root/login
```

- [ ] **Step 2: ファイル作成**

```typescript
"use client";

/**
 * Garden-Root ログイン画面 (/root/login)
 *
 * フロー:
 *   1. 社員番号 + パスワード入力
 *   2. signInRoot() で擬似メールに変換 → Supabase Auth
 *   3. 成功: refreshAuth() で garden_role を取得 (manager+ チェック込み)
 *   4. 成功 & 権限 OK: popReturnTo() で復帰 URL へ遷移
 *   5. 失敗/権限拒否: エラーメッセージ + 監査ログ
 */

import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";

import { colors } from "../_constants/colors";
import {
  popReturnTo,
  signInRoot,
  toSyntheticEmail,
} from "../_lib/auth";
import { writeAudit } from "../_lib/audit";
import { useRootState } from "../_state/RootStateContext";

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
  fontSize: 16,
  outline: "none",
  boxSizing: "border-box",
  background: colors.bgPanel,
  color: colors.text,
};

export default function RootLoginPage() {
  const router = useRouter();
  const { isAuthenticated, refreshAuth } = useRootState();
  const [empId, setEmpId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace(popReturnTo());
    }
  }, [isAuthenticated, router]);

  const handleLogin = async () => {
    if (loading) return;
    if (!empId || !password) {
      setError("社員番号とパスワードを入力してください");
      return;
    }
    setLoading(true);
    setError("");

    // 1. Supabase Auth サインイン
    const signInResult = await signInRoot(empId, password);
    if (!signInResult.success) {
      // login_failed 監査ログ (社員番号が存在しない場合も含む)
      await writeAudit({
        action: "login_failed",
        actorEmpNum: empId,
        payload: { email: toSyntheticEmail(empId), reason: signInResult.error },
      });
      setError(signInResult.error ?? "ログインに失敗しました");
      setLoading(false);
      return;
    }

    // 2. garden_role 確認 (refreshAuth 内で login_denied 監査ログも書かれる)
    const authResult = await refreshAuth();
    if (!authResult.success) {
      setError(authResult.error ?? "権限情報の取得に失敗しました");
      setLoading(false);
      return;
    }

    // 3. login_success 監査ログ
    await writeAudit({
      action: "login_success",
      actorUserId: signInResult.userId,
      actorEmpNum: empId,
    });

    // 4. 復帰 URL に遷移
    router.replace(popReturnTo());
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: colors.bg,
        fontFamily: "system-ui, -apple-system, 'Segoe UI', Meiryo, sans-serif",
      }}
    >
      <div
        style={{
          width: 380,
          padding: 40,
          background: colors.bgPanel,
          borderRadius: 12,
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        }}
      >
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: colors.text,
            margin: "0 0 8px",
            textAlign: "center",
          }}
        >
          Garden Root
        </h1>
        <p
          style={{
            fontSize: 12,
            color: colors.textMuted,
            margin: "0 0 32px",
            textAlign: "center",
          }}
        >
          マスタ管理画面 ログイン
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleLogin();
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                fontSize: 12,
                color: colors.textMuted,
                display: "block",
                marginBottom: 4,
              }}
            >
              社員番号
            </label>
            <input
              type="text"
              placeholder="4桁の社員番号"
              maxLength={4}
              value={empId}
              onChange={(e) => setEmpId(e.target.value)}
              style={inputStyle}
              inputMode="numeric"
              autoComplete="username"
              disabled={loading}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                fontSize: 12,
                color: colors.textMuted,
                display: "block",
                marginBottom: 4,
              }}
            >
              パスワード
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          {error && (
            <div
              style={{
                color: colors.danger,
                background: colors.dangerBg,
                padding: "10px 12px",
                borderRadius: 6,
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px 16px",
              background: colors.primary,
              color: colors.textOnDark,
              border: "none",
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "認証中..." : "ログイン"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 型チェック**

```bash
npm run build
```

Expected: build 通る。

- [ ] **Step 4: Commit**

```bash
git add src/app/root/login/
git commit -m "feat(root): ログイン画面 /root/login を追加"
```

---

## Task 10: `layout.tsx` で Provider + Gate をラップ

**Files:**
- Modify: `src/app/root/layout.tsx`

- [ ] **Step 1: ファイル全文置換**

`src/app/root/layout.tsx`:

```typescript
import { ReactNode } from "react";
import { RootShell } from "./_components/RootShell";
import { RootGate } from "./_components/RootGate";
import { RootStateProvider } from "./_state/RootStateContext";

export const metadata = {
  title: "Garden Root — マスタ管理",
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <RootStateProvider>
      <RootGate>
        <RootShell>{children}</RootShell>
      </RootGate>
    </RootStateProvider>
  );
}
```

**注意**: ログイン画面 (`/root/login`) も同じ layout.tsx を通るが、`RootGate` がログイン画面を特別扱い (そのまま表示) するので OK。ただし `RootShell` (サイドバー付) がログイン画面でも描画されるのは違和感あるので、**Step 2** でログイン画面用の別 layout を作る。

- [ ] **Step 2: ログイン画面専用 layout を追加**

`src/app/root/login/layout.tsx` を新規作成:

```typescript
import { ReactNode } from "react";
import { RootStateProvider } from "../_state/RootStateContext";
import { RootGate } from "../_components/RootGate";

export default function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <RootStateProvider>
      <RootGate>{children}</RootGate>
    </RootStateProvider>
  );
}
```

これで `/root/login` は RootShell (サイドバー) を通らない。

**懸念**: Next.js の nested layout 規則では子 layout が親 layout の中で動作するため、上記だけでは親の RootShell が残る。解決策は `src/app/root/(masters)/layout.tsx` のようなルートグループを作り、7 マスタをそこに移動する案。ただし影響範囲が大きいので **Phase 1 では簡易対応**として、ログイン画面は RootShell のサイドバーをハードコードで非表示にする:

`RootShell.tsx` を修正 (冒頭に分岐を追加):

```typescript
export function RootShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // ログイン画面はシェル無し (サイドバー・ヘッダー非表示)
  if (pathname === "/root/login") {
    return <>{children}</>;
  }

  // 以下既存のシェル描画...
```

Step 2 の `src/app/root/login/layout.tsx` は**作らない**。この簡易対応に統一。

- [ ] **Step 3: 型チェック**

```bash
npm run build
```

Expected: build 通る。

- [ ] **Step 4: 動作確認 (dev サーバー)**

```bash
npm run dev
```

ブラウザで:
- `http://localhost:3000/root` → 未ログインなら `/root/login` にリダイレクトされる
- ログイン画面が描画される (サイドバーなし)
- 適当な社員番号 (例: 9999) で試行 → 「社員番号またはパスワードが...」エラー

確認後 Ctrl+C で停止。

- [ ] **Step 5: Commit**

```bash
git add src/app/root/layout.tsx src/app/root/_components/RootShell.tsx
git commit -m "feat(root): layout を Provider + Gate でラップ (ログイン画面はシェル省略)"
```

---

## Task 11: 7 マスタ画面に canWrite で編集制御を適用

**Files (修正):**
- `src/app/root/companies/page.tsx`
- `src/app/root/bank-accounts/page.tsx`
- `src/app/root/vendors/page.tsx`
- `src/app/root/employees/page.tsx`
- `src/app/root/salary-systems/page.tsx`
- `src/app/root/insurance/page.tsx`
- `src/app/root/attendance/page.tsx`

### 共通パターン

各ページの冒頭に:

```typescript
import { useRootState } from "../_state/RootStateContext";
```

コンポーネント関数内:

```typescript
const { canWrite } = useRootState();
```

**「新規追加」ボタン** を探し、`disabled={!canWrite}` と `title` 属性を追加:

```tsx
<Button
  onClick={...}
  disabled={!canWrite}
  title={canWrite ? undefined : "編集権限がありません（管理者以上）"}
>
  ＋新規追加
</Button>
```

**編集モーダルを開くトリガー** (行クリック等) に対して `canWrite` を渡し、モーダル内の保存ボタンを同様に disable。

**無効化トグル** も同様に disable。

### 手順: companies/page.tsx を例にする

- [ ] **Step 1: companies/page.tsx 修正**

`src/app/root/companies/page.tsx` を開き:

1. import 追加:
```typescript
import { useRootState } from "../_state/RootStateContext";
import { writeAudit } from "../_lib/audit";
```

2. コンポーネント先頭で:
```typescript
const { canWrite, rootUser } = useRootState();
```

3. `handleSave` の最後 (成功後) に監査ログを追加:
```typescript
await writeAudit({
  action: "master_update",
  actorUserId: rootUser?.user_id ?? null,
  actorEmpNum: rootUser?.employee_number ?? null,
  targetType: "root_companies",
  targetId: editTarget.company_id,
  payload: { value: editTarget },
});
```

4. `handleToggleActive` の成功後:
```typescript
await writeAudit({
  action: "master_update",
  actorUserId: rootUser?.user_id ?? null,
  actorEmpNum: rootUser?.employee_number ?? null,
  targetType: "root_companies",
  targetId: c.company_id,
  payload: { toggle_active: !c.is_active },
});
```

5. 両関数の先頭に権限チェックを追加:
```typescript
if (!canWrite) {
  await writeAudit({
    action: "permission_denied",
    actorUserId: rootUser?.user_id ?? null,
    actorEmpNum: rootUser?.employee_number ?? null,
    targetType: "root_companies",
    payload: { attempted: "save" },  // または "toggle_active"
  });
  setError("編集権限がありません");
  return;
}
```

6. `Button` の `disabled` / `title` 属性を追加 (新規追加・保存・無効化ボタン全て):

```tsx
<Button
  disabled={!canWrite}
  title={!canWrite ? "編集権限がありません（管理者以上）" : undefined}
  onClick={...}
>...</Button>
```

- [ ] **Step 2: ほか 6 ページも同じパターンで修正**

残り 6 ページについて、ターゲットテーブルだけ変えて同じ修正を適用:
- `bank-accounts/page.tsx` → `root_bank_accounts`
- `vendors/page.tsx` → `root_vendors`
- `employees/page.tsx` → `root_employees`
- `salary-systems/page.tsx` → `root_salary_systems`
- `insurance/page.tsx` → `root_insurance`
- `attendance/page.tsx` → `root_attendance`

- [ ] **Step 3: 型チェック**

```bash
npm run build
```

Expected: build 通る。

- [ ] **Step 4: Commit**

```bash
git add src/app/root/**/page.tsx
git commit -m "feat(root): 7マスタ画面に canWrite 制御 + 監査ログを適用"
```

---

## Task 12: Supabase RLS ポリシー更新

**Files:**
- Create: `scripts/root-rls-phase1.sql`

- [ ] **Step 1: SQL ファイル作成**

`scripts/root-rls-phase1.sql`:

```sql
-- ============================================================
-- Garden Root — Phase 1 RLS ポリシー更新
-- ============================================================
-- 目的:
--   7 マスタテーブルに対して garden_role ベースの RLS を適用し、
--   開発用の「全員全許可」ポリシーを置き換える。
--
-- 前提:
--   scripts/root-auth-schema.sql が適用済みであること
--   (root_can_access / root_can_write / root_is_super_admin が存在)
--
-- 冪等性: DROP POLICY IF EXISTS + CREATE POLICY で何度実行してもよい
-- ============================================================

-- ------------------------------------------------------------
-- root_companies
-- ------------------------------------------------------------
ALTER TABLE root_companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dev_companies_all ON root_companies;
DROP POLICY IF EXISTS root_companies_select ON root_companies;
DROP POLICY IF EXISTS root_companies_write ON root_companies;

-- 閲覧: manager 以上
CREATE POLICY root_companies_select ON root_companies
  FOR SELECT
  USING (root_can_access());

-- 書込 (INSERT/UPDATE/DELETE): admin 以上
CREATE POLICY root_companies_write ON root_companies
  FOR ALL
  USING (root_can_write())
  WITH CHECK (root_can_write());

-- ------------------------------------------------------------
-- root_bank_accounts
-- ------------------------------------------------------------
ALTER TABLE root_bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dev_bank_accounts_all ON root_bank_accounts;
DROP POLICY IF EXISTS root_bank_accounts_select ON root_bank_accounts;
DROP POLICY IF EXISTS root_bank_accounts_write ON root_bank_accounts;

CREATE POLICY root_bank_accounts_select ON root_bank_accounts
  FOR SELECT USING (root_can_access());
CREATE POLICY root_bank_accounts_write ON root_bank_accounts
  FOR ALL USING (root_can_write()) WITH CHECK (root_can_write());

-- ------------------------------------------------------------
-- root_vendors
-- ------------------------------------------------------------
ALTER TABLE root_vendors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dev_vendors_all ON root_vendors;
DROP POLICY IF EXISTS root_vendors_select ON root_vendors;
DROP POLICY IF EXISTS root_vendors_write ON root_vendors;

CREATE POLICY root_vendors_select ON root_vendors
  FOR SELECT USING (root_can_access());
CREATE POLICY root_vendors_write ON root_vendors
  FOR ALL USING (root_can_write()) WITH CHECK (root_can_write());

-- ------------------------------------------------------------
-- root_employees
-- ------------------------------------------------------------
-- 注意: Tree からの本人参照 (root_employees_select_own) は維持する
-- manager 以上は全員閲覧可、admin 以上は編集可

ALTER TABLE root_employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS root_employees_select_all ON root_employees;
DROP POLICY IF EXISTS root_employees_write ON root_employees;

-- manager 以上は全員参照可 (Tree Phase A で追加済みの root_employees_select_manager と併用)
-- root_employees_select_own は Tree Phase A で作成済み、変更なし

CREATE POLICY root_employees_write ON root_employees
  FOR ALL USING (root_can_write()) WITH CHECK (root_can_write());

-- ------------------------------------------------------------
-- root_salary_systems
-- ------------------------------------------------------------
ALTER TABLE root_salary_systems ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dev_salary_systems_all ON root_salary_systems;
DROP POLICY IF EXISTS root_salary_systems_select ON root_salary_systems;
DROP POLICY IF EXISTS root_salary_systems_write ON root_salary_systems;

CREATE POLICY root_salary_systems_select ON root_salary_systems
  FOR SELECT USING (root_can_access());
CREATE POLICY root_salary_systems_write ON root_salary_systems
  FOR ALL USING (root_can_write()) WITH CHECK (root_can_write());

-- ------------------------------------------------------------
-- root_insurance
-- ------------------------------------------------------------
ALTER TABLE root_insurance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dev_insurance_all ON root_insurance;
DROP POLICY IF EXISTS root_insurance_select ON root_insurance;
DROP POLICY IF EXISTS root_insurance_write ON root_insurance;

CREATE POLICY root_insurance_select ON root_insurance
  FOR SELECT USING (root_can_access());
CREATE POLICY root_insurance_write ON root_insurance
  FOR ALL USING (root_can_write()) WITH CHECK (root_can_write());

-- ------------------------------------------------------------
-- root_attendance
-- ------------------------------------------------------------
ALTER TABLE root_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dev_attendance_all ON root_attendance;
DROP POLICY IF EXISTS root_attendance_select ON root_attendance;
DROP POLICY IF EXISTS root_attendance_write ON root_attendance;

CREATE POLICY root_attendance_select ON root_attendance
  FOR SELECT USING (root_can_access());
CREATE POLICY root_attendance_write ON root_attendance
  FOR ALL USING (root_can_write()) WITH CHECK (root_can_write());

-- ------------------------------------------------------------
-- 確認クエリ (手動実行推奨)
-- ------------------------------------------------------------
-- SELECT schemaname, tablename, policyname, cmd, qual
--   FROM pg_policies
--   WHERE tablename LIKE 'root_%'
--   ORDER BY tablename, cmd;
```

- [ ] **Step 2: ユーザーに SQL 適用を依頼**

```
東海林さんへ:

Supabase Dashboard → SQL Editor にアクセスし、
scripts/root-rls-phase1.sql の内容を貼り付けて Run してください。

適用後、末尾のコメントアウトされた確認クエリを実行し、
各 root_* テーブルに select / write ポリシーが表示されれば成功です。
```

待機: ユーザーから「適用しました」を受けるまで次タスクに進まない。

- [ ] **Step 3: Commit**

```bash
git add scripts/root-rls-phase1.sql
git commit -m "feat(root): Phase 1 RLS ポリシー (garden_role で7マスタを制限)"
```

---

## Task 13: 動作検証 + ビルド確認

**Files:** なし (読み取りのみ)

- [ ] **Step 1: 最終ビルド**

```bash
npm run build
```

Expected: exit 0。型エラー・lint エラーなし。

- [ ] **Step 2: dev サーバーで手動シナリオ確認 (Claude 担当分)**

```bash
npm run dev
```

以下のシナリオをブラウザ自動化ツール (mcp__Claude_in_Chrome) で順に実施:

**正常系**:
- シナリオ 1: super_admin (0008 / 東海林) ログイン → Root トップ表示、サイドバーから「法人マスタ」クリック → 編集ボタン押下可能
- シナリオ 4: 法人の代表者名を編集 → 保存成功を確認
- シナリオ 5: `/root/employees` にアクセスした状態でログアウト → 再ログイン後に `/root/employees` に戻ることを確認
- シナリオ 6: ヘッダーの「ログアウト」押下 → `/root/login` に遷移

**異常・権限系**:
- シナリオ 7: staff (0009 / 萩尾) でログイン試行 (パスワードは `root_employees.birthday` から MMDD 形式を取得) → 「Garden-Root へのアクセス権限がありません」エラー表示
- シナリオ 8: 9999 (存在しない) でログイン試行 → 「社員番号またはパスワード...」エラー
- シナリオ 9: 0008 + 間違ったパスワード → 同上
- シナリオ 10: manager (1165 / 宮永) でログイン後、法人マスタで「＋新規追加」ボタンがグレーアウト + tooltip 表示
- シナリオ 11, 12: dev モードは 30 秒タイムアウトなので、ログイン後に 20 秒放置 → 警告モーダル。さらに 10 秒放置 → 自動ログアウト。
- シナリオ 13: DevTools の Network タブで Offline にしてログイン試行 → 通信エラー表示

手動確認が必要なシナリオ (2, 3): 後道さん (0000) / 宮永 (1165) のアカウント動作は東海林さん側でスクショ確認。

- [ ] **Step 3: Supabase 監査ログの目視確認 (任意・東海林さん)**

Supabase Dashboard → Table Editor → `root_audit_log` を開き、上記シナリオに対応する行が追加されているか目視確認。

- [ ] **Step 4: 他モジュールへの回帰確認**

dev サーバー起動中に以下をブラウザで開く:
- `http://localhost:3000/tree/login` → Tree ログイン画面が正常表示されること
- `http://localhost:3000/forest` → Forest がログイン要求することを確認

どちらも変更していないので既存動作を維持しているはず。

- [ ] **Step 5: Commit (検証結果メモ)**

```bash
# 追加のコミット不要 (動作確認のみ)
```

---

## Task 14: PR 作成 + ハンドオフメモ

**Files:**
- Create: `docs/handoff-20260423.md` (翌日 → 内容の tomorrow 予定含めた引継ぎ)

- [ ] **Step 1: ハンドオフメモ作成**

`docs/handoff-20260423.md`:

```markdown
# Handoff - 2026-04-23 (b-main)

## 今やっていること
Garden-Root Phase 1 (認証・権限管理) の実装完了。feature/root-auth-ui ブランチで PR 作成待ち / 東海林さんの最終動作確認待ち。

## 次にやるべきこと
- GitHub で PR 作成 (base: develop, head: feature/root-auth-ui)
- レビュー後 develop にマージ
- Phase 2 (他アプリからの参照ルール整備) に着手:
  - Tree Phase A と同じ RLS パターンを Bud / Leaf に展開
  - 関連 memory: project_garden_root_access.md

## 注意点・詰まっている点
- ⚠️ dev モードタイマー 30 秒は本番前に確認: NODE_ENV === "production" のとき 2h になるので Vercel では自動切替。ただし目視確認推奨
- RLS 適用: scripts/root-rls-phase1.sql は Supabase に適用済 (Task 12 で東海林さんが実施)
- シナリオ 2 (後道 admin) / シナリオ 3 (宮永 manager) の最終 UX 確認は東海林さんに依頼済

## 関連情報
- ブランチ: feature/root-auth-ui
- 設計書: docs/superpowers/specs/2026-04-22-root-auth-phase-1-design.md
- プラン: docs/superpowers/plans/2026-04-22-root-auth-phase-1-plan.md
- 関連PR: (未作成 / 作成後に追記)
```

- [ ] **Step 2: Push + PR 作成案内**

```bash
git push -u origin feature/root-auth-ui
```

```
東海林さんへ:

実装完了しました。以下から PR を作成してください:
https://github.com/Hyuaran/garden/pull/new/feature/root-auth-ui

base: develop
head: feature/root-auth-ui
title: feat(root): Phase 1 認証・権限管理
```

- [ ] **Step 3: 日報に 1 行追加**

```powershell
C:\garden\_tools\daily-log.ps1 "Garden-Rootに認証とアクセス権限の仕組みを追加（ログイン画面・自動ログアウト・編集権限・操作記録）"
```

tomorrow 予定 (後続作業がある場合):

```powershell
python "G:/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/006_日報自動配信/send_report.py" tomorrow "Garden-Rootの他アプリ連携ルール整備に着手"
```

- [ ] **Step 4: Commit**

```bash
git add docs/handoff-20260423.md
git commit -m "docs(root): Phase 1 完了ハンドオフ (次回 Phase 2 着手予定)"
git push origin feature/root-auth-ui
```

---

## Self-Review

### スペックとの対応チェック

| 設計書セクション | プラン対応箇所 |
|---|---|
| §3 画面と操作の流れ | Task 7 (Gate), Task 8 (Shell), Task 9 (Login), Task 10 (Layout) |
| §4 権限マトリックス | Task 5 (canWrite), Task 11 (各画面適用), Task 12 (RLS) |
| §5 監査ログ | Task 3 (audit.ts), Task 9 (login系4種), Task 11 (master_update/permission_denied), Task 5 (logout) |
| §6 セッション管理 | Task 2 (タイマー定数), Task 5 (Context 内タイマー), Task 6 (警告モーダル) |
| §7 エラー処理 | Task 9 (login エラー), Task 5 (refreshAuth 分岐), Task 11 (canWrite 拒否) |
| §8 テスト方針 | Task 13 (13 シナリオ検証) |
| §9 実装対象ファイル | 全タスク (File Structure 参照) |

すべての設計書セクションに対応タスクあり。

### プレースホルダースキャン

- ❌ TBD / TODO / 未定 なし
- ❌ 「適切なエラー処理を追加」等の曖昧表現なし
- ❌ コードブロックなしで「同様に実装」はなし (例外: Task 11 の 6 ページは明示的に「残り 6 ページも同じパターンで」だが、各ページのターゲットテーブル名を列挙済み)

### 型整合性

- `RootUser` / `GardenRole` / `RootStateValue` の型定義が全タスクで整合
- `signOut(reason: LogoutReason)` の `LogoutReason` 型は Task 5 で定義・Task 6 / Task 8 / Task 10 で使用

---

## 合計タスク数
- 主要タスク: **14 個**
- 推定実装時間 (Claude ベース): **2〜3 時間** (各タスク 5〜15 分 + 検証)
- 依存関係: Task 1-4 並列可、Task 5 以降は逐次
