# Codex-318 リストマスタ「分析」タブの作り直し：円グラフ＋表を 1 セットにした 3 ブロック

作成日: 2026-09-13
作業ツリー: C:\garden\a-bloom-008
起点: main e9a0db7（`git log -1` で一致を確認してから着手）
**git は触らないこと（commit するな）。migration は「書くだけ」（実行しない）。本番のデータ・Kintone・FileMaker に触らないこと。開発サーバ・ブラウザを起動しないこと。**

必ず先に読むもの：
- ④正本：C:\Claude\000_Garden\150_System_システム\00_マニュアル\14_リストマスタ\Garden_System_リストマスタ_4_仕様書_Claude読み込み用.md（§3 データモデル・**§8-7 分析タブの決定**・§9 落とし穴＝REST は 8 秒で切れる）
- 今の分析：src/app/api/soil/list/analysis/route.ts・supabase/migrations/20260910000001_soil_list_assignments.sql の `soil_list_analysis_by_list`・src/app/system/list/_components/ListMasterClient.tsx（`activeTab === "analysis"` の部分・AnalysisRow・loadAnalysis）
- 分割実行の前例：src/app/api/soil/list/uploads/_lib/apply-upload.ts（1,000 件ずつ・残り件数）・src/app/api/soil/list/orders/_lib/order-sync.ts（cron・1,000 番号ずつ rpc）
- 見た目：C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\070_AI-Rules\050_Gardenスタイル・社長スタイル.md（社長スタイル。数値の強調＝0 は `--val-zero`、1 以上は `--val-strong`＋太字）。円グラフは既にある `chart.js`＋`react-chartjs-2` を使う（新しいライブラリを足さない）
- 東海林さんの決定（2026-09-11）は ④ §8-7 のとおり。ここに要点を再掲する

## 0. 何を作るか

今の分析タブは「リスト名ごとの表がざっと出るだけ」で、見ても「だから？」となる。**円グラフ＋表を 1 セットにして 3 ブロック**にする。

```
分析                                          集計：2026/09/13(土) 06:45 時点   ↻
┌ ① どこから購入したか ──────────────────────────────────────────────────────────┐
│ ┌ 円グラフ ┐  購入先        │件数    │コール済│総コール│回転│有効    │受注(案件)│獲得(コール)│受注率(有効)│受注率(総数)│
│ │ 留守 48% │  データ総研    │338,255 │ 91,020 │210,332 │0.6 │301,110 │   1,204  │     3      │   0.40%    │   0.36%    │
│ │ 担不 25% │  ラディッシュ  │215,035 │ …      │        │    │        │          │            │            │            │
│ │ 未コール │  …（購入先ごとに 1 行・件数の多い順）                                                                       │
│ └─────────┘  合計          │ …                                                                                            │
│  円グラフは「選んでいる購入先」のコール結果の内訳。表の行を押すとその購入先に切り替わる（最初は合計）                       │
│  円グラフの切れ（例：留守）を押す → 下に「留守」の番号をリスト名ごとに一覧（今の分析の表の形）                              │
└──────────────────────────────────────────────────────────────────────────────┘
┌ ② 今コールしているリスト   [ 直近 30 日 | 直近 15 日 ] ── ①と同じ形（行＝リスト名） ──┐
┌ ③ 新営業 FileMaker の既契約 ── ①と同じ形（行＝既契約の種類）。**今回は「準備中」の枠だけ**（データは Codex-317 で入る） ──┐
```

