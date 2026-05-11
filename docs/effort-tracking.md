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
| Tree | Phase D-01 schema migration 実装（up + down 単一 SQL）| 0.7 | 0.5 | -0.2 | a-tree (A) | 2026-04-27 | 2026-04-27 | spec-tree-phase-d-01 §3-§5 + §0 確定事項を全反映。supabase/migrations/20260427000001_tree_phase_d_01.sql（677 行）+ down.sql（135 行）。3 テーブル（tree_calling_sessions / tree_call_records / tree_agent_assignments）+ Soil 連携 3 カラム + 集計/不変ガード/監査ログ Trigger 6 種 + RLS 4 階層 + VIEW 2 種を一括投入。確定 §0 反映: 録音=recording_url のみ（イノベラ継続）/ result_code=CHECK 制約 hard-code 12 種（既存 callButtons.ts 整合）/ assignments=開放型・競争式（営業 INSERT 可、partial unique で重複架電防止）。冪等性=CREATE OR REPLACE / IF NOT EXISTS / DROP IF EXISTS パターンで 54 箇所、再実行可能。前提依存（root_employees / soil_call_lists / audit_logs / cross-rls-audit ヘルパ関数）の存在は冒頭 DO ブロックで NOTICE 出力。Track A α 版開始 + Track B Phase 1 着手の前提条件クリア。ブランチ: feature/tree-phase-d-01-implementation-20260427、ローカル commit のみ（GitHub 復旧後 push）。 |

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

## 2026-05-04 〜 2026-05-07 ガンガン常態モード初日 累計実績（後追い反映、a-main-014 起草）

> 対象期間: 5/4 GW 中盤 〜 5/7 木曜（4 日間）
> 反映背景: a-main-013 が dispatch 25 件起草・配布したが effort-tracking 後追い反映が漏れていた
> 反映時刻: 2026-05-07 22:05 a-main-014

### Garden-Bud（a-bud）— 9 件 / 3.1d / 62% 圧縮 / 329 tests all green

| 日付 | タスク | 予定 | 実績 | 差分 | 理由 |
|---|---|---|---|---|---|
| 2026-05-07 | D-01 attendance + D-09 bank accounts | 1.5d | 0.8d | -0.7d | 既存 helpers 再利用 |
| 2026-05-07 | D-05 social insurance | 1.0d | 0.4d | -0.6d | 純関数 TDD パターン踏襲 |
| 2026-05-07 | UI v2 整理移送（Drive 015_Gardenシリーズ）| 0.6d | 0.2d | -0.4d | A 案配置先確定で迷いなし |
| 2026-05-07 | D-02 salary | 1.5d | 0.4d | -1.1d | D-05 import 再利用 + D-09 helpers |
| 2026-05-07 | bud.md design-status 起草 | 0.2d | 0.1d | -0.1d | テンプレ準拠 |
| 2026-05-07 | D-03 bonus（Cat 4 #28 admin only RLS）| 0.75d | 0.3d | -0.45d | D-05 + D-09 helpers 再利用 |
| 2026-05-07 | D-07 bank transfer（Cat 4 #27 経路 A/B）| 1.2d | 0.5d | -0.7d | 純関数 TDD + 既存パターン |
| 2026-05-07 | D-11 MFC CSV（Cat 4 #27 経路 C）| 1.5d | 0.4d | -1.1d | D-07 CSV パターン踏襲 + iconv-lite 既存 |

### Garden-Soil（a-soil）— Batch 16 + Phase B-01 第 1 弾 / 13 倍速

| 日付 | タスク | 予定 | 実績 | 差分 | 理由 |
|---|---|---|---|---|---|
| 2026-05-04〜07 | Batch 16 8/8 完成 | 5.25d | 0.4d | -4.85d | spec/plan 完成度高、純関数 TDD |
| 2026-05-07 | Phase B-01 第 1 弾（7 migrations / 3 TS / 46 tests）| 1.0d | 0.1d | -0.9d | Batch 16 helpers 再利用 |

### Garden-Bloom（a-bloom-004）— 8 件 / 6 倍速 / 5-6 日前倒し

