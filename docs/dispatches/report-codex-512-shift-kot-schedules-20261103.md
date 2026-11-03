# Codex-512 作業レポート（2026-11-03）

## 実装

- 確定した月に KING OF TIME の送信欄、件数、最終送信日時、失敗一覧、理由付きの印を追加。
- 確認の小窓から人ごとに順に送信し、全画面の幕に進捗を表示。確定直後にも最新の件数で確認する。
- 明日以降の未送信・失敗だけを対象とし、従業員コードから社員を確認。所属の予定を読み、出勤は月をまとめて登録、休みは予定がある日だけ削除。
- 各行に結果を保存。変更中の行を古い結果で上書きしないよう、取得時の更新日時も条件にする。
- 受付停止時間、中継の停止、1.3.0 未満の中継をサーバーで確認。権限は「みんなのシフト」の既存の閲覧権限。
- 中継は予定のパス・クエリ・本文・件数・64KB制限を検証し、削除の204を処理。予定の要求は直列で約1秒あけ、429・403（105）を待って再試行。

## 変更ファイル

- `src/lib/shift/kot-push.server.ts`、`kot-push.test.ts`
- `src/lib/shift/route.server.ts`、`route.test.ts`、`service.server.ts`
- `src/lib/relay/types.ts`
- `src/app/api/system/shift/team/kot/route.ts`
- `src/app/system/shift/KotSendPanel.tsx`、`KotSendPanel.test.tsx`、`ShiftManager.tsx`、`Shift.test.tsx`
- `scripts/relay-agent/agent.mjs`、`config.example.json`、`README.md`
- `scripts/relay-agent/tests/agent.test.mjs`、`schedules.test.mjs`
- `supabase/migrations/20261103000512_shift_kot_status.sql`

## migration

`20261103000512_shift_kot_status.sql` はファイル作成のみ。送信状態・日時・エラー・送信済みの開始終了を追加し、開始または終了の変更で未送信に戻すトリガーを定義した。確定し直しで作り直される行も既定値で未送信になる。本番・ローカルDBとも適用していない。

## テスト

- `npx tsc --noEmit`：成功。
- シフト関連：6ファイル・33件成功。今日以前の除外、休みの削除有無、登録本文、200内の失敗、従業員コードなし、停止時間、中継の版、SQLトリガー、小窓・幕・失敗の一覧と印を確認。
- `npx vitest run --config scripts/relay-agent/vitest.config.mjs`：3ファイル・52件成功。
- `npx vitest run src --exclude '**/employment-contract-pdf-integrity.test.tsx'`：成功。697ファイル・6,708件成功、6ファイル・8件スキップ（約453秒）。既存の画面移動テストによる jsdom の `Not implemented: navigation to another Document` の出力はあるが、失敗はない。

## 東海林さん向け：ホストPCの係の入れ替え

1. ホストPCのタスク「GardenRelayAgent」を終了する。
2. 新しい `scripts/relay-agent/agent.mjs` に差し替える。
3. 既存の `config.json` の `agentVersion` を `1.3.0` にする。接続先や秘密の設定値はそのまま残す。
4. タスクを再実行し、ログの `relay agent started` に `version: 1.3.0` が出ることを確認する。

この作業中は git・computer-use・ブラウザを使っていない。本番書き込み、KING OF TIME の実呼び出し、LINE送信はしていない。DB変更とホストPCの入れ替えは未実施。

定期実行・定期間隔の取り直しは追加していない（追加の自動実行は1日0回）。送信はボタン操作時だけ。所属の予定は人ごとの要求内で読み直し、同じ所属の複数人でも各人の処理で最新の予定を確認する。
