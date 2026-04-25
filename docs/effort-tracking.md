# Garden シリーズ 工数トラッキング

> Phase / タスクごとの **見積 (estimated_days)** と **実績 (actual_days)** を蓄積する共有ログ。
> 東海林アカウント A / B 両セッションで同じファイルに追記する。
>
> - 1 日 = 8 時間。動作確認・レビュー対応含む実稼働ベース
> - Phase 着手時に見積行を追加、完了時に実績・差分・所感を記入
> - 見積を後から書き換えない（乖離理由は `notes` に記録）
> - 0.25d 刻みで記録。東海林さん手動作業（SQL 適用・ブラウザ確認・PR レビュー等）も実績に含める
> - 根拠メモリ: `feedback_effort_tracking.md`

## 記録フォーマット

| module | phase / task | estimated_days | actual_days | diff | session | started | finished | notes |
|---|---|---:|---:|---:|---|---|---|---|

## 履歴

| module | phase / task | estimated_days | actual_days | diff | session | started | finished | notes |
|---|---|---:|---:|---:|---|---|---|---|
| Forest | Phase A1: 進行期自動更新 Python スクリプト（PDF → Supabase） | 1.0 | 0.4 | -0.6 | a-forest (A) / b-main (B) | 2026-04-21 | 2026-04-22 | コード・ドキュメント完成、本番 UPDATE 疎通確認済み。4社分PDF で 4/4 件 UPDATE 成功。Task 7 のブラウザ目視確認と日報記録は東海林依頼で残。見積 1.0 d に対し AI 支援で 0.4 d で完了 |
| Forest | Phase A2/A3: 進行期編集モーダル（PDF自動入力+手動編集+期切り替え） | 2.5 | 0.6 | -1.9 | b-main (B) | 2026-04-22 | 2026-04-23 | ShinkoukiEditModal + PdfUploader + /api/forest/parse-pdf + mutations + RLS パッチ。PDF 解析は pdfjs-dist サーバーサイド、Python 版と同値を確認。subagent-driven-development で Task 1-8 を haiku で実装、Dashboard 統合は inline。admin 動作確認 OK |
| Forest | fix: ShinkoukiEditModal タブ切替時の高さジャンプ修正 | 0.05 | 0.03 | -0.02 | a-forest (A) | 2026-04-23 | 2026-04-23 | タブコンテンツを minHeight:560 のラッパーで固定。次ビルド/型チェック OK、PR #11 マージ済 (commit 46386c1) |
| Forest | Phase A 仕上げ: v9 残機能移植 (T-F10/T-F2/T-F3/T-F4/T-F11/T-F7/T-F5 閲覧/T-F6/T-F9/T-F8) | 9.3 | | | a-forest (A) + a-auto | 2026-04-24 | | comparison §6 推奨順で消化。旧 9.8d から F5 アップロード UI (0.5d) を Phase B Storage 統合へ移行で除外し 9.3d に再計算。内訳: T-F10=0.95 / T-F2+F3=0.35 / T-F4+F11=2.2 / T-F7=0.25 / T-F5 閲覧=1.85 / T-F6 (Node ZIP)=2.85 / T-F9+F8=0.85 (a-auto 可)。判1-5 = A/B/B/B/B（暫定確定、次回対話で東海林さん正式同意取得予定）。F6 ZIP は Node ランタイム確定 (Edge 4.5MB 上限のため) |
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

- **本ファイルの起源**: 2026-04-22、ルール `feedback_effort_tracking.md` 遵守のため作成。以降の Phase では spec/plan 作成と同時に行追加すること。