| 日付 | タスク | 予定 | 実績 | 差分 | 理由 |
|---|---|---|---|---|---|
| 2026-05-04〜07 | Phase 1 + 3 + 2A + 2B 完走 | 4.0d | 0.7d | -3.3d | spec/plan 完成度高 |
| 2026-05-07 | GardenHomeGate 実装 | 0.5d | 0.1d | -0.4d | claude.ai 起草版ベース |
| 2026-05-07 | Phase A-2 spec/plan 起草 | 1.0d | 0.2d | -0.8d | テンプレ準拠 |
| 2026-05-07 | Daily Report MVP 完成 | 0.5d | 0.1d | -0.4d | Phase A-2.1 Task 1-10 連続 |
| 2026-05-07 | Phase A-2.1 Task 1-10 着手 | 1.0d | 0.2d | -0.8d | subagent-driven |

### Garden-Leaf（a-leaf-002）— # 1-# 4 + A+B+C / 5 PR + 副次 1 / 61% 短縮

| 日付 | タスク | 予定 | 実績 | 差分 | 理由 |
|---|---|---|---|---|---|
| 2026-05-04〜07 | Leaf # 1-# 4 全完走 | 2.0d | 0.5d | -1.5d | spec 詳細 + 既存パターン |
| 2026-05-07 | A + B + C（PR #130-#134 + 副次）| 1.0d | 0.3d | -0.7d | git 操作 RTK で加速 |

### Garden-Root（a-root-002）

| 日付 | タスク | 予定 | 実績 | 差分 | 理由 |
|---|---|---|---|---|---|
| 2026-05-07 | 認証統一 plan 1429 行起草 | 1.0d | 0.5d | -0.5d | subagent-driven 並列 |
| 2026-05-07 | 5/10 集約役計画（5/13-14 → 前倒し）| 0.3d | 0.1d | -0.2d | テンプレ準拠 |

### Garden-Forest（a-forest-002）

| 日付 | タスク | 予定 | 実績 | 差分 | 理由 |
|---|---|---|---|---|---|
| 2026-05-07 | B-min #4 弥生 CSV パーサー TDD（Thursday 夜継続中）| 0.3d | 進行中 | — | TDD ループ + RTK vitest |

### Garden-Tree（a-tree）

| 日付 | タスク | 予定 | 実績 | 差分 | 理由 |
|---|---|---|---|---|---|
| 2026-05-07 | 既知の課題調査 + tree-7/8/9 受領 | 0.3d | 0.2d | -0.1d | PR 消失問題 workaround |

### a-main-013 dispatch 起草（25 件、約 21 時間）

| 日付 | タスク | 予定 | 実績 | 差分 | 理由 |
|---|---|---|---|---|---|
| 2026-05-04〜07 | dispatch main- No. 76-100（25 件起草）| 12.5d | 約 21 時間（0.9d）| -11.6d | テンプレ + RTK + ガンガン並列 |

### 5/4-5/7 累計サマリ（4 日間）

| 指標 | 値 |
|---|---|
| 完走タスク | **約 25 件** |
| 投入工数（実績）| **約 4.5d** |
| 想定工数（予定）| **約 24d** |
| 圧縮率 | **約 81%（推定）** |
| commit 累計 | **40+ commits** |
| insertions | 推定 **10,000+** |
| Vitest tests | **375+ all green**（a-bud 329 + a-soil 46）|
| PR 発行 | **5 件**（a-leaf #130-#134 + a-soil #127）|
| dispatch 起草 | **25 件**（main- No. 76-100）|
| RTK 削減 | **64.9%（476.3K トークン）** |

### 主要因（後追い分析）

1. **RTK 64.9% 削減**: ガンガン常態モード成立の中核要因
2. **既存 helpers / パターン再利用**: a-bud D-09 helpers が D-05 / D-02 / D-03 / D-07 / D-11 で再利用
3. **TDD 厳守 + spec 詳細度**: 設計判断・仕様変更ゼロ、375 tests all green
4. **subagent-driven-development**: a-bloom-004 / a-root-002 で並列 task 分割
5. **claude.ai 起草版採用**: login.html / garden-home.html ベースで UI 開発加速

---

## 2026-05-07 〜 2026-05-08 Bud Phase D 12/12 100% 完走 詳細（a-bud / a-bud-002 起草）

