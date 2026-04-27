# Root B-6: 通知基盤（Notification Platform）仕様書

- 対象: Garden-Root モジュール横断通知設定の集約管理・Chatwork/Email 統合送信ヘルパー
- 見積: **2.5d**（Phase B-6.1〜B-6.3 合計）
- 担当セッション: a-root
- 作成: 2026-04-25（a-root / Phase B-6 spec）
- 前提 spec: `docs/specs/cross-cutting/spec-cross-chatwork.md`, Root Phase A-3c（Vercel Cron）

---

## 1. 目的とスコープ

### 目的

Bud・Forest・Root が個別に Chatwork 通知を送る要件がすでに散在している（Bud-A08 §7、spec-cross-chatwork §1.1）。  
これらを **Root が横断的に管理する通知基盤** として整備し、  
(1) 重複実装を防ぐ、(2) 誰がどの通知を受け取るかを DB で管理する、(3) Email 統合への拡張口を確保する。

### 含める

- `root_notification_channels` — チャネルマスタ（ルーム/アドレス定義）
- `root_notification_subscriptions` — 受信者購読設定（個人 or ロール単位）
- `root_notification_log` — 送信履歴・失敗追跡（dead letter queue 兼用）
- `notify()` 統合送信ヘルパー（`src/lib/notify/`）
- 個別低レベルヘルパー `sendChatwork()` / `sendEmail()`
- admin UI: チャネル管理、ロール購読設定
- 個人設定 UI: 本人の購読 ON/OFF

### 含めない

- Chatwork クライアントの再実装（`src/lib/chatwork/` を利用、移管案は §2 参照）
- Email 送信プロバイダの本番契約・DNS 設定（Phase B-6.3 で扱う）
- Webhook 送受信（Phase B-6.4 以降）
- Chatwork 双方向連携（Phase D 以降、spec-cross-chatwork §8 参照）

### 既存 cross-chatwork spec との関係

`docs/specs/cross-cutting/spec-cross-chatwork.md` は Chatwork クライアントの**使用方針・テンプレート設計ガイドライン・レート制限対策**を定義するガイドである。  
本 spec はその方針に従いつつ、**購読管理・マルチチャネル（Email 含む）・DB 駆動化**という Root 固有の責務を追加する。  
両 spec は補完関係にあり、重複仕様が生じた場合は cross-chatwork spec を正本とする。

---

## 2. 既存実装との関係

### 2.1 Bloom の Chatwork 基盤（現状の正本）

```
src/lib/chatwork/
  ├── client.ts      — ChatworkClient（dry-run 対応）
  ├── secrets.ts     — トークン読み出し（env → DB）
  ├── types.ts
  ├── templates/     — Bloom 向けテンプレ（daily / weekly / monthly / alert）
  ├── webhook.ts
  └── index.ts
```

`ChatworkClient` は汎用設計（`index.ts` コメント「Bloom 専用ではなく他モジュールから再利用可能に」）。  
`secrets.ts` は現状 `CHATWORK_BLOOM_ROOM_ID` など **Bloom 固定の env 変数名**を持つ。

**移管の検討（判断保留 #1 参照）**  
長期的には `secrets.ts` を Root 管理の `root_notification_channels` に置き換えることで、  
ルーム構成を DB で一元管理できる。ただし Bloom 既存 Cron との互換維持が必要なため、  
Phase B-6.2 以降で段階的に移行する方針とし、Phase B-6.1 では **env 変数をそのまま維持しつつ** 新チャネルマスタを追加する。

### 2.2 Bud の通知必要箇所

| Spec | 通知シーン | 現状 |
|---|---|---|
| Bud A-05 | 振込承認・差戻し | Chatwork、spec-cross §6.4 に文面例あり |
| Bud A-08 | CC 明細取込完了・インボイス未収集リマインダ | Chatwork、Bud-A08 §7 参照 |
| Bud B-03 | 給与明細発行（本人 DM） | Chatwork DM、DM ルーム ID 未登録時は発行不可 |
| Bud B-04 | 給与支給開始 | Chatwork（経理ルーム）|

### 2.3 Forest の業務リマインダ

