# Kintone → Garden 移行マッピング分析（法人名簿 + 求人 + 面接ヒアリング）

- 作成: 2026-04-26 / a-main
- 対象: 3 つの Kintone アプリ計 193 フィールド + 6 SUBTABLE
- 元データ: API 経由で fetch、構造のみ抽出（個人情報・実値はチャット非出力）
- 関連: PR #52（関電業務委託 + SIM 在庫 + 取引先名簿、3 アプリ 140 フィールド）

---

## 1. 対象アプリ概要

| App ID | Kintone アプリ名 | フィールド数 | Garden 移行先 |
|---|---|---|---|
| **28** | 法人名簿 ヒュアラングループ | 61 + SUBTABLE 5 | Garden **Fruit**（法人法的実体情報） |
| **44** | 求人 応募者一覧 | 84 + SUBTABLE 1 | Garden **Sprout**（仮）応募者管理 |
| **45** | 求人 面接ヒアリングシート | 48 + SUBTABLE 1 | Garden **Sprout**（仮）面接管理 |

---

## 2. App 28 法人名簿 → Garden Fruit（61 fields）

### 2.1 業務的な意味づけ

**6 法人の公的・法的・運用情報**を一元管理する master。Garden Fruit が引き継ぐ全データ。

### 2.2 フィールド分類（業務ドメイン別）

#### 2.2.1 識別系（必須）

| Kintone | 型 | 必須 | Garden Fruit |
|---|---|---|---|
| 法人名 | text | 🔴 REQ + UNIQ | `fruit_companies_legal.name` (PK 候補) |
| 法人名カナ | text | 🔴 REQ + UNIQ | `fruit_companies_legal.name_kana` |
| 法人番号 | text | — | `fruit_companies_legal.corporate_number` |
| ドメイン | text | — | `fruit_companies_legal.domain` |
| 産業分類番号 | text | — | `fruit_companies_legal.industry_classification` |

#### 2.2.2 公的・税務・行政番号系（⭐ Fruit の核心）

| Kintone | 型 | Garden Fruit |
|---|---|---|
| インボイス登録番号 | text | `fruit_companies_legal.invoice_number` |
| 電気通信事業届出番号 | text | `fruit_company_licenses.telecom_business_number` |
| 代理店届出番号 | text | `fruit_company_licenses.agent_registration_number` |
| 雇用保険事業所番号 | text | `fruit_company_insurances.employment_insurance_number` |
| 労働保険番号 | text | `fruit_company_insurances.labor_insurance_number` |
| 管轄税務署 | text | `fruit_companies_legal.tax_office` |

→ **Garden Fruit が「法人法的実体」モジュールたる所以**。Sprout / Bud / Forest / Root から共通参照。

#### 2.2.3 代表者情報

| Kintone | 必須 | Garden Fruit |
|---|---|---|
| 代表者名 | 🔴 REQ | `fruit_company_representatives.name` |
| 代表者名カナ | 🔴 REQ | `fruit_company_representatives.name_kana` |
| 代表者性別 | 🔴 REQ | `fruit_company_representatives.gender` |
| 代表者生年月日 | 🔴 REQ | `fruit_company_representatives.birth_date` |
| 代表者郵便番号 | 🔴 REQ | `fruit_company_representatives.postal_code` |
| 代表者住所 | 🔴 REQ | `fruit_company_representatives.address` |
| 代表者携帯番号 | 🔴 REQ | `fruit_company_representatives.mobile_phone` |
| 設立年月日 | 🔴 REQ | `fruit_companies_legal.established_date` |

#### 2.2.4 法人連絡先

| Kintone | 必須 | Garden Fruit |
|---|---|---|
| 会社郵便番号 | 🔴 REQ | `fruit_companies_legal.postal_code` |
| 会社住所 | 🔴 REQ | `fruit_companies_legal.address` |
| 会社住所カナ | — | `fruit_companies_legal.address_kana` |
| 会社住所address | — | （重複、要整理） |
| 法人電話番号 | 🔴 REQ | `fruit_companies_legal.phone` |
| 法人FAX番号 | — | `fruit_companies_legal.fax` |
| 決算月 | 🔴 REQ | `fruit_companies_legal.fiscal_month`（Forest fiscal_periods と連携） |

