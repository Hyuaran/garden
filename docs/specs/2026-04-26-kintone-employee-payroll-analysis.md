# Kintone → Garden 移行マッピング分析（従業員 + 給与 + 決算 + 口座 + 交通費 + 経費）

- 作成: 2026-04-26 / a-main
- 対象: 6 つの Kintone アプリ計 **323 フィールド + 4 SUBTABLE**
- 元データ: API 経由で fetch、構造のみ抽出（個人情報・実値はチャット非出力）
- 関連:
  - PR #52（Kintone 関電 + SIM + 取引先名簿、3 アプリ 140 フィールド）
  - 本日先程の解析（法人名簿 + 求人 + 面接、3 アプリ 193 フィールド）

---

## 1. 対象アプリ概要

| App ID | Kintone アプリ名 | フィールド数 | Garden 移行先 |
|---|---|---|---|
| **56** | 従業員名簿 ヒュアラングループ | 105 + 4 SUBTABLE | Garden **Root**（root_employees 拡張） |
| **21** | 給与一覧 | 120 | Garden **Bud Phase D**（給与処理）+ MFC 給与連携 |
| **85** | 決算書 ヒュアラングループ | 28 | Garden **Forest** + **Fruit**（fruit_company_documents） |
| **92** | 口座一覧 | 26 | Garden **Sprout** + **Root**（じぶんフォーム後継） |
| **93** | 交通費一覧 | 18 | Garden **Sprout** + **Root**（じぶんフォーム後継） |
| **95** | 経費一覧 | 26 | Garden **Bud**（経費精算）+ **Leaf 関電** |

---

## 2. App 56 従業員名簿 → Garden Root（105 fields, 4 SUBTABLE）

### 2.1 業務的な意味づけ

**従業員の master データ、105 フィールドの巨大マスタ**。Garden では Root の `root_employees` がベース、追加情報は分離テーブルで設計済（A-3 系で migration 済の `kou_otsu` / `dependents_count` / `deleted_at` 等）。

### 2.2 主要フィールド分類

#### 2.2.1 個人識別系

| Kintone | 必須 | Garden Root |
|---|---|---|
| 従業員名_姓 / 名 / カナ | — | `root_employees.last_name` / `first_name` / `..._kana` |
| KOTID | UNIQ | `root_employees.kot_id` ✅ 既存 |
| 打刻ID | — | `root_employees.kot_id` (重複、整理対象) |
| APID（社員番号）| — | `root_employees.employee_number` ✅ 既存 |
| 新社員番号 | — | `root_employees.employee_number_new`（仕様変更履歴） |
| 雇用形態 | 🔴 REQ | `root_employees.employment_type` ✅ 既存 |
| 従業員ステータス | 🔴 REQ | `root_employees.status` |
| 入社日 | 🔴 REQ | `root_employees.hire_date` ✅ 既存 |
| 退職日 | — | `root_employees.termination_date` ✅ 既存 |
| 生年月日 | 🔴 REQ | `root_employees.birth_date` ✅ 既存 |
| 雇用保険番号 | — | `root_employees.employment_insurance_number` |
| 年金番号 | — | `root_employees.pension_number` |
| マイナンバー | — | `root_employees.my_number_encrypted`（pgcrypto 暗号化必須） |
| 年齢 | — | （計算列、生年月日から算出） |

#### 2.2.2 連絡先・住所

| Kintone | 必須 | Garden Root |
|---|---|---|
| メールアドレス | — | `root_employees.email` ✅ 既存 |
| 連絡先 / 連絡先_1〜3 / 連絡先_ハイフンなし | — | `root_employees.phone_primary` + `phone_others`（複数） |
| 郵便番号 | 🔴 REQ | `root_employees.postal_code` |
| 住所_都道府県 / 市町村 / 町域 / 建物名 / 部屋番号 | 一部 REQ | `root_employees.prefecture` / `city` / `address_*` |
| 住所合体 | — | （計算列） |

#### 2.2.3 配属・組織

| Kintone | 必須 | Garden Root |
|---|---|---|
| 事業名 | 🔴 REQ | `root_employees.business_unit_id` → `root_business_units` |
| 部署名 | 🔴 REQ | `root_employees.department_id` → `root_departments` |
| 所属 | — | （事業名 / 部署名で代替可） |
| 架電区分 | — | `root_employees.call_type`（toss / closer / cs 等の判定基準） |

