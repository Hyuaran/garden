# Codex-319 リストマスタ「分析」③ 新営業 FileMaker の既契約 ブロックの中身を作る

作成日: 2026-09-13
作業ツリー: C:\garden\a-bloom-008
起点: main b373ce6（`git log -1` で一致を確認してから着手）
**git は触らないこと（commit するな）。migration は「書くだけ」（実行しない）。本番のデータ・FileMaker に触らないこと。開発サーバ・ブラウザを起動しないこと。**

必ず先に読むもの：
- ④正本：C:\Claude\000_Garden\150_System_システム\00_マニュアル\14_リストマスタ\Garden_System_リストマスタ_4_仕様書_Claude読み込み用.md（§8-7 分析タブ・Codex-318 の実装メモ）
- 今の分析：supabase/migrations/20260913000001_soil_list_analysis_blocks.sql と 20260913000002_soil_list_analysis_active_list_rule.sql（`soil_list_analysis_begin` / `soil_list_analysis_collect(p_chunk, p_chunks)` / `finish`。**分割は ctid の範囲・1 回 0.1 秒**）／src/app/api/soil/list/analysis/_lib/analysis.ts（buildBlock・detail）／src/app/system/list/_components/ListMasterClient.tsx（`renderAnalysisBlock`・`ANALYSIS_HELP`・③は今「準備中」の枠だけ）
- 新営業の写し：supabase/migrations/20260911000002_system_fm_shineigyo.sql（表 `system_fm_shineigyo`＝主キー・電話番号・携帯番号・リスト名・営業ID・受注日・既契約情報・既契約回線タイプ・既契約継続有無・修正日・run_id・取込日時／記録 `system_fm_shineigyo_sync_log`）。**2026-09-13 に本番へ 55,096 行入り、毎朝 5:30 に写し直す**（社内ホストPCのタスク登録済み）

## 0. 何を作るか

分析タブの③「新営業 FileMaker の既契約」を、①②と同じ形（円グラフ＋表・行を押すと円グラフが切り替わる・結果ボタンで一覧・見出し横の「？」）で出す。

- **区切り＝新営業の「既契約情報」**（ドコモ光 3,067／BIGLOBE光 979／Softbank光 869／OCN光 346 …93 種類）。空欄は「（既契約情報なし）」として 1 行（新営業 55,096 行のうち 48,087 行が空欄。これも並べる＝①の「（購入先なし）」と同じ扱い）
- **件数＝その既契約情報を持つ新営業の電話番号のうち、電話番号台帳にある番号**（2026-09-13 実測：新営業の電話番号 55,079 件のうち 55,064 件が台帳にある。既契約情報ありは 6,994 番号）。同じ電話番号が新営業に複数行あるときは **修正日が新しい行（同じなら主キーが大きい行）の既契約情報を 1 つ**採用する
- 円グラフ・表の列・受注率の定義は①②と同じ（台帳の 最終コール結果／コール回数合計／受注件数 から）

```
┌ ③ 新営業 FileMaker の既契約 ？      新営業の写し：2026/09/13(日) 15:27 時点 ┐
│ ( 円グラフ )  凡例                                                          │
│ 既契約情報        │件数 │コール済│総コール│回転│有効 │受注(案件)│獲得(コール)│受注率(有効)│受注率(総数)│
│ 合計              │55,064│ …                                                                                 │
│ （既契約情報なし） │48,0xx│ …                                                                                 │
│ ドコモ光          │ 3,0xx│ …                                                                                 │
│ …（件数の多い順・上位 50 行＋「すべて表示する」）                                                              │
└──────────────────────────────────────────────────────────────┘
```

## 1. DB（migration は書くだけ）`supabase/migrations/20260913000003_soil_list_analysis_contract_block.sql`

