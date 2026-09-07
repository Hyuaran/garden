# Codex-295 管理表ポータル：Excel 書き出し（計算した値だけを入れた「【管理表】実件数報告」の Excel を作る）

作成日: 2026-09-07
作業ツリー: C:\garden\a-bloom-008
起点: main **dad266a**（稼働時間の取り込み口 本番稼働）
**git は触らないこと。SQL・migration を書かないこと。本番のデータ・Storage・ドライブに触らないこと。開発サーバを起動しないこと。**

必ず先に読むもの：
- 正本（④）：C:\Claude\000_Garden\150_System_システム\00_マニュアル\07_管理表ポータル\Garden_System_管理表ポータル_4_仕様書_Claude読み込み用.md（§14〜20）
- 設計書 5 章：C:\Claude\000_Garden\150_System_システム\04_管理表ポータル\004_設計_段階2b_3_4_残りのシートとKOT.md（「Excel 書き出し：計算した値だけを入れた Excel。式は入れない。テンプレートに書き戻すと Excel で開けなくなるため」）
- テンプレートの見出し（式でないセル・結合・列幅）：C:\Claude\000_Garden\150_System_システム\04_管理表ポータル\fixtures\template\template_static_cells.json（Claude が v2 テンプレートから抜き出したもの。シート名 → static_cells／merged／col_widths／max_row／max_col）
- 各シートの計算部品と golden（cellValues の番地が Excel と同じ）：src/app/system/kanri/_lib/calc/*.ts

## 0. 何を作るか

管理表ポータルで計算した結果（6 シート）を、営業部が見慣れた Excel「【管理表】実件数報告」と同じ見た目・同じ番地に **値だけ**入れた .xlsx として書き出す。給与の受け渡し用。式は一切入れない（テンプレートに書き戻す方式は Excel で開けなくなる実績があるので採らない）。現場には出さない。東海林さんが並行運用する。

## 1. 中身

| Excel のシート名 | 値の元（保存済みの計算結果 sheet） | 番地 |
|---|---|---|
| 【入力】管理表 | kanri（KanriSheetGrid.cellValues） | Excel と同じ |
| 【入力】実績管理 | jisseki（cellValues） | 同 |
| 【入力】アポラン | aporan（cellValues） | 同 |
| 【入力】訪問販売 | houhan（cellValues） | 同 |
| インセ計算 | incentive（cellValues） | 同 |
| 【月1】給与計算用 | payroll（cellValues） | 同 |
| 付与ポイント | 設定表（system_kanri_point_master：商材・係数・単価）を 3〜5 行目に | 同 |

- 見出し・固定文言・結合セル・列幅は template_static_cells.json から。ただし **個人データに当たる静的セルは同梱しない**：実績管理 4 行目以降の B〜F（氏名・KOT名・時給・部署・チーム）、アポラン 21 行目以降、給与計算用 24 行目以降、訪問販売の A1／X1／AU1（担当者名）とその値、交通費・Kintone・クレジットカード・KOT貼り付け・関電貼り付け の中身。→ Codex が JSON から **見出しだけ**を選んだ `src/app/system/kanri/_lib/export/template-labels.json` を作る（作り方をテストで固定：上の除外範囲に値が無いこと）
- 人名など可変の値はすべて計算結果（cellValues）から入る。計算結果に無い番地は空のまま
- 値の型：数値は数値、日付は日付（yyyy/mm/dd）、文字は文字。効率・達成率・開通率など Excel でパーセント表示だったセルは数値のまま（表示形式は「0.00」「0.0%」程度で可。厳密な再現は不要）。金額は「#,##0」
- 書き出さないシート：【入力】Kintone・クレジットカード・KOT貼り付け・関電貼り付け・交通費（生データ。Excel に入れない）
- ファイル名：`【管理表】実件数報告_YYYYMMDD.xlsx`（対象日）。1 つの run（対象日）につき最新の計算結果から作る。計算していない run なら「先に『計算する』を押してください」

## 2. 画面
```
（管理表ポータル 上部の操作） [データを取り込む] [計算する] [Excel を書き出す]
                                                    └ 押すとダウンロード。計算前は押せない（理由を横に表示）
```
- manager 以上。絵文字なし、開発者用語なし

## 3. 作るもの
- `src/app/system/kanri/_lib/export/excel-export.ts`：`buildKanriWorkbook({ run, results, points })` → exceljs の Workbook（既存依存の exceljs を使う。無ければ理由を報告して止める）。純粋関数＋テスト
- `src/app/system/kanri/_lib/export/template-labels.json`（1 章のとおり）
- API：`GET /api/system/kanri/runs/[id]/excel`（manager 以上）→ .xlsx（Content-Disposition は RFC 5987 で日本語名＋ASCII 代替名）
- 画面：「Excel を書き出す」ボタン
- テスト：単体（6 シート＋付与ポイントが出る／式のセルが 1 つも無い／見出し JSON に除外範囲の値が無い／cellValues の値が同じ番地に入る／日付が日付型）＋ golden 相当（KANRI_FIXTURES_DIR の fixture から各 grid を作って書き出し、読み戻して 管理表 G5・実績管理 I8・アポラン D5・訪問販売 B2・インセ J18・給与 W28 などの代表セルが grid と一致）

## 4. 変えてはいけないもの
- 6 シートの計算と保存。既存 API の形（足すだけ）

## 5. 受け入れ基準
1. vitest（KANRI_FIXTURES_DIR 指定）が通る　2. tsc に今回の変更由来のエラーが無い　3. eslint が通る
4. 書き出した .xlsx に式が無い（テストで全セル確認）。個人データの静的セルが同梱 JSON に無い（テスト）
5. Claude が実機で：本番の 8/31 の計算結果から書き出し → 実 Excel で開ける（COM で確認）→ 主要セルが画面の値と一致
6. 絵文字なし・開発者用語なし

## 6. 完了報告（コードブロックで出力）
- 「未コミット」と明記／変更・追加ファイルのフルパス／受け入れ基準 1〜6 の結果／本番データ・git・SQL に触っていないことの明記

## 7. 既知の差分（Codex が追記する）
- 2026-09-07 Codex-295：Excel 実機確認（本番 8/31 から書き出し、実 Excel で開く、主要セルを画面と照合）は指示どおり Claude 側の確認待ち。
- 2026-09-07 Codex-295：`KANRI_FIXTURES_DIR` 指定の管理表ポータル範囲 vitest は通過。リポジトリ全体の vitest / eslint は、今回触っていない KPI・背景カルーセル・PDF・tree・bud transfers など既存別領域で失敗。
