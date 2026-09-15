# Codex-329 リストマスタ：元回線・契約時期（経過年月）・区分の 3 項目を台帳に持ち、絞り込み・一覧・書き出し・アップロードに組み込む

作成日: 2026-09-15
作業ツリー: C:\garden\a-bloom-008
起点: main 907a9e4（`git log -1` で一致を確認してから着手）
**git は触らないこと（commit するな）。本番のデータ・DB・Kintone に触らないこと。開発サーバ・ブラウザを起動しないこと。migration は supabase/migrations に書くだけで実行しない（実行と 267 万件の一括投入は Claude が DB 直結で行う）。**

必ず先に読むもの：
- ④：C:\Claude\000_Garden\150_System_システム\00_マニュアル\14_リストマスタ\Garden_System_リストマスタ_4_仕様書_Claude読み込み用.md（**§2-1 リストタブ・§3 データモデル・§4-1 条件と検索・§4-2 書き出し・§4-4 アップロード・§8-9 今回の要件と決定・§9 落とし穴**。この指示書と食い違ったら ④ を優先し、§10「既知の差分」に書く）
- 列と絞り込みの定義：C:\garden\a-bloom-008\src\app\system\list\_lib\list-fields.ts（`SOIL_LIST_COLUMNS`・`SOIL_LIST_FILTER_DEFINITIONS`・`SOIL_LIST_SEARCH_COLUMNS`・`SOIL_LIST_EXPORT_COLUMNS`・`getColumnName`）
- 条件 → SQL：C:\garden\a-bloom-008\src\app\api\soil\list\_lib\search-sql.ts（`buildWhereSql`＝search と count で共有）・validation.ts（`normalizeFilter`・演算子 eq/contains/gte/lte/in/inOrEmpty/empty/notEmpty）・query.ts（REST 版）・export-sql.ts
- 選択肢：C:\garden\a-bloom-008\supabase\migrations\20260907000001_soil_list_options.sql（`soil_list_refresh_options()`＝列名の配列 `['住所_都道府県','AU光架電可否','購入状態','アポ禁','判定結果','東西']` を回す）・API `GET /api/soil/list/options`・`_lib/options.ts`
- 画面：C:\garden\a-bloom-008\src\app\system\list\_components\ListMasterClient.tsx（絞り込み 10 項目・`MultiSelectFilter`・条件の要約・一覧・書き出しの列選択）・list-master.module.css
- アップロードの反映：C:\garden\a-bloom-008\supabase\migrations\20260911000001_soil_list_orders_latest.sql の `soil_list_apply_upload(p_upload_id, p_limit)`（新規番号の insert・既存番号の update の場所）・C:\garden\a-bloom-008\src\app\api\soil\list\_lib\upload-parser.ts（`extractListLoadedOn`＝リスト名の末尾日付）
- 見た目：社長スタイル（C:\Users\shoji\.claude\skills\garden-style\SKILL.md）。アイコンは絵文字禁止・SVG 線画。画面文言に migration／RPC 等の開発者用語を出さない

## 0. 何を作るか（東海林さん 2026-09-15・④ §8-9 #1〜#3）

営業が FileMaker でやっていた「元回線（アナログ／フレッツ）で絞る」「コラボの○年○か月で絞る」を Garden でもできるようにし、「区分（個人／屋号／法人）」でも絞れるようにする。

```
電話番号台帳（soil_list_phone）
  既存：元回線（全行空）・経過月数（59 万行・固定値）・経過期間_表示・判定項目・最新購入日・氏名
  追加：契約時期 date ／ 区分 text ／ 区分_判定元 text
  導出：元回線 ← リスト名 → 判定項目 → 購入先_NEW
        契約時期 ← 起点（最新購入日が 2025-12 以降なら 2025-12-01・以前なら最新購入日の月初）− 経過月数。最新購入日なし・経過月数なし＝空白
        区分   ← 氏名の言葉（法人語／屋号語／それ以外＝個人）。手入力があれば上書きしない
        経過   ＝ 今日 − 契約時期（列に持たない・表示と絞り込みのたびに計算＝更新され続ける）
リストタブの絞り込み 10 項目 → 13 項目（元回線・区分・経過（年））。一覧と書き出しに 4 列（元回線・契約時期・経過・区分）
アップロード：新規番号に 元回線（リスト名から）・区分（氏名から）を付ける。既存番号は空欄のときだけ埋める
```

## 1. migration（1 本・`20260915000001_soil_list_line_type_contract_period_category.sql`）

