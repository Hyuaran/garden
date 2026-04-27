# Calendar C-01: Migrations（calendar_events / calendar_event_links / calendar_external_calendars）

- 対象: Garden カレンダー独立モジュールの DB スキーマ初版（3 テーブル + RLS + ENUM 系制約）
- 優先度: 🔴
- 見積: **1.50d**（0.25d 刻み）
- 担当セッション: a-calendar（実装）/ a-sprout / a-tree（連携確認）/ a-bloom（レビュー）
- 作成: 2026-04-26（a-auto 006 / Batch 18 Calendar C-01）
- 前提:
  - **Sprout v0.2 spec §15**（Calendar 設計、PR #76 merge 済）
  - 関連 spec: Calendar C-02（営業予定 UI）/ C-03（面接スロット同期）/ C-04（Tree シフト連携）
  - Supabase（garden-dev → garden-prod）/ Postgres 15+

---

## 1. 目的とスコープ

### 1.1 目的
- Garden カレンダーモジュール（独立 9 番目モジュール案）の DB 基盤を確立する
- 営業予定 / 面接予約 / シフト / 個人予定 を 1 本のテーブル `calendar_events` で扱い、出自（Sprout / Tree / Bud / 手動）を `calendar_event_links` で双方向リンクする
- 将来的な外部カレンダー（Google / Outlook / TimeTree アーカイブ）連携用に `calendar_external_calendars` を stub 用意

### 1.2 含めるもの
- 3 テーブルの Migration SQL（CREATE TABLE / CHECK / INDEX / FK / RLS POLICY）
- ENUM 値の確定（event_type / status / visibility / source / external_provider）
- RLS ポリシー（staff 以上のみ閲覧、admin のみ任意 user の予定を編集、private はオーナーのみ）
- 監査列（created_at / updated_at / created_by / updated_by）
- Migration 適用順序（00001_calendar_core.sql → 00002_calendar_links.sql → 00003_calendar_external.sql）

### 1.3 含めないもの
- UI 実装（C-02 で扱う）
- Sprout / Tree との同期トリガー（C-03 / C-04 で扱う）
- 通知配信ロジック（C-06 で扱う）
- Google Calendar / TimeTree の OAuth 実装（stub のみ、本実装は別 Batch）

---

## 2. 設計方針 / 前提

- **単一テーブル方式**: 営業予定 / 面接 / シフト / 個人 を 1 本の `calendar_events` に集約。`event_type` で区別し、外部 source（Sprout 面接スロット等）は `calendar_event_links` で逆引き
- **RLS 最優先**: 7 段階ロール（toss / closer / cs / staff / manager / admin / super_admin）で staff 以上のみアクセス可
- **Soft delete**: `status='cancelled'` で論理削除、レコード物理削除は禁止（履歴監査要件）
- **タイムゾーン**: `timestamptz` で全列統一、Asia/Tokyo を既定として UI 側で変換
- **マルチアテンディー**: `attendee_user_ids uuid[]` で複数参加者対応（GIN index）
- **拡張性**: `metadata jsonb` で event_type ごとの追加属性を吸収（例: 面接の応募者 id）

---

## 3. テーブル定義

### 3.1 `calendar_events`（コアイベントテーブル）

```sql
CREATE TABLE calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 種別と基本情報
  event_type text NOT NULL CHECK (
    event_type IN ('interview', 'shift', 'sales_meeting', 'personal', 'other')
  ),
  title text NOT NULL,
  description text,

  -- 時間
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  is_all_day boolean NOT NULL DEFAULT false,

  -- 担当
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  attendee_user_ids uuid[] NOT NULL DEFAULT '{}',

  -- 場所
  location text,
  location_url text,  -- Zoom / Meet 等

  -- 備考
  notes text,

  -- 状態
  status text NOT NULL DEFAULT 'confirmed' CHECK (
    status IN ('confirmed', 'tentative', 'cancelled')
  ),
  visibility text NOT NULL DEFAULT 'public' CHECK (
    visibility IN ('public', 'private', 'restricted')
  ),

  -- 拡張
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  color_hex text,  -- UI 表示色 override（NULL = event_type の既定色）

  -- 監査
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),

  CONSTRAINT calendar_events_time_order CHECK (end_at >= start_at)
);

CREATE INDEX idx_calendar_events_start ON calendar_events (start_at);
CREATE INDEX idx_calendar_events_owner ON calendar_events (owner_user_id);
CREATE INDEX idx_calendar_events_type ON calendar_events (event_type);
CREATE INDEX idx_calendar_events_attendees ON calendar_events USING gin (attendee_user_ids);
CREATE INDEX idx_calendar_events_metadata ON calendar_events USING gin (metadata);
```

