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
| Bloom | fix: 独立 login 画面 (/bloom/login) + returnTo バグ修正 | 0.5 | 0.4 | -0.1 | a-bloom (A) | 2026-04-26 | 2026-04-26 | 動作確認で「/bloom 開きたいのに /forest/dashboard に飛ぶ」問題判明。新規: BloomLoginForm.tsx (Forest 模倣 + Bloom テーマ) + /bloom/login/page.tsx (sanitizeReturnTo /bloom prefix のみ許可)。修正: BloomGate redirect 先 /bloom/login + login page bypass、BloomShell login page bypass、/forest/login に useSearchParams で returnTo 対応 + sanitize。Vitest 17 件追加（実行は npm install 後）。tsc 0 エラー。`docs/spec-issue-202604260100-cross-login-consistency.md` で /tree/login / /bud-leaf login 不足を spec issue 化（後日対応）|
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
