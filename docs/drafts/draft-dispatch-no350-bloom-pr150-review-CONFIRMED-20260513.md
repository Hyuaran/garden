# Draft dispatch # 350 — Bloom PR #150 review 起票（補正確定版、writer 清書用）

> 起草: a-main-026（2026-05-13(水) 16:08 JST）
> 投下先: **a-review-001**（独立 review セッション、新規起動）
> 副投下先: **a-bloom-006**（実装側、修正対応の場合）
> 清書担当: a-writer-001（v6 規格化、本ファイル参照）
> 目的: writer-001 起草版の TBD 7 項目を全て確定 + 6 優先事項で再構成
> 緊急度: 🟡（main 直行 + 後道さん 5/13 UI 確認連動）

---

## 0. writer-001 TBD 7 項目 → 確定値マトリクス

writer-001 が `draft-dispatch-no350-bloom006-review-kickoff-20260513.md` の §6 で求めた 7 項目を、a-main-026 が客観事実 + handoff §2 + Garden 構築優先順位で確定:

| # | 項目 | 確定値 |
|---|---|---|
| 1 | **review 対象 PR** | **PR #150**（feat(bloom): Phase A-2 統合 KPI + Garden 統一認証 + Daily Report MVP + 法人アイコン、main 直行、53 commits / 13,327 additions / 94 files、OPEN）|
| 2 | **review 観点** | 下記 §3「6 つの優先事項」（main 直行 + 後道さん UI 連動を踏まえた重点評価）|
| 3 | **期待アウトプット** | `C:/garden/a-main-026/docs/review/bloom-pr150-review-result-20260513.md`（観点別判定 / 修正提案 / merge 可否判断 / 後道さん UI 前提整合）|
| 4 | **a-bloom-006 起動状態 / 担当者** | a-bloom-006 = PR #150 起票済（実装側）。**review 担当は a-review-001（独立 review 新規起動）**で客観性確保。a-bloom-006 は修正対応役のみ |
| 5 | **緊急度** | **🟡**（handoff §2 では 🟢 だが、main 直行 + 後道さん 5/13 仕訳帳 UI 確認連動 = 格上げ） |
| 6 | **想定所要** | a-review-001 主担当 **2-3h** + sonnet dispatch サブ **30 分**（観点 5/6 限定）+ a-bloom-006 修正対応 **30 分〜2h** |
| 7 | **dispatch 番号** | **# 350 確定**（# 348（PR #175 完走済）→ # 349（timestamp 衝突修正）→ # 350）|

---

## 1. 件名（確定）

`review(bloom): PR #150 — Phase A-2 統合 KPI + Garden 統一認証 + Daily Report MVP の独立レビュー（53 commits / 13,327 行 / main 直行、6 優先事項評価、dispatch # 350）`

---

## 2. 背景（確定客観事実）

### 2.1 review 対象 PR #150 規模感

| 項目 | 値 |
|---|---|
| PR 番号 | **#150** |
| タイトル | feat(bloom): Phase A-2 統合 KPI + Garden 統一認証 + Daily Report MVP + 法人アイコン |
| ブランチ | `feature/bloom-6screens-vercel-2026-05-006` → `main`（直行） |
| 規模 | 53 commits / **13,327 additions** / 94 files |
| state | OPEN |
| 起票元 | a-bloom-006（branch 名末尾 `-006`、累積 003 → 004 → 005 → 006） |

### 2.2 主要成果（PR body より要約）

- **Garden 統一認証ゲート**: 統一 Login v8（claude.ai 起草版 React 化）+ Garden Home v9 unified（1,050 行）+ GardenHomeGate（admin/super_admin 限定）+ ROLE_LANDING_MAP（7 段階ロール対応）+ legacy 3 ファイル保持
- **Phase A-2.1 統合 KPI ダッシュボード**: `/bloom/kpi/page.tsx` + UnifiedKpiGrid + ForestKpiCard + PlaceholderKpiCard（Tree/Bud/Leaf 準備中）+ vitest 5 tests PASS
- **Daily Report MVP**: API route 278 行 + page 525 行 + legacy placeholder 保持
- **6 法人 + hyuaran-group-hd アイコン**: garden-corporations.ts 143 行 + WebP 6 法人 + bg-night-garden-with-stars + logo-garden-series 配置

