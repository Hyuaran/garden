# Fruit F-02: Kintone App 28（法人名簿）→ Fruit テーブルマッピング詳細

- 対象: Kintone 法人名簿（App 28、61 フィールド推定）から Fruit 8 テーブルへのフィールド対応・変換ルール
- 優先度: 🔴
- 見積: **0.75d**
- 担当セッション: a-fruit（実装）/ a-root（連携）/ a-bloom（レビュー）
- 作成: 2026-04-26（a-auto 006 / Batch 18 Fruit F-02）
- 前提:
  - **Sprout v0.2 spec §13**（Fruit 連携、PR #76）
  - **F-01 Migration**（テーブル定義）
  - **Cross History #04** 削除パターン統一規格
  - 関連: F-03（取込スクリプト）、F-04（共通セレクター）

---

## 1. 目的とスコープ

### 1.1 目的
既存運用中の Kintone App 28（法人名簿）に蓄積された 6 法人分の法人法的情報を Fruit テーブルへ正確にマッピングし、F-03 で実装する取込スクリプトの仕様根拠とする。フィールド対応・型変換・正規化ルールを明示する。

### 1.2 含めるもの
- Kintone App 28 の 61 フィールド推定構造とフィールドコード一覧
- 各フィールド → Fruit テーブル列の対応表
- 型変換・正規化ルール（zip 形式 / 電話番号 / 日付 / カナ / 法人番号 等）
- 1:N 展開（代表者・許認可・契約 等のサブテーブル化）
- 取込時のバリデーションルール

### 1.3 含めないもの
- 取込スクリプトの実装詳細（→ F-03）
- Kintone API 認証・cron 設計（→ F-03）
- UI（→ F-04）

---

## 2. 設計方針 / 前提

- **正規化原則**: Kintone のフラット構造（1 レコード = 1 法人、最大 61 フィールド）を Fruit の正規化スキーマ（1 法人 = 親 + 子テーブル N 件）に展開
- **冪等性**: 同一法人番号 / 同一 company_code を持つレコードは UPSERT
- **未取得値の扱い**: Kintone で空文字 → Fruit では NULL に変換（""/" " 不可）
- **必須フィールド最低限**: company_code / company_name のみ必須、それ以外は欠損許容
- **暗号化対象**: 銀行口座番号 / 機微な許認可番号は取込時に pgcrypto 適用
- **Kintone のサブテーブル**: テーブル形式フィールド（代表者・許認可・契約）はそのまま Fruit の子テーブルに展開
- **削除レコードの取扱**: Kintone 側で削除されたレコードは Fruit では論理削除（deleted_at セット、Cross History #04 準拠）

---

## 3. Kintone App 28 推定フィールド構造（61 フィールド）

### 3.1 法人基本情報（17 フィールド）→ fruit_companies_legal

| # | Kintone フィールドコード | フィールド名 | 型 | Fruit 列 | 変換 |
|---|---|---|---|---|---|
| 1 | company_code | 社内コード | SINGLE_LINE_TEXT | company_code | trim |
| 2 | corporate_number | 法人番号 | SINGLE_LINE_TEXT | corporate_number | 13 桁 char、ハイフン除去 |
| 3 | invoice_number | インボイス番号 | SINGLE_LINE_TEXT | invoice_number | 大文字化、`T` 始まり 14 桁検証 |
| 4 | company_name | 商号 | SINGLE_LINE_TEXT | company_name | trim |
| 5 | company_name_kana | 商号カナ | SINGLE_LINE_TEXT | company_name_kana | 全角カナ統一 |
| 6 | company_name_en | 英文商号 | SINGLE_LINE_TEXT | company_name_en | trim |
| 7 | corporate_form | 法人格 | DROP_DOWN | corporate_form | enum マッピング表参照 |
| 8 | established_at | 設立日 | DATE | established_at | YYYY-MM-DD |
| 9 | fiscal_month_end | 決算月 | NUMBER | fiscal_month_end | 1-12 検証 |
| 10 | capital_amount | 資本金 | NUMBER | capital_amount | 円単位、bigint |
| 11 | industry_code | 業種コード | SINGLE_LINE_TEXT | industry_code | trim |
| 12 | primary_business | 主要事業 | MULTI_LINE_TEXT | primary_business |  |
| 13 | employee_count | 従業員数 | NUMBER | employee_count |  |
| 14 | public_notice_method | 公告方法 | DROP_DOWN | public_notice_method |  |
| 15 | website_url | 公式サイト | LINK | website_url |  |
| 16 | shareholder_structure | 株主構成（リッチテキスト） | RICH_TEXT | shareholder_structure | jsonb 化、構造化困難なら raw 保持 |
| 17 | group_companies | グループ会社 | MULTI_SELECT | group_companies | jsonb 配列 |

