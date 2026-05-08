# Root Phase B-5: 認証セキュリティ強化 仕様書

- 対象: Garden-Root の認証フロー全般（パスワードポリシー・2FA・セッション・ブルートフォース対策）
- 見積: **2.5d**（内訳は §10）
- 担当セッション: a-root
- 作成: 2026-04-25（a-root / Phase B-5 spec 起草）
- 元資料: `docs/auth/login-implementation-guide.md`, Phase A 認証実装, `docs/known-pitfalls.md` #4

---

## 1. 目的とスコープ

### 目的

Garden-Root は従業員マスタ・給与情報・権限管理を担う中枢モジュールであり、セキュリティ要件は `§16 モジュール別厳格度` で **Root = 🔴 厳格** と定められている。Phase A では「社員番号 + 初期 PW（誕生日 MMDD）」という最低限の認証を実装したが、以下のリスクが未対処のまま残っている。

- 初期 PW（MMDD 4 桁）は約 366 通りしかなく、ブルートフォースで容易に破られる
- パスワードローテーション運用が明文化されておらず、強制変更の仕組みがない
- admin / super_admin ロールに対して追加認証（2FA）がない
- セッションタイムアウトがロール横断で一律 2 時間になっており、特権ロールにとっては長すぎる
- ログイン失敗のカウント・ロック機能が未実装で、繰り返し攻撃に無防備

本 spec はこれらのリスクを段階的に解消するための設計方針と実装要件を定める。

### 含める

- パスワード再発行ポリシー（初期 PW 強制変更・強度要件・過去パスワード再利用禁止）
- 2FA（TOTP）導入設計（admin / super_admin は必須化、staff 以下は任意）
- セッション管理強化（ロール別タイムアウト・同時セッション制限・デバイス一覧 UI）
- ブルートフォース対策（失敗回数カウント・アカウントロック・IP レート制限）

### 含めない

- SMS 2FA の実装（判断保留 §11 参照）
- 既存セッションの強制移行（Phase B 完了後の猶予期間で段階移行）
- kintone / FileMaker との SSO 連携
- 外部 IdP（Google Workspace 等）との連携

---

## 2. 既存実装との関係

### Phase A 認証スキーマ（現状把握）

| 構成要素 | 現状 |
|---|---|
| 認証方式 | Supabase Auth（メール/パスワード）+ 擬似メール `emp{NNNN}@garden.internal` |
| 初期パスワード | 誕生日 MMDD（4 桁数字） |
| セッション管理 | `sessionStorage.rootUnlockedAt` + `SESSION_TIMEOUT_MS = 2h`（`session-timer.ts`） |
| ロール | 8 種: toss / closer / cs / staff / outsource / manager / admin / super_admin |
| ロール格納 | `root_employees.garden_role`（text + CHECK 制約、`known-pitfalls.md` #6 参照） |
| 認証 → 従業員連携 | `root_employees.user_id → auth.users(id)` FK |
| 監査ログ | `root_audit_log`（`_lib/audit.ts` 経由）: login_success / login_failed / login_denied / logout |
| ブルートフォース対策 | なし（Phase A は未実装） |
| 2FA | なし |
| パスワード強制変更 | なし（初期 PW のままでもログイン可） |

### 本 spec の位置づけ

本 spec の変更は既存テーブル・既存フローへの **後付け強化** として設計する。Phase A の認証フロー（社員番号 → 擬似メール変換 → `signInWithPassword`）は継続利用し、その前後に新機能を追加するアーキテクチャを採る。

既存テーブルへの破壊的変更は最小化し、新設テーブル（`root_auth_settings` / `root_user_2fa` / `root_login_attempts`）に機能を分離する。

---

## 3. 認証強化方針

### 3.1 パスワード再発行ポリシー

#### 初期 PW（MMDD）からの強制ローテーション

初回ログイン後に `root_employees.password_changed_at` が NULL のユーザーは、パスワード変更画面にリダイレクトする。リダイレクト先を経由せずに他ページへアクセスした場合も middleware でインターセプトし、強制変更画面に戻す。

