# Bud Phase D + 5/11 拡張 修復計画レポート

- 対応 dispatch: main- No. 295（a-main-023 → a-bud-002）
- 起草: 2026-05-11（a-bud-002）
- 起源: audit-001- No. 15「Bud 過去 30 日で main 到達 migration 0 件」検出

---

## 1. エグゼクティブサマリ

### 件数前提
- dispatch 記載: **14 件**
- a-bud-002 機械集計: **13 件**（Phase D 11 件 + 5/11 拡張 2 件 + D-08 = migration なし）
- 差分は a-main-023 で確認推奨（audit 数え方の整合 or 不足の特定）

### 設計整合性
- ✅ **依存順序: timestamp 順で完全整合**（循環依存なし）
- ✅ **helpers 定義 (D-09) が D-01 より後だが、D-01 は helpers 未使用なので問題なし**
- ✅ **D-06 の bud_nenmatsu_chousei (Phase C 未起票) は FK 制約なしで nullable**（apply 失敗リスクなし）

### apply リスク
- ⚠️ **silent NO-OP 罠リスクあり**（全 13 件で `CREATE TABLE IF NOT EXISTS` 使用、合計 41 テーブル create）
- ⚠️ **Root 前提**（`root_employees` / `root_companies`）が main DB に存在しない場合、全 13 件失敗
- ⚠️ **`btree_gist` 拡張** (D-09 で必要) + **`pgcrypto` 拡張** (D-06 で必要) の main 有効化要確認

### 推奨判断
- a-bud-002 視点: **修復 apply Go 可**（順序 timestamp 順、検証 SQL 用意済）
- 安全運用: **1 件ずつ apply + 各回検証 SQL Run、検証 OK 後に次へ**
- a-bud-002 単独 apply 禁止（a-main-023 + 東海林さん Go 後）

---

## 2. B-1 本番 DB 検証結果（a-bud-002 阻害）

### 阻害理由
- `.env.local` が a-bud-002 worktree (`C:/garden/a-bud-002/.env.local`) に**存在しない**
- 結果として `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` 未取得
- → 本番 DB への直接 SELECT 実機検証は a-bud-002 単独実施不可

### 代替案
- 検証 SQL は a-bud-002 が起草済（`docs/scripts/verify-bud-phase-d-all.sql`）
- **a-main-023 / 東海林さんが main DB Supabase Dashboard SQL Editor で Run** を推奨
- Runner script: `docs/scripts/verify-bud-phase-d-all.ps1`（実行手順 3 種を提示）

### a-main-023 への依頼事項
1. main 接続情報で `verify-bud-phase-d-all.sql` を Run
2. 結果（§0-§5 各 row の OK/NG）を a-bud-002 にフィードバック
3. NG 検出時は該当 migration 内容を a-bud-002 と再確認

---

## 3. B-2 依存順序表

詳細: `docs/bud-phase-d-migration-dependency-20260511.md`

