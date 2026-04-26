# Fruit F-01: Migration SQL 詳細（8 テーブル定義）

- 対象: Garden Fruit モジュールの基幹 8 テーブル（fruit_companies_legal を中心とした法人法的実体情報）の Supabase Migration SQL
- 優先度: 🔴
- 見積: **1.50d**
- 担当セッション: a-fruit（実装）/ a-root（連携）/ a-bloom（レビュー）
- 作成: 2026-04-26（a-auto 006 / Batch 18 Fruit F-01）
- 前提:
  - **Sprout v0.2 spec §13**（Fruit 連携、PR #76）— 法人選択・テンプレ生成での参照仕様
  - **Cross History #04** 削除パターン統一規格（論理削除 + 物理削除パターン）
  - 関連: F-02（Kintone マッピング）、F-03（取込スクリプト）、F-04（共通セレクター）、F-05（RLS）

---

## 1. 目的とスコープ

### 1.1 目的
Garden が運営する 6 法人（株式会社ヒュアラン / センターライズ 等）の法的実体情報を、Sprout / Bud / Forest / Root から共通参照可能な Supabase スキーマで管理する。Kintone App 28（法人名簿、61 フィールド）からの取込先となる初期テーブルセットを Migration として定義する。

### 1.2 含めるもの
- `fruit_companies_legal`（法人本体）テーブルの完全定義
- 7 つの関連子テーブル（_representatives / _documents / _licenses / _insurances / _contracts / _history / _banks）
- 外部キー制約・複合インデックス・チェック制約
- enum 型定義（法人格 / 許認可種別 / 保険種別 等）
- updated_at トリガ（共通関数）
- pgcrypto 暗号化対象列の指定

### 1.3 含めないもの
- 取込ロジック（→ F-03）
- RLS ポリシー本文（→ F-05、本 spec はテーブル定義のみ）
- UI コンポーネント（→ F-04）
- Kintone App 28 のフィールド対応表（→ F-02）

---

## 2. 設計方針 / 前提

- **テーブル接頭辞**: `fruit_` 統一（Soil の `soil_`、Root の `root_` と同様の命名規則）
- **主キー**: 全テーブル `id uuid default gen_random_uuid()`
- **論理削除**: `deleted_at timestamptz`（NULL = 有効）+ `deleted_by uuid`（root_employees 参照）
- **監査列**: `created_at` / `created_by` / `updated_at` / `updated_by` 全テーブル必須
- **法人番号**: 13 桁 char、UNIQUE 制約（NULL 許容、未取得法人もあるため）
- **インボイス番号**: `T` + 13 桁、CHECK 制約 + UNIQUE
- **暗号化対象**（pgcrypto pgp_sym_encrypt）: 銀行口座番号 / 一部の許認可番号（古物商等の機微情報）
- **外部キー**: ON DELETE RESTRICT（親法人の物理削除は子テーブルが空のときのみ可、Cross History #04 準拠）
- **JSONB 列**: 業種コード / 許認可付帯情報 / 公告方法詳細 等の半構造化データに使用

---

## 3. テーブル定義

### 3.1 fruit_companies_legal（法人本体）