猶予期間はロールに応じて異なる:

| ロール | 猶予期間 | 強制変更後の最長有効期限 |
|---|---|---|
| admin / super_admin | **即時**（初回ログイン時に変更必須） | 90 日 |
| manager | 7 日間 | 180 日 |
| staff / cs / closer / toss / outsource | 30 日間 | 365 日 |

#### パスワード強度要件

ロールに応じて強度要件を分ける。Supabase Auth のパスワード最低長設定は Dashboard で管理するが、クライアント側バリデーションも併用して UX を確保する。

| ロール | 最低文字数 | 複雑度 | 備考 |
|---|---|---|---|
| admin / super_admin | 12 文字 | 英大文字・英小文字・数字・記号 各 1 文字以上 | NIST SP 800-63B Level 2 相当 |
| manager | 10 文字 | 英字・数字 各 1 文字以上 | |
| staff 以下 | 8 文字 | 英字・数字 各 1 文字以上（記号不要） | 現場負荷考慮 |

**過去パスワード再利用禁止**: 直近 5 件のハッシュと照合し、一致した場合はエラー。
ハッシュの保管は `root_password_history` テーブル（bcrypt ハッシュのみ保管、平文・可逆暗号化は禁止）。

#### 再発行フロー

1. **self-service（PW 忘れ）**: 社員番号入力 → admin が Chatwork で一時 PW を送付 → 次回ログイン時に強制変更。Supabase Auth の `resetPasswordForEmail` は擬似メールドメインのため使用不可（判断保留 §11）。
2. **admin による reset**: 管理画面から一時 PW（8 文字英数字）を発行 → `force_password_reset = true` → Chatwork で対象者に通知。
3. **緊急時（乗っ取り疑い）**: super_admin が `is_active = false` でセッション即時無効化 → 調査後に PW リセット + `is_active = true` で復帰。

#### パスワード変更履歴の監査記録

`root_audit_log` に `action = "password_changed"` を記録（actor_user_id / 変更ロール / admin reset の場合は admin の user_id も記録）。**ハッシュ値・平文は監査ログに記録しない**（`root_password_history` に役割分担）。

---

### 3.2 2FA 検討

#### Supabase Auth の TOTP 対応

Supabase Auth は `supabase.auth.mfa.*` API で TOTP（Time-based One-Time Password）をサポートしている。Google Authenticator / Authy 等の TOTP アプリが利用可能。Supabase MFA の仕組み上、既存の `signInWithPassword` にアドオンする形で導入でき、既存フローへの影響を最小化できる。

Supabase Auth の MFA Flow:
1. `signInWithPassword` → `data.session` の `aal` (Assurance Level) が `aal1`
2. `mfa.enroll()` でデバイス登録（QR コード表示）
3. 以降のログイン時: `signInWithPassword` 後 `mfa.challenge()` → `mfa.verify()` → `aal` が `aal2` に昇格
4. RLS ポリシーで `auth.jwt() ->> 'aal' = 'aal2'` を条件にすることで、2FA 未完了者のアクセスをブロック可能

#### 必須化対象ロール

| ロール | 2FA | 理由 |
|---|---|---|
| super_admin | **必須**（Phase B 内で即時） | 全権限保有。最高リスク |
| admin | **必須**（Phase B 内で即時） | 従業員マスタ・給与情報へのフルアクセス |
| manager（給与改定権限あり） | **必須**（Phase B 内） | 給与関連操作の承認権限 |
| manager（給与改定権限なし） | 任意（推奨） | 現場負荷と権限範囲のバランス |
| staff / cs / closer / toss / outsource | 任意 | 共用 PC 運用との両立（§11 判断保留参照） |

#### リカバリーコード運用

2FA 設定時に 8 桁 × 10 件のリカバリーコードを発行する。コードは Supabase MFA の `factors` 管理に乗せず、`root_user_2fa.recovery_codes_hash` に bcrypt ハッシュで保管する（使用済みフラグ管理含む）。コードを紛失した場合は super_admin が 2FA をリセットし、再設定を要求する。