### 2.3 連動マイルストーン（重要）

- **後道さん 5/13 仕訳帳本番運用 UI 確認**（handoff §2 Action 8、🟡）
  - PR #150 の ForestKpiCard が、本日 apply 済 Forest m4/m5（6 法人 / 12 口座 / 714 共通仕訳マスタ）を参照可能か = 後道さん UI 確認の前提整合性
  - 5/13 仕訳帳本番運用ゲート解放（PR #172 merge + 3 migration apply 完了）と整合

---

## 3. 6 つの優先事項（review 観点、緊急度別）

### 🔴 優先事項 1: 規模感の妥当性

- **13,327 additions / 94 files / 53 commits** が 1 PR にまとまっている妥当性
- **main 直行 = 本番直接反映** → 部分 revert が困難、commit 単位での切戻し可能性確認
- 53 commits の論理単位 = 主要成果 4 領域 + spec/plan 起草に対応しているか

### 🔴 優先事項 2: Garden 統一認証ゲート実装品質

- claude.ai 起草版 React 化の忠実度（v8 統一ログイン画面）
- ROLE_LANDING_MAP の 7 段階ロール対応漏れなし（toss / closer / cs / staff / manager / admin / super_admin）
- GardenHomeGate の admin/super_admin 限定ロジック（memory `project_super_admin_operation.md` 準拠 = 東海林さん本人専任）
- legacy ファイル保持（memory `feedback_no_delete_keep_legacy.md` 準拠、`*.legacy-YYYYMMDD.tsx` 命名規則）

### 🟡 優先事項 3: Phase A-2.1 統合 KPI ダッシュボード設計品質

- 4 モジュール KPI grid（Forest / Tree / Bud / Leaf）の拡張可能性
- ForestKpiCard の dev mock + Supabase fetch 切替（memory `project_bloom_auth_independence.md` の dev バイパス準拠）
- vitest 5 tests のカバレッジ十分性
- PlaceholderKpiCard 3 件（Tree / Bud / Leaf 準備中）の UI ガイダンス品質

### 🟡 優先事項 4: Daily Report MVP API 実装

- `/api/bloom/daily-report/route.ts` 278 行の **RLS 連携**（memory `project_rls_server_client_audit.md` 準拠、Route Handler で anon supabase 流用していないか）
- 入力 validation / 認証チェック / エラーハンドリング
- legacy placeholder からの差分妥当性（実装ロジックの根拠）

### 🔴 優先事項 5: develop merge 群（5/13 大手術）との conflict

- PR #150 base = main、最新 develop merge 群（#170 / #171 / #172 / #173 / #174）と未統合
- **特に重要な確認 3 点**:
  - `bud_bank_*` → `root_bank_*` rename（PR #171）の Bloom 側参照影響有無
  - `has_role_at_least()` wrapper 化（PR #174）の Bloom 認証連携への影響有無
  - Forest m3/m4/m5（PR #172）apply 済データへの ForestKpiCard アクセス整合性
- rebase 必要性 + 必要時の影響範囲

### 🔴 優先事項 6: 後道さん 5/13 仕訳帳本番運用 UI 整合

- ForestKpiCard が本日 apply 済の Forest m4 (6 法人 + 12 口座 seed) + m5 (714 共通仕訳マスタ rules) を**参照可能か**
- 後道さん UI 確認時に表示が空 / エラーにならないか（memory `project_godo_ux_adoption_gate.md` 準拠 = 実物必須）
- 5/13 後道さんデモ前マイルストーン（memory `project_garden_unified_auth_milestone.md` 参照）との同期

---

## 4. a-review-001 がやること（実装フロー）

### 4.1 事前準備（review 着手前 30 分）

1. PR #150 全 file の差分把握（`gh pr diff 150 > /tmp/pr150-diff.txt`、約 13,327 行 → 主要 file 50 件抜粋）
2. develop conflict 事前 dry-run:
   ```powershell
   git fetch origin develop --quiet
   git fetch origin pull/150/head:pr150-review --quiet
   git checkout pr150-review
   git rebase --dry-run origin/develop 2>&1 | head -30
   ```
