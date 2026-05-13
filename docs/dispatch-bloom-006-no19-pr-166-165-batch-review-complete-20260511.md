# 🔴 bloom-006- No. 19
【a-bloom-006 から a-main-023 への dispatch（PR #166 + #165 batch review 完走報告、🔴 critical apply 前提）】
発信日時: 2026-05-11(月)

# 0. TL;DR

**両 PR とも GO 判定 ✅** — PR #166 (Soil apply prep) = 5/12-13 apply 進行 OK (軽微改善 3 件は watch 項目)、PR #165 (Leaf 修復計画) = docs merge 進行 OK (Bloom 観点追加提案 3 件)、累計 16 PR review 完走。

# # 1. PR #165 (Leaf 修復計画 v1.0) レビュー結果

| 観点 | 結果 |
|---|---|
| 1. 修復対象の正確性 | ✅ |
| 2. スキーマ案の最小性 | ⚠️ 業務ヒアリング後確定 |
| 3. Phase D 92.9% への影響 | ⚠️ 完成宣言可否前提 |
| 4. 既存 PR #65-#73 との整合 | ✅ A 案で再利用可 |
| 5. leaf-migration-checklist 横展開 | ⚠️ 別 spec 起票推奨 #1 |
| 6-10. RLS / ロール / 削除 / 申請承認 / 永続保管 | ✅ N/A (別 PR 対象) |
| 11. テスト方針 | ✅ |
| 12. 他商材スケルトン整合 | ✅ |
| 13. docs フォーマット | ✅ |
| 14. 教訓抽出粒度 | ✅ 「2 度と踏まない」レベル |
| 15. Bloom 視点での影響 | ⚠️ KPI フィールド充足確認 #2 |
| 16. 後続タスク順序 | ✅ D.14 → Phase A → B → F |

総評: **採用推奨 GO** ✅、docs merge 進行 OK。

## Bloom 観点追加提案 3 件（修正提案）

| # | 提案 | 緊急度 |
|---|---|---|
| #1 | `leaf-migration-checklist v1.0` 別 spec 起票推奨（光回線/クレカ等の他商材スケルトン適用時の流用可否 + 調整点）| 🟢 中 |
| #2 | A 案 §3.1 Step 2 業務ヒアリングに「Bloom 統合 KPI 用フィールド」追加（案件数 / ステータス分布 / 進捗 / 売上見込 / 担当者別実績）| 🟡 中、業務ヒアリング前に共有推奨 |
| #3 | 親 CREATE migration 起草時に RLS / ロール / 削除 / 申請承認 / 永続保管の memory 準拠を spec で明示 | 🟢 低 |

## Phase D 92.9% → 100% 完成までの推奨順序

