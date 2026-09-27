# Codex-358 リストマスタ：分析集計（毎朝 6:45）を DB 直結で回し、8 秒の打ち切りで止まらないようにする＋選択肢の作り直しを分析の成否と切り離す

作成日: 2026-09-27
作業ツリー: C:\garden\a-bloom-008
起点: main の最新（`git log -1` で確認・完了報告に書く）
**git は触らないこと（commit するな）。本番のデータ・DB に触らないこと。開発サーバ・ブラウザを起動しないこと。migration は不要（DB の関数はそのまま使う）。触ってよいのは下の「触るファイル」だけ。**

必ず先に読むもの：
- ④ リストマスタ：C:\Claude\000_Garden\150_System_システム\00_マニュアル\14_リストマスタ\Garden_System_リストマスタ_4_仕様書_Claude読み込み用.md（§4-5 分析・§9 落とし穴「REST は 8 秒で打ち切り」）
- 今のコード：`src/app/api/soil/list/analysis/_lib/analysis.ts`（`refreshAnalysis`＝`db.rpc("soil_list_analysis_begin")` → `collect(p_chunk, 100)` × 100 → `finish`。**REST 経由**。`refreshListOptions`＝DB 直結で `set local statement_timeout = '240s'`）／`analysis/cron/route.ts`／`analysis/refresh/route.ts`（画面の丸い矢印・`requireSoilListUser`）／`src/lib/db/pg.ts`（`getPgPool`・接続ごとに 60s）
- 表 `soil_list_analysis_state`（`refreshed_at`／`last_elapsed_ms`／`last_error`／`rows`／`updated_at`）と関数 `soil_list_analysis_begin／collect／finish`（migration 20260913000001・20260916000001・20260917000006）

## 0. 何が起きているか（2026-09-26 朝に Claude が確認）
- `soil_list_analysis_state.last_error = "canceling statement due to statement timeout"`、`refreshed_at = 2026-09-15`、`updated_at = 2026-09-24 21:46`＝**9/16 から毎朝失敗**している。原因＝`collect` を REST（Supabase の 8 秒制限）で呼んでいて、9/16 に block を 3 倍にしてから 1 回が 8 秒を超えることがある
- 分析タブの数字は 9/15 のまま。Codex-352 で足した「選択肢の作り直し」も、分析が先に例外で落ちるため cron が 500 を返して実行されない（`soil_list_option.refreshed_at = 2026-09-17`）

## 1. 直し方
### A. `refreshAnalysis` を DB 直結にする
- `getPgPool().connect()` で 1 本の接続を取り、`begin` → `set local statement_timeout = '240s'` → `select public.soil_list_analysis_begin()` → `select public.soil_list_analysis_collect($1, $2)` を `p_chunk = 0..99`（`p_chunks = 100`）で順に → `select public.soil_list_analysis_finish($1)`（`p_started_at`）→ `commit`。途中で失敗したら `rollback` し、**今と同じく** `saveAnalysisFailure` で `last_error` を残して throw。必ず `release`
- 1 本のトランザクションにまとめてよいか確認：`begin()`／`collect()`／`finish()` の中身が一時表や `soil_list_analysis_cell_next` への書き込みで、同一トランザクション内で完結するなら 1 本で。**関数の中に `commit` や advisory lock・別トランザクション前提の処理があれば、`begin`／各 `collect`／`finish` をそれぞれ独立した文（オートコミット）として同じ接続で流し、`statement_timeout` は接続に対して `set statement_timeout = '240s'`（`set local` ではなく）を最初に 1 回**。どちらにしたか・理由を完了報告に書く
- 返り値（`RefreshResult`）・`clearAnalysisCache()`・`saveAnalysisFailure` の呼び方は今と同じ。REST の `AnalysisDb` 引数は残してよい（`saveAnalysisFailure` で使う）が、`begin/collect/finish` は REST で呼ばない
- `DATABASE_URL` が無い環境（テスト）では、従来どおり `db.rpc` 経由にフォールバック（`hasDatabaseUrl()` で分岐）＝既存テスト（`analysis/route.test.ts` の mock）を壊さない。**ただしテストに DB 直結の経路も足す**（`getPgPool` を mock して、`collect` が 100 回・`finish` が 1 回呼ばれる／途中失敗で rollback と `saveAnalysisFailure`）

### B. 選択肢の作り直しを分析の成否と切り離す（cron）
- `analysis/cron/route.ts`：`refreshAnalysis` を try/catch で囲み、**失敗しても `refreshListOptions()` を必ず実行**。レスポンスは `{ ok, analysis: { ok: true, ...result } | { ok: false, error }, optionsRefreshed, optionsRefreshError? }`。分析・選択肢のどちらかが失敗なら HTTP 500（Vercel の cron 履歴で気づけるように）、両方成功で 200
- `analysis/refresh/route.ts`（画面の丸い矢印）はそのまま `refreshAnalysis` だけ（選択肢は毎朝でよい）

### C. 記録
- `soil_list_analysis_state` に成功時 `last_error = null` を入れる（今の `finish()` がそうしていなければ TS 側で `update`）。失敗時は今どおり

## 2. 触るファイル
- `src/app/api/soil/list/analysis/_lib/analysis.ts`・`src/app/api/soil/list/analysis/cron/route.ts`・`src/app/api/soil/list/analysis/route.test.ts`（または新規の `_lib/analysis-refresh.test.ts`）

## 3. テスト（vitest・全部緑にしてから完了報告）
- DB 直結の経路：`collect` 100 回・`finish` 1 回・`statement_timeout` の文が最初に流れる／途中失敗で rollback・release・`saveAnalysisFailure`・throw
- `DATABASE_URL` 無し：従来の REST 経路（既存テストが緑のまま）
- cron：分析が失敗しても `refreshListOptions` が呼ばれ、500 と `analysis.ok=false`・`optionsRefreshed` を返す／両方成功で 200

## 4. 完了報告（コードブロックで・コピーできる形）
- 起点の main のコミット／変えたファイル／テスト本数と結果／tsc・eslint の結果
- 1 本のトランザクションにしたか・分けたか（理由）
- 気づいた点・やり残し
