# Codex-317 社内ホストPCから FileMaker「新営業」を毎朝 Garden へ取り込む（既契約の分析用）

作成日: 2026-09-11（2026-09-13 に社内ホストPCの調査結果で列を確定）
作業ツリー: C:\garden\a-bloom-008
起点: main 32c6e1c（`git log -1` で一致を確認してから着手）
**git は触らないこと（commit するな）。migration は「書くだけ」（実行しない）。本番のデータに触らないこと。FileMaker にもつながないこと（このPCからは届かない）。**

必ず先に読むもの：
- 技術レシピ：C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\020_References\技術レシピ\filemaker11-odbc.md（32bit・DSN レス・PWD を波括弧で囲まない・計算フィールドを SELECT すると 1,500 倍遅い・MAX() 不可・壊れたレコードで固まる）
- 今の取り込み（手本）：scripts/callcenter-agent/CallCenterAgent.ps1・CallCenterAgent.Core.ps1・README.md・Register-CallCenterAgentTask.ps1・config.example.json
- Garden 側の手本：src/app/api/system/call-ingest/route.ts・src/app/system/_lib/call-ingest.ts（`verifyBearerRequest(request, "CALL_INGEST_SECRET")`）
- ④正本：C:\Claude\000_Garden\150_System_システム\00_マニュアル\14_リストマスタ\Garden_System_リストマスタ_4_仕様書_Claude読み込み用.md §8-7

## 0. 何を作るか（東海林さん 2026-09-11「毎日自動で最新にしたい」）

リストマスタの分析③「新営業 FileMaker の既契約」のため、FileMaker の「コール履歴」ファイルの中にある表 **「新営業」（2026-08-17 時点 31,002 件・646 列）** を、社内ホストPC から**毎朝 1 回、丸ごと** Garden に写す。

**社内ホストPCでの調査結果（東海林さん 2026-09-13 実行）**：接続 OK（ServerVersion 11.0.3）。**55,100 件**（8/17 の 31,002 件から増加）。電話番号あり 55,085／携帯あり 767／受注日あり 313。**最初の 500 件に 20.7 秒、全 55,100 件で 24.6 秒**＝つなぎ始めに約 20 秒かかり、そのあとは速い。既契約の欄の埋まり具合：**既契約情報 6,991 件・93 種類**（ドコモ光 3,058／BIGLOBE光 974／Softbank光 868／OCN光 346／TCOM光 245／So-net光 240／Nifty光 181／auひかり 175／丸紅光 112／Plala光 88 …）／既契約回線タイプ 37 件（7 種類）／既契約継続有無 39 件／既契約利用期間 0 件。**分析③の区切りは「既契約情報」を使う**（ほかは空同然）。

- **今動いているコール履歴の取り込み（GardenCallCenterAgent）には手を入れない**。別のスクリプト＋別の定期タスクにする（止まっても互いに影響しない）
- 読むだけ。FileMaker には書き込まない

## 1. 社内ホストPC 側（PowerShell・32bit）

### 1-1. `scripts/callcenter-agent/ShineigyoSnapshot.ps1`（新規）
- 接続は今と同じ（config.json の fmServer／fmPort／fmDatabase＝コール履歴／fmUser、パスワードは環境変数 `FM_CALL_HISTORY_PASSWORD`、送信の合言葉は `CALL_INGEST_SECRET`。**値をファイル・ログに出さない**）
- `SELECT <列> FROM "新営業" ORDER BY "主キー"` を 1 本流して読み、**500 件ずつ** `POST <shineigyoApiUrl>` へ送る（`{ runId, batchIndex, rows: [...] }`）
- 読む列（**実データの列だけ**。計算フィールドを入れると極端に遅くなる）：主キー／電話番号_ハイフンなし／携帯番号_ハイフンなし／リスト名／営業ID／受注日／既契約情報／既契約回線タイプ／既契約継続有無／修正日（既契約利用期間は全件空なので読まない）
- **つなぎ始めに約 20 秒かかる**（調査で実測）。最初の 1 件が返るまでの待ちを 300 秒にし、見張りは「進みが無い時間」で判定する（つなぎ始めの 20 秒で打ち切らない）
- **1 回の実行で約 25 秒**（調査の実測）。全部送り終えたら `POST <shineigyoApiUrl>/complete { runId, total }` を送る（Garden 側で「今回来なかった行」を消す）
- 途中で失敗したら complete を送らない（Garden 側の古い写しはそのまま残る）
- 見張り：今の取り込みと同じく、進みが `readStallTimeoutSeconds` 無ければ打ち切る（壊れたレコードで固まる対策）
- `-DryRun`（送らずに件数と最初の 3 件の列名・型だけ出す。値は出さない）と `-Once` を付けられる
- ログは今と同じ場所（`logDirectory`）に別ファイル名で

### 1-2. `scripts/callcenter-agent/Register-ShineigyoSnapshotTask.ps1`（新規）
- タスク名 `GardenShineigyoSnapshot`・**毎日 5:30**・32bit PowerShell で `ShineigyoSnapshot.ps1 -Once`
- 今の Register-CallCenterAgentTask.ps1 と同じ実行ユーザー・同じ書き方

### 1-3. config.example.json に `"shineigyoApiUrl": "https://garden.example.com/api/system/shineigyo-ingest"` を足す。README に「新営業の毎朝の写し」の節（入れ方・手動実行・確認）を足す

## 2. Garden 側

### 2-1. migration（書くだけ）`supabase/migrations/20260911000002_system_fm_shineigyo.sql`
- 表 `system_fm_shineigyo`：主キー text primary key／電話番号 text／携帯番号 text／リスト名 text／営業ID text／受注日 date／既契約情報 text／既契約回線タイプ text／既契約継続有無 text／修正日 text／run_id uuid／取込日時 timestamptz default now()
- 索引：電話番号・携帯番号。RLS 有効・service_role のみ
- 記録の表 `system_fm_shineigyo_sync_log`（run_id・開始・終了・件数・状態）

### 2-2. API
- `POST /api/system/shineigyo-ingest`（`CALL_INGEST_SECRET`）：rows を主キーで upsert（1,000 行ずつ）。番号は数字だけにそろえる。run_id を付ける
- `POST /api/system/shineigyo-ingest/complete`：その run_id の件数が `total` と合っていれば、**run_id が違う行（今回来なかった行）を消す**。合わなければ消さずに記録だけ「件数不一致」

## 3. テスト
- PowerShell：Core の純関数（列の組み立て・値の変換）に Pester テスト（今の tests/ と同じ形）
- API：合言葉違いで 401／upsert／complete で消える・件数不一致なら消さない

## 4. 受け入れ基準
1. vitest（src/app/api/system）・Pester（scripts/callcenter-agent/tests）が通る　2. tsc に今回の変更由来のエラーが無い　3. eslint（変更ファイル単位）が通る
4. 東海林さんが社内ホストPCにスクリプトを置いて `-DryRun` → `-Once` → タスク登録。Claude が Garden 側の件数（約 5.5 万件）と既契約情報の分布（ドコモ光 3,058 など調査結果と一致）を確認

## 5. 完了報告（コードブロックで出力）
- 「未コミット」と明記／変更・追加ファイルのフルパス／受け入れ基準 1〜3 の結果／本番・FileMaker・git に触っていないことの明記／migration の SQL 全文／社内ホストPCでの入れ方の手順（東海林さんがそのまま貼れる形）

## 6. 既知の差分（Codex が追記する）
