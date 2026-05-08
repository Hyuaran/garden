# Garden-Bud 設計書 v2（経理・収支モジュール全体設計）

- 作成日: 2026-04-22
- バージョン: v2（v1 は `C:\Users\shoji\Desktop\garden` の `feature/bud-design` ブランチ `cb9c7c9` にあったが引越しで消失、本 v2 で再構築）
- 対象: Garden シリーズ Bud（蕾）モジュール
- 前提読者: 東海林さん（プロジェクト責任者）、槙さん（Garden 共通ルール策定）、各 Phase の実装担当（東海林 A/B セッション）

---

## 0. 変更履歴

| 日付 | バージョン | 変更 |
|---|---|---|
| 2026-04-16 | v1 | 初版（Gdrive `007_Garden Bud/Garden-Bud_設計書_20260416.md`）|
| 2026-04-17 | v1.5 | Garden 全体 7段階ロールを反映（`feature/bud-design` ブランチ cb9c7c9、**消失**）|
| 2026-04-22 | **v2** | Phase 1〜6 全範囲を詳細化、MF クラウド給与連携方針、手渡し現金案 C 採用、FM レシート Bud 化、コストダッシュボード追加 |

---

## 1. モジュール概要

### 1.1 Garden-Bud（蕾）の役割

経理「処理」を担当するモジュール。3 つの主機能：

1. **振込管理**（Phase 1）— 振込依頼の登録・承認・銀行CSV 出力・振込実行管理
2. **入出金明細管理**（Phase 2〜4）— 銀行・CC明細・現金領収書の取込＋仕訳分類＋OCR
3. **給与処理**（Phase 6）— 勤怠集計・給与計算原案・MF クラウド給与連携・明細配信

### 1.2 他モジュールとの関係

| モジュール | 役割 | Bud との関係 |
|---|---|---|
| Garden-Root（根）| マスタ（組織・従業員・取引先・分類・勘定科目）・認証・監査 | **Bud はすべてのマスタを Root から参照**（持たない）、Bud の画面からマスタ編集 |
| Garden-Forest（森）| 決算・会計（勘定科目別集計・弥生会計 CSV 出力・試算表比較）| **Bud → Forest の片方向**。Bud が正、Forest は会計視点での出力 |
| Garden-Leaf（葉）| 事業別案件アプリ（関電業務委託・コールセンター代理店・電子ブレーカー販売等）| **Leaf → Bud** でキャッシュバック振込申請、**Bud → Leaf** で進捗参照 |
| Garden-Tree（木）| 架電・給与明細閲覧 | **Bud → Tree** で給与明細配信 API |
| Garden-Bloom（花）| 社内見える化・KPI | Bud の集計結果を参照 |

### 1.3 モジュール責務境界（適度な垂直分担、案 Z）

```
 [Bud]                 [Forest]
 業務入力・分類          会計出力
 振込・明細・給与・OCR    弥生CSV・試算表比較
    ↓                      ↑
    └──────┬───────────────┘
           ↓
       [Root]
       マスタ・認証・監査
       (組織・従業員・取引先・分類・勘定科目)

共通ライブラリ:
  src/lib/zengin/   — 全銀協 CSV 生成
  src/lib/ocr/      — Claude Vision OCR プロバイダ抽象
  src/lib/pdf/      — 画像→PDF 変換
  src/lib/archive/  — Google Drive 転送
```

---

## 2. 認証・権限モデル

### 2.1 2 層権限構造

| 層 | 定義場所 | 値 | 用途 |
|---|---|---|---|
| Garden 全体ロール | `root_employees.garden_role` | 7 段階: toss / closer / cs / staff / manager / admin / super_admin | Garden 全モジュール横断の権限 |
| Bud 内役割 | `bud_users.bud_role` | 3 段階: staff / approver / admin | Bud 固有の役割 |

### 2.2 アクセス判定（2 段階）

1. **自動許可**: `garden_role ∈ {admin, super_admin}` → bud_users 登録不要
2. **明示登録**: 上記以外は `bud_users.is_active = true` 必須

### 2.3 操作×権限マトリクス（Phase 1〜6 共通）

| 操作 | 必要権限 | SQL ヘルパー |
|---|---|---|
| Bud 画面表示 | `bud_has_access()` | 既存 |
| 振込起票（下書き） | 上記 | 既存 |
| 振込確認（二重チェック） | admin 以上 | `bud_is_admin()` |
| 振込承認 | admin 以上（上田さん）| 同上 |
| 責任者確認（給与） | manager 以上（宮永・小泉さん） | **新規**`bud_is_manager_or_above()` |
| 振込 CSV 出力 | super_admin（東海林さんのみ）| `root_is_super_admin()` |
| 振込完了確定 | super_admin のみ | 同上 |
| マスタ編集（分類・勘定科目）| super_admin のみ | 同上 |
| 明細取込 | admin 以上 | `bud_is_admin()` |
| 照合操作 | admin 以上 | 同上 |
| 給与計算（原案）| admin（上田さん）| 同上 |
| MF 連携（エクスポート/インポート）| super_admin のみ | `root_is_super_admin()` |
| 手渡し現金受領確認 | super_admin のみ | 同上 |

### 2.4 Phase 0 認証フロー（既実装、維持）

```
① /bud/login でログイン（社員番号 + パスワード）
② signInBud(empId, pw) → Supabase Auth で擬似メール認証
③ fetchBudSessionUser(userId) → root_employees + bud_users JOIN
④ アクセス判定 → BudStateContext に BudSessionUser 保持
⑤ 2 時間無操作で自動ロック（経理系の機密性を考慮）
```

---

## 3. Phase マップ

### 3.1 Phase 一覧

| # | Phase | 内容 | 工数（日）|
|---|---|---|---:|
| 0 | 認証基盤 | ログイン・権限・bud_users ✅ 完了 | — |
| **1a** | **全銀協 CSV ライブラリ先行** | `src/lib/zengin/` 汎用ライブラリ | 0.5 |
| 1b | 振込管理 | 振込 CRUD・6 段階ステータス・CSV 出力 | 2.2 |
| 1c | Leaf 連携 | Leaf 各案件アプリからのキャッシュバック申請 | 1.0 |
| 2a | 銀行明細取込 | 4 銀行の CSV 取込・自動分類 | 1.35 |
| 2b | CC 明細取込 | 4 カードの CSV 取込・5000 円ルール | 0.8 |
| 2c | 共通マスタ seed | v12 Excel（441 行）→ `root_expense_categories` 投入 | 0.3 |
| 3 | 支払明細＋照合 | 入出金↔振込の自動マッチング | 2.0 |
| 4a | 自動仕訳エンジン | 3 段階判定・マスタ編集画面 | 1.0 |
| 4b | OCR + 撮影 UI + Storage | Claude Vision + スマホ連続撮影 + Google Drive | 3.3 |
| 4c | FM レシート Bud 化 | 872 件以上の全件移行・受領確認 | 2.1 |
| 5 | コストダッシュボード | 大区分×小区分×月マトリクス（xlsx 置換）| 1.5 |
| 6 | 給与処理 | 9 段階ステータス・MF 連携・手渡し現金 | 4.55 |
| **合計** | | | **20.35** |

### 3.2 依存関係・着手順序