3. 関連 memory 5 件 read:
   - `project_bloom_auth_independence.md`
   - `project_super_admin_operation.md`
   - `project_rls_server_client_audit.md`
   - `feedback_no_delete_keep_legacy.md`
   - `project_godo_ux_adoption_gate.md`
4. handoff-026.md §0 / §1 / §2 read（Garden 5/13 大手術後の最新 context）

### 4.2 review 実施（2-3 時間）

各優先事項 1-6 を順次評価:
1. **規模感** → 6 観点（PR 単位の論理性 / 部分 revert 可能性 / commit 単位の論理 / main 直行妥当性 / 13,327 行の必然性 / 監査対応）
2. **統一認証ゲート** → 4 観点（v8 忠実度 / ROLE_LANDING_MAP 漏れ / GardenHomeGate ロジック / legacy 保持規則）
3. **統合 KPI ダッシュボード** → 4 観点（4 モジュール拡張性 / dev mock 切替 / vitest カバレッジ / Placeholder ガイダンス）
4. **Daily Report MVP API** → 4 観点（RLS 連携 / 入力 validation / エラーハンドリング / legacy 差分妥当性）
5. **develop conflict** → 3 観点（bank rename 影響 / has_role_at_least 影響 / Forest m3-m5 整合）
6. **後道さん UI 整合** → 3 観点（ForestKpiCard データ参照 / 表示空エラー / マイルストーン同期）

各観点に **GREEN / YELLOW / RED** 判定を付与。

### 4.3 並列 sonnet dispatch（推奨、30 分）

優先事項 3（KPI 設計）+ 5（develop conflict）は機械的観点が多いため、Agent tool で sonnet サブセッション dispatch 並列化推奨。a-review-001 は優先事項 1/2/4/6 を主担当。

### 4.4 アウトプット作成

ファイル: `C:/garden/a-main-026/docs/review/bloom-pr150-review-result-20260513.md`

構成:
- **§1 観点別判定マトリクス**（6 優先事項 × 観点別 GREEN/YELLOW/RED + 集計サマリ）
- **§2 RED / YELLOW 項目の修正提案**（具体ファイル + 行番号 + 推奨実装）
- **§3 merge 可否判断**（即 merge OK / 修正後 OK / 大規模分割提案 / develop 経由再起票推奨）
- **§4 後道さん 5/13 UI 確認前の前提整合検証結果**
- **§5 a-bloom-006 への修正依頼項目一覧**（必要時、a-main-026 経由で正式 dispatch 起票）

---

## 5. 完了条件

- 上記 §4.4 アウトプット md 作成完了
- a-main-026 へ「review 完走、merge 可否 = 〇〇、RED N 件 / YELLOW M 件、要修正一覧 別途」報告
- RED 項目があれば、a-main-026 経由で a-bloom-006 への修正 dispatch 起票（# 351 以降）

---

## 6. 制約 + 関連 memory（必読）

### 制約
- a-review-001 セッション以外で本件を扱わない（review 独立性原則）
- 詰まったら即停止 → a-main-026 へ A〜D 案 + 推奨明示で報告（memory `feedback_design_conflict_options_presentation_sop.md`）
- commit メッセージに `[a-review-001]` タグを含める

### 関連 memory（review 観点で必読）
- `project_bloom_auth_independence.md`
- `project_super_admin_operation.md`
- `project_rls_server_client_audit.md`
- `feedback_no_delete_keep_legacy.md`
- `project_godo_ux_adoption_gate.md`
- `project_garden_unified_auth_milestone.md`
- `feedback_strict_recheck_iteration.md`（厳しい目で再確認 3 ラウンド）
- `feedback_check_existing_impl_before_discussion.md`
- `feedback_self_visual_check_with_chrome_mcp.md`（視覚確認は Chrome MCP）
- §16 リリース前バグ確認ルール（7 種テスト参考）

---

## 7. a-writer-001 への清書指示

本ファイルを v6 規格で清書 → 投下用短文（投下先 a-review-001、緊急度 🟡、コピペ md = 本ファイル参照のみ）。

writer-001 起草版（`bloom006-review-kickoff-20260513.md`）の TBD 7 項目は本ファイル §0 で全て確定済。writer-001 は本ファイルを **正本**として清書すること。

---

EOF
