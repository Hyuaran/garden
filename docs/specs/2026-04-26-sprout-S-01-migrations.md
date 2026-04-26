# Sprout S-01: Migration SQL 詳細（9 テーブル）

- 対象: Sprout モジュール基盤テーブル群の Migration SQL（CREATE TABLE / INDEX / RLS / pgcrypto 暗号化）
- 優先度: 🔴
- 見積: **1.50d**（0.25d 刻み）
- 担当セッション: a-sprout / a-root（root_change_requests 連携）
- 作成: 2026-04-26（a-auto 006 / Batch 18 Sprout S-01）
- 前提:
  - **Sprout v0.2 spec**（PR #76 merge 済、`docs/specs/2026-04-25-garden-sprout-onboarding-redesign.md` §13/14/15 参照）
  - 関連 spec: S-02（バイトル取込）、S-04（ヒアリングシート）、S-06（入社前データ）、S-07（仮アカウント発行）
  - Fruit `fruit_companies_legal` テーブル（6 法人マスタ）
  - Calendar `calendar_events` テーブル（面接スロット双方向同期）

---

## 1. 目的とスコープ

### 1.1 目的

Sprout モジュールが扱う「応募者 → 面接 → 内定 → 入社前データ → アカウント発行」の全フェーズを支えるテーブル群を、Supabase（Postgres）上に構築する。pgcrypto による機微情報暗号化、RLS による法人横断の権限制御、Calendar/Root/Fruit との外部キー連携を含む。

### 1.2 含めるもの

- 9 テーブルの DDL（CREATE TABLE / 主キー / 外部キー / CHECK 制約）
- インデックス（検索性能・参照整合性）
- RLS ポリシー（toss / closer / cs / staff / manager / admin / super_admin の 7 段階ロール）
- pgcrypto 暗号化対象列の `pgp_sym_encrypt` 設計
- updated_at トリガ（共通関数 `set_updated_at()` の流用）
- Calendar との双方向同期トリガ（sprout_interview_slots ↔ calendar_events）

### 1.3 含めないもの

- 実装コード（API・UI）
- LINE Messaging API ペイロード設計（S-05 で扱う）
- バイトル CSV 取込スクリプト本体（S-02 で扱う）
- OCR 連携テーブル（S-07 で扱う pre_employment_data 内のカラムは含む）

---

## 2. 設計方針 / 前提

- **法人横断**: 全テーブルに `legal_entity_id UUID REFERENCES fruit_companies_legal(id)` を持たせる
- **暗号化**: pgcrypto の `pgp_sym_encrypt(text, current_setting('app.enc_key'))` で対称暗号化
- **対象列**: マイナンバー / 銀行口座番号 / 緊急連絡先電話 / 個人住所
- **RLS**: `auth.uid()` から `root_employees` を引き、ロールと法人 ID で絞り込む
- **論理削除**: `deleted_at TIMESTAMPTZ` を全テーブルに付与（物理削除は禁止）
- **タイムスタンプ**: 全テーブル `created_at`, `updated_at TIMESTAMPTZ DEFAULT now()`
- **命名規則**: `sprout_` プレフィックス + スネークケース（既存 Garden 規則準拠）

---

## 3. テーブル定義

### 3.1 sprout_applicants（応募者マスタ）

```sql
CREATE TABLE sprout_applicants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_entity_id UUID NOT NULL REFERENCES fruit_companies_legal(id),
  applicant_code TEXT UNIQUE NOT NULL,           -- SP-2026-0001 形式
  source TEXT NOT NULL CHECK (source IN ('baitoru','indeed','referral','direct','other')),
  source_external_id TEXT,                        -- バイトル応募 ID
  family_name TEXT NOT NULL,
  given_name TEXT NOT NULL,
  family_name_kana TEXT,
  given_name_kana TEXT,
  birthday DATE,
  gender TEXT CHECK (gender IN ('male','female','other','no_answer')),
  phone TEXT,
  email TEXT,
  address_encrypted BYTEA,                        -- pgcrypto 暗号化
  desired_position TEXT,
  desired_start_date DATE,
  current_status TEXT NOT NULL DEFAULT 'applied'
    CHECK (current_status IN ('applied','interview_scheduled','interview_done','offer','accepted','rejected','withdrawn','hired')),
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  line_user_id UUID REFERENCES sprout_line_users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_sprout_applicants_legal ON sprout_applicants(legal_entity_id);
CREATE INDEX idx_sprout_applicants_status ON sprout_applicants(current_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_sprout_applicants_phone ON sprout_applicants(phone) WHERE deleted_at IS NULL;
CREATE INDEX idx_sprout_applicants_applied_at ON sprout_applicants(applied_at DESC);
```