```
Phase 0 (完了)
    ↓
Phase 1a — 1b — 1c
             ↓
Phase 2a — 2b — 2c (並行可)
             ↓
Phase 3
    ↓
Phase 4a — 4b — 4c (並行可)
             ↓
Phase 5
    ↓
Phase 6
```

- Phase 1a は最優先（他 Phase の CSV 出力が依存）
- Phase 2a/2b/2c は並行可能
- Phase 4a/4b/4c は並行可能（独立性高い）
- Phase 5 は Phase 1〜4 のデータが揃ってから
- Phase 6 は独立性高いが手渡し現金の設計決定が前提

---

## 4. データモデル

### 4.1 既存テーブル（Phase 0 で実装済）

| テーブル | 主な内容 | 修正予定 |
|---|---|---|
| `bud_users` | Bud アクセス権限 | なし |
| `bud_transfers` | 振込依頼 | Phase 1b で多数カラム追加 |
| `bud_statements` | 銀行入出金明細 | Phase 2a で分類カラム追加 |
| `bud_salary_batches` | 月次給与バッチ | Phase 6 でステータス 9 段階化 |
| `bud_salary_details` | 給与明細 | Phase 6 で外注費リクラス対応 |

### 4.2 Root 側に追加するマスタ（super_admin のみ編集、Bud UI 経由）

```sql
-- 費用分類マスタ（大区分/小区分、Bud 業務視点）
CREATE TABLE root_expense_categories (
  category_id       text PRIMARY KEY,            -- EXP-001, EXP-002, ...
  major_category    text NOT NULL,               -- "システム費", "固定費" etc.
  minor_category    text NOT NULL,               -- "サイボウズ", "マネーフォワード" etc.
  display_order     integer NOT NULL DEFAULT 999,
  default_forest_account_id text REFERENCES root_forest_accounts(account_id),
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (major_category, minor_category)
);

-- 勘定科目マスタ（Forest 会計視点、弥生会計 CoA 準拠）
CREATE TABLE root_forest_accounts (
  account_id        text PRIMARY KEY,            -- ACC-100, ACC-101, ...
  account_code      text NOT NULL UNIQUE,        -- 弥生会計の科目コード
  account_name      text NOT NULL,               -- "通信費", "支払報酬" etc.
  account_category  text,                        -- "費用", "資産", "負債" etc.
  tax_type          text,                        -- "課税仕入10%", "非課税" etc.
  display_order     integer NOT NULL DEFAULT 999,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- root_vendors にデフォルト分類追加
ALTER TABLE root_vendors
  ADD COLUMN default_expense_category_id text REFERENCES root_expense_categories(category_id),
  ADD COLUMN default_forest_account_id text REFERENCES root_forest_accounts(account_id);

-- root_employees に MF 連携・契約情報・支給方法カラム追加（Phase 6 準備）
ALTER TABLE root_employees
  ADD COLUMN mf_kyuuyo_employee_id text,                                                -- MF クラウド給与の独自ID
  ADD COLUMN employment_type text CHECK (employment_type IN ('役員', '正社員', 'アルバイト')),
  ADD COLUMN department_name text,
  ADD COLUMN job_title text,
  ADD COLUMN payment_method text CHECK (payment_method IN ('bank_transfer', 'cash', 'other'));
```

### 4.3 Bud 側に追加するテーブル

```sql
-- OCR 生データ保管
CREATE TABLE bud_ocr_extractions (
  extraction_id     text PRIMARY KEY,            -- OCR-20260422-0001
  document_type     text CHECK (document_type IN ('receipt', 'invoice', 'transfer_form', 'bank_statement')),
  ocr_provider      text NOT NULL,               -- 'claude-sonnet-4-6', 'claude-opus-4-7'
  storage_url       text NOT NULL,
  archive_url       text,                        -- Google Drive アーカイブパス
  raw_text          text,
  structured_data   jsonb NOT NULL,
  confidence_score  numeric(3,2),
  uploaded_by       uuid REFERENCES auth.users(id),
  uploaded_at       timestamptz NOT NULL DEFAULT now(),
  linked_transfer_id text REFERENCES bud_transfers(transfer_id),
  linked_statement_id text REFERENCES bud_statements(statement_id),
  linked_receipt_id text                         -- bud_receipts への参照（Phase 4c）
);

-- 照合履歴
CREATE TABLE bud_reconciliations (
  reconcile_id      text PRIMARY KEY,
  statement_id      text NOT NULL REFERENCES bud_statements(statement_id),
  transfer_id       text REFERENCES bud_transfers(transfer_id),
  match_type        text CHECK (match_type IN ('auto_exact', 'auto_partial', 'manual', 'split', 'no_match')),
  matched_by        uuid REFERENCES auth.users(id),
  matched_at        timestamptz NOT NULL DEFAULT now(),
  memo              text
);

-- 現金領収書（FM レシート入力の Bud 化）
CREATE TABLE bud_receipts (
  receipt_id        text PRIMARY KEY,            -- GBU0000001 (Garden 新形式)
  legacy_keiri_id   text,                        -- 旧 KR00010451 形式（移行時に保持、super_admin のみ閲覧）
  stamp_number      text,                        -- 物理レシートのスタンプ番号（自由入力）
  company_id        text REFERENCES root_companies(company_id),
  user_employee_id  text REFERENCES root_employees(employee_id),  -- 使用者
  is_qualified_invoice boolean NOT NULL DEFAULT false,
  qualified_invoice_number text,                 -- 13 桁
  expense_category_id text REFERENCES root_expense_categories(category_id),
  forest_account_id text REFERENCES root_forest_accounts(account_id),
  receipt_date      date NOT NULL,
  store_name        text NOT NULL,
  amount            integer NOT NULL,
  input_by          uuid REFERENCES auth.users(id),
  input_started_at  timestamptz,
  input_finished_at timestamptz,
  input_error_note  text,
  confirmed_by      uuid REFERENCES auth.users(id),
  confirmed_started_at timestamptz,
  confirmed_finished_at timestamptz,
  ocr_extraction_id text REFERENCES bud_ocr_extractions(extraction_id),
  attachment_url    text,                        -- Supabase Storage
  archive_url       text,                        -- Google Drive
  status            text NOT NULL DEFAULT 'input' CHECK (status IN ('input', 'confirmed', 'classified')),
  memo              text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- 手渡し現金給与（独立管理）
CREATE TABLE bud_cash_salaries (
  cash_salary_id    text PRIMARY KEY,            -- CASH-2026-04-0001
  employee_id       text REFERENCES root_employees(employee_id),
  company_id        text REFERENCES root_companies(company_id),
  target_month      text NOT NULL,               -- 2026-04
  planned_amount    integer NOT NULL,
  planned_date      date,
  actual_amount     integer,
  actual_date       date,
  status            text CHECK (status IN ('予定', '受領済', 'キャンセル')),
  cash_source_statement_id text REFERENCES bud_statements(statement_id),
  receipt_confirmed_at timestamptz,
  receipt_method    text CHECK (receipt_method IN ('signature', 'qr_code', 'verbal')),
  receipt_signature_url text,
  memo              text,
  created_by        uuid REFERENCES auth.users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
```

### 4.4 bud_transfers の拡張（Phase 1b 時）

Kintone 振込実行アプリの分析から、以下を追加：