- `soil_list_phone` に列追加：`契約時期 date`（月初の日付で持つ。例 2024-10-01）／`区分 text`（個人・屋号・法人・空）／`区分_判定元 text`（'自動'・'手入力'・null）。既存列 `元回線 text` はそのまま使う
- 索引：`元回線`・`区分`・`契約時期`（btree。267 万件なので `create index concurrently` は使わず普通に。Claude が実行）
- **導出の関数 3 つ**（immutable な純関数＝一括投入とアップロード反映の両方から呼ぶ。日本語の値は下の表のとおり。**Codex が別の言葉に変えない**）
  - `soil_list_derive_line_type(list_name text, judge_item text, purchase_vendor_new text) returns text`
    | 順 | 見るもの | 値 |
    |---|---|---|
    | 1 | リスト名に「アナログ」 | アナログ |
    | 1 | リスト名に「フレッツ」または「F×転用」 | フレッツ |
    | 1 | リスト名に「AU」「au光」「auひかり」（大文字小文字を区別しない） | au |
    | 2 | 判定項目に「アナログ - NTT」「フレッツ」「auひかり」のうち **1 種類だけ** | その 1 種類（アナログ／フレッツ／au） |
    | 2 | 判定項目に 2 種類以上 | 混在 |
    | 3 | 購入先_NEW に「アナログ」／「フレッツ」 | アナログ／フレッツ |
    | 4 | どれにも当たらない | null（画面では「（空欄）」） |
  - `soil_list_derive_contract_month(latest_purchase_on date, elapsed_months integer) returns date`：どちらかが null なら null。起点＝`latest_purchase_on >= '2025-12-01'` なら `'2025-12-01'`、それ以外は `date_trunc('month', latest_purchase_on)`。返り値＝起点 − `elapsed_months` か月（月初）。**購入日なしは推定しない（東海林さん決定 a）**
  - `soil_list_derive_category(name text) returns text`：氏名が空なら null。法人語（株式会社・有限会社・合同会社・合資会社・（株）・(株)・（有）・(有)・社団法人・財団法人・医療法人・学校法人・社会福祉法人・宗教法人・組合）を含む → 法人。屋号語（商店・商会・工務店・建設・工業・クリニック・医院・歯科・事務所・不動産・自動車・整備・電気・設備・美容・理容・サロン・食堂・寿司・薬局・農園・牧場・水産・運送・興業・産業・企画・サービス・システム・センター・工房・教室・塾・末尾が 屋／店／院／園／堂／館／社／組／亭）を含む → 屋号。それ以外 → 個人。**判定の言葉は 1 つの配列定数にまとめ、テストで一覧を出す**
- **一括投入用の関数**（Claude が DB 直結で残り 0 まで繰り返す）：`soil_list_backfill_derived(p_limit integer default 50000) returns table(updated integer, remaining integer)`＝`区分_判定元 is distinct from '手入力'` の行を電話番号順に p_limit 件ずつ、`元回線`（空のときだけ）・`契約時期`・`区分`（＋判定元='自動'）を更新。処理済みの印は `契約時期`／`区分` ではなく **別の作業列 `派生更新_at timestamptz`** を足して使う（同じ行を二度回さない）。REST 8 秒は関係ない（DB 直結）が、1 回の呼び出しは 1 分以内に収まる件数に
- `soil_list_refresh_options()` の列配列に `'元回線'`・`'区分'` を足す
- `soil_list_apply_upload`：新規番号の insert に `元回線 = soil_list_derive_line_type(リスト名, null, null)`・`区分 = soil_list_derive_category(氏名)`・`区分_判定元 = '自動'`。既存番号の update は `元回線` が空のときだけリスト名から埋める（氏名・住所と同じ規則）。契約時期は投入ファイルに材料が無いので触らない
- コメント（comment on）を日本語で。既存の列・関数の意味は変えない

## 2. 絞り込み（リストタブ・10 項目 → 13 項目）

`list-fields.ts` に列 3 つ（`lineType`→元回線、`category`→区分、`contractMonth`→契約時期）を足し、絞り込み定義に 3 つ足す。

```
┌ 絞り込み ───────────────────────────────────────────────────────────────┐
│ [都道府県 ▾] [AU光架電可否 ▾] [購入状態 ▾] [アポ禁 ▾] [元回線 ▾] [区分 ▾]        │ ← 複数選べるチェック一覧（既存 4 つと同じ部品）
│ リスト名（含む）[__________]  リスト投入日 [__]〜[__]  再判定日 [__]〜[__]     │
│ 最終コール日 [__]〜[__]  コール回数 [__]以上〜[__]以下                        │
│ 経過（年）[__]年以上〜[__]年以下   購入履歴 [指定なし ▾]   [ 検索 ]             │ ← 経過＝契約時期から今日までの年数
└──────────────────────────────────────────────────────────────────────────┘
```

- 元回線・区分：`MultiSelectFilter`（値と件数は `soil_list_option` から。「（空欄）」も選べる＝既存と同じ `in`／`inOrEmpty`）
- 経過（年）：整数 2 つ（以上／以下・どちらか片方だけでも可）。SQL は **契約時期に対する日付の比較**（n 年以上＝`契約時期 <= current_date - (n || ' years')::interval`、m 年以下＝`契約時期 > current_date - ((m+1) || ' years')::interval`。契約時期が null の行は「経過」の条件を付けたら出ない）。演算子は既存の gte/lte を `contractMonth` に使い、画面側で年 → 日付に直して送る（新しい演算子は増やさない）
- 条件の要約（1 行に畳んだ表示）・［条件を保存］の要約・保存した条件の読み込みに 3 項目を含める
- 初期条件は変えない（AU光架電可否＝○＋アポ禁＝空欄）