#### 2.2.4 勤怠・KoT 連携

| Kintone | Garden Root |
|---|---|
| KOTID | `root_employees.kot_id` |
| KOTログインID(rなし)| `root_employees.kot_login_id_no_r` |
| testログインID | `root_employees.test_login_id`（テスト環境用？）|
| testID | `root_employees.test_id` |

→ KoT 連携は Garden Root Phase A-3 で実装済 (root_kot_sync_log 等)。

#### 2.2.5 給与関連

| Kintone | 必須 | Garden Root → Bud Phase D |
|---|---|---|
| 基準時給 | 🔴 REQ | `root_employees.base_hourly_wage` |
| 研修時給 | — | `root_employees.training_hourly_wage` |
| 研修上限 | — | `root_employees.training_hour_limit` |
| 種別_1 / 2 | — | `root_employees.salary_type_1` / `_2`（給与計算分類） |
| 雇用保険 | — | `root_employees.employment_insurance_status` |
| 社会保険 | — | `root_employees.social_insurance_status` |
| 年末調整 | — | `root_employees.year_end_adjustment_status` |
| 前払い希望 | — | `root_employees.early_payment_request` |
| 助成金進行状況 | — | `root_employees.subsidy_status` |

#### 2.2.6 銀行口座（2 口座対応）

| Kintone | Garden Root |
|---|---|
| 銀行名_1 / 2 | `root_employee_banks.bank_name`（複数行で正規化） |
| 金融機関コード_1 / 2 | `root_employee_banks.bank_code` |
| 支店名_1 / 2 | `root_employee_banks.branch_name` |
| 支店コード_1 / 2 | `root_employee_banks.branch_code` |
| 口座番号_1 / 2 | `root_employee_banks.account_number` |
| 口座名義_1 / 2 | `root_employee_banks.account_holder_name` |

→ Kintone は 2 口座固定だが Garden では **N 対 1 で正規化**（複数口座対応）。

#### 2.2.7 交通費

| Kintone | Garden Root |
|---|---|
| 最寄り駅 | `root_employee_commute.nearest_station` |
| 通勤経路 | `root_employee_commute.route` |
| 交通費 片道 | `root_employee_commute.one_way_amount` |
| 交通費 往復（CALC） | （計算列） |
| 交通費上限 | `root_employee_commute.monthly_limit` |
| 交通費支給 | `root_employee_commute.payment_method`（定期券 / 実費 / 定額） |

→ 別テーブル `root_employee_commute` で正規化推奨。

#### 2.2.8 雇用書類リンク

| Kintone | Garden Root |
|---|---|
| 02_雇用契約書フォルダ | 🔴 REQ - LINK | `root_employee_documents.contract_folder_url`（Storage 推奨） |
| 01_秘密保持データ | 🔴 REQ - text | `root_employee_documents.nda_data_id` |
| CW_APIトークン | — | `root_employees.chatwork_api_token`（pgcrypto 暗号化必須） |

#### 2.2.9 確認・チェック系

| Kintone | Garden Root |
|---|---|
| 初日確認事項 (CHECK_BOX) | `root_employees.first_day_checks[]` |
| 面談確認事項 (CHECK_BOX) | `root_employees.interview_checks[]` |
| 東海林チェック (CHECK_BOX) | `root_employees.shoji_checks[]`（admin 専用） |
| 面談担当者 | `root_employees.interview_assignee` |
| 面談予定日 | `root_employees.interview_scheduled_date` |
| 面談日 | `root_employees.interview_date` |

#### 2.2.10 メモ・備考

| Kintone | Garden Root |
|---|---|
| 東海林メモ | `root_employees.shoji_notes` |
| 面談者メモ | `root_employees.interviewer_notes` |
| ◆最終メモ | `root_employees.last_action_notes` |

#### 2.2.11 SUBTABLE 4 種

##### A. 配属・異動（4 fields）
- 日付 / 時刻 / 配属・異動内容 / 入力者
- → `root_employee_assignment_history`（Sprout 後継 spec の sprout_assignment_logs と統合検討）