```sql
ALTER TABLE bud_transfers
  -- 振込種別（通常 / キャッシュバック）
  ADD COLUMN transfer_category text CHECK (transfer_category IN ('regular', 'cashback')),
  -- 社内立替対応
  ADD COLUMN request_company_id text REFERENCES root_companies(company_id),
  ADD COLUMN execute_company_id text REFERENCES root_companies(company_id),
  -- キャッシュバック固有項目
  ADD COLUMN cashback_applicant_name_kana text,
  ADD COLUMN cashback_applicant_name text,
  ADD COLUMN cashback_applicant_phone text,
  ADD COLUMN cashback_customer_id text,
  ADD COLUMN cashback_order_date date,
  ADD COLUMN cashback_opened_date date,
  ADD COLUMN cashback_product_name text,
  ADD COLUMN cashback_channel_name text,
  ADD COLUMN cashback_partner_code text,
  ADD COLUMN cashback_application_status text CHECK (cashback_application_status IN ('pending', 'under_review', 'approved', 'rejected', 'returned')),
  -- 受取人相違確認
  ADD COLUMN payee_mismatch_confirmed boolean NOT NULL DEFAULT false,
  -- 分類
  ADD COLUMN expense_category_id text REFERENCES root_expense_categories(category_id),
  ADD COLUMN forest_account_id text REFERENCES root_forest_accounts(account_id),
  -- 重複検出
  ADD COLUMN duplicate_key text GENERATED ALWAYS AS (
    concat_ws(',',
      to_char(scheduled_date, 'YYYYMMDD'),
      payee_bank_code, payee_branch_code,
      payee_account_number, amount::text)
  ) STORED;

CREATE UNIQUE INDEX idx_bud_transfers_duplicate_key
  ON bud_transfers(duplicate_key)
  WHERE duplicate_flag = false;
```

### 4.5 振込 ID 命名規則の変更

- **旧**: `FRK-YYYY-MM-NNNN`（Phase 0 schema）
- **新**: Kintone の既存運用を継承
  - `FK-YYYYMMDD-NNNNNN`（通常振込）
  - `CB-YYYYMMDD-G-NNN`（キャッシュバック）

### 4.6 経理 ID の命名規則（Phase 4c）

- **新形式**: `GBU0000001`（Garden 全体規則 `GXX0000001` に準拠、Bud 専用の `GBU` プレフィックス）
- **旧 KR 形式**: `bud_receipts.legacy_keiri_id` に保持、Bud 通常画面では非表示、super_admin の「税理士対応モード」でのみ閲覧可

---

## 5. Phase 1a — 全銀協 CSV ライブラリ

### 5.1 目的

銀行に振込を一括で出すための CSV（全銀協フォーマット、120 byte 固定長）を生成するライブラリを先行作成。後続 Phase の「出口」を先に確定させ、データ設計漏れを防ぐ。

### 5.2 対象銀行

| 銀行 | 対応方針 | ファイル拡張子 | EOF マーク |
|---|---|---|---|
| 楽天銀行ビジネス | ✅ 実装 | `.csv` | なし |
| みずほビジネス WEB | ✅ 実装 | `.txt` | あり（`\x1A`）|
| PayPay 銀行法人 | ✅ 実装 | `.csv` | なし |
| 京都銀行 | 枠のみ用意、実装は将来（送金が必要になったとき）| — | — |

### 5.3 ファイル配置

```
src/lib/zengin/
  ├─ index.ts              — 外部公開 API
  ├─ generator.ts          — CSV 生成本体
  ├─ kana-converter.ts     — 半角カタカナ変換
  ├─ validator.ts          — バリデーション
  ├─ bank-specific.ts      — 銀行別差異吸収（rakuten / mizuho / paypay / kyoto）
  └─ __tests__/            — ユニットテスト + 固定値フィクスチャ
```

### 5.4 API

```typescript
// 主要関数（擬似インターフェース）
generateZenginCsv(
  transfers: BudTransfer[],
  sourceAccount: BankAccount,
  options: { bank: 'rakuten' | 'mizuho' | 'paypay' }
): { content: string; encoding: 'Shift-JIS'; filename: string };

toHalfWidthKana(name: string): { kana: string; warnings: string[] };
validateTransfer(transfer: BudTransfer): { valid: boolean; errors: string[] };
```

### 5.5 自動チェック

| 項目 | 不正時の挙動 |
|---|---|
| 銀行コード 4 桁数字 | エラー、CSV 生成中止 |
| 支店コード 3 桁数字 | エラー、CSV 生成中止 |
| 口座番号 1〜7 桁数字 | エラー、CSV 生成中止 |
| 受取人名カナ 30 桁以内（半角換算）| 超過時は自動切詰＋警告 |
| カナに使用不可文字 | 警告（使える文字: `ｱｲｳｴｵ〜ﾝ` / `0-9` / `A-Z` / `. - ( ) /` / `,` / `ﾞ ﾟ` / `ｦ`）|
| 金額が正の整数 | エラー |

### 5.6 動作確認方法

1. テストデータ（サンプル振込 5 件）を用意して、各銀行用 CSV を生成
2. **楽天銀行ビジネス**の「総合振込 → データ受信」に取込テスト（実送金しない、取込画面でエラー有無のみ確認）
3. 同じく **みずほ**・**PayPay** で取込テスト
4. 取込成功を確認記録

### 5.7 工数: 0.5d

| 内訳 | 日数 |
|---|---|
| 実装（関数 3 つ） | 0.3 |
| テスト作成 | 0.1 |
| 銀行取込動作確認（3 銀行） | 0.1 |

---

## 6. Phase 1b — 振込管理

### 6.1 目的

Kintone の振込実行アプリを Bud に完全置換。振込依頼の登録から CSV 出力までを Bud で完結。

### 6.2 業務フロー転換

| | AS-IS（Kintone）| TO-BE（Bud）|
|---|---|---|
| 起票 | 経理が Kintone に入力 | 経理が Bud に入力 |
| 確認 | 二重チェック（Kintone 上で）| 二重チェック（Bud 上で）|
| 承認 | Kintone で上田さん承認 | Bud で上田さん承認 |
| 振込実行 | Kintone 画面見ながら**1 件ずつ手動** | **総合振込 CSV → ネットバンキングで一括取込** |
| 件数 | 50〜80 件/月 | 同 |
| 所要時間 | 数時間/月 | 数分/月（CSV 取込） |

**最大の価値**: 1 件ずつ → 一括振込への業務プロセス変更。

### 6.3 振込種別（2 系統）

| 種別 | ID 形式 | 用途 | 月間件数 | 起票元 |
|---|---|---|---|---|
| 通常振込 | `FK-YYYYMMDD-NNNNNN` | 取引先への請求書支払い | 20〜30 | Bud 画面 |
| キャッシュバック | `CB-YYYYMMDD-G-NNN` | 販促費の消費者向け還元 | 30〜50 | **Leaf 各案件画面から**（Phase 1c）|

### 6.4 ステータス遷移（6 段階）

```
下書き → 確認済み → 承認待ち → 承認済み → CSV出力済み → 振込完了
              ↓
           差戻し
```

**super_admin スキップ**: 東海林さん自身の起票は `下書き → 承認済み` に 1 クリック遷移可。

### 6.5 RLS 方針（ステータス遷移ごとに権限分岐）