#### 2.2.5 担当者情報（社内連絡担当）

| Kintone | Garden Fruit |
|---|---|
| 担当者名 1 / 2 | `fruit_company_contacts.name`（複数行） |
| 担当者名カナ 1 / 2 | `fruit_company_contacts.name_kana` |
| 担当者電話番号 1 / 2 | `fruit_company_contacts.phone` |
| 担当者アドレス 1 / 2 | `fruit_company_contacts.email_link` |
| 経理アドレス | `fruit_company_contacts.accounting_email` |

→ **複数担当者を表現する場合は別テーブル化**（Kintone は 2 つ固定だが、Garden では fruit_company_contacts で N 対 1）。

#### 2.2.6 公的書類リンク

| Kintone | 型 | Garden Fruit |
|---|---|---|
| 登記簿 | LINK | `fruit_company_documents.registry_url`（Storage パス推奨） |
| 印鑑証明 | LINK | `fruit_company_documents.seal_certificate_url` |
| 定款 | LINK | `fruit_company_documents.articles_of_incorporation_url` |
| 法人番号指定通知書 | LINK | `fruit_company_documents.corporate_number_notice_url` |
| 決算書 | LINK | `fruit_company_documents.financial_statement_url`（Forest 決算書一覧との連携） |
| 代表者情報 | LINK | `fruit_company_representatives.documents_url` |
| 会社HP | LINK | `fruit_companies_legal.website_url` |

→ 移行時は LINK（Google Drive 等）→ Supabase Storage に **コピー保存**推奨（恒久的なバージョン管理のため）。

#### 2.2.7 サブテーブル 5 種

| Kintone SUBTABLE | フィールド数 | Garden Fruit テーブル |
|---|---|---|
| 契約物件 | 10 | `fruit_company_contracts`（type='property'） |
| 契約車 | 12 | `fruit_company_contracts`（type='vehicle'） |
| 法人履歴 | 3 | `fruit_company_history` |
| 金融機関情報 | 11 | `fruit_company_banks` |
| サブスク | 12 | `fruit_company_contracts`（type='subscription'） |

→ **契約物件 / 契約車 / サブスク は 1 つの `fruit_company_contracts` テーブルに統合**（type 列で区別）が効率的。

##### サブテーブル詳細：契約物件（10 fields）
- 物件名 / 郵便番号 / 住所 / 契約日 / 解約日 / 月額料金 / 状況 / 契約書 LINK / 入力日時 / 入力者

##### サブテーブル詳細：契約車（12 fields）
- 車種 / ナンバープレート / 色 / 所有者 / 契約日 / 解約日 / ローン完済日 / 月額料金 / 状況 / 契約書 LINK / 入力日時 / 入力者

##### サブテーブル詳細：法人履歴（3 fields）
- 詳細（multi-line text）/ 入力日時 / 入力者
→ 商号変更 / 移転 / 代表者交代 等の歴史

##### サブテーブル詳細：金融機関情報（11 fields）
- 銀行名 / 支店名 / 金融機関コード / 支店コード / 口座種別 / 口座名義 / 口座番号 / IDPASS情報 LINK / 状況 / 入力日時 / 入力者

##### サブテーブル詳細：サブスク（12 fields）
- サブスク名 / 月額料金 / 契約日 / 解約日 / 有効期限 / 支払方法 / 支払日 / 登録情報 / 状況 / 備考 / 入力日時 / 入力者

#### 2.2.8 メタデータ

| Kintone | Garden 標準 |
|---|---|
| カテゴリー | （Garden では status enum で管理） |
| ステータス | `status` 列（active / inactive / archived） |
| 優先順位 | `display_order` |
| レコード番号 | （Garden では UUID） |
| 作成日時 / 作成者 | `created_at` / `created_by` |
| 更新日時 / 更新者 | `updated_at` / `updated_by` |

#### 2.2.9 Reference Tables（Kintone 内部参照）

| Kintone | 内容 | Garden 実装 |
|---|---|---|
| 決算書一覧 | Forest 決算書から自動参照 | Garden では JOIN で動的取得 |
| 保有アドレス一覧 | 担当者アドレスから自動参照 | Garden では view または application code で結合 |
| 関連レコード一覧 | 自由参照 | Garden では別途設計 |