| 列名 | 型 | 制約 | 説明 |
|---|---|---|---|
| id | uuid | PK | 主キー |
| company_code | text | UNIQUE NOT NULL | 社内識別子（HYU / CRS 等の短縮コード） |
| corporate_number | char(13) | UNIQUE | 法人番号（国税庁 13 桁） |
| invoice_number | char(14) | UNIQUE, CHECK (`^T\d{13}$`) | インボイス登録番号 |
| company_name | text | NOT NULL | 商号（漢字） |
| company_name_kana | text |  | 商号カナ |
| company_name_en | text |  | 英文商号 |
| corporate_form | corporate_form_enum | NOT NULL | 法人格（株式会社 / 合同会社 / 一般社団 等） |
| established_at | date |  | 設立日 |
| fiscal_month_end | smallint | CHECK (1-12) | 決算月 |
| capital_amount | bigint |  | 資本金（円） |
| zip_code | char(7) |  | 郵便番号（ハイフンなし） |
| prefecture | text |  | 都道府県 |
| city | text |  | 市区町村 |
| address1 | text |  | 番地 |
| address2 | text |  | ビル名・部屋番号 |
| phone | text |  | 電話 |
| fax | text |  | FAX |
| email | text |  | 代表メール |
| website_url | text |  | 公式サイト |
| industry_code | text |  | 日本標準産業分類コード |
| primary_business | text |  | 主要事業内容 |
| employee_count | int |  | 従業員数 |
| public_notice_method | text |  | 公告方法（官報 / 電子公告 等） |
| group_companies | jsonb |  | グループ会社情報（配列） |
| shareholder_structure | jsonb |  | 株主構成（配列） |
| metadata | jsonb default '{}' |  | 拡張用 |
| deleted_at | timestamptz |  | 論理削除タイムスタンプ |
| deleted_by | uuid | FK root_employees |  |
| created_at | timestamptz | default now() |  |
| created_by | uuid | FK root_employees |  |
| updated_at | timestamptz | default now() |  |
| updated_by | uuid | FK root_employees |  |

**インデックス**:
- `idx_fruit_companies_corporate_number` ON `corporate_number` WHERE deleted_at IS NULL
- `idx_fruit_companies_company_code` ON `company_code`
- `idx_fruit_companies_invoice` ON `invoice_number` WHERE deleted_at IS NULL

### 3.2 fruit_representatives（代表者・役員）

| 列名 | 型 | 制約 | 説明 |
|---|---|---|---|
| id | uuid | PK |  |
| company_id | uuid | FK fruit_companies_legal NOT NULL | 法人 |
| role_type | rep_role_enum | NOT NULL | 代表取締役 / 取締役 / 監査役 / 執行役員 |
| name | text | NOT NULL | 漢字 |
| name_kana | text |  | カナ |
| birth_date | date |  | 生年月日 |
| appointed_at | date |  | 就任日 |
| retired_at | date |  | 退任日 |
| is_current | boolean | default true |  |
| display_order | int | default 0 | 役員一覧の表示順 |
| metadata | jsonb default '{}' |  |  |
| deleted_at / deleted_by / 監査列 | (共通) |  |  |

**インデックス**: `idx_fruit_reps_company` ON `(company_id, is_current, display_order)`

### 3.3 fruit_documents（書類）

| 列名 | 型 | 制約 | 説明 |
|---|---|---|---|
| id | uuid | PK |  |
| company_id | uuid | FK NOT NULL |  |
| doc_type | doc_type_enum | NOT NULL | 登記簿謄本 / 定款 / 決算公告 / 印鑑証明 等 |
| title | text | NOT NULL | 書類タイトル |
| issued_at | date |  | 発行日 |
| valid_until | date |  | 有効期限（必要な書類のみ） |
| storage_path | text |  | Supabase Storage のパス |
| file_size | bigint |  | バイト数 |
| mime_type | text |  |  |
| confidential_level | smallint | default 1 CHECK (1-3) | 1=社内 / 2=admin / 3=super_admin |
| metadata | jsonb default '{}' |  |  |
| 監査・削除列 | (共通) |  |  |

**インデックス**: `idx_fruit_docs_company_type` ON `(company_id, doc_type)` WHERE deleted_at IS NULL

### 3.4 fruit_licenses（許認可）

| 列名 | 型 | 制約 | 説明 |
|---|---|---|---|
| id | uuid | PK |  |
| company_id | uuid | FK NOT NULL |  |
| license_type | license_type_enum | NOT NULL | 派遣業 / 古物商 / 建設業 / 宅建 等 |
| license_number_enc | bytea |  | 許認可番号（pgcrypto 暗号化） |
| license_number_hint | text |  | 末尾 4 桁プレーン（検索用） |
| issued_by | text |  | 発行機関 |
| issued_at | date |  | 取得日 |
| valid_until | date |  | 更新期限 |
| renewal_status | renewal_status_enum | default 'active' | active / pending / expired / revoked |
| reminder_offset_days | int default 60 |  | 期限前リマインド日数 |
| metadata | jsonb default '{}' | 派遣元責任者 / 営業所 等 |  |
| 監査・削除列 | (共通) |  |  |