| 遷移 | 必要権限 | 実装 |
|---|---|---|
| 下書き作成 | bud_has_access() | 既存 |
| 下書き編集 | 起票者本人 or admin 以上 | 新規 |
| 確認済みへ | admin 以上（起票者以外） | 新規 |
| 承認待ちへ | admin 以上 | 新規 |
| 承認済みへ | admin 以上 | 新規 |
| 差戻し | admin 以上 | 新規 |
| CSV 出力済みへ | **super_admin のみ** | 新規 |
| 振込完了へ | super_admin のみ | 新規 |

### 6.6 Kintone から引き継ぐ業務ルール

1. **二重チェック機能**: 既存 `confirmed_by` / `confirmed_at` を活用
2. **社内立替**: `request_company_id` ≠ `execute_company_id` で表現
3. **重複検出**: 支払期日 + 受取会社コード + 支店 + 口座番号 + 金額 の連結キー（`duplicate_key`、UNIQUE INDEX）
4. **受取人名カナ自動変換**: 全角 → 半角カナ、編集可、使用不可文字を警告
5. **受取人相違確認**: `payee_name` と `payee_account_holder_kana` が別人の場合は確認チェック必須

### 6.7 画面構成（5 画面）

```
振込管理
  ├ 振込一覧（ステータス別フィルタ・月別集計）
  ├ 通常振込 新規作成
  ├ キャッシュバック 新規作成（※Leaf 連携は Phase 1c で実装）
  ├ 振込詳細（ステータス操作ボタン + 関連振込表示）
  └ CSV 出力画面（super_admin 専用、銀行別にグループ化）
```

### 6.8 工数: 2.2d

| 内訳 | 日数 |
|---|---|
| テーブル拡張（ID 採番・追加カラム）| 0.2 |
| 振込一覧画面 | 0.4 |
| 新規作成画面（通常＋キャッシュバック）| 0.5 |
| 振込詳細画面 | 0.3 |
| CSV 出力画面（Phase 1a 呼び出し）| 0.3 |
| RLS 6 段階＋ポリシー追加 | 0.2 |
| 動作確認・調整 | 0.3 |

---

## 7. Phase 1c — Leaf 連携（キャッシュバック申請）

### 7.1 目的

各 Leaf 事業アプリ（関電業務委託・コールセンター代理店・電子ブレーカー販売等）から、キャッシュバック振込を申請できる仕組み。

### 7.2 連携方式

**案 B 採用**: Leaf の申請ボタンが直接 Bud の `bud_transfers` に INSERT。Leaf 側からは参照のみ。

### 7.3 キャッシュバック専用ステータス

```
(Leaf で起票) → 承認待ち → 承認済み → CSV出力済み → 振込完了
                  ↓↑
                検討中（一時保留）
                  ↓
                差戻し（情報不備・Leaf に戻す）
                  ↓
                却下（キャッシュバックしない最終決定）
```

| 状態 | 動かせる人 | 備考 |
|---|---|---|
| 承認待ち | Leaf 起票者（自動）| Leaf から Bud へ渡ってきた初期状態 |
| 検討中 | admin 以上（将来 manager 以上へ拡張可能）| 判断保留 |
| 承認済み | 同上 | 通常の振込フローへ |
| 差戻し | 同上 | **理由必須**、Leaf 側で修正して再申請可 |
| 却下 | 同上 | **理由任意**（一文メモ程度）、最終決定、再申請可 |

### 7.4 検討中の振込予定日超過対応

**A 案（画面アラートのみ）採用**:
- Bud メニュー上に「要対応 N 件」バッジ
- キャッシュバック一覧画面で超過レコードを赤字＋先頭表示
- メール・Chatwork 通知なし（通知過多回避）
- 将来の検討: D 案（画面 + Chatwork + 自動却下）へ拡張可能（memo: 運用 3 ヶ月後に判断）

### 7.5 共通部品（Leaf 全アプリで流用）

```
src/components/common/bud/
  ├─ CashbackApplicationButton.tsx    — Leaf 案件画面の「キャッシュバック申請」ボタン
  └─ CashbackStatusViewer.tsx         — 案件画面での進捗・振込予定日・結果表示
```

### 7.6 Bud 側の受け口

- API: `POST /api/bud/cashback-applications`
- 認証: Leaf 画面から Bud へのリクエストも Supabase Auth 経由
- CB-ID 採番: `CB-YYYYMMDD-G-NNN` 形式で Bud 側が採番
- 初期ステータス: `承認待ち`

### 7.7 対象 Leaf アプリ

- ✅ 関電業務委託（既存、Phase 1c で組み込み）
- ⏳ コールセンター代理店業務（Leaf 未作成、各アプリ作成時に共通部品を流用）
- ⏳ 電子ブレーカーレンタル販売業務（同上）
- その他の将来事業アプリ（同上）

### 7.8 工数: 1.0d

| 内訳 | 日数 |
|---|---|
| 共通部品（申請ボタン + 状況ビューア）| 0.5 |
| Bud 側 API | 0.3 |
| 関電アプリへの組み込み | 0.2 |

---

## 8. Phase 2a — 銀行明細取込

### 8.1 目的

各銀行の入出金明細 CSV を Bud に取り込み、既存の Forest + Python 仕訳ツール（`4_仕訳帳_弥生出力_v11.py`）を置換。MF クラウド会計経由の運用を廃止（後道さん NG）。

### 8.2 対象銀行・法人マトリクス

| 法人 | 楽天銀行 | みずほ銀行 | PayPay銀行 | 京都銀行 |
|---|:-:|:-:|:-:|:-:|
| ヒュアラン | ✅ 7853952 | ✅ 1252992 | ✅ 2397629 | ✅ 0029830（入金のみ）|
| センターライズ | — | ✅ 3024334 | ✅ 1266637 | — |
| リンクサポート | ✅ 7281769 | ✅ 3036669 | — | — |
| ARATA | ✅ 7289997 | ✅ 3026280 | — | — |
| たいよう | ✅ 7291657 | — | — | — |
| 壱 | ✅ 7659425 | — | — | — |

### 8.3 自動分類ロジック（3 段階）

```
① root_vendors.default_expense_category_id で自動分類
    例: サイボウズ → システム費 / サイボウズ

② root_expense_categories のキーワードマッチ
    共通マスタ v12 Excel の 441 行を root_expense_categories に seed（Phase 2c）
    例: 摘要に「NTT」→ NTT原価 / 通信費

③ どちらもヒットしない
    → 「未分類」一覧へ、手動分類 → マスタに自動追加
```

### 8.4 既存仕訳ロジック移植

| 既存 Python 処理 | Bud での移植先 |
|---|---|
| `SELF_ACCOUNTS` 判定（自法人内口座振替）| 対象外マーク自動判定 |
| 共通マスタキーワードマッチ | 上記の ② |
| 日付・金額パース | TypeScript パーサー |

### 8.5 画面構成（3 画面）

```
明細管理
  ├ CSV 取込画面（月初作業）
  ├ 明細一覧（今月の全行、フィルタ・検索・月別集計）
  └ 取込履歴
```

### 8.6 重複取込防止

ユニークキー: `取引日 + 口座ID + 入金額 + 出金額 + 銀行説明文の頭 30 文字`

既存 DB にあればスキップ。プレビュー画面で重複件数表示。