### 3.2 sprout_interview_sheets（ヒアリングシート定義）

```sql
CREATE TABLE sprout_interview_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_entity_id UUID NOT NULL REFERENCES fruit_companies_legal(id),
  sheet_name TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  schema_json JSONB NOT NULL,                     -- 41 フィールド定義
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (legal_entity_id, sheet_name, version)
);
CREATE INDEX idx_sprout_sheets_active ON sprout_interview_sheets(legal_entity_id, is_active) WHERE deleted_at IS NULL;
```

### 3.3 sprout_interview_slots（面接スロット）

```sql
CREATE TABLE sprout_interview_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_entity_id UUID NOT NULL REFERENCES fruit_companies_legal(id),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  capacity INT NOT NULL DEFAULT 1 CHECK (capacity > 0),
  reserved_count INT NOT NULL DEFAULT 0 CHECK (reserved_count >= 0),
  interviewer_employee_id UUID REFERENCES root_employees(id),
  location TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','full','closed','cancelled')),
  calendar_event_id UUID REFERENCES calendar_events(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CHECK (ends_at > starts_at),
  CHECK (reserved_count <= capacity)
);
CREATE INDEX idx_sprout_slots_open ON sprout_interview_slots(legal_entity_id, starts_at) WHERE status = 'open' AND deleted_at IS NULL;
CREATE INDEX idx_sprout_slots_calendar ON sprout_interview_slots(calendar_event_id);
```

### 3.4 sprout_interview_reservations（予約）

```sql
CREATE TABLE sprout_interview_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL REFERENCES sprout_applicants(id),
  slot_id UUID NOT NULL REFERENCES sprout_interview_slots(id),
  reserved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved','confirmed','attended','cancelled','no_show')),
  cancel_reason TEXT,
  reminder_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (applicant_id, slot_id)
);
CREATE INDEX idx_sprout_reservations_slot ON sprout_interview_reservations(slot_id);
CREATE INDEX idx_sprout_reservations_status ON sprout_interview_reservations(status) WHERE deleted_at IS NULL;
```

### 3.5 sprout_interview_records（面接記録）

```sql
CREATE TABLE sprout_interview_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES sprout_interview_reservations(id),
  sheet_id UUID NOT NULL REFERENCES sprout_interview_sheets(id),
  interviewer_employee_id UUID NOT NULL REFERENCES root_employees(id),
  answers_json JSONB NOT NULL,                    -- 41 フィールド回答
  evaluation TEXT CHECK (evaluation IN ('A','B','C','D','reject')),
  evaluation_comment TEXT,
  signed_at TIMESTAMPTZ,
  signed_by UUID REFERENCES root_employees(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_sprout_records_reservation ON sprout_interview_records(reservation_id);
CREATE INDEX idx_sprout_records_evaluation ON sprout_interview_records(evaluation);
```

### 3.6 sprout_offers（内定情報）

```sql
CREATE TABLE sprout_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL UNIQUE REFERENCES sprout_applicants(id),
  legal_entity_id UUID NOT NULL REFERENCES fruit_companies_legal(id),
  offered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  start_date DATE NOT NULL,
  position TEXT NOT NULL,
  hourly_wage NUMERIC(10,2),
  monthly_salary NUMERIC(12,2),
  employment_type TEXT NOT NULL CHECK (employment_type IN ('regular','contract','part_time','dispatch')),
  trial_period_months INT,
  contract_template_id UUID,                      -- PDF テンプレ参照
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','rejected','withdrawn')),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_sprout_offers_status ON sprout_offers(status) WHERE deleted_at IS NULL;
```

