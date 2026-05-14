# Garden 全体状況サマリ — Gemini（管制塔）向け

> 作成: a-main-026（2026-05-13(水) 15:30 JST）
> 目的: Gemini が Garden プロジェクトに深く介入するための完全なコンテキスト共有
> 想定読者: Gemini（管制塔）、東海林さん、新規参画セッション
> 鮮度: 5/13 大手術完了直後の最新状態

---

## §0 1 行サマリ

**Garden = 株式会社ヒュアラン（東海林美琴 代表）の自社 Web アプリ群、12 モジュール構成、Next.js + Supabase + Vercel + TypeScript、6 ヶ月（MAX 年内）リリース目標。本日 5/13 に「DB 大手術」を完走し、本番 DB が完全健全化（5 PR merge + 3 migration apply、35 分以内修復）。** Phase A 経理総務自動化が実用段階、後道さん 5/13 仕訳帳本番運用ゲート解放済。

---

## §1 プロジェクト基盤

### 1.1 体制

| 役 | 担当 |
|---|---|
| 経営者 / プロジェクトオーナー | **東海林美琴**（株式会社ヒュアラン代表、非エンジニア） |
| 主任意思決定 / 横断調整 | **a-main-026**（本セッション、Claude Code） |
| 文書清書専門 | **a-writer-001**（dispatch / handoff / memory の v6 規格化） |
| 各モジュール実装 | a-soil / a-root / a-tree / a-leaf / a-bud / a-bloom / a-seed / a-forest / a-rill 等 |
| 自律実行 | a-auto（夜間・会議中等の並列作業専用） |
| 第三者レビュー | a-review（独立性確保） |

### 1.2 技術スタック

- **フロント**: Next.js 15 (App Router) / React 19 / TypeScript / Tailwind CSS / Turbopack
- **DB / バックエンド**: Supabase (PostgreSQL 15 / Row Level Security / Auth)
- **ホスティング**: Vercel
- **テスト**: Vitest / Playwright / Chrome MCP (E2E + 視覚検証)
- **外部連携**: Chatwork / kintone / KING OF TIME (KoT) / マネーフォワードクラウド (MFC) / TimeTree (将来 Calendar 自社化で置換)

### 1.3 重要な構造的事実

