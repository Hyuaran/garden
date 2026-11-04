# Codex-514 作業レポート（2026-11-04）

## 実装
- 日本時間の9:00〜20:50・10分刻み・10分以上先・3か月以内の予約を画面とサーバーで検証。
- 予約の確認・完了の幕・入力リセット・予定一覧・変更・確認付き取り消し・失敗理由の表示を追加。
- 予約APIはすべて一斉送信タブの閲覧権限を確認。送信中の変更・取り消しを条件付き更新で拒否。
- 自動処理は予約を古い順に1件ずつ取得し、条件付き更新で確保。送信時の名簿・タグで宛先を再計算する。
- 0人・通数不足は未送信の失敗として保存。一部失敗は結果と送信日時を保存。題名と理由をGarden通知へ1回通知する。
- 30分以上送信中の予約は失敗にして通知し、自動再送しない。
- previewの片付け・即時送信の確保対象から予約行を除外。既存の履歴読み込みは変更なし。

## 変更ファイル
- `src/lib/line/scheduled.ts`
- `src/lib/line/scheduled.server.ts`
- `src/lib/line/scheduled.test.ts`
- `src/lib/line/scheduled.server.test.ts`
- `src/app/api/system/line/manage/route.ts`
- `src/app/api/system/line/manage/route.test.ts`
- `src/app/api/system/line/scheduled/cron/route.ts`
- `src/app/system/line/LineManager.tsx`
- `src/app/system/line/ScheduledBroadcasts.tsx`
- `src/app/system/line/ScheduledBroadcasts.module.css`
- `src/app/system/line/ScheduledBroadcasts.test.tsx`
- `supabase/migrations/20261104000514_line_scheduled_broadcast.sql`
- 指示書：自動処理の1日あたり回数を追記。
- 本レポート。

## migration
`20261104000514_line_scheduled_broadcast.sql` はファイルを作成しただけで、未適用。
`scheduled_at`・`schedule_status`（`failed` を含む）・`updated_by`・`updated_at`・失敗理由用の `schedule_error` と探索用索引を追加する。

## テスト
- `npx tsc --noEmit`：成功。
- 最終差分の重点テスト：5ファイル・33件成功（日時・送信処理・画面・API・no-flicker）。
- 保存した人の記録・取り消し後の行保持を追加し、送信処理テスト9件を再実行して成功。
- 既存画面を含む先行テスト：5ファイル・41件成功。
- `npx vitest run src --exclude '**/employment-contract-pdf-integrity.test.tsx'`：成功（701ファイル・6,740件成功、6ファイル・8件スキップ、終了コード0）。実行開始後に追加した画面テスト4件も別途成功。
- 全体テストでは既存のjsdomの画面遷移未実装メッセージが出たが、失敗はなし。
- LINE送信・Garden通知・DB操作は対象テスト内でモック。ブラウザ操作は実施していない。

## 後から有効化する設定
`vercel.json` は未変更。Claudeの確認後、`crons` 配列に追加する行：

```json
{ "path": "/api/system/line/scheduled/cron", "schedule": "*/5 * * * *" }
```

5分間隔で1日288回。現状は未登録なので今回追加した定期実行は0回。画面の定期的な取り直しは追加していない。
実行には既存の `verifyCronRequest` による認証が必要。`maxDuration` は300秒。

git操作・commit・本番への書き込み・migration適用・実際のLINE送信は行っていない。
