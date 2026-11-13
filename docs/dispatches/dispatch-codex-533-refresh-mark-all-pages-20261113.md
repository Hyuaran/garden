# Codex-533 残りの画面の更新マークを「押したら元から取り直す」にそろえる（2026-11-13）

作業場所：`C:\garden\a-bloom-008`（main）。Codex-530・530b（まだ commit していない差分）の続き。

**git は触らない（commit もしない）。computer-use・ブラウザ操作は使わない。本番に書き込まない。Kintone・INNOVERA・Supabase 本番を本当に呼ばない（テストはモック）。** ファイルは UTF-8・既存の改行に合わせる。文字化け（??）を残さない。必要な範囲だけ読む。コードは周りと同じく読みやすく書く。

## 決め（東海林さん 2026-11-13・正本＝Obsidian 900_Rules/050_全モジュール共通仕様.md §4）

すべての画面の更新マーク（`src/app/system/_components/UpdatedStamp` の ↻）は押せる形にする。押したら、その画面の数字の元から **すぐ強制的に** 取り直し、終わったら画面を読み直して最終更新の時刻を新しくする。取り直している間は busy（二重に押せない）。失敗は **画面の上** に知らせる（各画面の今のエラーの出し方に合わせる）。押していないときに裏で聞き続けない（Vercel の料金・900_Rules/030 §3）。

## 直す画面

### 1. リストマスタ `/system/list` の「コール履歴」（`src/app/system/list/_components/ListMasterClient.tsx` の 2458 行付近）

- 今：POST `/api/soil/list/call-sync` で Garden の中の `system_call_history` を数え直すだけ。元（FileMaker）は取りに行かない。
- 直す：押したら、Codex-530b で作った「ホスト PC の係への取り直しの依頼」（`POST /api/system/call-metrics/sync-request` → 係が今日と昨日を全部送り直す → `GET …?id=` で done）を使う。done になったら今の call-sync で数え直し → 画面を読み直す。待ちは `usePolling`（3 秒・最大 3 分）。係が止まっている（503）・failed・時間切れは画面の上に知らせる。
- 依頼の API をリストマスタを見られる人も使えるように、権限の判定を「コール集計 または リストマスタを見られる人」にする（530b の判定を広げる。どちらも見られない人は 403 のまま）。

### 2. リストマスタ `/system/list` の「受注履歴」（同ファイル 2460 行付近・今は `hideRefresh`）

- 元：Kintone（`src/app/api/soil/list/orders/_lib/order-sync.ts` の `syncOrders`・今は cron だけ）。
- 直す：更新マークを出し、押したら新しい `POST /api/soil/list/orders/sync`（リストマスタを見られる人だけ・同時に 1 本・前回から 1 分以内は「少し待ってからもう一度押してください」）で `syncOrders` を実行 → 画面を読み直す。

### 3. INNOVERA 番号の同期 `/system/innovera`（`src/app/system/innovera/InnoveraSyncClient.tsx` 137 行付近・今は onRefresh なし）

- 画面には「いまの差分を見る」「今すぐ反映」が別にある。
- 直す：更新マークを押したら「いまの差分を見る」と同じ取り直し（INNOVERA・Kintone から今の状態を読む。反映＝書き込みはしない）を行い、画面を読み直す。

### 4. 元が Garden の中にある画面は「データベースを読み直す」で押せる形に

- 派遣管理 `/system/haken`（`HakenClient.tsx` 119 行付近・今は `hideRefresh`）
- 付与ポイント表 `/soil/product-points`（`ProductPointsClient.tsx` 240 行付近・今は onRefresh なし）
- 押したら今の読み込み（API・関数）をやり直して画面を読み直す。最終更新は読み直した時刻。

### 対象外

- Tree の「有効率ランキング」「Chatwork 情報」（`src/app/tree/ranking`・`src/app/tree/chatwork`）は画面に書き込んだ見本の数字なので今回は触らない。

## テスト

- 各画面：押す→busy→取り直し（API が呼ばれる）→読み直し／失敗は上に知らせ（既存の画面テストの形に合わせる）
- リストマスタのコール履歴：依頼→done→数え直し→読み直し の順。依頼 API の権限（リストマスタだけ見られる人も使える・どちらも見られない人は 403）
- 受注履歴の API：見られない人は 403／1 分以内の連打は止める／同時に 1 本
- `npx tsc --noEmit --incremental false`、`npx vitest run src/app/system/list src/app/api/soil/list src/app/system/innovera src/app/system/haken src/app/soil/product-points src/app/api/system/call-metrics` が通ること

## 終わったら

`docs/dispatches/report-codex-533-refresh-mark-all-pages-20261113.md` に、直したファイル・テスト結果・1 日の回数の見積もり（押したときだけ・裏の取り直しは増やさない）・迷って決めたこと。マニュアルは不要（Claude がやる）。

## 実装時の回数見積もり（Codex-533）

- 押さない日の追加取得は 0 回。cron の追加・頻度変更はなし。
- コール履歴を C 回押す日：依頼 POST は C 回、状態 GET は最大 60C 回（3 秒間隔・3 分で終了する保守的上限）、完了した分だけ再集計 POST。検索結果表示中なら完了後の件数・一覧取得を各 1 回追加。FileMaker の取り直しは依頼ごとに今日・昨日分（ページ数は件数による）。
- 受注履歴を O 回押す日：同期 POST は O 回、受理された分だけ Kintone の全件読み込みと状態再取得。検索結果表示中なら件数・一覧取得を各 1 回追加。手動同期の開始間隔は最低 1 分で、理論上限は 1 日 1,440 回（既存 cron は別）。
- INNOVERA・派遣管理・付与ポイント表をそれぞれ I・H・P 回押す日：既存の差分 GET・派遣 GET・ポイント再読込 action を各 I・H・P 回。外部側・DB 側のページ分割数はデータ量による。
