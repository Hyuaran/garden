# Codex-352 リストマスタ：書き出しは「検索した条件」で行う（保存条件を読み込んだ後の全件扱いを直す）＋ 選択肢の件数の作り直しを毎朝の集計へ移す

作成日: 2026-09-24
作業ツリー: C:\garden\a-bloom-008
起点: main の最新（`git log -1` で確認・完了報告に書く）
**git は触らないこと（commit するな）。本番のデータ・DB に触らないこと。開発サーバ・ブラウザを起動しないこと。migration は不要（DB の関数はそのまま使う）。触ってよいのは下の「触るファイル」だけ。条件 JSON の形・API の入出力の形は変えない。**

必ず先に読むもの：
- ④ リストマスタ：C:\Claude\000_Garden\150_System_システム\00_マニュアル\14_リストマスタ\Garden_System_リストマスタ_4_仕様書_Claude読み込み用.md（§2-1 リスト・§4-1 条件（JSON）・§4-2 書き出し・§4-5 分析・§9 落とし穴「REST は 8 秒で打ち切り」）
- 今のコード：
  - `src/app/system/list/_components/ListMasterClient.tsx`：`condition`（`filtersToCondition(filters)` の useMemo）・`runListSearch`（`nextCondition`）・`handleLoadCondition`・`conditionToFilters`・`executeExport`／`handleExport`（`downloadExport({ condition, … })`）・`describeFilters`
  - `src/app/api/soil/list/export/route.ts`：`recordExportAssignment`（末尾で `db.rpc("soil_list_refresh_options")`）
  - `src/app/api/soil/list/uploads/route.ts`：`refreshOptions`
  - `src/app/api/soil/list/uploads/[id]/apply/route.ts`：`db.rpc("soil_list_refresh_options")`
  - `src/app/api/soil/list/analysis/cron/route.ts`・`src/app/api/soil/list/analysis/_lib/analysis.ts`（`refreshAnalysis`）
  - `src/lib/db/pg.ts`（`queryPg`・接続ごとに `statement_timeout = '60s'`）

## 0. 何を直すか（東海林さん 2026-09-16 報告の不具合＋2026-09-17 の申し送り）

### A. 不具合：保存した条件を読み込んでから書き出すと、件数は合っているのに書き出しが「全件」になる

**再現**：保存条件に、画面の絞り込みフォームに無い条件（例：電話番号＝1 件だけ `{"field":"phoneNumber","op":"eq","value":"0247542485"}`）が入っている → ［保存した条件］から読み込む → 件数「1 件」と一覧 1 行が出る → 「FileMaker 取込用（19 列）」で書き出す → **「Excel は 1,048,576 行までです」（400）**。CSV／.mer なら 267 万件が出る。

**原因（コードで確認済み）**：
- `handleLoadCondition` は `conditionToFilters(item.condition)` で**フォームに載せられる条件だけ**を `filters` に戻し、検索は `runListSearch({ nextCondition: item.condition })` で**読み込んだ条件そのもの**を使う → 件数・一覧は正しい
- ところが書き出し（`executeExport`）は `condition`（＝`filtersToCondition(filters)` の useMemo）を送る → フォームに載らなかった条件が落ちて**空の条件＝全件**になる
- `conditionToFilters` は `isOptionFilterField` の欄と日付・回数・リスト名・区分などだけを扱う。`phoneNumber` など「フォームに無い欄」は捨てられる

**直し方（画面だけ・API は変えない）**：
1. 「**最後に検索した条件**」を state に持つ（例 `searchedCondition: SoilListConditionPayload | null`）。`runListSearch` が成功したら `nextCondition` をそこへ入れる
2. 書き出し（`executeExport`・書き出し前の件数チェック・自社アポ禁の除外数の表示など、`condition` を API に送っている箇所）は**すべて `searchedCondition` を送る**。`searchedCondition` が null（まだ検索していない）なら今どおり「先に検索してください」
3. 絞り込みフォームを変えて［検索］を押したときは、今までどおり `filtersToCondition(filters)` で検索し、それが `searchedCondition` になる（＝動きは変わらない）
4. 「条件を変える」に畳んだあとの要約文（`describeFilters`）は、フォームに載らない条件が `searchedCondition` にあるときは、その分も日本語で足す（例：「電話番号：0247542485」。欄名は `src/app/system/list/_lib/list-fields.ts` の日本語名を使い、`op` は eq＝「＝」／in＝「のいずれか」／contains＝「を含む」／gte＝「以上」／lte＝「以下」／empty＝「（空欄）」）。営業が「何で絞られているか」を見失わないため
5. フォームを触って（値を変えて）まだ［検索］を押していない間は、書き出しボタンの近くに小さく「**絞り込みを変えました。［検索］を押すと書き出しに反映されます**」と出す（`filtersToCondition(filters)` と `searchedCondition` の JSON が違うとき）。ボタンは押せるままでよい（押したら `searchedCondition` で書き出す）

