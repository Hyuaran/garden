# dispatch main- No. 350 — Bloom PR #150 独立レビュー起票（Phase A-2 統合 KPI + Garden 統一認証 + Daily Report MVP、13,327 行 / 94 files / 53 commits、6 優先事項評価）

> 起草: a-main-026（清書: a-writer-001）
> 用途: a-review-001（独立 review セッション、新規起動）への PR #150 客観レビュー依頼
> 番号: main- No. 350
> 起草時刻: 2026-05-13(水) 16:20（powershell.exe Get-Date 取得済、UTF-8 明示）
> 投下経路: a-main-026 が東海林さんへ投下用短文を提示 → 東海林さんが新規 a-review-001 セッションにペースト
> 副投下先: a-bloom-006（修正対応の場合のみ、別 dispatch # 351 以降で起票）

---

## 東海林さん向け 状況サマリ（4 列テーブル）

| 論点 | 推奨 | 論点要約 | 推奨要約 |
|---|---|---|---|
| 大きさ 13,327 行の PR を誰が見るか | 独立 a-review-001 を新規起動（客観性確保）| Bloom 担当（a-bloom-006）が自分の PR を自分で review すると客観性が損なわれる | review 専用セッションを別に立ち上げ、Bloom 担当は修正対応のみ |
| 何を見るか | 6 つの優先事項を GREEN / YELLOW / RED で判定 | 認証 / KPI / Daily Report / develop 連動 / 後道さん UI 等、判定基準を統一 | 各優先事項を観点別に評価、判定結果を md 1 件に集約 |
| 急ぐ必要があるか | 🟡 中（後道さん 5/13 UI 確認連動）| 本来 🟢 だが、本日 apply 済 Forest m4/m5 を ForestKpiCard が参照できないとデモが崩れる | 当日中に review 完走、RED 検出時は修正 dispatch # 351 以降で対応 |
| 完了判定 | review 結果 md 提出 + merge 可否判断 | 「OK / 修正後 OK / 分割提案 / 再起票推奨」の 4 択を明示 | 集計サマリ + RED/YELLOW 項目の修正提案 + 後道さん UI 前提整合検証 |

---

## 投下用短文（東海林さんがコピー → a-review-001 新規セッションにペースト）

~~~
🟡 main- No. 350
【a-main-026 → a-review-001 への dispatch（Bloom PR #150 独立レビュー起票、13,327 行 / 6 優先事項評価）】
発信日時: 2026-05-13(水) 16:20

# 件名
PR #150（feat(bloom): Phase A-2 統合 KPI + Garden 統一認証 + Daily Report MVP + 法人アイコン）の独立レビュー、6 優先事項 GREEN/YELLOW/RED 判定 + 後道さん 5/13 UI 整合検証

# A. 依頼内容
a-review-001 は本セッション専用で独立 review を実施。a-bloom-006 が起票した PR #150（13,327 additions / 94 files / 53 commits、main 直行、OPEN）を、客観性を保ちつつ §C の 6 優先事項で評価。期待アウトプットは §F の review 結果 md。

# B. 背景（確定客観事実）

## B-1. PR #150 規模感
- PR 番号: #150
- タイトル: feat(bloom): Phase A-2 統合 KPI + Garden 統一認証 + Daily Report MVP + 法人アイコン
- ブランチ: `feature/bloom-6screens-vercel-2026-05-006` → `main`（**直行**）
- 規模: 53 commits / **13,327 additions** / 94 files
- state: OPEN
- 起票元: a-bloom-006（branch 名末尾 `-006`、累積 003 → 004 → 005 → 006）

## B-2. 主要成果（PR body より要約）
- Garden 統一認証ゲート: 統一 Login v8（claude.ai 起草版 React 化）+ Garden Home v9 unified（1,050 行）+ GardenHomeGate（admin/super_admin 限定）+ ROLE_LANDING_MAP（7 段階ロール対応）+ legacy 3 ファイル保持
- Phase A-2.1 統合 KPI ダッシュボード: `/bloom/kpi/page.tsx` + UnifiedKpiGrid + ForestKpiCard + PlaceholderKpiCard（Tree/Bud/Leaf 準備中）+ vitest 5 tests PASS
- Daily Report MVP: API route 278 行 + page 525 行 + legacy placeholder 保持
- 6 法人 + hyuaran-group-hd アイコン: garden-corporations.ts 143 行 + WebP 6 法人 + bg-night-garden-with-stars + logo-garden-series 配置

