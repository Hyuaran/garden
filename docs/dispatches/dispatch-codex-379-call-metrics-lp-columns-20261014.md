# Codex-379：テレマ コール集計 v1.7 ②＝kintone（LP系の範囲・申込み）の読み取り、3 系統の合流、従業員ごと 19 列＋事業別の小計、サマリー帯の「INNOVERA 最終取込」、配信本文の【WEBインバウンド】行と 0 件判定、PDF A3 横、定義方法の 5 表目（2026-10-14）

## 目的
槙さんの仕様書 v1.7（`C:\Users\shoji\Downloads\仕様書①_テレマコール集計ポータル_4_仕様書_v1.7_LP系と通話時間を追加.md`・以下「仕様書①」）のうち、**画面・配信・PDF に「通話時間」と「WEBインバウンド（LP系）」の列を足す部分**。土台（`system_innovera_call`・`system_innovera_ingest_log`・RPC `system_innovera_metrics`・Root の `filemaker_employee_name`）は **Codex-378 で作成済み**（`docs/dispatches/dispatch-codex-378-innovera-ingest-db-20261014.md` と、その成果物＝`supabase/migrations/20261014000004_*.sql`・`src/lib/innovera/ingest*.ts` を先に読む）。WEBインバウンドの「対応と結果」（§5.6・4 つ目のタブ・本文の【対応と結果】・PDF 第 2 部）は **次の Codex-380**＝この指示書では作らない。

仕様書①の該当節＝§2（表の 3 行）・§2.1（サマリー帯・従業員ごと 19 列・定義方法の 5 表目）・§5.5.1〜5.5.6・§7（本文の【WEBインバウンド】行・0 件判定）・§7.1（PDF A3 横・列幅・小計の表）・§7.2（読めないとき）・§9（制約）・§13（検算値）。**先に読む**。

### 決まっていること（東海林さん決定 2026-10-14）
- kintone の環境変数は既存の形（`KINTONE_<名前>_TOKEN`）：**`KINTONE_LP_BIZ_MASTER_TOKEN`**（239 事業マスタ・`KINTONE_LP_BIZ_MASTER_APP_ID` 既定 239）／**`KINTONE_HIKARI_PRO_TOKEN`**（226）／**`KINTONE_DENKI_START_TOKEN`**（235）／**`KINTONE_FLETS_TOKEN`**（251）。サブドメインは既存の `KINTONE_SUBDOMAIN`。**アプリ ID → 環境変数名の対応表**を `lp-kintone.ts` に持つ（239 の `customer_app` に対応表に無いアプリが来たら、その事業の申込みは「-」＋注記「LP申込み（kintone）の鍵が未設定：アプリ 999」）
- 項目コード（Claude が API で確認済み 2026-10-14）：対応状況＝**235 だけ `status`**・226／251 は `対応状況`。流入元＝`source`（3 つとも・ドロップダウン HP／入電）。希望時間帯＝`slot`（複数選択）。対応担当者＝`対応担当者`（3 つとも・「石原　孝志朗」の形）。受付日＝`作成日時`。番号＝`phone`・`電話番号_ハイフンなし`・`携帯番号_ハイフンなし`・`架電連絡先`
- 現場の実態（Claude 実測 10 月）：235 は 148 件中 75 件が `source` 空（CS の手入力 57・Administrator 18）。仕様書①どおり **`source` 空はフォームに数えない**（申込みの数え方には `source` を使わない＝対応状況と作成日時だけ）
- 画面の文言は日本語・開発者用語を出さない。社長スタイル・絵文字なし。**表の見出し行は中央ぞろえ**

## 作業場所・禁止事項
- 作業ツリー：`C:\garden\a-bloom-008`。**git の操作は一切しない**。`vercel.json`・`.env.local`・`supabase/migrations/**`（新しい migration は作らない＝RPC は 378 のものを使う。足りなければ完了報告に書く）・`src/lib/innovera/client.ts`・`src/lib/innovera/ingest*.ts`・`src/app/api/system/innovera-ingest/**`・`src/app/root/**`・`src/app/system/forms/**`・`src/app/api/system/shukkin/**`・`src/app/api/system/line/**` は触らない
- **前から落ちているテスト（`KpiCard` 2 本・`BackgroundCarousel` 5 本・`AppHeader` 5 本）は触らない。`src/app/_lib/kpi-fetchers.ts`・`src/components/shared/garden-view/BackgroundCarousel.tsx`・`src/app/_components/AppHeader.tsx` を変えない**
- 本物の外部サービス（kintone・Supabase 本番・Chatwork）は呼ばない（テストは偽の fetch／偽の client）。長い説明は不要・ファイルは必要な範囲だけ読む
- **既存の集計定義（有効・受注・前確OK・稼働時間・率）と v1.6 の列の意味は一切変えない**。FileMaker 側の RPC `system_call_metrics` も変えない

