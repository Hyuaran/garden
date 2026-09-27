# Codex-359 リストマスタ：一覧・件数を速くする／件数の「約」を外す／毎朝の処理を 2 本に分ける／集計列のずれを防ぐ／管理方法タブの件数を自動に／数え方の説明を足す

作成日: 2026-09-27
作業ツリー: C:\garden\a-bloom-008
起点: main の最新（`git log -1` で確認・完了報告に書く。作成時点は 371dfa3）
**git は触らないこと（commit するな）。本番のデータ・DB に触らないこと（索引の作成・migration の適用・ずれ 6 件の修復は Claude が DB 直結で行う）。開発サーバ・ブラウザを起動しないこと。触ってよいのは下の「触るファイル」だけ。**

必ず先に読むもの：
- ④ リストマスタ：C:\Claude\000_Garden\150_System_システム\00_マニュアル\14_リストマスタ\Garden_System_リストマスタ_4_仕様書_Claude読み込み用.md（§2-1 リスト・§2-4 管理方法・§3 データモデル・§4-1 条件と検索・§4-3 コール履歴の反映・§4-4 アップロード・§4-5 分析）
- 点検の記録：C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\010_Daily\2026-09-27\020_Claude\001_リストマスタ_分析集計の修復と速さ・数値の点検.md（§2 の計測表・§4 の案）
- 今のコード：`src/app/api/soil/list/_lib/search-sql.ts`（`buildWhereSql`／`buildSearchSql`／`buildCountSql`）・`count/route.ts`・`search/route.ts`・`analysis/cron/route.ts`・`analysis/_lib/analysis.ts`（`refreshListOptions`）・`src/app/system/list/_components/ListMasterClient.tsx`（件数表示 2576 行付近・分析の「定義」3099 行付近・`GUIDE_TABLE_ROWS` 444 行付近）・`MultiSelectFilter.tsx`・`src/app/system/list/_lib/list-fields.ts`（`DEFAULT_SOIL_LIST_CONDITION`）・`vercel.json`
- DB 関数 `soil_list_apply_upload`（**最新の定義は `supabase/migrations/20260917000007_soil_list_export_assignment.sql`**）と `soil_list_refresh_call_summary`（20260911000001）

## 0. 何が起きているか（2026-09-27 に Claude が本番で計測・画面と同じ SQL）
| 処理 | 時間 | 原因 |
|---|---|---|
| 件数：既定（AU○・アポ禁なし・自社アポ禁なし＝194 万件） | 7.5 秒 | 台帳 1GB をほぼ全部読む（Seq Scan） |
| 件数：既定＋購入先 Luna／コール回数 3 以下 | 7.4〜7.9 秒 | 同上・索引で 1 行ずつ引く |
| 一覧 1 ページ目：最終コール日の新しい順 | 7.0 秒 | `desc nulls last` に合う索引が無く全件並べ替え |
| **一覧 1 ページ目：既定＋大阪府（電話番号順）** | **111.6 秒** | 電話番号順の索引を 011 から歩いて大阪の番号を探す（12GB 読む）。**一覧は 60 秒で打ち切り＝画面ではエラー** |
| 件数：既定＋大阪府 | 0.06 秒 | 索引（都道府県, AU）が効く |

- 件数 API は常に `count(*)` で**正確に数えている**のに、`approximate: elapsedMs > 5000` で 5 秒を超えると画面に「約」が付く（誤解を招く）
- 毎朝 6:45 の cron（`analysis/cron`）は分析（約 160 秒）＋選択肢の作り直し（約 100 秒）＝約 260 秒で、上限 300 秒に近い
- 電話番号台帳の `コール回数合計`／`最終コール日_集約` がコール履歴とずれている番号が 6 件。原因＝**アップロードで台帳に新しく追加した番号に、既にあるコール履歴からの集計列を入れていない**（`soil_list_apply_upload` の `insert into public.soil_list_phone` はコール集計列を入れない）
- 管理方法タブの「件数の目安」が固定の文字（`GUIDE_TABLE_ROWS` の `count: "約 267 万件"` など）