##### B. 助成金・休業（9 fields）
- 期間（から / まで）/ 助成金 / 休業 / 詳細 / 正式名称 / 入力日 / 入力時刻 / 入力者
- → `root_employee_leave_history`（休業）+ `root_employee_subsidy_history`（助成金）

##### C. 在籍チーム（6 fields）
- 行番号 / 移動日 / 所属チーム名 / メモ / 入力日時 / 入力者
- → `root_employee_team_history`

##### D. 給与制度（固定給のみ）（12 fields）
- 期間（から / まで）/ 基本給 / 営業手当 / 役職手当 / 所定時間（から / まで）/ 雇用保険/社会保険 / 詳細 / 入力日 / 入力時刻 / 入力者
- → `root_employee_salary_plan_history`（固定給制度の履歴管理、Bud Phase D 連携）

#### 2.2.12 その他特殊フィールド

| Kintone | 注 |
|---|---|
| ●チーム名（DROP_DOWN）| 現在の所属チーム |
| ◆最終チーム名 | （履歴系の最終値計算） |
| ◆最終入力者 / 移動日 / 行番号 / 入力日時 / メモ | （SUBTABLE「在籍チーム」の最新値ピン留め） |

→ Kintone のサブテーブルから「最新値」を pin 留めする慣行。Garden では view または application code で結合。

---

## 3. App 21 給与一覧 → Garden Bud Phase D（120 fields, 0 SUBTABLE）⭐

### 3.1 業務的な意味づけ（東海林さん共有事項）

**現状**：
- 給与計算は **上田氏** が実施
- **宮永 / 小泉氏** が責任者として確認
- フィールド数 120 で複雑化、見通し悪い
- **MFC（マネーフォワードクラウド）給与にインポートできる形を前提**にもっとわかりやすくしたい意向あり

→ Garden 移行時は **Bud Phase D で再設計、MFC 給与互換 CSV 出力**を実装目標。

### 3.2 フィールド分類（120 fields）

#### 3.2.1 識別・ステータス

| Kintone | Garden Bud Phase D |
|---|---|
| 従業員名 / AP名 | `bud_payroll.employee_id` (root_employees 参照) |
| チーム名 | （root_employees.team_id 参照） |
| 打刻ID | （KoT 連携キー） |
| 期間 | `bud_payroll.period`（YYYY-MM 形式） |
| 開始日 / 終了日 | `bud_payroll.period_start` / `period_end` |
| 支給日 / 支給予定日 | `bud_payroll.payment_date` / `scheduled_payment_date` |
| 現ステータス / 次月ステータス | `bud_payroll.status_current` / `status_next_month` |
| 計算 (CHECK_BOX) | `bud_payroll.calculation_done` |
| 確認 (CHECK_BOX) | `bud_payroll.review_done`（責任者承認） |
| MF (CHECK_BOX) | `bud_payroll.mf_imported`（MFC インポート済） |
| 確認者から計算者へ | `bud_payroll.reviewer_to_calculator_notes` |

#### 3.2.2 時給・基本

| Kintone | Garden Bud |
|---|---|
| 現時給 | `bud_payroll.current_hourly_wage` |
| 確定時給 | `bud_payroll.confirmed_hourly_wage` |
| 査定時給(±) | `bud_payroll.adjustment_amount` |
| 次月時給 | `bud_payroll.next_month_hourly_wage` |
| 最低賃金 | `bud_payroll.minimum_wage_baseline` |
| 時給 1 / 2 / 3 / 4（CALC + NUMBER） | `bud_payroll.tier_*_wage`（時給階層、計算根拠） |
| 基準時給 / 基準時給(残時間) | `bud_payroll.base_hourly_wage` |

#### 3.2.3 勤怠時間