| シーン | 通知先 | タイミング |
|---|---|---|
| 決算書アップロード完了 | Forest 経営者ルーム or admin DM | ファイル保存直後 |
| 納税カレンダー期限リマインダ | admin DM または経理ルーム | 期限 X 日前（Cron）|
| 進行期更新完了 | admin DM | 更新直後 |

### 2.4 Root 自身の通知要件

| シーン | 通知先 | タイミング |
|---|---|---|
| KoT 同期完了・失敗 | 管理者ルーム | Cron 実行後（A-3c 参照）|
| マスタ変更 critical（社員削除・権限変更） | audit critical ルーム | 操作直後 |

---

## 3. アーキテクチャ概要

```mermaid
flowchart TB
    subgraph モジュール呼び出し層
        A[Bud / Forest / Root<br/>Server Action / Cron]
    end

    subgraph 統合送信層 src/lib/notify/
        B["notify(&#123;<br/>  module, event_type,<br/>  payload<br/>&#125;)"]
        C[受信者解決<br/>root_notification_subscriptions]
        D[チャネルルーター<br/>channel_type 別に振り分け]
    end

    subgraph チャネル実装層
        E[sendChatwork()<br/>src/lib/chatwork/client.ts]
        F[sendEmail()<br/>src/lib/email/client.ts]
        G["sendWebhook()<br/>(Phase B-6.4)"]
    end

    subgraph データ層
        H[(root_notification_channels)]
        I[(root_notification_subscriptions)]
        J[(root_notification_log)]
    end

    A --> B
    B --> C
    C -->|購読者リスト| D
    C --- I
    D -->|chatwork| E
    D -->|email| F
    D -->|webhook| G
    E & F & G -->|送信結果| K[ログ書き込み]
    K --> J
    H -->|チャネル設定| D

    subgraph リトライ・DLQ
        L[失敗時: status=failed<br/>root_notification_log]
        M[Cron リトライジョブ<br/>最大 3 回、指数バックオフ]
    end
    J -->|status=failed| L
    L --> M
```

### ポイント

- `notify()` は **イベント名（module + event_type）から受信者を DB 解決**する。呼び出し側は受信者を意識しない。
- `sendChatwork()` / `sendEmail()` は低レベルの直接送信用（緊急通知・管理操作で購読テーブルを経由したくない場合）。
- `root_notification_log` は送信履歴と dead letter queue を兼ねる（`status` で区別）。
- リトライは Vercel Cron（既存 A-3c のパターンを踏襲）で実装し、3 回失敗で `status='dead'` に遷移する。

---

## 4. データモデル提案

### 4.1 `root_notification_channels`（チャネルマスタ）

```sql
CREATE TABLE root_notification_channels (
  channel_id      text PRIMARY KEY,
  -- 命名規則: '{type}-{purpose}' 例: 'chatwork-finance', 'email-admin', 'chatwork-dev'
  channel_type    text NOT NULL
    CHECK (channel_type IN ('chatwork', 'email', 'webhook')),
  display_name    text NOT NULL,
  -- channel_type='chatwork' → {"room_id": "12345678"}
  -- channel_type='email'    → {"address": "finance@example.com"}
  -- channel_type='webhook'  → {"url": "https://..."}
  -- API トークン等の機密は config に含めない（env or DB 暗号化カラムで別管理）
  config          jsonb NOT NULL DEFAULT '{}',
  is_active       boolean NOT NULL DEFAULT true,
  -- 誤送信防止: staging/preview 環境では is_sandbox=true のチャネルのみ使用可
  is_sandbox      boolean NOT NULL DEFAULT false,
  description     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- 初期データ（Phase B-6.1 で投入、room_id は要ヒアリング）
INSERT INTO root_notification_channels
  (channel_id, channel_type, display_name, config, is_sandbox) VALUES
  ('chatwork-dev',      'chatwork', 'Garden 開発進捗',   '{"room_id": ""}', false),
  ('chatwork-finance',  'chatwork', 'Garden 経理',       '{"room_id": ""}', false),
  ('chatwork-audit',    'chatwork', 'Garden 監査 critical', '{"room_id": ""}', false),
  ('chatwork-test',     'chatwork', 'Garden テスト送信',  '{"room_id": ""}', true);
  -- Email チャネルは Phase B-6.3 で追加
```