---

## 3. App 44 求人 応募者一覧 → Garden Sprout（84 fields）

### 3.1 業務的な意味づけ

**バイトル / その他経路から流入する応募者**の登録・進捗管理。Garden Sprout の中核。

### 3.2 フィールド分類

#### 3.2.1 識別系

| Kintone | 必須 | Garden Sprout |
|---|---|---|
| レコード番号 | — | `sprout_applicants.id` (UUID) |
| 問合せNo | — | `sprout_applicants.inquiry_number`（バイトル等の外部 ID） |

#### 3.2.2 個人情報（応募者本人）

| Kintone | 必須 | Garden Sprout |
|---|---|---|
| 従業員名_姓 | 🔴 REQ | `sprout_applicants.last_name` |
| 従業員名_名 | 🔴 REQ | `sprout_applicants.first_name` |
| 従業員名_姓カナ | — | `sprout_applicants.last_name_kana` |
| 従業員名_名カナ | — | `sprout_applicants.first_name_kana` |
| 従業員名_姓名 | — | （計算列、Garden では自動結合） |
| 従業員名_姓名カナ | — | （同上） |
| 氏名（漢字） | — | （重複、整理対象） |
| 氏名（ふりがな） | — | （重複、整理対象） |
| 性別 | 🔴 REQ | `sprout_applicants.gender` |
| 年代 | 🔴 REQ | `sprout_applicants.age_range` |
| 生年月日 | — | `sprout_applicants.birth_date` |
| ◇生年月日 | 🔴 REQ | （重複、整理対象） |
| ◇年齢自動計算 | — | （計算列） |
| ◆年齢自動計算 | — | （計算列、重複） |

→ 同じ意味のフィールドが複数（◇ vs ◆ など）あり、**Garden 移行時に整理必要**。

#### 3.2.3 連絡先

| Kintone | 必須 | Garden Sprout |
|---|---|---|
| メールアドレス | 🔴 REQ | `sprout_applicants.email` |
| メールアドレス（PC） | — | `sprout_applicants.email_pc` |
| メールアドレス（携帯） | — | `sprout_applicants.email_mobile` |
| 電話番号 | — | `sprout_applicants.phone` |
| 連絡先_ハイフンなし | 🔴 REQ | `sprout_applicants.phone_normalized` |
| そのほかの電話番号 | — | `sprout_applicants.alternative_phone` |
| 連絡先 | — | （重複） |

#### 3.2.4 住所

| Kintone | Garden Sprout |
|---|---|
| 郵便番号 / 郵便番号コード | `sprout_applicants.postal_code` |
| 都道府県名 / 住所_都道府県 | `sprout_applicants.prefecture` |
| 市区町村名 / 住所_市町村 | `sprout_applicants.city` |
| 住所_町域 | `sprout_applicants.address_line_1` |
| 住所_建物名 / 住所_部屋番号 | `sprout_applicants.address_line_2` |
| 住所合体 | （計算列） |
| 住所（その他） | `sprout_applicants.address_other` |

→ **住所フィールドがフラグメント化** している（Kintone のフォーム構造由来）。Garden では正規化・統合。

#### 3.2.5 学歴・職歴

| Kintone | Garden Sprout |
|---|---|
| 最終学歴 | `sprout_applicants.education_level` |
| 最終学歴学校名 | `sprout_applicants.school_name` |
| 最終職歴 | `sprout_applicants.last_employment_type` |
| 最終職歴会社名 | `sprout_applicants.last_company_name` |
| 現在の職業 | `sprout_applicants.current_occupation` |

#### 3.2.6 応募・面接情報

| Kintone | 必須 | Garden Sprout |
|---|---|---|
| 状況 | 🔴 REQ | `sprout_applicants.status`（applied / interview_scheduled / interviewed / offered / hired / rejected / withdrawn） |
| 応募日 | 🔴 REQ | `sprout_applicants.applied_at` |
| 応募日時 | — | `sprout_applicants.applied_at_detail` |
| フォーム送信日 | — | `sprout_applicants.form_submitted_at` |
| 応募方法 | — (CHECK_BOX) | `sprout_applicants.application_method[]`（マルチ） |
| 希望面接方法 | — (CHECK_BOX) | `sprout_applicants.preferred_interview_method[]` |
| 面接方法 | — | `sprout_applicants.actual_interview_method` |
| Web面接URL | — (LINK) | `sprout_applicants.web_interview_url` |
| 面接希望日時 1/2/3 | — | `sprout_applicants.preferred_interview_at[]` |
| 面接予定日時 | — | `sprout_interview_reservations.scheduled_at` |
| 面接日 | — | `sprout_interview_records.interview_date` |
| 研修予定日時 | — | `sprout_offers.training_scheduled_at` |
| 研修日 | — | `sprout_offers.training_date` |