### 8.7 工数: 1.35d

| 内訳 | 日数 |
|---|---|
| 楽天銀行 CSV パース | 0.2 |
| みずほ銀行 CSV パース | 0.2 |
| PayPay 銀行 CSV パース | 0.15 |
| 京都銀行 CSV パース（入金のみ）| 0.15 |
| CSV 取込画面 | 0.2 |
| 明細一覧画面 | 0.15 |
| 取込履歴画面 | 0.1 |
| RLS・動作確認 | 0.2 |

### 8.8 Phase 2a 着手の前提

- [ ] `root_bank_accounts` に上記マトリクスの全口座情報が seed 済み（既存 `3_口座設定.py` から移行）
- [ ] 各銀行から実月次 CSV サンプル（1 ファイルずつ）が入手済み
- [ ] Gdrive `015_Gardenシリーズ/05_Garden-Bud/refs/` に配置

---

## 9. Phase 2b — CC 明細取込

### 9.1 目的

既存 `7_クレジットカード明細_v5.py` の Bud 化。4 カードの CSV 取込と自動分類。

### 9.2 対応カード

| カード | ヘッダー有無 | PDF 併用 |
|---|---|---|
| オリコカード | あり | — |
| NTTBiz カード | あり | — |
| 三井住友カード 後道翔太 | なし | — |
| 三井住友カード 東海林美琴 | なし | 6 月分のみ（将来対応）|

### 9.3 仕訳ルール（確定済み）

- 借方＝費用科目（マスタ照合）、貸方＝未払金
- 全 CC＝インボイスあり、税区分＝課税仕入 10%
- **飲食店 5000 円ルール**: マスタ区分「飲食店」のとき
  - 5,000 円以下 → 会議費
  - 5,000 円超 → 接待交際費

### 9.4 科目マッピング（既存 v12 マスタ継承）

| カテゴリ | 借方科目 |
|---|---|
| コンビニ | 会議費 |
| ガソリン・駐車場 | 車両費 |
| ETC | 旅費交通費 |
| PayPay・Amazon・小売 | 消耗品費 |
| SaaS・クラウド | システム費 |
| 携帯・ネット | 通信費 |
| 配送 | 荷造運賃 |
| 自販機・ジム | 福利厚生費 |
| ゴルフ | 接待交際費 |

### 9.5 工数: 0.8d

| 内訳 | 日数 |
|---|---|
| 4 カードのパーサー（オリコ・NTTBiz・三井住友×2）| 0.4 |
| 5000 円ルール実装 | 0.1 |
| 取込画面（Phase 2a と共通）| 0.1 |
| 未カバー 263 種の UI 補助（手動分類→マスタ追加）| 0.1 |
| RLS・動作確認 | 0.1 |

---

## 10. Phase 2c — 共通マスタ seed

### 10.1 目的

既存 `1_共通マスタ_v12.xlsx`（441 行）を `root_expense_categories` に初期投入。

### 10.2 移行内容

- 大区分・小区分ペア × 441 行
- CC 店舗キーワード（飲食店フラグ含む）
- 勘定科目マッピング

### 10.3 工数: 0.3d

| 内訳 | 日数 |
|---|---|
| Excel 解析スクリプト（Python or SQL）| 0.1 |
| データクレンジング（重複・表記揺れ）| 0.1 |
| Seed SQL 生成・適用・確認 | 0.1 |

---

## 11. Phase 3 — 支払明細＋照合

### 11.1 目的

銀行の出金明細（Phase 2a 取込）と振込依頼（Phase 1b）を自動マッチング。月末の未払金残高を正確化。

### 11.2 マッチング判定（5 段階）

```
① 完全一致: 実行日+金額+振込先すべて一致
② 日付ゆらぎ許容: 前後 2 日 + 金額+振込先
③ 部分一致: 日付+金額 + 振込先が片方空欄
④ 手数料込み比較: 出金額 = 振込金額 + 手数料
⑤ マッチなし: 要対応リスト
```

### 11.3 対象外マーク（自動判定）

| 種別 | 判定方法 |
|---|---|
| 自社口座間振替 | `SELF_ACCOUNTS` ロジック（既存継承）|
| 銀行手数料 | 摘要キーワード（「振込手数料」「月額」）|
| CC 引き落とし | 摘要キーワード（「オリコ」「ペイメント」）|
| ATM 引出 | 摘要キーワード（「ATM」「出金」）|
| 税金・社会保険 | 摘要キーワード（「法人税」「年金機構」）|
| 上記外 | 手動分類 → マスタ追加で次回自動化 |

### 11.4 画面構成（3 画面）

```
照合管理
  ├ 照合状況ダッシュボード（月別完了率グラフ）
  ├ 要対応リスト（左: 未紐付出金 / 右: 未完了振込 / 中央: 紐付ボタン）
  └ 照合履歴
```

### 11.5 社内立替の扱い

- 出金側の `実行会社` = `bud_transfers.execute_company_id` で一致判定
- 依頼会社は会計側で「短期貸付金」仕訳（Forest 責務）
- コストダッシュボード（Phase 5）で法人横断ビュー

### 11.6 工数: 2.0d

| 内訳 | 日数 |
|---|---|
| マッチングエンジン（5 段階）| 0.5 |
| ダッシュボード | 0.3 |
| 要対応リスト（2 ペイン + 紐付 UI）| 0.6 |
| 照合履歴 | 0.2 |
| 対象外自動判定 | 0.3 |
| RLS・動作確認 | 0.1 |

---

## 12. Phase 4a — 自動仕訳エンジン

### 12.1 3 段階判定（Phase 2a で既定義、ここで完全化）

```
① root_vendors.default_expense_category_id
② root_expense_categories キーワードマッチ
③ 未分類 → 手動 → マスタ追加
```

### 12.2 マスタ編集画面（super_admin 専用）

- 大区分・小区分・勘定科目・税区分・飲食店フラグ の CRUD
- 取引先ごとのデフォルト分類設定
- キーワードマッチルール追加

### 12.3 CC 5000 円ルール（Phase 2b の完全化）

Phase 2b で一部実装済み。Phase 4a で仕訳エンジン側に統合。

### 12.4 工数: 1.0d

| 内訳 | 日数 |
|---|---|
| 自動仕訳エンジン（3 段階判定）| 0.6 |
| マスタ編集画面 | 0.4 |

---

## 13. Phase 4b — OCR + 撮影UI + ファイル保管

### 13.1 対応書類 × OCR 戦略

| 書類 | 使うモデル | 抽出情報 |
|---|---|---|
| 現金領収書レシート | Claude Sonnet 4.6 | 店舗・日付・金額・品目・消費税区分・インボイス番号 |
| 請求書（取引先から）| Sonnet 4.6 | 請求元・振込先口座・支払期日・金額・内訳 |
| 振込依頼書（紙受領時）| Sonnet 4.6 | 受取人・口座・金額・振込希望日 |

### 13.2 信頼度スコアと自動フォールバック

Claude の返す `confidence_score`（0.00〜1.00）で：

- **0.90 以上**: そのまま使う
- **0.70〜0.89**: 確認画面表示、ユーザーが承認
- **0.70 未満**: **自動で Opus 4.7 再実行**、それでも 0.70 未満なら「要手入力」