### 3.7 sprout_pre_employment_data（入社前データ）

```sql
CREATE TABLE sprout_pre_employment_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL UNIQUE REFERENCES sprout_applicants(id),
  legal_entity_id UUID NOT NULL REFERENCES fruit_companies_legal(id),
  -- 暗号化対象
  my_number_encrypted BYTEA,
  bank_account_encrypted BYTEA,
  emergency_contact_phone_encrypted BYTEA,
  home_address_encrypted BYTEA,
  -- 平文
  bank_name TEXT,
  bank_branch TEXT,
  account_holder_kana TEXT,
  emergency_contact_name TEXT,
  emergency_contact_relation TEXT,
  -- 写真（iPad ガイド枠カメラ）
  id_photo_front_url TEXT,
  id_photo_back_url TEXT,
  bank_passbook_photo_url TEXT,
  my_number_card_photo_url TEXT,
  -- ステータス
  collection_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (collection_status IN ('pending','collecting','complete','transferred_to_root')),
  ocr_processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_sprout_pre_employment_status ON sprout_pre_employment_data(collection_status) WHERE deleted_at IS NULL;
```

### 3.8 sprout_line_users（LINE 友だち）

```sql
CREATE TABLE sprout_line_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id TEXT NOT NULL,                    -- LINE 内 ID（U...）
  account_type TEXT NOT NULL CHECK (account_type IN ('info','official')),
  display_name TEXT,
  applicant_id UUID REFERENCES sprout_applicants(id),
  employee_id UUID REFERENCES root_employees(id),
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  followed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unfollowed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (line_user_id, account_type)
);
CREATE INDEX idx_sprout_line_users_applicant ON sprout_line_users(applicant_id);
CREATE INDEX idx_sprout_line_users_employee ON sprout_line_users(employee_id);
```

### 3.9 sprout_line_messages（LINE メッセージ履歴）

```sql
CREATE TABLE sprout_line_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id UUID NOT NULL REFERENCES sprout_line_users(id),
  direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  message_type TEXT NOT NULL CHECK (message_type IN ('text','image','sticker','template','flex','postback')),
  content_json JSONB NOT NULL,
  scenario_id TEXT,                              -- 自動応答シナリオ識別子
  webhook_event_id TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_sprout_messages_user ON sprout_line_messages(line_user_id, sent_at DESC);
CREATE INDEX idx_sprout_messages_scenario ON sprout_line_messages(scenario_id) WHERE scenario_id IS NOT NULL;
```

---

## 4. RLS ポリシー設計

### 4.1 共通ヘルパ関数

```sql
CREATE OR REPLACE FUNCTION sprout_current_employee()
RETURNS TABLE(employee_id UUID, role TEXT, legal_entity_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id, role, legal_entity_id FROM root_employees WHERE auth_user_id = auth.uid()
$$;
```

### 4.2 applicants の RLS（例）

```sql
ALTER TABLE sprout_applicants ENABLE ROW LEVEL SECURITY;

CREATE POLICY sprout_applicants_select ON sprout_applicants FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM sprout_current_employee() e
    WHERE e.legal_entity_id = sprout_applicants.legal_entity_id
      AND e.role IN ('manager','admin','super_admin','staff','cs')
  )
);

CREATE POLICY sprout_applicants_insert ON sprout_applicants FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM sprout_current_employee() e WHERE e.role IN ('staff','manager','admin','super_admin'))
);

CREATE POLICY sprout_applicants_update ON sprout_applicants FOR UPDATE USING (
  EXISTS (SELECT 1 FROM sprout_current_employee() e
    WHERE e.legal_entity_id = sprout_applicants.legal_entity_id
      AND e.role IN ('staff','manager','admin','super_admin'))
);
```

同パターンを 9 テーブル全てに適用。応募者向け予約 UI のみ `anon` ロールから INSERT 可能（slot_id + applicant 識別情報の組み合わせのみ、Edge Function 経由）。