| Kintone | Garden Bud |
|---|---|
| 時間 | `bud_payroll.work_hours` |
| 研修時間 | `bud_payroll.training_hours` |
| 残業時間 | `bud_payroll.overtime_hours` |
| 残時間 (CALC) | `bud_payroll.remaining_hours` |
| 事務時間 | `bud_payroll.admin_hours` |
| 所定時間 | `bud_payroll.scheduled_hours` |
| 所定時間（平日）🔴 REQ | `bud_payroll.weekday_scheduled_hours` |
| 法定外時間（平日）| `bud_payroll.weekday_overtime_hours` |
| 所定外時間（平日）(CALC) | `bud_payroll.weekday_outside_hours` |
| 深夜所定時間（平日）| `bud_payroll.weekday_night_hours` |
| 総稼働時間 (CALC) | `bud_payroll.total_work_hours` |
| 出勤日数（平日）(CALC) | `bud_payroll.weekday_attendance_count` |
| 勤務日数 | `bud_payroll.work_days` |
| 有休取得日数 | `bud_payroll.paid_leave_days` |
| 時間効率 | `bud_payroll.time_efficiency`（KPI） |

#### 3.2.4 基本給・手当（多数）

| Kintone | Garden Bud |
|---|---|
| 基本給 / 1 / 2 / 3 (CALC) | `bud_payroll.base_salary` （複数の計算過程） |
| 基本給(固定給) | `bud_payroll.fixed_base_salary` |
| 基本給(残) (CALC) | `bud_payroll.remaining_base_salary` |
| 営業手当(固定給) | `bud_payroll.sales_allowance_fixed` |
| 役職手当(固定給) | `bud_payroll.position_allowance_fixed` |
| 残業手当 (CALC) | `bud_payroll.overtime_allowance` |
| その他手当 (CALC) | `bud_payroll.other_allowance` |
| 事務手当 (CALC) | `bud_payroll.admin_allowance` |
| 研修手当 (CALC) | `bud_payroll.training_allowance` |
| 入社祝い金 | `bud_payroll.signing_bonus` |
| 紹介ポイント | `bud_payroll.referral_points` |
| 獲得ポイント | `bud_payroll.earned_points` |
| 件数賞 | `bud_payroll.case_count_bonus` |
| 件数インセンティブ | `bud_payroll.case_incentive` |
| 件数インセン (CALC) | `bud_payroll.case_incentive_calculated` |
| 案件インセン | `bud_payroll.project_incentive` |
| AP インセン (CALC) | `bud_payroll.ap_incentive` |
| 人材紹介インセン | `bud_payroll.recruitment_incentive` |
| 社長賞 | `bud_payroll.president_award` |
| 社長賞インセンティブ | `bud_payroll.president_award_incentive` |
| 社長賞インセン (CALC) | `bud_payroll.president_award_calculated` |

#### 3.2.5 交通費

| Kintone | Garden Bud |
|---|---|
| 交通費上限 | `bud_payroll.commute_monthly_limit` |
| 交通費片道 | `bud_payroll.commute_one_way` |
| 交通費往復 | `bud_payroll.commute_round_trip` |
| 交通費往復(ア) | `bud_payroll.commute_round_trip_alt` |
| 交通費実費 (CALC) | `bud_payroll.commute_actual` |
| 通勤手当/非課 (CALC) | `bud_payroll.commute_non_taxable` |
| 旧：通勤手当/非課 | `bud_payroll.commute_legacy`（移行用） |

#### 3.2.6 控除（社会保険・税金）

| Kintone | Garden Bud |
|---|---|
| 健康保険料(控除) | `bud_payroll_deductions.health_insurance` |
| 介護保険料(控除) | `bud_payroll_deductions.long_term_care_insurance` |
| 厚生年金保険料(控除) | `bud_payroll_deductions.pension_insurance` |
| 雇用保険料(控除) | `bud_payroll_deductions.employment_insurance` |
| 所得税(控除) | `bud_payroll_deductions.income_tax` |
| 住民税(控除) | `bud_payroll_deductions.resident_tax` |
| 年調過不足税額(控除) | `bud_payroll_deductions.year_end_adjustment` |
| 調整保険料(控除) | `bud_payroll_deductions.adjustment_insurance` |
| 社宅家賃(控除) | `bud_payroll_deductions.company_housing` |
| 楽天早トク前払(控除) | `bud_payroll_deductions.rakuten_early_payment` |
| その他控除(控除) | `bud_payroll_deductions.other` |
| 定額税率（所得税）| `bud_payroll_deductions.fixed_tax_rate` |
| 税額表 | `bud_payroll.tax_table_type`（甲欄/乙欄） |

#### 3.2.7 会社負担保険料