## 既存の部品（読むだけ）
- 画面：`src/app/system/call-metrics/CallMetricsClient.tsx`・`call-metrics.module.css`／API：`src/app/api/system/call-metrics/route.ts`（staff+・RPC 呼び出し）
- 共有ロジック：`src/app/system/_lib/call-metrics.ts`（`summarizeCallMetrics`・型 `CallMetricsResponse`）・`call-report.ts`（本文）・`call-report-delivery.ts`（本文＋PDF 送信・フォールバック）・`call-metrics-pdf.tsx`（PDF・`VectorText`・A3 縦）・`call-report-schedule.ts`
- kintone 読み取り：`src/lib/kintone/records.ts` の `getRecords`／`getAllRecords`（seek 方式・500 件・GET に Content-Type を付けない）
- RPC（378 が作成）：`system_innovera_metrics(p_from, p_to, p_lp_circuit_ids, p_employee_id)` → `{ employee_metrics, unassigned, circuit_metrics, last_sync_at, has_rows }`（`employee_id` は 'EMP-0001' の text）
- Root：`root_employees`（`employee_id`・`name`・`filemaker_employee_name`・`innovera_extension`・`innovera_mobile_extension`・`is_active`・`deleted_at`）

## 作るもの

### 1. `src/app/system/_lib/lp-kintone.ts`（kintone の読み取り・読むだけ）
- `loadLpScope()`：239 を `status in ("稼働中")` で読み、事業ごとに `{ bizCode, bizName, customerApp, circuitIds: number[], recordOrder }`（回線番号テーブルの `circuit_id`・レコード番号順）。**回線名の文字では判定しない**
- `loadLpCustomerRecords(app)`：対応表の環境変数のトークンで、全レコードの `$id`・`作成日時`・対応状況（アプリごとのコード）・`対応担当者`・`source`・`slot`・番号 4 項目を `getAllRecords` で読む（**1 アプリ 1 回**。380 の「対応と結果」も同じ読み取りを使うので、戻り値はそのまま持てる形に）。失敗は 1 回だけ 3 秒後にやり直し、それでも失敗なら `null`（呼び出し側が「-」＋注記）
- `countLpApplications(records, from, to)`：対応状況＝「申込み」かつ `作成日時`（JST の日付）が期間内の件数を、`対応担当者`（全角・半角の空白を除く）ごとに。「-」・空は「担当者未設定」に
- 同じ 1 回の実行の中だけ使い回す（実行をまたぐキャッシュはしない）。テスト：239 の読み方／アプリごとの項目コード／申込みの数え方（JST の日付境界）／失敗時 null

### 2. `src/app/system/_lib/call-metrics-merge.ts`（3 系統の合流・§5.5.5）
- 入力＝FileMaker の `employee_metrics`（既存 RPC）＋`system_innovera_metrics` の返り＋kintone の申込み＋Root の従業員一覧（`employee_id`・`name`・`filemaker_employee_name`・内線の有無）
- 出力＝従業員ごとの行（既存 13 列＋`talk_seconds_other`・`lp_answered`・`lp_outbound`・`lp_talk_seconds`・`lp_applications`。無い側は `null`＝画面で「-」）＋「（内線未登録）n席」の行（LP の数字が 1 以上のときだけ末尾・内線番号の内訳を持つ）＋事業別の小計（`circuit_metrics` を事業ごとに合計＋申込み＋「うち担当者未設定 n」）＋合計行
- 行を出す条件・並び・「-」と 0 の区別・従業員数の数え方は §5.5.5 のとおり。従業員名で絞るときの解決順（Root の氏名→`filemaker_employee_name`→FileMaker の文字）もここに
- `has_rows=false` のとき通話時間と LP の 3 列（応答・発信・通話時間）は全員 `null`、LP申込みは kintone から出す。kintone 239 が読めない→LP 4 列すべて `null`＋注記。顧客アプリが読めない→LP申込みだけ `null`＋注記（文言は §7.2・画面・本文・PDF で同じ）
- テスト：§13 の内線別の表（石原 2003／小泉 2011／藤木 2006／南薗 2034／宮永 2005）を偽データにして 19 列の値／FileMaker に無い人は LP が 1 以上のときだけ／「（内線未登録）」の出方／「-」と 0

### 3. API `GET /api/system/call-metrics`
- 既存の返りに `innovera`（最終取込の時刻・停止中か・`has_rows`）・`lp`（事業一覧・小計・注記の配列）を足し、`employee_metrics` の各行に新 5 列を足す（既存の列・型は変えない）。RPC `system_innovera_metrics` は `p_lp_circuit_ids`＝239 の稼働中の回線、`p_employee_id`＝従業員名で絞ったときの解決結果
- **「INNOVERA 取込停止中」の判定＝`last_sync_at` が集計時刻の 20 分以上前**（通話の有無では判定しない）