### 3.2 `calendar_event_links`（外部 source との双方向リンク）

```sql
CREATE TABLE calendar_event_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (
    source IN ('sprout', 'tree', 'bud', 'manual', 'forest')
  ),
  source_table text,    -- 例: 'sprout_interview_slots'
  source_id text NOT NULL,  -- text にして UUID/連番どちらも吸収
  link_direction text NOT NULL DEFAULT 'bidirectional' CHECK (
    link_direction IN ('bidirectional', 'event_to_source', 'source_to_event')
  ),
  last_synced_at timestamptz,
  sync_status text NOT NULL DEFAULT 'ok' CHECK (
    sync_status IN ('ok', 'pending', 'failed', 'detached')
  ),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (source, source_table, source_id)
);

CREATE INDEX idx_calendar_event_links_event ON calendar_event_links (event_id);
CREATE INDEX idx_calendar_event_links_source ON calendar_event_links (source, source_id);
```

### 3.3 `calendar_external_calendars`（外部カレンダー連携 stub）

```sql
CREATE TABLE calendar_external_calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  external_provider text NOT NULL CHECK (
    external_provider IN ('google', 'outlook', 'timetree-archive', 'icloud')
  ),
  external_calendar_id text NOT NULL,
  display_name text,
  oauth_credential_encrypted bytea,  -- pgcrypto で暗号化
  scope text,  -- read-only / read-write
  enabled boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz,
  sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, external_provider, external_calendar_id)
);
```

---

## 4. RLS ポリシー

### 4.1 `calendar_events`

```sql
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- SELECT: staff 以上 + visibility 制御
CREATE POLICY calendar_events_select ON calendar_events
FOR SELECT USING (
  auth.has_role(ARRAY['staff', 'manager', 'admin', 'super_admin'])
  AND (
    visibility = 'public'
    OR owner_user_id = auth.uid()
    OR auth.uid() = ANY(attendee_user_ids)
    OR (visibility = 'restricted' AND auth.has_role(ARRAY['manager', 'admin', 'super_admin']))
  )
);

-- INSERT: staff 以上
CREATE POLICY calendar_events_insert ON calendar_events
FOR INSERT WITH CHECK (
  auth.has_role(ARRAY['staff', 'manager', 'admin', 'super_admin'])
  AND owner_user_id = auth.uid()
);

-- UPDATE: 自分の予定 or admin
CREATE POLICY calendar_events_update ON calendar_events
FOR UPDATE USING (
  owner_user_id = auth.uid()
  OR auth.has_role(ARRAY['admin', 'super_admin'])
);

-- DELETE: admin のみ（通常は status='cancelled' で論理削除）
CREATE POLICY calendar_events_delete ON calendar_events
FOR DELETE USING (
  auth.has_role(ARRAY['admin', 'super_admin'])
);
```

### 4.2 `calendar_event_links`
- SELECT: 親 event が見える人
- INSERT/UPDATE/DELETE: admin + 連携トリガー（service_role）

### 4.3 `calendar_external_calendars`
- 自分のレコードのみ全操作可、admin は全閲覧

---

## 5. トリガー / 関数

```sql
-- updated_at 自動更新
CREATE TRIGGER trg_calendar_events_updated_at
BEFORE UPDATE ON calendar_events
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_calendar_event_links_updated_at
BEFORE UPDATE ON calendar_event_links
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- created_by / updated_by 自動セット
CREATE TRIGGER trg_calendar_events_audit_user
BEFORE INSERT OR UPDATE ON calendar_events
FOR EACH ROW EXECUTE FUNCTION set_audit_user();
```

---

## 6. Migration 適用順序

1. `00001_calendar_core.sql` … `calendar_events` 本体 + ENUM CHECK + index + RLS
2. `00002_calendar_links.sql` … `calendar_event_links` + 双方向リンク制約
3. `00003_calendar_external.sql` … `calendar_external_calendars`（stub、enable=false 既定 OK）

