# 関電の写メを TimeTree から取り込む

プロジェクトのルートで実行します。通常の取り込みには `.env.local` の `NEXT_PUBLIC_SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` が必要です。

```sh
npx tsx scripts/leaf-kanden-photos/import-timetree.ts --list timetree-kanden-photos.json --dry-run
npx tsx scripts/leaf-kanden-photos/import-timetree.ts --list timetree-kanden-photos.json --from 2026-11-01 --to 2026-11-30 --limit 20 --concurrency 4
```

日付の境界は両端を含みます。日付が空の予定は日付指定がある場合に除外します。`--dry-run` はローカルの一覧から取り込み済みを含む件数と、8 万枚で 27 GB を基準にした画像容量を見積もります。

同じ一覧で再実行すると未登録の写メを取り込み、登録済みの写メで PDF の更新が済んでいない予定も再処理します。取り込みプロセスは 1 本ずつ起動してください。失敗の詳細は `logs/failed-<日時>.json` に記録します。

## 一覧の作り方

```json
[{"id":"<予定ID>","d":"2026-11-19","no":"1527681","imgs":[["calendar/0c9a/2026-11-19/75284610-1795129942264.jpg",1442,1920]]}]
```

TimeTree にログインした Chrome で `https://timetreeapp.com/calendars/` を開き、開発者用の実行で次を動かす：
1. `/api/v1/calendar/75284610/events/sync`（`since` で続きを取る・`chunk` が false で終わり）で全予定を取る。ヘッダー `X-Timetreea: web/2.1.0/ja`
2. 予定ごとに `/api/v1/calendar/75284610/event/<予定ID>/activities` を取り、`type===0` かつ消されていないものの `attachment.images[].object_key/width/height` を集める（同時 6 本）
3. メモ（note）の「管理番号」の数字、予定の日付（日本時間）と合わせて上の json にし、`timetree-kanden-photos.json` として保存する