- **円グラフの中身＝コール結果**（電話番号台帳の「最終コール結果」）。上位 6 つ（今の実データだと 留守／担不／無効／NG／前確OK／見込）＋**未コール**（コール回数合計 0）＋**その他**（残り全部）
- 表の列と意味（**この定義を画面の下に必ず書く**）
  - 件数＝その区切りに入る電話番号の数
  - コール済み＝コール回数合計が 1 以上の番号数
  - 総コール回数＝コール回数合計の合計
  - **回転＝総コール回数 ÷ 件数**（小数 1 桁。「何件に対して何回転コールしているか」）
  - 有効＝件数 −（最終コール結果が「無効」の番号数）
  - **受注（案件）＝受注件数が 1 以上の番号数**（受注履歴＝Kintone 顧客一覧にある番号）
  - **獲得（コール）＝最終コール結果が「獲得」の番号数**
  - **受注率（有効）＝受注（案件）÷ 有効／受注率（総数）＝受注（案件）÷ 件数**（受注率は「受注（案件）」で計算する。「獲得（コール）」は件数を並べるだけ。理由＝今の入力運用では実際に受注した番号でも「獲得」が付いているのは 18 件だけ。展開が進むと 2 つの数字が近づく）
- 表記ゆれは集計時にまとめる：「坦不」→「担不」、「前確ＯＫ」→「前確OK」（全角英数は半角に・前後の空白は除く）。それ以外の値はそのまま

## 1. DB（migration は書くだけ・実行しない）`supabase/migrations/20260913000001_soil_list_analysis_blocks.sql`

### 1-1. 集計表（画面はこれを読むだけ）
**`soil_list_analysis_cell`**：いちばん細かい粒＝（ブロック, 区切り, コール結果, リスト名）。円グラフ・表・切れを押したときの一覧の**全部をこの 1 表の足し算で出す**

| 列 | 中身 |
|---|---|
| block | `vendor`（①購入先）／`active_list`（②今コールしているリスト）／`contract`（③既契約。今回は行を作らない） |
| segment | ①＝最新購入先（空は「（購入先なし）」）／②＝リスト名／③＝既契約の種類 |
| result | まとめた後のコール結果。未コールは「未コール」、空は「（結果なし）」 |
| list_name | 台帳のリスト名（空は「（リスト名なし）」）・list_loaded_on＝そのリストの投入日の最大 |
| row_count／called_count／call_total／invalid_count／order_count／acquired_count／last_called_on | 上の定義どおりの数（invalid＝最終コール結果が「無効」、order＝受注件数≥1、acquired＝最終コール結果が「獲得」） |
| segment_last_called_on | ②で使う：その区切り（リスト）の最終コール日の最大（30 日／15 日の切り替えは画面側でこの列を見る） |

主キー（block, segment, result, list_name）。索引（block, segment）。RLS 有効・service_role のみ

**`soil_list_analysis_state`**（1 行）：refreshed_at、last_elapsed_ms、last_error、rows。**authenticated に select ポリシー**（画面の見出し「集計：… 時点」に使う。soil_list_call_sync_state と同じ作り）

### 1-2. 集計は「分けて」作る（8 秒制限のため。台帳 267 万件を 1 回の SQL で集計すると REST から呼べない）
- **`soil_list_analysis_collect(p_prefix text)`**：電話番号が `p_prefix` で始まる台帳の行だけを集計して、作業用の表 `soil_list_analysis_cell_next`（本体と同じ形）に **足し込む**（`insert … on conflict do update set row_count = row_count + excluded.row_count …`）。①と②の両方をこの 1 回で作る（②は「直近 30 日にコールがあったリスト名」に限る：`soil_list_call` の最終コール日が今日−30 日以降のリスト名の集合を先に temp table に取る）。返り値 `rows integer`。**1 回（2 桁の接頭辞＝約 2.7 万件）が 8 秒に収まる**こと
- **`soil_list_analysis_begin()`**：`_next` を空にする／**`soil_list_analysis_finish()`**：本体を `_next` の中身と入れ替え（1 トランザクションで truncate → insert）、state を更新
- コール結果のまとめ関数 `soil_list_normalize_call_result(text)`（sql・immutable）：trim → 全角英数を半角に → 「坦不」→「担不」→ 空／null は null。`collect` の中で使う
- 電話番号が空の 98,367 行は対象外（接頭辞で拾えないので自然に外れる。定義文に「電話番号が空の行は数えない」と書く）
- 既存の `soil_list_analysis_by_list` は**消さない**（切れを押したときの一覧は `soil_list_analysis_cell` から出すので使わなくなるが、残す）