**インデックス**:
- `idx_fruit_licenses_valid_until` ON `valid_until` WHERE deleted_at IS NULL AND renewal_status='active'
- `idx_fruit_licenses_company_type` ON `(company_id, license_type)`

### 3.5 fruit_insurances（保険）

| 列名 | 型 | 制約 | 説明 |
|---|---|---|---|
| id | uuid | PK |  |
| company_id | uuid | FK NOT NULL |  |
| insurance_type | insurance_type_enum | NOT NULL | 健康保険 / 厚生年金 / 雇用保険 / 労災 / 賠償責任 |
| office_number | text |  | 事業所番号 |
| coverage_start | date |  | 加入日 |
| coverage_end | date |  |  |
| insurer_name | text |  | 保険会社名（賠償責任等） |
| premium_amount | bigint |  | 保険料（円、年額） |
| metadata | jsonb default '{}' |  |  |
| 監査・削除列 | (共通) |  |  |

**インデックス**: `idx_fruit_ins_company_type` ON `(company_id, insurance_type)`

### 3.6 fruit_contracts（主要契約書）

| 列名 | 型 | 制約 | 説明 |
|---|---|---|---|
| id | uuid | PK |  |
| company_id | uuid | FK NOT NULL |  |
| contract_type | contract_type_enum | NOT NULL | 賃貸借 / 業務委託 / 秘密保持 / リース 等 |
| counterparty_name | text |  | 相手先名 |
| title | text | NOT NULL |  |
| signed_at | date |  | 締結日 |
| effective_from | date |  |  |
| effective_until | date |  |  |
| auto_renewal | boolean | default false |  |
| storage_path | text |  | 契約書 PDF 格納先 |
| metadata | jsonb default '{}' |  |  |
| 監査・削除列 | (共通) |  |  |

### 3.7 fruit_history（変更履歴）

| 列名 | 型 | 制約 | 説明 |
|---|---|---|---|
| id | uuid | PK |  |
| company_id | uuid | FK NOT NULL |  |
| change_type | history_change_enum | NOT NULL | 増資 / 代表者変更 / 本店移転 / 商号変更 等 |
| effective_at | date | NOT NULL | 効力発生日 |
| before_value | jsonb |  | 変更前 |
| after_value | jsonb |  | 変更後 |
| memo | text |  |  |
| 監査列 | (共通) | （論理削除は使わない、履歴は保持） |  |

**インデックス**: `idx_fruit_history_company_date` ON `(company_id, effective_at DESC)`

### 3.8 fruit_banks（取引銀行）

| 列名 | 型 | 制約 | 説明 |
|---|---|---|---|
| id | uuid | PK |  |
| company_id | uuid | FK NOT NULL |  |
| bank_role | bank_role_enum | NOT NULL | main / sub / payroll / receiving |
| bank_code | char(4) |  | 銀行コード |
| bank_name | text | NOT NULL |  |
| branch_code | char(3) |  | 支店コード |
| branch_name | text |  |  |
| account_type | account_type_enum | NOT NULL | 普通 / 当座 |
| account_number_enc | bytea | NOT NULL | 口座番号（pgcrypto 暗号化） |
| account_number_hint | char(4) | NOT NULL | 末尾 4 桁プレーン |
| account_holder_kana | text | NOT NULL |  |
| invoice_payment_default | boolean | default false | 振込元デフォルト |
| metadata | jsonb default '{}' |  |  |
| 監査・削除列 | (共通) |  |  |

**インデックス**: `idx_fruit_banks_company_role` ON `(company_id, bank_role)` WHERE deleted_at IS NULL

---

## 4. ENUM 型定義