#### 既存 Tree 端末（共用 PC）での運用課題

共用 PC に TOTP アプリを入れると誰でもコードを見られる問題がある。toss / closer / cs ロールは 2FA 任意とし、個人スマートフォンを持つスタッフのみ設定可として暫定運用する（§11 判断保留 §判2）。

---

### 3.3 セッション管理

#### タイムアウト（ロール別）

現状の `SESSION_TIMEOUT_MS = 2h` をロール別に細分化。`session-timer.ts` 定数定義を拡張し、ロール取得後に適用タイムアウトを切り替える。

| ロール | タイムアウト | 根拠 |
|---|---|---|
| super_admin | **2 時間** | 最高権限のため短く |
| admin | **4 時間** | 経理・人事業務の継続性 |
| manager | **6 時間** | 日勤中の継続利用 |
| staff / cs / closer / toss / outsource | **8 時間**（現状維持） | 業務シフト対応 |

警告は残り 10 分前（現状維持）。自動ログアウトフローは既存を流用。

#### 同時セッション制限

| ロール | 同時セッション上限 |
|---|---|
| super_admin / admin | 1 セッション（排他） |
| manager | 2 セッション |
| staff 以下 | 制限なし |

実装: ログイン時に `root_active_sessions` を確認し、上限超過の場合は古いセッションを revoke するか新規をブロックするかは §11 判断保留 §判4 を参照。

#### デバイス一覧 UI

自分のアクティブセッション一覧を確認・リモートログアウトできる画面を実装する（`/root/settings/sessions`）。

表示項目: デバイス種別（UA から判定）、最終アクセス日時、IP アドレス（サーバー側記録）、「このデバイスをログアウト」ボタン。

---

### 3.4 ブルートフォース対策

#### login_failed カウントとアカウントロック

ログイン失敗時に `root_login_attempts` テーブルにレコードを追記する。同一 `emp_num`（または `email`）の連続失敗が **5 回**に達した場合、`root_employees.locked_until` に `NOW() + 15 minutes` を設定してアカウントをロックする。

| 設定値 | デフォルト | `root_auth_settings` で変更可能か |
|---|---|---|
| 失敗許容回数 | 5 回 | ○ |
| ロック時間 | 15 分 | ○ |
| カウントリセット期間 | 30 分（30 分以内の失敗のみカウント） | ○ |

ロック中のログイン試行には `login_denied` を `root_audit_log` に記録する。

ロック解除: 時間経過による自動解除、または admin / super_admin による手動解除（管理画面から）。

#### IP 単位のレート制限

`root_login_attempts` テーブルで同一 IP アドレスからの失敗を集計し、短時間に多数の失敗がある場合にブロックする。fail2ban 的な動作をアプリケーション層で実装する（Supabase Edge Function は本プロジェクトの Phase A 方針では未使用のため、Next.js middleware でのチェックを採用）。

| 設定値 | デフォルト |
|---|---|
| IP ブロック閾値 | 20 回失敗 / 10 分 |
| IP ブロック時間 | 30 分 |
| ホワイトリスト | 事務所固定 IP（`root_auth_settings.allowed_ips`） |

#### 不審ログイン検知

通常と異なる環境からのログインを検知し、super_admin に通知する。判定基準:
- 過去 30 日間に利用実績のない IP アドレスからのログイン
- 過去のログイン時刻と大きく異なる時間帯（深夜 0〜4 時台）
- User-Agent の急変（PC → スマートフォンなど）

検知した場合: `root_audit_log.severity = 'suspicious'` で記録し、Chatwork で super_admin に通知。対象ユーザーのセッションを自動では無効化せず（誤検知対策）、super_admin が確認後に手動でアクションを取る。

---

## 4. データモデル提案

### 4.1 `root_auth_settings`（認証ポリシー DB 駆動設定）

デプロイなしで閾値変更を可能にする singleton テーブル。