### 13.3 確認 UI（Leaf 関電式 分割ビュー）

左: OCR で読取った原本画像／右: 抽出データの編集可能フォーム。確定で DB 登録、生データは `bud_ocr_extractions` に保管。

### 13.4 スマホ撮影 UI

連続撮影フロー：

1. 「撮影開始」 → カメラ起動、ガイド枠表示（緑の四角、画面幅 80%）
2. シャッター → プレビュー → OK/やり直し
3. OK で自動的に次の撮影画面へ（連続モード）
4. 任意枚数撮影後、「撮影終了」 → 一覧画面
5. サムネイル一覧で個別削除・撮り直し可
6. 「まとめてアップロード」 → 一括送信、OCR 処理 → 確認待ち

技術基盤（Garden-Leaf M1 資産流用）:
- Web Camera API（HTTPS 必須）
- 開発時は `m1_server.py` + 自己署名証明書
- 本番は Vercel で自動 HTTPS

圧縮: 長辺 1500px、JPEG 品質 85%

### 13.5 ファイル保管（2 層）

```
① Supabase Storage（bud-attachments バケット）
    receipts/ invoices/ transfer_forms/ bank_statements/ cc_statements/
    命名: {module}/{year}/{month}/{company}/{document_id}.pdf

② Google Drive（マイドライブ配下の archive フォルダ）
    archive/{year}/{month}/{company}/{document_type}/
    Supabase Edge Function + Google Drive API（サービスアカウント）で自動転送
    画像は PDF 変換後に保存（容量削減）
```

### 13.6 工数: 3.3d

| 内訳 | 日数 |
|---|---|
| OCR API 統合（Claude Vision）| 0.6 |
| 信頼度フォールバック（Sonnet→Opus）| 0.2 |
| 確認 UI（分割ビュー）| 0.5 |
| スマホ撮影 UI（ガイド枠＋連続）| 0.5 |
| 撮影済み一覧＋一括アップロード | 0.3 |
| Supabase Storage 連携 | 0.2 |
| Google Drive 自動転送 Edge Function | 0.4 |
| 画像→PDF 変換 | 0.2 |
| RLS・動作確認（スマホ実機テスト含む）| 0.4 |

---

## 14. Phase 4c — FileMaker レシート Bud 化

### 14.1 目的

既存 FileMaker レシート入力システム（872 件以上）を Bud に完全移行。川中さん（入力）・簡さん（確認）の業務を Bud 上に再現。

### 14.2 既存運用の項目継承

| 項目 | Bud テーブル | 備考 |
|---|---|---|
| 経理 ID（旧 KR+8桁）| `bud_receipts.legacy_keiri_id` | 保持のみ、super_admin で検索可 |
| **新規発番** | `bud_receipts.receipt_id` | `GBU0000001` 形式（Garden 全体規則） |
| 領収書 No（スタンプ番号）| `bud_receipts.stamp_number` | 物理レシートのスタンプ番号、手入力、採番ルールなし |
| 法人 | `company_id` | root_companies 参照 |
| 使用者 | `user_employee_id` | root_employees 参照 |
| インボイス | `is_qualified_invoice` / `qualified_invoice_number` | 13 桁検証 |
| 区分 | `expense_category_id` | root_expense_categories 参照 |
| 日付・店名・金額 | そのまま | — |
| 入力 2 段階 | `input_by` / `input_started_at` / `input_finished_at` / `input_error_note` | 時間記録で入力効率計測 |
| 確認 2 段階 | `confirmed_by` / `confirmed_started_at` / `confirmed_finished_at` | 簡さん担当 |

### 14.3 OCR 自動入力フロー（川中さんの業務改善）

**OCR 導入の目的**: 川中さんの**入力工数削減**（関電業務の入力 + 領収書入力、両方で OCR 化）

```
1. スマホ or PC でレシートを撮影・アップロード
2. OCR 処理（Phase 4b の仕組み）
3. bud_receipts の入力画面に OCR 結果が自動で入る
4. 川中さんが画面右側で修正・補足入力
5. 確定 → ステータス `input` → 簡さんの確認待ちへ
6. 簡さんが目視確認 → ステータス `confirmed`
```

### 14.4 税理士対応モード（super_admin 専用）

- 画面上部トグルで ON/OFF
- ON: レシート一覧の各行に旧 KR 番号併記
- 検索窓で KR00010451 入力で該当レコードにジャンプ
- 通常は OFF（画面すっきり）

### 14.5 移行計画（872 件以上 全件）

1. FileMaker から全レコードを CSV エクスポート
2. 移行スクリプトで `bud_receipts` に INSERT
   - 既存 KR 番号 → `legacy_keiri_id` に保持
   - 新規 `receipt_id` を `GBU` 形式で連番採番
3. Supabase Storage に原本画像が残っていれば紐付（FileMaker に添付されていればエクスポート）
4. 一部の不整合データを手動クレンジング

### 14.6 担当者のアカウント対応

| 氏名 | 現状 | Phase 4c 着手前の対応 |
|---|---|---|
| 川中 美来さん（入力）| 未作成 | `root_employees` に staff 登録 + `bud_users.bud_role='staff'` 登録 |
| 簡 棣榮さん（確認）| 作成済み | `bud_users.bud_role='staff'`（確認担当）登録のみ |

### 14.7 工数: 2.1d

| 内訳 | 日数 |
|---|---|
| `bud_receipts` テーブル設計・RLS | 0.3 |
| 入力画面（OCR 連携 + 手動編集）| 0.5 |
| 確認画面（2 段階承認）| 0.3 |
| 既存 872 件以上の全件移行 | 0.8 |
| 動作確認 + 川中・簡さんへの引継資料 | 0.2 |

---

## 15. Phase 5 — コストダッシュボード

### 15.1 目的

既存 xlsx「グループ6社 年間コスト ワンビュー」を Bud 上で自動生成。

### 15.2 画面レイアウト

xlsx と**ほぼ同じ見た目**で、東海林さんが違和感なく使える。

- 大区分 × 小区分 × 月 のピボットテーブル
- 小計行は折りたたみ可（▶ ボタン）
- セルクリックで明細ドリルダウン
- グレーアウト（月末締めまだ）の色分けルール継承

### 15.3 フィルタ・切替

- 期間: 今月 / 先月 / 今期 / カスタム
- 法人: 全社 / 1 社 / 複数社
- 表示モード: 円/千円/百万円、前年同月比、合計小計のみ

### 15.4 グラフパネル

- 推移グラフ（大区分別 月次推移）
- 構成比グラフ（期間内総コストの円グラフ）
- 異常検知（前月比 +50% 以上の大区分を赤バッジ表示、3 ヶ月連続ゼロの小区分を情報表示）

### 15.5 Excel エクスポート

xlsx の現在のレイアウト互換で出力。関数ベース（セルの数式を残す）。

### 15.6 データソース

| データ | ソーステーブル |
|---|---|
| 銀行入出金 | `bud_statements` |
| CC 明細 | `bud_statements`（Phase 2b）|
| 振込 | `bud_transfers` |
| 現金レシート | `bud_receipts` |
| 給与 | `bud_salary_details`（Phase 6 後）|

マテリアライズドビュー `bud_cost_summary_monthly` で高速化、日次バッチでリフレッシュ（深夜 2:00）。

### 15.7 工数: 1.5d

