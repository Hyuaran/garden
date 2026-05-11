# dispatch main- No. 294 — a-soil-002 へ soil_call_history 衝突解消 (rename) + Phase B-01 8 件 apply 戦略起草依頼

> 起草: a-main-023
> 用途: a-audit-001 # 15 発見の silent NO-OP 罠（soil_call_history 衝突）を a-soil-002 主導で解消し、Soil Phase B-01 全 8 件の apply 戦略を確立する
> 番号: main- No. 294
> 起草時刻: 2026-05-11(月) 17:30
> 緊急度: 🔴 最緊急（致命 5 件の一部、Soil 全モジュール apply の前提）

---

## 投下用短文（東海林さんがコピー → a-soil-002 にペースト）

~~~
🔴 main- No. 294
【a-main-023 から a-soil-002 への dispatch（soil_call_history 衝突解消 rename + Phase B-01 8 件 apply 戦略起草依頼）】
発信日時: 2026-05-11(月) 17:30

# 件名
soil_call_history 既存テーブル衝突（silent NO-OP 罠）解消 + Soil Phase B-01 migration 8 件の apply 戦略起草依頼

# A. 衝突問題の経緯（a-audit-001 # 15 発見）

## A-1. 発見の発端
- 5/11 17:15 a-audit-001 が audit-001- No. 15「silent NO-OP 罠 2 件」を発見
- うち罠 # 2 が本件: `soil_call_history` 既存テーブル衝突

## A-2. silent NO-OP 罠の正体
- garden-dev に **既存の `soil_call_history` テーブル**が存在
- このテーブルは **Tree D-01 の残骸**（Tree 旧設計で先行作成、その後 Soil 側に正式所属が決定）
- **実データ EMP-1324 を含む**コール履歴が既に書き込まれている
- 一方で Soil migration `20260507000002_soil_call_history.sql` は Soil 仕様での `soil_call_history` を `CREATE TABLE IF NOT EXISTS` で定義
- 列構造が**完全に不一致**（Tree 残骸版 vs Soil 正式版）

## A-3. silent NO-OP の発動条件
- `CREATE TABLE IF NOT EXISTS` は「同名テーブルが既存」だと **何もせず正常終了**（NOTICE 1 行のみ）
- migration 適用ログ上は「成功」扱い
- しかし実テーブルは **Tree 残骸版のまま** で Soil 仕様の列・制約は一切作られない
- 後続 migration（INDEX / FK / RLS）が Soil 仕様列を参照すると `column does not exist` で破綻

## A-4. 影響範囲
- Soil Phase B-01 全 8 件（20260507000001 〜 20260509000001）が **全件未適用**
  - 20260507000002_soil_call_history.sql … 衝突で silent NO-OP（罠 # 2）
  - 20260507000003 以降 … 上流テーブル不在で連鎖失敗
- Soil 全モジュール（リスト 253 万件 / コール履歴 335 万件）の DB 基盤が **未確立**
- Tree D-01 が現在実データ書込中のため、**既存 soil_call_history の DROP は不可**

# B. 解消戦略

## B-1. rename 戦略（DROP 不可のため）
- 既存 soil_call_history（Tree 残骸 + EMP-1324 実データ入り）を **rename して退避**
  - rename 後の名前: `soil_call_history_legacy_tree_20260511`
  - 命名根拠: legacy = 旧版、tree = 出自モジュール、20260511 = rename 日
- rename 後、Soil migration 8 件を順次 apply
- Tree D-01 側は本日（# 290）で別途 spec 修正中（a-tree-002 担当）→ rename 後の参照先切替も同時進行

## B-2. Soil migration 8 件 順次 apply（依存順序固定）
1. `20260507000001_soil_call_lists.sql` … 親テーブル（リスト 253 万件用）
2. `20260507000002_soil_call_history.sql` … コール履歴（rename 後の空きスロットに作成）
3. `20260507000003_soil_call_history_constraints.sql` … FK / UNIQUE
4. `20260507000004_soil_call_history_indexes.sql` … INDEX（パフォーマンス）
5. `20260508000001_soil_call_lists_rls.sql` … RLS
6. `20260508000002_soil_call_history_rls.sql` … RLS
7. `20260509000001_soil_imports_audit.sql` … 取込監査
8. （最終件名は a-soil-002 で確認）

