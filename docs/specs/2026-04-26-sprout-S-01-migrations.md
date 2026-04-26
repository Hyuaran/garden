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
- [ ] §14 Kintone 確定残 4 件の DoD 全項目（後述）

---

## 14. Kintone 確定 残 4 件 反映（2026-04-26 a-main 006、決定 #4 / #5 / #11 / #30）

> **改訂背景**: a-main から確定ログ受領（`C:\garden\_shared\decisions\decisions-kintone-batch-20260426-a-main-006.md`）。本 §14 で S-01 関連の 4 件を反映。

### 14.1 決定 #4: 配属・異動 採用前 Sprout / 採用後 Root

#### 方針

App 45（求人 面接ヒアリングシート）サブテーブル「配属・異動」の運用を **採用前 = Sprout / 採用後 = Root** に分割。

#### sprout_applicants への列追加（採用前管理）

```sql
ALTER TABLE sprout_applicants
  ADD COLUMN preferred_company_id uuid REFERENCES fruit_companies_legal(id),
  ADD COLUMN preferred_department text,                    -- 希望部署
  ADD COLUMN preferred_position text,                      -- 希望ポジション
  ADD COLUMN preferred_start_date date,                    -- 希望勤務開始日
  ADD COLUMN preferred_work_location text,                 -- 希望勤務地
  ADD COLUMN tentative_assignment_company_id uuid REFERENCES fruit_companies_legal(id),
    -- 内定時に admin が確定する暫定配属法人
  ADD COLUMN tentative_assignment_department text,
  ADD COLUMN tentative_assignment_position text,
  ADD COLUMN tentative_assignment_decided_at timestamptz,
  ADD COLUMN tentative_assignment_decided_by uuid;

CREATE INDEX idx_sprout_applicants_preferred_company
  ON sprout_applicants (preferred_company_id);
CREATE INDEX idx_sprout_applicants_tentative_company
  ON sprout_applicants (tentative_assignment_company_id);
```

#### Root 移管インターフェース（S-07 連動）

入社初日（タブ `pre_employment` → `archived` 遷移時）に、**Sprout の暫定配属を Root の正式配属に転記**:

```sql
-- S-07 §X account-issuance の Server Action 内で実行
-- a-root 側の root_employee_assignments テーブル（仮）に INSERT
INSERT INTO root_employee_assignments (
  employee_id, company_id, department, position,
  effective_from, source_type, source_id
) SELECT
  $new_employee_id,
  tentative_assignment_company_id,
  tentative_assignment_department,
  tentative_assignment_position,
  scheduled_employment_date,                  -- 入社日 = 配属日
  'sprout',
  id::text
FROM sprout_applicants
WHERE id = $applicant_id;

-- a-root 側で「採用後の異動」は別フローで管理（Root spec 参照）
```

詳細は S-07 §X（Root 移管インターフェース）に記載。

### 14.2 決定 #5: ◇マーク = 自動計算列を GENERATED で 1 列統合

#### 方針

Kintone の ◇マーク列（regex 等で他列から自動計算される列）は、Garden では **GENERATED ALWAYS AS ... STORED** または **trigger** で 1 列統合（重複保持不要）。

#### sprout_applicants の自動計算列

```sql
ALTER TABLE sprout_applicants
  -- 氏名フルテキスト（漢字 / カナ統合検索用）
  ADD COLUMN full_name_search tsvector
    GENERATED ALWAYS AS (
      to_tsvector('simple',
        coalesce(name_kanji, '') || ' ' ||
        coalesce(name_kana, '') || ' ' ||
        coalesce(name_alias, '')
      )
    ) STORED,

  -- 年齢計算（生年月日から自動）
  ADD COLUMN age_years int
    GENERATED ALWAYS AS (
      CASE
        WHEN birthdate IS NULL THEN NULL
        ELSE EXTRACT(year FROM age(current_date, birthdate))::int
      END
    ) STORED,

  -- 応募経過日数（応募日からの経過日数、Cron 用には不向きだが画面表示用）
  ADD COLUMN days_since_application int
    GENERATED ALWAYS AS (
      (current_date - applied_at::date)::int
    ) STORED;
    -- ※ STORED かつ current_date 含むため、Postgres は許容しない
    -- → 実装では VIEW or trigger で代替（実装時要修正）

CREATE INDEX idx_sprout_applicants_full_name_search
  ON sprout_applicants USING gin (full_name_search);
```

#### 実装上の注意