### 4.2 `root_notification_subscriptions`（購読設定）

```sql
CREATE TABLE root_notification_subscriptions (
  subscription_id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 受信者: 個人 OR ロールのいずれか一方（両方 NULL は許容しない）
  subscriber_user_id  uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  subscriber_role     text,
  -- ロール値: 'toss' / 'closer' / 'cs' / 'staff' / 'outsource' / 'manager' / 'admin' / 'super_admin'

  -- イベント識別
  event_module    text NOT NULL,
  -- 例: 'bud' / 'forest' / 'root' / 'leaf' / 'tree' / 'bloom'
  event_type      text NOT NULL,
  -- 例: 'transfer_approved' / 'salary_calculated' / 'kot_sync_failed' / 'tax_deadline_remind'

  channel_id      text NOT NULL REFERENCES root_notification_channels(channel_id),

  -- 個人 DM 通知時は channel_id='chatwork-dm' で登録し、送信時に root_employees.chatwork_dm_room_id を参照
  -- channel_id='chatwork-dm' は特殊値（実 room_id はチャネルテーブルに持たない）

  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- 同一ユーザー + 同一イベント + 同一チャネルの重複防止
  CONSTRAINT uq_subscription_user UNIQUE NULLS NOT DISTINCT
    (subscriber_user_id, event_module, event_type, channel_id),
  CONSTRAINT uq_subscription_role UNIQUE NULLS NOT DISTINCT
    (subscriber_role, event_module, event_type, channel_id),

  -- 個人とロールのどちらか一方のみ
  CONSTRAINT chk_subscriber_exclusive CHECK (
    (subscriber_user_id IS NOT NULL) != (subscriber_role IS NOT NULL)
  )
);

CREATE INDEX root_notif_subs_event_idx
  ON root_notification_subscriptions (event_module, event_type)
  WHERE is_active = true;
```

### 4.3 `root_notification_log`（送信履歴 / Dead Letter Queue）

```sql
CREATE TABLE root_notification_log (
  log_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 元のリクエスト
  event_module    text NOT NULL,
  event_type      text NOT NULL,
  channel_id      text NOT NULL,
  recipient_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_role  text,

  -- 送信内容スナップショット
  message_body    text NOT NULL,
  payload_snapshot  jsonb,           -- notify() に渡された payload の要約（PII に注意）

  -- 送信結果
  status          text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'dead', 'dry_run')),
  external_message_id  text,          -- Chatwork message_id / Email message-id 等
  error_message   text,

  -- リトライ管理
  attempt_count   int NOT NULL DEFAULT 0,
  next_retry_at   timestamptz,
  last_attempted_at  timestamptz,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX root_notif_log_status_retry_idx
  ON root_notification_log (status, next_retry_at)
  WHERE status IN ('pending', 'failed');

CREATE INDEX root_notif_log_event_created_idx
  ON root_notification_log (event_module, event_type, created_at DESC);
```

---

## 5. API / Server Action 契約

### 5.1 統合送信ヘルパー `notify()`

```typescript
// src/lib/notify/index.ts

export interface NotifyOptions {
  module: string;        // 'bud' | 'forest' | 'root' | 'leaf' | 'tree' | 'bloom'
  event_type: string;    // 'transfer_approved' | 'salary_calculated' | etc.
  payload: Record<string, unknown>;
  // 受信者は subscriptions テーブルから自動解決
  // 明示的に上書きしたい場合（緊急通知等）:
  override_channel_id?: string;
  override_recipient_user_id?: string;
}

export interface NotifyResult {
  dispatched: number;    // 送信キューに入れた件数
  log_ids: string[];     // root_notification_log の log_id 一覧
}

export async function notify(opts: NotifyOptions): Promise<NotifyResult>;
```

呼び出し例（Bud 振込承認後）:

```typescript
// src/app/bud/_actions/transfer.ts
await notify({
  module: 'bud',
  event_type: 'transfer_approved',
  payload: {
    transfer_id,
    amount,
    vendor_name,
    approved_by: session.user.id,
    detail_url: `${process.env.NEXT_PUBLIC_APP_URL}/bud/transfers/${transfer_id}`,
  },
});
```

