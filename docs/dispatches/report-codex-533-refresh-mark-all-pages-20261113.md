# Codex-533 作業報告（2026-11-13）

## 実装

- コール履歴：ホスト PC への依頼 POST → 状態 GET が done → Garden の call-sync 再集計 → 検索済み一覧の件数・行を再読込。待機中だけ usePolling（3 秒間隔・最大 3 分）を有効にし、完了・失敗・時間切れで停止する。503・failed・タイムアウトは既存の画面上部メッセージへ表示する。
- sync-request の POST・GET は、コール集計のいずれかのタブ、またはリストマスタの一覧を閲覧できる人に許可する。後段の call-sync POST もリストマスタの閲覧権限で実行できるようにした。
- 受注履歴：更新ボタンから新規 POST `/api/soil/list/orders/sync` を呼び、syncOrders の実行後に同期状態と検索済み一覧を読み直す。閲覧できない人は 403。手動同期 API は PostgreSQL の advisory lock で複数インスタンス間も同時 1 本に制限し、既存同期状態の updated_at を使って 1 分以内の再試行を 429 で止める。成功・失敗とも lock を解放する。
- INNOVERA：更新ボタンは既存の差分確認 GET に接続。反映 POST は呼ばない。取得結果で画面と確認時刻を更新する。
- 派遣管理：既存の GET `/api/system/haken` を no-store で読み直し、取得したデータと取得時刻を表示する。
- 付与ポイント表：閲覧権限で既存 loadPoints を実行する refreshPoints action を追加。取得結果と取得時刻を画面に反映する。
- 各更新ボタンは処理中 disabled / aria-busy。ref でも連打を防ぎ、失敗時は既存の画面上部エラー表示へ通知する。

## 変更ファイル

実装：

- `src/app/system/list/_components/ListMasterClient.tsx`
- `src/app/api/system/call-metrics/sync-request/route.ts`
- `src/app/api/soil/list/call-sync/route.ts`
- `src/app/api/soil/list/orders/sync/route.ts`（新規）
- `src/app/system/innovera/InnoveraSyncClient.tsx`
- `src/app/system/haken/HakenClient.tsx`
- `src/app/soil/product-points/ProductPointsClient.tsx`
- `src/app/soil/product-points/actions.ts`

テスト：

- `src/app/system/list/_components/ListMasterClient.test.tsx`
- `src/app/api/system/call-metrics/sync-request/route.test.ts`
- `src/app/api/soil/list/call-sync/refresh-permission.test.ts`（新規）
- `src/app/api/soil/list/orders/sync/route.test.ts`（新規）
- `src/app/system/innovera/InnoveraSyncClient.test.tsx`
- `src/app/system/haken/HakenClient.test.tsx`（新規）
- `src/app/soil/product-points/ProductPointsClient.test.tsx`
- `src/app/soil/product-points/actions.test.ts`

文書：元の dispatch の末尾に日次回数の見積もりを追記。本報告を新規作成。

## 検証

- `npx --no-install tsc --noEmit --incremental false`：終了コード 0。
- `npx --no-install vitest run src/app/system/list src/app/api/soil/list src/app/system/innovera src/app/system/haken src/app/soil/product-points src/app/api/system/call-metrics`：44 ファイル、254 テストすべて成功。
- 各画面の更新・busy・失敗表示、依頼→done→再集計の順序、待機中に再集計しないこと、503・failed・3 分タイムアウト、閲覧権限、手動受注同期の同時実行・1 分制限・失敗時 lock 解放をモックで検証。
- git 操作・commit・computer-use・ブラウザ操作・本番書き込み・外部サービスの実呼び出しは実施していない。パッケージ取得を避けるため npx は --no-install 付きで実行した。

## 1 日の回数の見積もり

追加の定期取得・cron は 0 本。押さない場合の追加呼び出しは 0 回/日。

- コール更新を C 回/日：依頼 POST C 回、状態 GET 最大 60C 回、完了分だけ再集計 POST。FileMaker は依頼ごとに今日・昨日分を取り直す（件数によって複数ページ）。検索済みなら完了後の件数・行取得を各 1 回。例：10 回/日なら依頼 10 回、状態確認は最大 600 回、再集計は最大 10 回。
- 受注更新を O 回/日：手動 API O 回、受理分だけ既存 syncOrders の全件取得・保存・再計算と状態取得。検索済みなら件数・行取得も各 1 回。最低 1 分間隔なので受理開始の理論上限は 1,440 回/日。既存 cron の頻度は変更していない。
- INNOVERA I 回、派遣 H 回、ポイント P 回/日：それぞれ既存差分 GET I 回、派遣 GET H 回、読込 action P 回。実際の外部 API / DB のページ数は件数依存。

## 判断事項

- コール更新は閲覧者も使える仕様に合わせ、旧 canSyncCalls prop による画面の更新禁止を外した。prop 自体は既存呼び出しとの互換性のため受け付ける。後段の再集計 POST も閲覧権限へ揃えた。
- 一覧をまだ検索していない場合は更新の完了だけを表示し、意図しない全件検索は開始しない。検索済みの場合は現在の検索条件・並び順で一覧を取り直す。
- 受注の連打制限には既存 updated_at を使い、成功時刻 last_run_at を試行開始で上書きしない。失敗直後や既存 cron の完了直後も 1 分待つ。排他 lock の対象は新設の手動同期 API 同士で、既存 cron の実装は変更していない。
- コール依頼中はタブが非表示でも待機確認を継続し、3 分上限で終了する。常時ポーリングは追加していない。
- DB スキーマ変更・マイグレーション・マニュアル作成は行っていない。