| Kintone | Garden Bud |
|---|---|
| 健康保険料(会社) | `bud_payroll_company_burden.health_insurance` |
| 介護保険料(会社) | `bud_payroll_company_burden.long_term_care_insurance` |
| 厚生年金保険料(会社) | `bud_payroll_company_burden.pension_insurance` |
| 厚生年金基金掛金(会社) | `bud_payroll_company_burden.pension_fund` |
| 雇用保険料(会社) | `bud_payroll_company_burden.employment_insurance` |
| 労災保険料(会社) | `bud_payroll_company_burden.workers_compensation` |
| 一般拠出金(会社) | `bud_payroll_company_burden.general_contribution` |
| 子ども・子育て拠出金(会社) | `bud_payroll_company_burden.child_care_contribution` |
| 会社負担保険料合計 (CALC、2 件重複) | `bud_payroll_company_burden.total` |

#### 3.2.8 集計

| Kintone | Garden Bud |
|---|---|
| 課税支給合計 | `bud_payroll.taxable_total` |
| 非課税支給合計 | `bud_payroll.non_taxable_total` |
| 振込支給額合計 | `bud_payroll.bank_transfer_total` |
| 総合計 (CALC) | `bud_payroll.grand_total` |
| 支給予定_課税 (CALC) | `bud_payroll.scheduled_taxable` |
| 支給予定_非課税 (CALC) | `bud_payroll.scheduled_non_taxable` |
| 計算式反映用 | （Kintone 内部、移行不要） |

#### 3.2.9 グループ（折りたたみ）

Kintone GROUP は移行不要、UI 上の表示分類：
- その他勤怠 / その他手当内訳 / 給与計算用アポラン情報 / 別アプリ関連レコード一覧用 / 削除予定 / 会社負担保険料

#### 3.2.10 「東海林頼んだExcel」フィールド

→ 給与計算過程で Excel 介在の指摘あり。Garden Bud Phase D で完全 SQL 化推奨（Excel 排除）。

### 3.3 MFC 給与互換 CSV 出力（東海林さん要望）

| MFC 給与 標準カラム | Bud Phase D マッピング |
|---|---|
| 従業員番号 | `root_employees.employee_number` |
| 給与期間 | `bud_payroll.period` |
| 基本給 | `bud_payroll.base_salary` |
| 各種手当 | `bud_payroll.*_allowance` |
| 通勤手当 | `bud_payroll.commute_non_taxable` |
| 控除合計 | `sum(bud_payroll_deductions.*)` |
| 振込額 | `bud_payroll.bank_transfer_total` |

→ **Bud Phase D の D-04 給与明細配信 + D-07 銀行振込連携の延長**で MFC CSV 出力を実装。

### 3.4 Garden 移行時の整理（東海林さん「もっとわかりやすく」要望反映）

| 整理方針 | 内容 |
|---|---|
| **テーブル分割** | bud_payroll（main）+ bud_payroll_deductions + bud_payroll_company_burden + bud_payroll_allowances |
| **計算過程を隠蔽** | UI には「総合計」だけ、計算過程は admin で見える |
| **Excel 排除** | SQL + 計算式で完結、「東海林頼んだExcel」フィールド廃止 |
| **MFC 連携を主役に** | 給与計算結果を MFC CSV 出力 → MFC で確定 |
| **承認フロー UI** | 計算者（上田）→ 責任者（宮永/小泉）→ MFC 取込 |

---

## 4. App 85 決算書 → Garden Forest + Fruit（28 fields）

### 4.1 業務的な意味づけ

法人 × 期 ごとの**決算書とその主要数値**を保管。Forest の進行期 / fiscal_periods の母体テーブル候補。

### 4.2 主要フィールド