### 5.2 個別チャネル送信（低レベル API）

```typescript
// src/lib/notify/channels.ts

// Chatwork 直接送信（channel_id で設定を解決）
export async function sendChatwork(opts: {
  channel_id: string;   // root_notification_channels の channel_id
  body: string;
  log_event?: { module: string; event_type: string };
}): Promise<{ message_id: string }>;

// Email 直接送信（Phase B-6.3 で実装）
export async function sendEmail(opts: {
  channel_id: string;
  subject: string;
  body: string;         // plain text or HTML
  log_event?: { module: string; event_type: string };
}): Promise<{ message_id: string }>;

// 個人 DM 送信（employee_id から chatwork_dm_room_id を解決）
export async function sendDm(opts: {
  employee_id: string;
  body: string;
  log_event?: { module: string; event_type: string };
}): Promise<{ message_id: string } | { error: 'DM_NOT_REGISTERED' }>;
```

### 5.3 購読設定 CRUD

```typescript
// src/app/root/_actions/notification-subscriptions.ts

// 購読一覧取得（admin: 全件、一般: 自分のみ）
export async function listSubscriptions(params?: {
  user_id?: string;
  event_module?: string;
}): Promise<RootNotificationSubscription[]>;

// 個人購読 ON/OFF
export async function upsertUserSubscription(params: {
  event_module: string;
  event_type: string;
  channel_id: string;
  is_active: boolean;
}): Promise<{ subscription_id: string }>;

// ロール購読設定（admin のみ）
export async function upsertRoleSubscription(params: {
  role: string;
  event_module: string;
  event_type: string;
  channel_id: string;
  is_active: boolean;
}): Promise<{ subscription_id: string }>;

// 送信履歴取得（admin のみ）
export async function listNotificationLogs(params?: {
  status?: string;
  event_module?: string;
  limit?: number;
}): Promise<RootNotificationLog[]>;
```

### 5.4 リトライ Server Action（Cron 呼び出し用）

```typescript
// src/app/api/cron/notification-retry/route.ts

// root_notification_log の status='failed' かつ next_retry_at <= now() を最大 10 件処理
// attempt_count >= 3 で status='dead' に遷移
export async function GET(request: Request): Promise<Response>;
```

---

## 6. モジュール別連携ポイント

### 6.1 Bud（経理）

| event_type | channel | 説明 |
|---|---|---|
| `transfer_approved` | chatwork-finance | 振込承認完了、次アクション促し |
| `transfer_rejected` | chatwork-finance | 差戻し、差戻し理由付き |
| `salary_calculated` | chatwork-finance | 給与計算完了、確認依頼 |
| `salary_slip_issued` | DM（本人） | 給与明細発行、URL 付き |
| `cc_import_done` | chatwork-finance | CC 明細取込完了、要手動分件数 |
| `invoice_missing_remind` | chatwork-finance | インボイス未収集（月初 Cron）|

### 6.2 Leaf（商材）

| event_type | channel | 説明 |
|---|---|---|
| `deal_status_changed` | chatwork-dev | 案件ステータス変更（担当者 DM も候補）|
| `toss_created` | chatwork-dev | トスアップ新着 |

### 6.3 Tree（架電）

| event_type | channel | 説明 |
|---|---|---|
| `kpi_milestone` | chatwork-dev | KPI 達成マイルストーン |

### 6.4 Bloom（日報・ダッシュボード）

| event_type | channel | 説明 |
|---|---|---|
| `daily_digest` | chatwork-dev | 日次活動サマリ（既存 Cron を購読 DB に移行）|
| `monthly_summary` | chatwork-finance | 月次ダイジェスト |

移行方針: 既存の `src/lib/chatwork/secrets.ts` による直接 env 参照を、段階的に  
`sendChatwork({ channel_id: 'chatwork-dev', ... })` 経由に置き換える（互換ラッパー提供）。

### 6.5 Forest（経営・税務）

| event_type | channel | 説明 |
|---|---|---|
| `tax_file_uploaded` | chatwork-finance | 決算書アップロード完了 |
| `tax_deadline_remind` | chatwork-finance | 納税期限 X 日前 Cron |
| `fiscal_year_updated` | chatwork-finance | 進行期更新完了 |