| モジュール | タスク | 予定(d) | 実績(d) | 差分(±d) | 担当 | 開始 | 完了 | 備考 |
|---|---|---|---|---|---|---|---|---|
| Bloom | 東海林何してる問題 MVP — spec 起草（spec-shoji-status-visibility v1） | 0.1 | 0.1 | 0 | a-bloom-002 (A) | 2026-04-26 | 2026-04-26 | a-main-007 確定指示（GW 完成絶対）。案 1 採択（手動オンリー）、Q1 修正反映。実装ステップ 7 件 / 4.0h(0.5d) 見込み |
| Bloom | 東海林何してる問題 MVP — 実装（DB + API + Widget + Editor + 詳細画面） | 0.5 | 0.55 | +0.05 | a-bloom-002 (A) | 2026-04-26 | 2026-04-26 | bloom_ceo_status 1 テーブル / GET 全員 + PUT super_admin / 30s polling / Workboard 配置。Bloom 側 7 task (T7/T6/T3/T5/T8/T9/T10/T11) 完了、各 task で spec ✅ + code quality ✅、4 件の review-fix commit 適用。a-auto 担当 (migration SQL + API tests) は別ブランチで並走中 |
| Common | Garden 共通 UI skeleton — 実装（Header + /login + / + ShojiStatusProvider + BloomShell 注入） | 0.5 | 0.4 | -0.1 | a-bloom-002 (A) | 2026-04-26 | 2026-04-26 | T12-T15 の 4 task 完了。Header skeleton + /login + / 9 アイコンホーム + ShojiStatusProvider in root layout + BloomShell へ widget 注入。各 task で spec ✅ + code quality ✅、UX polish (hover/box-sizing/error-style/auto-dismiss) と time-theme 統合は memory `feedback_ui_first_then_postcheck_with_godo` 準拠で α 後に持ち越し |
| Bud | Phase D-01: 勤怠取込スキーマ実装（migration + types + integrity check + Vitest 33） | 0.75 | 0.4 | -0.35 | a-bud (A) | 2026-05-07 | 2026-05-07 | main- No.86 全前倒し dispatch 受領後の Day 1 1/2。commit 47ef1b7。bud_payroll_periods + _snapshots + _overrides 3 テーブル、RLS 自分閲覧 / manager 自部門 / admin+ 全件 / DELETE 完全禁止 / overrides reason CHECK 5 文字以上 + UPDATE/DELETE 禁止。整合性検査 5 種（所定 vs 実労働 / 残業 80h-100h / 法定休日労働物理的上限 / 暦日数合計 / 実労働下回り）、4 重要度 (info/warning/critical/error)。Vitest 33 tests green。push 済み (feature/bud-phase-d-implementation)。spec 100% 準拠、新規 npm install なし、本番影響なし |
| Bud | Phase D-09: 口座一覧 + has_payroll_role ヘルパー実装（migration + types + validators + Vitest 76） | 0.75 | 0.4 | -0.35 | a-bud (A) | 2026-05-07 | 2026-05-07 | main- No.86 Day 1 2/2。commit 313b18c。btree_gist 拡張、root_employee_payroll_roles (5 ロール、payroll_visual_checker 含む 4 次 follow-up Cat 4 #26 反映)、bud_has_payroll_role + bud_is_admin_or_super_admin + bud_is_super_admin 関数 (SECURITY DEFINER)、bud_employee_bank_accounts (EXCLUDE 制約で 1 従業員 1 アクティブ)、bud_payment_recipients (employee_id NULL 可、月変動)、view_bud_active_employee_accounts (D-07 参照)。バリデーター: bank_code (4 桁) / branch_code (3 桁) / account_number (1-8 桁) / 半角カナ / applies_month / recipient_type 整合性 / 効果期間順序。Vitest 76 tests green、累計 D-01 + D-09 = 109 tests。push 済み。spec 100% 準拠 |
| Bud | Phase D-05: 社会保険計算（健保・厚年・介護・雇用）実装（migration + types + calculator + Vitest 55） | 1.0 | 0.4 | -0.6 | a-bud (A) | 2026-05-07 | 2026-05-07 | main- No.91 GO 受領後 Day 2 を Thursday 夜に前倒し着手。commit d430f90。bud_standard_remuneration_grades（健保 50/厚年 32 等級、年度別）、bud_insurance_rates（都道府県別 + 業種別、CHECK で employment_employee_rate <= total）、bud_employee_remuneration_history（reason 5 種）、bud_employee_insurance_exemptions（産休・育休）。計算純関数: isLongTermCareTarget (40-64 歳)、floorToThousand、lookupGrade (NULL 上限対応)、calculateMonthlyInsurance (4 種同時 + floor 端数 + 免除 + 介護対象外)、calculateHealthStandardBonus (573 万円年度累計)、calculatePensionStandardBonus (150 万円 1 回)、calculateBonusInsurance (capped フラグ)、judgeGetsuhen (月変判定: 固定変動 + 3 ヶ月平均 + 17 日基礎 + 等級 2 以上差)。Vitest 55 tests green、累計 D-01 + D-09 + D-05 = 164 tests。push 済み。spec 100% 準拠 |
| Bud | Bud UI v2 整理移送（10 画面、main- No.92 GO + Day 2 完走後さらに前倒し） | 0.6 | 0.2 | -0.4 | a-bud (A) | 2026-05-07 | 2026-05-07 | main- No.92 受領後 D-05 完走済のため Thursday 夜に Bud UI v2 整理移送を前倒し実施。① 015_Gardenシリーズ/000_GardenUI_bud/ に 10 per-screen subfolder（01_PL〜10_Settings）作成 + 各 index.html として copy（元ファイル名 chat-ui-bud-*-v2-20260507.html を index.html リネーム、内容不変）。② v1 / v2 並存動作確認: 350/350 ref（10 画面 × 35 ref）全て resolve OK、broken 0 件、元 _chat_workspace/garden-bud/ui_drafts/ の v1 17 件 + v2 10 件保持確認、Bloom 06_CEOStatus assets 参照経路（../../../015_Gardenシリーズ/）が新配置から正しく解決。③ _chat_workspace/_archive_202605/garden-bud-ui-drafts/ に v2 10 件アーカイブ複製、Triple-layer 保持（Active 10 + Source 10 + Archive 10 = 30 ファイル整合、削除 0）。README.md 配置、命名は 000_GardenUI_bloom precedent 準拠。spec 100% 準拠、削除なし、コピーのみで運用。 |
| Bud | Phase D-02: 給与計算ロジック実装（migration + types + calculator + Vitest 52） | 1.5 | 0.4 | -1.1 | a-bud (A) | 2026-05-07 | 2026-05-07 | main- No.94 GO 受領後 Day 3 を Thursday 夜に前倒し着手。commit 986d07c。bud_salary_records（net_pay = gross - total_deductions 整合性 CHECK）、bud_employee_allowances（custom_label 制約）、bud_employee_deductions、bud_withholding_tax_table_kou（甲欄、扶養 0-7 人）、bud_withholding_tax_table_otsu（乙欄 flat + rate）、bud_resident_tax_assignments（6 月別額対応）。計算純関数: calculateMonthlyBasicPay (月給按分)、calculateHourlyBasicPay、calculateBaseHourlyRate、calculateOvertime (25% 通常 / 60h 超 50% / 深夜 25% / 法定休日 35% / 法定外休日 25%)、calculateAbsentLateDeduction (欠勤 = 月給/暦日, 遅刻早退 = per-minute)、calculateMonthlySalary (monthly/hourly/commission 統合)、lookupWithholdingTax (甲: 0-7 人 + 7 人超 1610 減算 / 乙: flat + rate)、calculateTaxableAmount、decideResidentTax (fiscal_year 整合性)、filterEffectiveAtDate、calculateNetPay。Vitest 52 tests green、累計 D-01 + D-09 + D-05 + D-02 = 216 tests。push 済み。spec 100% 準拠 |
| Bud | bud.md design-status 起草（main- No.96 受領後即時着手、Day 1-3 報告ベース） | 0.2 | 0.1 | -0.1 | a-bud (A) | 2026-05-07 | 2026-05-07 | main- No.96 dispatch 受領後 Thursday 夜に bud.md 起草。Bloom precedent / tree.md 構造準拠で 7 セクション + 改訂履歴。配置先: _chat_workspace/garden-design-status/bud.md (11.6 KB, 113 行)。内容: Phase A-1 振込 100% + Phase D 4/12 完成 + UI v2 整理 + 全 12 spec 完成 + 4 次 follow-up Cat 4 #26/#27/#28 反映 + 5 ロール体制 + Day 1-3 累計表 + 残課題 8 件 + 改訂履歴。a-root-002 5/10 集約役向け、Day 4-6 / 認証統一 5/13 計画明示。 |
| Bud | Phase D-03: 賞与計算（Cat 4 #28 admin only RLS）実装（migration + types + calculator + Vitest 28） | 0.75 | 0.3 | -0.45 | a-bud (A) | 2026-05-07 | 2026-05-07 | main- No.97 GO 受領後 Day 4 を Thursday 夜に前倒し着手。commit 0f68455。bud_bonus_records（health_capped/pension_capped 上限到達フラグ + net_bonus 整合性 CHECK）、bud_bonus_withholding_rate_table（甲乙別 + 扶養 0-7 人）。**Cat 4 #28 反映: INSERT/UPDATE は admin/super_admin のみ**（給与 D-02 は payroll_calculator 可だが賞与は admin 限定）。計算純関数: calculateBonusGross / lookupBonusWithholdingRate (甲乙別 + 7 人超 dependents_7 流用) / calculateBonusWithholdingTax (floor + 負数防止) / calculateBonusNet / calculateBonusFull (統合、D-05 calculateBonusInsurance 再利用)。Vitest 28 tests green。累計 D-01 + D-09 + D-05 + D-02 + D-03 = 244 tests green。push 済み。spec 100% 準拠 |
| Bud | Phase D-07: 銀行振込連携（Cat 4 #27 同時出力 + 全銀協 FB + 8 区分階層 CSV）実装（migration + types + transfer-fb + transfer-accounting-csv + Vitest 61） | 1.2 | 0.5 | -0.7 | a-bud (A) | 2026-05-07 | 2026-05-07 | main- No.99 GO 受領後 Day 5 を Thursday 夜に前倒し着手。commit 18ac8fd。bud_payroll_transfer_batches (6 段階 status、1 法人×1 期間×1 種別 UNIQUE)、bud_payroll_transfer_items (salary/bonus XOR、振込先スナップショット + 4/3/8 桁 CHECK)、bud_payroll_accounting_reports (8 大区分階層 jsonb + SHA256 checksum)。RLS: payroll_disburser/auditor/admin。純関数 transfer-fb: toHankakuKana (清音/濁音/半濁音/拗音/記号 120+ パターン)、isAllHankaku、padRight/padLeft (120 桁固定長)、buildHeaderRecord (規格 1)、buildDataRecord (規格 2、振込指定区分 7=給与振込)、buildTrailerRecord/buildEndRecord、buildFbData (全体 + CR LF)。純関数 transfer-accounting-csv: escapeCsvCell、buildAccountingCsvLines (8 大区分順序 + 小計 + 総合計「役員給与系除く」)、buildAccountingCsv (UTF-8 BOM + CRLF + ヘッダ)、createEmptyHierarchy + addItemsToCategory (累積)。Vitest 61 tests green (FB 30 + CSV 31)。累計 D-01 + D-09 + D-05 + D-02 + D-03 + D-07 = 305 tests green。push 済み。spec 100% 準拠 + Cat 4 #27 反映 |
| Bud | Phase D-11: MFC 互換 CSV 出力（72 列 / cp932 / 9 カテゴリ、4 次 follow-up 7 段階）実装 | 1.5 | 0.4 | -1.1 | a-bud (A) | 2026-05-07 | 2026-05-07 | main- No.101 推奨 GO 受領後 Day 6 を Thursday 夜に前倒し着手。commit 0c78782。bud_mfc_csv_exports（4 次 follow-up 7 段階 status: visual_double_checked 含む）、bud_mfc_csv_export_items（jsonb csv_row_data UPDATE/DELETE 禁止）。**5 ロール対応 RLS**: V6 自己承認禁止 + mfc_visual_check (上田 SELECT + 当該遷移のみ、編集権なし、依頼送信済必須) + mfc_request_visual_check (東海林依頼ボタン) + 巻き戻し対象に visual_double_checked 追加。72 列マッパー: 形態別 (monthly/hourly/daily) + インセン 3 種 (AP/社長賞/件数) + 通勤手当 課税/非課税分離 + 9 カテゴリ列構成 (5+4+5+11+16+11+7+12+1=72)。cp932 エンコーダー: iconv-lite + CRLF + decode 復元検証。Vitest 24 tests green。累計 D-01+D-09+D-05+D-02+D-03+D-07+D-11 = 329 tests green。push 済み。spec 100% 準拠 + Cat 4 #27 反映 |
| Bud | Phase D-04: 給与明細配信（Y 案 + フォールバック + 上田 UI 要件正本、Cat 4 #26）実装 | 1.8 | 0.6 | -1.2 | a-bud (A) | 2026-05-08 | 2026-05-08 | main- No.102 GO 受領後 Friday 朝 D-04 重実装着手。commit c629168。bud_payroll_notifications（Y 案 + フォールバック対応、3 種 delivery_method、5 段階 overall_status、retry 0-4、DL リンク 24h ワンタイム、LINE Bot 経路、フォールバック PW、現金手渡し受領、salary/bonus XOR、フォールバック PW 必須 CHECK）、bud_salary_statements（SHA256 改ざん検知、5 年保管）。RLS: 自分閲覧 + payroll_* + admin、自分の cash_receipt / DL カウンター UPDATE 可、DELETE 完全禁止（労基法 109 条）。**UEDA_VISUAL_CHECK_UI_REQUIREMENTS const（spec § 2.7 正本）**: autoTimeout=null / editableFields=[] / canExecuteTransfer=false / rowLayout 6 項目 / allowedActions 4 種。純関数: decideDeliveryMethod / generateOneTimeToken (crypto.randomBytes 32 byte → base64url 43 文字) / calculateTokenExpiry / generateStrongPassword (PASSWORD_CHARSET 90 種から 16 文字、90^16 ≈ 5×10^31) / decideRetryDelay (1h/6h/24h/null) / decideFallbackUpgrade (LINE 失敗時自動格上げ) / isTokenUsable (4 状態) / validateUedaUiAction (spec § 2.7 操作権限自動検証) / shouldMaskFallbackPassword (24h)。Vitest 64 tests green。累計 D-01+D-09+D-05+D-02+D-03+D-07+D-11+D-04 = 393 tests green。push 済み。spec 100% 準拠 + Cat 4 #26 反映 |
| Bud | Phase D-10: 給与計算統合（4 次 follow-up 7 段階 + 5 ロール + インセン 5 種、Phase D 統合中核）実装 | 2.9 | 0.7 | -2.2 | a-bud (A) | 2026-05-08 | 2026-05-08 | main- No.119 強推奨 GO 受領後 Friday 朝 D-10 着手。commit b12b208。bud_payroll_records（4 次 follow-up 7 段階 status: visual_double_checked 含む、Cat 4 #26、5 種インセン列、部署集計列、計算スナップショット jsonb、1 employee × 1 month UNIQUE）、bud_payroll_calculation_history（13 種 action 監査履歴、UPDATE/DELETE 完全禁止）、bud_incentive_rate_tables（5 種インセン係数 jsonb、admin only）。**5 ロール × 7 段階 RLS**: V6 自己承認禁止 + pr_visual_check (上田 SELECT + 遷移のみ、編集権なし、依頼送信済必須) + pr_request_visual_check (東海林依頼ボタン) + 巻き戻し policy (任意 stage → draft、payroll_auditor のみ)。インセン 5 種計算純関数: calculateApIncentive / calculateCaseIncentive (累進、spec §5.2 例「12 件 → 16500」と完全一致) / calculatePresidentIncentive (top_n ランキング) / calculateTeamVictoryBonus (達成率 threshold 均等配分) / calculatePAchievementBonus (rate_from-to 段階) / calculateAllIncentives 統合 / summarizeTeam (部署別集計) / selectIncentiveRateTable (effective 範囲 + 法人優先)。Vitest 36 tests green。累計 D-01+D-09+D-05+D-02+D-03+D-07+D-11+D-04+D-10 = 429 tests green。push 済み。spec 100% 準拠 + 4 次 follow-up Cat 4 #26 反映、Phase D 9/12 件 (75%) 達成 |
| Bud | Phase D-12: 給与処理スケジュール + リマインダ（7 stage、4 次 follow-up Cat 4 #26 反映）実装 | 1.05 | 0.4 | -0.65 | a-bud (A) | 2026-05-08 | 2026-05-08 | main- No.124 強推奨 GO 受領後 Friday 朝 D-12 着手。commit b956dac。bud_payroll_schedule（7 stage CHECK: visual_double_check 含む、1 period × 1 stage UNIQUE、sharoshi_check 時のみ partner_id 必須）、bud_payroll_schedule_settings（7 stage 各 offset_days デフォルト 2/1/1/1/1/3/1 = 累計 10 営業日、担当者デフォルト 6 種、リマインダ閾値 24h/72h/3d/5d、effective_from で履歴管理）、bud_payroll_reminder_log（severity + escalation_level + channel 4 種 + jsonb external_message_ids、UPDATE/DELETE 完全禁止）。RLS: payroll_* SELECT、payroll_auditor + admin 書込、reminder_log INSERT は service_role のみ。純関数: getStageOffsetDays / addBusinessDays (週末スキップ、既存 nextBusinessDay 流用) / formatYmd / **generateScheduleForPeriod (period_end → 7 stage 一括生成)** / decideSeverity (info/warning/critical) / calculateHoursOverdue / decideEscalationLevel (0/1/2) / resolveRecipients (Set 重複排除、partner 別保持) / **REMINDER_TEMPLATES (7 stage × 3 severity = 21 通り、visual_double_check は「時間かかってもよい」トーン)** / renderReminderMessage (placeholder 置換) / decideScheduleStatus (auto)。Vitest 60 tests green。累計 D-01+D-09+D-05+D-02+D-03+D-07+D-11+D-04+D-10+D-12 = 489 tests green。push 済み。spec 100% 準拠 + 4 次 follow-up Cat 4 #26 反映、**Phase D 10/12 件 (83%) 達成** |
| Bud | Phase D-06: 年末調整連携（1 月精算 + マイナンバー pgcrypto 暗号化、Phase C 連動）実装 | 0.75 | 0.3 | -0.45 | a-bud-002 (A) | 2026-05-08 | 2026-05-08 | bud-002 引き継ぎ後 Phase D 100% 完走に向けて D-06 着手。bud_year_end_settlements（fiscal_year × employee_id UNIQUE、settlement_type 3 種、5 段階 status、自起票承認禁止 CHECK）、root_employees_pii（pgp_sym_encrypt AES-256、super_admin only、retention_until で退職後 7 年）、bud_pii_access_log（INSERT only 監査、purpose 6 種限定）。SQL helper: bud_encrypt_my_number / bud_decrypt_my_number（SECURITY DEFINER、利用目的バリデーション、access_count 自動更新）。純関数: calculateAnnualWithheld（11 月まで + 12 月予定 + 賞与振り分け）/ classifySettlementType / calculateSettlement（年税額 - 累計、Math.trunc + -0 正規化）/ applySettlementToSalary（spec §5.2 数式、月次源泉据え置き + settlementAdjustment 加減算）/ validateSettlementWarnings（5 種警告: REFUND_EXCESS_GROSS_20PCT/30PCT、ADDITIONAL_EXCESS_NET_PAY、ADDITIONAL_LARGE_30PCT、INSTALLMENT_RECOMMENDED）/ planInstallments（最長 12 ヶ月、startMonth 月跨ぎ + 端数調整）/ shouldExcludeFromSettlement（当年退職判定、§2.1 1 月精算統一）/ validateMyNumberFormat（12 桁 + チェックデジット）。Vitest 47 tests green。spec 100% 準拠、新規 npm install なし、Phase C 依存（bud_gensen_choshu_bo / bud_nenmatsu_chousei）は migration コメントで遅延明記。 |
| Bud | Phase D-08: テスト戦略 + fixture 骨格（spec §2.2 50+ 要件、横断利用基盤）実装 | 0.5 | 0.15 | -0.35 | a-bud-002 (A) | 2026-05-08 | 2026-05-08 | bud-002 D-06 完走後の Phase D 12/12 仕上げ。spec 取得（batch17 ブランチから 2 件 cherry-pick）。fixture skeleton 4 ファイル: employees.ts（buildEmployee factory + namedEmployeeFixtures 17 件 + generateAllEmployeeMatrix 200 通り、計 217 fixture で spec §2.2 「50+」要件達成）、salary-systems.ts（standard/hourly/commission 3 種）、attendance.ts（buildAttendance + 8 代表パターン: full/40h/60h/80h/100h ERROR/85h WARNING/late/absent）、withholding-tables.ts（甲 4 階層 200k/300k/500k 含む扶養 0-7 + 乙 3 階層）。index.ts で re-export。fixtures.smoke.test.ts で 8 アサーション（50+ / 200 通り / id 一意 / 代表パターン網羅）。Vitest 8 tests green。累計 D-01+D-02+D-03+D-04+D-05+D-06+D-07+D-09+D-10+D-11+D-12 + 既存 D-04+ D-12 + D-08 fixtures = 544 tests green、**Phase D 12/12 件 (100%) 達成**。spec 100% 準拠、新規 npm install なし。 |