## 2. API

### 2-1. 集計の作り直し `POST /api/soil/list/analysis/refresh`（manager 以上・maxDuration 300）
1. `soil_list_analysis_begin` → 接頭辞 `00`〜`99` の 100 回 `soil_list_analysis_collect` を順に呼ぶ → `soil_list_analysis_finish`
2. 途中で失敗したら本体は触らない（`_next` だけが中途半端になる）。state の last_error に理由、画面には「集計を作り直せませんでした（途中で止まりました）。もう一度押してください」
3. 返り値：refreshed_at・rows・elapsed_ms
- **毎朝 6:45 にも同じ処理**：`GET /api/soil/list/analysis/cron`（`verifyBearerRequest(request, "CRON_SECRET")`）。vercel.json に `{ "path": "/api/soil/list/analysis/cron", "schedule": "45 21 * * *" }` を足す（受注履歴の 6:30 の 15 分後）

### 2-2. 読む `GET /api/soil/list/analysis`（今の API を作り替え・返り値の形は新しくしてよい）
- `soil_list_analysis_cell` を全部読んで（多くても数万行。1,000 行の上限があるので**ページングして全部取る**）、サーバ側で次にまとめて返す：
  - `refreshedAt`
  - `blocks.vendor.segments[]`：segment ごとの表の 1 行（件数…受注率）＋ `results[]`（result ごとの件数＝円グラフ用）
  - `blocks.activeList.segments[]`：同じ形＋ `lastCalledOn`
  - `blocks.contract`：`{ pending: true }`
- 切れを押したときの一覧 `GET /api/soil/list/analysis/detail?block=vendor&segment=データ総研&result=留守`：その粒のリスト名ごとの行（list_name・list_loaded_on・row_count・called_count・call_total・order_count・acquired_count・last_called_on）を投入日の新しい順で。segment=`__all__` なら区切りをまたいだ合計
- 10 分のメモリキャッシュは refresh のあとに消す

## 3. 画面（ListMasterClient.tsx の `activeTab === "analysis"`）

- 見出しの右に「**集計：2026/09/13(土) 06:45 時点**」と **↻**（丸い矢印。リスト画面のコール履歴の反映と同じ部品・manager 以上だけ押せる・処理中は回る・終わったら右横に「作り直しました（n 行・m 秒）」）。集計がまだ無いときは「集計がまだありません。↻ を押してください」
- **ブロック①**：左に円グラフ（`react-chartjs-2` の Doughnut または Pie・凡例は右か下・切れの上にホバーで「留守 636,609 件（48.2%）」）、右に表。表の行を押すとその区切りが選ばれ（行の背景を変える）、円グラフがその区切りの内訳に変わる。最初は「合計」の行が選ばれている。**円グラフの切れを押すと**、ブロックの下に「データ総研 × 留守：リスト名ごと」の一覧（表：リスト名／投入日／件数／コール済み／総コール回数／受注（案件）／獲得（コール）／最終コール日。投入日の新しい順・リスト名で絞る入力あり）。閉じるボタンあり
- **ブロック②**：見出しの右に切り替え「直近 30 日｜直近 15 日」（既定 30 日）。行＝リスト名（segment_last_called_on が今日−N 日以降のものだけ）。ほかは①と同じ
- **ブロック③**：枠と見出しだけ出し、中は「準備中（新営業 FileMaker の既契約を毎朝取り込む仕組みができたら表示します）」
- 数値の見せ方：件数は 3 桁区切り、率は小数 2 桁＋%、回転は小数 1 桁。**受注（案件）・獲得（コール）の 0 は薄く（`--val-zero`）、1 以上は太字（`--val-strong`）**
- 円グラフの色は 8 色（結果ごとに固定。未コールは灰色・その他は薄い灰色）。ダークモードでも読める色にする（コントラスト比を CSS の変数で持つ。見出しは `--heading`）
- 表の下に「定義」を畳める形で出す（§0 の列の意味を業務の言葉で。「受注率は受注（案件）で計算しています。獲得（コール）は件数だけ並べています」を明記）
- 今の「リスト名で絞る／並び」の入力と表は無くしてよい（同じ情報は切れを押した一覧で出る）
- 文言は業務の言葉のみ・絵文字なし・アイコンは SVG 線画