---

## 5. Calendar 双方向同期トリガ

```sql
CREATE OR REPLACE FUNCTION sprout_sync_slot_to_calendar() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO calendar_events(source_module, source_id, starts_at, ends_at, title, owner_employee_id, legal_entity_id)
    VALUES ('sprout', NEW.id, NEW.starts_at, NEW.ends_at, '面接スロット', NEW.interviewer_employee_id, NEW.legal_entity_id)
    RETURNING id INTO NEW.calendar_event_id;
  ELSIF (TG_OP = 'UPDATE') THEN
    UPDATE calendar_events SET starts_at = NEW.starts_at, ends_at = NEW.ends_at, updated_at = now()
    WHERE id = NEW.calendar_event_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_sprout_slot_calendar AFTER INSERT OR UPDATE ON sprout_interview_slots
FOR EACH ROW EXECUTE FUNCTION sprout_sync_slot_to_calendar();
```

逆方向（calendar_events 編集 → sprout_interview_slots 反映）は S-03 で詳述。

---

## 6. pgcrypto 設定

- 暗号鍵は Supabase Vault 経由で `app.enc_key` セッション変数に注入
- Edge Function 内で `SET LOCAL app.enc_key = vault.get_secret('sprout_enc_key')`
- 復号は `pgp_sym_decrypt(col, current_setting('app.enc_key'))::text` を View 経由のみ許可
- View `sprout_pre_employment_data_decrypted` は admin / super_admin のみ SELECT 可

---

## 7. 法令対応チェックリスト

- [ ] **個人情報保護法 第23条**: 第三者提供制限（RLS で法人横断アクセスを禁止）
- [ ] **個人情報保護法 第20条**: 安全管理措置（pgcrypto 暗号化 4 列）
- [ ] **マイナンバー法 第12条**: 安全管理措置（my_number_encrypted、復号 View はログ記録）
- [ ] **労働基準法 第109条**: 労働者名簿 3 年保存（deleted_at の論理削除）
- [ ] **派遣法**: 該当法人のみ employment_type='dispatch' を許可（CHECK 制約は緩めだが業務制御で対応）

---

## 8. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | Migration ファイル `2026XXXX_sprout_init.sql` 作成 | a-sprout | 0.25d |
| 2 | RLS ポリシー 9 テーブル分作成 | a-sprout | 0.25d |
| 3 | pgcrypto キー Vault 設定 | a-sprout / a-root | 0.25d |
| 4 | Calendar 双方向同期トリガ | a-sprout | 0.25d |
| 5 | テストデータ投入スクリプト | a-sprout | 0.25d |
| 6 | RLS 動作確認テスト（pgTAP or Vitest） | a-sprout | 0.25d |

---

## 9. 判断保留事項

| # | 論点 | a-auto スタンス |
|---|---|---|
| 1 | applicant_code の採番方式（年度リセット or 連番継続） | 年度リセット案を提案、東海林さん確認待ち |
| 2 | sprout_line_users の applicant_id / employee_id 同時保持の許容 | 入社時に両方持つ期間あり、許容案 |
| 3 | 面接記録の電子署名方式（applicant 側の同意取得） | 当面は interviewer 側のみ署名、applicant 側は MFC 署名で代替 |
| 4 | slot capacity > 1 のユースケース（グループ面接） | 当面 1 固定、将来拡張余地として残す |
| 5 | pre_employment_data の論理削除時の暗号化キー破棄 | 採用見送り時は BYTEA を NULL 上書き案 |
| 6 | sprout_offers の hourly_wage と monthly_salary の排他制約 | CHECK で OR にすべきか、両方許容か未決 |

---

## 10. 既知のリスクと対策

- **リスク**: pgcrypto 鍵漏洩
  - **対策**: Vault 経由のみ取得、Edge Function 内で SET LOCAL、ログ抑制
- **リスク**: Calendar 同期トリガの競合
  - **対策**: source_module + source_id のユニーク制約、リトライ可能設計
- **リスク**: RLS バイパス（service_role 利用ミス）
  - **対策**: Edge Function 経由のみ書き込み、直接 service_role 利用禁止

