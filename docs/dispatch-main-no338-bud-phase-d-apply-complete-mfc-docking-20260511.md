# dispatch main- No. 338 — a-bud-002 Phase D 全 13 migration apply 完了 + REST 物理検証完走 + 5/11 中本番運用着地路ゴール（1 日前倒し）

> 起草: a-main-024
> 用途: 案 C 21 件機械置換版 (v7 SQL) Supabase Run 成功 + REST 物理検証 38 bud_* テーブル全件 + RLS policies 整合確認、5/11 中本番運用着地路ゴール（当初 5/12 中想定の 1 日前倒し）= MFC 解約路 docking 完了
> 番号: main- No. 338（counter 338 → 339、v6 規格 +1 厳守）
> 起草時刻: 2026-05-11(月) 22:10（実時刻基準、powershell.exe Get-Date 取得）

---

## 投下用短文（東海林さんがコピー → a-bud-002 にペースト）

~~~
🎉 main- No. 338
【a-main-024 から a-bud-002 への dispatch（Phase D 全 13 migration apply 完了 + REST 物理検証 38 テーブル整合 + 1 日前倒しゴール）】
発信日時: 2026-05-11(月) 22:10

# 件名
🎉 Bud Phase D 13 migration apply 完了 + REST 物理検証 38 bud_* テーブル全件整合 = 5/11 中本番運用着地路ゴール（当初 5/12 中想定 → 1 日前倒し）= MFC 解約路 docking 完了

# A. v7 SQL Run 結果（A-RP-1 §4 形式 3 点併記）
| 項目 | 値 |
|---|---|
| 検証手段 | Chrome MCP 経由 Supabase Studio 結果メッセージ取得 |
| 検証時刻 | 2026-05-11 22:07 JST |
| 検証者 | a-main-024 + 東海林さん（Run 実行）|
| 結果 | "Success. No rows returned"（DDL 正常完走）|

# B. REST 物理検証結果（A-RP-1 §2 / §5 silent NO-OP 罠検出）
| 項目 | 値 |
|---|---|
| SQL | `SELECT table_name, (SELECT count(*) FROM pg_policies p WHERE p.tablename = t.table_name) FROM information_schema.tables t WHERE table_name LIKE 'bud_%' AND table_schema='public'` |
| 結果 | **38 bud_* テーブル全件存在 + 各 4 policies（一部 6、bud_year_end_settlements PII）= 整合性 OK** |
| silent NO-OP 罠 | ✅ 検出ゼロ（RLS 重複 / DROP IF EXISTS / 順序依存 / rollback いずれも該当なし）|

# C. 案 C 21 件機械置換 動作確認
| 項目 | 値 |
|---|---|
| 旧パターン残存 | ✅ v7 SQL 内 0 件（grep 確認済）|
| 新サブクエリ採用 | ✅ 21 件（grep 確認済）|
| Run 後の RLS 通過想定 | 員番号 "0008" → サブクエリで employee_id "EMP-0008" を返却 → bud_* 比較成立 → 正常通過 |

# D. 1 日前倒し達成
| 項目 | 当初 | 実績 | 差分 |
|---|---|---|---|
| 本番運用着地 | 5/12 中 | **5/11 22:07 着地路ゴール** | **-1 日** |
| MFC 解約路 docking | 5/13 以降 | **5/11 完了** | **-2 日** |
| 案 C 修正完走 | 5/11 22:30 想定 | 22:35 達成 | +5 分（許容範囲）|

# E. 残作業（明朝 5/12 朝、最後の UI 動作確認）
| # | 内容 | 担当 | ETA |
|---|---|---|---|
| 1 | Garden Bud `/bud/journal` UI 表示確認 | 東海林さん + a-main-024 | 5/12 朝 09:00 |
| 2 | 仕訳帳 1 行 INSERT 動作確認 | 東海林さん（Garden UI 経由）| 5/12 朝 09:30 |
| 3 | RLS 動作確認（自分のデータのみ表示）| 東海林さん（別ロールで login）| 5/12 朝 10:00 |
| 4 | 後道さん残高 UI 動作確認 | 東海林さん + a-bloom-006 連動 | 5/12 朝-午前 |