## 1. 直し方
### A. 一覧：条件で絞れるときは「先に絞ってから並べる」（`search-sql.ts`・`search/route.ts`）
- 検索の前に見込み件数を取る：`explain (format json) select 1 from soil_list_phone <where>`（同じ where・同じ値）→ 先頭の `Plan Rows`。数 ms で返る
- **見込み件数 < 300,000**（定数 `FILTER_FIRST_THRESHOLD = 300_000`・list-fields か search-sql に置く）のとき：
  ```
  with m as materialized (
    select ctid as _rid, <並べ替えに使う列（同じ列名のまま）>
    from soil_list_phone <where>
  ), k as (
    select _rid from m order by <今と同じ order by> limit 100 offset <offset>
  )
  select <今と同じ select 列> from soil_list_phone p join k on p.ctid = k._rid
  order by <今と同じ order by>
  ```
  - 電話番号が空の行（約 9.8 万行）もあるので、結合は**電話番号ではなく ctid**で行う
  - 並べ替えの結果（順番・同順位の並び＝`… nulls last, "電話番号" asc`）は今とまったく同じにする
- **見込み件数 ≥ 300,000** のとき：今の SQL のまま（電話番号順の索引を歩く方が速い）
- 見込みの取得に失敗したら今の SQL にフォールバック
- `buildSearchSql` は「絞ってから並べる版」と「今の版」を返せるようにし、route で見込み件数を見て選ぶ（テストしやすいよう、SQL を作る関数は純粋関数のまま）

### B. 既定条件の 3 つは SQL に定数で書く（部分索引を確実に使わせる）
- Claude が本番に**既定条件専用の部分索引**（`where "AU光架電可否" = '○' and ("アポ禁" is null or "アポ禁" = '') and "自社アポ禁" = false`・絞り込みに使う短い列を INCLUDE）を作る。Postgres がこの索引を使えると判断するには、where に**同じ定数**が書かれている必要がある（`$1` のままだと汎用の計画で使われないことがある）
- `filterToSql`：次の 3 つに**完全一致**するときだけ、値をパラメータにせず SQL の定数で出す
  - `auCallAvailability` の `eq` で値が `'○'` → `"AU光架電可否" = '○'`
  - `appointmentBlocked` の `empty` → 今のまま（既に定数）
  - `internalBlocked` の `eq` で値が `false` → `"自社アポ禁" = false`（`true` も定数で `= true` にしてよい）
  - それ以外は今どおりパラメータ。count／search／export の where は `buildWhereSql` 1 つを共有しているので、ここだけ直せば 3 つとも効く
- **索引の作成そのものは Claude がやる**。Codex は下の migration ファイルに記録として書くだけ（§2）

### C. 件数の「約」を外す（`count/route.ts`・`ListMasterClient.tsx`）
- `count/route.ts`：`approximate` を返さない（DB 直結・REST の両方）。返り値は `{ ok, count, elapsedMs }`
- 画面：`approximate` の state と「約 」の表示をやめる。表示は「該当 1,945,619 件（0.4 秒）」「一覧（1,945,619 件・個人情報は一部伏せる）」

### D. 最終コール日の新しい順を速くする（索引は Claude が作る）
- 索引 `("最終コール日_集約" desc nulls last, "電話番号")` を Claude が作る。コード側の並べ替えの SQL は今のままでよい（`order by "最終コール日_集約" desc nulls last, "電話番号" asc`）。migration ファイルに記録として書く