#### 3.2.7 勤務希望

| Kintone | Garden Sprout |
|---|---|
| 勤務可能曜日 | `sprout_applicants.available_days[]` |
| 勤務可能期間 | `sprout_applicants.available_period` |
| 出勤希望時間帯 | `sprout_applicants.preferred_start_time` |
| 退勤希望時間帯 | `sprout_applicants.preferred_end_time` |
| 働き方 | `sprout_applicants.work_style[]` |
| 初出勤日希望 | `sprout_applicants.preferred_start_date[]` |

#### 3.2.8 給与・待遇

| Kintone | Garden Sprout |
|---|---|
| 希望給与 | `sprout_applicants.desired_salary` |
| 時給（2 つ） | `sprout_offers.hourly_wage`（重複、整理対象） |
| 時間 | `sprout_offers.estimated_hours` |
| 週 | `sprout_offers.weekly_days` |
| 月 | `sprout_offers.monthly_estimate` |
| 給与目安（CALC） | （計算列） |

#### 3.2.9 入社情報

| Kintone | Garden Sprout |
|---|---|
| 入社日 | `sprout_offers.scheduled_employment_date` |

#### 3.2.10 その他

| Kintone | Garden Sprout |
|---|---|
| 理由 1 / 2 (CHECK_BOX) | `sprout_applicants.application_reasons[]` |
| その他連絡事項 (multi-line) | `sprout_applicants.notes` |
| コールセンター経験 (CHECK_BOX) | `sprout_applicants.call_center_experience[]` |
| ルックアップ | （Kintone 専用、移行不要） |

#### 3.2.11 サブテーブル：求人の記録（5 fields）

| Kintone | Garden Sprout |
|---|---|
| 日付 / 時刻 | `sprout_applicant_logs.event_at` |
| 結果 | `sprout_applicant_logs.outcome` |
| 内容詳細 | `sprout_applicant_logs.notes` |
| 入力者 | `sprout_applicant_logs.recorded_by` |

→ **応募者ごとの履歴ログ**。Garden では `sprout_applicant_logs` テーブルで管理。

---

## 4. App 45 面接ヒアリングシート → Garden Sprout（48 fields）

### 4.1 業務的な意味づけ

**応募者が面接前に入力するヒアリングシート**。じぶんフォーム経由で応募者本人が記入。

### 4.2 主要フィールド

App 44 と重複するフィールド多数（応募者本人入力と人事側転記の二重管理）。Garden では **App 44 と統合してデータベース正規化**推奨。

#### 4.2.1 ヒアリング固有フィールド

| Kintone | Garden Sprout |
|---|---|
| メールアドレス | `sprout_interview_sheets.email` |
| 文字列 (1行) | （詳細不明、移行時要確認） |

#### 4.2.2 重複フィールド（App 44 と同一）

| カテゴリ | 共通フィールド数 |
|---|---|
| 個人情報 | 約 8 |
| 連絡先 | 約 5 |
| 住所 | 約 6 |
| 学歴・職歴 | 約 4 |
| 勤務希望 | 約 5 |
| 応募方法・面接方法 | 約 4 |
| 面接希望日時 | 3 |

→ App 44 / 45 で **同じデータが二重管理されてる**可能性大。Garden 移行時は **App 44 をマスタに統合**し、App 45 は「応募者が自分で入力した内容」として `sprout_interview_sheets` 側に残し、admin が App 44 で確定値を保持する設計推奨。

#### 4.2.3 サブテーブル：配属・異動（4 fields）

| Kintone | Garden Sprout |
|---|---|
| 日付 | `sprout_assignment_logs.event_at` |
| 結果 | `sprout_assignment_logs.outcome` |
| 内容詳細 | `sprout_assignment_logs.notes` |
| 入力者 | `sprout_assignment_logs.recorded_by` |