### 6.6 Rill（Chatwork メッセージアプリ）

Rill は Chatwork 自体を UI として使うモジュールのため、通知基盤の**受信者**にはなるが、  
`notify()` を通じて Chatwork ルームに送信することは Rill の本来用途と重複する。  
Rill 連携は Phase B-6.4 以降で **Webhook 転送**として扱う（今フェーズはスコープ外）。

### 6.7 Root 自身

| event_type | channel | 説明 |
|---|---|---|
| `kot_sync_completed` | chatwork-dev | KoT 同期完了サマリ（A-3c 既存を移行）|
| `kot_sync_failed` | chatwork-audit | KoT 同期失敗、要調査 |
| `master_critical_change` | chatwork-audit | 従業員削除・権限変更等 |

---

## 7. RLS ポリシー

```sql
-- root_notification_channels
ALTER TABLE root_notification_channels ENABLE ROW LEVEL SECURITY;
-- 全員が読み取り可（チャネル名を UI 表示するため）
CREATE POLICY rnc_select ON root_notification_channels
  FOR SELECT USING (auth.role() = 'authenticated');
-- admin のみ変更可
CREATE POLICY rnc_write ON root_notification_channels
  FOR ALL USING (root_has_role('admin'))
  WITH CHECK (root_has_role('admin'));

-- root_notification_subscriptions
ALTER TABLE root_notification_subscriptions ENABLE ROW LEVEL SECURITY;
-- 本人は自分の購読を読み書き可
CREATE POLICY rns_select_own ON root_notification_subscriptions
  FOR SELECT USING (
    subscriber_user_id = auth.uid()
    OR root_has_role('admin')
  );
CREATE POLICY rns_insert_own ON root_notification_subscriptions
  FOR INSERT WITH CHECK (
    subscriber_user_id = auth.uid()
    -- ロール購読は admin のみ
    OR (subscriber_role IS NOT NULL AND root_has_role('admin'))
  );
CREATE POLICY rns_update_own ON root_notification_subscriptions
  FOR UPDATE USING (
    subscriber_user_id = auth.uid()
    OR root_has_role('admin')
  );
CREATE POLICY rns_delete_own ON root_notification_subscriptions
  FOR DELETE USING (
    subscriber_user_id = auth.uid()
    OR root_has_role('admin')
  );

-- root_notification_log
ALTER TABLE root_notification_log ENABLE ROW LEVEL SECURITY;
-- admin のみ参照可（送信内容・エラー詳細が含まれるため）
CREATE POLICY rnl_admin_select ON root_notification_log
  FOR SELECT USING (root_has_role('admin'));
-- INSERT は service role のみ（Server Action / Cron 経由）
-- ※ service role は RLS をバイパスするため追加ポリシー不要
```

---

## 8. UX 設計

### 8.1 個人設定画面 `/root/settings/notifications`

- ログインユーザーが受け取れる `event_type` の一覧を表示
- チャネル別（Chatwork DM / Email）に ON/OFF トグル
- 設定変更は即時反映（楽観的更新 + Server Action）

### 8.2 admin 設定画面 `/root/admin/notification-channels`

**チャネルマスタ管理**
- チャネル一覧（channel_id / type / display_name / is_active）
- チャネル追加・編集モーダル（config の room_id は admin のみ表示）
- 疎通テストボタン（`sendChatwork` dry-run でプレビュー送信）

**ロール購読設定**
- `event_module` × `event_type` × `channel_id` のマトリクス
- ロール別に一括 ON/OFF
- 「未設定のイベント」を赤くハイライト（通知漏れ防止）

### 8.3 通知履歴画面 `/root/admin/notification-logs`

- 送信履歴テーブル（event / channel / status / created_at / error）
- status フィルタ（failed / dead のみ表示して問題検出）
- dead letter の手動リトライボタン（status を 'pending' に戻す）

---

## 9. エラーハンドリング

### 9.1 Chatwork API 失敗時