```sql
CREATE TABLE root_auth_settings (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- パスワードポリシー
  pw_min_length_default   int NOT NULL DEFAULT 8,
  pw_min_length_manager   int NOT NULL DEFAULT 10,
  pw_min_length_admin     int NOT NULL DEFAULT 12,
  pw_history_count        int NOT NULL DEFAULT 5,
  pw_max_age_days_admin   int NOT NULL DEFAULT 90,
  pw_max_age_days_manager int NOT NULL DEFAULT 180,
  pw_max_age_days_staff   int NOT NULL DEFAULT 365,
  -- ブルートフォース対策
  lockout_threshold       int NOT NULL DEFAULT 5,
  lockout_duration_min    int NOT NULL DEFAULT 15,
  lockout_window_min      int NOT NULL DEFAULT 30,
  ip_block_threshold      int NOT NULL DEFAULT 20,
  ip_block_window_min     int NOT NULL DEFAULT 10,
  ip_block_duration_min   int NOT NULL DEFAULT 30,
  -- セッション管理（h = 時間）
  session_timeout_super_admin_h int NOT NULL DEFAULT 2,
  session_timeout_admin_h       int NOT NULL DEFAULT 4,
  session_timeout_manager_h     int NOT NULL DEFAULT 6,
  session_timeout_staff_h       int NOT NULL DEFAULT 8,
  max_sessions_admin      int NOT NULL DEFAULT 1,
  max_sessions_manager    int NOT NULL DEFAULT 2,
  -- 2FA・IP ホワイトリスト
  mfa_required_roles      text[] NOT NULL DEFAULT ARRAY['admin', 'super_admin'],
  allowed_ips             text[] NOT NULL DEFAULT '{}',
  updated_at              timestamptz NOT NULL DEFAULT now(),
  updated_by              uuid REFERENCES auth.users(id)
);
CREATE UNIQUE INDEX root_auth_settings_singleton ON root_auth_settings ((true));
ALTER TABLE root_auth_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY ras_select ON root_auth_settings FOR SELECT USING (is_user_active());
CREATE POLICY ras_update ON root_auth_settings FOR UPDATE
  USING (garden_role_of(auth.uid()) = 'super_admin');
```

### 4.2 `root_user_2fa`（TOTP 設定・リカバリーコード）

```sql
CREATE TABLE root_user_2fa (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  factor_id       text,                    -- Supabase Auth MFA の factor_id
  is_enabled      boolean NOT NULL DEFAULT false,
  enrolled_at     timestamptz,
  last_verified_at timestamptz,
  -- リカバリーコード: [{"hash": "...", "used": false, "used_at": null}, ...]
  recovery_codes  jsonb NOT NULL DEFAULT '[]',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX root_user_2fa_user_id_idx ON root_user_2fa (user_id);
ALTER TABLE root_user_2fa ENABLE ROW LEVEL SECURITY;
CREATE POLICY ru2fa_select ON root_user_2fa FOR SELECT USING (user_id = auth.uid());
-- INSERT / UPDATE は Server Action 経由（service_role）のみ。クライアント直接操作禁止
```

### 4.3 `root_login_attempts`（ログイン失敗履歴）

```sql
CREATE TABLE root_login_attempts (
  id              bigserial PRIMARY KEY,
  emp_num         text NOT NULL,
  synthetic_email text,
  ip_address      text,
  user_agent      text,
  success         boolean NOT NULL,
  failure_reason  text,                    -- 'wrong_password', 'locked', 'mfa_failed' 等
  created_at      timestamptz NOT NULL DEFAULT now()
);
-- 保管期間 90 日（Phase C で purge cron 実装予定）
CREATE INDEX rla_emp_num_created_idx ON root_login_attempts (emp_num, created_at DESC);
CREATE INDEX rla_ip_created_idx      ON root_login_attempts (ip_address, created_at DESC);
ALTER TABLE root_login_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY rla_select ON root_login_attempts FOR SELECT
  USING (garden_role_of(auth.uid()) IN ('admin', 'super_admin'));
-- INSERT は Server Action 経由（判断保留 §11 参照）
```

### 4.4 `root_active_sessions`（アクティブセッション追跡）