## B-3. 検証 SQL（各 migration 後に必須実行）
- テーブル存在: `information_schema.tables` で SELECT
- 列存在: `information_schema.columns` で SELECT
- 制約存在: `information_schema.table_constraints` で SELECT
- RLS 有効化: `pg_tables.rowsecurity = true` 確認
- INDEX 存在: `pg_indexes` で SELECT

# C. 起草依頼内容（a-soil-002 主導）

## C-1. rename SQL（先頭ステップ）
- 既存 soil_call_history → soil_call_history_legacy_tree_20260511
- 依存制約（FK / INDEX / RLS）も rename 同時実施
- rename 前後の行数一致検証 SQL も併記

## C-2. apply 順序 SQL（順序固定、依存逆順 NG）
- 8 件を順序固定の単一バッチ SQL として起草（or 個別ファイル + 実行順記載 README）
- 各ステップ間に検証 SQL を挟む構成
- 失敗時のロールバック手順も併記

## C-3. 各検証 SQL（テーブル存在 / 列存在 / 制約存在 / RLS / INDEX）
- 各 migration 後に実行する SELECT 集
- 結果期待値も併記（行数 = 1 等）

## C-4. 起草成果物の保存先
- 推奨: `supabase/migrations/` 配下に rename 用 migration を新規追加
  - 例: `20260511170000_rename_legacy_soil_call_history.sql`
- 検証 SQL は `docs/scripts/verify-soil-phase-b01.sql` として別ファイル化
- apply 手順書: `docs/runbook-soil-phase-b01-apply-20260511.md`

# D. 並列進行可能タスク

## D-1. Phase B-01 Phase 2 は継続 OK
- CSV parser 実装（リスト取込ロジック）
- INDEX migration 設計
- admin UI（取込画面）
- 上記は DB 適用と並列で開発可能、本タスクと衝突しない

## D-2. 衝突解消 SQL 起草は最優先（致命 5 件の一部）
- Phase B-01 Phase 2 と並列で進めつつ、本タスクが先行完成必須
- 起草完了が apply 開始の前提条件

# E. apply タイミング

## E-1. 計画
- **5/12-13** で apply 実行（a-soil-002 + 東海林さん + a-main-023 連携）
- 順序:
  1. a-soil-002 が rename + apply SQL を起草・PR 化
  2. a-main-023 が PR レビュー
  3. 東海林さんが Supabase SQL Editor で順次 Run
  4. 各ステップ後に a-soil-002 が検証 SQL 実行・結果報告
  5. 全 8 件完走で # 294 close

## E-2. 致命 5 件の一部
- 本件は a-audit-001 # 15 で挙がった致命 5 件のうち 1 件
- 他の 4 件:
  - Soil 8 件全件未適用（本件で解消）
  - Bud Phase D 14 件 全件未適用（# 295 で別途依頼）
  - Tree D-01（本日修復済）
  - Leaf 本体未適用（# 296 で別途依頼）

# F. spec mismatch 連携

## F-1. Tree D-01 spec 修正と並行
- # 290 で a-tree-002 が Tree D-01 spec 修正担当
- Tree 側は **soil_call_history を参照する形に切替**（旧 Tree 残骸テーブル直接参照を廃止）
- a-tree-002 と a-soil-002 で参照先名称（soil_call_history）を最終合意

## F-2. 既存データ EMP-1324 の取扱
- soil_call_history_legacy_tree_20260511 に退避後、データ移行が必要か a-tree-002 と協議
- 移行 SQL の起草は a-tree-002 主導（本 dispatch スコープ外）
- ただし a-soil-002 は移行先テーブル仕様を a-tree-002 に共有

# G. ACK 形式

