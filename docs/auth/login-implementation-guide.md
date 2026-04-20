# Garden 認証実装ガイド（他プロジェクト転用可能版）

> 社員番号 + パスワード のログイン方式を Supabase Auth で実装するためのリファレンス実装。
> Garden シリーズの Tree / Forest / 他モジュール、および類似の社内業務システムで転用可能。

---

## 🎯 設計方針

### 要求仕様
- ユーザーは **社員番号（4桁）+ パスワード** でログインする
- メールアドレスは使わない（社員が覚えづらい）
- Supabase Auth のセキュリティ機能は活用したい（ハッシュ化、セッション管理、JWT等）
- ロールに応じて **パスワードポリシーを変える**

### 採用方式：擬似メールマッピング

ユーザーが入力した社員番号を、フロント側で **擬似メールアドレス** に変換してから Supabase Auth に渡す。

```
社員番号 "0008"
  ↓（フロントエンドで変換）
擬似メール "emp0008@garden.internal"
  ↓
Supabase Auth.signInWithPassword({ email, password })
```

### なぜこの方式か

| 選択肢 | 採用 | 理由 |
|---|---|---|
| Supabase Auth（メール+パスワード） | △ | 社員がメールを覚えられない |
| 完全自前認証（DB直参照） | ✗ | セキュリティ実装が負担、Supabase機能が使えない |
| **擬似メールマッピング（採用）** | ✅ | Supabase Authの機能活用＋UXは社員番号 |
| SAML/OIDC（SSO） | ✗ | 規模に対してオーバースペック |

---

## 📋 パスワードポリシー

### ロール別

| ロール | 形式 | 例 | 理由 |
|---|---|---|---|
| **一般社員** | 誕生日 MMDD（4桁数字） | `0417`（4月17日生まれ） | 覚えやすさ。業務で頻繁にログイン |
| **管理者（admin）** | 自由長・自由文字種 | `Garden2026!` | 機密情報アクセス。強度重視 |

### 重要な注意

- 誕生日パスワードは **約366通り** しかなく、総当たり攻撃に弱い
- **機密性の高いモジュール**（経理・人事・経営等）は必ず admin ロール + 自由長パスワードにする
- 業務系モジュール（打刻・架電）のみ誕生日パスワード許容

---

## 🏗️ 実装構成

### 必要なテーブル

#### `{module}_users` テーブル（モジュールごとの権限管理）

```sql
CREATE TABLE forest_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_number text NOT NULL,           -- 社員番号（4桁）
  role text NOT NULL DEFAULT 'viewer',     -- 'admin' or 'viewer' 等
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_{module}_users_emp ON {module}_users(employee_number);
```

### 社員番号の採番ルール

- 勤怠管理システムの社員番号を正とする
- 勤怠システムにいない特別ユーザー（社長・外部顧問等）は `0000` または予約番号
- 必ず4桁ゼロパディング（"8" ではなく "0008"）

---

## 💻 実装コード（TypeScript / Next.js 例）

### 1. 認証ヘルパー（`auth.ts`）

```typescript
import { supabase } from "./supabase";

const UNLOCKED_KEY = "moduleUnlockedAt";  // モジュール名に応じて変更

/**
 * 社員番号 → 擬似メールアドレスへの変換
 * 例: "0008" → "emp0008@garden.internal"
 */
function toSyntheticEmail(empId: string): string {
  // 4桁ゼロパディング（もし桁足りなければ）
  const padded = empId.padStart(4, "0");
  return `emp${padded}@garden.internal`;
}

/**
 * 社員番号+パスワードでログイン
 */
export async function signInByEmployeeNumber(
  empId: string,
  password: string,
): Promise<{ success: boolean; error?: string }> {
  const email = toSyntheticEmail(empId);
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { success: false, error: "社員番号またはパスワードが正しくありません" };
  }
  sessionStorage.setItem(UNLOCKED_KEY, Date.now().toString());
  return { success: true };
}

export function signOut(): void {
  sessionStorage.removeItem(UNLOCKED_KEY);
  supabase.auth.signOut();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}
```

### 2. ログインUI（`LoginPage.tsx` or `LoginGate.tsx`）

```tsx
"use client";
import { useState, type FormEvent } from "react";
import { signInByEmployeeNumber } from "./auth";

export function LoginForm() {
  const [empId, setEmpId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!empId || !password) return;

    setLoading(true);
    setError("");

    const result = await signInByEmployeeNumber(empId, password);
    if (result.success) {
      // 後続処理：ダッシュボードへ遷移、権限チェック等
      window.location.href = "/dashboard";
    } else {
      setError(result.error ?? "ログインに失敗しました");
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>社員番号</label>
      <input
        type="text"
        value={empId}
        onChange={(e) => setEmpId(e.target.value.replace(/\D/g, ""))} // 数字のみ
        maxLength={4}
        inputMode="numeric"
        placeholder="4桁の社員番号"
        autoComplete="username"
      />

      <label>パスワード</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="パスワード"
        autoComplete="current-password"
        // maxLength は付けない（admin は自由長のため）
        // inputMode も付けない（admin は英数字記号対応のため）
      />

      {error && <p style={{ color: "red" }}>{error}</p>}

      <button type="submit" disabled={loading || !empId || !password}>
        {loading ? "確認中..." : "ログイン"}
      </button>
    </form>
  );
}
```