---

## 11. 関連ドキュメント

- `docs/specs/2026-04-25-garden-sprout-onboarding-redesign.md`（v0.2 spec）
- `docs/specs/2026-04-26-sprout-S-02-baitoru-import.md`
- `docs/specs/2026-04-26-sprout-S-04-interview-sheets.md`
- `docs/specs/2026-04-26-sprout-S-06-pre-employment-ui.md`
- `docs/specs/2026-04-26-sprout-S-07-account-issuance-flow.md`

---

## 12. 受入基準（Definition of Done）

- [ ] 9 テーブルの Migration が garden-dev に適用されエラーなし
- [ ] 9 テーブル全てに RLS が有効化され、roles 別の SELECT/INSERT/UPDATE が想定通り動作
- [ ] pgcrypto で暗号化された 4 列が、復号 View 経由でのみ admin に見える
- [ ] sprout_interview_slots の INSERT が calendar_events に同期される
- [ ] テストデータ 10 件投入後、Edge Function から CRUD が動作
- [ ] 法令対応チェックリストの 5 項目すべてレビュー済
- [ ] §13 Kintone 確定反映の DoD 全項目（後述）

---

## 13. Kintone 確定反映（2026-04-26 a-main 006、決定 #8 / #9 / #14 / #15）

> **改訂背景**: a-main 006 で東海林さんから 32 件の Kintone 解析判断が即決承認（参照: `docs/decisions-kintone-batch-20260426-a-main-006.md`）。本 §13 で Sprout 側 4 件（#8 / #9 / #14 / #15）を反映。S-03 / S-04 / S-07 にも分散反映。

### 13.1 決定 #8: sprout_applicants 単一テーブル + 6 タブ UI

#### 方針

応募者管理を**1 テーブル + 6 タブ UI** に統一。タブ別テーブルへの分割は行わない（採用フローで応募者と面接者・内定者を行ったり来たりするため、JOIN 多発を回避）。

#### sprout_applicants テーブル拡張

§3 既出のスキーマに以下を追加:

```sql
ALTER TABLE sprout_applicants
  ADD COLUMN current_tab text NOT NULL DEFAULT 'inbox'
    CHECK (current_tab IN (
      'inbox',          -- 1: 受信箱（バイトル取込直後 / 自社問合せ）
      'screening',      -- 2: 一次審査（書類確認）
      'interview',      -- 3: 面接（予約済 + 完了済）
      'offer',          -- 4: 内定
      'pre_employment', -- 5: 入社前データ収集
      'archived'        -- 6: アーカイブ（不採用 / 辞退 / 入社済）
    )),
  ADD COLUMN tab_changed_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN tab_changed_by uuid;

-- インデックス: タブ別フィルタ高速化
CREATE INDEX idx_sprout_applicants_current_tab
  ON sprout_applicants (current_tab, tab_changed_at DESC)
  WHERE deleted_at IS NULL;
```

#### タブ間遷移ルール

```
inbox → screening: 担当者が手動で「審査開始」ボタン
screening → interview: 面接スロット予約完了で自動
interview → offer: 内定通知後の手動操作
offer → pre_employment: 内定承諾後の手動操作
pre_employment → archived: 入社初日完了で自動 + ロール変換（root_employees へ転記、S-07）

任意タブ → archived: 不採用 / 辞退 / 7 日無応答自動辞退（決定 #9）
archived → inbox: admin の操作で復活可能（再応募）
```

#### tab_change ログ

```sql
CREATE TABLE sprout_applicant_tab_changes (
  id bigserial PRIMARY KEY,
  applicant_id uuid NOT NULL REFERENCES sprout_applicants(id),
  from_tab text NOT NULL,
  to_tab text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid,            -- NULL = システム自動
  reason text                 -- 'manual' | 'auto_decline_7days' | 'interview_booked' | ...
);

CREATE INDEX idx_sprout_applicant_tab_changes_applicant
  ON sprout_applicant_tab_changes (applicant_id, changed_at DESC);
```