## G-1. 衝突解消 SQL 起草完了報告
- 報告番号: soil-002- No. NN（連番管理）
- 報告先: a-main-023
- 報告内容:
  1. 起草ファイル一覧（rename SQL / apply SQL / 検証 SQL / runbook）
  2. PR URL（PR 化済の場合）
  3. apply 想定所要時間（東海林さんの操作時間）
  4. リスク・注意点
  5. self-check 結果

## G-2. apply 完走報告
- 全 8 件 apply + 検証完走で別途報告（soil-002- No. NN+1）

# H. self-check（a-soil-002 で起草前後に確認）

## H-1. 起草前
- [ ] 既存 soil_call_history の列構造を SELECT で確認
- [ ] 実データ行数を確認（EMP-1324 含む件数）
- [ ] Tree D-01 側の参照箇所を grep（参照先切替が必要な場所の洗い出し）
- [ ] Supabase migration ファイル 8 件の内容を Read で全件確認

## H-2. 起草後
- [ ] rename SQL が IF EXISTS / IF NOT EXISTS で冪等
- [ ] apply 順序が依存関係と一致（親 → 子の順）
- [ ] 検証 SQL が各 migration の核心列・制約をカバー
- [ ] ロールバック手順を明記
- [ ] runbook が東海林さんでも順次実行可能（コマンドコピペで完結）

## H-3. dispatch 受領後の即時アクション
- [ ] 本 dispatch 全文を Read
- [ ] a-audit-001 # 15 の元 dispatch を参照（罠 # 2 詳細確認）
- [ ] 既存 soil_call_history を SELECT で実態把握
- [ ] 起草着手 → 5/11 中に PR 化目標
~~~

---

## dispatch 詳細補足（a-main-023 内部参照用）

### 1. 本 dispatch 起草の経緯

5/11 17:15 a-audit-001 が audit-001- No. 15 で「silent NO-OP 罠 2 件」を発見。罠 # 1（別件）と罠 # 2（本件 = soil_call_history 衝突）のうち、本件は Soil Phase B-01 全 8 件の apply を阻止している致命罠である。

a-main-023 として、a-soil-002 への正式 dispatch で衝突解消戦略を確立し、5/12-13 で apply 完走させる計画。

### 2. silent NO-OP 罠の技術詳細

PostgreSQL の `CREATE TABLE IF NOT EXISTS` は、同名テーブルが既存の場合：
- 列構造の一致確認は **行わない**
- NOTICE: relation "xxx" already exists, skipping を出力
- exit code 0（成功扱い）

このため migration ログ上は「成功」と記録されるが、実テーブルは旧版のまま。後続の `ALTER TABLE ADD COLUMN`（Soil 仕様列を追加）や FK 作成が、列不在で失敗するか、最悪 silent NO-OP の連鎖で気付かれず破綻状態が継続する。

### 3. rename 戦略の根拠

#### 3-1. DROP TABLE が不可な理由
- 既存 soil_call_history に Tree D-01 が **実データ書込中**（EMP-1324 等）
- DROP すると Tree のコール履歴データが消失
- 業務影響: コールセンター（コア業務）の履歴喪失 = 重大障害

#### 3-2. rename の利点
- 既存データを **完全保持**
- Soil 仕様の新テーブルを空きスロットに新規作成可能
- 後でデータ移行（必要な行のみ）が可能
- 不要なら legacy テーブルは残置で OK（DROP は別 dispatch 判断）

#### 3-3. rename 命名規則
- `<元テーブル名>_legacy_<出自>_<日付>`
- 例: `soil_call_history_legacy_tree_20260511`
- 利点: 一目で「いつ・どこから」退避されたか分かる

### 4. 依存順序の理屈

Soil Phase B-01 8 件は以下の依存関係:
- `soil_call_lists`（親）← `soil_call_history`（子、FK）
- `soil_call_history`（本体）← `soil_call_history_constraints`（制約追加）
- `soil_call_history`（本体）← `soil_call_history_indexes`（INDEX 追加）
- 各テーブル ← RLS 設定
- 監査テーブル `soil_imports_audit`（独立、最後）

