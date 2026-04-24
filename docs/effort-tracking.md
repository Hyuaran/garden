# Garden シリーズ 工数トラッキング

> Phase / タスクごとの **見積 (estimated_days)** と **実績 (actual_days)** を蓄積する共有ログ。
> 東海林アカウント A / B 両セッションで同じファイルに追記する。
>
> - 1 日 = 8 時間。動作確認・レビュー対応含む実稼働ベース
> - Phase 着手時に見積行を追加、完了時に実績・差分・所感を記入
> - 見積を後から書き換えない（乖離理由は `notes` に記録）
> - 根拠メモリ: `feedback_effort_tracking.md`

## 記録フォーマット

| module | phase / task | estimated_days | actual_days | diff | session | started | finished | notes |
|---|---|---:|---:|---:|---|---|---|---|

## 履歴

| module | phase / task | estimated_days | actual_days | diff | session | started | finished | notes |
|---|---|---:|---:|---:|---|---|---|---|
| Forest | Phase A1: 進行期自動更新 Python スクリプト（PDF → Supabase） | 1.0 | 0.4 | -0.6 | a-forest (A) / b-main (B) | 2026-04-21 | 2026-04-22 | コード・ドキュメント完成、本番 UPDATE 疎通確認済み。4社分PDF で 4/4 件 UPDATE 成功。Task 7 のブラウザ目視確認と日報記録は東海林依頼で残。見積 1.0 d に対し AI 支援で 0.4 d で完了 |
| Forest | Phase A2/A3: 進行期編集モーダル（PDF自動入力+手動編集+期切り替え） | 2.5 | 0.6 | -1.9 | b-main (B) | 2026-04-22 | 2026-04-23 | ShinkoukiEditModal + PdfUploader + /api/forest/parse-pdf + mutations + RLS パッチ。PDF 解析は pdfjs-dist サーバーサイド、Python 版と同値を確認。subagent-driven-development で Task 1-8 を haiku で実装、Dashboard 統合は inline。admin 動作確認 OK |
| Forest | fix: ShinkoukiEditModal タブ切替時の高さジャンプ修正 | 0.05 | 0.03 | -0.02 | a-forest (A) | 2026-04-23 | 2026-04-23 | タブコンテンツを minHeight:560 のラッパーで固定。次ビルド/型チェック OK、PR #11 作成（Vercel プレビューで目視確認待ち） |

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

- **本ファイルの起源**: 2026-04-22、ルール `feedback_effort_tracking.md` 遵守のため作成。以降の Phase では spec/plan 作成と同時に行追加すること。