```sql
CREATE TABLE root_active_sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supabase_session_id text NOT NULL UNIQUE,  -- JWT の jti
  ip_address          text,
  user_agent          text,
  device_hint         text,                  -- 'PC', 'smartphone', 'tablet'（UA 推定）
  last_active_at      timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ras_user_id_idx ON root_active_sessions (user_id, last_active_at DESC);
ALTER TABLE root_active_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY ras_self_select ON root_active_sessions FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY ras_admin_select ON root_active_sessions FOR SELECT
  USING (garden_role_of(auth.uid()) IN ('admin', 'super_admin'));
```

### 4.5 `root_password_history`（パスワード再利用チェック）

```sql
CREATE TABLE root_password_history (
  id              bigserial PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  password_hash   text NOT NULL,           -- bcrypt ハッシュのみ（平文・可逆暗号化禁止）
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rph_user_id_created_idx ON root_password_history (user_id, created_at DESC);
ALTER TABLE root_password_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY rph_deny_all ON root_password_history FOR ALL USING (false);
-- 参照は service_role を持つ Server Action のみ許可
```

### 4.6 `root_employees` への追加カラム（既存テーブル拡張）

```sql
-- Phase B-5 migration: root_employees_auth_extension
ALTER TABLE root_employees
  ADD COLUMN IF NOT EXISTS password_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_until        timestamptz,
  ADD COLUMN IF NOT EXISTS force_password_reset boolean NOT NULL DEFAULT false;

-- password_changed_at: NULL = 初期 PW 未変更
-- locked_until: NULL = ロックなし, 過去日時 = ロック解除済み
-- force_password_reset: admin が次回ログイン時に強制変更させるフラグ
```

---

## 5. API / Server Action 契約

実装先: `src/app/root/_actions/auth-security.ts`

### 5.1 パスワード変更

```typescript
// 強度バリデーション・過去 N 件再利用チェック・root_password_history 追記・audit 記録を含む
export async function changePassword(params: {
  currentPassword?: string;  // 本人操作時は必須、admin reset 時は省略可
  newPassword: string;
  targetUserId?: string;     // admin reset 時のみ（省略時は自分自身）
}): Promise<{
  success: boolean;
  error?: 'WEAK_PASSWORD' | 'REUSE_FORBIDDEN' | 'WRONG_CURRENT' | 'PERMISSION_DENIED';
}>;
```

### 5.2 2FA 設定 / 解除

```typescript
// 設定開始: Supabase Auth mfa.enroll() のラッパ、QR コード URI を返す
export async function enroll2FA(): Promise<{
  success: boolean; qrUri?: string; secret?: string; factorId?: string; error?: string;
}>;

// 設定確認: TOTP コード検証 → リカバリーコード（この1回のみ表示）
export async function verify2FAEnrollment(params: {
  factorId: string; totpCode: string;
}): Promise<{ success: boolean; recoveryCodes?: string[]; error?: string }>;

// 解除: admin / super_admin による操作のみ
export async function disable2FA(params: {
  targetUserId: string; reason: string;
}): Promise<{ success: boolean; error?: string }>;
```

### 5.3 admin による強制 PW リセット

```typescript
// 8 文字英数字の一時 PW 発行 → force_password_reset = true → audit 記録
// Chatwork 通知は Rill 連携後に自動化（Phase C）
export async function adminResetPassword(params: {
  targetEmployeeId: string; notifyViaChatwork?: boolean;
}): Promise<{ success: boolean; temporaryPassword?: string; error?: string }>;
```

### 5.4 セッション一覧取得 / 削除

```typescript
export async function getActiveSessions(): Promise<{
  sessions: Array<{
    id: string; deviceHint: string; ipAddress: string | null;
    lastActiveAt: string; isCurrent: boolean;
  }>;
}>;

// Supabase Admin API で指定セッションを revoke
export async function revokeSession(params: {
  sessionId: string;
}): Promise<{ success: boolean; error?: string }>;
```

### 5.5 不審ログイン検知 hook