```
送信失敗 → root_notification_log (status='failed', error_message)
         → next_retry_at = now() + 2^(attempt_count) 分（指数バックオフ）
         → Cron リトライジョブが拾う（最大 3 回）
         → attempt_count >= 3 → status='dead'
         → admin に chatwork-audit から直接 sendChatwork()（ループ防止: 送信先が chatwork-audit 自身なら Email フォールバック）
```

### 9.2 Email 配信失敗（Phase B-6.3 以降）

- Bounce / Complaint は Email プロバイダの Webhook で受信
- bounce → `root_notification_log` の status を 'failed' に更新、Email チャネルの is_active を自動無効化候補としてフラグ

### 9.3 管理者通知のループ防止

```typescript
// src/lib/notify/index.ts
async function notifyAdmin(message: string) {
  // chatwork-audit への直送（subscriptions を通らない）
  // ただし送信先が chatwork-audit から発生したエラーの場合は Email にフォールバック
  if (isLoopRisk(currentContext)) {
    await sendEmail({ channel_id: 'email-admin', subject: '[ALERT]', body: message });
  } else {
    await sendChatwork({ channel_id: 'chatwork-audit', body: message });
  }
}
```

### 9.4 dead letter queue の運用

- `status='dead'` の件数を日次 Cron で集計し、1 件以上あれば admin に週次サマリで通知
- 手動リトライ: admin UI から status を 'pending' に戻し、次回 Cron で処理

---

## 10. Phase 段階分け

### Phase B-6.1（最小構成）: 0.75d

**目標**: Chatwork 送信を DB チャネルマスタ経由に統一する。購読設定はデフォルト（static）。

- [ ] `root_notification_channels` テーブル migration + 初期データ
- [ ] `root_notification_log` テーブル migration
- [ ] `sendChatwork()` 低レベルヘルパー実装（`ChatworkClient` ラッパー）
- [ ] `notify()` 基本実装（購読 DB 参照なし、channel_id を直接指定）
- [ ] Bud-A05 / Bud-A08 / Root-A3c の既存通知を本ヘルパーに移植
- [ ] リトライ Cron（`/api/cron/notification-retry`）
- [ ] dry-run モード（GARDEN_NOTIFY_DRY_RUN env 変数）

### Phase B-6.2: 購読 DB 駆動化・admin UI — 0.75d

**目標**: 誰がどの通知を受け取るかを DB で管理できるようにする。

- [ ] `root_notification_subscriptions` テーブル migration
- [ ] `notify()` を購読テーブル参照に改修
- [ ] 個人設定画面 `/root/settings/notifications`
- [ ] admin チャネル管理・ロール購読設定画面
- [ ] 通知履歴・dead letter 管理画面

### Phase B-6.3: Email 統合 — 0.75d

**目標**: Chatwork だけでなく Email でも通知できるようにする（Resend または SendGrid）。

- [ ] Email プロバイダ選定・環境変数設定（要判断保留 #2）
- [ ] `sendEmail()` 実装
- [ ] `email-admin` チャネル追加
- [ ] Bounce/Complaint Webhook エンドポイント
- [ ] 個人設定に Email ON/OFF 追加

### Phase B-6.4: Webhook 拡張（Phase C 以降）

- Slack / LINE WORKS / 外部 Webhook 対応
- Rill（Chatwork メッセージアプリ）との統合
- 送信テンプレートのユーザーカスタマイズ機能

---

## 11. 受入基準

1. ✅ `root_notification_channels` に chatwork-dev / chatwork-finance / chatwork-audit の 3 チャネルが登録済み
2. ✅ `sendChatwork({ channel_id, body })` で Chatwork 送信が動作、`root_notification_log` にレコード作成
3. ✅ Bud 振込承認時に `notify({ module: 'bud', event_type: 'transfer_approved', ... })` が動作
4. ✅ 送信失敗時に `root_notification_log.status='failed'` が記録される
5. ✅ Cron リトライが failed を拾い、3 回失敗で `status='dead'` に遷移
6. ✅ dry-run モード時は実 API を叩かず Console ログのみ出力
7. ✅ admin 画面でチャネルマスタの閲覧・編集が可能（Phase B-6.2）
8. ✅ 個人設定画面で購読 ON/OFF が可能（Phase B-6.2）
9. ✅ chatwork-audit へのループ送信が発生しないことを手動確認
10. ✅ RLS: subscriptions は本人 + admin のみ編集可、log は admin 閲覧のみ

