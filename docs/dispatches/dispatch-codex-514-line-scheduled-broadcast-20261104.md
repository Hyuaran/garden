# Codex-514 公式LINEの一斉送信を日時指定で予約する（2026-11-04）

作業場所：C:\garden\a-bloom-008（main）
**git は触らない（commit もしない）。computer-use・ブラウザ操作は使わない。本番に書き込まない（migration はファイルを作るだけ。当てるのは Claude）。LINE を本当に送らない（テストはモック）。** ファイルは UTF-8。必要な範囲だけ読む。
画面の文字はきちんとした日本語。英語・開発者用語を出さない。**コードは周りと同じく読みやすく書く**（1行に詰め込まない）。
**`vercel.json` の crons には足さない**（初回は止めて配備し、Claude が確かめてから足す。追加する行をレポートに書く）。

## 背景
一斉送信（`src/app/system/line/LineManager.tsx`・`src/app/api/system/line/manage/route.ts` の preview / send）は今すぐ送るだけ。LINE に予約の仕組みは無いので、Garden に予約を保存し、5分ごとの自動処理で送る。

## 決まりごと（東海林さん確定）
- 時刻は **10分刻み**。実際の送信は指定時刻から最大5分ほど遅れる（画面に書く）
- **送信先は送信する時点で決める**（タグ `tag_ids` から `recipients()` で計算し直す。予約から送信までの入社・退職を反映）
- 予約・変更・取り消しができる人＝一斉送信タブの閲覧権限がある人（今の `requireLineAdmin('broadcast')` と同じ）
- **21:00〜翌9:00 は選べない**（選ぶ欄に出さない・API でも弾く。日本時間）
- 予約できるのは今から10分以上先・3か月以内

## 保存先（migration `supabase/migrations/20261104000514_line_scheduled_broadcast.sql`）
`system_line_broadcast` に列を足す：`scheduled_at timestamptz`（予約の日時。今すぐ送信は null）・`schedule_status text`（null／`scheduled`＝送信予定／`sending`＝送信中／`canceled`＝取り消し）・`updated_by text`・`updated_at timestamptz`。送信予定を探す索引（`schedule_status, scheduled_at`）。

**注意：今の preview は「`sent_at` が空で1時間たった行」を消している（route.ts 108行目）。予約の行を消さないよう、`scheduled_at is null` の行だけ消す形に直す。**
履歴の読み込み（`src/lib/line/tags.server.ts`）は今どおり `sent_at` がある行だけ。予定の一覧は別に読む。

## 画面（一斉送信タブ）
```
 2 送信内容
  題名 [            ]
  送信内容 [        ]
 送信のしかた  (● 今すぐ送信) (○ 日時を指定して予約)
              [ 2026/11/10 ] [ 10:00 ▼ ]     ← 予約を選んだときだけ出す。場所がずれないよう枠を確保
              指定の時刻から最大5分ほど遅れて送信されます。
                                          [ 確認する ]

 送信予定（2件）                          ← 1件以上のときだけ。履歴の上
 ┌送信日時──────────┬題名───────┬送信先────┬予約した人┐
 │2026/11/10(火) 10:00:00 │11月分 雇用契約書│アルバイト ほか│東海林 美琴│  ← 行全体を押すと小窓
 └───────────────────────────────┘
```
- 確認の小窓（今の送信確認）：予約のときは行を足す「送信日時」。人数の行に「送信する時点の人に送ります。今の時点で◯人」。ボタンは［予約する］
- 予約したら全画面の幕で一瞬「2026/11/10(火) 10:00 に予約しました」（`DoneOverlay` の部品。今すぐ送信の完了と同じ見た目）→ 題名・送信内容・絞り込みを空にする（今すぐ送信のあとと同じ）
- 送信予定の行を押すと小窓：題名・送信内容・絞り込み・日時を変更 →［保存する］。［予約を取り消す］はごみ箱の線画（`RowActionButton kind="delete"`）＋ Garden の確認の小窓。小窓はスクロールバーを出さない
- 取り消した予約は一覧から消える（行は `canceled` で残す）
- 送ったものは履歴に「送信済み」で出る。送信日時は `sent_at`
- 定型文（`{年}` など）は押した時点で置き換わる今の動きのまま

## API（`manage/route.ts` に action を足す。処理は `src/lib/line/` に切り出す）
- `schedule`（新規）・`scheduleUpdate`・`scheduleCancel`：すべて `broadcast` タブの権限。日時の決まりをサーバーでも確かめる。`sending` の行は変更・取り消しできない（「送信中のため変更できません。」）
- tab の対応表（`tabs`）に3つとも足す

## 自動処理 `GET /api/system/line/scheduled/cron`（`verifyCronRequest`。`src/app/api/system/innovera-ingest/cron/route.ts` と同じ形）
1. `schedule_status='scheduled'` かつ `scheduled_at <= now()` の行を古い順に取る
2. **1件ずつ `schedule_status` を `sending` に、条件つき更新で奪う**（`.eq('schedule_status','scheduled')`。二重送信を防ぐ。奪えなかったら飛ばす）
3. その時点の `loadLineData()` と `recipients()` で送信先を計算 → `chunks` ごとに `pushLineStaff`
4. `sent_at`・`sent_count`・`failed_count`・`recipient_count` を更新し、`schedule_status` を null に戻す
5. 送る人が0人・残り通数が足りない（`getLineStaffQuota`）・一部失敗のときは、Garden通知（`sendGardenNotice`。`src/lib/relay/monitor.server.ts`）に題名と理由を1回知らせる。残り通数が足りないときは送らず、`sent_at` は空のまま `schedule_status='scheduled'` に戻さない（`failed` を足す。画面の送信予定に「送信できませんでした：理由」と出す）。migration の値にも `failed` を含める
6. 途中で止まった `sending` は自動でやり直さない（二重送信を避ける。30分以上 `sending` の行は `failed` にして知らせる）
- 同時に送るのは順番に。`maxDuration` は 300

## テスト
日時の決まり（10分刻み・夜間・10分以上先・3か月以内）、権限なしは 403、二重送信の防止（奪えないと送らない）、送信先を送信時に計算、0人・残り通数不足・一部失敗の知らせ、preview の片付けで予約を消さない、画面（予約の選択・確認の小窓・送信予定の小窓・取り消し）。`npx tsc --noEmit` と `npx vitest run src --exclude '**/employment-contract-pdf-integrity.test.tsx'` が通ること。`src/lib/ui/no-flicker-source.test.ts` を壊さない。

## 終わったら
`docs/dispatches/report-codex-514-line-scheduled-broadcast-20261104.md` に、直したファイル・migration・テスト結果・`vercel.json` に足す行を書く。

## 実装時の回数見積もり
5分間隔の自動処理は1日288回。今回の作業では `vercel.json` に登録しないため、新たな定期実行は0回。画面の定期的な取り直しは追加しない。