- 表 `soil_list_analysis_contract_phone`（電話番号 text primary key、既契約情報 text not null）：`begin()` で `system_fm_shineigyo` から作り直す（電話番号が空の行は除く・数字だけにそろえる・同じ番号は 修正日 desc, 主キー::numeric desc で 1 行）。RLS 有効・service_role のみ
- `soil_list_analysis_begin()`：上の表の作り直しを足す（今の active_list の作り直しはそのまま）
- `soil_list_analysis_collect(p_chunk, p_chunks)`：union に **3 本目**を足す。`block = 'contract'`、`segment = coalesce(nullif(c."既契約情報", ''), '（既契約情報なし）')`、台帳 p と `soil_list_analysis_contract_phone c` を `c."電話番号" = p."電話番号"` で内部結合（ctid の範囲と電話番号が空でない条件は 1・2 本目と同じ）。`segment_last_called_on` は null。ほかの列の作り方は 1 本目と同じ
- `soil_list_analysis_cell.block` の check 制約は 'contract' を既に許している（確認だけ）
- 冪等に書く（`create or replace` / `create table if not exists`）。**1 回の collect が 8 秒に収まる**こと（3 本目は結合先が 5.5 万行なので軽い）

## 2. API

- `src/app/api/soil/list/analysis/_lib/analysis.ts`：`blocks.contract` を `{ pending: true }` から `{ segments: AnalysisSegment[], snapshotAt: string | null }` に変える。`snapshotAt` ＝ `system_fm_shineigyo_sync_log` の `status = 'success'` の最新 `completed_at`（無ければ null）。buildBlock は①と同じ関数で `block = 'contract'`
- `detail/route.ts`：`BLOCKS` に `contract` を足す
- 既存の返り値（vendor / activeList / refreshedAt …）は変えない

## 3. 画面（ListMasterClient.tsx）

- ③を「準備中」の枠から `renderAnalysisBlock("③ 新営業 FileMaker の既契約", "contract", …)` に置き換える。選択の状態 `analysisSelections.contract`（既定 "合計"）、上位 50 行の状態 `showAllSegments.contract` を足す
- 見出しの右（controls の位置）に「**新営業の写し：2026/09/13(日) 15:27 時点**」（`snapshotAt` を `formatJstWithWeekday` で。null なら「新営業の写しはまだありません」）
- `ANALYSIS_HELP.contract` を本当の定義に書き換える：区切り＝新営業の「既契約情報」（空欄は「（既契約情報なし）」）／件数＝その既契約情報を持つ新営業の電話番号のうち台帳にある番号（同じ番号が複数行あれば修正日が新しい方）／円グラフ・受注率＝①と同じ／元データ＝社内ホストPCから毎朝 5:30 に写す新営業の表
- 表の 1 列目の見出しは「既契約情報」
- 円グラフの結果ボタン → 一覧（detail）も①②と同じに動くこと
- 集計がまだ③を含んでいない（migration 前の集計）ときは、③に「集計を作り直すと表示されます（↻）」と出す（segments が空のとき）

## 4. テスト
- API：cells に block='contract' の行があるとき `blocks.contract.segments` が①と同じ形で作られる／`snapshotAt` が sync_log の最新 success から取れる（無ければ null）／detail が `block=contract` を受ける
- 画面：③に表と円グラフが出る／見出し右に「新営業の写し：…」／集計に③が無いときの文言
- 既存テスト（src/app/system/list・src/app/api/soil/list）は全部通す

## 5. 変えてはいけないもの
- ①②の数字と動き／集計の分割方式（ctid 100 等分）／8 秒の設定
- `system_fm_shineigyo` は**読むだけ**

## 6. 受け入れ基準
1. vitest（src/app/system/list・src/app/api/soil/list）が通る　2. tsc に今回の変更由来のエラーが無い　3. eslint（変更ファイル単位）が通る
4. Claude が本番で：migration 実行 → 集計を作り直す（100 回・1 回 8 秒以内）→ ③の合計 ≒ 55,064・ドコモ光 ≒ 3,06x を DB 直結の SQL と突き合わせ → 画面で③の円グラフ・表・一覧・「？」・「新営業の写し：…」を確認

## 7. 完了報告（コードブロックで出力）
- 「未コミット」と明記／変更・追加ファイルのフルパス／受け入れ基準 1〜3 の結果／本番データ・git・SQL 実行に触っていないことの明記／migration の SQL 全文

## 8. 既知の差分（Codex が追記する）
