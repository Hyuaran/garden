# Codex-330 リストマスタ 分析①：切り口（購入先／元回線／契約時期）＋購入先の複数選択を「かつ」に＋受注を顧客数と案件数の 2 列に

作成日: 2026-09-15
作業ツリー: C:\garden\a-bloom-008
起点: main 3202de3（Codex-329 反映済み。`git log -1` で一致を確認してから着手）
**git は触らないこと（commit するな）。本番のデータ・DB・Kintone に触らないこと。開発サーバ・ブラウザを起動しないこと。migration は supabase/migrations に書くだけで実行しない（実行は Claude）。**

必ず先に読むもの：
- ④：C:\Claude\000_Garden\150_System_システム\00_マニュアル\14_リストマスタ\Garden_System_リストマスタ_4_仕様書_Claude読み込み用.md（**§2-3 分析・§4-5 分析・§8-7 受注履歴と分析の作り直し・§8-9 #4 #5・§9**）。食い違ったら ④ を優先し §10 に書く
- 分析の集計：C:\garden\a-bloom-008\supabase\migrations\20260913000001_soil_list_analysis_blocks.sql（`soil_list_analysis_cell`・`soil_list_analysis_begin/collect/finish`・block='vendor' は `最新購入先` で区切る）・20260913000003（③ 既契約）・20260913000002（② の決め方）
- 画面と API：C:\garden\a-bloom-008\src\app\api\soil\list\analysis\_lib\analysis.ts（セルの読み方・`orderCount`・`analysisOrderSummary`）・analysis\route.ts・analysis\detail\route.ts・analysis\refresh\route.ts・analysis\cron\route.ts（毎朝 6:45・100 分割）、C:\garden\a-bloom-008\src\app\system\list\_components\ListMasterClient.tsx（分析タブ・`MultiSelectFilter` の「購入先で絞る」・`initialLimit`）
- 受注件数の元：C:\garden\a-bloom-008\supabase\migrations\20260911000001_soil_list_orders_latest.sql（`soil_list_refresh_phone_latest`＝台帳の `受注件数`・`最新受注日`・`最新受注商材`）。受注履歴 `soil_list_order` は 電話番号×顧客一覧レコード番号 で 1 行（1 案件が電話と携帯で 2 行になる）
- DB 直結：C:\garden\a-bloom-008\src\lib\db\pg.ts（`queryPg`・statement_timeout 60 秒）。**REST の rpc は 8 秒で切れる**（④ §9）
- Codex-329 で足した列：`元回線`・`契約時期`（date・月初）・`区分`

## 0. 何を作るか（東海林さん 2026-09-15・④ §8-9 #4 #5）

分析①「どこから購入したか」を、購入先だけでなく **元回線・契約時期（年）** でも見られるようにし、**購入先の複数選択を「選んだ購入先すべてに購入履歴がある番号」（かつ）** にする。表の「受注（案件）」を **受注顧客数（電話番号 1 つ＝1）と受注案件数（案件 1 つ＝1）** の 2 列に分ける。

```
分析①
  切り口：[購入先 ▾ | 元回線 | 契約時期（年）]     購入先で絞る：[Luna ✓][データ総研 ✓]（＝両方に購入履歴がある番号だけ）
  円グラフ（最終結果の内訳）＋凡例＋「うち受注顧客 n 人・受注案件 n 件」
  表：区切り｜件数｜コール済み｜総コール回数｜回転｜有効｜受注顧客数｜受注案件数｜獲得（コール）｜受注率（顧客・有効）｜受注率（顧客・総数）
```

## 1. 集計（migration 1 本・`20260916000001_soil_list_analysis_line_type_contract_order_cases.sql`）

- `soil_list_analysis_cell` に列追加：`order_case_count integer not null default 0`（受注案件数）。`_next` も同じ（like … including all なので再作成に注意）
- 台帳に `受注案件数 integer not null default 0` を追加し、`soil_list_refresh_phone_latest` で **`count(distinct 顧客一覧レコード番号)`** を入れる（`受注件数` は今までどおり行数＝互換のため残す）
- `soil_list_analysis_collect`：block を 2 つ増やす
  - `line_type`：segment＝`coalesce(nullif(元回線,''),'（元回線なし）')`
  - `contract_year`：segment＝`to_char(契約時期,'YYYY')`、契約時期が null は `（契約時期なし）`
  - 既存 `vendor`（最新購入先）・`active_list`・③ はそのまま。各 block に `order_case_count = sum(受注案件数)` を足す