| Kintone | Garden Forest / Fruit |
|---|---|
| 法人 / 法人名 | `forest_companies.id` / `name`（Fruit 連携） |
| 期 | `forest_fiscal_periods.fiscal_period_number` |
| 年度 | `forest_fiscal_periods.fiscal_year` |
| 期間(から / まで) / 期間 | `forest_fiscal_periods.period_start` / `period_end` |
| 決算月 | `forest_companies.fiscal_month` (Fruit と同期) |
| 売上高 | `forest_fiscal_periods.revenue` |
| 経常利益 | `forest_fiscal_periods.ordinary_profit` |
| 純資産 | `forest_fiscal_periods.net_assets` |
| 税引前当期純損益金額 | `forest_fiscal_periods.pre_tax_profit` |
| 預金 | `forest_fiscal_periods.deposits` |
| 現金 | `forest_fiscal_periods.cash` |
| 会議費 | `forest_fiscal_periods.meeting_expenses`（販管費の細目） |
| 接待交際費 | `forest_fiscal_periods.entertainment_expenses` |
| 決算書 (LINK) | `fruit_company_documents.financial_statement_url` ⭐ Fruit 連携 |
| 優先順位 / 表示順 | （UI 表示用、Garden では sort_order） |

→ **Forest の fiscal_periods と Fruit の company_documents の master データ供給源**。Garden 移行時は両方に分配。

---

## 5. App 92 口座一覧 → Garden Sprout + Root（26 fields）

### 5.1 業務的な意味づけ（東海林さん共有事項）

**現状**：従業員が「じぶんフォーム」（Kintone 内蔵フォーム）で送ってきた**銀行口座情報の保管場所**。

→ Garden 移行時は：
- 入社前段階：**Sprout** の `sprout_pre_employment_data.bank_account_*` で受領
- 入社後：**Root** の `root_employee_banks` に転記
- App 92 の役割は **本人入力データの一時保管 → master 登録** までの中継

### 5.2 主要フィールド

| Kintone | Garden Sprout/Root |
|---|---|
| 従業員名_姓名 | `sprout_pre_employment_data.full_name` (or root_employees.id 参照) |
| KOTID | `root_employees.kot_id` |
| メールアドレス | (連絡用) |
| 銀行名 / 金融機関コード | `*.bank_name` / `bank_code` |
| 支店名 / 支店コード | `*.branch_name` / `branch_code` |
| 口座名義カナ | `*.account_holder_kana` |
| 口座番号 | `*.account_number` |
| 種別 | `*.account_type`（普通 / 当座 等） |
| 楽天銀行 (CHECK_BOX) | `*.is_rakuten_bank` |
| 稼働状況 | `*.status` |
| 支払先 | `*.payment_recipient`（経費精算等の振込先用？） |
| 支払想定時期 / 用途 / 頻度 | `*.payment_*`（経費精算？） |
| 支払備考 | `*.payment_notes` |

→ **「支払」系フィールドの存在から、これは従業員口座だけでなく経費精算用振込先口座も兼ねている可能性**。要確認。

---

## 6. App 93 交通費一覧 → Garden Sprout + Root（18 fields）

### 6.1 業務的な意味づけ（東海林さん共有事項）

**現状**：従業員が「じぶんフォーム」で送ってきた**交通費（通勤経路）情報の保管場所**。

→ Garden 移行時は：
- 入社前段階：**Sprout** の `sprout_pre_employment_data.commute_*`
- 入社後：**Root** の `root_employee_commute` に転記
- 引っ越し等の変更時：**申請承認パターン** で Garden Root マイページから申請 → admin 承認

### 6.2 主要フィールド

| Kintone | Garden Sprout/Root |
|---|---|
| 従業員名_姓名 / カナ | `*.full_name` |
| KOTID | `root_employees.kot_id` |
| メールアドレス (LINK) | (連絡用) |
| 最寄り駅 | `*.nearest_station` |
| 通勤経路 | `*.commute_route` |
| 交通費 片道 | `*.one_way_amount` |
| 交通費 往復 (CALC) | （計算列） |
| 交通費上限 | `*.monthly_limit` |

→ **シンプルな構造**、Garden Sprout の入社前データ収集 UI で取り込む。

---

## 7. App 95 経費一覧 → Garden Bud + Leaf 関電（26 fields）

### 7.1 業務的な意味づけ（東海林さん共有事項）

**現状**：**Garden Leaf 関電業務委託の経費** のみを集約。じぶんフォームで送信。

→ Garden 移行時は：
- **Bud（経費精算）** モジュールへの集約 + Leaf 関電と連動
- 他事業の経費は将来 Bud で全社統一

### 7.2 主要フィールド

