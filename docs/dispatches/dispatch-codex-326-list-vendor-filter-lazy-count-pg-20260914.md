# Codex-326 リストマスタ：「購入先で絞る」を開いた直後に固まらないように／件数（count）も PostgreSQL 直結に

作成日: 2026-09-14
作業ツリー: C:\garden\a-bloom-008
起点: main d713b9f（`git log -1` で一致を確認してから着手）
**git は触らないこと（commit するな）。本番のデータ・DB に触らないこと。開発サーバ・ブラウザを起動しないこと。集計の中身・条件の意味は変えない（画面の描き方と件数の取り方だけ）。**

必ず先に読むもの：
- ④正本：C:\Claude\000_Garden\150_System_システム\00_マニュアル\14_リストマスタ\Garden_System_リストマスタ_4_仕様書_Claude読み込み用.md §4-1（条件と検索・件数は REST 8 秒）・§9（購入先で絞るの重さ・8 秒の壁）
- 画面の部品：C:\garden\a-bloom-008\src\app\system\list\_components\MultiSelectFilter.tsx（`groups`・`searchable`・`visibleGroups`・`visibleOptions`・「すべて選ぶ」の対象）と、それを使う C:\garden\a-bloom-008\src\app\system\list\_components\ListMasterClient.tsx（`vendorFilterGroups`＝1227 行あたり・分析①の `MultiSelectFilter … searchable`。絞り込みの 4 項目も同じ部品）
- 件数：C:\garden\a-bloom-008\src\app\api\soil\list\count\route.ts（今は Supabase REST の `count: "exact", head: true`）／一覧の DB 直結の作り C:\garden\a-bloom-008\src\app\api\soil\list\search\route.ts と `_lib/search-sql.ts`（`buildSearchSql`＝条件 → SQL・`queryPg`・`hasDatabaseUrl`）／`src/lib/db/pg.ts`
- テスト：`_lib/query.test.ts`・`_lib/validation.test.ts`・`_lib/export-sql.test.ts`（SQL の組み立てのテストの書き方）・`src/app/system/list/_components/ListMasterClient.test.tsx`

## 0. 何を直すか（東海林さん 2026-09-14 朝）

### A. 「購入先で絞る」を開いた直後に数秒固まる
- 分析①の「購入先で絞る」は選択肢が 2,452 件あり、開いた瞬間に 2,452 個のチェックを全部描くのでブラウザが数秒固まる（2026-09-13 本番で実測：スクリーンショットも取れないほど）
- 直し方：**`searchable` のときは、開いた直後は「件数の多い順に上位 100 件」だけ描き、「名前で絞る」に 1 文字でも入れたら全体（2,452 件）から探して該当だけ描く**。パネルの下に「上位 100 件を表示中（全 2,452 件）。名前で絞ると全体から探せます」の 1 行（`.muted`）を出す
- **既に選んでいる購入先は、上位 100 件に入っていなくても必ず一覧に出す**（チェックを外せるように。上位 100 の上に「選択中」のグループとして出すのがよい）
- 「すべて選ぶ」の対象＝いま描いている分（今の `visibleOptions` の考え方と同じ）
- 絞り込みの 4 項目（都道府県など・`searchable` でない）は**今のまま**（全部描く。件数が少ないので問題ない）
- 部品に `initialLimit?: number` のような任意の props を足してもよい（既定は無制限＝今の動き）。分析①だけ 100 を渡す

```
┌ 購入先で絞る ─────────────────────── [すべて選ぶ] [閉じる] ┐
│ 名前で絞る [                 ]                                    │
│ 選択中                                                             │
│  [x] データ総研（332,631）  [x] 日本データ総研株式会社（42,625）        │
│ 件数の多い順                                                       │
│  [ ] （購入先なし）（908,657）  [ ] 株式会社Luna（194,824）  …（100 件）│
│ 上位 100 件を表示中（全 2,452 件）。名前で絞ると全体から探せます          │
└──────────────────────────────────────────────────┘
```

### B. 件数（count）を PostgreSQL 直結に
- 今の件数は Supabase REST（`count: "exact", head: true`）で、**8 秒で打ち切られる**ため、重い条件（例：リスト名「含む」＋日付の範囲）で「件数を確認できませんでした」になる。一覧・書き出しは既に DB 直結（statement_timeout 60 秒）
- 直し方：`count/route.ts` を一覧と同じ DB 直結にする。`_lib/search-sql.ts` に **`buildCountSql(condition)`**（`select count(*)::bigint as count from soil_list_phone where <同じ where 句>`。並び・limit・offset は付けない）を足し、`buildSearchSql` と **where 句の組み立てを 1 つの関数で共有**する（二重に書かない）。`queryPg` で実行し、`count` は `Number(...)`
- 応答の形は今のまま `{ ok, count, approximate, elapsedMs }`（`approximate` は今と同じ「5 秒超なら true」＝画面の「約」表示を変えない）
- `hasDatabaseUrl()` が false のときは今までどおり REST で数える（開発環境で DATABASE_URL が無いときのため）。失敗時の文言「件数を確認できませんでした」はそのまま
- **条件 → SQL は既存の `buildSearchSql` と完全に同じ意味**であること（`eq / contains / gte / lte / in / inOrEmpty / empty / notEmpty`・日本語列名の引用・`contains` のエスケープ）。テストで「同じ条件から作った where 句が search と count で一致する」ことを確認する

## 1. テスト
- MultiSelectFilter：`initialLimit=100` で 2,452 件の選択肢を渡すと最初は 100 件＋選択中だけ描く／検索文字を入れると全体から該当だけ／`initialLimit` なしは全部描く（既存の動き）
- count：`buildCountSql` の SQL と values／search と count の where 句が同じ／`hasDatabaseUrl()` false のときは REST を呼ぶ
- 既存テスト（src/app/system/list・src/app/api/soil）は全部通す

## 2. 変えてはいけないもの
- 集計・条件の意味・保存した条件の形／絞り込みの 4 項目の見た目と動き／「約」の表示ルール／一覧・書き出し

## 3. 受け入れ基準
1. vitest（src/app/system/list・src/app/api/soil）が通る　2. tsc に今回の変更由来のエラーが無い　3. eslint（変更ファイル単位）が通る
4. Claude が本番で：「購入先で絞る」を開いた瞬間に 100 件＋選択中が出て固まらない／「名前で絞る」に「データ総研」で全体から 17 件／件数が REST と同じ数（例：AU光○×アポ禁空欄＝1,945,619 前後・奈良県＝709）／リスト名「含む」＋日付範囲のような重い条件でも件数が出る、を実測

## 4. 完了報告（コードブロックで出力）
- 「未コミット」と明記／変更・追加ファイルのフルパス／受け入れ基準 1〜3 の結果（実行したコマンドと結果）／本番データ・DB・git に触っていないことの明記

## 5. 既知の差分（Codex が追記する）
