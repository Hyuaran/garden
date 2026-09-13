# Codex-321 リストマスタの書き出し：上限なし・形式は Excel／CSV／.mer から選ぶ・書き出し中は全画面のくるくる

作成日: 2026-09-13
作業ツリー: C:\garden\a-bloom-008
起点: main（Codex-320 の取り込み後。`git log -1` の値を完了報告に書く）
**git は触らないこと（commit するな）。本番のデータに触らないこと。開発サーバ・ブラウザを起動しないこと。migration は「書くだけ」（実行しない）。**

必ず先に読むもの：
- ④正本：C:\Claude\000_Garden\150_System_システム\00_マニュアル\14_リストマスタ\Garden_System_リストマスタ_4_仕様書_Claude読み込み用.md（§4-2 .mer の仕様・§5 API・§9 落とし穴）
- 今の書き出し：src/app/api/soil/list/export/route.ts（.mer 1 種・上限 5,000／最大 50,000・記録 `soil_list_export` に phone_numbers を保存・再ダウンロード）・_lib/mer.ts（cp932・置き換え文字の数え方）・exports/route.ts・画面の「書き出し」セクション（ListMasterClient.tsx）
- **Codex-320 が作ったもの**：src/lib/db/pg.ts（DB 直結の Pool・`DATABASE_URL`）・src/app/api/soil/list/_lib/search-sql.ts（条件 → SQL・並べ替え）・src/app/system/list/_components/ListProcessingOverlay.tsx（全画面くるくる）
- Excel は既にある `exceljs`（package.json）を使う。**新しいライブラリを足さない**（`pg` は 320 で追加済み）

## 0. 何を直すか（東海林さん 2026-09-13）

- 書き出しに**上限を付けない**。絞り込んだものを全部書き出す
- 形式は **Excel（.xlsx）／CSV／.mer** から選び、［書き出す］を押す
- 書き出し中は**全画面のくるくる**（「{件数}件を{形式}で書き出しています…」＋「この画面を閉じないでください」）

```
▼ 書き出し（一覧の下）
┌ 書き出し ─────────────────────────────────────────────────────┐
│ 列：☑電話番号 ☑氏名 ☑氏名カナ ☑郵便番号 ☑都道府県 ☑市区町村 ☑町名 ☑番地 ☐携帯番号 ☑リスト名 ☑投入日 ☑データ出所 │
│ 並び [リスト投入日が古い順 ▼]   形式 ( ) Excel  (•) CSV  ( ) .mer      [ 12,563 件を書き出す ] │
│ ※ Excel は 1,048,576 行まで（Excel の上限）。それを超えるときは CSV か .mer を選んでください         │
│ ─ 書き出しの記録 ─ 9/13 16:40 東海林 美琴 12,563 件 CSV [再ダウンロード] …                          │
└──────────────────────────────────────────────────────────────┘
```

## 1. 決まりごと

| 項目 | 決まり |
|---|---|
| 件数 | 上限なし。ボタンには「{該当件数}件を書き出す」と出す（検索がまだなら押せない） |
| Excel | **1,048,576 行が Excel 自体の上限**（見出し 1 行を含めて 1,048,575 件まで）。該当件数がそれを超えるときは Excel を選べなくし、注意書きを出す |
| CSV | UTF-8（BOM 付き・Excel で開いても文字化けしない）・CRLF・全列を `"` で囲む・見出し行あり |
| .mer | 今のまま（cp932・CRLF・全引用符・置き換え文字の数え方も同じ） |
| 列・並び | 今のチェック（`SOIL_LIST_EXPORT_COLUMNS`）と並び（`SOIL_LIST_SORT_OPTIONS`）をそのまま使う |
| ファイル名 | `リストマスタ_YYYYMMDD_HHMM.xlsx／.csv／.mer` |
| 記録 | `soil_list_export` に形式（`format`）を足す。`phone_numbers` は**5 万件まで**保存し、それを超えるときは条件・件数・列・並びだけ保存（`phone_numbers` は空）。再ダウンロードは phone_numbers があるときは今のとおり番号で、無いときは**保存した条件と並びで作り直す**（件数が変わることがあるので、記録の行に「条件で作り直し」と出す） |
| 権限 | 今のまま（manager 以上） |

## 2. 作り方（大きい件数でも止まらないように）

