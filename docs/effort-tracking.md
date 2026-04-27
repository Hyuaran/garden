# Garden シリーズ 工数トラッキング

> Phase / タスクごとの **見積(d)** と **実績(d)** を蓄積する共有ログ。
> 東海林アカウント A / B 両セッションで同じファイルに追記する。
> Garden Bloom が進捗 UI 表示時にこのファイルを参照する想定。
>
> - 1 日 = 8 時間。動作確認・レビュー対応含む実稼働ベース
> - Phase 着手時に見積行を追加、完了時に実績・差分・所感を記入
> - 見積を後から書き換えない（乖離理由は `備考` に記録）
> - 0.25d 刻みで記録。東海林さん手動作業（SQL 適用・ブラウザ確認・PR レビュー等）も実績に含める
> - 根拠メモリ: `feedback_effort_tracking.md`

## 記録フォーマット

| モジュール | フェーズ / タスク | 見積(d) | 実績(d) | 差分 | 担当セッション | 着手日 | 完了日 | 備考 |
|---|---|---:|---:|---:|---|---|---|---|

## 履歴

| モジュール | フェーズ / タスク | 見積(d) | 実績(d) | 差分 | 担当セッション | 着手日 | 完了日 | 備考 |
|---|---|---:|---:|---:|---|---|---|---|
| Forest | Phase A1: 進行期自動更新 Python スクリプト（PDF → Supabase） | 1.0 | 0.4 | -0.6 | a-forest (A) / b-main (B) | 2026-04-21 | 2026-04-22 | コード・ドキュメント完成、本番 UPDATE 疎通確認済み。4社分PDF で 4/4 件 UPDATE 成功。Task 7 のブラウザ目視確認と日報記録は東海林依頼で残。見積 1.0 d に対し AI 支援で 0.4 d で完了 |
| Forest | Phase A2/A3: 進行期編集モーダル（PDF自動入力+手動編集+期切り替え） | 2.5 | 0.6 | -1.9 | b-main (B) | 2026-04-22 | 2026-04-23 | ShinkoukiEditModal + PdfUploader + /api/forest/parse-pdf + mutations + RLS パッチ。PDF 解析は pdfjs-dist サーバーサイド、Python 版と同値を確認。subagent-driven-development で Task 1-8 を haiku で実装、Dashboard 統合は inline。admin 動作確認 OK |
| Forest | fix: ShinkoukiEditModal タブ切替時の高さジャンプ修正 | 0.05 | 0.03 | -0.02 | a-forest (A) | 2026-04-23 | 2026-04-23 | タブコンテンツを minHeight:560 のラッパーで固定。次ビルド/型チェック OK、PR #11 マージ済 (commit 46386c1) |
| Forest | Phase A 仕上げ: v9 残機能移植 (T-F10/T-F2/T-F3/T-F4/T-F11/T-F7/T-F5 閲覧/T-F6/T-F9/T-F8) | 9.3 | | | a-forest (A) + a-auto | 2026-04-24 | | comparison §6 推奨順で消化。旧 9.8d から F5 アップロード UI (0.5d) を Phase B Storage 統合へ移行で除外し 9.3d に再計算。内訳: T-F10=0.95 / T-F2+F3=0.35 / T-F4+F11=2.2 / T-F7=0.25 / T-F5 閲覧=1.85 / T-F6 (Node ZIP)=2.85 / T-F9+F8=0.85 (a-auto 可)。判1-5 = A/B/B/B/B（暫定確定、次回対話で東海林さん正式同意取得予定）。F6 ZIP は Node ランタイム確定 (Edge 4.5MB 上限のため) |
| Forest | T-F10 (P08 販管費 + reflected note) | 0.95 | 0.6 | -0.35 | a-forest (A) | 2026-04-25 | 2026-04-25 | Vitest 5 件導入 + 型 + queries + DetailModal セクション + reflected note。PR #33 merged。23 tests green。 |
| Forest | T-F2-01 (ヘッダー最終更新日) + T-F3-F8 (MacroChart タイトル) | 0.55 | 0.35 | -0.2 | a-forest (A) | 2026-04-25 | 2026-04-25 | fmtDateJP / fetchLastUpdated / ForestShell 表示 + MacroChart タイトル v9 互換化。PR #43 merged。SummaryCards は動的計算維持（auto 判1）。MacroChart 高さ判3 は判断保留のため未変更。 |
| Tree | fix: mapGardenRoleToTreeRole の outsource 漏れ + exhaustiveness | — | 0.15 | — | a-forest (A) | 2026-04-25 | 2026-04-25 | a-main 経由代行。GardenRole 8 値全網羅 + never チェック追加。outsource → MANAGER 暫定、東海林さん確認待ち。PR #48 merged。 |
| Forest | T-F7-01 (共通 InfoTooltip) | 0.25 | 0.2 | -0.05 | a-forest (A) | 2026-04-25 | 2026-04-25 | hover/focus/Esc 完備、a11y (role=tooltip, aria-describedby/expanded) 完備。Forest 規約に従いインライン style 採用。15 tests green。PR #49 (Vercel pass、レビュー待ち)。 |
| Forest | T-F4-02 (Tax Calendar) + T-F11-01 (Tax Detail Modal) | 1.5 | 1.0 | -0.5 | a-forest (A) | 2026-04-25 | 2026-04-25 | Phase 1-4 で types + queries + tax-calendar.ts + TaxPill + TaxDetailModal + TaxCalendar + 統合。64 tests green、累計 157/157。インライン style 規約遵守。判3 高さは判断保留扱い。self-review で overflow-x ラッパー追加 (PR #50 commit f5ff69d)。Vercel pass、レビュー待ち。 |
| Forest | T-F9-01 (MicroGrid 差分監査) + T-F8-01 (MacroChart 差分検証) | 0.85 | 0.25 | -0.6 | a-forest (A) | 2026-04-25 | 2026-04-25 | 自律実行モード稼働分。spec の 10 点差分主張を全コード照合で検証、12 + 1 (高さ判3) 項目検証で T-F8 はほぼ準拠確認。実装は spec §13 推奨フロー（東海林さん採否合意先行）に従い未着手、audit verification ドキュメントのみ作成 (`docs/forest-audit-t-f9-t-f8-verification-202604251700.md`)。実装時 D2/D4/D8/D10 採用で TDD 込み 0.65d 見込み。 |
| Forest | F4 反映: MacroChart 高さ 320 → 360 (v9 互換) | 0.05 | 0.05 | 0 | a-forest (A) | 2026-04-25 | 2026-04-25 | T-F3-F8 §12 判3 の判断保留を東海林さん「360 に変更」回答で解消。1 行修正 + 検証テスト 1 件追加。94/94 tests + build OK。PR #59 mini PR 発行（レビュー: a-bloom）。 |
| a-main | 4 セッション分担モデル設計 + GW タスク dispatch（Bloom-002 / a-auto / a-review）| 0.3 | 0.3 | 0 | a-main (A) | 2026-04-26 | 2026-04-26 | a-main-007 起動から 4 セッション並走体制構築まで。判断保留 4 件議論（npm 8 種承認 / cross-ui-07 化 / 矛盾解消 / 8-role 修正）+ M-1/M-2/M-4 修正方針確定 + 4 通り配布短文生成。Phase 1 完了報告待機中。 |
| a-main | push 順序プラン §8 拡張（B 垢権限現状 + 21 ブランチ snapshot + 即実行スクリプト）| 0.15 | 0.15 | 0 | a-main (A) | 2026-04-26 | 2026-04-26 | _shared/decisions/push-plan-20260426-github-recovery.md に 2026-04-26 夜更新追記。invite 受諾 → §8.4 即実行で 25 分完走想定。 |
| a-main | a-auto 成果レビュー（pending-prework 33 件 + cross-ui-audit 6 spec）| 0.1 | 0.1 | 0 | a-main (A) | 2026-04-26 | 2026-04-26 | 33 件は 即決可 22 / 議論必要 11 に分類済。cross-ui-audit は重大矛盾 4 件指摘 → M-1/M-2/M-4 を a-auto C+D+E+F dispatch で解消、M-3 (8-role) も同 dispatch C で解消。 |
| a-main | 33 件 判断保留 確定処理 + 5 カテゴリ落とし込み | 0.4 | 0.4 | 0 | a-main (A) | 2026-04-26 | 2026-04-26 | Cat 1-5 全 33 件を東海林さん採択（A=26 / B=5 / C=1 / 修正・拡張=5 件）。確定ログ作成（`_shared/decisions/decisions-pending-batch-20260426.md`）+ memory 5 件強化（新規 3：super_admin 操作・開発者ページ・Tree D2 戦略 / 既存更新 2：help_module・payslip_design）+ MEMORY.md 索引更新 + 4 セッション dispatch 配布（Bud / Tree / Root / Soil） |
| a-tree | Tree Phase D 5 次 follow-up（33 件 確定 Cat 3 反映、commit f03f5d6）| 1.0 | 1.0 | 0 | a-tree (A) | 2026-04-26 | 2026-04-26 | #16 D-1+D-2 セットリリース戦略を plan v3 §4 + softphone spec §0 に明示、#17 50 名超 Realtime 自動切替（D-03）、#18 録音 API 注記（D-01/D-03/Softphone）、#19 他商材展開（D-04）、#20 KPI 3 階層 DB 設計（D-05）。8 files +288 -5。**plan 全体見積 6.5d → 8.5d（+2.0d ソフトフォン統合）**、要 v3.1 別 PR 検討 |
| a-main | デスクトップ版前提の警告補強（user_shoji_profile.md）| 0.05 | 0.05 | 0 | a-main (A) | 2026-04-26 | 2026-04-26 | a-soil 起動指示で誤って PowerShell + claude コマンド案内を出してしまったため、user_shoji_profile.md 冒頭に「⚠️ 最重要：作業環境はデスクトップアプリ版」セクションを追加、NG/OK 指示パターン明示、a-main 代行範囲明記。同種ミス再発防止 |
| Soil | Soil Phase B-03 §13 判断保留 5 件確定反映（Cat 5 #29-#33、commit 97b5ddb）| 0.2 | 0.2 | 0 | a-soil (A) | 2026-04-26 | 2026-04-26 | feature/soil-phase-b-decisions-applied（base = feature/soil-phase-b-specs-batch19-auto、a-auto-002 ローカルから取込）。spec §13 のみ +15 -11、ヘッダーに出典記載 + 表に「状態」列追加。判 2/3/6/7 は保留継続（33 件外）。batch19-auto は origin 未 push のため本ブランチも未 push、push タイミング a-main 指示待ち |
| 全モジュール | 8-role 統一 完了（cross-ui + Tree Phase D + 残 4 ファイル）| 0.3 | 0.3 | 0 | a-auto (A) | 2026-04-26 | 2026-04-26 | C+D+E+F (6分) + G (5分) で計 11 分。outsource ロール（staff と manager の間）を spec 全体で統一。3 ブランチ：feature/cross-ui-8-role-fix-20260426-auto / feature/tree-phase-d-8-role-fix-20260426-auto / feature/cross-modules-8-role-fix-residual-20260427-auto（develop merge で全モジュール統一達成）|
| Root | Cat 1+2 反映 + Garden 開発者ページ新規 spec（4 commits、+1,725 -167）| 1.5 | 1.5 | 0 | a-root-002 (A) | 2026-04-26 | 2026-04-26 | feature/root-pending-decisions-applied-20260426（base = root-permissions-and-help-specs）。3 subagent 並列で B-01 改訂（+257/-16）+ ヘルプ spec 改訂（+454/-151）+ dev-inbox 新規 spec（+775 行）+ handoff/effort（+239）。「社長」→「東海林さん」表現統一達成。**実装増分 +3.0d**（B-01 ワンタイムキー +0.25d / ヘルプ依頼ボタン +0.5d / dev-inbox 実装 2.25d）|
| Bud | Cat 4 反映 4 次 follow-up（commit 58988c9、+775 -173、6 spec 改訂）| 0.4 | 0.4 | 0 | a-bud (A) | 2026-04-26 | 2026-04-26 | #26 上田目視ダブルチェック: D-10/D-11 status 6→7 段階に拡張、新ロール payroll_visual_checker、新 Server Action 2 種、新 RLS policy 2 件。D-04 §2.7 上田 UI 要件正本化 + URL /bud/payroll/visual-check。D-12 schedule に visual_double_check stage 追加（+1 営業日 offset）+ 上田向けリマインダ。D-07 §4.1 確認フロー 11 ステップ再構成、後道さん不在を全 spec で明示。#27 D-07 §4.4 exportPayrollBatchHybrid() で FB / 会計 / MFC CSV 1 トランザクション同時生成。#28 D-03 §7 RLS admin-only 化。**実装増分 +0.95d**（旧 8.25d → 新 9.2d） |
| Bloom + Common | ShojiStatusWidget MVP + cross-ui-01/06 skeleton 全 12 task 完了（22 commits、24 reviewer dispatches、0 Critical）| 0.95 | 0.95 | 0 | a-bloom-002 (A) | 2026-04-26 | 2026-04-26 | feature/garden-common-ui-and-shoji-status。Phase 0 (PK 確認) + Phase 1 (GET/PUT API) + Phase 2 (Context/Widget/Editor/詳細/Workboard) + Phase 3 (Header/login/9 アイコンホーム/Provider/BloomShell 注入)。subagent-driven-development で implementer + spec reviewer + code quality reviewer の 3 段階レビュー × 12 task。追加 tests 23 件。Next.js 16 async cookies 適応 + SSR guard + DB 最適化 + achievementSlot 拡張 等の inline 修正 6 件。GW α 完走条件 3 点（/login + / + ShojiStatusWidget）達成、残ブロッカー = npm install + Supabase migration 手動適用のみ。Bloom 0.55d + Common 0.4d |
| Tree | Track B 責任者ツール spec 起草（commit 01d41ee、+571 行 / 3 files）| 0.5 | 0.5 | 0 | a-tree (A) | 2026-04-26 | 2026-04-26 | feature/tree-track-b-supervisor-tools-20260427（develop ベース新規）。4 候補機能（F1 実件数報告 .xlsx 自動生成 / F2 営業 FB 集約 / F3 サマリ画面 / F4 その他）+ 優先順位提案。推奨 = F1+F3 セット最小版 1.5d。Phase 2 拡張 +2.0d、合計最大 3.5d。後道さん FB 不要（Track B = 営業側、架電画面例外と同方針）。判断保留 7 件（東海林さん 4 件 + a-main 判断 1 件 + 後置き 2 件）|
| Tree | Track B 判断保留 #3 確定反映 v1.1（commit 950fbd6、+120 -10）| 0.1 | 0.1 | 0 | a-tree (A) | 2026-04-26 | 2026-04-26 | A 案「D-01 完成後 schema 流用」採択を spec 6 セクションに反映 + 廃案 B/C 理由明記 + リスク #2 解消化。残り判断保留 #1/#2/#4 は東海林さん直接判断要、#5/#6/#7 は実装着手時自動進行 |
| Tree | Phase D-01 schema migration 実装（commit 45decb4、+975 / 4 files、Track A α 版 + Track B Phase 1 の前提）| 0.7 | 0.5 | -0.2 | a-tree (A) | 2026-04-26 | 2026-04-26 | feature/tree-phase-d-01-implementation-20260427。3 テーブル（tree_calling_sessions / tree_call_records / tree_agent_assignments）+ 集計・不変ガード Trigger + 監査ログ 6 種 + RLS 15 ポリシー（4 階層）+ VIEW 2 種 + Soil 連携 3 カラム。冪等性 54 箇所、前提依存自動検知。spec 詳細だったため SQL 化機械的に進行、想定より 0.2d 早期完成 |
| Bloom + Common | Phase 2-2 候補 7（4 カテゴリ → 3 レイヤー再分類、commit 4b69d2f）| 0.3 | 0.3 | 0 | a-bloom-002 (A) | 2026-04-26 | 2026-04-26 | NotebookLM ② 反映。modules.ts / slot-positions.ts / ModuleSlot / 2 tests 更新。12 モジュール × 3 レイヤー（樹冠 5 / 地上 4 / 地下 3）配置。Bloom/Fruit/Seed/Rill/Sprout/Root の座標再配分（生物学的整合）。aria-label 「（樹冠）」「（地上）」「（地下）」更新。完全分離アーキテクチャ真価発揮、背景画像 layer 不変 |
| a-main | NotebookLM ② 「The Digital Terrarium」全体把握 + memory 大幅更新 + 戦略再修正（盆栽 NG 確定、5 Atmospheric Variations 採用）| 0.4 | 0.4 | 0 | a-main (A) | 2026-04-26 | 2026-04-26 | project_garden_3layer_visual_model.md v2 最終確定版。ブランドステートメント / 12 面体クリスタルアイコン / 3 レイヤー × 12 モジュール完全マッピング / 5 Atmospheric Variations / UI Safe Zones / 美学規約 DO/DON'T。Bloom-002 への戦略更新 dispatch 起草、Phase 2-2 残候補の優先順改訂 |
| a-main | NotebookLM PDF レビュー + 3 軸対比戦略 確定 + memory 化 + a-auto J dispatch + Bloom-002 共有 | 0.3 | 0.3 | 0 | a-main (A) | 2026-04-26 | 2026-04-26 | NotebookLM 出力 15 ページ（5 案 + 25 プロンプト + 比較マトリクス）受領 + _shared/attachments に保管。東海林さん最推し = ボタニカル水彩 確定。3 軸対比戦略採択（水彩 + 和モダン + 北欧テラリウム）。memory 新規 user_shoji_design_preferences.md。a-auto J で 3 案プロンプト Refinement、Bloom-002 へ世界観整合材料共有 |
| Bloom + Common | Phase 2-0 + Phase 2-1 完走（盆栽ビュー基盤 + 改訂spec 反映、8 commits）| 1.5 | 1.5 | 0 | a-bloom-002 (A) | 2026-04-26 | 2026-04-26 | feature/garden-common-ui-and-shoji-status。Phase 2-0: garden-view 7 files 基盤 + 12 module + 雲型 ShojiStatus + tests 10 ケース。Phase 2-1: 改訂版 cross-ui-04/06/01 反映（中央基準 xy 座標 + 12 brand color + BonsaiCenter + time-theme wire-up）+ tests 5 ケース + Group F polish（aria-label / 4 カテゴリ metadata）。**約 1 日前倒しで完走**。残ブロッカー: AI 画像生成のみ（朝、Phase 2-2 で組込）|
| a-main | godo-demo-script-and-handout-20260426.md 起草（5/5 後道さんデモ台本 + 補助資料、5-10 分対面・紙 NG 制約反映） | 0.2 | 0.2 | 0 | a-main (A) | 2026-04-26 | 2026-04-26 | _shared/decisions/godo-demo-script-and-handout-20260426.md。Phase 1-7 構成（つかみ → 案 1-3 → 反応 → 質問対応）+ 反応パターン別対応 4 シナリオ + 想定 Q&A 5 件 + NG/OK パターン明記 + 1 page サマリ + フォールバック紙資料案。memory 新規 project_godo_communication_style.md |
| a-main | Sprout/Calendar 役割定義 memo + Tree Track B 機能候補 10 件拡張リスト | 0.3 | 0.3 | 0 | a-main (A) | 2026-04-26 | 2026-04-26 | project_garden_sprout_calendar_roles.md（新規 memory、12 モジュール 役割整理 + 盆栽ビュー位置）+ tree-track-b-supervisor-tools-expanded-20260426.md（10 候補機能、a-tree spec 4 件を補完）|
| a-main | 007 漏れ補完: 5 Var memory v3 化 + The_Digital_Terrarium.pdf 共有保管庫保存 + INDEX 追記 | 0.15 | 0.15 | 0 | a-main (A) | 2026-04-27 | 2026-04-27 | a-main 007 強制終了で漏れた 4 件を補完: ①Var 5 表記揺れ訂正（Water Cycle / Workflow Flow 併記）②2 軸構造（元 Garden ビジョン軸 vs NotebookLM ② 軸、両方ともコンセプト画像で UI 背景とは別物）③Pattern A vs B 戦略追記（A 推奨 = コンセプト見せ合戦）④`The_Digital_Terrarium.pdf` を `_shared/attachments/20260427/` 保管 + INDEX に登録。memory `project_garden_3layer_visual_model.md` v3 |
| a-main | Bloom-002 Phase 2-2 dispatch prep v2 改訂（Pattern A 採用反映） | 0.15 | 0.15 | 0 | a-main (A) | 2026-04-27 | 2026-04-27 | `_shared/decisions/bloom-phase-2-2-dispatch-prep-v2-20260427.md` 起草。候補 1（BackgroundLayer 統合）を **5/5 採択後** dispatch に切替、候補 2 (hover 演出) + 候補 3 (API tests) を最優先化。第 1 波 1.3d / 第 2 波 状況次第 / 5/5 後 候補 6 dispatch。dispatch 短文コピペ可能形式で完備 |
| Bloom + Common | Phase 2-2 第 1 波: hover 演出 (cross-ui-06 §2.5) + API tests (Phase 1 持ち越し分) | 1.3 | 1.3 | 0 | a-bloom-002 (A) | 2026-04-27 | 2026-04-27 | 4 commits（d12c7e4 + a7f1b26 + e80682e + d144c80）。12 モジュール固有 hover 演出（globals.css 112 行、transition / keyframes forwards / keyframes infinite の 3 タイプ、prefers-reduced-motion 完全対応、data-module-key + gv-* 名前空間、ModuleKey union type）。/api/ceo-status route tests 14 ケース（GET 5 + PUT 9、edge cases 4 件は review feedback 反映）。inline transition の specificity 罠を発見・修正。reviews ✅✅、0 Critical / 0 Important。累計 31 commits ローカル。push は GitHub 復旧後 |
| a-main | GitHub push 復旧 + docs カテゴリ 5 件先行 push（B 垢開通直後の慎重 test → option 2 完走） | 0.5 | 0.3 | -0.2 | a-main (A) | 2026-04-27 | 2026-04-27 | 槙さん invite 受諾で B 垢が Hyuaran org owner 権限取得。①gh auth setup-git で git credential を旧 ShojiMikoto → ShojiMikoto-B に切替（Windows 資格情報マネージャ問題解決）②git config user.email/user.name 切替（local scope）③5 ブランチ push 完走（workspace/a-main-008 / docs/handoff-a-main-005-to-006 / docs/claude-md-modules-12 / docs/kintone-fruit-sprout-analysis-20260426 / workspace/a-main-006）④5 分間隔遵守、各 push 後に rate limit + suspended 状態 verify、全件 ban 兆候ゼロ確認。残 17 ブランチは明日朝以降に分散 push 予定 |
| a-main | 後道さん 5/5 デモ台本 v2 起草（Pattern A + 2 軸 + 5 Var + hover 演出 反映） | 0.3 | 0.3 | 0 | a-main (A) | 2026-04-27 | 2026-04-27 | `_shared/decisions/godo-demo-script-and-handout-v2-20260427.md` 起草。v1 (4/26) からの 6 件のギャップを反映: ①3 案 → 2 軸対比 ②画面表示 → PDF スクショ大画面 (Pattern A) ③盆栽表現削除 ④5 Var を採択後の続きとして位置付け ⑤Phase 5 hover 演出 1 つ追加（Bloom-002 第 1 波成果活用）⑥採択後の流れを Pattern A 前提に修正。台本 6 分構成（短 4 分 / 長 9 分）+ 反応パターン 5 種（A 軸 1 採択 / B 軸 2 採択 / C 全 NG / D 迷う / E ピンと来ない）+ 想定 Q&A 6 件 + 当日物理セットアップ + 紙資料フォールバック。memory 連携: project_garden_3layer_visual_model.md v3、bloom-phase-2-2-dispatch-prep-v2-20260427.md |
| a-main | Tree Phase D-02 着手準備 + a-tree dispatch | 0.2 | 0.2 | 0 | a-main (A) | 2026-04-27 | 2026-04-27 | spec `spec-tree-phase-d-02-operator-ui.md` (399 行) 通読 + handoff `handoff-tree-202604271700-phase-d-01-implementation.md` 確認。判断保留 7 件を「要はこういうこと」列付き表で整理（キャンペーン選択自動化 / オフラインキュー上限 / 巻き戻し時間枠 / F1-F10 ブラウザ衝突 / 音声フィードバック / 電話番号リンク / メモ文字数）→ 全件 a-tree 推奨スタンス採用で確定。10 ステップ実装プラン（合計 1.0d）+ FM 互換ショートカット + オフライン耐性 + 巻き戻し UI + 画面遷移ガード + エラー Toast 統一 を含む dispatch 短文起草 → a-tree へ投下 |
| a-main | Bloom-002 候補 6 採択軸別 dispatch 短文 事前起草（Pattern A/B + ハイブリッド雛形） | 0.15 | 0.15 | 0 | a-main (A) | 2026-04-27 | 2026-04-27 | `_shared/decisions/bloom-candidate-6-dispatch-by-axis-20260427.md` 起草。5/5 採択結果即対応用に 2 パターン完全 dispatch 短文を準備: §1 dispatch A（元 Garden ビジョン軸採択時、UI 背景 4 枚 + TimeThemeProvider + 12 モジュール再配置、合計 0.5d）/ §2 dispatch B（Digital Terrarium 軸採択時、UI 背景 5 枚 + Variation 業務コンテキスト連動切替 + 3 レイヤー Y 座標、合計 1.0d）/ §3 ハイブリッド case D 用テンプレ。各パターンに「東海林さん側作業」表 + 関連 memory / spec 連携明記 |
| a-main | PR 一括発行用テンプレ起草（39 PR の base/title/body + 3 カテゴリ別 + 重大指摘 5 強化）| 0.2 | 0.2 | 0 | a-main (A) | 2026-04-27 | 2026-04-27 | `_shared/decisions/pr-bulk-creation-templates-20260427.md` 起草。共通ルール（base=develop / title 70 字以内）+ §1 docs 5 PR（即 merge OK）+ §2 重大指摘 5 PR（個別 body 強化、レビュー観点・影響範囲明記、a-review に critical-review label 付き個別レビュー依頼）+ §3 通常 feature 28 PR（a-auto 14 / a-auto-002 2 / a-bloom 3 / a-bloom-002 1 大規模 31 commits / a-bud 1 / a-forest 1 / a-leaf 4 / a-root 4 / a-soil 1 / a-tree 3）+ §4 PR 発行戦略（4 段階）+ §5 リスク管理 + §6 完了基準。bash 一括発行スクリプト雛形完備、push 完走後 約 20 分で 39 PR 発行可能 |
| a-main | Phase B push 6 件完走（housekeeping + 重大指摘 5 件）+ #4 誤 merge 復旧 | 0.5 | 0.6 | +0.1 | a-main (A) | 2026-04-27 | 2026-04-27 | 09:21 開始、09:46 完了。housekeeping (89e093e) / cross-history #47 (6207756) / leaf-a1c #65 (c44dc0e) / forest-t-f5 #64 (821f166) / bud-phase-d-specs-batch17 #74 全件成功。**bud-phase-0-auth #55 で non-fast-forward エラー** → develop マージで remote が前進していたのが原因 → 誤って別 branch (bud-phase-d-specs-batch17-auto-fixes) で pull merge してしまい local 汚染 → reset --hard 58988c9 で rollback (東海林さん承認) → 正しい branch (bud-phase-0-auth) に切替えて pull merge → push 成功 (019887a)。誤merge 操作の +0.1d で見積超過 |
| a-main | a-auto-004 worktree 作成（コンテキスト 84% 引っ越し対応、a-auto-003 から訂正）| 0.1 | 0.1 | 0 | a-main (A) | 2026-04-27 | 2026-04-27 | 当初 `C:/garden/a-auto-003` 作成 → 東海林さん指摘でセッションカウント (a-auto / 002 で運用された Auto001-003 のうち最新が Auto003) と整合させ `C:/garden/a-auto-004` に訂正。a-auto-003 は破棄（未 push、影響なし）。ブランチ `workspace/a-auto-004`（develop ベース）、git config B 垢設定。教訓: 次回以降 worktree 命名は東海林さんのセッションカウントに合わせて確認 |
| a-main | Phase 残A push 34 ブランチ 開始（5 分間隔背景実行） | 2.0 | | | a-main (A) | 2026-04-27 | | 進行中、約 2.75 時間後完了見込み（~12:42）。a-auto 14 / a-auto-002 2 / a-bloom 3 / a-bloom-002 1（31 commits 大規模）/ a-bud 1 / a-forest 1 / a-leaf 4 / a-root 3 / a-root-002 1 / a-soil 1 / a-tree 3。各 push 後に rate limit + B 垢状態 verify、エラーは log のみで継続（後で個別対処） |
| Tree | Phase D-02 Step 1+2+3 完走（キャンペーン選択 + セッション API + Sprout Supabase 連携） | 0.3 | 0.3 | 0 | a-tree (A) | 2026-04-27 | 2026-04-27 | ブランチ `feature/tree-phase-d-02-implementation-20260427`（develop ベース、新規）。3 commits（bc3bcfa / 60fbc7d / be6ef68）+ vitest 31/31 PASS。新 path `/tree/select-campaign` で既存 `/tree/call` 完全保護、insertTreeCallRecord（CHECK 制約準拠 + メモ必須 + 500 文字 truncate）+ resultCodeMapping 12 種。Phase 残A 開始前に存在しなかったため push リスト外、後で個別 push 必要。残 Step 4-10（0.7d）は次セッション継続、handoff `handoff-tree-202604272000-phase-d-02-step-1-3.md` |
| a-auto-002 | コンテキスト 84% handoff 書出し | 0.05 | 0.05 | 0 | a-auto-002 (A) | 2026-04-27 | 2026-04-27 | docs/handoff-a-auto-002-to-003-20260427.md（114 行）+ commit d820876（branch: feature/image-prompts-3candidates-final-20260427-auto）。23 滞留 commits（22 + 本 handoff）は Phase 残A の item #11 で自動 push 予定（推定 10:42）。a-auto-003 は workspace/a-auto-003 worktree で起動、handoff は `C:/garden/a-auto-002/docs/...` 直接読み |
| a-main | 後道さんデモ Pattern B フル実装計画 起草（戦略大転換）| 0.5 | 0.5 | 0 | a-main (A) | 2026-04-27 | 2026-04-27 | 東海林さん指示「後道さんは紙はみない、実物 UI 必須、2 案の UI 作成にすすめよう」を受けて Pattern A → Pattern B に転換確定。`_shared/decisions/godo-pattern-b-fullspec-20260427.md` 起草 (約 250 行)。①全体スコープ（フル実装、AI 画像 9 枚 + Bloom-002 1.0d + デモ準備 0.5d）②AI 画像 9 枚 (案 1 garden-vision 4 時間帯 + 案 2 digital-terrarium 5 Var) のプロンプト集 (Midjourney v7+ 用、共通テンプレ + 差分プロンプト) ③東海林さん側 task ④Bloom-002 dispatch 短文 (画像配置完了後即投下用、commit + tests + a-review 込み) ⑤5/5 デモシナリオ v3 (Pattern B 採用、Ctrl+1/2 で案切替) ⑥関連 doc update リスト ⑦リスク管理 ⑧完了基準 |
| a-main | 戦略簡素化: 6 atmospheres カルーセル + 12 モジュールロゴ準備 完了 | 0.4 | 0.5 | +0.1 | a-main (A) | 2026-04-27 | 2026-04-27 | 東海林さん指示「2 軸の UI 作成は大変、6 枚の移り変わりにして後道さんの好みを探ろう」で 2 軸 → 1 UI + 6 atmospheres カルーセルに簡素化。①ChatGPT/DALL-E 用 5 Var プロンプト集 起草（インライン）②東海林さん生成 → 私が WebP 変換 (5.9% 圧縮、計 750 KB) → digital-terrarium/ 配置 ③6 番目 watercolor-tree 追加 ④12 モジュールロゴ ChatGPT prompts 起草 (`garden-12-module-logos-chatgpt-prompts-20260427.md` + インライン版) ⑤共通スタイル前置きでガラスクリスタル統一感トラブル → 強化版前置き提示 ⑥東海林さん 2 batches 生成（1 回目 explore / 2 回目 demo 採用版）→ 24 PNG + 24 WebP に変換配置 ⑦INDEX.md 更新 (4-6 entries)。Phase 2（新セッションで参考画像方式①）は将来予約 |
| a-main | Bloom-002 dispatch v3 起草 + demo script v3 + memory v4 更新 | 0.5 | 0.5 | 0 | a-main (A) | 2026-04-27 | 2026-04-27 | ①透明化 12 アイコン (Pillow) → /transparent/ 配置 (PNG + WebP alpha、計 ~25 MB / ~2.1 MB) ②Bloom-002 dispatch v3 (`docs/bloom-002-dispatch-v3-pattern-b-carousel-20260427.md`) 起草 - Pattern B カルーセル統合版、6 atmospheres + 12 透明アイコン + 既存 hover 演出互換、~0.5d 想定 ③demo script v3 (`_shared/decisions/godo-demo-script-and-handout-v3-20260427.md`) - Pattern B + 6 atmospheres カルーセル戦略反映、6 分構成（短 4 / 長 9）+ 反応パターン 5 種 + Q&A 7 件 ④memory `project_garden_3layer_visual_model.md` v3 → v4（Pattern B 採用転換 + 6 atmospheres 確定 + 12 透明アイコン採用記録） |
| Bloom + Common | Phase 2-2 候補 6: Pattern B カルーセル統合版（5/5 デモ UI 完成）| 0.5 | 0.5 | 0 | a-bloom-002 (A) | 2026-04-27 | 2026-04-27 | 4 commits + 1 材料 commit（e87180 + 32b2c35 + 624f593 + 4de990f）。BackgroundCarousel（6 atmospheres、fade 800ms、auto 8s / manual キーボード `1`-`6`/`A`/`←→`、6 layers 同時 render + opacity transition でパフォーマンス最適化、Type safe AtmosphereId = 0\|1\|2\|3\|4\|5）+ ModuleSlot 12 透明アイコン置換（40x40px、disabled grayscale 0.6、既存 hover 演出 100% 互換）+ URL クエリパラメータ `?atmosphere=N`（Next.js 16 async searchParams + 範囲外正規化）+ a11y（prefers-reduced-motion auto-disable + INPUT/TEXTAREA/SELECT 除外 + aria-label）+ 59 tests（BackgroundCarousel 16 + atmospheres 9 + GardenView 4 + ModuleSlot 30）。reviews ✅✅、0 Critical / 0 Important。Phase 2 累計 ~39 commits ローカル、push 待機 |
| Bloom | Phase A-1 Day 1: 基盤（認証・ナビ・レイアウト） | 0.5 | | | a-bloom (A) | 2026-04-25 | | Phase A-1 先行記入（§12）。Forest 認証流用 |
| Bloom | Phase A-1 Day 1: Supabase migration（bloom_* 8テーブル） | 0.5 | | | a-bloom (A) | 2026-04-25 | | 設計書 §1 SQL。garden-dev Dashboard 手動適用 |
| Bloom | Phase A-1 Day 2: Workboard 画面（個人可視化） | 0.5 | | | a-bloom (A) | | | ステータス・本日予定・進行中PJ・今週実績・次マイルストーン |
| Bloom | Phase A-1 Day 2: Roadmap 画面（全体進捗） | 0.5 | | | a-bloom (A) | | | 👥みんな向け / ⚙️開発向け 切替対応 |
| Bloom | Phase A-1 Day 3: 月次ダイジェスト画面（会議用） | 0.5 | | | a-bloom (A) | | | 毎月15-20日の責任者会議で使用、PDF/画像エクスポート |
| Bloom | Phase A-1 Day 3: 切替機能・アラート | 0.25 | | | a-bloom (A) | | | localStorage 保存、お知らせバナー |
| Bloom | Phase A-1 Day 4: Chatwork 連携基盤 | 0.25 | | | a-bloom (A) | | | pgcrypto トークン暗号化（判1）、Garden 開発進捗ルーム |
| Bloom | Phase A-1 Day 4: 日次・週次・月次 Cron | 1.0 | | | a-bloom (A) | | | Vercel Cron、Node ランタイム（判2） |
| Bloom | Phase A-1: 他モジュール引っ越し可能な疎結合化 | 0.25 | | | a-bloom (A) | | | bloom_* プレフィックス、components/_lib 分離、将来 Seed 等へ移植可 |
| Root | Phase 1: 認証・権限管理 | — | 1.0 | — | b-main (B) | 2026-04-22 | 2026-04-23 | retroactive 記録（着手時点で見積未設定）。設計書+プラン+実装14コミット+レビュー修正3件+ハンドオフ。PR #9 マージ済。教訓：Tree Phase A 認証パターン流用で高速化、RLS ポリシーは適用前に pg_policies 確認、root_audit_log の INSERT/SELECT ポリシー欠落を後から追加 |
| Root | Phase 2: 他アプリからの参照ルール整備 | 0.5 | — | — | a-root (A) | 2026-04-23 | | Bud/Leaf 未実装のため「Root 側で提供する API 契約書・共有クエリヘルパー・RLS 前提条件ドキュメント」に絞る方針。**2026-04-24 a-main 判断：Phase 2 は保留。Bud/Leaf 連携開始時に精緻化する。** |
| Root | Phase A-1: 7マスタ UI 一括仕上げ（validators / FileMaker風UX / 全マスタ適用） | 3.5 | 1.0 | -2.5 | a-root (A) | 2026-04-24 | 2026-04-24 | 当初 T1〜T7 を個別 0.5d×7 の予定だったが、Phase 1 時点で CRUD UI は既に実装済と判明。スコープを「既存実装の仕上げ」に読み替え圧縮。validators.ts / useMasterShortcuts / FormField(error)/ Modal(onSubmit)/ DataTable(activeIndex) を追加し 7 マスタに適用。PR #14。§16 7種テストは東海林さん別途実施予定。 |
| Root | Phase A-2: KoT API 連携（月次勤怠 API 直接取込） | 1.0 | 0.5 | -0.5 | a-root (A) | 2026-04-24 | 2026-04-24 | 案A（CSV手動）→案C（API直行）へ切替。KoT v1.0 /employees + /monthly-workings を Server Action で取得→ employeeKey→code→employee_number→employee_id 解決→ root_attendance に upsert。疎通は IP 制限設定で一度失敗→解消後 200 OK・42名取得確認。/monthly-workings の date は YYYY-MM 形式（YYYY-MM-DD は 400）と実機で判明、修正反映済。PR #15。本番 Vercel IP 対応は別タスク。 |
| Root | Phase 品質向上: テスト拡充 + known-pitfalls 追加（限定 auto モード） | 0.5 | 0.4 | -0.1 | a-root-002 (A) | 2026-04-25 | 2026-04-25 | T1〜T6 を subagent-driven-development で並列実装。validators 6マスタ + primitives + sanitize-payload + KoT API client + garden_role 8x8 マトリックス + known-pitfalls #4-#8 追加。Vitest 33→570 件 (+537) 全 pass。レビュー 1 巡 (4 Important fix) 後 PR 発行。動作変更なし、既存品質向上のみ。 |
| Root | Phase B 全 spec 起草（B-1 権限 / B-2 監査 / B-3 退職者 / B-4 整合 / B-5 認証 / B-6 通知 / B-7 移行）| 1.0 | 0.6 | -0.4 | a-root-002 (A) | 2026-04-25 | 2026-04-25 | 7 spec を subagent-driven-development で**並列起草**（sonnet × 7 並列、約 10 分稼働 + 統合 10 分）。合計 3,858 行、Phase B 実装見積 14.75d（B-1=2.25 / B-2=1.75 / B-3=0.5 / B-4=1.25 / B-5=2.5 / B-6=2.5 / B-7=4.0）。判断保留 61 件 + 未確認事項 36 件は東海林さん要ヒアリング。実装は Phase B 着手指示後。develop 向け PR、レビュアー a-bloom。 |
| Root | Phase B-1 実装: 権限詳細設計（root_settings + 8ロール×機能マトリックス） | 2.25 | | | a-root (A) | | | spec: docs/specs/2026-04-25-root-phase-b-01-permissions-matrix.md。root_settings (module, feature, role) 三項 PK + has_permission() helper + admin マトリックスエディタ。Phase B 着手指示後。 |
| Root | Phase B-2 実装: 監査ログ拡張（root_audit_log + 9 モジュール横断） | 1.75 | | | a-root (A) | | | spec: docs/specs/2026-04-25-root-phase-b-02-audit-log-extension.md。既存 root_audit_log への ALTER（occurred_at / module / entity_* / before_after_state / severity 等）+ writeAudit() 拡張 + CI チェック。 |
| Root | Phase B-3 実装: 退職者扱い運用ルール（termination/contract_end/deleted_at） | 0.5 | | | a-root (A) | | | spec: docs/specs/2026-04-25-root-phase-b-03-termination-rules.md。is_user_active() 更新 + is_employee_payroll_target() / get_nencho_targets() helper 追加。Bud 給与計算と密連携。 |
| Root | Phase B-4 実装: マスタ間整合チェック（20 ルール cron 自動化） | 1.25 | | | a-root (A) | | | spec: docs/specs/2026-04-25-root-phase-b-04-master-consistency.md。root_consistency_violations + 日次 cron + Chatwork 通知。assertVendorActive() 等の Bud/Leaf 連携 utility 提供。 |
| Root | Phase B-5 実装: 認証セキュリティ強化（パス再発行 / 2FA / セッション / brute force） | 2.5 | | | a-root (A) | | | spec: docs/specs/2026-04-25-root-phase-b-05-auth-security.md。Supabase Auth MFA + root_login_attempts + zxcvbn パスワード強度 + admin force reset。共用 PC（Tree 端末）運用は判断保留。 |
| Root | Phase B-6 実装: 通知基盤（Chatwork / Email 統合 + 購読 DB 駆動化） | 2.5 | | | a-root (A) | | | spec: docs/specs/2026-04-25-root-phase-b-06-notification-platform.md。3 段階 (B-6.1 Chatwork のみ → B-6.2 購読 DB → B-6.3 Email 統合)。Bloom 既存 Chatwork 基盤の Root 移管含む。 |
| Root | Phase B-7 実装: 移行ツール（Kintone / FileMaker 取り込みヘルパー） | 4.0 | | | a-root (A) | | | spec: docs/specs/2026-04-25-root-phase-b-07-migration-tools.md。5 段階 (B-7.1 基盤 → B-7.2 Kintone → B-7.3 FileMaker → B-7.4 関電業務委託 Leaf 連携 → B-7.5 営業リスト Soil 大量取込)。最重量 Phase。 |
| Tree | Phase D plan v3 起草（6 spec 統合・実装プラン） | 0.5 | 0.4 | -0.1 | a-tree (A) | 2026-04-25 | 2026-04-25 | docs/superpowers/plans/2026-04-25-tree-phase-d-implementation.md（1832 行・70 タスク）。6 並列 subagent で D-01〜D-06 spec digest 取得 → 統合プラン起草 → self-review。Tree 特例 §17 5段階展開・§16 7種テスト・known-pitfalls 5 件反映・判断保留 38 件集約。実装着手は a-main 判断後。 |
| Tree | Phase D-01 schema migrations | 0.7 | | | a-tree (A) | (pending) | | spec-tree-phase-d-01 準拠、12 タスク。Soil link 列 + 7 migration + 2 VIEW + audit。 |
| Tree | Phase D-06 test scaffolding | 0.25 | | | a-tree (A) | (pending) | | Vitest config 分離、85%/75% 閾値、real-DB セットアップ。D-02 着手前に必須。 |
| Tree | Phase D-02 operator UI | 1.125 | | | a-tree (A) | (pending) | | spec-tree-phase-d-02 準拠、13 タスク。FM 互換 + offline + rollback。 |
| Tree | Phase D-04 tossup flow | 0.875 | | | a-tree (A) | (pending) | | spec-tree-phase-d-04 準拠、7 タスク。Tree → Leaf 1 トランザクション + 整合性 Cron。 |
| Tree | Phase D-03 manager UI | 1.0 | | | a-tree (A) | (pending) | | spec-tree-phase-d-03 準拠、8 タスク。30s polling + Chatwork 介入。 |
| Tree | Phase D-05 KPI dashboard | 0.94 | | | a-tree (A) | (pending) | | spec-tree-phase-d-05 準拠、9 タスク。MV 3 本 + Recharts + CSV/Excel。 |
| Tree | Phase D-06 E2E + 受入 | 1.0 | | | a-tree (A) | (pending) | | spec-tree-phase-d-06 準拠、8 タスク。Playwright 10 flow + axe + Lighthouse。 |
| Tree | Phase D §16 7種テスト | 0.5 | | | a-tree (A) | (pending) | | 親CLAUDE.md §16 準拠、α 投入前に全完走必須。 |
| Tree | Phase D α (東海林1人) | — | | | a-tree (A) | (pending) | | 1 週間想定。100 件実コール + spot-check 5 件 + 7種テスト全 ✅。 |
| Tree | Phase D β1 (1人現場) | — | | | a-tree (A) | (pending) | | 1 週間想定、FM 並行。新旧 ±10% 以内、UX フィードバック ≤5 件。 |
| Tree | Phase D Full release + FM 切替 | — | | | a-tree (A) | (pending) | | β half (±3%) 0 critical 後。FM 30日並行参照。 |

## 運用メモ

- **Phase A1 の内訳** (参考):
  - Task 1: Python 環境セットアップ + `requirements.txt` → ✅ 完了 (2026-04-22, a-forest)
  - Task 2: スクリプト骨組み + `.env.local` 読み込み → ✅ 完了 (2026-04-22, b-main)
  - Task 3: PDF 抽出ロジック移植 → ✅ 完了 (2026-04-22, b-main)
  - Task 4: PDF 走査ループ (dry-run 確認済) → ✅ 完了 (2026-04-22, b-main)
  - Task 5: Supabase REST API UPDATE → ✅ 完了 (2026-04-22, b-main / 本番 UPDATE 4/4 成功)
  - Task 6: 運用手順書 README → ✅ 完了 (2026-04-22, b-main / `scripts/README-shinkouki.md`)
  - Task 7: エンドツーエンド動作確認 → 🟡 一部完了 (バックアップ取得 + dry-run + 本番 UPDATE 経路疎通は Claude 側で完了。Forest ダッシュボードの目視確認 + 日報記録は東海林依頼で残)

- **Phase A2 / A3**: 2026-04-22〜23 で統合実装完了（見積 2.5 d → 実績 0.6 d）。

- **Forest Phase A 仕上げ (v9 残機能移植)**: 2026-04-24 着手、合計 **9.3 d**（旧 9.8d から F5 アップロード UI 0.5d を Phase B Storage 統合へ移行で除外）。
  - 順1: T-F10 (P08 HANKANHI 販管費 + reflected note) — **0.95 d**（最優先、依存なし）
  - 順2: T-F2-01 / T-F3-01 (最終更新日・「壱を除く」注記) — 0.35 d（並列可）
  - 順3: T-F4 + T-F11 (P09 Tax Calendar + Tax Detail Modal) — 2.2 d
  - 順4: T-F7-01 (共通 InfoTooltip、F6 で使用のため先行) — 0.25 d
  - 順5: T-F5 閲覧 (TaxFilesList + Supabase Storage `forest-tax/`) — 1.85 d
  - 順6: T-F6 (Download Section + ZIP Edge→Node 確定) — 2.85 d
  - 順7-8: T-F9-01 / T-F8-01 (MicroGrid / MacroChart 差分調査) — 0.85 d（a-auto 並列可）
  - 判1-5 確定内容：販管費 = A（別テーブル）/ 納税 = B（3 テーブル分割）/ PDF = B（Storage ミラー）/ ZIP = B（Edge Function + Storage、ただしランタイムは Node）/ Tax Files = B（社内代理入力）
  - F5 アップロード UI と F6 ZIP 本体は Phase B の Storage 統合バッチでまとめ実装する方針（a-main 判断）

- **Bloom Phase A-1 (Workboard)**: 2026-04-25〜29 予定、合計 4.25 d。
  - Day 1 (1.25 d): T1 migration + T2 型定義 + T3 認証スケルトン
  - Day 2 (1.0 d): T4 Workboard 画面 + T5 Roadmap 画面
  - Day 3 (0.75 d): T6 月次ダイジェスト + T7 切替・アラート
  - Day 4 (1.25 d): T8 Chatwork 連携 + T9 Cron + T10 疎結合化
  - §10.3 判断結果反映（判1: pgcrypto / 判2: Node ランタイム / 判3: DigestPage 型運用 /
    判4: manager クライアント絞込 / 判5: Bloom ログインは /forest/login リダイレクト）

- **Root Phase A**: 2026-04-24 に Phase A-1 / A-2 を連続で完走（合計実績 1.5 d、当初見積 4.5 d → 圧縮 -3.0 d）。
  - Phase A-1: 既存 CRUD UI の仕上げ（バリデーション・UX・権限判定）
  - Phase A-2: KoT API 月次勤怠取込（IP 制限ハマり含めて 0.5 d で完走）
  - 教訓：既存実装の発掘を初手で徹底する / KoT API は IP 制限ありと明示されていなかった / `date` 形式は実機で判明（yyyy-MM 必須）

- **Soil 基盤設計 (Batch 16)**: 2026-04-25、a-auto 004 が起草。Garden-Soil 基盤設計 8 件の spec（実装見積合計 ~5.25d）。
  - #01 リスト本体スキーマ: ~0.5d 実装（253 万件級顧客マスタ、3 補助テーブル）
  - #02 コール履歴スキーマ: ~1.0d（335 万件、月次パーティション + duration/misdial トリガ）
  - #03 関電リスト Leaf 連携: ~0.5d（Kintone 74 フィールド振り分け、案件化フロー）
  - #04 インポート戦略: ~1.0d（Kintone/FileMaker/CSV、staging + マージ提案）
  - #05 インデックス・パフォーマンス: ~0.5d（253/335 万件で 1 秒以内目標、運用整備）
  - #06 RLS 設計: ~0.5d（7 ロール、Materialized View 最適化、SECURITY DEFINER）
  - #07 削除パターン: ~0.25d（横断 Cross History #04 準拠、コール履歴は永続保持）
  - #08 参照 API 契約: ~1.0d（共有 helper / Server Action / RPC、N+1 防止）
  - 実装見積合計: ~5.25d / 起草時間: 約 2.5h（a-auto 004）
  - ブランチ: feature/soil-base-specs-batch16-auto

- **本ファイルの起源**: 2026-04-22、ルール `feedback_effort_tracking.md` 遵守のため作成。以降の Phase では spec/plan 作成と同時に行追加すること。

---

## a-main 006 セッション（2026-04-26）

### 主要成果

| 観点 | 値 |
|---|---|
| 判断保留消化 | **235 件確定**（220 件目標超過、新規要件込み）|
| 確定ログ作成 | 3 件（Kintone batch / Tree Phase D / Root Phase B）|
| spec 改訂 follow-up dispatch | 6 セッション（a-bud x2 / a-auto x3 / a-root / a-tree） |
| 新規 memory 追加 | 9 件 |
| 新規 spec 起草成果 | 4 本 / 計 2,602 行（a-tree 770 + a-root 1,832）|
| ローカル滞留 commit | 約 32+ commits（GitHub 復旧後 push 待機）|
| GitHub 暫定アカウント | shoji@centerrise.co.jp / ShojiMikoto-B（2FA + PAT 設定済）|

### 確定 235 件 内訳

| カテゴリ | 件数 |
|---|---|
| Kintone fruit/sprout 解析 | 10 |
| Kintone employee/payroll 解析 | 12 |
| 連動・追加判断 | 10 |
| Soil Phase B 全 7 spec | 49 |
| Bud Phase D Batch 17 + Y 案 | 42 |
| Tree Phase D 全 6 spec + 新規要件 17 | 52 |
| Root Phase B 全 7 spec | 60 |
| **計** | **235 件** |

### 各セッション完走 commits

| セッション | 内容 | commits |
|---|---|---|
| a-bud（1+2 次）| Bud Phase D 修正 + 新規 D-09/10/11 | 5 |
| a-auto-002 | Sprout/Fruit/Calendar Batch 18 + Y 案 + Kintone 14 件 | 5 |
| a-auto | Soil B-XX 修正 + Batch 14/19 fix | 8 |
| a-root（権限+Help）| 新規 2 spec 起草（1,832 行）| 3 |
| a-tree | Tree Phase D 確定 + 新規 2 spec（770 行）| 1 |
| a-leaf | Kintone #22 反映 | 2 |
| a-forest | Forest #21 反映 | 1 |
| a-root-002 | Root Phase B 確定 60 件反映（進行中）| 7+ |
| **計** | | **約 32+ commits** |

### 重要設計判断（業務影響大）

1. 法人マスタ一元化（root_business_entities）+ 役割分離（partner / vendor relationships）→ Lahoud 様等の役割切替企業対応
2. ソフトフォン Garden 内構築（X-Lite 簡素化版 + マネーフォワード問合せボタン風 UI）
3. Toast 通知共通コンポーネント（業務中断回避）
4. 保管期間「永続スタート → 段階的短縮」標準パターン化
5. ハイブリッドメール（Microsoft + Resend）
6. 退職日翌日 03:00 切替（業務継続性）
7. 監査ログ diff 方式（変更フィールドのみ）
8. アカウント名 + UUID 併用（actor_account_name + actor_employee_id）

### 実績工数（推定）

- a-main 006 稼働：約 6-7h
- 累計判断消化：235 件 / 6-7h = **約 30-40 件/h**（推奨明示パターン化奏功）
- 各セッション spec 改訂：合計 4-5d 相当（並列実行で実時間短縮）

### 待機

- 槙さん invite 受諾
- GitHub Support 復旧（チケット #4325863）
- a-root-002 完走報告
- 13+ ブランチ push + PR 発行（GitHub 復旧後）

### 関連 docs

- handoff: `docs/handoff-a-main-006-to-007.md`
- 確定ログ 3 件: `C:\garden\_shared\decisions\decisions-{kintone-batch / tree-phase-d / root-phase-b}-20260426-a-main-006.md`
- spec follow-up: `C:\garden\_shared\decisions\spec-revision-followups-20260426.md`
- FileMaker サマリ: `C:\garden\_shared\decisions\filemaker-schema-summary-20260426.md`
- push plan: `C:\garden\_shared\decisions\push-plan-20260426-github-recovery.md`
