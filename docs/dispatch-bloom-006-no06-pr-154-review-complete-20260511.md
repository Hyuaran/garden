# 🟢 bloom-006- No. 6
【a-bloom-006 から a-main-020 への dispatch（PR #154 レビュー完走報告）】
発信日時: 2026-05-11(月)

# 件名

main- No. 241 依頼分 PR #154 (Batch 7 cross-rls-helpers) レビュー完走（7 観点完走、採用推奨 + 軽微改善 2 件）+ Tree Phase D §0 着手前提条件解消への寄与確認

# PR #154 レビュー結果

| 観点 | 結果 |
|---|---|
| 1. FK 整合 (root_employees / auth.uid()) | ✅ |
| 2. 認証ロール 8 段階階層判定 | ✅ |
| 3. Bloom 衝突 (既存 helper 維持) | ✅ + 段階置換の将来余地 |
| 4. 旧版データ保持 | ✅ 削除なし、追加のみ |
| 5. auth_employee_number() 実装 | ✅ + 軽微 #1 (search_path) |
| 6. has_role_at_least() 実装 | ✅ CTE 拡張容易 |
| 7. is_same_department 縮退 | ✅ コメント詳細、追跡可能 |

総評: **採用推奨** ✅、merge 阻害なし。

主要観察:
- SECURITY DEFINER + STABLE で RLS 内部から安全呼出可
- 8 段階階層 (toss < closer < cs < staff < outsource < manager < admin < super_admin) を CTE で role_order テーブル化 = 拡張容易
- `COALESCE(... >= ..., false)` で未認証 / 不正 role_min を防御的に false 返却
- 既存 helper（current_garden_role / root_can_access / root_can_write / root_is_super_admin / tree_can_view_confirm / bloom_has_access）全維持、削除なし
- spec §6.1 v2 + §9 改訂で命名規則 + 決裁経緯（dispatch main- No. 233 Q1/Q2/Q3）trace 明記
- is_same_department 縮退の migration コメントが詳細（縮退理由 + 縮退対応 + 将来実装条件 3 点 + 着手時期）

改善提案（軽微、本 PR or 別 PR で対応可）:
- **#1. SECURITY DEFINER 関数の search_path 明示推奨**: A-1c v3.2 known-pitfalls #9 準拠、`SET search_path = ''` 追記推奨。既存 current_garden_role 等も同様の検討余地、別 PR 一括対応も可
- **#2. apply 後動作確認 SQL の runbook 化（検討）**: 既存 migration コメントの「機能確認」SELECT 文を独立 runbook 化、apply 自動化 / CI 統合時の検証スクリプト化容易

レビューコメント: https://github.com/Hyuaran/garden/pull/154 (shoji-hyuaran COMMENTED 2026-05-11T03:02:39Z)

# spec 改訂 (§6.1 + §9) 評価

**§6.1 命名規則 v2** ✅:
- global 名空間採用 (auth_ / has_ / is_ prefix) 明確に定義
- 既存 module 別 helper 維持を明示（破壊的変更回避）
- 旧「<module>_has_role 統一」廃止 + 旧「Phase C で garden_has_role 抽出」予定 廃止
- garden_* prefix 不採用と記録

**§9 判3 解消** ✅:
- 「Phase C で抽出予定」→「2026-05-11 確定で本 PR 実装完了」
- 決裁経緯 trace 明記

# Tree Phase D §0 着手前提条件解消への寄与

✅ **本 PR merge + apply 後、a-tree-002 が Tree D-01 spec §4.1 改訂可能**:
- 旧: `USING (has_role_at_least('manager') AND is_same_department(employee_id))`
- 新: `USING (has_role_at_least('manager') AND employee_id = auth_employee_number())`
- → 「自分担当 only」縮退で Phase D §0 解消

apply タイミング:
| Step | 状態 |
|---|---|
| 1. a-root-002 migration + spec + PR 起票 | ✅ 完了 (root-002-38) |
| 2. 東海林さん最終決裁 + PR review | ✅ a-bloom-006 観点提示完了 (本報告) |
| 3. garden-dev apply → 動作確認 | ⏳ 待機 |
| 4. garden-prod apply | ⏳ 待機 |
| 5. a-tree-002 Tree D-01 spec §4.1 改訂 + Phase D §0 解消 | ⏳ 待機 |

# 既存 helper 段階置換の Bloom 側余地（参考）

main- No. 241 §5 既存 helper deprecation 候補（参考）に対する Bloom 観点:

| 既存 helper | 段階置換候補 | Bloom 側影響 |
|---|---|---|
| `root_can_access()` | `has_role_at_least('manager')` | 該当なし、Root 内部のみ |
| `root_can_write()` | `has_role_at_least('admin')` | 該当なし、Root 内部のみ |
| `root_is_super_admin()` | `has_role_at_least('super_admin')` | 該当なし、Root 内部のみ |
| `bloom_has_access` (将来検討) | `has_role_at_least(...)` 経由 | Bloom 側で別 PR にてリファクタ余地あり |

→ Bloom 側 `bloom_has_access` の段階置換は急務なし、別 PR で将来検討。

# 並行確認

| 項目 | 状態 |
|---|---|
| PR #150 mergeStateStatus | CLEAN ✅ |
| PR #150 Vercel Preview | SUCCESS ✅ |
| PR #147 / #152 / #154 レビュー | すべて COMMENTED post 済 ✅ |
| PR #148 / #149 レビュー | 引き続き着手中（No. 7 候補）|

# 次に想定される作業

1. PR #148 / #149 レビュー完走（No. 7 候補）
2. PR #154 merge + apply 後の a-tree-002 連携確認（main 経由 dispatch 受領待ち）
3. PR #150 / #147 / #152 / #154 merge 待ち（東海林さん最終判断）
4. unrelated 14 test 別 issue 起票（任意）
5. a-root-002 連携 #1 + #3（5/9 以降、handoff §🔴2 参照）

# self-check

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時（~~~ 内配置、v5.1 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] 7 観点完走（共通 4 + 独自 3）
- [x] 採用推奨 + 改善 2 件（軽微）明示
- [x] レビューコメント URL + timestamp 明記
- [x] spec 改訂 (§6.1 + §9) 評価追加
- [x] Tree Phase D §0 着手前提条件解消への寄与確認
- [x] apply タイミング 5 step 表で trace
- [x] 既存 helper 段階置換の Bloom 側余地 (参考) 共有
- [x] 番号 = bloom-006- No. 6（main- No. 241 §6 期待値準拠）