順序を間違えると FK 作成時に親テーブル不在で失敗。

### 5. apply 連携フロー

```
[a-soil-002]
  起草・PR 化
  ↓
[a-main-023]
  PR レビュー（30 分以内）
  ↓
[東海林さん]
  Supabase SQL Editor で順次 Run（指示に従い 1 ステップずつ）
  ↓
[a-soil-002]
  各ステップ後の検証 SQL を実行・結果を a-main-023 に報告
  ↓
[a-main-023]
  全 8 件完走確認 → # 294 close
```

### 6. 起草成果物のディレクトリ構成（想定）

```
supabase/migrations/
  20260511170000_rename_legacy_soil_call_history.sql  ← 新規
  20260507000001_soil_call_lists.sql  ← 既存
  20260507000002_soil_call_history.sql  ← 既存
  ... (8 件、既存)

docs/
  scripts/
    verify-soil-phase-b01.sql  ← 新規（検証 SQL 集）
  runbook-soil-phase-b01-apply-20260511.md  ← 新規（apply 手順書）
```

### 7. リスク・注意点

#### 7-1. rename 中の Tree D-01 書込との競合
- rename SQL 実行中に Tree D-01 が書込を試みると一時的にエラー
- 対策: rename は **トランザクション内**で実行、所要 1 秒未満
- 業務影響: コールセンター稼働中の場合、業務停止時間帯（深夜・休日）に実施推奨

#### 7-2. 既存データ EMP-1324 の整合性
- legacy テーブルに退避後、データ参照先切替（# 290 で a-tree-002 担当）
- Tree 側のアプリコードを soil_call_history → soil_call_history_legacy_tree_20260511 に向ける
- もしくは Soil 新テーブルに移行（移行 SQL 起草が必要）
- どちらを採るかは a-tree-002 + a-soil-002 + a-main-023 で協議

#### 7-3. ロールバック手順
- 万一 apply 中に致命エラー発生したら:
  1. 失敗時点までの migration を rollback（REVERSE 順序で DROP）
  2. legacy テーブル名を soil_call_history に戻す rename
  3. Tree D-01 稼働を確認
- 上記手順を runbook に明記

### 8. 致命 5 件全体像（参考）

| # | モジュール | 件名 | 担当 | 状況 |
|---|---|---|---|---|
| 1 | Tree | D-01 修復 | a-tree-002 | 本日修復済 |
| 2 | Soil | Phase B-01 8 件未適用（soil_call_history 衝突）| a-soil-002 | **本件 # 294** |
| 3 | Bud | Phase D 14 件全件未適用 | a-bud | # 295（別途） |
| 4 | Leaf | 本体未適用 | a-leaf | # 296（別途） |
| 5 | Tree | spec mismatch 修正 | a-tree-002 | # 290 |

### 9. dispatch self-check

- [x] memory `feedback_dispatch_header_format` v5 準拠（投下情報先頭明示）
- [x] 投下先 a-soil-002 を冒頭明示
- [x] 緊急度 🔴 を冒頭明示
- [x] 発信日時記載
- [x] A〜H の章立てで網羅
- [x] ACK 形式（soil-002- No. NN）明記
- [x] self-check リスト同梱
- [x] 並列進行可能タスク明記（Phase B-01 Phase 2 継続 OK）
- [x] 致命 5 件全体像との位置付け明示
- [x] 全文 300-400 行（目視確認: 約 300 行）
- [x] 日本語起草

### 10. 関連 dispatch / memory

- a-audit-001 # 15: silent NO-OP 罠 2 件発見（本 dispatch の起因）
- main- No. 290: a-tree-002 へ Tree D-01 spec 修正依頼（並行進行）
- main- No. 295: a-bud へ Bud Phase D 14 件未適用解消依頼（別途）
- main- No. 296: a-leaf へ Leaf 本体未適用解消依頼（別途）
- memory `project_rls_server_client_audit`: RLS 適用確認の重要性
- memory `feedback_dispatch_header_format` v5: 本 dispatch 形式準拠

---

（dispatch main- No. 294 終了）