## 3. 一覧と書き出し

- 一覧に列 4 つ：元回線／契約時期（「2024/10」）／経過（「1年11か月」＝今日 − 契約時期。契約時期なしは空）／区分。並べ替えは 契約時期 だけ対応（`SearchSortKey` に `contractMonth`）
- 一覧の **区分は直せる**（manager 以上）：セルを押すと 個人／屋号／法人／（空欄） の選択 → `PATCH /api/soil/list/phones/category` `{ phoneNumber, category }` → `区分`＋`区分_判定元='手入力'`。楽観更新。**手入力の行は一括投入・アップロードで上書きしない**
- 書き出し（Excel／CSV／.mer）の列選択に 4 列を足す（既定＝チェックなし）。経過は書き出し時点の「○年○か月」の文字。`export-sql.ts`・`export-format.ts`・`mer.ts` の 3 形式とも
- 「管理方法」タブの電話番号台帳の説明行に 3 列（元回線・契約時期・区分）の意味と導出のもとを 1 行ずつ足す

## 4. アップロード

- STEP 2 の中身の確認に「元回線：アナログ 500 件／フレッツ 500 件」（リスト名から導出した内訳）を出す
- STEP 3 の結果に「元回線を付けた n 件・区分を付けた n 件」を足す（`soil_list_apply_upload` の返り値に `line_type_set`・`category_set` を追加＝返り値の形が変わるので関数を drop → create）

## 5. テスト（vitest）
- 導出関数の TS 版は作らない（DB 関数が正）。代わりに **migration 文面のテスト**（既存の `*-migration.test.ts` の形）：3 関数・列 3 つ・索引・options 配列・apply_upload の変更点が SQL に含まれる
- 判定の言葉（法人語・屋号語・元回線の語）は SQL 内の配列定数から読んでテストで一覧化（言葉の増減が差分で見えるように）
- `search-sql.ts`：`contractMonth` の gte/lte が日付比較になる／`lineType`・`category` の in／inOrEmpty／並べ替え `contractMonth`
- `validation.ts`：新しい 3 列が許可される・古い条件（10 項目）はそのまま通る
- `ListMasterClient`：13 項目の描画・経過（年）の入力 → 条件（日付）への変換・要約に出る・区分セルの編集 → PATCH・書き出しの列選択に 4 列
- `export-format`／`mer`：4 列の出力（経過の文字列）
- 既存テスト（src/app/system/list・src/app/api/soil/list）は全部通す

## 6. 変えてはいけないもの
- 既存 10 項目の意味・初期条件・条件の JSON の形（新しい field を足すだけ）・保存済み条件の互換
- 台帳の他の列（AU光架電可否・アポ禁・購入状態・判定結果…）。**自社アポ禁は Codex-331 の範囲＝今回は触らない**
- 書き出しの上限なし・カーソル方式・記録
- アップロードの既存の規則（リスト名・投入日の更新／空欄だけ埋める／購入履歴は新規番号だけ）

## 7. 受け入れ基準
1. vitest（src/app/system/list・src/app/api/soil/list）が通る　2. `npx tsc --noEmit` に今回の変更由来のエラーが無い（既知の AppHeader 1 件は除く）　3. eslint（変更ファイル単位）が通る
4. Claude が：migration を本番に適用 → `soil_list_backfill_derived` を残り 0 まで → 実測（元回線の内訳・契約時期あり件数≒21.6 万・区分の内訳＝法人≒3,300／屋号≒2.1 万／個人）→ `soil_list_refresh_options()` → 画面で 元回線＝フレッツ＋経過 9 年以上 の件数・一覧・書き出し（3 形式）・区分の手直し → 9/14〜9/18 の 8 リストで STEP 2／3 の表示 → 分析タブ・受注履歴・毎朝の自動処理が壊れていないこと

## 8. 完了報告（コードブロックで出力）
- 「未コミット」と明記／変更・追加ファイルのフルパス／migration のパス／受け入れ基準 1〜3 の結果（実行したコマンドと結果）／本番データ・DB・Kintone・git に触っていないことの明記／④ と食い違った点（§10）

## 9. 画面文言（そのまま使う）
- 絞り込み：「元回線」「区分」「経過（年）」「年以上」「年以下」
- 一覧：「元回線」「契約時期」「経過」「区分」。区分の選択：「個人」「屋号」「法人」「（空欄）」
- 管理方法：「元回線＝リスト名（【光回線】アナログ／フレッツ／AU）→ 判定項目 → 購入先_NEW の順に決めた回線の種類」「契約時期＝購入日と経過月数から逆算した契約の年月（購入日が無い番号は空欄）」「区分＝氏名の言葉から自動で決めた個人／屋号／法人。一覧で直せます」

## 10. 既知の差分（Codex が追記する）