## 4. テスト
- DB 関数は実行しないので、SQL は目視と `soil_list_normalize_call_result` のテスト観点（「坦不」「前確ＯＫ」「 留守 」→「担不」「前確OK」「留守」）を完了報告に書く
- API（モック）：refresh が begin → collect×100 → finish の順で呼ぶ／collect が途中で失敗したら finish を呼ばず state に last_error／cron は CRON_SECRET 違いで 401／analysis はセルの行から区切りごとの合計と率を正しく作る（有効＝件数−無効、受注率（有効）＝受注÷有効、回転＝総コール÷件数）／detail は block・segment・result で絞る／manager 未満は refresh 403
- 画面：3 ブロックが出る／②の 30 日⇄15 日で行が変わる／表の行を押すと円グラフが切り替わる／切れを押すと一覧が出て閉じられる／③は準備中／集計が無いときの文言
- 既存テスト（src/app/system/list・src/app/api/soil/list）は全部通す

## 5. 変えてはいけないもの
- リスト・アップロード・管理方法タブの動きと見た目
- 電話番号台帳・購入履歴・投入履歴・コール履歴・受注履歴の中身（**集計は読むだけ**）
- 8 秒の設定（DB のロール設定）。REST から呼ぶ 1 回の関数は必ず 8 秒に収める

## 6. 受け入れ基準
1. vitest（src/app/system/list・src/app/api/soil/list）が通る　2. tsc に今回の変更由来のエラーが無い　3. eslint（変更ファイル単位）が通る
4. Claude が本番で：migration 実行 → ↻ で集計を作る（100 回の分割で最後まで通る・1 回が 8 秒以内）→ 3 ブロックの数字を DB 直結の SQL と突き合わせ（購入先 1 つ・リスト 1 つ）→ 切れを押した一覧 → 30 日⇄15 日 → ダークモードのコントラスト実測

## 7. 完了報告（コードブロックで出力）
- 「未コミット」と明記／変更・追加ファイルのフルパス／受け入れ基準 1〜3 の結果／本番データ・git・SQL 実行に触っていないことの明記／migration の SQL 全文／`soil_list_analysis_collect` 1 回の想定時間と根拠

## 8. 既知の差分（Codex が追記する）

- Claude（2026-09-13 レビューで修正）：§1-2 の「電話番号の 2 桁接頭辞で 100 分割」は本番では成り立たなかった（日本の番号は全部 0 始まり＝実質 10 分割。`like '05%'` は照合順序 en_US.UTF-8 のため索引も効かず、1 回 6.8〜12.7 秒）。`soil_list_analysis_collect(p_chunk integer, p_chunks integer default 100)` に変え、**表の物理的な位置（ページ番号・ctid の範囲）で 100 等分**する方式にした（1 回 0.04〜0.09 秒・本番で実測）。あわせて②の「直近 30 日にコールがあったリスト名」は分割ごとでなく `begin()` で全体から 1 回作る表 `soil_list_analysis_active_list` にした（分割ごとだと、その分割に最近のコールが無いリストが落ちて数が合わない）。API 側は `{ p_chunk, p_chunks }` を渡すだけの変更。