各 SQL は `supabase/migrations/` 配下に時刻付きで配置。garden-dev 適用 → 動作確認 → 槙レビュー → garden-prod 適用。

---

## 7. 法令対応チェックリスト

- [ ] 個人情報保護法: 参加者氏名・メール等の参照を attendee_user_ids（uuid 経由）に限定し平文文字列で保持しない
- [ ] 派遣法（シフト連携時）: 派遣スタッフのシフトを source='tree' で別管理、混在禁止
- [ ] 労働基準法: シフト系 event は労働時間集計用に export 可能とする
- [ ] 監査ログ要件: created_by / updated_by 必須、物理削除禁止

---

## 8. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | ENUM / CHECK 値の最終確定（event_type / status / visibility） | a-calendar | 0.25d |
| 2 | `calendar_events` Migration SQL 作成 | a-calendar | 0.25d |
| 3 | `calendar_event_links` Migration SQL 作成 | a-calendar | 0.25d |
| 4 | `calendar_external_calendars` Migration SQL 作成 | a-calendar | 0.25d |
| 5 | RLS ポリシーレビュー（auth.has_role 想定整合） | a-root | 0.25d |
| 6 | garden-dev 適用 + smoke test（INSERT/SELECT 各 type） | a-calendar | 0.25d |

合計: 1.50d

---

## 9. 判断保留事項

| # | 論点 | a-auto スタンス |
|---|---|---|
| 1 | event_type に 'training'（研修）を初版に含めるか | v1 では含めず、'other' で吸収。需要が見えたら追加 |
| 2 | 繰り返し予定（recurring）のモデル | v1 は単発のみ。RRULE 拡張は v2（別 spec）|
| 3 | attendee_user_ids[] vs 中間テーブル `calendar_event_attendees` | v1 は配列、参加者個別ステータス（出席/欠席）が必要になったら中間テーブル化 |
| 4 | visibility='restricted' の対象範囲指定方法 | v1 は manager+ で固定。ロールベースで十分か要確認 |
| 5 | TimeTree アーカイブを external_provider に含めるか | 含める（過去データ吸収用 stub）|
| 6 | metadata jsonb の schema validation | v1 は無し、運用で破綻したら json schema 導入 |

---

## 既知のリスクと対策

- **リスク 1**: RLS で `auth.has_role` 関数が未整備の場合 → 先行で Root 側に作成依頼（Calendar C-01 着手前に確認）
- **リスク 2**: attendee_user_ids[] の検索コスト → GIN index で対策、件数 1 万を超えたら中間テーブル化検討
- **リスク 3**: 旧 TimeTree 移行データの取込 → external_provider='timetree-archive' で受けつつ source='manual' でも登録可、両刀
- **リスク 4**: タイムゾーン混在 → 全列 timestamptz、UI 側で Asia/Tokyo 固定表示

---

## 関連ドキュメント

- `docs/specs/2026-04-25-garden-sprout-onboarding-redesign.md` §15（Calendar 設計の親）
- `docs/specs/2026-04-26-calendar-C-02-business-schedule-ui.md`
- `docs/specs/2026-04-26-calendar-C-03-interview-slot-sync.md`
- `docs/specs/2026-04-26-calendar-C-04-tree-shift-integration.md`

---

## 受入基準（Definition of Done）

- [ ] 3 テーブルが garden-dev に適用済み
- [ ] event_type 5 種すべて INSERT 可能、CHECK 制約で他値が拒否される
- [ ] staff ロールで自分の event を SELECT/INSERT/UPDATE 可能
- [ ] toss / closer / cs ロールで SELECT が 0 件になる（RLS 動作確認）
- [ ] visibility='private' な他人の event が staff から見えない
- [ ] attendee_user_ids[] への uuid 追加で当該ユーザーが SELECT 可能
- [ ] `calendar_event_links` の UNIQUE (source, source_table, source_id) で重複登録が拒否される
- [ ] 物理 DELETE は admin のみ可、staff は失敗する
- [ ] updated_at が UPDATE 時に自動更新される
- [ ] レビュー（a-root + 槙）承認後 garden-prod 適用