```typescript
// ログイン成功後に呼び出す。過去 30 日の履歴と IP / UA / 時刻帯を比較
// 不審と判定した場合は root_audit_log に severity = 'suspicious' で記録
export async function checkSuspiciousLogin(params: {
  userId: string; ipAddress: string; userAgent: string;
}): Promise<{ isSuspicious: boolean; reason?: string }>;
```

### 5.6 アカウントロック制御

```typescript
// ログイン失敗記録 + 閾値判定 + locked_until 更新 + IP ブロックチェック
export async function recordLoginAttempt(params: {
  empNum: string; ipAddress: string; userAgent: string;
  success: boolean; failureReason?: string;
}): Promise<{
  isLocked: boolean; lockedUntil?: string; isIpBlocked: boolean; failureCount?: number;
}>;

export async function unlockAccount(params: {
  targetEmployeeId: string;
}): Promise<{ success: boolean; error?: string }>;
```

---

## 6. 監査ログ要件

`root_audit_log` への認証イベント記録は `docs/specs/2026-04-24-root-b-02-audit-log.md`（B-2 spec）に準拠する。認証イベントは **critical severity** として扱う。

### 認証イベント一覧

| action | severity | 記録タイミング | 備考 |
|---|---|---|---|
| `login_success` | info | 認証成功後 | 現状から継続 |
| `login_failed` | warning | 認証失敗後 | 現状から継続 |
| `login_denied` | critical | ロック中のログイン試行 | 現状から継続 |
| `logout` | info | ログアウト時 | 現状から継続 |
| `password_changed` | critical | PW 変更完了後 | Phase B-5 追加 |
| `admin_password_reset` | critical | admin PW リセット後 | Phase B-5 追加 |
| `2fa_enrolled` | critical | 2FA 設定完了後 | Phase B-5 追加 |
| `2fa_disabled` | critical | 2FA 解除後 | Phase B-5 追加 |
| `2fa_failed` | warning | TOTP コード検証失敗 | Phase B-5 追加 |
| `account_locked` | critical | アカウントロック発動時 | Phase B-5 追加 |
| `account_unlocked` | warning | admin によるロック解除時 | Phase B-5 追加 |
| `suspicious_login` | critical | 不審ログイン検知時 | Phase B-5 追加 |
| `session_revoked` | warning | リモートログアウト実行時 | Phase B-5 追加 |

### IP アドレスの記録方針

現状の `_lib/audit.ts` はブラウザ側から書き込んでいるため IP アドレスが取得できない（`known-pitfalls.md` #2 参照）。Phase B-5 では認証系の audit INSERT を **Server Action 経由に変更** し、`headers().get('x-forwarded-for')` で IP アドレスを付与する。これは `docs/auth/login-implementation-guide.md` §B-1 の Phase B 対応事項でもある。

---

## 7. a-bud / a-leaf / a-tree との連携ポイント

### Bud: 振込承認時の追加認証

Bud Phase A-5 振込承認フロー（`docs/specs/2026-04-24-bud-a-05-furikomi-approval-flow.md`）では、承認者（admin / manager）が振込を承認する操作にセキュリティを強化する必要がある。

Phase B-5 の 2FA 実装後、以下の連携を追加する:

- 振込承認 UI: 承認ボタン押下時に **PIN 入力モーダル**（または TOTP 再確認）を表示
- Server Action 側: `auth.jwt() ->> 'aal'` が `aal2`（2FA 済み）であることを確認。未達の場合は `MFA_REQUIRED` エラーを返す
- 実装は Bud 側に追加（Root は 2FA 検証 API を公開する形）

### Leaf: 商材設定変更時の admin 確認

Leaf の商材設定マスタ変更操作（単価・費目等の変更）は、誤操作による影響が大きい。admin ロールのセッション確認（`aal2` チェック）を追加することを Leaf 実装時に考慮する。
- Root が提供する `verifyAdminSession(userId)` Server Action を Leaf から呼び出すパターンを推奨

### Tree: 共用 PC でのログアウト忘れ対策

Tree はコールセンターで共用 PC を使用するため、他スタッフの操作前にログアウトを忘れることが業務上のリスクとなっている。