### E. 毎朝の処理を 2 本に分ける（`vercel.json`・cron の route）
- `analysis/cron/route.ts`：**分析だけ**（`refreshAnalysis`）。失敗で 500・成功で 200。選択肢の作り直しの呼び出しは外す
- 新規 `src/app/api/soil/list/options/cron/route.ts`（GET・`verifyBearerRequest(request, "CRON_SECRET")`・`runtime = "nodejs"`・`dynamic = "force-dynamic"`・`maxDuration = 300`）：
  1. `refreshListOptions()`（今の関数をそのまま）
  2. 続けて **5 つの表の件数を数えて保存**（§F）
  - 返り値 `{ ok, optionsRefreshed, optionsRefreshError?, tableCountsRefreshed, tableCountsError? }`。どちらかが失敗なら 500。**選択肢が失敗しても件数は数える**（逆も）
- `vercel.json` の crons に `{ "path": "/api/soil/list/options/cron", "schedule": "55 21 * * *" }`（日本時間 6:55）を足す。分析は今の `45 21 * * *` のまま
- 画面の文言「選択肢の件数は翌朝 6:45 に更新されます」→「翌朝 6:55」

### F. 管理方法タブの件数を実データから自動で
- 新しい表（migration）：
  ```
  create table if not exists public.soil_list_table_count (
    table_name text primary key,          -- soil_list_phone / soil_list_purchase / soil_list_assignment / soil_list_call / soil_list_order
    row_count bigint not null,
    counted_at timestamptz not null default now()
  );
  alter table public.soil_list_table_count enable row level security;
  grant all on public.soil_list_table_count to service_role;
  ```
  （ほかの soil_list_* と同じ形＝RLS 有効・ポリシーなし・service_role だけ）
- 数え方（`analysis/_lib/analysis.ts` か新しい `_lib/table-counts.ts` に `refreshTableCounts()`）：DB 直結で 1 本の接続・`set statement_timeout = '240s'`・5 つの表それぞれ `select count(*)::bigint from public.<表>`（表名は固定の配列から。ユーザー入力は入れない）→ `insert … on conflict (table_name) do update set row_count = excluded.row_count, counted_at = now()`
- 読む API：新規 `GET src/app/api/soil/list/table-counts/route.ts`（`requireSoilListUser`・`{ ok, counts: { phone, purchase, assignment, call, order }, countedAt }`・countedAt は 5 つのうち一番古い時刻）。`DATABASE_URL` が無い環境は REST（`from("soil_list_table_count").select(...)`）でよい
- 画面：`GUIDE_TABLE_ROWS` の `count` を固定文字から、表名のキーに変える（例 `countKey: "phone"`）。管理方法タブを開いたときに table-counts を 1 回読み、表示を作る関数 `formatApproxCount(n)`：
  - 100,000 以上 → `約 267 万件`（万の位で四捨五入）
  - 10,000 以上 100,000 未満 → `約 3.9 万件`（小数 1 桁）
  - 10,000 未満 → `約 9,800 件`（百の位で四捨五入）／0 → `0 件`
  - まだ数えていない・読めない → `集計待ち`（エラー文言は開発者用語を出さない）
- 表の上（h2 の下）に 1 行：`件数：2026/09/28(月) 06:55 時点（毎朝 6:55 に数え直します）`（`formatJstWithWeekday` を使う）