- **API `POST /api/soil/list/export`** は Supabase REST でなく **DB 直結（src/lib/db/pg.ts）で流しながら返す**：`pg-cursor` は足さず、`select … order by … limit 5000 offset n` を繰り返す（`search-sql.ts` の条件・並びをそのまま使い、5,000 行ずつ）。1 束ごとにファイルの続きを書き、`ReadableStream` でそのまま返す（全部をメモリに溜めない）。`maxDuration = 300`
  - Excel：`exceljs` の **`stream.xlsx.WorkbookWriter`**（行を `commit()` しながら書く）
  - CSV／.mer：行ごとに文字列にして encode（.mer は cp932）。`Content-Disposition` は今と同じ形（`filename*=UTF-8''…`）
  - 先に件数を数え（count と同じ条件）、Excel で上限超なら 400「Excel は 1,048,576 行までです。CSV か .mer を選んでください」
  - 応答ヘッダに件数（`X-Soil-List-Row-Count`）と置き換え文字数（.mer のみ）を今のとおり付ける。**ストリーミングでは最後まで読まないと件数が確定しない**ので、先に数えた件数をヘッダに入れる
- **画面**：形式のラジオ 3 つ・［{n}件を書き出す］・くるくる（`ListProcessingOverlay`：`count`＝該当件数・`action`＝「Excel で書き出し」「CSV で書き出し」「.mer で書き出し」→ 文は「12,563件を CSV で書き出しています…」）。fetch → blob → ダウンロード（今の流れ）。成功・失敗とも `finally` で閉じる。終わったら「12,563 件を CSV で書き出しました」と記録を読み直す
- **時間の目安を出す**：該当件数が 10 万件を超えるときは、押す前に「約 {件数} 件を書き出します（目安 {件数÷20,000 を切り上げ} 分）。よろしいですか」の確認を出す（Vercel の 1 回の上限は 5 分。5 分で終わらない件数（目安 500 万件超）は今のデータ量では起きない）
- 「上限」の入力欄は消す。`normalizeExportLimit`・`DEFAULT_EXPORT_LIMIT`・`MAX_EXPORT_LIMIT` は API 互換のため残してよいが画面からは使わない

## 3. migration（書くだけ）`supabase/migrations/20260913000004_soil_list_export_format.sql`
- `soil_list_export` に `format text not null default 'mer' check (format in ('xlsx','csv','mer'))` を足す。`phone_numbers` は null 可のまま（5 万件超は空配列でなく null）

## 4. テスト
- CSV：BOM・CRLF・引用符・`"` のエスケープ（`""`）・見出し
- Excel：WorkbookWriter で n 行書けて開ける（小さい件数で実ファイルを作り exceljs で読み戻す）
- .mer：今のテストがそのまま通る（cp932・置き換え文字数）
- API：形式の選択／Excel 上限超は 400／5,000 行ずつ取りに行く（モックで offset の列を確認）／記録に format と 5 万件超で phone_numbers が null／再ダウンロードの 2 通り
- 画面：ラジオ・ボタンの文言・くるくるが開いて閉じる（失敗でも閉じる）・10 万件超の確認
- 既存テスト（src/app/system/list・src/app/api/soil/list）は全部通す

## 5. 変えてはいけないもの
- .mer の中身（FileMaker が読む形。§4-2）
- 条件・並びの意味（Codex-320 の search-sql.ts と同じ SQL を使う）
- 個人情報の扱い：書き出しは伏せ字にしない（今のとおり）。記録の閲覧権限も今のまま

## 6. 受け入れ基準
1. vitest（src/app/system/list・src/app/api/soil/list）が通る　2. tsc に今回の変更由来のエラーが無い　3. eslint（変更ファイル単位）が通る
4. Claude が本番で：migration 実行 → 1,000 件を Excel／CSV／.mer で書き出して開く（.mer は FileMaker 形式のまま）→ 20 万件を CSV で書き出して件数と時間を測る → 記録と再ダウンロード

## 7. 完了報告（コードブロックで出力）
- 「未コミット」と明記／変更・追加ファイルのフルパス／受け入れ基準 1〜3 の結果／本番データ・git・SQL 実行に触っていないことの明記／migration の SQL 全文／1 束（5,000 行）あたりの想定時間と根拠

## 8. 既知の差分（Codex が追記する）