| Kintone | Garden Bud |
|---|---|
| 従業員名 | `bud_expenses.employee_id` (root_employees 参照) |
| KOTID | `root_employees.kot_id` |
| 事業名 / 部署名 / チーム名 | （root_employees から JOIN） |
| 決済方法 (RADIO) 🔴 REQ | `bud_expenses.payment_method`（個人立替 / 法人カード / 他）|
| 使用用途 (RADIO) 🔴 REQ | `bud_expenses.purpose_category` |
| 使用用途詳細 | `bud_expenses.purpose_detail` |
| 金額 | `bud_expenses.amount` |
| 金額(税抜) (CALC) | `bud_expenses.amount_excl_tax` |
| 金額(税込) (CALC) | `bud_expenses.amount_incl_tax` |
| 決済日 | `bud_expenses.payment_date` |
| 決済年月 / 決済年 | （計算列、partition 用） |
| 清算日 | `bud_expenses.settled_date` |
| タイムスタンプ(SS) | `bud_expenses.kintone_timestamp`（Kintone 由来） |
| 備考 (multi-line) | `bud_expenses.notes` |

→ **Garden Bud の経費精算機能で実装**、Leaf 関電固有の場合は `bud_expenses.business_unit_id` で関連付け。

---

## 8. 移行戦略（Phase B / Phase D 実装時）

### 8.1 移行優先度

| 優先 | App | 移行先 | タイミング |
|---|---|---|---|
| 🔴 高 | App 56 従業員名簿 | Root（既存 root_employees 拡張） | Phase B-1（Root Phase B 着手時） |
| 🔴 高 | App 95 経費一覧 | Bud + Leaf 関電 | Phase B-3（Bud Phase B-1 着手時） |
| 🔴 高 | App 21 給与一覧 | Bud Phase D 給与処理 | Phase B-D（Bud Phase D 着手時） |
| 🟡 中 | App 92 口座一覧 / App 93 交通費一覧 | Sprout 経由 → Root | Phase B-2（Sprout 着手時） |
| 🟡 中 | App 85 決算書 | Forest + Fruit | Phase B-1（Fruit 着手時、Forest 既存と統合） |

### 8.2 移行手順（共通）

```
Phase B-X 開始
  ↓
1. Garden 側 migration（テーブル作成）
  ↓
2. Kintone API による初回 bulk import（既存全件）
  ↓
3. 並行運用期間（1-2 週間）
   - Kintone と Garden 両方に書込（dual-write）
   - 整合性検証
   - 計算式の Excel → SQL 移行（特に App 21 給与）
  ↓
4. Kintone → Garden 一方向同期（Garden が master）
  ↓
5. Kintone は読み取り専用化
  ↓
Phase C: Kintone 廃止
```

### 8.3 給与一覧（App 21）の特別対応（最優先）

東海林さん共有事項に基づく **「もっとわかりやすく」改善** ：

| Before（Kintone）| After（Garden Bud Phase D）|
|---|---|
| 120 フィールド 1 テーブル | bud_payroll + 4 関連テーブル（控除 / 会社負担 / 手当 / 履歴） |
| 計算式が「東海林頼んだExcel」依存 | 完全 SQL + Server Action 計算 |
| 上田計算 → 宮永/小泉確認 → MFC 手作業転記 | UI ワークフロー： 計算 → 確認 → MFC CSV 自動出力 → 取込確認 |
| GROUP で UI 整理 | コンポーネント分割（時給 / 勤怠 / 手当 / 控除 / 集計） |

→ Bud Phase D の D-02（給与計算ロジック）は **MFC 給与互換 CSV 出力**を主目的に再設計。

---

## 9. 判断保留・確認事項

### 9.1 東海林さんに確認したい

