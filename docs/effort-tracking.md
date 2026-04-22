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
| Forest | Phase A1: 進行期自動更新 Python スクリプト（PDF → Supabase） | 1.0 | — | — | a-forest (A) / b-main (B) | 2026-04-21 | — | Task 1 は 2026-04-22 に A で完了。Task 2-4 は 2026-04-22 に B で完了。Task 5-7 継続中。spec/plan に見積未記載のため本ファイル作成時にレトロスペクティブに 1.0 d を設定 |

## 運用メモ

- **Phase A1 の内訳** (参考):
  - Task 1: Python 環境セットアップ + `requirements.txt` → ✅ 完了 (2026-04-22, a-forest)
  - Task 2: スクリプト骨組み + `.env.local` 読み込み → ✅ 完了 (2026-04-22, b-main)
  - Task 3: PDF 抽出ロジック移植 → ✅ 完了 (2026-04-22, b-main)
  - Task 4: PDF 走査ループ (dry-run 確認済) → ✅ 完了 (2026-04-22, b-main)
  - Task 5: Supabase REST API UPDATE → ⏳ 進行中
  - Task 6: 運用手順書 README → ⏳ 未着手
  - Task 7: エンドツーエンド動作確認 (東海林依存) → ⏳ 未着手

- **Phase A2 / A3 は別 plan で別行追加**。未着手。

- **本ファイルの起源**: 2026-04-22、ルール `feedback_effort_tracking.md` 遵守のため作成。以降の Phase では spec/plan 作成と同時に行追加すること。