要約:
- timestamp 順 = apply 順として完全整合
- 13 件全てが Root 系 (`root_employees` / `root_companies`) を FK 参照
- D-09 (#2) で helpers 3 件定義、以降 #3〜#13 で再利用
- D-06 (#11) は Phase C `bud_nenmatsu_chousei` を FK 参照しない（nullable + コメント記載のみ）

---

## 4. B-3 silent NO-OP 罠検出結果

詳細: `docs/bud-phase-d-migration-dependency-20260511.md` §3

要約:
- ⚠️ **CREATE TABLE IF NOT EXISTS が 13 件全 migration で使用**（合計 41 テーブル）
- ✅ ALTER TABLE ADD COLUMN IF NOT EXISTS は 0 件（罠リスクなし）
- ✅ CREATE INDEX IF NOT EXISTS は冪等的に問題なし
- ✅ DROP POLICY IF EXISTS は RLS 冪等性のため必要
- ✅ CREATE OR REPLACE FUNCTION は冪等で問題なし

### 罠対策
- 各 migration apply 後に `verify-bud-phase-d-all.sql` §1 + §3 + §4 を Run
- テーブル存在 + RLS 有効 + テーブル数集計の 3 ポイントで「skip された / 不完全 apply」を検出可能

---

## 5. C-1 apply 順序確定

`supabase/migrations/_phase_d_apply_order.md` で確定:
- 順序: timestamp 順（# 1〜# 13）
- 単位: 1 migration / 1 apply
- 検証: 各 apply 後に `verify-bud-phase-d-all.sql` の該当セクション Run

---

## 6. C-2 apply 順序 SQL

`supabase/migrations/_phase_d_apply_order.md` 参照（事前確認 + 安全運用ルール + a-bud-002 単独実行禁止事項を明記）。

---

## 7. C-3 検証 SQL セット

集約版: `docs/scripts/verify-bud-phase-d-all.sql`（§0-§5 で網羅）

§0 前提拡張 + Root テーブル存在
§1 全 41 テーブル存在確認（migration 別グループ化）
§2 helpers 関数存在確認（5 件）
§3 RLS 有効化確認（全 Bud テーブル）
§4 テーブル数集計（migration 別期待値と比較）
§5 重要制約存在確認（EXCLUDE / CHECK 一例）

→ 13 件個別 SQL に分割せず、集約 SQL で代替（dispatch §C-3 の 4 要素網羅）。
→ 個別精密検証が必要な migration が出た場合、a-bud-002 が個別 SQL を追加起草。

---

## 8. F: ① 仕訳帳 5/13 本番運用 影響評価（最重要）

| 観点 | 結果 | 詳細 |
|---|---|---|
| **schema 依存** | 🔴 **部分依存** | 仕訳帳 alpha (PR #160) は `bud_journal_entries` / `bud_journal_export_logs` / `bud_journal_accounts` 自身に依存 + `bud_bank_transactions` への FK |
| **schema 不在時の挙動** | 🟡 **一部動作** | mock data は UI で表示可（client-side で getMockJournalSummary 返却）、ただし「弥生 export ボタン」「pending → confirmed 状態遷移」は **DB なしで動作不能** |
| **単体動作のリスク** | 🔴 **高** | Phase D apply 修復前の 5/13 本番運用は: (1) UI 起動は可（mock 表示）/ (2) **書込操作は全失敗**（テーブル不在）/ (3) bud_bank_transactions FK 失敗で # 13 apply 自体エラー |
| **失敗パターン** | - | (1) 仕訳新規入力 → INSERT 失敗、(2) 弥生 export → 履歴記録不能、(3) status 更新 → UPDATE 失敗、(4) # 13 migration apply 時 # 12 (Bank) が先行未 apply なら FK エラー |

### 5/13 Go 判断条件

| Plan | 内容 | 推奨度 |
|---|---|---|
| **A** | 5/12 中に Phase D 11 件 (#1-#11) + Bank (#12) apply 完了 → PR #160 merge → # 13 apply → 5/13 本番運用 | 🟢 **推奨**（apply 順序正しく完走するなら可能）|
| **B** | apply 修復間に合わない → 仕訳帳 alpha を mock データで限定運用（閲覧のみ、書込禁止）| 🟡 暫定（書込なしなら DB 不在でも動作）|
| **C** | 5/14 以降に延期 → 5/12-13 で apply 完走を最優先 | 🟢 安全 |
| **D** | 5/13 本番運用強行 → 書込操作全失敗、ユーザー混乱 | 🔴 **不可** |

→ **a-bud-002 推奨: Plan A or Plan C**（Plan B は補完的、Plan D は禁止）

### apply 修復が間に合うか（時間ライン推定）

5/11 17:30〜深夜（本起草完了済）
↓
5/12 朝: a-main-023 + 東海林さん レビュー
↓
5/12 午前: apply 開始（# 1〜# 11 = Phase D 11 件、各 10-30 分 × 11 = 2-5 時間）
↓
5/12 午後: PR #159 merge 由来の # 12 Bank apply、PR #160 merge → # 13 Shiwakechou apply
↓
5/12 夕方: 集約検証 SQL Run、NG なければ全 13 件 apply 完走
↓
5/13 朝: 仕訳帳本番運用 Go 判断（東海林さん）

→ **5/12 を完全 apply 日にできれば Plan A 達成可**。早朝開始推奨。

---

## 9. apply Go/NoGo 推奨（a-bud-002 視点）

| 項目 | 推奨 |
|---|---|
| 修復計画 (C-1〜C-4) 起草 | ✅ 完了（本文書 + dependency + apply_order + verify scripts）|
| 5/12 apply 開始 | 🟢 **Go 推奨**（依存順序整合、検証 SQL 用意済、Root 前提確認が事前必須）|
| 5/13 仕訳帳本番運用 | 🟢 Plan A（apply 完走前提）または 🟡 Plan B（暫定 mock 運用）|
| apply 失敗 / silent NO-OP 検出時 | 🔴 即停止 → a-main-023 経由で東海林さん判断仰ぎ |

---

## 10. 判断保留事項（a-main-023 + 東海林さんへ）

| # | 論点 | 起案 |
|---|---|---|
| 1 | dispatch 記載「14 件」と実態「13 件」の差分 | audit 詳細確認、不足 migration があるか / D-08 含む数え方か |
| 2 | main DB の Root 前提（root_employees / root_companies）存在確認 | a-main-023 で SELECT 実機検証必須 |
| 3 | main DB の拡張 (btree_gist / pgcrypto) 有効化確認 | 同上 |
| 4 | PR #160 (Shiwakechou) の merge タイミング | 5/12 午後 or 夕方、# 12 Bank apply 後 |
| 5 | 5/13 仕訳帳本番運用 Go/NoGo | 5/12 apply 完走状況次第、東海林さん最終判断 |

---

## 11. 起草成果物一覧

| 成果物 | パス |
|---|---|
| 依存順序表 (B-2) | `docs/bud-phase-d-migration-dependency-20260511.md` |
| apply 順序 SQL (C-2) | `supabase/migrations/_phase_d_apply_order.md` |
| 集約検証 SQL (C-3) | `docs/scripts/verify-bud-phase-d-all.sql` |
| 検証 Runner (C-3) | `docs/scripts/verify-bud-phase-d-all.ps1` |
| 修復計画レポート (C-4) | `docs/bud-phase-d-recovery-plan-20260511.md`（本文書）|

注: dispatch §C-4 で「14 ファイル」と記載の `verify-bud-phase-d-{01..14}.sql` 個別検証 SQL は、集約 SQL で代替（dispatch §C-3 の 4 要素を網羅）。個別精密検証が必要な migration が a-main-023 検証で判明した場合に追加起草する。