### 3.2 所在地・連絡先（8 フィールド）→ fruit_companies_legal

| # | Kintone | フィールド名 | 型 | Fruit 列 | 変換 |
|---|---|---|---|---|---|
| 18 | zip_code | 郵便番号 | SINGLE_LINE_TEXT | zip_code | ハイフン除去、7 桁 |
| 19 | prefecture | 都道府県 | DROP_DOWN | prefecture |  |
| 20 | city | 市区町村 | SINGLE_LINE_TEXT | city |  |
| 21 | address1 | 番地 | SINGLE_LINE_TEXT | address1 |  |
| 22 | address2 | ビル名 | SINGLE_LINE_TEXT | address2 |  |
| 23 | phone | 電話 | SINGLE_LINE_TEXT | phone | ハイフン正規化 |
| 24 | fax | FAX | SINGLE_LINE_TEXT | fax |  |
| 25 | email | 代表メール | SINGLE_LINE_TEXT | email | 小文字化 |

### 3.3 代表者情報（8 フィールド、サブテーブル想定）→ fruit_representatives

| # | Kintone | フィールド名 | 型 | Fruit 列 |
|---|---|---|---|---|
| 26 | rep_table（サブテーブル） | 役員一覧 | SUBTABLE | fruit_representatives 複数行 |
| 26-1 | role_type | 役職 | DROP_DOWN | role_type（enum マッピング） |
| 26-2 | name | 氏名 | SINGLE_LINE_TEXT | name |
| 26-3 | name_kana | カナ | SINGLE_LINE_TEXT | name_kana |
| 26-4 | birth_date | 生年月日 | DATE | birth_date |
| 26-5 | appointed_at | 就任日 | DATE | appointed_at |
| 26-6 | retired_at | 退任日 | DATE | retired_at（NULL = 現任） |
| 26-7 | display_order | 並び順 | NUMBER | display_order |

### 3.4 取引銀行（10 フィールド、サブテーブル）→ fruit_banks

| # | Kintone | フィールド名 | 型 | Fruit 列 | 変換 |
|---|---|---|---|---|---|
| 27 | bank_table | 取引銀行一覧 | SUBTABLE | fruit_banks 複数行 |  |
| 27-1 | bank_role | 用途 | DROP_DOWN | bank_role | main/sub/payroll/receiving/tax |
| 27-2 | bank_code | 銀行コード | SINGLE_LINE_TEXT | bank_code | 4 桁 |
| 27-3 | bank_name | 銀行名 | SINGLE_LINE_TEXT | bank_name |  |
| 27-4 | branch_code | 支店コード | SINGLE_LINE_TEXT | branch_code | 3 桁 |
| 27-5 | branch_name | 支店名 | SINGLE_LINE_TEXT | branch_name |  |
| 27-6 | account_type | 口座種別 | DROP_DOWN | account_type | 普通/当座 |
| 27-7 | account_number | 口座番号 | SINGLE_LINE_TEXT | account_number_enc + _hint | pgcrypto 暗号化、hint=末尾4桁 |
| 27-8 | account_holder_kana | 口座名義カナ | SINGLE_LINE_TEXT | account_holder_kana | 全角カナ |
| 27-9 | invoice_payment_default | 振込元デフォルト | CHECK_BOX | invoice_payment_default | bool |

### 3.5 許認可（8 フィールド、サブテーブル）→ fruit_licenses