- 集計時間：今 100 分割で 1 回 0.1 秒（④ §4-5）。block が 2 つ増えても cron の枠内に収まること（テストは文面のみ・実測は Claude）

## 2. 「かつ」（購入先の複数選択）

- 2 つ以上選んだときだけ、**集計セルでなく DB 直結でその場で数える**（1 つのときは今までどおり block='vendor' のセル）
  - 対象番号＝`select 電話番号 from soil_list_purchase where coalesce(nullif(購入先_NEW,''),購入先) = any($1) group by 電話番号 having count(distinct coalesce(nullif(購入先_NEW,''),購入先)) = $2`
  - その番号に台帳を join して、切り口（購入先＝最新購入先／元回線／契約時期年）× 最終結果 × リスト名 で `count・called・call_total・invalid・order（顧客）・order_case・acquired` を出す（集計 collect と同じ式。**式は SQL 関数 `soil_list_analysis_vendor_and(p_vendors text[], p_axis text)` にまとめ、collect と二重に書かない**）
  - `queryPg` で実行（statement_timeout 60 秒）。60 秒で終わらなければ「条件が広すぎます。購入先を減らしてください」（500 にしない）
  - 購入先 2 つ以上ある番号は 380,125 件（2026-09-15 実測）。`soil_list_purchase` の 購入先／購入先_NEW に索引が無ければ migration で足す
- 画面：「購入先で絞る」の下に注記「2 つ以上選ぶと、選んだ購入先すべてに購入履歴がある番号だけを数えます（かつ）」。結果の見出しに「Luna かつ データ総研：n 件」

## 3. 画面（分析タブ・ListMasterClient.tsx）

- ① の見出し横に切り口の切替（ラジオ 3 つ：購入先／元回線／契約時期（年））。切り口を変えると円グラフ・凡例・表が変わる。「？」の説明も切り口ごと
- 表の列：「受注（案件）」→「受注顧客数」「受注案件数」の 2 列。受注率は顧客数で（「受注率（有効）」「受注率（総数）」の定義は変えず分子を顧客数と明記）。凡例の下は「うち受注顧客 n 人・受注案件 n 件」
- ②③ の表も同じ 2 列に（集計は同じセル）
- 表の見出しは 2 段のまま。列が 1 つ増えるので幅 1,024px 未満は横スクロール（既存の `overflow-x`）

## 4. テスト（vitest）
- migration 文面：列 2 つ・block 2 つ・`order_case_count`・関数 `soil_list_analysis_vendor_and`・索引
- `analysis.ts`：`orderCaseCount` の合算・切り口ごとの読み分け・2 つ以上の購入先で DB 直結の経路に入る・60 秒超のメッセージ
- 画面：切り口の切替で表が変わる・2 列の見出し・注記・「かつ」の見出し
- 既存テスト（src/app/system/list・src/app/api/soil/list）は全部通す

## 5. 変えてはいけないもの
- ② ③ の決め方（§8-7）・集計の 100 分割・cron の時刻・円グラフの固定の並び・`受注件数` 列の意味（互換）
- リストタブ・アップロード・書き出し（Codex-329 の成果物）

## 6. 受け入れ基準
1. vitest が通る　2. `npx tsc --noEmit` に今回由来のエラー無し　3. eslint（変更ファイル）
4. Claude が：migration 適用 → `soil_list_refresh_phone_latest` → 分析の集計を 1 回 → 画面で 切り口 3 つ・「Luna かつ データ総研」の件数（DB 直結の秒数）・受注顧客数≦受注案件数 を実測 → 翌朝 6:45 の集計が枠内で終わること

## 7. 完了報告（コードブロック）
- 「未コミット」／変更・追加ファイルのフルパス／migration のパス／受け入れ 1〜3 の結果／本番・git に触っていない明記／④ との差分（§10）

## 8. 画面文言
- 「切り口」「購入先」「元回線」「契約時期（年）」「受注顧客数」「受注案件数」「うち受注顧客 n 人・受注案件 n 件」「2 つ以上選ぶと、選んだ購入先すべてに購入履歴がある番号だけを数えます」「条件が広すぎます。購入先を減らしてください」

## 9. 既知の差分（Codex が追記する）