### 3. 権限チェック（モジュール側）

```typescript
// ログイン成功後、または初回アクセス時にチェック
export async function checkModulePermission(userId: string) {
  const { data, error } = await supabase
    .from("forest_users")  // モジュールの users テーブル
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return { hasPermission: false, user: null };
  }
  return { hasPermission: true, user: data };
}
```

---

## 🔐 Supabase 初期セットアップ

### 1. ユーザー作成（Supabase Dashboard）

Supabase Dashboard → Authentication → Users → **Add user** → **Create new user**

| 入力項目 | 値 |
|---|---|
| Email | `emp0008@garden.internal`（擬似メール） |
| Password | 社員のパスワード |
| Auto Confirm User | **✅ チェック必須**（メール検証をスキップ） |

### 2. 権限テーブルへの登録

```sql
-- Authenticationで作成したユーザーのUUIDを使って権限付与
INSERT INTO forest_users (user_id, employee_number, role)
SELECT id, '0008', 'admin'
FROM auth.users
WHERE email = 'emp0008@garden.internal';
```

### 3. パスワード変更時の運用

**Supabase Dashboard** → Authentication → Users → 対象ユーザー → **Reset Password** または **Update password**

---

## 🛡️ セキュリティ考慮事項

### Row Level Security (RLS)

権限テーブルを使った RLS ポリシーで、ログイン済みかつ権限ありのユーザーだけが参照できるようにする：

```sql
CREATE POLICY "forest_select_data" ON companies
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM forest_users)
  );
```

### セッション管理

- Supabase Auth のセッション（JWT）を使用
- 機密モジュールは `sessionStorage` で別途タイマーを持つ（タブ閉じで失効）
- 2時間無操作で自動ログアウト（`session-timer.ts` 参照）

### 監査ログ

```sql
CREATE TABLE forest_audit_log (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,        -- 'login', 'login_failed', 'view_dashboard' 等
  target text,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### 擬似メールドメイン

- `@garden.internal` は **RFC 2606 で予約されていない** ため、厳密には正しくない
- より厳密にするなら `@garden.test` や `@garden.example` を使う（RFC 2606予約済）
- 現状は実害なし（Supabaseは送信しない）

---

## ⚠️ Phase A 既知の制限（Phase B/C 対応予定）

### B-1. 監査ログ改ざんリスク【Phase B 必須】

`forest_audit_log` への INSERT はクライアント側（anon key）から行っているため、**認証済みユーザーは任意の `action` / `target` / `user_id` を詐称した INSERT が可能**。

現状の保護:
- RLS で `user_id = auth.uid()` を強制（authenticated アクション）
- `login_failed` のみ `user_id IS NULL` に制限（anon ポリシー）

Phase B 対応:
- 監査ログ INSERT を **Supabase Edge Function 経由** に変更
- Edge Function 側で `auth.uid()` を取得・強制し、クライアント指定の `user_id` を無視
- IP アドレスも Edge Function 側で付与
- クライアントからの直接 INSERT を禁止（RLS で INSERT ポリシー削除）

---

### B-3. sessionStorage ゲートは UI ガードのみ【Phase C 課題】

`sessionStorage` に `forestUnlockedAt` を保存してゲート通過を管理しているが、
**`sessionStorage` は JavaScript から自由に読み書き可能**。

攻撃シナリオ:
```javascript
// XSS やサプライチェーン攻撃で1行実行されるとゲートが突破される
sessionStorage.setItem("forestUnlockedAt", Date.now().toString());
```

**重要**: ゲートは UI レベルのアクセス制御のみ。  
**実質的なデータ保護は Supabase RLS が担っている**（`forest_users` 登録が真の権限境界）。

Phase C 対応:
- Next.js Server Component で `cookies()` から httpOnly Cookie を読む方式に変更
- セッション管理をサーバー側に移行（XSS でも改ざん不可）

---

## 📝 他プロジェクトへの転用手順

1. このファイル（`login-implementation-guide.md`）をコピー
2. プロジェクト独自の調整
   - テーブル名：`forest_users` → `{yourmodule}_users`
   - 擬似メールドメイン：`@garden.internal` → `@yourproject.internal`
   - SessionStorage キー名：`moduleUnlockedAt` → `{yourmodule}UnlockedAt`
3. 必要な依存パッケージ：`@supabase/supabase-js`
4. 環境変数：`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. `auth.ts` → `LoginPage.tsx` → `権限チェック` の順に実装
6. Supabase 側でユーザー作成 → 権限テーブル INSERT

---

## 🔗 関連ドキュメント

- `docs/superpowers/specs/2026-04-16-forest-migration-design.md` — Forest Phase A 設計書
- `.claude/memory/project_garden_auth_policy.md` — Garden認証ポリシー（Claude Memory）
- Supabase Auth 公式ドキュメント: https://supabase.com/docs/guides/auth

---

## 📅 更新履歴

| 日付 | 変更内容 | 担当 |
|---|---|---|
| 2026-04-17 | 初版作成（Garden Forest Phase A 実装時） | 東海林 + Claude |