- `current_date` を含む GENERATED 列は Postgres で IMMUTABLE 制約違反
- 経過日数等は **VIEW 経由で計算**:

```sql
CREATE OR REPLACE VIEW sprout_applicants_with_calc AS
SELECT
  *,
  (current_date - applied_at::date)::int AS days_since_application,
  (current_date - tab_changed_at::date)::int AS tab_stay_days
FROM sprout_applicants;
```

#### 重複保持不要の根拠

Kintone では同じ計算を **複数フィールドにコピー**して保持していたが、Garden では計算式を 1 箇所定義 → 重複コピーを排除。

### 14.3 決定 #11: enum 値の root_settings 化（4 種類）

#### 方針

Sprout 内の以下 enum 列を Root の `root_settings`（マスタ管理）に外出し:

- `gender`（性別）
- `prefecture`（都道府県）
- `education_level`（学歴）
- `work_experience_type`（職歴種別）

#### スキーマ変更

```sql
-- 既存 enum 列を text に変更（root_settings 参照、外部キーは持たない柔軟運用）
-- ※ 既存 enum を text に ALTER COLUMN は要 PostgreSQL 12+
ALTER TABLE sprout_applicants
  ALTER COLUMN gender TYPE text,
  ALTER COLUMN prefecture TYPE text;

-- 新規列も text で受ける
ALTER TABLE sprout_applicants
  ADD COLUMN education_level text,         -- 'high_school' | 'vocational' | 'junior_college' | 'university' | 'graduate' | 'doctoral'
  ADD COLUMN work_experience_type text;    -- 'full_time' | 'part_time' | 'contract' | 'freelance' | 'temp' | 'student'

-- バリデーションは root_settings から動的生成
```

#### root_settings 連携クエリ例

```sql
-- 値検証（INSERT/UPDATE トリガで実行）
CREATE OR REPLACE FUNCTION validate_sprout_applicants_root_settings()
RETURNS trigger LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  -- gender
  IF NEW.gender IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM root_settings
    WHERE category = 'gender' AND value = NEW.gender AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Invalid gender: %', NEW.gender USING ERRCODE = '22023';
  END IF;

  -- prefecture
  IF NEW.prefecture IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM root_settings
    WHERE category = 'prefecture' AND value = NEW.prefecture AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Invalid prefecture: %', NEW.prefecture USING ERRCODE = '22023';
  END IF;

  -- education_level / work_experience_type も同様

  RETURN NEW;
END $$;

CREATE TRIGGER trg_sprout_applicants_validate_settings
  BEFORE INSERT OR UPDATE OF gender, prefecture, education_level, work_experience_type
  ON sprout_applicants
  FOR EACH ROW
  EXECUTE FUNCTION validate_sprout_applicants_root_settings();
```

#### root_settings の初期投入（Root B-1 と整合）

```sql
-- root_settings に初期値投入（a-root 側で実装、Sprout は参照のみ）
INSERT INTO root_settings (category, value, label, sort_order, is_active) VALUES
  ('gender', 'male', '男性', 1, true),
  ('gender', 'female', '女性', 2, true),
  ('gender', 'other', 'その他', 3, true),
  ('gender', 'prefer_not_to_say', '回答しない', 99, true),
  ('prefecture', 'hokkaido', '北海道', 1, true),
  -- ... 47 都道府県
  ('education_level', 'high_school', '高等学校', 1, true),
  ('education_level', 'vocational', '専門学校', 2, true),
  -- ...
  ('work_experience_type', 'full_time', '正社員', 1, true);
  -- ...
```

#### 利点

- enum 値の追加・変更が **migration 不要**（admin 画面から root_settings 編集）
- 多言語化への布石（root_settings に label_en 列追加で対応可）
- 廃止値の `is_active = false` 化で歴史保全

### 14.4 決定 #30: LINK 系 Storage 保存タイミング = 応募者登録時 async copy job

#### 方針

応募者が**履歴書 / 職務経歴書 / 写真等の LINK**（バイトル → Sprout 送付時の URL）を含む場合、**応募者登録時に async copy job** で Supabase Storage にコピー。Kintone 由来の Google Drive リンクも同様。

#### スキーマ追加