| # | Kintone | フィールド名 | 型 | Fruit 列 | 変換 |
|---|---|---|---|---|---|
| 28 | license_table | 許認可一覧 | SUBTABLE | fruit_licenses 複数行 |  |
| 28-1 | license_type | 種別 | DROP_DOWN | license_type | enum |
| 28-2 | license_number | 番号 | SINGLE_LINE_TEXT | license_number_enc + _hint | 機微なら暗号化、hint=末尾4桁 |
| 28-3 | issued_by | 発行機関 | SINGLE_LINE_TEXT | issued_by |  |
| 28-4 | issued_at | 取得日 | DATE | issued_at |  |
| 28-5 | valid_until | 更新期限 | DATE | valid_until |  |
| 28-6 | renewal_status | 状態 | DROP_DOWN | renewal_status |  |
| 28-7 | reminder_offset_days | リマインド日数 | NUMBER | reminder_offset_days | default 60 |
| 28-8 | meta_jsonb | 付帯情報 | MULTI_LINE_TEXT | metadata | json parse、失敗時 raw 保持 |

### 3.6 保険（6 フィールド、サブテーブル）→ fruit_insurances

| # | Kintone | フィールド | 型 | Fruit 列 |
|---|---|---|---|---|
| 29 | insurance_table | 保険一覧 | SUBTABLE | fruit_insurances |
| 29-1 | insurance_type | 種別 | DROP_DOWN | insurance_type |
| 29-2 | office_number | 事業所番号 | SINGLE_LINE_TEXT | office_number |
| 29-3 | coverage_start | 加入日 | DATE | coverage_start |
| 29-4 | coverage_end | 終了日 | DATE | coverage_end |
| 29-5 | insurer_name | 保険会社 | SINGLE_LINE_TEXT | insurer_name |
| 29-6 | premium_amount | 保険料 | NUMBER | premium_amount |

### 3.7 契約書（6 フィールド、サブテーブル）→ fruit_contracts

| # | Kintone | フィールド | 型 | Fruit 列 |
|---|---|---|---|---|
| 30 | contract_table | 契約書一覧 | SUBTABLE | fruit_contracts |
| 30-1 | contract_type | 種別 | DROP_DOWN | contract_type |
| 30-2 | counterparty_name | 相手先 | SINGLE_LINE_TEXT | counterparty_name |
| 30-3 | title | タイトル | SINGLE_LINE_TEXT | title |
| 30-4 | signed_at | 締結日 | DATE | signed_at |
| 30-5 | effective_until | 有効期限 | DATE | effective_until |
| 30-6 | storage_path | PDF | FILE | storage_path | Kintone ダウンロード URL → Supabase Storage |

### 3.8 添付書類（4 フィールド）→ fruit_documents

| # | Kintone | フィールド | 型 | Fruit 列 |
|---|---|---|---|---|
| 31 | doc_registry | 登記簿謄本 | FILE | fruit_documents (doc_type='registry_certificate') |
| 32 | doc_articles | 定款 | FILE | fruit_documents (doc_type='articles_of_incorporation') |
| 33 | doc_seal | 印鑑証明 | FILE | fruit_documents (doc_type='seal_certificate') |
| 34 | doc_other | その他 | FILE | fruit_documents (doc_type='other') |

---

## 4. 変換ルール詳細

### 4.1 法人番号正規化
```
input: "1234-5678-9012-3" or "1234567890123"
→ ハイフン除去 → CHECK_DIGIT 検証（モジュラス11） → char(13) で保存
不正値: import_errors テーブルに記録、当該レコードは parent のみ仮登録
```

### 4.2 インボイス番号
```
input: "T1234567890123" or "t1234567890123"
→ 大文字化 → ^T\d{13}$ 正規表現検証
→ 法人番号と一致しているか cross check（必須ではないが警告ログ）
```

### 4.3 電話番号
```
input: "03-1234-5678" / "(03)1234-5678" / "0312345678"
→ ハイフン・括弧除去 → "0312345678" 形式で保存
→ 国際形式は metadata に保持
```

### 4.4 enum マッピング表

**法人格** (Kintone DROP_DOWN → corporate_form_enum):

| Kintone 値 | Fruit enum |
|---|---|
| 株式会社 | kabushiki |
| 合同会社 | godo |
| 合名会社 | gomei |
| 合資会社 | goshi |
| 一般社団法人 | ippan_shadan |
| 一般財団法人 | ippan_zaidan |
| 公益社団法人 | koueki_shadan |
| 特定非営利活動法人 | tokutei_hieiri |
| 外国法人 | gaikoku |
| 個人事業主 | sole_proprietor |

**役員役職** (rep_role_enum):