---

## 12. 想定工数（内訳）

| # | 作業 | Phase | 工数 |
|---|---|---|---|
| W1 | テーブル migration（channels / log）| B-6.1 | 0.1d |
| W2 | `sendChatwork()` 低レベルヘルパー | B-6.1 | 0.1d |
| W3 | `notify()` 基本実装（static 購読） | B-6.1 | 0.1d |
| W4 | 既存通知の移植（Bud A-05 / A-08 / Root A-3c）| B-6.1 | 0.2d |
| W5 | リトライ Cron 実装 | B-6.1 | 0.25d |
| W6 | `root_notification_subscriptions` migration | B-6.2 | 0.05d |
| W7 | `notify()` 購読 DB 参照に改修 | B-6.2 | 0.15d |
| W8 | 個人設定画面 | B-6.2 | 0.2d |
| W9 | admin チャネル / ロール購読管理画面 | B-6.2 | 0.25d |
| W10 | 通知履歴・DLQ 管理画面 | B-6.2 | 0.1d |
| W11 | Email プロバイダ設定・`sendEmail()` | B-6.3 | 0.2d |
| W12 | Bounce Webhook エンドポイント | B-6.3 | 0.15d |
| W13 | 個人設定 Email ON/OFF | B-6.3 | 0.1d |
| W14 | 疎通テスト・dry-run 確認・段階リリース | 全体 | 0.25d |
| **合計** | | | **2.5d** |

---

## 13. 判断保留

| # | 論点 | 現時点のスタンス |
|---|---|---|
| 判1 | Bloom の `secrets.ts` を Root チャネルマスタに移管するか | **段階移行**。Phase B-6.1 では env 変数を維持しつつ新チャネルマスタを追加。Phase B-6.2 で Bloom 側を `sendChatwork(channel_id=)` 経由に切り替え。互換ラッパーを提供し既存 Cron を壊さない |
| 判2 | Email 基盤のプロバイダ選定（Resend / SendGrid / Vercel Email） | **Phase B-6.3 着手時に決定**。Resend が Next.js 親和性高いが、東海林さんの既存契約確認が必要（未確認事項 U3） |
| 判3 | Chatwork API レート制限への対応 | `p-queue` を `sendChatwork()` 内に組み込む（cross-chatwork spec §7 の設計を採用）。ブロードキャストは 30 秒分散送信 |
| 判4 | 個人購読 vs ロール購読の優先度 | **Phase B-6.2 で両方実装**。ただし個人購読がロール購読を上書き（is_active=false で個別 OFF 可能） |
| 判5 | 配信失敗時の admin 通知ループ防止 | chatwork-audit → 失敗時は `email-admin` フォールバック。Email も未設定の場合は `root_notification_log.status='dead'` 記録のみ |
| 判6 | 購読デフォルト設定の管理 | Phase B-6.1 では `notify()` が `channel_id` を直接受け取るシンプルモード。Phase B-6.2 で「新規ユーザーにはデフォルト購読を付与する」仕組みを追加検討 |

---

## 14. 未確認事項

| # | 未確認 | 影響する判断 |
|---|---|---|
| U1 | 現状の Chatwork ルーム一覧（経理 / 開発 / 全社 / 給与等）| `root_notification_channels` 初期データの room_id が空欄のまま。各ルーム ID の提供が必要 |
| U2 | KoT 同期失敗通知の現在の送信先ルーム | Root A-3c で Chatwork 通知が実装済みか確認、既存設定を移行するため |
| U3 | Email 送信の必要性と既存契約（Resend / SendGrid / その他）| Phase B-6.3 の着手可否と採用プロバイダに直結 |
| U4 | 1 日あたりの通知件数の目安（全モジュール合計）| レート制限対策の設計に影響。1 日 100 件未満なら p-queue の優先度低 |
| U5 | 給与明細の DM ルーム ID 登録状況（root_employees.chatwork_dm_room_id の整備度）| Bud B-03 の給与明細 DM 発行に直結。admin 手動登録が必要な件数の把握 |

— end of Root B-6 spec —