→ **配属・異動の履歴**。応募者 → 入社 → 配属 → 異動 の追跡。

---

## 5. 移行時の主要設計判断

### 5.1 重複フィールドの整理

**App 44 + 45 の重複フィールド** は Garden では 1 ヶ所に統合：

```
sprout_applicants（応募者本人マスタ、確定情報）
  + sprout_interview_sheets（応募者がじぶんフォームで入力した申告内容、確認用に保持）
```

→ admin が `sprout_applicants` を更新する際、`sprout_interview_sheets` の入力内容と照合する UI を提供。

### 5.2 Subtable の分離・統合判断

| Kintone SUBTABLE | Garden 設計推奨 |
|---|---|
| 契約物件 / 契約車 / サブスク | **1 テーブル `fruit_company_contracts` に統合**（type 列で区別） |
| 法人履歴 | 独立テーブル `fruit_company_history` |
| 金融機関情報 | 独立テーブル `fruit_company_banks` |
| 求人の記録 | 独立テーブル `sprout_applicant_logs` |
| 配属・異動 | 独立テーブル `sprout_assignment_logs`（または `root_employment_history` と統合） |

### 5.3 LINK 系の取り扱い

Kintone LINK フィールド（Google Drive URL 等）は Garden では：

| 案 | 動作 | 推奨 |
|---|---|---|
| A | URL をそのまま保存 | 🟡 簡単だが Drive 依存継続 |
| B | **Storage コピー + URL も保持** | 🥇 推奨（恒久性 + 既存運用との互換性） |
| C | Storage 完全移行、URL 削除 | 🥈 最終形（Phase B 終了時） |

→ **B 案で Phase B 開始、Phase C で C 案に移行**が妥当。

### 5.4 ENUM・dropdown の値定義

Kintone DROP_DOWN / CHECK_BOX の選択肢は Garden では：

- 共通利用される選択肢 → `root_settings` で項目別 enum 定義（admin 編集可）
- アプリ固有の選択肢 → table 列の CHECK 制約 or enum 型

例：
- 性別 / 都道府県 / 学歴レベル → root_settings
- 応募者ステータス（applied / interviewed / etc.）→ table CHECK

### 5.5 複数担当者の正規化

App 28 で「担当者名 1 / 2」の固定 2 個 → Garden では `fruit_company_contacts` の N 対 1 で柔軟化。

---

## 6. 判断保留・確認事項

### 6.1 東海林さんに確認したい

| # | 項目 | 確認内容 |
|---|---|---|
| 1 | App 44 / 45 の重複データはどう管理されてる？ | Kintone でどちらがマスタ？admin 入力 vs 本人入力の管理方法？ |
| 2 | 「◇生年月日」と「生年月日」の違い | 必須にしてる側が確定値？ |
| 3 | 「◇年齢自動計算」と「◆年齢自動計算」の違い | 計算ロジック差異？片方廃止可？ |
| 4 | 法人名簿のサブテーブル「契約物件 / 契約車 / サブスク」を 1 テーブル統合 OK？ | 業務観点で type 列で区別が現実的か |
| 5 | App 28 の LINK 系（登記簿 / 定款 / 印鑑証明）の保管場所 | Google Drive 全部統合？個別管理？ |
| 6 | App 44 の「Web面接URL」運用 | Zoom / Teams / Google Meet どれ？固定 URL or 都度発行？ |
| 7 | 「ルックアップ」フィールド（App 44） | 何を参照？移行時に必要？ |
| 8 | App 45 「文字列 (1行)」 | フィールド名から内容不明、ラベル変更必要？ |
| 9 | App 28「会社住所カナ」「会社住所address」の重複 | 整理可能？ |
| 10 | サブテーブル「配属・異動」（App 45） | 採用後の異動も Sprout で管理？ Root に渡す？ |

### 6.2 Phase B 実装着手前の合意事項