| Kintone | Fruit |
|---|---|
| 代表取締役 | representative_director |
| 取締役 | director |
| 監査役 | auditor |
| 執行役員 | executive_officer |
| 支配人 | manager |
| 代表者 | representative |

（同様のマッピング表を license_type / insurance_type / contract_type / bank_role / account_type で定義）

### 4.5 サブテーブルの ID 同期
- Kintone サブテーブルの行 ID（$id）→ Fruit 子テーブルの metadata->>'kintone_row_id' に保存
- 次回取込時に同 ID があれば UPDATE、なければ INSERT、Fruit にあって Kintone にない → 論理削除

---

## 5. バリデーション

| バリデーション | レベル | 動作 |
|---|---|---|
| corporate_number 13 桁数字 | warning | 警告ログ、取込続行 |
| invoice_number `^T\d{13}$` | warning | 同上 |
| company_code 重複 | error | 取込停止、admin に通知 |
| corporate_number 重複 | error | 取込停止 |
| 必須欠損（company_name） | error | 該当行スキップ |
| enum 不正値 | warning | NULL 化、metadata に raw 保持 |
| 暗号化失敗 | error | 取込停止 |

---

## 6. 法令対応チェックリスト

- [ ] **会社法**: 商号・代表者・本店所在地が必須項目として網羅されている
- [ ] **インボイス制度**: invoice_number の 14 桁形式検証ルールが定義済
- [ ] **派遣法**: license_type='haken' の場合の必須付帯情報（派遣元責任者・営業所）が metadata に展開可能
- [ ] **個人情報保護法**: 代表者生年月日 / 銀行口座番号 / 機微許認可番号 が暗号化対象として明示
- [ ] **電子帳簿保存法**: fruit_documents 取込時の発行日・保存期限の保持

---

## 7. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | Kintone App 28 実フィールド調査（東海林さんと確認） | a-fruit | 0.20d |
| 2 | enum マッピング表確定（10 種類） | a-fruit | 0.10d |
| 3 | 変換ロジック仕様書化 | a-fruit | 0.20d |
| 4 | バリデーションルール定義 | a-fruit | 0.10d |
| 5 | レビュー反映 | a-bloom | 0.15d |

---

## 8. 判断保留事項

| # | 論点 | a-auto スタンス |
|---|---|---|
| F02-1 | Kintone App 28 の実フィールド数が 61 でない可能性（推定値） | F-03 着手前に東海林さん経由で実数確認 |
| F02-2 | サブテーブル形式採用の有無（Kintone は単純テキストで管理している可能性） | テキストの場合は別途パーサ仕様、F-03 で対応 |
| F02-3 | 株主構成の jsonb 構造化方針 | v0.1 は raw 保持、構造化は別 spec |
| F02-4 | Kintone 削除レコードの検知方法（cursor / diff） | F-03 で REST API の records_status 使用 |
| F02-5 | 添付ファイルの Storage 移動を取込時に同期するか別バッチか | 別バッチ推奨（取込トランザクションを軽くする） |

---

## 9. 既知のリスクと対策

- **フィールド数誤推定**: 61 は推定、実数差異あれば F-03 で吸収レイヤー
- **enum 値追加**: Kintone 側で新規追加されると取込失敗 → 警告ログで NULL 化、運用で確認
- **サブテーブル ID 不整合**: $id が変動する可能性は低いが、変動時は Fruit 側全削除→再投入で対処
- **電話番号フォーマット揺れ**: 想定外フォーマットは metadata->>'phone_raw' に保持

---

## 10. 関連ドキュメント

- F-01（Migration）/ F-03（取込スクリプト）/ F-04（セレクター）/ F-05（RLS）
- Sprout v0.2 spec §13

---

## 11. 受入基準（Definition of Done）

- [ ] Kintone App 28 の 61 フィールド対応表が完成
- [ ] enum マッピング表（10 種類）が完成
- [ ] 変換ルール（法人番号 / インボイス / 電話 / カナ）が文書化
- [ ] サブテーブル → Fruit 子テーブルの 1:N 展開ルールが明示
- [ ] 暗号化対象フィールド（口座番号 / 機微許認可番号）が特定
- [ ] バリデーションレベル（error / warning）が定義済
- [ ] レビュー（a-bloom）完了