対策:
- Tree 用のセッションタイムアウトを **staff ロールでも 2〜3 時間に短縮**（Tree 専用設定として `root_auth_settings.session_timeout_tree_h` を追加検討）
- ログイン時に「前のセッションが残っています。ログアウトしますか？」の確認を表示
- 業務終了合図（コールセンターの打刻）と連動した自動ログアウト（KoT 連携 Phase B 以降、長期課題）

---

## 8. UX 設計

### 初回ログイン時の MMDD → 強制変更フロー

Next.js middleware が `password_changed_at IS NULL` を検知 → `/root/auth/change-password?reason=initial` へ強制リダイレクト（スキップ不可）。変更画面は現在 PW 入力不要、新 PW + 確認 PW の 2 フィールド + 強度メーター。成功後 `/root` へリダイレクト。

### 2FA セットアップウィザード（3 ステップ）

admin / super_admin のログイン後、2FA 未設定の場合に表示。admin は 7 日間スキップ可（8 日目以降は強制）。

1. 「セキュリティ向上のため 2 段階認証を設定してください」 → [今すぐ設定] / [あとで]
2. QR コード表示（Google Authenticator 等）+ 手動入力コード
3. 6 桁コード入力 → 成功後リカバリーコードを表示（再表示不可）→ [コードをコピー] [設定完了]

### パスワード強度表示

| スコア | 表示文言 | バー色 |
|---|---|---|
| 1 / 4 | 弱い（簡単に推測されます） | 赤 |
| 2 / 4 | まあまあ（もう少し長くしてください） | 黄 |
| 3 / 4 | ふつう | 黄緑 |
| 4 / 4 | 強い（安全です） | 緑 |

強度判定は独自簡易チェック（文字種別 + 長さ）で実装。`zxcvbn` 導入は別途承認が必要（§11 判断保留 §判6）。

### ロック通知文言

「ログインに複数回失敗したため、アカウントを 15 分間ロックしました。時間をおいて再試行するか、管理者にお問い合わせください。」

---

## 9. 受入基準

1. `root_employees.password_changed_at IS NULL` のユーザーが `/root` 以外にアクセスしようとすると強制変更画面にリダイレクトされる
2. 初期 PW（4 桁数字のみ）は強度チェックで「弱い」と表示され、送信ボタンが無効化される
3. 過去 5 件以内のパスワードを再利用しようとするとエラーが表示される
4. admin / super_admin ロールのユーザーが 2FA を設定できる（QR コード表示 → TOTP 検証 → リカバリーコード発行）
5. admin ロールのユーザーが 2FA 未設定で 8 日以上経過すると、ログイン後に強制セットアップ画面が表示される
6. ログイン 5 回連続失敗でアカウントがロックされ、ロック中の試行に対して適切なメッセージが表示される
7. ロックは 15 分後に自動解除される（または admin が手動解除できる）
8. IP アドレス単位で 10 分間に 20 回以上の失敗があった場合、同 IP からのログインが 30 分間ブロックされる
9. 自分のアクティブセッション一覧が `/root/settings/sessions` で確認でき、任意のセッションをリモートログアウトできる
10. super_admin / admin のセッションタイムアウトがそれぞれ 2 時間 / 4 時間に短縮されている
11. admin / super_admin の同時セッションが 1 つに制限されている（2 つ目のログイン時に確認）
12. 認証イベント（PW 変更・ロック・2FA 操作）が `root_audit_log` に記録される
13. 認証 audit INSERT が Server Action 経由になり、IP アドレスが記録される
14. RLS: `root_login_attempts` は admin+ のみ参照可、`root_password_history` はクライアントから参照不可

---

## 10. 想定工数（内訳）