### G. 集計列のずれを防ぐ（migration・`soil_list_apply_upload`）
- 新しい migration で `create or replace function public.soil_list_apply_upload(p_upload_id uuid, p_limit integer default 1000)` を置き換える。**本体は 20260917000007 の定義をそのまま写し**、変えるのは次の 1 点だけ（引数・返り値の形は変えない＝`create or replace` で置き換えられる）：
  - 台帳への新規追加（`insert into public.soil_list_phone … from soil_list_upload_new_phone n; get diagnostics v_parent_inserted = row_count;`）の**直後**に、新規追加した番号のコール集計列をコール履歴から入れる：
  ```
  update public.soil_list_phone p
  set "コール回数合計" = s.total,
      "最終コール日_集約" = s.last_day,
      "最終コール結果" = s.last_result
  from (
    select c."電話番号",
           sum(coalesce(c."コール回数", 0))::integer as total,
           max(c."最終コール日") as last_day,
           (array_agg(c."最終結果" order by c."最終コール日" desc nulls last, c.ctid desc))[1] as last_result
    from public.soil_list_call c
    join soil_list_upload_new_phone n on n."電話番号" = c."電話番号"
    group by c."電話番号"
  ) s
  where s."電話番号" = p."電話番号";
  ```
  （集計の式は `soil_list_refresh_call_summary` の台帳更新部分と同じ。`soil_list_refresh_call_summary` そのものは呼ばない＝反映状態 `soil_list_call_sync_state` を書き換えてしまうため）
  - `revoke`／`grant execute … to service_role` は今の migration と同じ行を末尾に
- 既にずれている 6 件は **Claude が DB 直結で同じ update を流して直す**（Codex は触らない）

### H. 数え方の説明を画面に足す（`ListMasterClient.tsx`・`MultiSelectFilter.tsx`）
- 分析タブの「定義」（`<details className={styles.definitionBox}>`）に 2 行足す：
  - 「受注は、電話番号台帳にある番号に付いた受注だけを数えます。携帯番号だけのお客様など、台帳に無い番号の受注は入りません。」
  - 「① どこから購入したか：購入先で絞ると『その購入先で一度でも買った番号』、絞らない表は『いちばん新しい購入先』で数えます。同じ購入先でも数が違うことがあります。」
- ①の見出し横の「？」（`analysisAxisHelp`）にも 2 行目と同じ趣旨を 1 行足す
- リストタブの選択式の絞り込み（都道府県・購入先・区分・購入状態・元回線・アポ禁・AU光架電可否など、件数つきで開くもの）のパネルの下に、薄い文字で 1 行：「（ ）内は台帳全体の件数です（毎朝 6:55 更新）。ほかの絞り込みをかけた件数とは違います。」
  - `MultiSelectFilter` に任意の `countNote?: string` を足し、あるときだけ `<p className={styles.muted}>` で出す。リストタブの呼び出しからだけ渡す（分析タブの購入先の絞り込みには出さない）

## 2. 触るファイル
- `src/app/api/soil/list/_lib/search-sql.ts`・`_lib/search-sql.test.ts`
- `src/app/api/soil/list/search/route.ts`（＋テストが無ければ新規 `search/route.test.ts`）
- `src/app/api/soil/list/count/route.ts`・`count/route.test.ts`
- `src/app/api/soil/list/analysis/cron/route.ts`・`analysis/_lib/analysis.ts`（または新規 `_lib/table-counts.ts`）・関係するテスト
- 新規 `src/app/api/soil/list/options/cron/route.ts`（＋テスト）・新規 `src/app/api/soil/list/table-counts/route.ts`（＋テスト）
- `src/app/system/list/_components/ListMasterClient.tsx`・`ListMasterClient.test.tsx`・`MultiSelectFilter.tsx`・`src/app/system/list/_lib/list-fields.ts`（定数を置く場合）
- `vercel.json`
- 新規 migration 2 本：
  - `supabase/migrations/20260928000001_soil_list_speed_indexes.sql`（**記録用**。先頭にコメント「本番は Claude が `create index concurrently` で作成済み。トランザクションの外で流すこと」。中身は下の 2 本を `create index concurrently if not exists` で。INCLUDE の列は Claude が計測後に決めた形を完了後に書き直すので、ここは下の案のままでよい）
    - `soil_list_phone_default_cover_idx on public.soil_list_phone ("住所_都道府県") include ("最新購入先", "元回線", "契約時期", "コール回数合計", "最終コール日_集約", "購入状態", "区分") where "AU光架電可否" = '○' and ("アポ禁" is null or "アポ禁" = '') and "自社アポ禁" = false`
    - `soil_list_phone_last_call_desc_idx on public.soil_list_phone ("最終コール日_集約" desc nulls last, "電話番号")`
  - `supabase/migrations/20260928000002_soil_list_table_count_and_upload_call_summary.sql`（§F の表＋§G の関数）

