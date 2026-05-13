# 🟢 bloom-006- No. 12
【a-bloom-006 から a-main-021 への dispatch（PR #156 レビュー完走報告、🔴 critical path）】
発信日時: 2026-05-11(月)

# 件名

main- No. 262 依頼分 PR #156 (Tree D-01 SQL §7 RLS) レビュー完走（7 観点完走、採用推奨 + ⚠️ scope 観察 1 件）+ Tree Phase D §0 着手前提条件解消への最終寄与確認

# PR #156 レビュー結果

| 観点 | 結果 |
|---|---|
| 1. FK 整合 (tree_* → root_employees) | ✅ |
| 2. 認証ロール 8 段階 + has_role_at_least 使用 | ✅ |
| 3. Bloom 衝突 | ✅ Tree 内部完結 |
| 4. 旧版データ保持 (DROP POLICY IF EXISTS) | ✅ 冪等性 + down migration |
| 5. is_same_department 縮退の妥当性 | ✅ 一時縮退として明確化 |
| 6. Batch 7 関数 (auth_employee_number / has_role_at_least) 整合 | ✅ 既 apply 済 |
| 7. PR #128 と本 PR の関係 | ⚠️ scope 観察 |

総評: **採用推奨** ✅、merge 阻害なし。

# 主要観察

- RLS 縮退実装の正確性: 3 テーブル × 3 ポリシー (`tcs_select_manager` / `tcr_select_manager` / `taa_select_manager` + `taa_insert_manager` + `taa_update_manager`) 全件 `employee_id = auth_employee_number()` 縮退反映確認
- migration コメント明示: 縮退理由 (Batch 7 PR #154) + 旧/新の対比 + 将来再導入条件
- 冒頭 DO ブロックで前提依存チェック (root_employees / soil_call_lists / audit_logs / auth_employee_number)
- 冪等性 54 箇所 (IF NOT EXISTS / OR REPLACE / DROP IF EXISTS)
- down migration 135 行で rollback 可能
- Batch 7 関数は既 apply 済 (garden 14:00 JST)、merge + apply で即動作

# ⚠️ scope 観察 (dispatch 記述と PR 実体の差)

| 項目 | dispatch 記述 | 実 PR |
|---|---|---|
| 差分 | 1 ファイル / +30 -13 | **4 ファイル / +992 -0** |
| 変更内容 | §7 RLS の縮退のみ | **完全な D-01 schema migration** (694 行 SQL + 135 行 down + 162 行 handoff + effort-tracking +1) |
| 推測 | feature/tree-phase-d-01-reissue (commit 45decb4) との diff | develop との diff (PR #128 未 merge のため SQL ファイル新規扱い) |

確認推奨事項:
- PR #128 の閉鎖タイミング (本 PR merge 後に close 想定？)
- merge 戦略 (PR #156 が PR #128 supersede + PR #128 close、or PR #128 先 merge + PR #156 rebase？)
- a-tree-002 + 東海林さんに最終確認推奨

ただし: merge 自体は阻害なし。PR #156 単独で完全な D-01 schema を提供しており、Batch 7 関数も apply 済のため即動作可能。Phase D §0 着手前提条件解消の最終ピースとして機能 ✅

# spec ↔ SQL 完全整合確認

| 改訂対象 | PR | 状態 |
|---|---|---|
| spec D-01 §4 RLS 改訂 | PR #155 | ✅ merged |
| spec §12 改訂履歴 v1.1 trace | PR #155 | ✅ merged |
| SQL §7 RLS 縮退対応 | **PR #156** | 🟡 本 review (採用推奨) |

→ 本 PR merge で **spec ↔ SQL 完全整合**達成 ✅

# Tree Phase D §0 着手前提条件への寄与（最終ピース）

| Step | 状態 |
|---|---|
| 1. PR #154 (cross-rls-helpers migration) merge | ✅ 完了 |
| 2. garden-dev/prod apply | ✅ 完了 |
| 3. PR #155 (Tree D-01 §4 spec 改訂) merge | ✅ 完了 |
| 4. **PR #156 (Tree D-01 SQL §7 RLS) merge** | 🟡 本 review (採用推奨) |
| 5. garden apply (PR #156) | ⏳ 待機 |
| 6. **Tree Phase D §0 着手前提条件 完全解消** | ⏳ 本 PR merge + apply 後 |

→ 🔴 後道さんデモ前 critical path 直結、緊急度認識 + 即時 review 完走 ✅

# レビューコメント

| PR | URL | timestamp |
|---|---|---|
| #156 | https://github.com/Hyuaran/garden/pull/156 | shoji-hyuaran COMMENTED 2026-05-11T05:11:46Z |

# 累計 review 件数 (a-bloom-006)

**7 PR**: #147 / #148 / #149 / #152 / #154 / #155 / #156 すべて COMMENTED post 済 ✅

| PR | 状態 | main 反映 |
|---|---|---|
| #154 | ✅ merged + applied | ✅ |
| #155 | ✅ merged | ✅ |
| #147 / #148 / #149 / #152 / #156 | ⏳ merge 待ち | - |

→ Garden 横断品質保証の中核 review として 7 PR 完走、Phase D §0 着手前提条件解消の最終ピース寄与達成。

# Bloom 観点での補足（情報共有）

- 本 PR merge で manager の Tree データ可視範囲が「自分担当 only」に縮退
- Bloom 統合 KPI (Phase A-2.2-4) で Tree データを manager 視点集計する場合、本縮退状態の認識必要
- 現状: 影響なし (Bloom Phase A-2.1 は Tree placeholder のみ)
- 将来: Phase A-2.2 着手時に Tree 側 RLS 状況再確認推奨

# 並行確認

| 項目 | 状態 |
|---|---|
| PR #150 mergeStateStatus | CLEAN ✅ |
| PR #150 Vercel Preview | SUCCESS ✅ |
| PR #156 mergeStateStatus | MERGEABLE ✅ |
| PR #156 Vercel Preview | SUCCESS ✅ |
| 累計 a-bloom-006 review | 7 PR (6 完走 + 1 本報告) ✅ |

# 次に想定される作業

1. PR #156 merge + apply 待機 (東海林さん最終判断 + a-tree-002 PR #128 閉鎖戦略確認)
2. PR #148 base sync 完了後の再 review (main 経由依頼待ち)
3. PR #153 (Tree Phase D plan v3.1) review (main 経由依頼候補)
4. 残 PR (#147 / #148 / #149 / #150 / #152) merge 待ち (東海林さん最終判断)
5. unrelated 14 test 別 issue 起票 (任意、優先度低)

# self-check

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時 (~~~ 内配置、v5.1/v5.2 完全準拠)
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] 7 観点完走 (共通 4 + 独自 3)
- [x] 採用推奨 + scope 観察 1 件 明示
- [x] レビューコメント URL + timestamp 明記
- [x] PR #128 との関係 scope 観察詳細
- [x] spec ↔ SQL 完全整合確認 + Tree Phase D §0 解消フロー 6 step 進捗 trace
- [x] 累計 7 PR review (6 完走 + 1 本報告) 認識共有
- [x] 番号 = bloom-006- No. 12 (main- No. 262 §F 「報告フォーマット No. 12 以降」準拠)
- [x] 緊急度 🔴 認識 + 即時対応完了