| 内訳 | 日数 |
|---|---|
| マテリアライズドビュー設計・作成 | 0.3 |
| メインダッシュボード画面 | 0.5 |
| フィルタ・切替機能 | 0.2 |
| ドリルダウン | 0.2 |
| グラフパネル | 0.2 |
| 異常検知 | 0.1 |
| Excel エクスポート | 0.1 |

---

## 16. Phase 6 — 給与処理

### 16.1 方針転換

給与計算そのものは **MF クラウド給与**に任せ、Bud は前後の工程を管理。

### 16.2 ステータス遷移（9 段階）

```
① 管理者計算中（上田さん）
② 責任者確認（宮永・小泉さん）
③ 東海林確定
④ MF インポート済（Bud → MF）
⑤ 社労士チェック待ち
⑥ MF 確定済
⑦ Bud インポート済（MF → Bud 確定結果）
⑧ 総合振込 CSV 作成済（Phase 1a 活用）
⑨ 振込連携済
```

### 16.3 各ステップの担当

| 遷移 | 担当者 | ロール |
|---|---|---|
| 起票 → ① | 上田さん | admin |
| ① → ② | 上田さん | admin |
| ② → ③ | 宮永 or 小泉さん | manager 以上 |
| ③ → ④ | 東海林さん | super_admin |
| ④ → ⑤ | 東海林さん（MF 側作業のマーク）| super_admin |
| ⑤ → ⑥ | 東海林さん（MF 側作業のマーク）| super_admin |
| ⑥ → ⑦ | 東海林さん | super_admin |
| ⑦ → ⑧ | 東海林さん | super_admin |
| ⑧ → ⑨ | 東海林さん | super_admin |

### 16.4 MF クラウド給与 CSV 構造（72 列）

| 範囲 | 列数 | 内容 |
|---|---:|---|
| 基本情報（Version・ID・事業所・契約種別等）| 9 | — |
| 勤怠情報 | 15 | 所定労働・出勤欠勤・法定外・深夜等 |
| 月給支給 | 16 | 役員報酬・基本給・各種手当 |
| 時給支給 | 11 | 基本給・AP インセン・歩合系 |
| 日給支給 | 7 | 基本給・残業・休日等 |
| 控除 | 12 | 社保・税・**前払・社宅** 等 |
| 備考 | 1 | — |

### 16.5 管理者計算画面の入力項目

上田さんが Bud で入力：

| タブ | 項目数 | 備考 |
|---|---:|---|
| 勤怠 | 15 | — |
| 月給支給（役員・正社員）| 16 | — |
| 時給支給（時給者）| 11 | — |
| 日給支給（日給者）| 7 | — |
| 非法定控除 | **2** | **楽天早トク前払** / **社宅家賃** |
| 備考 | 1 | MF に渡すコメント |

契約種別（役員・正社員・アルバイト）で自動的にタブ表示切替。

MF 側で自動計算される控除（上田さん入力不要）:
- 健康保険料・介護保険料・子ども子育て支援金・厚生年金保険料・雇用保険料
- 所得税・住民税・年調過不足税額・調整保険料

### 16.6 手渡し現金支給（案 C 採用）

**独立管理テーブル** `bud_cash_salaries` で以下を記録：

- 月次の支給計画（従業員×金額×予定日）
- ATM 引出（`bud_statements` 出金）との紐付
- 受領確認（QR コード読取 or 口頭確認、タイムスタンプ記録）

対象: 正社員中心、約 10 名。MF クラウド給与には含まれず、Bud で完結。

### 16.7 給与内の外注費リクラス

`bud_salary_details.contractor_portion` カラム追加。給与のうち外注扱い部分を分離。Phase 5 ダッシュボードで別科目集計。Forest 弥生 CSV 出力時に会計科目分離。

### 16.8 画面構成（9 画面）

```
給与処理
  ├ 給与バッチ一覧（9 ステータス進捗）
  ├ 管理者計算画面（上田さん：原案作成）
  ├ 責任者確認画面（宮永・小泉さん）
  ├ 東海林確定画面
  ├ MF エクスポート画面（72 列 CSV 生成）
  ├ MF 進捗管理画面（社労士チェック待ち・MF 確定のマーク）
  ├ MF インポート画面（確定結果取込）
  ├ 振込 CSV 生成画面（Phase 1a 活用）
  ├ 明細配信画面（Garden-Tree への API 連携）
  ├ 【新】手渡し現金支給計画画面
  └ 【新】手渡し現金受領確認画面（スマホ対応）
```

### 16.9 Root 側の追加カラム（Phase 6 着手前必須）

```sql
ALTER TABLE root_employees
  ADD COLUMN mf_kyuuyo_employee_id text,
  ADD COLUMN employment_type text CHECK (employment_type IN ('役員', '正社員', 'アルバイト')),
  ADD COLUMN department_name text,
  ADD COLUMN job_title text,
  ADD COLUMN payment_method text CHECK (payment_method IN ('bank_transfer', 'cash', 'other'));
```

### 16.10 権限設計（給与はセンシティブ）

- 自分の給与は閲覧可
- 他人の給与は閲覧不可（super_admin + 該当法人 admin のみ）
- 編集は admin 以上
- 東海林確定以降は super_admin のみ
- RLS で強制

### 16.11 Tree 連携（明細配信）

- Bud 側で API を作成（Phase 6 内）
- Garden-Tree 側の画面改修は**別タスク**（Tree の Phase として位置付け、本 spec の工数には含まず）

### 16.12 工数: 4.55d

| 内訳 | 日数 |
|---|---|
| 手渡し現金対応（bud_cash_salaries + 受領確認）| 0.9 |
| 勤怠データ取込（KoT CSV or 手入力）| 0.4 |
| 給与バッチ一覧（9 段階）| 0.3 |
| 管理者計算画面（4 タブ + 非法定控除）| 0.5 |
| 責任者確認画面 | 0.2 |
| 東海林確定画面 | 0.2 |
| MF エクスポート機能 | 0.4 |
| MF 進捗管理 UI | 0.2 |
| MF インポート機能 | 0.4 |
| 振込 CSV 生成（Phase 1a 活用）| 0.2 |
| 明細配信 API | 0.2 |
| 外注費リクラス対応 | 0.2 |
| Root カラム追加（MF 識別子等）| 0.1 |
| RLS（9 段階 + manager ロール）・動作確認 | 0.35 |

---

## 17. 横断課題

### 17.1 ファイル保管アーキテクチャ

2 層構造：
- **作業層**: Supabase Storage（最長 3 年）
- **アーカイブ層**: Google Drive（10 年、法定保管期間）

詳細は Phase 4b §13.5 を参照。

### 17.2 監査ログ

既存 `root_audit_logs` テーブルを活用。module='bud' を付与。対象操作: 振込全操作・明細取込/修正/削除・OCR・給与全工程・マスタ編集・ログイン。保持期間 10 年。

### 17.3 エラー処理方針

3 段階：
1. ユーザー入力ミス: インラインエラー
2. 外部サービス失敗: 「一時的な問題」表示 + 自動リトライ 3 回
3. 致命的: エラーページ + Sentry 送信 + 管理者通知

禁止: スタックトレース表示・英語エラーコード・SQL エラーそのまま。

### 17.4 バックアップ戦略

