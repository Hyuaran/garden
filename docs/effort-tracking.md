# Garden シリーズ 工数実績ログ

各 Phase / タスクの**見積 vs 実績**を全モジュール横断で記録する。見積精度向上・ベロシティ把握・計画立案精度改善が目的。

## 記録対象

- 各 spec / plan の Phase・タスクで `estimated_days` を定義したもの **すべて**
- Garden 9 モジュール全般（Soil / Root / Tree / Leaf / Bud / Bloom / Seed / Forest / Rill）
- 東海林アカウント A / B どちらのセッションでも蓄積する

## 記録タイミング

- **Phase 着手時**: 見積を確定したタイミングで行を追加（実績欄は空で pending）
- **Phase 完了時**: 実績・差分・所感を追記
- **途中経過**: 大幅に見積超過しそうなら `notes` にアラート追記

## 単位

- **1 日 = 8 時間相当**（動作確認・レビュー対応含む実稼働ベース）
- 0.25d 刻みで記録
- 東海林さん手動作業（SQL 適用・ブラウザ動作確認・PR レビュー等）は**実績に含める**

## ログ表

| 着手日 | 完了日 | モジュール | Phase/タスク | 見積(d) | 実績(d) | 差分 | セッション | 記録者 | Notes |
|---|---|---|---|---:|---:|---:|---|---|---|
| 2026-04-22 | 2026-04-22 | Bud | Phase 1a 全銀協CSVライブラリ | 0.5 | 0.35 | -0.15 | b-main (B) | Claude | 実装+テスト 95件すべて緑。subagent-driven で効率実装、最終レビューで致命的3件検出・即修正（sourceAccount検証/padding throw/合計overflow）。銀行取込確認（Task 13 手順書）は東海林さん側未実施。 |
| 2026-04-23 | 2026-04-23 | Bud | Phase 1b.1 振込管理 Foundation | 0.8 | 0.3 | -0.5 | b-main (B) | Claude | スキーマv2 + RLS 8ポリシー + 型 + ID生成 + 重複検出 + queries + mutations。125 tests全緑（+30新規）。Supabase SQL適用は東海林さん手動待ち。UIはPhase 1b.2。subagent-driven で 5回ディスパッチで完了、非常に効率的だった。 |
| 2026-04-23 | (pending) | Bud | Phase 1b.2 振込管理 UI | 1.4 | 0.3 (進捗) | — | a-bud (A) / b-main (B) | Claude | StatusBadge/FilterBar/MonthlySummary/一覧/フォーム2種/Server Actions/詳細/CSV出力/Shell改修/動作確認手順書 の13タスク。**進捗 2026-04-23 22:15 a-bud**: Task 1-3（B側commit済）+ Task 4 振込一覧画面 + Task 5 フォームバリデーション TDD 完了（9 tests 緑）。残 Task 6-13（フォーム2画面/Server Actions/詳細/CSV出力/Shell改修/手順書/実績記録）。 |
| 2026-04-24 | ~~2026-04-25 supersede~~ | Bud | ~~Phase 1b.2 Task 6-13 完走~~ | 1.1 | — | — | a-bud (A) | Claude | **⚠️ SUPERSEDED 2026-04-25**: 新 spec Batch 5（A-03 / A-04 / A-05 / A-06 / A-08）が上位互換として a-auto 起草、本行は参考。Task 6 相当→A-04、Task 9-10 相当→A-05 で再構成。旧プラン `docs/superpowers/plans/2026-04-23-bud-phase-1b2-ui.md` は参考として残置（実装は新 spec 基準）。 |
| 2026-04-24 | ~~2026-04-25 supersede~~ | Bud | ~~B案: 振込ステータス6段階仕様書起草~~ | 0.5 | — | — | a-bud (A) | Claude | **⚠️ SUPERSEDED 2026-04-25**: a-auto が Batch 5 で `docs/specs/2026-04-24-bud-a-03-furikomi-6steps.md`（401行）を先行起草。B案の仕様書不在は解消済み。本行の 0.5d は A-03 差分実装工程に合流。 |
| **2026-04-25** | — | Bud | 🎯 判断確定節目: Phase A-1 🔴 即時合意 7 件 | — | — | — | a-bud (A) / a-main | Claude | **マイルストーン**: 東海林さん即決（A-03 判1/3、A-04 判1/2、A-05 判1、A-06 判1、A-08 判1）完了。7 件中 6 件は a-auto 推奨通り、A-08 判1 のみ修正（楽天ビジネス 1 種 → オリコ/三井住友/楽天デビット 3 種）。以降の実装は `docs/bud-phase-a1-pending-judgments.md` §「東海林判断: 採択結果」を基準とする。 |
| 2026-04-25 | 2026-04-25 | Bud | Phase A-1 A-03 振込 6 段階遷移（差分実装） | 0.3-0.5 + W5 0.1 | 0.4 | -0.0〜-0.2 | a-bud (A) | Claude | **完了**: W1-W4（commit 09c30bc）+ W5 Chatwork 通知（commit TBD）。SQL migration / RPC / canTransitionWithRole / TS wrapper / Vitest 37 件 + chatwork-formatter 9 件（全 242 件緑）。**A-03 判3** super_admin 自起票 reason='自起票' 自動挿入。**Chatwork**: 4 種フォーマッタ（承認/差戻し/一括承認/一括差戻し）+ Server Action（CHATWORK_API_TOKEN / CHATWORK_BUD_ROOM_ID 環境変数）+ best-effort（失敗時は console.warn のみ）。署名 URL は流通させず Garden ログイン誘導文のみ（案 D）。残: root_audit_log 二重記録（A-03 判1、Phase B）/ 東海林さん SQL 適用 + 環境変数設定 → UI 側動作確認。 |
| 2026-04-25 | 2026-04-25 | Bud | Phase A-1 A-04 振込 新規作成フォーム | 0.5 | 0.4 | -0.1 | a-bud (A) | Claude | **完了**: new-regular / new-cashback 両ページ + TransferFormRegular / TransferFormCashback / BankPicker / VendorPicker / NewVendorModal / DataSourceSelector / AttachmentUploader / DuplicateWarning / KanaPreview の 9 コンポーネント + business-day (16 tests) + transfer-create-schema (25 tests)。**A-03 バグ修正同時**: SQL migration の FK 型を `id uuid` → `transfer_id text` に訂正（bud_transfers の実 PK が text）。Vitest 41 件追加（全 222 件緑）。東海林さん手動作業: bud-a03-status-history-migration.sql 適用 + root_vendors 追加権限 RLS 確認。 |
| 2026-04-25 | 2026-04-25 | Bud | Phase A-1 A-05 振込 承認フロー UI | 0.5 | 0.45 | -0.05 | a-bud (A) | Claude | **完了**: 振込詳細画面 `/bud/transfers/[transfer_id]`（3 タブ: 基本/履歴/関連）+ StatusActionButtons（ロール×ステータスのボタン可視性）+ RejectModal（差戻し理由 10-500 字）+ StatusHistoryTab + 一覧画面への一括操作（checkbox + 一括承認/差戻し 100 件上限）+ CSV 出力画面骨格 `/bud/transfers/csv-export`（銀行別サマリ）。batch-transitions 純関数 11 tests 追加（全 233 件緑）。A-05 判1 自己承認は警告のみ、判7 100 件上限実装。Chatwork 通知はモーダル UI に checkbox のみ設置（実送信は A-03 W5 で実装）。|
| 2026-04-25 | 2026-04-25 | Bud | Phase A-1 A-06 明細管理 + 自動照合 | 0.75 | 0.7 | -0.05 | a-bud (A) | Claude | **完了**: W1-W6 + W7-W8 全完走。W1-W6（commit a945c28）= SQL/パーサ/照合/取込/手動割当。W7-W8（次 commit）= 月次集計画面 `/bud/statements/summary`（aggregator 純関数 10 tests、月選択 + 入金/出金/差引/件数サマリ + 費目別/口座別/日別 breakdown）+ 取込バッチ履歴画面 `/bud/statements/imports`（最新 50 件、口座フィルタ、status バッジ）+ /bud/statements にナビリンク追加。282 tests 緑（+10）。 |
| 2026-04-26 | (pending) | Bud | Phase A-1 A-08 CC 明細 3 種対応 | 0.5+α | — | — | a-bud (A) | Claude | **予定**: オリコ・三井住友・楽天デビット 3 種（A-08 判1 修正採択）。spec は楽天ビジネス 1 種前提で書かれているため、着手前に a-main 経由で spec 微修正相談。ファイル形式・取込動線・ヘッダー分岐の差分洗い出し必要。 |
| (Phase B) | (pending) | Bud | Phase A-1 A-07 手渡し現金 5 論点 | 0.25 | — | — | a-bud (A) | Claude | **Phase B 繰越**: 着手時に東海林さんに 5 論点ヒアリング（受給者識別 / bud_transfers 扱い / 明細配信 / 現金原資 / 受領確認）。 |
| 2026-04-22 | (pending) | Bud | Phase 1c Leaf連携 | 1.0 | — | — | b-main (B) | Claude | 共通部品 + 関電への組み込み。将来のLeafアプリでも流用 |
| 2026-04-22 | (pending) | Bud | Phase 2a 銀行明細取込 | 1.35 | — | — | b-main (B) | Claude | 楽天/みずほ/PayPay/京都の4銀行。京都銀行は入金のみ |
| 2026-04-22 | (pending) | Bud | Phase 2b CC明細取込 | 0.8 | — | — | b-main (B) | Claude | オリコ/NTTBiz/三井住友x2。飲食店5000円ルール継承 |
| 2026-04-22 | (pending) | Bud | Phase 2c 共通マスタseed | 0.3 | — | — | b-main (B) | Claude | v12 Excel（441行）→ root_expense_categories |
| 2026-04-22 | (pending) | Bud | Phase 3 支払明細＋照合 | 2.0 | — | — | b-main (B) | Claude | |
| 2026-04-22 | (pending) | Bud | Phase 4a 自動仕訳エンジン | 1.0 | — | — | b-main (B) | Claude | 3段階判定・CC 5000円ルール・マスタ編集 |
| 2026-04-22 | (pending) | Bud | Phase 4b OCR + 撮影UI + Storage | 3.3 | — | — | b-main (B) | Claude | Claude Vision、スマホ連続撮影、Google Drive アーカイブ |
| 2026-04-22 | (pending) | Bud | Phase 4c FM レシート Bud化（全件移行） | 2.1 | — | — | b-main (B) | Claude | GBU形式へ移行、旧KR番号はRootに保持。川中さんアカウント作成前提 |
| 2026-04-22 | (pending) | Bud | Phase 5 コストダッシュボード | 1.5 | — | — | b-main (B) | Claude | 添付xlsx の置換 |
| 2026-04-22 | (pending) | Bud | Phase 6 給与処理（MF連携＋手渡し現金） | 4.55 | — | — | b-main (B) | Claude | MFクラウド給与連携に方針転換、9段階ステータス、手渡し案C採用、前払・社宅管理追加 |

