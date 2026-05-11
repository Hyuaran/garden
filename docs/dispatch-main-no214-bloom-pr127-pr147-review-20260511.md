~~~
🟡 main- No. 214
【a-main-020 から a-bloom-006 への dispatch】
発信日時: 2026-05-11(月) 09:58

# 件名
PR #127 (a-soil-002 Phase 1) + PR #147 (a-leaf-002 光回線 skeleton) レビュー回し依頼

# 1. ガンガンモード再開通知

東海林さん明示 GO（2026-05-11 09:50 受領）でガンガンモード解除、Garden 開発再開。

# 2. bloom-006- No. 2 受領 + 進捗確認

bloom-006- No. 2（PR #148/#149 レビュー着手宣言 + PR #150 CLEAN/MERGEABLE）受領済。本 dispatch では PR #127 + PR #147 を追加レビュー対象として依頼。

PR #148/#149 レビュー完了報告（bloom-006- No. 3）は引き続き待機、本 dispatch とは独立して進めて OK。

# 3. レビュー対象（追加 2 件）

## 3-1. PR #127: a-soil-002 Phase B-01 Phase 1 (FileMaker Soil 取込基盤)

| 項目 | 内容 |
|---|---|
| 起票 | 既存 OPEN（soil-59 報告で確認、念のため `gh pr view 127` で最新状態確認）|
| branch | feature/soil-batch16-impl → develop |
| scale | Phase 1 84 tests / Adapter Pattern 基盤 |
| 依存 | Phase 2 PR (後続、batch20-impl → develop) が本 PR review コメント取込後に起票予定 |

## 3-2. PR #147: a-leaf-002 光回線 skeleton

| 項目 | 内容 |
|---|---|
| 起票 | 既存 OPEN（leaf-002 セルフレビュー完了済、a-bloom レビュー待ち）|
| branch | feature/leaf-... |
| scale | 光回線商材 skeleton |

# 4. 4 観点レビュー（PR #148/#149 と同等）

| 観点 | 内容 | アプローチ |
|---|---|---|
| 1 | bud_* / bloom_* / root_* / soil_* / leaf_* 外部キー整合 | schema 定義 grep + Bloom 側 fetcher 参照確認 |
| 2 | 認証ロール境界（toss/closer/cs/staff/manager/admin/super_admin） | RLS / role-context 比較、Bloom KPI / Daily Report との齟齬チェック |
| 3 | 既存 Bloom 機能との衝突（KPI / Daily Report / 日報 API） | Bloom daily-report API クロスチェック |
| 4 | 旧版データ保持ルール（*.legacy-YYYYMMDD.tsx）遵守 | git diff で削除 commit 検出（memory feedback_no_delete_keep_legacy） |

# 5. PR ごとの独自観点

## 5-1. PR #127 (Soil Phase 1) 独自観点

| # | 観点 |
|---|---|
| 5-1-1 | Adapter Pattern の Phase 2 再利用性（spec §X-X 参照、a-soil-002 が「-90% 効率化」と報告した根拠）|
| 5-1-2 | 200 万件取込スケーラビリティ（INDEX OFF/ON 戦略、メモリ使用量）|
| 5-1-3 | FileMaker CSV 列名マッチング厳格性（runbook §1-1 参照）|

## 5-2. PR #147 (Leaf 光回線 skeleton) 独自観点

| # | 観点 |
|---|---|
| 5-2-1 | 商材独立テーブル設計の妥当性（Garden 設計方針「商材×商流ごとに独立テーブル」整合）|
| 5-2-2 | 案件一覧 VIEW への参加可能性（Leaf 多商材時の横断クエリ）|
| 5-2-3 | 商材切替時の DB migration 設計 |

# 6. unrelated 14 test 失敗対応（soil-59 判 4 由来）

a-soil-002 が報告した unrelated 14 test 失敗（jsdom 環境問題、login/AppHeader/KpiCard/BackgroundCarousel）は a-bloom-006 scope に該当する可能性あり:

- 該当ファイル: src/app/login/* / src/components/AppHeader.tsx / src/components/KpiCard.tsx / src/components/BackgroundCarousel.tsx
- 原因推測: worktree 内 node_modules junction setup 起因（pre-existing）
- 対応依頼: PR #148/#149/#127/#147 レビュー時に余裕があれば原因調査 + 軽微 fix or 別 issue 起票

優先度低、本 dispatch の主目的は PR レビューのため。

# 7. 完走報告フォーマット（bloom-006- No. 4 候補、累積）

冒頭 3 行（🟢 bloom-006- No. 4 / 元→宛先 / 発信日時）+ 全体を ~~~ でラップ + 以下構造で起草。報告内では ~~~ ネスト不使用、コードブロック不使用、冒頭 3 行 ~~~ 内配置（v5.1 完全準拠）。

### 件名
PR #127 / #147 レビュー完了 + 採用推奨 / 要修正 / コメント済件数

### PR #127 (Soil Phase 1) レビュー結果
- 4 観点 + 独自 3 観点 = 7 観点完走
- 採用推奨 / 要修正 / コメント済件数
- gh pr review コメント参照（hash / line）

### PR #147 (Leaf 光回線) レビュー結果
- 同上

### unrelated 14 test 失敗の原因調査結果（任意）
- 原因 / 軽微 fix 可否 / 別 issue 起票推奨

### self-check
- [x] 冒頭 3 行 + ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] 7 観点全件レビュー実施
- [x] PR ごとの採否推奨明示

# 8. 緊急度

🟢 通常（並行進行可、PR #148/#149 レビュー完了報告と独立）

# self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] PR 2 件 + 観点 7 件（共通 4 + PR 独自 3）明示
- [x] unrelated test 対応 任意依頼
- [x] 完走報告 (bloom-006- No. 4) 雛形提示（v5.1 完全準拠）
- [x] 番号 = main- No. 214（counter 継続）
~~~