## B-3. 連動マイルストーン
- 後道さん 5/13 仕訳帳本番運用 UI 確認（handoff-026.md §2 Action 8、🟡）と連動
- PR #150 の ForestKpiCard が本日 apply 済 Forest m4/m5（6 法人 / 12 口座 / 714 共通仕訳マスタ）を参照可能か = 後道さん UI 確認の前提整合性
- 5/13 仕訳帳本番運用ゲート解放（PR #172 merge + 3 migration apply 完了）と整合

# C. 6 つの優先事項（review 観点、緊急度別）

## 🔴 優先事項 1: 規模感の妥当性
- 13,327 additions / 94 files / 53 commits が 1 PR にまとまっている妥当性
- main 直行 = 本番直接反映 → 部分 revert が困難、commit 単位での切戻し可能性確認
- 53 commits の論理単位 = 主要成果 4 領域 + spec/plan 起草に対応しているか

## 🔴 優先事項 2: Garden 統一認証ゲート実装品質
- claude.ai 起草版 React 化の忠実度（v8 統一ログイン画面）
- ROLE_LANDING_MAP の 7 段階ロール対応漏れなし（toss / closer / cs / staff / manager / admin / super_admin）
- GardenHomeGate の admin/super_admin 限定ロジック（memory `project_super_admin_operation.md` 準拠 = 東海林さん本人専任）
- legacy ファイル保持（memory `feedback_no_delete_keep_legacy.md` 準拠、`*.legacy-YYYYMMDD.tsx` 命名規則）

## 🟡 優先事項 3: Phase A-2.1 統合 KPI ダッシュボード設計品質
- 4 モジュール KPI grid（Forest / Tree / Bud / Leaf）の拡張可能性
- ForestKpiCard の dev mock + Supabase fetch 切替（memory `project_bloom_auth_independence.md` の dev バイパス準拠）
- vitest 5 tests のカバレッジ十分性
- PlaceholderKpiCard 3 件（Tree / Bud / Leaf 準備中）の UI ガイダンス品質

## 🟡 優先事項 4: Daily Report MVP API 実装
- `/api/bloom/daily-report/route.ts` 278 行の RLS 連携（memory `project_rls_server_client_audit.md` 準拠、Route Handler で anon supabase 流用していないか）
- 入力 validation / 認証チェック / エラーハンドリング
- legacy placeholder からの差分妥当性（実装ロジックの根拠）

## 🔴 優先事項 5: develop merge 群（5/13 大手術）との conflict
- PR #150 base = main、最新 develop merge 群（#170 / #171 / #172 / #173 / #174）と未統合
- 特に重要な確認 3 点:
  - `bud_bank_*` → `root_bank_*` rename（PR #171）の Bloom 側参照影響有無
  - `has_role_at_least()` wrapper 化（PR #174）の Bloom 認証連携への影響有無
  - Forest m3/m4/m5（PR #172）apply 済データへの ForestKpiCard アクセス整合性
- rebase 必要性 + 必要時の影響範囲

## 🔴 優先事項 6: 後道さん 5/13 仕訳帳本番運用 UI 整合
- ForestKpiCard が本日 apply 済の Forest m4 (6 法人 + 12 口座 seed) + m5 (714 共通仕訳マスタ rules) を**参照可能か**
- 後道さん UI 確認時に表示が空 / エラーにならないか（memory `project_godo_ux_adoption_gate.md` 準拠 = 実物必須）
- 5/13 後道さんデモ前マイルストーン（memory `project_garden_unified_auth_milestone.md` 参照）との同期

# D. やってほしいこと（実装フロー、4 ステップ）