```sql
ALTER TABLE sprout_applicants
  ADD COLUMN external_link_urls jsonb,     -- 取込時の元 URL（Google Drive 等）
  ADD COLUMN storage_attachments jsonb;
    -- {
    --   "resume": {"path": "sprout/applicants/abc/resume.pdf", "uploaded_at": "...", "size": 12345},
    --   "cv": {...},
    --   "photo": {...}
    -- }

-- async copy job 状態管理
ALTER TABLE sprout_applicants
  ADD COLUMN attachment_copy_status text NOT NULL DEFAULT 'pending'
    CHECK (attachment_copy_status IN ('pending', 'in_progress', 'completed', 'failed', 'partial')),
  ADD COLUMN attachment_copy_started_at timestamptz,
  ADD COLUMN attachment_copy_completed_at timestamptz,
  ADD COLUMN attachment_copy_error text;

CREATE INDEX idx_sprout_applicants_copy_pending
  ON sprout_applicants (attachment_copy_status, applied_at)
  WHERE attachment_copy_status IN ('pending', 'failed');
```

#### async copy job の発火

```typescript
// src/lib/sprout/applicant-create.ts
'use server';

export async function createApplicant(input: CreateApplicantInput) {
  const { data: applicant } = await supabaseAdmin
    .from('sprout_applicants')
    .insert({
      ...input,
      external_link_urls: input.attachment_urls,
      attachment_copy_status: 'pending',
    })
    .select()
    .single();

  // 即座には待たない、バックグラウンドジョブを enqueue
  await enqueueAttachmentCopyJob({ applicant_id: applicant.id });

  return applicant;
}
```

#### 実行 Cron（5 分粒度）

```typescript
// /api/cron/sprout-attachment-copy (5 分ごと)
const pending = await fetchPendingApplicantsForCopy();
for (const a of pending) {
  await copyAttachmentsToStorage(a);
}
```

#### Cron 内の動作

```typescript
async function copyAttachmentsToStorage(applicant: SproutApplicant) {
  await markCopying(applicant.id);
  const results: Record<string, AttachmentResult> = {};

  for (const [key, url] of Object.entries(applicant.external_link_urls || {})) {
    try {
      const file = await downloadFromUrl(url);
      const path = `sprout/applicants/${applicant.id}/${key}.${getExt(file.contentType)}`;
      await supabaseAdmin.storage.from('sprout-applicant-files').upload(path, file.body);
      results[key] = { path, uploaded_at: new Date().toISOString(), size: file.size };
    } catch (e) {
      results[key] = { error: serializeError(e) };
    }
  }

  const allOk = Object.values(results).every(r => !r.error);
  await supabaseAdmin.from('sprout_applicants').update({
    storage_attachments: results,
    attachment_copy_status: allOk ? 'completed' : 'partial',
    attachment_copy_completed_at: new Date().toISOString(),
  }).eq('id', applicant.id);
}
```

#### Storage バケット

`sprout-applicant-files`（新規）+ RLS:

- 本人 + admin は SELECT 可
- 業務担当（staff+）は本人案件に紐付くものだけ SELECT
- INSERT は service_role のみ（cron 経由）

### 14.5 §13 受入基準への追加

- [ ] 配属関連 7 列追加（preferred_* / tentative_assignment_*）
- [ ] full_name_search GIN インデックスで全文検索動作
- [ ] age_years GENERATED 列が birthdate から自動計算
- [ ] 経過日数は VIEW 経由（GENERATED 不可のため）
- [ ] gender / prefecture / education_level / work_experience_type が root_settings 参照に変更
- [ ] root_settings 検証トリガが INSERT/UPDATE で動作
- [ ] external_link_urls / storage_attachments / attachment_copy_status 列追加
- [ ] /api/cron/sprout-attachment-copy が 5 分粒度稼働
- [ ] Storage バケット `sprout-applicant-files` 作成 + RLS 整合

### 14.6 判断保留事項追加（§13.5 続き）

| # | 論点 | a-auto スタンス |
|---|---|---|
| 13 | 配属異動の履歴保持 | tentative_* は Sprout 内のみ、確定後は Root に転記 + Sprout 側はそのまま保持（参照履歴） |
| 14 | days_since_application の実装 | VIEW 採用、Cron では VIEW から SELECT |
| 15 | root_settings 不整合時の挙動 | INSERT/UPDATE REJECT（22023）、admin 通知 |
| 16 | async copy job の retry | 最大 3 回、間隔 5/30/180 分、4 回目で `failed` 確定 |
| 17 | external_link_urls 元 URL の保管 | コピー成功後も元 URL 保持（再取得 / 監査用、6 ヶ月で物理削除）|