```sql
CREATE TYPE corporate_form_enum AS ENUM (
  'kabushiki', 'godo', 'gomei', 'goshi', 'ippan_shadan', 'ippan_zaidan',
  'koueki_shadan', 'tokutei_hieiri', 'gaikoku', 'sole_proprietor'
);

CREATE TYPE rep_role_enum AS ENUM (
  'representative_director', 'director', 'auditor', 'executive_officer',
  'manager', 'representative'
);

CREATE TYPE doc_type_enum AS ENUM (
  'registry_certificate', 'articles_of_incorporation', 'fiscal_report',
  'seal_certificate', 'tax_clearance', 'corporate_no_certificate', 'other'
);

CREATE TYPE license_type_enum AS ENUM (
  'haken', 'kobutsu', 'kensetsu', 'takken', 'syokai_haken',
  'fudosan', 'kinyu', 'iryo', 'other'
);

CREATE TYPE renewal_status_enum AS ENUM (
  'active', 'pending_renewal', 'expired', 'revoked', 'suspended'
);

CREATE TYPE insurance_type_enum AS ENUM (
  'kenko', 'kosei', 'koyo', 'rosai', 'baisho', 'jisho_kasai', 'other'
);

CREATE TYPE contract_type_enum AS ENUM (
  'lease', 'consignment', 'nda', 'lease_equipment', 'employment_outsource',
  'service', 'other'
);

CREATE TYPE history_change_enum AS ENUM (
  'capital_change', 'representative_change', 'address_change',
  'name_change', 'establishment', 'merger', 'split', 'dissolution', 'other'
);

CREATE TYPE bank_role_enum AS ENUM ('main', 'sub', 'payroll', 'receiving', 'tax');
CREATE TYPE account_type_enum AS ENUM ('futsu', 'toza', 'chochiku');
```

---

## 5. 共通トリガ

```sql
-- updated_at 自動更新（既存の root_set_updated_at と同等）
CREATE OR REPLACE FUNCTION fruit_set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 各テーブルに BEFORE UPDATE トリガを適用（8 テーブル分）
```

---

## 6. 法令対応チェックリスト

- [ ] **法人税法**: 法人番号 / 決算月の必須化、監査列で履歴追跡
- [ ] **会社法**: 商号 / 代表者 / 本店所在地 / 公告方法 を fruit_companies_legal に網羅
- [ ] **インボイス制度（消費税法）**: invoice_number 14 桁制約、UNIQUE
- [ ] **派遣法**: fruit_licenses で派遣業許可番号・有効期限・派遣元責任者管理
- [ ] **個人情報保護法**: 代表者の生年月日・許認可番号は機微情報 → pgcrypto 暗号化検討
- [ ] **金融商品取引法**: 株主構成 jsonb で大株主情報を保持可能（必要時）
- [ ] **電子帳簿保存法**: fruit_documents の保管期限・タイムスタンプ運用検討（実装時別 spec）

---

## 7. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | enum 型 8 種定義 Migration | a-fruit | 0.10d |
| 2 | fruit_companies_legal テーブル作成 | a-fruit | 0.20d |
| 3 | 子テーブル 7 種作成 + FK | a-fruit | 0.40d |
| 4 | インデックス・CHECK 制約追加 | a-fruit | 0.20d |
| 5 | updated_at トリガ関数 + 適用 | a-fruit | 0.10d |
| 6 | seed 用ダミーデータ（dev のみ） | a-fruit | 0.20d |
| 7 | レビュー反映 | a-bloom | 0.30d |

---

## 8. 判断保留事項

| # | 論点 | a-auto スタンス |
|---|---|---|
| F01-1 | 銀行口座番号の暗号化を全社強制か、Storage の RLS で代替するか | 暗号化必須案を推奨（pgcrypto + hint 列）、東海林さん最終判断 |
| F01-2 | fruit_companies_legal の company_code を AUTO 生成するか手動入力か | 手動入力（HYU/CRS 等のレガシー識別子と整合） |
| F01-3 | fruit_history は論理削除を許容するか | 不可（履歴は監査証跡、deleted_at 列を持たない） |
| F01-4 | 子テーブル数は 7 個でよいか（保険を細分化する余地あり） | v0.1 は 7 個で確定、必要なら別 spec で追加 |
| F01-5 | 古物商番号の暗号化は必要か（公開情報という見方もある） | metadata 内で hint と暗号化両対応、運用で選択 |