## D-1. 事前準備（review 着手前 30 分）

1. PR #150 全 file の差分把握:

       gh pr diff 150 > /tmp/pr150-diff.txt

   約 13,327 行 → 主要 file 50 件抜粋

2. develop conflict 事前 dry-run:

       git fetch origin develop --quiet
       git fetch origin pull/150/head:pr150-review --quiet
       git checkout pr150-review
       git rebase --dry-run origin/develop 2>&1 | head -30

3. 関連 memory 5 件 read:
   - `project_bloom_auth_independence.md`
   - `project_super_admin_operation.md`
   - `project_rls_server_client_audit.md`
   - `feedback_no_delete_keep_legacy.md`
   - `project_godo_ux_adoption_gate.md`

4. handoff-026.md §0 / §1 / §2 read（Garden 5/13 大手術後の最新 context、`C:/garden/a-main-026/handoff-026.md`）

## D-2. review 実施（2-3 時間、主担当）

各優先事項 1-6 を順次評価:
1. 規模感 → 6 観点（PR 単位の論理性 / 部分 revert 可能性 / commit 単位の論理 / main 直行妥当性 / 13,327 行の必然性 / 監査対応）
2. 統一認証ゲート → 4 観点（v8 忠実度 / ROLE_LANDING_MAP 漏れ / GardenHomeGate ロジック / legacy 保持規則）
3. 統合 KPI ダッシュボード → 4 観点（4 モジュール拡張性 / dev mock 切替 / vitest カバレッジ / Placeholder ガイダンス）
4. Daily Report MVP API → 4 観点（RLS 連携 / 入力 validation / エラーハンドリング / legacy 差分妥当性）
5. develop conflict → 3 観点（bank rename 影響 / has_role_at_least 影響 / Forest m3-m5 整合）
6. 後道さん UI 整合 → 3 観点（ForestKpiCard データ参照 / 表示空エラー / マイルストーン同期）

各観点に **GREEN / YELLOW / RED** 判定を付与。

## D-3. 並列 sonnet dispatch（推奨、30 分）
優先事項 3（KPI 設計）+ 5（develop conflict）は機械的観点が多いため、Agent tool で sonnet サブセッション dispatch 並列化推奨。a-review-001 は優先事項 1/2/4/6 を主担当。

## D-4. アウトプット作成

ファイル: `C:/garden/a-main-026/docs/review/bloom-pr150-review-result-20260513.md`

構成:
- §1 観点別判定マトリクス（6 優先事項 × 観点別 GREEN/YELLOW/RED + 集計サマリ）
- §2 RED / YELLOW 項目の修正提案（具体ファイル + 行番号 + 推奨実装）
- §3 merge 可否判断（即 merge OK / 修正後 OK / 大規模分割提案 / develop 経由再起票推奨 の 4 択）
- §4 後道さん 5/13 UI 確認前の前提整合検証結果
- §5 a-bloom-006 への修正依頼項目一覧（必要時、a-main-026 経由で正式 dispatch 起票）

# E. 制約
- a-review-001 セッション以外で本件を扱わない（review 独立性原則）
- 詰まったら即停止 → a-main-026 へ A〜D 案 + 推奨明示で報告（memory `feedback_design_conflict_options_presentation_sop.md`）
- commit メッセージに `[a-review-001]` タグを含める

# F. 完了条件
- §D-4 アウトプット md 作成完了（`docs/review/bloom-pr150-review-result-20260513.md`）
- a-main-026 へ「review 完走、merge 可否 = 〇〇、RED N 件 / YELLOW M 件、要修正一覧 別途」報告
- RED 項目があれば、a-main-026 経由で a-bloom-006 への修正 dispatch 起票（# 351 以降）
- 想定所要: review 2-3h + sonnet サブ 30 分 + 修正対応 30 分〜2h