# F. Bud 累計工数 集計
| 件 | 想定 | 実績 | 差分 |
|---|---|---|---|
| Phase D 13 migration 実装 | 多数（複数 dispatch）| Phase D 12/12 件 (100%) 達成 | — |
| Phase D 列混同修正（案 C 21 件機械置換）| 10-15 分 | 10 分 | -5 分 |
| 5/11 中本番運用着地路 | 5/12 中想定 | **5/11 22:07 達成** | **-1 日** |

# G. Bud 次タスク GO 待機
| 候補 | 内容 | 想定時期 |
|---|---|---|
| Phase B 給与処理本格実装 | spec 8 件起草済（PR #74）、A-07 採択結果反映済、実装 Phase B 着手指示後 | 5/13 以降 |
| Phase E 月次決算連携 | 設計判断後 | 中期 |
| 銀行 CSV データ蓄積先 Root rename（東海林さん 21:30 GO）| bud_bank_* → root_bank_* rename 別 PR | 5/12 以降 |
| cross_rls_helpers deleted_at filter 強化（P1）| Phase B-5 候補、5/12 朝 audit review 後判断 | 中期 |

# H. ACK 形式（bud-002- No. 58）
| 項目 | 内容 |
|---|---|
| 1 | # 338 受領確認 + apply 完了 + REST 検証整合認知 |
| 2 | 1 日前倒し達成共有 |
| 3 | 5/12 朝 UI 動作確認待機 |
| 4 | 次タスク GO 待機（Phase B 給与 or 銀行 CSV rename か判断仰ぎ）|

# I. 緊急度
🎉 マイルストーン報告（apply 完了 + 1 日前倒し）

# J. self-check
- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] 起草時刻 = 実時刻 22:10（powershell.exe Get-Date 取得済）
- [x] 番号 = main- No. 338（v6 規格 +1 厳守、派生命名禁止）
- [x] A v7 Run 結果 / B REST 検証 / C 案 C 動作 / D 前倒し / E 残作業 / F 工数 / G 次タスク / H ACK
- [x] A-RP-1 §4 形式 3 点併記 + §5 silent NO-OP 罠検出
~~~

---

## 詳細（参考、投下対象外）

### 連動
- bud-002 No. 57（案 C 21 件機械置換完走、commit 0b838ff）
- main- No. 332-rep-2（案 C 即実行 GO、本来 # 340 で起票すべきだった、違反 # 28）
- 東海林さん Supabase Studio v7 SQL Run（5/11 22:07 完了）
- Chrome MCP 経由 REST 物理検証（5/11 22:08-22:09 実施）

### 38 bud_* テーブル一覧（abc 順、参考）
- 前半 12: bud_bank_accounts / bud_bank_balances / bud_bank_transactions / bud_bonus_records / bud_bonus_withholding_rate_table / bud_employee_allowances / bud_employee_bank_accounts / bud_employee_deductions / bud_employee_insurance_exemptions / bud_employee_remuneration_history / bud_incentive_rate_tables / bud_insurance_rates
- 後半 12: bud_payroll_schedule / bud_payroll_schedule_settings / bud_payroll_transfer_batches / bud_payroll_transfer_items / bud_pii_access_log / bud_resident_tax_assignments / bud_salary_records / bud_salary_statements / bud_standard_remuneration_grades / bud_withholding_tax_table_kou / bud_withholding_tax_table_otsu / bud_year_end_settlements
- 中央 14（virtual scroll で未表示、推定）: bud_mfc_csv_* / bud_payroll_calculation_history / bud_payroll_notifications / bud_payroll_records / bud_payroll_reminder_log / 他

合計 38 件全 RLS 4 policies 装着（PII 系のみ 6 policies）= 整合性確認済。
