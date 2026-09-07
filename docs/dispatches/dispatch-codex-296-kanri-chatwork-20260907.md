# Codex-296 管理表ポータル：Chatwork 送信（作成者名＋管理表の要約と URL を指定ルームへ送る）

作成日: 2026-09-07
作業ツリー: C:\garden\a-bloom-008
起点: main **e652bf2**（Excel 書き出し 本番稼働）
**git は触らないこと。SQL・migration を書かないこと（表は増やさない）。本番のデータ・Storage・ドライブに触らないこと。開発サーバを起動しないこと。Chatwork へ実際に送らないこと（テストは fetch のモック）。**

必ず先に読むもの：
- 正本（④）：C:\Claude\000_Garden\150_System_システム\00_マニュアル\07_管理表ポータル\Garden_System_管理表ポータル_4_仕様書_Claude読み込み用.md
- 設計書 5 章：C:\Claude\000_Garden\150_System_システム\04_管理表ポータル\004_設計_段階2b_3_4_残りのシートとKOT.md（「Chatwork 送信：作成者名＋管理表の URL を指定ルームへ送る。テストは開発ルーム 433894375 → 本番ルームへ」）
- 既存の Chatwork 送信部品：src/app/system/_lib/chatwork.ts（コール数配信で使用。環境変数 CHATWORK_API_TOKEN・CHATWORK_DEV_ROOM_ID・CHATWORK_ROOM_KYOUYU_ID）と src/app/system/_lib/call-report-delivery.ts（使い方の実例）

## 0. 何を作るか

管理表ポータルで「計算する」を終えたあと、**「Chatwork に送る」** を押すと、指定のルームに「誰が・いつの管理表を作ったか」と要約・URL を投稿する。今まで営業部が Excel を作って Chatwork で報告していた動きの置き換え。現場には出さない。東海林さんが並行運用する（送り先はまず開発ルーム）。

## 1. 送る内容（本文の形。絵文字なし）
```
【管理表】2026/08/31（締めチェック）の管理表を 東海林 美琴 が作成しました。
テレマ全体：稼働 2,966h・実数 222 件・ポイント 260.6P（効率 0.088）
宮永チーム 87.2P／小泉チーム 87.0P／石原チーム 86.4P
https://garden-os.net/system/kanri?date=2026-08-31
```
- 1 行目：対象日・種類（デイリー／締めチェック）・作成者名（run の creator_name）
- 2〜3 行目：管理表シートの合計行から（KanriSheetGrid.totals：all の hours・total・points・efficiency、teams の points）。数値は 3 桁区切り、効率は小数 3 桁
- 4 行目：管理表ポータルの URL（対象日つき。`NEXT_PUBLIC_SITE_URL` があればそれ、無ければ https://garden-os.net）。管理表ポータルは対象日をクエリ `?date=YYYY-MM-DD` で開けるようにする（無ければ足す。ログイン必須のまま）
- Chatwork の書式は [info][title]…[/title]…[/info] を使ってよい（既存部品に合わせる）

## 2. 送り先と設定
- 送り先ルーム：環境変数 `KANRI_CHATWORK_ROOM_ID`。**無ければ `CHATWORK_DEV_ROOM_ID`（開発ルーム 433894375）に送る**。本番ルームは東海林さんが決めたら Claude が Vercel の環境変数に入れる（コードに ID を直書きしない）
- トークン：`CHATWORK_API_TOKEN`（既存）。コードやログに出さない
- 送った記録：run の summary に `chatwork: { sentAt, roomId, by }` を足す（表は増やさない）。画面に「送信済み（9/7 18:05・東海林）」と出す。もう一度押すときは「もう一度送りますか」の確認

## 3. 画面
```
（上部の操作） [データを取り込む] [計算する] [Excel を書き出す] [Chatwork に送る]
                                                          └ 計算前は押せない。送信後は「送信済み（時刻・名前）」
```
- manager 以上。絵文字なし、開発者用語なし。失敗時は「Chatwork に送れませんでした。管理者へ問い合わせてください」（技術的な理由は画面に出さない。サーバーのログには残す）

## 4. 作るもの
- `src/app/system/kanri/_lib/chatwork-message.ts`：本文を組み立てる純粋関数（テスト：数値の書式・種類の表記・URL）
- API：`POST /api/system/kanri/runs/[id]/chatwork`（manager 以上）：計算済みか確認 → 本文 → 既存部品で送信（テキストのみ。添付なし。既存の添付つき関数しか無ければ、テキスト送信の小さな関数を chatwork.ts に足す）→ summary に記録
- 画面：「Chatwork に送る」ボタン・送信済み表示・再送の確認
- 管理表ポータルの `?date=` 対応（無い場合）
- テスト：本文の組み立て／API（manager 未満 403・計算前 400・送信成功で summary 更新・fetch はモック）／画面（ボタンの活性と送信済み表示）

## 5. 変えてはいけないもの
- 計算と保存。既存の Chatwork 部品の呼び出し側（コール数配信）。既存 API の形（足すだけ）

## 6. 受け入れ基準
1. vitest（KANRI_FIXTURES_DIR 指定）が通る　2. tsc に今回の変更由来のエラーが無い　3. eslint が通る
4. 実際の送信はテストで行わない（fetch をモック）。Claude が本番で開発ルームへ 1 回送って確認する
5. 絵文字なし・開発者用語なし・トークンやルーム ID の直書きなし

## 7. 完了報告（コードブロックで出力）
- 「未コミット」と明記／変更・追加ファイルのフルパス／受け入れ基準 1〜5 の結果／本番データ・git・SQL・Chatwork 送信に触っていないことの明記

## 8. 既知の差分（Codex が追記する）
- （ここに追記）