| Step | 内容 | 工数 |
|---|---|---|
| 1 | ✅ 本 plan (修復計画 v1.0) merge | docs scope |
| 2 | 🟡 業務ヒアリング (東海林さん) | 0.5d |
| 3 | 🟡 親 CREATE migration 起草 (Bloom KPI フィールド充足 #2 含む) | 0.3d |
| 4 | 🟡 garden-dev apply | 0.1d |
| 5 | 🟡 既存 PR #138〜#145 apply | - |
| 6 | 🟡 検証 SQL + Integration / E2E test | 0.1d |
| 7 | 🟡 D.14 カバレッジ 80%+ 確認 | - |
| 8 | ✅ Phase D 100% 完成宣言 | - |

推定総工数: 約 **1.0d** (本 plan merge 後)

レビューコメント: https://github.com/Hyuaran/garden/pull/165 (shoji-hyuaran COMMENTED 2026-05-11T09:15:01Z)

# # 2. PR #166 (Soil Phase B-01 apply prep) レビュー結果

| 観点 | 結果 |
|---|---|
| 1. rename migration 設計判断 7 件 | ✅ |
| 2. preflight SQL 網羅性 (8 セクション) | ✅ |
| 3. verify SQL 検証深度 (10 セクション) | ✅ |
| 4. runbook 11 ステップ実行可能性 | ✅ |
| 5. rollback 手順 | ⚠️ #1 |
| 6. a-tree-002 連携手順 | ✅ |
| 7. Tree D-1 + D-2 セット戦略影響 | ✅ |
| 8. 253 万件 list + 335 万件 call_history 影響 | ✅ |
| 9. garden-dev 対象限定 | ✅ |
| 10. dry-run 機能 | ⚠️ #2 |
| 11. 段階的 apply | ✅ |
| 12. 監視・ログ取得 | ✅ |
| 13. RLS 影響 | ✅ |
| 14. application code 影響 | ⚠️ #3 |
| 15. runbook 冗長性 | ✅ |
| 16. Bloom 視点影響 | ✅ |

総評: **採用推奨 GO** ✅、Soil apply (5/12-13) 進行 OK。

## 主要観察

- rename migration: 非 PARTITIONED 判定 + 条件付き rename + 再実行安全性 + NOTICE + comment 出自記録
- preflight 8 セクション (テーブル現状 / PARTITIONED 判定 / 列構造 / 行数 / inbound FK / INDEX / トリガー / 拡張)
- verify 10 セクション (各 migration 後、期待値コメント付き)
- runbook 11 ステップ: 各 Step 期待出力 + 検証 SQL + 失敗時アクション
- garden-dev 環境限定明記、本番誤実行防止
- 段階的 apply (Step 0-11 で各 Step 後 verify)、各 RLS apply 含む

## ⚠️ 軽微改善 3 件（apply 前確認 + 中 watch 項目）

| # | 改善 | 緊急度 | 対応タイミング |
|---|---|---|---|
| #1. rollback 手順の各 Step 紐付け明確化 | runbook §9 にあるが各 Step との対応明示推奨 | 🟡 apply 前 | runbook 追記 |
| #2. dry-run 機能 | preflight は SELECT 相当、migration 本体は直接実行 → preview / `BEGIN ROLLBACK` 推奨 | 🟢 apply 中 | watch 項目 |
| #3. application code 影響範囲 grep | runbook で soil_* 参照箇所の grep 結果明示なし → Bloom / Forest / Tree 等の影響確認推奨 | 🟢 apply 前 | application code 確認 |

## runbook 追記推奨

- 各 Step の「失敗時アクション」欄に rollback コマンド明示
- 各 migration の「内容 preview / BEGIN ROLLBACK で動作確認」を Step 開始時に明示

## a-tree-002 への事前通知項目

- preflight Section 4 (inbound FK) 結果 → Tree D-01 spec 修正 #290 への入力
- rename 後の Tree side 影響範囲確認 (Tree D-01 SQL 内で soil_call_history を参照する箇所)
- legacy soil_call_history_legacy_tree_20260511 の data retention (Tree が将来参照する可能性の有無)

## Bloom 視点影響 ✅

- Phase A-2 統合 KPI (PR #150) は現状 Forest 法人別月次売上のみ、Soil 参照なし
- 将来 Bloom 統合 KPI で Soil 集計時、PARTITIONED soil_call_history (本 PR で apply される新規テーブル) を参照
- materialized view `soil_lists_assignments` (Step 4 で作成) を Bloom 集計 base 候補として活用可
- rename された legacy は Bloom 参照外、5/12-13 apply 後の Bloom 影響なし

## scope 観察（情報共有）

- PR diff: 31 files / +5,579 / 0 deletions (PR #166 メタ "4 ファイル / 930 行" との乖離)
- 推測: PR #152 (Soil Phase B-01 implementation) と base 共有、未 merge 上流 PR 含む可能性
- merge 戦略は a-soil-002 + 東海林さん確認推奨、merge 自体は阻害なし

レビューコメント: https://github.com/Hyuaran/garden/pull/166 (shoji-hyuaran COMMENTED 2026-05-11T09:14:33Z)

# # 3. 後続アクション

## 3-1. Soil apply (5/12-13) GO/NoGO 判定

✅ **GO** (apply 進行 OK)

事前修正項目（apply 前）:
- #1 rollback 手順の各 Step 紐付け明示 (runbook 追記、a-soil-002 担当)
- #3 application code 影響範囲 grep (Bloom / Forest / Tree 確認、a-soil-002 担当)

apply 中の watch 項目:
- #2 dry-run なし → 各 migration を Dashboard で preview してから Run
- 各 Step 後の verify SQL 結果 = 期待値と一致確認

## 3-2. Leaf 修復計画 (PR #165) 後続フロー

| Step | 担当 |
|---|---|
| 1. 業務ヒアリング (Bloom KPI フィールド含む) | 東海林さん + a-leaf-002 |
| 2. 親 CREATE migration 起草 | a-leaf-002 |
| 3. apply + 既存 PR 8 件 apply | 東海林さん + a-leaf-002 |
| 4. 検証 + D.14 カバレッジ測定 | a-leaf-002 |
| 5. Phase D 100% 完成宣言 | a-leaf-002 + 東海林さん |

# # 4. 累計 review 統計

**16 PR review 完走** ✅ (#149-#166 連続):
- #147 / #148 / #149 / #151 / #152 / #153 / #154 / #155 / #156 / #157 / #158 / #162 / #163 / #164 / **#165** / **#166**
- main 反映済: 5 PR (#148 / #154 / #155 / #156 / #163)
- 本 No. 19 で +2 PR review、累計 16 PR

評価軸:
- 設計判断 / 教訓抽出 / 横展開提案 = 3 軸安定
- Bloom 視点での横モジュール影響評価
- scope 観察 (PR #148 / #156 / #166 等の base spillover 検出)

# # 5. self-check

- [x] 冒頭 3 行 ~~~ 内配置 (v5.1/v5.2 完全準拠)
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] 16 観点 × 2 PR = 32 チェック完了
- [x] 0. TL;DR 1 行で総合判定
- [x] # 1: PR #165 16 観点判定表 + Bloom 観点追加提案 3 件 + Phase D 完成順序
- [x] # 2: PR #166 16 観点判定表 + 軽微改善 3 件 + runbook 追記推奨 + a-tree-002 事前通知項目
- [x] # 3: 後続アクション (Soil apply GO + Leaf 修復後続フロー)
- [x] # 4: 累計 16 PR review 通算評価
- [x] # 5: self-check 32 チェック完了確認
- [x] レビューコメント URL + timestamp 明記
- [x] 番号 = bloom-006- No. 19
- [x] 期限 2026-05-11 23:00 前完走 (5/12 apply 判断間に合う)