# G. 関連 memory（review 観点で必読）
- project_bloom_auth_independence.md
- project_super_admin_operation.md
- project_rls_server_client_audit.md
- feedback_no_delete_keep_legacy.md
- project_godo_ux_adoption_gate.md
- project_garden_unified_auth_milestone.md
- feedback_strict_recheck_iteration.md（厳しい目で再確認 3 ラウンド）
- feedback_check_existing_impl_before_discussion.md
- feedback_self_visual_check_with_chrome_mcp.md（視覚確認は Chrome MCP）
- CLAUDE.md §16 リリース前バグ確認ルール（7 種テスト参考）

# self-check
- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用（gh / git / PowerShell コマンドは 4-space インデントで表現）
- [x] 起草時刻 = 実時刻（UTF-8 明示 Get-Date 取得済、2026-05-13(水) 16:20）
- [x] 番号 = main- No. 350（v6 規格 +1 厳守、# 349 → # 350、派生命名なし）
~~~

---

## 参考情報（投下対象外、a-main / a-review-001 / a-bloom-006 内部参照用）

### 関連リソース
- handoff-026.md §0 遺言 / §1 Bloom 現状 / §2 Next Action 5
- main 026 CONFIRMED draft: `C:/garden/a-main-026/docs/drafts/draft-dispatch-no350-bloom-pr150-review-CONFIRMED-20260513.md`
- writer-001 当初 skeleton: `C:/garden/a-writer-001/docs/drafts/draft-dispatch-no350-bloom006-review-kickoff-20260513.md`（TBD 7 項目は CONFIRMED 版で全確定済）
- PR #150 URL: `https://github.com/Hyuaran/garden/pull/150`
- 5/13 大手術関連 PR 群: #170 / #171 / #172 / #173 / #174（develop merge 済 + 本番 apply 完了）

### sentinel 5 項目代行チェック（a-writer-001 実施、AGENTS.md §3）

| # | 項目 | 結果 |
|---|---|---|
| 1 | 状態冒頭明示 | ✅ 私の応答冒頭で [稼働中、清書専門モード] 明示 |
| 2 | 提案 / 報告 = 厳しい目 N ラウンド発動済 | ✅ main 026 が CONFIRMED 化 + 6 優先事項を東海林さん照合済、清書段階は対象外 |
| 3 | dispatch v6 規格通過済 | ✅ # 350 単純 +1 / `-ack` `-rep` 派生なし / ~~~ ラップ + コードブロック不使用（4-space インデント代替）/ 冒頭 3 行規格 |
| 4 | ファイル参照 = ls で物理存在検証済 | ✅ CONFIRMED draft + writer-request 短文 + 当初 skeleton 全件物理確認済 |
| 5 | 既存実装関与 = 客観検証 | ✅ PR #150 規模 / commit 数 / file 数 / memory 名 / handoff §番号 は CONFIRMED 出典の客観事実として継承 |

### §11 大原則 実践記録（AGENTS.md §11、3 回目の実践）

| 項目 | 内容 |
|---|---|
| 曜日確認 | UTF-8 明示 Get-Date 取得 → (水) 確認、main 026 起草時刻 16:08 と私の取得 16:20 整合（12 分差） |
| 推測の混入 | なし。PR #150 規模 / 主要成果 / 6 優先事項 / 担当割振り は CONFIRMED 出典として継承、推測補完なし |
| 警告発信 | 該当なし。本 dispatch は東海林さん照合済 CONFIRMED 版を正本とした清書、3 ラウンド検証対象外 |
| 当初 skeleton との関係 | 私が起草した skeleton の TBD 7 項目は main 026 が全確定、CONFIRMED 版を **正本** として清書（自分の初稿を上書き、混乱回避）|

### a-review-001 セッション起動時の留意点

a-review-001 は新規セッション。起動時に以下を必ず実施:
1. CLAUDE.md / AGENTS.md 読込（プロジェクト共通指示）
2. handoff-026.md 読込（Garden 5/13 最新 context）
3. §G の関連 memory 9 件 + 1 件読込
4. 状態冒頭明示 `[稼働中、独立 review モード]`
5. powershell.exe Get-Date で実時刻取得
6. a-main-026 へ「a-review-001 起動完了、PR #150 review 着手 GO」報告