### 4. 画面 `CallMetricsClient.tsx`（従業員ごとタブと定義方法タブ・サマリー帯）
- 従業員ごと＝**19 列**（社員名／稼働時間／**通話時間**／コール数／コール数/h／有効数／有効率／トス数／トス率／受注数／前確OK数／見込／担不／留守／無効／**LP応答／LP発信／LP通話時間／LP申込み**）。**見出し 2 段**（上段「テレマ」＝社員名〜無効・「WEBインバウンド（LP系）」＝LP応答〜LP申込み・下段に列名）。1 列目固定はそのまま。通話時間・LP通話時間は `h:mm:ss`（稼働時間と同じ書式・0 は `0:00:00`）。`null` は「-」
- 表の下に **「事業別の小計」** の表（行＝稼働中の事業＋合計、列＝着信／応答／不在／留守電／発信／発信の応答／通話時間／申込み・申込みの脇に「うち担当者未設定 n」）。「（内線未登録）」の内線番号の内訳は、その行のツールチップと小計の表の下の 1 行
- サマリー帯に **「INNOVERA 最終取込 HH:MM」**（JST）。20 分以上前は赤字「INNOVERA 取込停止中（最終 HH:MM）」。テレマの総コールが 0 で LP だけの日は「従業員 0 名／総コール 0 件」のまま、平均コール数・有効率・受注率・前確OK率は「-」（0÷0 を作らない）
- 定義方法タブに **5 表目「通話時間と WEBインバウンド（LP系）」**（§5.5.6 の表をそのまま）。横スクロールなしの折り返し（既存の `definitionFit`）
- リスト名で絞ったとき通話時間と LP の列は絞らない旨の注記（タブ内・1 行）
- 幅 1,440／1,024／768／375 で崩れないこと（19 列は横スクロール・1 列目固定）。ライト／ダーク両方

### 5. 配信本文 `call-report.ts` と 0 件判定
- 本文に **【WEBインバウンド】** の見出し行＋事業ごとに 1 行 `ヒカリのプロ：着信26（応答14・不在12）／発信48／申込み2`（239 のレコード番号順・留守電は出さない）。取込停止中は見出し行の次に「※INNOVERA 取込停止中（最終 HH:MM）」。kintone が読めないときは申込みを「-」。`[/title]` の直後で改行しない決まりはそのまま
- **0 件スキップ＝テレマの総コール＋LP の着信＋LP の発信（＋フォーム受付数は 380 で足す）が 0 のときだけ**。INNOVERA が止まっていても DB にある分で判定
- テレマ 0 件で LP だけのときの「-」は画面と同じ
- cron（`call-report/cron`）・手動（`call-report`・preview/send）とも同じ経路。`summarizeCallMetrics` は共用のまま

### 6. PDF `call-metrics-pdf.tsx`（§7.1）
- **A3 横（1190.55×841.89pt）** に変更。第 1 部＝従業員ごと 19 列（列幅 pt＝社員名 92／稼働時間 58／通話時間 58／コール数 43／コール数/h 46／有効数 39／有効率 42／トス数 37／トス率 41／受注数 39／前確OK数 46／見込 34／担不 34／留守 34／無効 34／LP応答 44／LP発信 44／LP通話時間 58／LP申込み 44＝867）・見出し 2 段・文字 7.5pt・その下に事業別の小計の表（事業名 220／着信 60／応答 60／不在 60／留守電 60／発信 60／発信の応答 80／通話時間 80／申込み 60＝740）＋「（内線未登録）」の内訳 1 行
- 第 2 部「WEBインバウンド（事業ごと）」の**枠だけ**（見出しと「次の版で追加」の 1 行。380 で中身を入れる）、第 3 部＝リストごと（13 列・変えない）、第 4 部＝定義方法（5 表目を足す。6 表目は 380）
- ヘッダ帯の「対象期間」の右に「INNOVERA 最終取込 HH:MM」／停止中は赤字。ページ送り・（続き）・`VectorText` の注意（§7.1.1）は既存のまま。**`fontkit` の依存を外さない**
- ファイル名は変えない。テスト（`call-metrics-pdf.test.tsx`）を 19 列・A3 横に合わせる

### 7. 環境変数の案内
- Vercel：`KINTONE_LP_BIZ_MASTER_TOKEN`／`KINTONE_HIKARI_PRO_TOKEN`／`KINTONE_DENKI_START_TOKEN`／`KINTONE_FLETS_TOKEN`（Claude が登録・値は台帳）。`.env.example` があれば足す

## テスト（vitest）
- 上の各項目＋既存テスト（`src/app/system/_lib/**`・`src/app/system/call-metrics/**`・`src/app/api/system/call-metrics/**`・`src/app/api/system/call-report/**`・`src/lib/kintone/**`）は緑のまま。**KpiCard・BackgroundCarousel・AppHeader の 12 本は対象外**
- 偽データは §13 の値（回線別・内線別）を使い、画面・本文・PDF の数字が一致することをテストで示す

## 完了報告（コードブロックで。東海林さんがそのまま読む）
1. 変えたファイル一覧（新規／変更）
2. `npx tsc --noEmit` と `npx vitest run src/app/system src/app/api/system/call-metrics src/app/api/system/call-report src/lib/kintone` の結果（件数）
3. Vercel に足す環境変数の名前（値は書かない）／RPC に足りないものがあればその内容
4. 迷った点・決め打ちした点