| # | 項目 | 緊急度 |
|---|---|---|
| 1 | App 56「打刻ID」と「KOTID」の差異 | 🟡 |
| 2 | App 56「testログインID」「testID」の用途 | 🟢 |
| 3 | App 56 「●チーム名」と SUBTABLE「在籍チーム」と「◆最終チーム名」の関係 | 🟡 |
| 4 | App 92「支払先」「支払想定時期」等のフィールドは経費精算用？ それとも従業員口座管理用？ | 🔴 |
| 5 | App 21 給与計算で Excel に依存している部分の特定 | 🔴 |
| 6 | App 21「東海林頼んだExcel」フィールドの内容 | 🟡 |
| 7 | App 21 計算者（上田）と確認者（宮永/小泉）の権限境界 | 🔴 |
| 8 | MFC 給与のインポート形式（CSV カラム仕様）| 🔴 |
| 9 | App 95 経費の他事業（関電以外）展開予定 | 🟡 |
| 10 | App 85 と Forest の既存 fiscal_periods どちらが master か | 🟡 |
| 11 | App 56「CW_APIトークン」運用（pgcrypto 暗号化必須） | 🔴 |
| 12 | 引越時の通勤経路変更フロー | 🟡 |

### 9.2 Phase B / D 実装着手前の合意事項

| # | 項目 | 推奨 |
|---|---|---|
| 1 | 給与計算の Excel 完全排除 | 🟢 推奨 |
| 2 | MFC 給与互換 CSV 出力を Bud Phase D の主目的に | 🟢 推奨 |
| 3 | 従業員口座と経費精算口座の分離 | 確認後判断 |
| 4 | 助成金・休業履歴の長期保管期間 | 法令準拠 |
| 5 | App 56 と root_employees の data merge 戦略 | 既存優先、Kintone 補完 |

---

## 10. 関連ドキュメント

- spec `docs/specs/2026-04-25-kintone-kanden-integration-analysis.md` — Kintone App 55 / 104 / 38 解析（PR #52）
- spec `docs/specs/2026-04-26-kintone-fruit-sprout-mapping-analysis.md` — Kintone App 28 / 44 / 45 解析（本日先程）
- a-auto Batch 17（PR #74、ローカル commit） — Bud Phase D 給与処理 8 spec
- a-auto Batch 18（ローカル commit） — Sprout / Fruit / Calendar 18 spec
- memory `project_garden_fruit_module.md` — Fruit 実体化
- memory `project_kintone_tokens_storage.md` — Kintone トークン保存場所
- memory `project_garden_change_request_pattern.md` — 申請承認パターン（給与・口座変更）

---

## 11. Kintone 全体マップ（最終版、9 アプリ）

| App ID | アプリ名 | フィールド数 | 解析 PR | 移行先 |
|---|---|---|---|---|
| 55 | 関西電力リスト一覧 | 74 | PR #52 ✅ | Garden Leaf 関電 |
| 104 | 在庫管理 関電 SIM | 25 | PR #52 ✅ | Garden Seed / Leaf 拡張 |
| 38 | 事業部登録名簿 1 営業 | 41 | PR #52 ✅ | Garden Root + 外注 |
| 28 | 法人名簿 | 61 + 5 SUBTABLE | 本日先程 | Garden Fruit |
| 44 | 求人 応募者一覧 | 84 + 1 SUBTABLE | 本日先程 | Garden Sprout |
| 45 | 求人 面接ヒアリングシート | 48 + 1 SUBTABLE | 本日先程 | Garden Sprout |
| **56** | **従業員名簿** | **105 + 4 SUBTABLE** | **本 PR** | **Garden Root** |
| **21** | **給与一覧** | **120** | **本 PR** | **Garden Bud Phase D + MFC** |
| **85** | **決算書** | **28** | **本 PR** | **Garden Forest + Fruit** |
| **92** | **口座一覧** | **26** | **本 PR** | **Garden Sprout + Root** |
| **93** | **交通費一覧** | **18** | **本 PR** | **Garden Sprout + Root** |
| **95** | **経費一覧** | **26** | **本 PR** | **Garden Bud + Leaf 関電** |
| **計** | | **656 + 11 SUBTABLE** | | |

→ **Kintone 12 アプリ全解析完了**。Garden 全モジュールへの移行マッピング基盤完成（PR #52 + 本日 2 件）。

---

## 12. 改訂履歴

| 版 | 日付 | 主な変更 |
|---|---|---|
| v0.1 | 2026-04-26 | 初版起草（App 56 / 21 / 85 / 92 / 93 / 95、計 323 フィールド + 4 SUBTABLE） |

---

— Kintone → Garden 移行マッピング分析（従業員 + 給与 + 決算 + 口座 + 交通費 + 経費）v0.1 —