**Bud 合計見積**: 20.35d（Phase 0 完了済、Phase 1a〜6 の合計。Phase 4 は 4a/4b/4c、Phase 2 は 2a/2b/2c に分割）

## 見積変遷ログ（Bud Phase 1〜6）

| 時点 | 合計 | 主な変更 |
|---|---|---|
| 当初（2026-04-22 午後）| 14.0d | Phase 1a/1b/2/3/4/5/6 の初期見積 |
| +Leaf 連携（1c 新設）| 15.2d | +1.2d |
| +CC 取込（2b/2c 追加）| 16.65d | +1.45d |
| +京都銀行（2a 増）| 16.8d | +0.15d |
| +FM レシート移行（4c 新設）| 18.9d | +2.1d |
| +Phase 6 再設計（MF 連携）| 19.5d | +0.6d |
| +手渡し案C（受領確認テーブル）| 20.1d | +0.6d |
| +前払・社宅管理（微増）| 20.15d | +0.05d |
| +Root 追加カラム（MF 識別子等）| 20.25d | +0.1d |
| **最終**（2026-04-22 夜）| **20.35d** | **+6.35d from initial** |

## 運用後の改善候補メモ

実際に業務運用してから検討する追加改善項目：

| 対象 Phase | 検討項目 | 検討タイミング |
|---|---|---|
| Phase 1b キャッシュバック | 検討中で振込予定日超過時の**通知強化（D案: メール・Chatwork・自動却下）** | 運用3ヶ月後 |
| Phase 1a | 京都銀行の全銀協CSV**実装**（現状は枠のみ）| 京都銀行から送金が必要になったとき |