```
 絞り込み                                              [条件を保存]
 （…フォーム…）                                         [  検索  ]
 ─────────────────────────────────────────────────────────────
 1 件（0.4 秒）   書き出し：[FileMaker 取込用（19 列）▼] [書き出す]
                 絞り込みを変えました。［検索］を押すと書き出しに反映されます   ← 5. のとき
 条件：電話番号：0247542485                                          ← 4. の要約
```

### B. 「選択肢の件数の作り直し」（`soil_list_refresh_options`・本番で約 100 秒）を、書き込みのたびに呼ぶのをやめて毎朝の集計に移す

**今**：FileMaker 取込用の書き出し（投入履歴に記録）・アップロードの登録・「反映をやり直す」の末尾で `db.rpc("soil_list_refresh_options")` を呼ぶ → REST は 8 秒で打ち切られるので毎回失敗し、結果に `warning: "選択肢の件数を更新できませんでした"` が付く（本体の登録は成功している）。

**直し方**：
1. 上の 3 か所の `soil_list_refresh_options` 呼び出しを**外す**（warning も出さない）。結果の型に `warning` が残っていても、そこでは入れない
2. 毎朝の集計 `GET /api/soil/list/analysis/cron`（cron 21:45 UTC＝6:45 JST・`maxDuration = 300`）で、`refreshAnalysis` が終わったあとに **DB 直結で** `select public.soil_list_refresh_options()` を実行する。`queryPg` は接続ごとに `statement_timeout = '60s'` なので、**同じトランザクションで `set local statement_timeout = '240s'` を先に流してから呼ぶ**（`queryPg` は 1 文ずつなので、`getPgPool().connect()` で client を取り、`begin` → `set local …` → `select …` → `commit`、失敗したら `rollback`、必ず `release`）。`DATABASE_URL` が無い環境（テスト）では呼ばない（`hasDatabaseUrl()`）
3. 選択肢の作り直しが失敗しても**分析集計の結果は返す**（cron のレスポンスに `optionsRefreshed: true/false` と失敗時のメッセージを足す）。分析集計が失敗したときは今どおり 500
4. 画面：アップロードタブと FileMaker 取込用の書き出しの完了メッセージに「選択肢の件数は翌朝 6:45 に更新されます」を 1 行足す（既存の文の末尾でよい）。リストタブの選択肢の「（件数）」の近くに既に注記があればそれに合わせる

## 1. 触るファイル
- `src/app/system/list/_components/ListMasterClient.tsx`（A の 1〜5・B の 4）と `list-master.module.css`（注記の見た目が要れば）
- `src/app/api/soil/list/export/route.ts`・`src/app/api/soil/list/uploads/route.ts`・`src/app/api/soil/list/uploads/[id]/apply/route.ts`（B の 1）
- `src/app/api/soil/list/analysis/cron/route.ts`・`src/app/api/soil/list/analysis/_lib/analysis.ts`（B の 2・3。関数を足すなら `_lib` に）
- 上記のテスト（`src/app/system/list` と `src/app/api/soil/list` 配下）

## 2. テスト（vitest・全部緑にしてから完了報告）
- A：`phoneNumber eq` を含む保存条件を読み込む → 件数 API と検索 API にその条件が送られる → 書き出し API にも**同じ条件**が送られる（`condition.filters` に `phoneNumber` が入っている）
- A：読み込み後にフォームの都道府県を変えて［検索］を押さずに書き出すと、書き出し API には**直前に検索した条件**が送られ、注記「絞り込みを変えました…」が出ている
- A：要約文にフォームに無い条件（電話番号：…）が出る
- B：書き出し（fm_import・記録あり）・アップロード登録・反映やり直しで `soil_list_refresh_options` が**呼ばれない**（既存テストの mock を直す）
- B：analysis cron が `refreshAnalysis` の後に選択肢の作り直しを呼び、失敗しても 200 で `optionsRefreshed: false` を返す（`DATABASE_URL` 無しでは呼ばれない）

## 3. 完了報告（コードブロックで・コピーできる形）
- 起点の main のコミット／変えたファイル一覧／テスト本数と結果／tsc・eslint の結果
- A で `searchedCondition` を送るように変えた箇所の一覧（関数名）
- B で外した呼び出し 3 か所と、cron に足した処理の場所（関数名）
- 気づいた点・やり残し