## 3. テスト（vitest・全部緑にしてから完了報告）
- search-sql：見込み件数が閾値未満 → `with m as materialized` の形・ctid で結合・order by が今と同じ／閾値以上 → 今の SQL と同じ文字列／既定条件 3 つが定数で出る（`'○'`・`false`）・それ以外の値はパラメータのまま
- search route：`explain` の Plan Rows で分岐する・`explain` が失敗したら今の SQL で返す
- count route：`approximate` を返さない
- 分析 cron：選択肢の作り直しを呼ばない・分析の成否で 200／500
- options cron：選択肢が失敗しても件数を数える・どちらか失敗で 500・鍵が違えば 401
- table-counts：`formatApproxCount` の境目（0／9,849／9,850／10,000／39,000／99,999／100,000／2,675,537）・未集計で「集計待ち」
- 画面：件数表示に「約」が出ない・管理方法タブが API の件数と時刻を出す・分析の定義に 2 行・選択肢パネルの下の説明文（リストタブだけ）
- migration の文字列テスト（既存の `*-migration.test.ts` と同じ形）：`soil_list_apply_upload` に新規追加の直後の集計列の update がある・`soil_list_table_count` の RLS と grant
- `npx tsc --noEmit`・`npx eslint`（触ったファイル）

## 4. 画面の絵
### リストタブ（検索後に畳んだ行）
```
今：  該当 約 1,945,619 件（7.6 秒）  AU光架電可否：○／アポ禁：空欄 …   ［条件を変える］［条件を保存］
後：  該当 1,945,619 件（0.4 秒）     AU光架電可否：○／アポ禁：空欄 …   ［条件を変える］［条件を保存］
```
### 選択式の絞り込み（開いたパネル）
```
┌ 都道府県 ─────────────────────── ［すべて選ぶ］［閉じる］┐
│ □北海道（98,120） □青森県（12,004） …                      │
│ □大阪府（231,556） …                                         │
│ （ ）内は台帳全体の件数です（毎朝 6:55 更新）。             │  ← 新しい 1 行（薄い文字）
│ ほかの絞り込みをかけた件数とは違います。                    │
└──────────────────────────────────────────┘
```
### 管理方法タブ
```
リストマスタのデータの持ち方
件数：2026/09/28(月) 06:55 時点（毎朝 6:55 に数え直します）     ← 新しい 1 行
┌────────┬──────────┬──────────┬────…
│ 名前       │ 1 行の単位          │ 件数の目安 │
│ 電話番号台帳 │ 電話番号 1 件        │ 約 268 万件 │  ← 実データから
│ 購入履歴     │ 電話番号×購入先×購入日 │ 約 242 万件 │
│ 投入履歴     │ 電話番号×リスト名     │ 約 4.1 万件 │
│ コール履歴   │ 電話番号×リスト名     │ 約 119 万件 │
│ 受注履歴     │ 受注 1 件            │ 約 2.1 万件 │
```
### 分析タブの「定義」（開いたとき）
```
▼ 定義
  件数＝その区切りに入る電話番号の数。…（今の 4 行）
  受注は、電話番号台帳にある番号に付いた受注だけを数えます。…          ← 新しい
  ① どこから購入したか：購入先で絞ると『その購入先で一度でも買った番号』… ← 新しい
```

## 5. 完了報告（コードブロックで・コピーできる形）
- 起点の main のコミット／変えたファイル／テスト本数と結果／tsc・eslint の結果
- 一覧の分岐の閾値と、見込み件数の取り方
- migration 2 本のファイル名（Claude が本番に適用する）
- 気づいた点・やり残し