### 13.2 決定 #9: Sprout ステータス Leaf 関電方式 + 7 日自動辞退

#### Leaf 関電方式の踏襲

`leaf_kanden_cases.status` enum と同等のシンプル列挙を採用:

```sql
ALTER TABLE sprout_applicants
  ADD COLUMN status text NOT NULL DEFAULT 'active'
    CHECK (status IN (
      'active',           -- 通常進行中
      'declined',         -- 本人辞退
      'rejected',         -- 不採用
      'auto_declined',    -- 7 日無応答自動辞退（決定 #9）
      'employed',         -- 入社済
      'reapplied'         -- 再応募
    )),
  ADD COLUMN status_reason text,
  ADD COLUMN last_response_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN auto_decline_eligible_at timestamptz
    GENERATED ALWAYS AS (last_response_at + interval '7 days') STORED;

CREATE INDEX idx_sprout_applicants_auto_decline
  ON sprout_applicants (auto_decline_eligible_at)
  WHERE status = 'active' AND deleted_at IS NULL;
```

#### 7 日自動辞退 Cron

```typescript
// /api/cron/sprout-auto-decline-7days (毎日 06:00 JST)
const candidates = await supabaseAdmin
  .from('sprout_applicants')
  .select('id, current_tab, last_response_at')
  .eq('status', 'active')
  .lte('auto_decline_eligible_at', new Date().toISOString())
  .in('current_tab', ['inbox', 'screening', 'interview', 'offer']);
  // pre_employment 以降は除外（入社直前は別フロー）

for (const a of candidates) {
  await supabaseAdmin.from('sprout_applicants').update({
    status: 'auto_declined',
    status_reason: '7 日連続無応答',
    current_tab: 'archived',
    tab_changed_at: new Date().toISOString(),
  }).eq('id', a.id);

  await supabaseAdmin.from('sprout_applicant_tab_changes').insert({
    applicant_id: a.id,
    from_tab: a.current_tab,
    to_tab: 'archived',
    reason: 'auto_decline_7days',
  });
}
```

#### last_response_at の更新タイミング

| イベント | 更新? |
|---|---|
| 応募者からのメッセージ受信（LINE / メール）| ✅ |
| 担当者からの送信 | ❌（応答待ちは続く）|
| 面接予約完了 | ✅ |
| 面接実施 | ✅ |
| 内定通知 | ❌（応答待ちは続く）|
| 内定承諾 | ✅ |

S-05 LINE Bot の Webhook で受信時に自動更新（次回改訂で詳細化）。

### 13.3 決定 #14: 本日研修予定 = 当日 0:00 自動付与

#### 概要

入社初日（研修日）の朝 0:00 JST に**「本日研修予定」フラグ**を自動付与し、admin / 研修担当者の画面トップに警告表示。

#### スキーマ追加

```sql
ALTER TABLE sprout_applicants
  ADD COLUMN scheduled_employment_date date,  -- 入社予定日（pre_employment 着手時に admin 設定）
  ADD COLUMN today_training_flag boolean NOT NULL DEFAULT false,
  ADD COLUMN today_training_set_at timestamptz;

CREATE INDEX idx_sprout_applicants_today_training
  ON sprout_applicants (today_training_flag)
  WHERE today_training_flag = true;
```

#### 自動付与 Cron

```typescript
// /api/cron/sprout-today-training-flag (毎日 00:00 JST)
const today = new Date().toISOString().slice(0, 10);  // 'YYYY-MM-DD'

// 1. 該当者に flag 付与
await supabaseAdmin.from('sprout_applicants').update({
  today_training_flag: true,
  today_training_set_at: new Date().toISOString(),
}).eq('scheduled_employment_date', today)
  .eq('current_tab', 'pre_employment');

// 2. 前日分の flag をクリア
await supabaseAdmin.from('sprout_applicants').update({
  today_training_flag: false,
}).eq('today_training_flag', true)
  .neq('scheduled_employment_date', today);

// 3. admin / 研修担当に Chatwork 通知
const todayTrainees = await fetchTodayTrainees();
if (todayTrainees.length > 0) {
  await sendChatworkNotification('Garden-Sprout-研修', todayTrainees);
}
```