---

## 9. 既知のリスクと対策

- **マスタ重複リスク**: Kintone 取込時に同一法人番号の重複登録 → corporate_number UNIQUE 制約 + F-03 で UPSERT
- **pgcrypto キー管理**: SUPABASE_VAULT に保存、Edge Function 経由で復号
- **enum 拡張時のロック**: ALTER TYPE ADD VALUE は本番でも非ロック、ただし削除・並び替えは制約あり → 設計時に余裕を持たせる
- **インデックス肥大**: 6 法人想定なのでデータ量小、インデックスコストは無視可能

---

## 10. 関連ドキュメント

- `docs/specs/2026-04-25-garden-sprout-onboarding-redesign.md` §13（Fruit 連携）
- `docs/cross-history/2026-04-23-cross-history-deletion-patterns.md`（#04 削除パターン）
- F-02 / F-03 / F-04 / F-05（Batch 18 同梱）

---

## 11. 受入基準（Definition of Done）

- [ ] 全 8 テーブルが Migration として定義され、garden-dev で適用済
- [ ] 全 9 enum 型が定義済
- [ ] FK / UNIQUE / CHECK 制約が spec 通り
- [ ] updated_at トリガが 8 テーブル全てで動作確認
- [ ] pgcrypto 暗号化列が 2 箇所（fruit_banks.account_number_enc / fruit_licenses.license_number_enc）で定義済
- [ ] レビュー（a-bloom）完了、レビューコメントに対応済
- [ ] dev seed データで Sprout / Bud / Forest からの参照クエリが動作確認済
- [ ] §後述 Kintone 確定反映の DoD 全項目

---

## 12. Kintone 確定反映（2026-04-26 a-main 006、決定 #1 / #3）

> **改訂背景**: a-main 006 で東海林さんから 32 件の Kintone 解析判断が即決承認（`docs/decisions-kintone-batch-20260426-a-main-006.md`）。本 §12 で Fruit 側 2 件（#1 / #3）を反映。

### 12.1 決定 #1: fruit_company_contracts 統合

#### 方針

Kintone 側に「契約書」「業務委託契約」「賃貸借契約」等の独立アプリが分散しているが、Garden Fruit では **1 テーブルに統合**（既存 `fruit_contracts` を `fruit_company_contracts` にリネーム + 拡張）。

#### テーブルリネーム + 拡張

§3.6 `fruit_contracts` を `fruit_company_contracts` にリネーム + 統合用列追加:

```sql
ALTER TABLE fruit_contracts RENAME TO fruit_company_contracts;

-- 統合に伴う列追加
ALTER TABLE fruit_company_contracts
  ADD COLUMN contract_category text NOT NULL
    CHECK (contract_category IN (
      'employment',         -- 雇用契約
      'outsourcing',        -- 業務委託
      'lease',              -- 賃貸借
      'service',            -- サービス利用契約
      'business_alliance',  -- 業務提携
      'nda',                -- 秘密保持
      'license',            -- ライセンス
      'other'
    )),
  ADD COLUMN counterparty_name text NOT NULL,
  ADD COLUMN counterparty_type text
    CHECK (counterparty_type IN ('corporate', 'individual', 'government')),
  ADD COLUMN renewal_type text
    CHECK (renewal_type IN ('auto', 'manual', 'fixed_term')),
  ADD COLUMN auto_renewal_notice_days int,
  ADD COLUMN annual_amount numeric(15,0),
  ADD COLUMN parent_contract_id uuid REFERENCES fruit_company_contracts(id),
  ADD COLUMN external_app_source text,
  ADD COLUMN external_record_id text;

CREATE INDEX idx_fruit_company_contracts_category
  ON fruit_company_contracts (company_id, contract_category, status);

CREATE INDEX idx_fruit_company_contracts_renewal
  ON fruit_company_contracts (renewal_date)
  WHERE status = 'active' AND renewal_type = 'auto';
```

#### Kintone アプリ → contract_category 対応

