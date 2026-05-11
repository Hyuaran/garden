# Bud Phase D + 5/11 拡張 apply 順序（main 修復用 / 2026-05-11 起草）

- 対応 dispatch: main- No. 295
- 起草: a-bud-002（2026-05-11）

---

## 順序固定リスト

timestamp 順 = apply 順（依存関係整合済、`docs/bud-phase-d-migration-dependency-20260511.md` §1 参照）

| 順 | timestamp | spec | migration ファイル |
|---|---|---|---|
| 1 | 20260507000001 | D-01 attendance | `20260507000001_bud_phase_d01_attendance_schema.sql` |
| 2 | 20260507000002 | D-09 bank_accounts (+ helpers) | `20260507000002_bud_phase_d09_bank_accounts.sql` |
| 3 | 20260507000003 | D-05 social_insurance | `20260507000003_bud_phase_d05_social_insurance.sql` |
| 4 | 20260507000004 | D-02 salary_calculation | `20260507000004_bud_phase_d02_salary_calculation.sql` |
| 5 | 20260507000005 | D-03 bonus_calculation | `20260507000005_bud_phase_d03_bonus_calculation.sql` |
| 6 | 20260507000006 | D-07 bank_transfer | `20260507000006_bud_phase_d07_bank_transfer.sql` |
| 7 | 20260507000007 | D-11 mfc_csv_export | `20260507000007_bud_phase_d11_mfc_csv_export.sql` |
| 8 | 20260508000001 | D-04 statement_distribution | `20260508000001_bud_phase_d04_statement_distribution.sql` |
| 9 | 20260508000002 | D-10 payroll_integration | `20260508000002_bud_phase_d10_payroll_integration.sql` |
| 10 | 20260508000003 | D-12 schedule_reminder | `20260508000003_bud_phase_d12_payroll_schedule_reminder.sql` |
| 11 | 20260508000004 | D-06 nenmatsu_integration | `20260508000004_bud_phase_d06_nenmatsu_integration.sql` |
| 12 | 20260511000010 | Bank (5/11 拡張) | `20260511000010_bud_bank_accounts_balances.sql` |
| 13 | 20260511000011 | Shiwakechou (5/11 拡張、PR #160 未 merge) | `20260511000011_bud_journal_entries.sql` |

---

## apply 単位 / 安全運用ルール

### 必須遵守
- **全 13 件を 1 トランザクションでは走らせない**（rollback 影響範囲を分離）
- **1 件ずつ supabase migration apply で順次 Run**
- 各回 `docs/scripts/verify-bud-phase-d-XX.sql` で検証（テーブル/列/制約/RLS）
- 検証 OK → 次へ
- 検証 NG / エラー → **即停止**、a-main-023 経由で東海林さん判断仰ぎ

### 事前確認（必須、apply 前に実施）
1. main DB に **public.root_employees** が存在することを確認（全 13 件の FK 前提）
2. main DB に **public.root_companies** が存在することを確認（# 1 / # 6 / # 9 / # 10 の FK 前提）
3. main DB に **btree_gist 拡張**が有効化されていることを確認（# 2 D-09 で利用、`create extension if not exists btree_gist;` 内包）
4. main DB に **pgcrypto 拡張**が有効化されていることを確認（# 11 D-06 で利用、`create extension if not exists pgcrypto;` 内包）

### # 13 Shiwakechou の特殊扱い

- PR #160 が main に未 merge（5/11 17:45 時点 OPEN / MERGEABLE / UNSTABLE）
- PR #160 merge 後にのみ # 13 apply 可（develop merge 経由）
- それまでは # 1-12 で停止

---

## a-bud-002 単独実行禁止事項（重要）

下記は **a-bud-002 が勝手に実行してはいけない**:
- `supabase migration apply`（本番 DB への適用）
- `psql ... -f migration.sql`（同上）
- 本番 DB への `INSERT` / `UPDATE` / `DELETE`

→ 全て a-main-023 + 東海林さん Go 判断後に実行。

a-bud-002 が **実行 OK** な範囲:
- migration ファイルの精読 / 解析
- `docs/` 配下の起草
- 検証 SQL の準備（SELECT のみ、本番 DB 接続は a-main-023 経由）
- Vitest 等のローカル test 実行