#### UI 表示

admin / 研修担当者が Sprout を開いた最初の画面に:

```
🌱 本日の研修予定 3 名

- 山田太郎（10:00 開始）
- 鈴木次郎（13:00 開始）
- 佐藤花子（15:00 開始）

[全員のチェックリストを開く →]
```

### 13.4 決定 #15: 管理者絞込ビュー

#### 概要

応募者一覧画面（6 タブ + 全件）で、**管理者専用の絞込条件**を提供。管理者は自分の担当外も含めた全体俯瞰が必要。

#### View 定義

```sql
CREATE OR REPLACE VIEW sprout_applicants_admin_view AS
SELECT
  a.*,
  -- 進捗ハイライト
  CASE
    WHEN a.today_training_flag THEN '本日研修'
    WHEN a.auto_decline_eligible_at < now() + interval '1 day' THEN '自動辞退間近'
    WHEN a.auto_decline_eligible_at < now() + interval '3 days' THEN '応答督促'
    ELSE '通常'
  END AS highlight,

  -- 担当者名（root_employees JOIN）
  e.name_kanji AS assignee_name,

  -- タブ滞留時間（タブ移動から経過した日数）
  EXTRACT(epoch FROM (now() - a.tab_changed_at)) / 86400 AS tab_stay_days
FROM sprout_applicants a
LEFT JOIN root_employees e ON a.assigned_to = e.id;

-- admin のみ参照可
GRANT SELECT ON sprout_applicants_admin_view TO authenticated;

CREATE POLICY admin_view_select_admin
  ON sprout_applicants_admin_view FOR SELECT
  USING (current_garden_role() IN ('admin', 'super_admin'));
```

#### 絞込フィルタ（admin UI）

```
[管理者ビュー] /sprout/admin/applicants

絞込:
- ☑ 本日研修フラグあり
- ☑ 自動辞退間近（24h 以内）
- ☐ タブ滞留 14 日超
- ☐ 担当者: [すべて ▼]
- ☐ 法人: [全 6 法人 ▼]
- ☐ 入社予定月: [2026-05 ▼]
- ☐ ステータス: [active / declined / rejected / auto_declined / employed]

[CSV エクスポート]  [Chatwork へサマリ送信]
```

#### CSV エクスポートと監査

```typescript
// 個人情報を含む CSV エクスポートは必ず audit
async function exportAdminCsv(filters: AdminFilters) {
  const data = await fetchAdminView(filters);
  await recordOperationLog({
    action: 'sprout_admin_csv_export',
    target_type: 'sprout_applicants_admin_view',
    details: { filters, row_count: data.length },
  });
  return data;
}
```

### 13.5 §9 判断保留事項への追加

| # | 論点 | a-auto スタンス |
|---|---|---|
| 8 | 6 タブの並び順 | 既定: inbox → screening → interview → offer → pre_employment → archived。admin 編集可 |
| 9 | 自動辞退後の応募者復活 | admin 操作で復活、`status='reapplied'` に変更 + 新タブ inbox に戻る |
| 10 | 本日研修フラグの粒度 | 日単位、午前 / 午後の区別は scheduled_training_time 別カラムで対応 |
| 11 | admin View の物理化 | 現状 VIEW、性能要件次第で MV 化検討 |
| 12 | last_response_at 更新範囲 | LINE 受信 / メール返信 / 面接実施完了 のみ更新 |

### 13.6 §12 受入基準への追加

- [ ] sprout_applicants に current_tab / status / last_response_at / auto_decline_eligible_at / today_training_flag 列追加
- [ ] sprout_applicant_tab_changes テーブル動作
- [ ] /api/cron/sprout-auto-decline-7days 動作（dev で 7 日経過レコード検出）
- [ ] /api/cron/sprout-today-training-flag 動作（00:00 JST 自動付与）
- [ ] sprout_applicants_admin_view が admin で参照可、staff 以下で 0 件
- [ ] CSV エクスポート時の監査ログ記録