## 集計ビュー（完了分のみ反映）

### モジュール別累計

| モジュール | 累計見積(d) | 累計実績(d) | 誤差率(%) | 完了 Phase 数 |
|---|---:|---:|---:|---:|
| Soil | 0 | 0 | — | 0 |
| Root | 0 | 0 | — | 0 |
| Tree | 0 | 0 | — | 0 |
| Leaf | 0 | 0 | — | 0 |
| **Bud** | 0 | 0 | — | 0 |
| Bloom | 0 | 0 | — | 0 |
| Seed | 0 | 0 | — | 0 |
| Forest | 0 | 0 | — | 0 |
| Rill | 0 | 0 | — | 0 |
| **全体** | **0** | **0** | **—** | **0** |

### 所感・学び（Phase 完了のタイミングで追記）

| 日付 | Phase | 所感（見積精度・ボトルネック・改善点） |
|---|---|---|
| 2026-04-22 | Bud Phase 1a | 見積 0.5d → 実績 0.35d（-0.15d、30% 時短）。subagent-driven-development で機械的な TDD タスクを高速に回せた。**最終レビューで Critical 3 件検出**：ZenginSourceAccount 未検証で SJIS 120 byte 破綻、padding helper のサイレント truncation、合計金額 12 桁 overflow の未検知。すべて即修正し、byte 長検証テスト・padding 専用テストを追加。教訓：(1) レビュー subagent は必ずコード品質的な穴を掘り起こす価値がある（省略不可）、(2) 金融データの固定長バイナリは「文字数 = バイト数」という暗黙前提を単体テストで検証しないと SJIS 環境で破綻する、(3) padding helper はデフォルトで throw する方が安全（silent truncate は長期潜伏バグの温床）。 |

## 運用ルール

1. **spec/plan 作成時**: 工数見積セクションに `estimated_days` を記入し、このファイルにも追加（行追加のみ）
2. **完了時**: git log から着手日を確認し、完了日を記入。実績を `1 日 = 8 時間` 換算で算出
3. **合算セクション**: 月次で更新（完了 Phase がない月はスキップ OK）
4. **A/B 両セッションで更新**: 複数セッション並行でも同じファイルを更新。`git merge` 時に競合起きたら両方保持
5. **精度が大きくズレた Phase**: `所感` 欄に原因と次回改善点を記録（例：「OCR プロンプトチューニングで 2 日超過。次回は事前に 5 枚でプロトタイプ検証」）
