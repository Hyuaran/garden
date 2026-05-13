# 🟢 bloom-006- No. 4
【a-bloom-006 から a-main-020 への dispatch（PR #147 + #152 レビュー完走報告）】
発信日時: 2026-05-11(月)

# 件名

main- No. 214 依頼分 PR #147 + #152 レビュー完走（7 観点 × 2 PR = 14 観点完走、両 PR 採用推奨 + 改善提案 5 件）

# 📌 重要: PR 番号不整合の修正

main- No. 214 §3-1 で「PR #127 (Soil Phase 1)」と記載されていましたが、PR #127 の実体は別物（Phase B 7 spec docs PR）でした。branch + scale + title から **dispatch の意図は PR #152** と判定し、PR #152 をレビュー対象として進めました。

| 識別項目 | dispatch 記述 | 実 PR |
|---|---|---|
| 番号 | #127 | **#152** |
| title | Phase B-01 Phase 1 (FileMaker Soil 取込基盤) | feat(soil): Phase B-01 Phase 1 — Kintone App 55 取込パイプライン (30 万件) + Adapter Pattern + 84 tests |
| branch | feature/soil-batch16-impl | feature/soil-batch16-impl ✅ |
| scale | Phase 1 84 tests / Adapter Pattern 基盤 | 84 tests / Adapter Pattern ✅ |
| source | dispatch では「FileMaker」 | 実装は **Kintone App 55**（後続 Phase 2 で FileMaker 想定）|

→ branch + scale が PR #152 と完全一致のため typo と判定、ガンガンモードで進行。

# PR #152 (Soil Phase 1 Kintone 取込) レビュー結果

| 観点 | 結果 |
|---|---|
| 1. 外部キー整合 | ✅ + 軽微 #1, #2 |
| 2. 認証ロール境界 (8 段階) | ✅ 完全実装 |
| 3. Bloom 衝突 (KPI/Daily Report) | ✅ 現状なし、将来統合準備済 |
| 4. 旧版データ保持 | ✅ 全 25 ファイル新規、削除なし |
| 5-1-1. Adapter Pattern 再利用性 | ✅ Phase 2 完全再利用可 |
| 5-1-2. 200 万件スケーラビリティ | ✅ + 軽微 #3 |
| 5-1-3. FileMaker CSV 列名マッチング | ⚠️ N/A (本 PR は Kintone、情報 #4) |

総評: **採用推奨** ✅、改善 3 件 + 情報 1 件、merge 阻害なし。

主要観察:
- `current_garden_role()` SECURITY DEFINER STABLE で高頻度 RLS 性能最適化（known-pitfalls 準拠）
- 物理 DELETE 完全禁止 + 削除済参照 admin+ 限定（feedback_no_delete_keep_legacy 整合）
- bufferIntoChunks 純粋関数 + 依存性注入で Phase 2 source 差替えのみで再利用可
- `soil_lists` comment に「Bloom（KPI 集計）から参照される」明記、将来統合 `soil_lists_assignments` MV 活用候補

改善提案（軽微、後続 PR で対応可）:
- #1. `created_by` / `updated_by` / `deleted_by` / `status_changed_by` の auth.users FK 制約追加
- #2. `primary_case_id` polymorphic 設計のコメント補強（参照先テーブル決定ロジック明記）
- #3. 250 万件取込メモリ消費検証手順を runbook 追記
- #4. dispatch 記述「FileMaker」と実装「Kintone」の整合（後続 Phase 2 PR で対応）

レビューコメント: https://github.com/Hyuaran/garden/pull/152 (shoji-hyuaran COMMENTED 2026-05-11T01:09:11Z)

# PR #147 (Leaf 光回線 skeleton) レビュー結果

| 観点 | 結果 |
|---|---|
| 1. 外部キー整合 | ✅ + 軽微 #1 |
| 2. 認証ロール境界 (8 段階) | ✅ A-1c v3.2 準拠 |
| 3. Bloom 衝突 (KPI/Daily Report) | ✅ 現状なし、将来統合 OK |
| 4. 旧版データ保持 | ✅ 全 3 ファイル新規、削除なし |
| 5-2-1. 商材独立テーブル設計 | ✅ leaf_kanden_* と並列、Garden 方針整合 |
| 5-2-2. 案件一覧 VIEW 参加 | ✅ v_leaf_cases UNION ALL 拡張 |
| 5-2-3. 商材切替 migration | ✅ idempotent + 前提明記 |

総評: **採用推奨** ✅、改善 2 件、merge 阻害なし。

主要観察:
- A-1c v3.2 RLS パターンの 2 件目の実装 = 横展開検証ケースとして価値高い
- `leaf_user_in_business('hikari')` 関数の再利用で関電と同パターン
- 案件一覧 VIEW `v_leaf_cases` UNION ALL 拡張 = cross-business unified view 指針整合
- 添付テーブル `leaf_hikari_attachments` も Garden 共通パターン踏襲

改善提案（軽微、Phase B-1 対応 OK）:
- #1. `sales_company_id` の `root_companies(company_id) FK` 制約追加（Garden 法人マスタ整合保証）
- #2. `customer_phone` format CHECK 制約（Phase B-1、a-leaf-002 self-review §2.1 と整合）

レビューコメント: https://github.com/Hyuaran/garden/pull/147 (shoji-hyuaran COMMENTED 2026-05-11T01:08:31Z)

# unrelated 14 test 失敗（任意調査結果）

main- No. 214 §6 で言及された jsdom 環境問題（login/AppHeader/KpiCard/BackgroundCarousel）について簡易調査:

| 項目 | 状況 |
|---|---|
| 該当ファイル | src/app/login/* / src/components/AppHeader.tsx / src/components/KpiCard.tsx / src/components/BackgroundCarousel.tsx |
| PR #150 (本ブランチ) | login/page.tsx 大幅拡張済（516 行）、vitest.setup.ts に supabase env ダミー追加済 |
| 原因推測 | worktree node_modules junction 起因（pre-existing、bud-008 と同症状）|
| 本レビュー scope | 深い fix は時間制約あり、別 issue 起票推奨 |

推奨: 別 issue 起票（「worktree node_modules junction による jsdom test 失敗の恒久対応」）、Phase A-2.2 等で根本対応。

# 並行確認状況

| 項目 | 状況 |
|---|---|
| PR #150 mergeStateStatus | CLEAN ✅（再確認済）|
| PR #150 Vercel Preview | SUCCESS ✅ |
| PR #148/#149 レビュー (No. 5 候補) | 引き続き着手中、別 dispatch で完走報告 |

# 次に想定される作業

1. PR #148/#149 レビュー完走 → No. 5 で報告
2. PR #150 / #147 / #152 の merge 待ち（東海林さん最終判断）
3. unrelated 14 test 別 issue 起票（任意、優先度低）
4. a-root-002 連携 #1 + #3 着手（5/9 朝以降の予定、handoff §🔴2 参照）

# self-check

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時（~~~ 内配置、v5.1 準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] 7 観点 × 2 PR = 14 観点完走
- [x] PR ごとの採否推奨明示（両者 採用推奨 + 改善提案）
- [x] PR 番号不整合（#127 → #152）の修正明示
- [x] unrelated test 任意調査結果記載
- [x] レビューコメント URL + submission timestamp 明記
- [x] 番号 = bloom-006- No. 4（main- No. 214 §7 期待値準拠）