- **Supabase 本番 = 手動 apply 設計**: `supabase_migrations.schema_migrations` 不使用 → **PR merge ≠ Supabase apply 完了**。merge 後の Chrome MCP + SQL Editor での物理検証が必須運用。
- **複数セッション並列開発**: 各モジュールごとに独立 worktree (`C:\garden\a-<module>-NNN\`)、メインは `C:\garden\a-main-026\`。
- **non-engineer ユーザー**: 東海林さんは非エンジニア。報告は表形式 + 推奨明示、技術用語は使わない / 補足要、選択肢 2-3 案で即決可能フォーマット必須。

---

## §2 12 モジュール稼働状況（5/13 15:30 JST 時点）

### 2.1 Garden 3 レイヤー視覚モデル

```
🌳 樹冠 (経営層)        : Bloom / Forest / Fruit / Seed
🌿 地上 (業務層)        : Bud / Leaf / Tree / Sprout / Calendar
🌱 地下 (基盤層)        : Soil / Root / Rill
```

### 2.2 モジュール稼働マトリクス

| # | モジュール | 和名 | 役割 | Phase | 本番状態 | 直近の出来事 |
|---|---|---|---|---|---|---|
| 1 | **Root** | 根 | 組織・従業員・パートナー・マスタデータ・条件 | Phase B-5 完成 | 🟢 本番稼働中 | PR #173/#174 本日 apply（cross_rls deleted_at + has_role_at_least wrapper 化） |
| 2 | **Bud** | 蕾 | 経理・収支（明細・振込・損益・給与） | Phase D 完了 / Phase E 起草中 | 🟢 本番稼働中 | bank rename PR #171 apply、給与処理 spec 8 件起草済 |
| 3 | **Forest** | 森 | 全法人の決算資料・経営ダッシュボード | B-min Phase 1 完成 | 🟢 本番稼働中 | **5/13 仕訳帳本番運用ゲート解放**（PR #172 merge + m3/m4/m5 apply 完了） |
| 4 | **Tree** | 木 | 架電アプリ（コールセンターの要） | Phase D §1 D-01 fix 済 | 🟡 開発中 | Task 2-5 ETA 5/13 15:15、FileMaker 並行で慎重展開予定 |
| 5 | **Bloom** | 花 | 案件一覧・日報・KPI・ダッシュボード | Phase A-2 統合 KPI 進行中 | 🟡 PR #150 OPEN | **53 commits / 13,327 行 / main 直行 PR 審査待ち**（review request draft # 350 起草済） |
| 6 | **Leaf** | 葉 | 商材×商流ごとの個別アプリ（約30テーブル）・トスアップ | A-1c v3 進行中 | 🟡 PR #138-#147 ほか OPEN 多数 | 関電業務委託 Phase D 92.9% 完了、本体 migration 不在を audit 検出 |
| 7 | **Soil** | 土 | DB 本体・大量データ基盤（リスト 253 万件・コール履歴 335 万件） | Phase B-01 着手 | 🟡 PR #152 / #166 OPEN | Kintone App 55 取込パイプライン 30 万件 + 84 tests |
| 8 | **Bloom 隣接** （Help / 開発者 page） | — | KING OF TIME 風オンラインヘルプ + 問い合わせ集約 | 設計のみ | ⏳ 未着手 | Phase D-E 配置 |
| 9 | **Sprout** | 新芽 | 採用 → 面接 → 内定 → 入社準備 | spec v0.2 完成 | ⏳ 未着手 | a-auto Batch 18 で詳細 spec 7 件起草済（1,850 行） |
| 10 | **Fruit** | 実 | 法人法的実体情報（番号系・許認可・登記簿等） | spec 起草済 | ⏳ 未着手 | a-auto Batch 18 で詳細 spec 5 件起草済（1,579 行 / 5.25d） |
| 11 | **Calendar** （仮） | 暦 | 営業予定・面接スロット・シフト・通知統合 | spec 起草済 | ⏳ 未着手 | TimeTree 非対応のため独自実装、staff 以上のみ |
| 12 | **Seed** | 種 | 新商材・新事業の拡張枠 | — | ⏳ 必要時 | スケルトン 5 件起草済 |
| 13 | **Rill** | 川 | Chatwork クローン自社開発（**Phase 最後着手**） | — | ⏳ 未着手 | Chatwork 月額削減 + Garden 内データ連携が狙い |

### 2.3 Phase 別優先順位（CLAUDE.md §18 改訂版）

| Phase | 内容 | モジュール | 状態 |
|---|---|---|---|
| **A** | 経理総務の自動化（東海林さん通常業務軽減） | Bud / Forest / Root | 🟢 大半完成、5/13 大手術で更に堅牢化 |
| **B** | 事務業務の効率化 | Leaf 関電 / Bud 給与 / Sprout / Fruit / Calendar | 🟡 進行中（Leaf 92.9%、Bud 給与 spec 起草済） |
| **C** | 補完モジュール | Soil / Bloom / Seed / Leaf 他商材 | 🟡 Soil 着手、Bloom Phase A-1 完結 |
| **D** | 最終段階 🔴 最慎重 | Tree（コールセンター要） / Rill（Chatwork クローン） | 🟡 Tree §1 進行、Rill 最終着手 |

---

## §3 5/13 DB 大手術の成果（本日完了 7 項目）

### 3.1 7 項目修復マトリクス

| # | 内容 | 状態 | 備考 |
|---|---|---|---|
| 1 | 孤児テーブル `root_bank_accounts` (旧設計 13 列、0 行) 削除 | ✅ | a-main-025 が朝の客観検証で発見 |
| 2 | PR #171 apply: `bud_bank_*` → `root_bank_*` rename 3 件完了 | ✅ | bank テーブルを root に一本化 |
| 3 | PR #173 apply: `current_garden_role` + `auth_employee_number` に `deleted_at` filter 追加 | ✅ | 退職者 RLS 通過防止 |
| 4 | PR #174 apply: `root_can_access / write / is_super_admin` を `has_role_at_least()` wrapper 化 | ✅ | セキュリティ強化 |
| 5 | Forest m3 apply: 6 テーブル新規 + `root_bank_accounts` に 2 列 ALTER ADD | ✅ | Forest 仕訳帳基盤 |
| 6 | Forest m4 apply: 6 法人 + 12 口座 seed 投入 | ✅ | 本番運用データ |
| 7 | Forest m5 apply: 714 共通仕訳マスタ rules 投入 | ✅ | bud_master_rules.memo 列の手動 ALTER で schema 整合 後実施 |

### 3.2 銀行テーブルの一本化（最重要）

```
旧: bud_bank_accounts / bud_bank_balances / bud_bank_transactions  ← 廃止
新: root_bank_accounts (17 列 + sub_account_label + manual_balance_20260430 = 19 列) ★唯一の真実
    root_bank_balances
    root_bank_transactions
```

**やってはいけないこと**:
- `bud_bank_*` の復活 / 参照（コードに残っていれば即修正）
- `root_bank_accounts` 19 列の削減（Forest B-min が 2 列に依存）
- 手動 apply 設計を忘れて「PR merge = apply」誤認すること

### 3.3 現在の DB スキーマ健全性

| 観点 | 状態 |
|---|---|
| schema 整合性 | 🟢 完全健全（5/13 14:43 「Garden 正常稼働」宣言） |
| RLS policy | 🟢 退職者通過防止 + super_admin 専任化 + has_role_at_least wrapper 化 |
| seed データ | 🟢 6 法人 + 12 口座 + 714 仕訳 master rules |
| migration apply 状況 | 🟢 5/13 5 PR (170/171/172/173/174) + 3 migration (m3/m4/m5) 全 apply 完了 |
| 残存課題 | 🟡 `bud_master_rules.memo` 列の正式 migration 化（PR #175 進行中） / timestamp 衝突 #171/#174 (`20260513000001` ダブり) のローカル修正（draft #349 起草済） |

### 3.4 DB 健全化の派生 memory（本日新規 6 件、a-writer 清書完了）

1. `reference_supabase_manual_apply.md` — Garden = 手動 apply 設計、CLI 不在
2. `feedback_migration_timestamp_collision.md` — 同日 timestamp 衝突は CLI 導入時 silent NO-OP
3. `feedback_migration_apply_verification_sop.md` — merge 後 30 分以内 Chrome MCP 物理検証 SOP
4. `feedback_cross_module_schema_collision.md` — 複数モジュール独立 migration 衝突パターン
5. `feedback_rebase_feature_change_approval.md` — rebase 時の機能変更承認プロトコル
6. `feedback_design_conflict_options_presentation_sop.md` — 設計衝突 A〜D 案 + 推奨明示報告フォーマット

---

## §4 進行中 PR + draft（5/13 15:30 時点）

### 4.1 進行中 dispatch / draft（a-main-026 起草、a-writer 清書段階）

| # | 番号 | 内容 | 投下先 | 緊急 | 状態 |
|---|---|---|---|---|---|
| 1 | **# 348** | bud_master_rules.memo 列の正式 migration 化（IF NOT EXISTS） | a-forest-002 | 🟡 | **PR #175 起票完了**、Vercel CI SUCCESS、本番物理検証 + admin merge 待ち |
| 2 | **# 349** | timestamp 衝突 #171/#174 (`20260513000001` ダブり) → `20260513000006` rename | a-root-003 | 🟢 | a-writer 清書完了、東海林さん「000006 で確定」 |
| 3 | **# 350** | Bloom PR #150 review 依頼（53 commits / 13,327 行 / main 直行） | a-review-001（要起動） | 🟡 | a-writer 清書完了、TBD 補正中（a-main-026 担当） |

### 4.2 主要 OPEN PR（develop / main ベース）

| PR # | base | タイトル | 状態 | 推奨アクション |
|---|---|---|---|---|
| **#175** | develop | bud_master_rules.memo 列正式 migration 化 | MERGEABLE / Vercel SUCCESS | 物理検証 → admin merge |
| **#150** | **main** | Bloom Phase A-2 統合 KPI + Garden 統一認証 + Daily Report MVP（**13,327 行**） | OPEN | review 必須（# 350 起票予定） |
| #166 | develop | Soil Phase B-01 apply prep + 8 migration apply runbook | OPEN | Soil 着手判断後 |
| #165 | develop | Leaf 本体 migration 不在 致命発見 + 修復計画 v1.0 | OPEN | 修復着手判断 |
| #152 | develop | Soil Phase B-01 Phase 1 implementation（30 万件取込 + 84 tests） | OPEN | Soil 着手判断後 |
| #149 | develop | Bud Phase E spec batch v1（5 件 spec skeleton） | OPEN | Bud Phase B 給与処理着手後 |
| #147 | develop | Leaf 002_光回線業務委託 最小 skeleton 起票 | OPEN | Phase B 次商材 |
| #138-#145 | develop | Leaf A-1c v3 Task D.1-D.13（13 task 並列実装） | OPEN | review 待ち |
| #137 | develop | Bloom 進捗ページ Phase 1a — 日報蓄積 3 テーブル + 4 月期間集計 | OPEN | 既存進捗確認 |

### 4.3 5/11-5/13 直近 merged PR（develop）

- **#170** Tree spec D-01 §2/§3/§8 + Soil 連携型修正
- **#171** bud_bank_* → root_bank_* テーブル rename ★大手術
- **#172** Forest B-min Phase 1 仕訳帳機能 全 5 タスク完成 ★大手術
- **#173** cross_rls_helpers deleted_at filter 強化
- **#174** Phase B-5 セキュリティ強化 — root_can_* を has_role_at_least() wrapper 化 ★大手術
- #169 Garden unified auth Task 6 — Vitest + Chrome MCP E2E
- #168 Garden unified auth Task 3 — ModuleGate 統一 + 12 module layout
- #167 Garden unified auth Task 2 — Series Home 権限別表示
- #164 Garden unified auth Task 1 — Login 統一画面
- #163 統一 RLS テンプレート + 設計ガイド整備
- #162 super_admin 権限を東海林さん本人専任に固定
- #161 shared bank-csv-parsers shared lib
- #160 Bud 仕訳帳 Next.js 化（10 仕訳 mock + 弥生 export skeleton）
- #159 Bud 6 法人 × 4 銀行 残高サマリ Next.js 化（¥103,703,627 検算済）

---

## §5 東海林さんが先行着手したい事項（進行中・近日着手）

### 5.1 Bud 給与処理（Phase B、最優先候補）

- **現状**: spec 8 件 起草済（PR #74 merge 済、a-auto Batch 17 起草）、A-07 採択結果反映済
- **未着手**: 実装は Phase B 着手指示後、8 subagent 並列実装で高速化想定
- **設計**: 勤怠取込（KING OF TIME 連携）→ 給与計算 → MFC CSV 配信 → 給与明細配信（Y 案 = メール DL リンク + LINE Bot 通知 + マイページ PW 確認）
- **依存関係**: Root 従業員マスタ（✅ 完了）/ Bud 銀行統合（✅ 完了）/ MFC CSV 仕様（✅ memory `project_mfc_payroll_csv_format.md`）

### 5.2 Bloom 連携（Phase A-2.2 以降）

- **PR #150** OPEN（主要件）: Phase A-2.1 統合 KPI ダッシュボード（4 モジュール grid）+ Garden 統一認証 + Daily Report MVP + 6 法人アイコン
- **次フェーズ A-2.2**: 他モジュール統合 KPI（Tree KPI / Leaf 案件 / Bud 損益 / Forest 経営指標）→ β投入後着手予定
- **後道さん 5/13 仕訳帳本番運用 UI 確認** との連動: ForestKpiCard が本日 seed 投入済の bud_corporations / root_bank_accounts を参照可能か確認必要

### 5.3 後道さん 5/13 本番運用 UI 確認（最重要マイルストーン）

- 仕訳帳機能（Forest B-min Phase 1）の本番動作確認（Q4 balance-overview + corp ダッシュボード）
- 後道さん UX 採用ゲート（実物必須・遊び心・世界観）通過必須
- 通過後: Bloom Phase A-2.2 + Bud Phase B 給与処理着手 GO

### 5.4 5/13 大手術後の残存タスク

- **Tree Task 2-5 完走確認** （types gen / Vitest / RLS、ETA 5/13 15:15）
- **Bud Phase B 給与処理 8 subagent 並列実装着手判断**（東海林さん GO 待ち）
- **a-bloom-006 PR review 起票**（main- No. 341 予定だった分 → # 350 として進行中）

---

## §6 重要 memory 索引（a-writer-001 と完全同期、5/13 時点 70+ 件）

### 6.1 種別

- **🔴 最重要（毎回必ず参照、ループ防止のコア）**: 36 件
- **🟢 ユーザー基本情報**: 3 件
- **🟢 コミュニケーション・報告スタイル**: 9 件
- **🟢 セッション運用・並列化**: 7 件
- **🟢 視覚・UI 開発フロー**: 4 件
- **🟢 後道さん / 現場対応**: 5 件
- **🟢 外部連携・GitHub・トークン**: 9 件
- **🟢 Garden プロジェクト基盤**: 14 件
- **🟢 Garden モジュール固有**: 8 件
- **🟢 プロジェクト進行・現状**: 5 件

### 6.2 最重要 36 件（🔴）の代表例（Gemini が最初に押さえるべき）

#### 運用ルール系
- `feedback_gangan_mode_default.md` — ガンガンモード = a-main デフォルト運用 v3（全モジュール並列 / 5h フル / 東海林作業時間無視、ただし「skip OK」誤解禁止）
- `feedback_main_session_50_60_handoff.md` — a-main は 50-60% 帯で先行引越し（modules/auto は 80%）
- `feedback_session_handoff_checklist.md` — 引越し前 8 項目 + 起動時必読 docs ロック §0
- `feedback_strict_recheck_iteration.md` — 厳しい目で再確認 3 ラウンド（東海林さんへの提案 / 報告前に必ず自発発動）
- `feedback_self_memory_audit_in_session.md` — 応答出力前 自己 memory 監査 v2（sentinel 5 項目）

#### DB / migration 系（5/13 大手術後の最重要）
- `feedback_migration_apply_verification.md` — PR merge ≠ Supabase apply 完了 / migration 物理検証義務
- `reference_supabase_manual_apply.md` — Garden = 手動 apply 設計、CLI 不在
- `feedback_migration_timestamp_collision.md` — 同日 timestamp 衝突地雷
- `feedback_migration_apply_verification_sop.md` — merge 後 30 分以内 Chrome MCP 物理検証 SOP
- `feedback_cross_module_schema_collision.md` — 複数モジュール schema 衝突パターン
- `feedback_rebase_feature_change_approval.md` — rebase 時の機能変更承認プロトコル
- `feedback_design_conflict_options_presentation_sop.md` — 設計衝突 A〜D 案 + 推奨明示

#### 報告 / コミュニケーション系
- `feedback_proposal_count_limit.md` — 提案数の上限（2 択標準、3 択は重要岐路のみ）
- `feedback_dispatch_header_format.md` — dispatch 標準ヘッダー v5
- `feedback_always_propose_next_action.md` — 必ず次のアクションを提案、終了・休憩誘導禁止
- `feedback_check_existing_impl_before_discussion.md` — 議論前 / 修正前 / 外部依頼前 既存実装確認 v2
- `feedback_my_weak_areas.md` — 私の不得意分野（9 件）+ 別経路へ振る

### 6.3 索引全件取得方法

**索引ファイル本体**: `C:\Users\shoji\.claude\projects\C--garden-a-main\memory\MEMORY.md`（約 130 行、全 70+ 件のリンク + 1 行ハイライト）

**個別 memory 本体**: `C:\Users\shoji\.claude\projects\C--garden-a-main\memory\<name>.md`

各 memory ファイルは frontmatter（name / description / type / originSessionId）+ 本文（Why + How to apply + 起源 + 関連 memory）の v6 規格で清書済み。

---

## §7 セッション分業体制（重要、5/13 確立）

### 7.1 a-main / a-writer 分業の掟

| 区分 | 担当 | 禁止 |
|---|---|---|
| 意図決定 / 戦略 / 設計 / 進捗管理 / 採択判断 | **a-main-026 専任** | a-main が清書する誘惑禁止 |
| dispatch / handoff / memory の v6 規格清書 + 整形 | **a-writer-001 専任** | a-main が直接清書すると context 消費 + ルール忘却 |

### 7.2 分業フロー（毎回）

1. a-main-026 がラフ md を `C:/garden/a-main-026/docs/drafts/` に書出
2. a-main-026 が東海林さんに「a-writer-001 に投下用清書依頼を出してください」と提示
3. 東海林さんが a-writer-001 セッションに「`<draft path> を読んで dispatch # NNN として清書してください`」入力
4. a-writer-001 が v6 規格で清書 → 投下用短文 → 東海林さんが投下先セッションへコピペ

**実証**: 025 期で 4 時間に複合タスク完走、024 期の context 80%+ 帯 + 規則忘却の悪循環を脱出。

### 7.3 ガンガンモード（a-main デフォルト運用 v3）

- 全モジュール並列稼働
- 5h 使用枠フル活用
- 東海林さん作業時間最小化
- ただし「ガンガン = skip OK」誤解禁止（5/10 リセット教訓追加）

---

## §8 5/13 大手術の物的証跡

### 8.1 朝→昼→夕の流れ（a-main-025 期完走）

| 時刻 | イベント |
|---|---|
| 11:00 | handoff-025 引越し → DB 客観検証開始 |
| 11:15 | **4 PR merge 済だが 3 PR 未 apply 発覚** |
| 11:30 | 4 PR + 孤児削除 修復（5 分で完走、Chrome MCP + SQL Editor） |
| 11:40 | Forest #172 設計衝突 2 件発見 → A 案/D 案統合判断 |
| 12:15 | forest-002 が rebase + 統合 + renumber（35 分） |
| 14:30 | Chrome MCP で 3 migration apply（m3/m4/m5） |
| 14:42 | 最終検証 8 観点 全 GREEN |
| 14:43 | 「Garden 正常稼働」宣言 |
| 14:58 | a-main-025 → 026 引越し handoff 起草 |
| 15:00- | a-main-026 起動、a-writer 規約改訂 + memory 6 件清書 + draft # 348/#349/#350 起草 |

### 8.2 関連ファイル

| 用途 | パス |
|---|---|
| handoff-026 | `C:/garden/a-main-026/handoff-026.md`（コピー）<br>`C:/garden/a-main-025/docs/handoff-026.md`（原本） |
| dispatch counter | `C:/garden/a-main-026/docs/dispatch-counter.txt` (現在 = **348**、次採番) |
| 本日新規 draft 3 件 | `C:/garden/a-main-026/docs/drafts/draft-dispatch-no348-bud-master-rules-memo-migration-20260513.md`<br>`C:/garden/a-main-026/docs/drafts/draft-dispatch-no349-timestamp-collision-fix-20260513.md`<br>`C:/garden/a-main-026/docs/drafts/draft-dispatch-no350-bloom-pr150-review-request-20260513.md` |
| 本日適用済 migration source | `C:/garden/a-main-025/docs/drafts/temp-m3.sql` / `temp-m4.sql` / `temp-m5.sql` |
| Supabase Studio | `https://supabase.com/dashboard/project/hhazivjdfsybupwlepja/sql/new` |
| memory 全件 | `C:/Users/shoji/.claude/projects/C--garden-a-main/memory/`（76 件） |

---

## §9 Gemini 向け 推奨アクション

Gemini（管制塔）が Garden に介入する際、以下の順で確認することを推奨：

1. **本サマリ §1-§8 を全読**（5 分）
2. **MEMORY.md 索引（70+ 件）を index 走査**、🔴 最重要 36 件のみ本文 read（30 分）
3. **handoff-026.md を read**（5 分、5/13 大手術直後の最新詳細）
4. **直近 5/13 merged PR（#170-#174）+ OPEN PR #175/#150 の body を確認**（10 分）
5. **進行中 draft # 348/#349/#350 を read**（10 分、近日 dispatch 投下予定）
6. **東海林さんに最初に確認すべき 3 点**:
   - Gemini が担う具体的役割（戦略アドバイス / コードレビュー / 設計判断補佐 等）
   - 介入の頻度と粒度（毎時 / 毎日 / マイルストーン時のみ 等）
   - a-main-026 / a-writer-001 / 各モジュールセッションとの分業境界

---

## §10 急所（Gemini が知らないと危険な落とし穴 5 件）

1. **PR merge ≠ Supabase apply 完了**: Garden 本番は手動 apply。merge 直後に Chrome MCP + SQL Editor 検証必須。
2. **`bud_bank_*` は廃止済**: コードに残っていたら即 `root_bank_*` に修正。Forest B-min が 19 列に依存。
3. **Tree は最慎重展開**: FileMaker 並行 → 1 人 → 2-3 人 → 半数 → 全員の段階的投入、リリース失敗許されず。
4. **後道さん UX 採用ゲート**: 実物 UI 必須、文書ベース NG、5-10 分上限、直感判断重視。
5. **東海林さんは非エンジニア**: 報告は表形式 + 推奨明示、技術用語 NG / 補足要、選択肢 2-3 案で即決可能フォーマット必須。

---

## §11 連絡先 / 参照

- **東海林美琴**: shoji@hyuaran.com
- **GitHub Org**: Hyuaran (Team プラン)
- **Repository**: `Hyuaran/garden`
- **Supabase Project**: `hhazivjdfsybupwlepja` (garden-prod)
- **Vercel Org**: hyuaran-5e506769

---

EOF