| # | 項目 | 推奨 |
|---|---|---|
| 1 | Sprout の master テーブル候補は `sprout_applicants` 単一でいくか | 推奨：単一 + `sprout_interview_sheets` を補助 |
| 2 | App 44 / 45 のデータ取込タイミング | 推奨：応募時 → App 44 自動取込、ヒアリング送信時 → App 45 自動取込 |
| 3 | LINK 系の Storage 保存タイミング | 推奨：応募者登録時に async copy job |
| 4 | サブテーブル統合の合意（fruit_company_contracts） | 推奨：type 列で統合 |
| 5 | enum 値の root_settings 化範囲 | 推奨：性別 / 都道府県 / 学歴 / 職歴種別 |

---

## 7. 移行戦略（Phase B 実装時）

### 7.1 移行手順

```
Phase B-1: Garden Fruit / Sprout テーブル作成（migration）
  ↓
Phase B-2: Kintone API による初回 bulk import
  - App 28: 6 法人レコード（少量）
  - App 44: 応募者全件（数十〜数百？）
  - App 45: ヒアリング全件
  ↓
Phase B-3: 並行運用期間（1-2 週間）
  - Kintone と Garden 両方に書込（dual-write）
  - 整合性検証
  ↓
Phase B-4: Kintone → Garden 一方向同期（Garden が master）
  - Kintone は読み取り専用化
  - Garden 経由で Kintone に同期する一時バックアップ
  ↓
Phase C: Kintone 廃止
  - 既存運用が完全に Garden に移行
  - Kintone API トークンも順次無効化
```

### 7.2 既存データの保管期間

| データ種別 | 保管期間 |
|---|---|
| 法人名簿 (App 28) | 永続（master データ） |
| 応募者 (App 44) | 採用 7 年保存（個情法・労働法） / 不採用 1 年（個情法） |
| ヒアリング (App 45) | 同上 |
| 履歴系サブテーブル | 法令準拠 |

→ **不採用者の自動削除 cron** 必須（Phase C で実装）。

### 7.3 切替時の運用注意

- 切替日を明確に通告（社内 + 応募者）
- バイトル等の外部経路は **Garden Sprout 直接受け** に切替
- 公式 LINE Bot（ヒュアラン_info）が **Sprout API に直結**するよう更新
- Kintone じぶんフォームの URL を Sprout 受付 URL にリダイレクト or 廃止

---

## 8. 関連ドキュメント

- spec `docs/specs/2026-04-25-kintone-kanden-integration-analysis.md` — Kintone App 55 / 104 / 38 解析（PR #52）
- spec `docs/specs/2026-04-25-garden-sprout-onboarding-redesign.md` — Sprout v0.2（PR #76 merged）
- memory `project_garden_fruit_module.md` — Fruit 実体化
- memory `project_kintone_tokens_storage.md` — Kintone トークン保存場所
- memory `project_garden_change_request_pattern.md` — 申請承認パターン
- a-auto Batch 18 spec 群 — Sprout / Fruit / Calendar 詳細 spec（ローカル commit、push 待ち）

---

## 9. 改訂履歴

| 版 | 日付 | 主な変更 |
|---|---|---|
| v0.1 | 2026-04-26 | 初版起草（App 28 / 44 / 45 全 193 フィールド + 6 SUBTABLE 解析） |

---

## 10. Kintone 解析全体マップ（PR #52 + 本 PR）

| App ID | アプリ名 | フィールド数 | 解析 PR | 移行先 |
|---|---|---|---|---|
| 55 | 関西電力リスト一覧 | 74 | PR #52 ✅ | Garden Leaf 関電 |
| 104 | 在庫管理 関電 SIM | 25 | PR #52 ✅ | Garden Seed / Leaf 拡張 |
| 38 | 事業部登録名簿 1 営業 | 41 | PR #52 ✅ | Garden Root + 外注 |
| **28** | **法人名簿** | **61 + 5 SUBTABLE** | **本 PR** | **Garden Fruit** |
| **44** | **求人 応募者一覧** | **84 + 1 SUBTABLE** | **本 PR** | **Garden Sprout** |
| **45** | **求人 面接ヒアリング** | **48 + 1 SUBTABLE** | **本 PR** | **Garden Sprout** |
| **計** | | **333 + 7 SUBTABLE** | | |

→ **Kintone 6 アプリ全解析完了**。Garden 各モジュールへの移行マッピング基盤が整いました。

---

— Kintone → Garden 移行マッピング分析（法人名簿 + 求人 + 面接ヒアリング）v0.1 —
