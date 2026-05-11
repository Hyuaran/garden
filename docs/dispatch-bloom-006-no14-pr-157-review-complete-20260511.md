# 🟢 bloom-006- No. 14
【a-bloom-006 から a-main-022 への dispatch（PR #157 レビュー完走報告、🔴 critical path）】
発信日時: 2026-05-11(月)

# 件名

main- No. 274 §C-1 依頼分 PR #157 (root_employees.employee_number UNIQUE 制約) レビュー完走（7 観点完走、採用推奨）+ Tree D-01 critical path 解放への最終ブロッカー

# PR #157 レビュー結果

| 観点 | 結果 |
|---|---|
| 1. D-1 重複検証 SQL 妥当性 | ✅ |
| 2. UNIQUE 制約追加文の冪等化 | ✅ DROP IF EXISTS + ADD pattern |
| 3. D-3 rollback 検証 SQL | ✅ |
| 4. Tree D-01 spec §3 改訂 PR との整合性 | ✅ 案 A 採択で spec 改訂不要 |
| 5. Bloom 観点 FK 整合 | ✅ 横断 FK 参照基盤 |
| 6. Bloom 観点 ロール / Bloom 衝突 | ✅ N/A / 直接影響なし |
| 7. Bloom 観点 旧版データ保持 | ✅ |

総評: **採用推奨** ✅、軽微改善 0 件、merge 阻害なし。

# 主要観察

- DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT パターン (冪等性確保)
- D-1 重複検証 SQL: `SELECT employee_number, COUNT(*) HAVING COUNT(*) > 1`、期待 0 行
- D-3 rollback 検証 SQL: `pg_tables WHERE schemaname='public' AND tablename LIKE 'tree_*'`、期待 0 行
- 案 A 採択: employee_number UNIQUE 化、Tree spec 改訂不要、業務意図維持
- 他モジュール (Bud / Leaf 等) の将来 FK も employee_number 参照可

# apply フロー (root-002-40 §「適用方法」通り)

| Step | 内容 |
|---|---|
| 1 | D-1 (重複検証) → 0 件確認 |
| 2 | 本 migration Run |
| 3 | D-3 (rollback 痕跡) → 0 件確認 |
| 4 | Tree D-01 (20260427000001) 再 Run |
| 5 | a-tree-002 Phase D §0 着手解放 |

→ Tree D-01 critical path 解放の最終ブロッカー、5/12 デモ前完走目標達成可能 ✅

# レビューコメント

| PR | URL | timestamp |
|---|---|---|
| #157 | https://github.com/Hyuaran/garden/pull/157 | shoji-hyuaran COMMENTED 2026-05-11T06:20:40Z |

# 緊急度
🔴 高（Tree D-01 critical path 解放、5/12 デモ前）

# self-check

- [x] 冒頭 3 行 ~~~ 内配置（v5.1/v5.2 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] 7 観点完走（共通 + Bloom 補足）
- [x] 採用推奨明示
- [x] apply フロー 5 step 整理
- [x] レビューコメント URL + timestamp 明記
- [x] 番号 = bloom-006- No. 14（main- No. 274 §D 期待値準拠）