| # | 作業項目 | 工数 |
|---|---|---|
| W1 | migration: `root_employees` 追加カラム + 4 新規テーブル | 0.25d |
| W2 | `changePassword` Server Action（強度チェック・履歴チェック・audit 記録） | 0.25d |
| W3 | 強制 PW 変更フロー（middleware リダイレクト + `/root/auth/change-password` 画面） | 0.25d |
| W4 | 2FA enroll / verify Server Action（Supabase mfa.* ラッパ） | 0.25d |
| W5 | 2FA セットアップウィザード UI | 0.25d |
| W6 | ブルートフォース対策（`recordLoginAttempt` + `root_login_attempts` 集計ロジック） | 0.25d |
| W7 | アカウントロック・解除（Server Action + admin 管理画面ボタン） | 0.25d |
| W8 | セッション管理（ロール別タイムアウト + `root_active_sessions` + デバイス一覧 UI） | 0.25d |
| W9 | audit INSERT の Server Action 化（IP アドレス付与、B-1 課題対応） | 0.25d |
| W10 | 不審ログイン検知ロジック + audit 記録 | 0.25d |
| **合計** | | **2.5d** |

### 優先実装順

Phase B-5 内での実装優先度:

1. **優先度 A（必須・先行実装）**: W1 migration, W2 PW 変更, W3 強制変更フロー, W6 ブルートフォース対策, W7 アカウントロック
2. **優先度 B（Phase B 後半）**: W4/W5 2FA, W9 audit IP 付与
3. **優先度 C（Phase B 末尾 or Phase C 初頭）**: W8 セッション管理 UI, W10 不審ログイン検知

---

## 11. 判断保留

| # | 論点 | 現時点のスタンス |
|---|---|---|
| 判1 | **2FA 必須化のタイミング**: Phase B 内で強制化 vs Phase C 以降 | admin / super_admin は Phase B 内で必須化。staff 以下の任意化は Phase B 完了後に現場フィードバックで再検討 |
| 判2 | **共用 PC（Tree 端末）での 2FA 運用**: 共用 PC に TOTP アプリを入れると誰でもコードが見える問題 | Tree 端末を使うロール（toss / closer / cs）は当面 2FA 任意のまま。専用スマートフォン配布の検討は経営判断事項（東海林さんに要確認） |
| 判3 | **SMS 2FA の採用可否**: Supabase Auth の Phone Auth 使用、月次コスト発生 | コスト・運用（SIM 管理）の懸念あり。TOTP のみで先行、SMS は Phase C 以降で検討 |
| 判4 | **同時セッション超過時の挙動**: 新規ログインをブロック vs 旧セッションを自動 revoke | ユーザー体験と安全性のバランス。現場にとっては自動 revoke の方が使いやすいが、意図しない強制ログアウトが問題になるケースも。ヒアリング必要 |
| 判5 | **self-service パスワードリセット**: 擬似メールドメインのため Supabase の標準フローが使えず、admin 経由のフローになる | admin フローで暫定運用。Chatwork Bot による自動通知（Rill 連携）が整備されれば半自動化可能 |
| 判6 | **パスワード強度ライブラリ**: `zxcvbn`（新規 npm 追加要）vs 独自簡易チェック | 独自簡易チェックで Phase B-5 は対応。`zxcvbn` 導入は East海林さんに承認確認後 |
| 判7 | **`root_login_attempts` への anon INSERT**: ログイン前の失敗記録のため anon からの INSERT が必要だが、セキュリティ上の懸念あり | Edge Function 経由の方が安全だが、Phase A 方針でサーバーサイドは Server Action 優先。Server Action 内で IP を取得して記録するフローで当面対応 |

---

## 12. 未確認事項

| # | 未確認事項 |
|---|---|
| U1 | 現在の運用での認証関連インシデント発生状況（PW 失念・不正アクセス疑い等） |
| U2 | 法令遵守要件: 個人情報保護法・労働安全衛生法に関する認証ログの保管期間義務（現状 90 日保管を想定） |
| U3 | コールセンタースタッフのスマートフォン所有状況（2FA 任意化の実効性に影響） |
| U4 | 将来的な SAML/OIDC 対応検討有無（Google Workspace との SSO 等） |
| U5 | パスワードポリシー変更の従業員への周知方法・タイミング（Chatwork 一斉通知等） |
| U6 | セキュリティ監査の実施予定有無（外部監査が入る場合は要件が厳格化する可能性） |

— end of B-5 spec —