| Kintone アプリ | contract_category |
|---|---|
| 雇用契約書 | `employment` |
| 業務委託契約 | `outsourcing` |
| 賃貸借契約 | `lease` |
| Web サービス契約 | `service` |
| 業務提携契約 | `business_alliance` |
| NDA | `nda` |
| ライセンス契約 | `license` |

#### 移行戦略（F-03 連動）

```typescript
const sources = [
  { app: 'employment-contracts', category: 'employment' },
  { app: 'outsourcing-contracts', category: 'outsourcing' },
  // ...
];
for (const src of sources) {
  const records = await fetchKintoneApp(src.app);
  for (const r of records) {
    await supabaseAdmin.from('fruit_company_contracts').insert({
      contract_category: src.category,
      external_app_source: `kintone-app-${src.app}`,
      external_record_id: r.id,
      ...mapKintoneToFruit(r),
    });
  }
}
```

### 12.2 決定 #3: 住所重複 全保持

#### 方針

Kintone 法人名簿で**本店 / 支店 / 連絡先 / 配送 等の住所が複数存在**する場合、すべて保持。重複排除は行わない（理由: 業務上「同じ住所だが用途が違う」ケースを正確に再現するため）。

#### 採択: 案 A（jsonb 複数列）+ 必要時に 案 B 拡張

##### 案 A: フラット列で複数住所保持（Phase B 採択）

```sql
ALTER TABLE fruit_companies_legal
  ADD COLUMN headquarters_address jsonb,
  ADD COLUMN registered_address jsonb,
  ADD COLUMN billing_address jsonb,
  ADD COLUMN delivery_address jsonb,
  ADD COLUMN branch_addresses jsonb;        -- 支店住所配列

-- jsonb 構造:
-- {"postal_code": "5300047", "prefecture": "大阪府", "city": "大阪市北区",
--  "address_line": "西天満4-3-25", "building": "○○ビル3F",
--  "from_kintone_app": "...", "purpose_note": "登記簿住所"}

CREATE INDEX idx_fruit_companies_legal_headquarters_postal
  ON fruit_companies_legal ((headquarters_address->>'postal_code'));
```

##### 案 B: 別テーブルで 1:N 展開（Phase C 拡張時、後送）

```sql
CREATE TABLE fruit_company_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES fruit_companies_legal(id),
  address_type text NOT NULL
    CHECK (address_type IN ('headquarters', 'registered', 'billing', 'delivery', 'branch')),
  postal_code text,
  prefecture text,
  city text,
  address_line text,
  building text,
  is_primary boolean NOT NULL DEFAULT false,
  external_app_source text,
  external_record_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fruit_company_addresses_company
  ON fruit_company_addresses (company_id, address_type);
```

#### 重複排除しない理由

```
ヒュアラン本店 = 大阪市北区西天満4-3-25
ヒュアラン登記簿 = 大阪市北区西天満4-3-25  ← 同じ住所だが用途別で必要
ヒュアラン請求書 = 大阪市北区西天満4-3-25
```

UI 上はグルーピングで重複表示回避、DB レベルでは全保持。

### 12.3 §11 受入基準への追加

- [ ] `fruit_contracts` を `fruit_company_contracts` にリネーム済
- [ ] contract_category（8 enum 値）/ counterparty_name / renewal_type / parent_contract_id 列追加
- [ ] external_app_source / external_record_id で Kintone 由来追跡
- [ ] fruit_companies_legal に 5 種の住所列（jsonb）追加
- [ ] 住所重複排除しない移行ルールが F-02 に文書化
- [ ] dev で 6 法人 × 平均 3 種類の住所 = 18 行の住所データ正常保存

### 12.4 判断保留事項追加

| # | 論点 | a-auto スタンス |
|---|---|---|
| K-1 | 案 A vs 案 B 移行時期 | **Phase B = 案 A**、Phase C で 案 B 検討 |
| K-2 | contract_category の追加 | 必要時に enum 追加（migration 経由）|
| K-3 | parent_contract_id の運用 | 個別契約 / 覚書のみ親子化、通常 NULL |
| K-4 | 住所表示 UI グルーピング | 同一住所を一覧で 1 行 + 用途バッジ |