- Supabase Pro 自動バックアップ（PITR 7 日分）+ 月次手動フルバックアップ
- Google Drive: ゴミ箱 30 日リカバリ
- Git: 全コード管理

### 17.5 セキュリティ

| 情報 | 保管場所 | アクセス制御 |
|---|---|---|
| 給与明細 | `bud_salary_details` | RLS: 本人 + super_admin + 該当法人 admin |
| 振込先口座 | `bud_transfers` | RLS: Bud アクセス者全員閲覧可 |
| API キー | Supabase Secrets | 環境変数、ソースコード外 |
| パスワード | Supabase Auth | ハッシュのみ |
| 撮影画像 | Supabase Storage | バケット別 RLS |

### 17.6 パフォーマンス対策

- マテリアライズドビュー（Phase 5）
- 仮想スクロール（大量データ）
- 画像リサイズ版生成（300px サムネイル）
- 遅延読込

### 17.7 開発環境

必要な環境変数：

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
GOOGLE_DRIVE_SERVICE_ACCOUNT=（JSON キー）
GOOGLE_DRIVE_ARCHIVE_FOLDER_ID=
```

スマホ撮影開発: `m1_server.py` + 自己署名証明書流用。

---

## 18. 実装ロードマップ

### 18.1 Phase 着手前提条件

| Phase | 前提 |
|---|---|
| 1a | Phase 0 完了 |
| 1b | Phase 1a 完了、bud_transfers の拡張 SQL 適用 |
| 1c | Phase 1b 完了 |
| 2a | root_bank_accounts に全口座情報 seed、銀行 CSV サンプル入手 |
| 2b | Phase 2a 完了 |
| 2c | 1_共通マスタ_v12.xlsx の Excel 解析 |
| 3 | Phase 1b + 2a 完了、1 ヶ月分以上のデータ |
| 4a | Phase 2c 完了 |
| 4b | Anthropic API キー、Google Drive サービスアカウント、m1-ocr-test の自己署名証明書 |
| 4c | 川中さんの root_employees 登録、FM エクスポート CSV |
| 5 | Phase 1〜4 完了、過去データ登録済 |
| 6 | 手渡し現金対象者の確定、MF クラウド給与 CSV サンプル、KoT API 状況確認、Root カラム追加 |

### 18.2 マイルストーン

| マイルストーン | 完了時点 | 経過日数（累計、見積）|
|---|---|---:|
| 業務フロー CSV 出力可能化 | Phase 1a 完了 | 0.5d |
| 振込管理 Bud 化完了 | Phase 1c 完了 | 3.7d |
| 銀行・CC 明細取込完了 | Phase 2c 完了 | 6.15d |
| 入出金照合可視化完了 | Phase 3 完了 | 8.15d |
| OCR + レシート Bud 化完了 | Phase 4c 完了 | 14.55d |
| コストダッシュボード公開 | Phase 5 完了 | 16.05d |
| 給与処理 Bud 化完了 | Phase 6 完了 | **20.35d**（Bud 全体）|

---

## 19. 未決事項

| # | 項目 | 要決定時期 |
|---|---|---|
| 1 | 手渡し現金対象者の**実名・法人・金額・頻度** | Phase 6 着手前 |
| 2 | KoT API 連携の現状（有効 or CSV 連携フォールバック）| Phase 6 着手前 |
| 3 | MF クラウド給与のエクスポート・インポート CSV **詳細フォーマット**（テンプレート取得済、実装時に微調整）| Phase 6 実装時 |
| 4 | 検討中振込予定日超過の通知強化（D 案：Chatwork + 自動却下）| 運用 3 ヶ月後 |
| 5 | 京都銀行の送金実装（現状枠のみ）| 京都銀行から送金が必要になったとき |
| 6 | 責任者ロール（manager）による振込承認への拡張（現状 admin 以上）| 運用判断で変更可能 |
| 7 | `root_salary_systems` 給与体系マスタの実装状況 | Phase 6 着手前 |
| 8 | Anthropic Team Premium プランに API クレジットが含まれるか（Anthropic Console で確認）| Phase 4b 実装時 |

---

## 20. 付録

### 20.1 参照資料

| 資料 | 場所 |
|---|---|
| v1 設計書 | Gdrive `007_Garden Bud/Garden-Bud_設計書_20260416.md`（保管のみ）|
| 未決事項まとめ | Gdrive `007_Garden Bud/未決事項_20260419.md`（保管のみ）|
| Kintone 振込実行フィールド | Gdrive `015_Gardenシリーズ/05_Garden-Bud/振込実行_20260422T183313+0900.csv`（87 列）|
| Kintone 振込実行一覧画面 | Gdrive `.../振込実行_一覧画面.pdf`（64 件サンプル）|
| Kintone 振込実行詳細画面 | Gdrive `.../振込実行_詳細画面.pdf` |
| MF クラウド給与 CSV テンプレート | Downloads `支給_控除_勤怠_2026年05月31日支給.csv`（72 列）|
| FM レシート入力データ | Downloads `領収書-20260422.xlsx`（872 行、22 列）|
| コスト ワンビュー xlsx | Gdrive `.../グループ6社 年間コスト ワンビュー_20260422.xlsx`（72 行）|
| 既存仕訳帳システム | Gdrive `001_仕訳帳/`（Python 9 ファイル + v12 マスタ）|
| 共通マスタ v12 | Gdrive `001_仕訳帳/1_共通マスタ_v12.xlsx`（441 行）|
| 口座設定 Python | Gdrive `001_仕訳帳/3_口座設定.py`（6 法人 × 4 銀行）|

### 20.2 用語集

| 用語 | 意味 |
|---|---|
| GBU | Garden-Bud の 3 桁プレフィックス（Garden 全体 ID 規則 `GXX0000001` の Bud 版）|
| KR | 旧 FileMaker レシート入力の ID 形式（`KR00010451`、移行時に legacy として保持）|
| FK- | 通常振込 ID の接頭辞（Kintone 既存運用継承、`FK-YYYYMMDD-NNNNNN`）|
| CB- | キャッシュバック振込 ID の接頭辞（`CB-YYYYMMDD-G-NNN`）|
| MF | マネーフォワードクラウド給与（給与計算外部サービス、Bud と CSV 連携）|
| 全銀協フォーマット | 銀行の総合振込用 CSV 規格、120 byte 固定長、Shift-JIS |
| 二重チェック | Kintone 用語、Bud では「確認済み」ステータスに対応 |
| 手渡し現金 | 銀行振込しない現金支給の給与、約 10 名対象、MF には含まれず Bud で独立管理 |
| 社内立替 | 依頼会社 ≠ 実行会社 の振込、短期貸付金で会計処理 |

### 20.3 見積変遷（参考）

effort-tracking.md 参照。

---

## 21. 承認・レビュー

| 役割 | 担当 | 確認事項 |
|---|---|---|
| プロジェクト責任者 | 東海林さん | 業務フロー・未決事項・Phase 順序 |
| Garden 共通ルール | 槙さん | b-main/main への CLAUDE.md 反映（一部項目）|
| 実装 | 東海林 A/B セッション（Claude Code）| Phase 別 plan 作成 → 実装 → レビュー |

本設計書をベースに、Phase 1a から順次 `writing-plans` で実装プランを作成し、subagent-driven-development で実装していく。
