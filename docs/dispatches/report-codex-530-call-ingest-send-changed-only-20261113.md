# Codex-530 作業報告（2026-11-13）

## 実装結果

コール履歴の recent / full 読み返しで未変更行を省略し、コール・新営業のバッチ本文を既定でgzip化しました。受信APIは従来JSONとの互換を維持しています。ホストへの適用・本番反映は行っていません。

## 変更ファイル

- `scripts/callcenter-agent/CallCenterAgent.ps1`: 読み返しの要約比較、増分の常時送信、日次全送信、成功後の要約保存、ログ項目追加、gzip送信。
- `scripts/callcenter-agent/CallCenterAgent.Core.ps1`: 固定列順SHA-256、要約ファイル読書き・原子的置換・期限削除、JST日次判定、PowerShell 5.1対応gzip処理。
- `scripts/callcenter-agent/ShineigyoSnapshot.ps1`: バッチのgzip送信。
- `src/app/api/system/call-ingest/route.ts`、`src/app/api/system/shineigyo-ingest/route.ts`: 認証後の本文読込、gzip展開、20MiB上限、400/413応答。
- 両API配下の `route.test.ts`: gzip成功・壊れたgzip・展開後上限と非圧縮上限の追加テスト。
- `scripts/callcenter-agent/tests/CallCenterAgent.Core.Tests.ps1`: 要約・期限削除・日次判定・UTF-8 gzip往復のテスト追加。
- `scripts/callcenter-agent/tests/CallCenterAgent.ChangedOnly.Tests.ps1`: メモリ内ODBC代替とAPIモックで実際の同期関数を実行するテスト。
- `scripts/callcenter-agent/tests/CallCenterAgent.Transport.Tests.ps1`: 両エージェントの実バッチ関数を抽出し、HTTPをモックしてbyte[]・ヘッダー・JSON展開・無圧縮設定・DryRunを検証。
- `scripts/callcenter-agent/install-changed-only-paste.txt`: タスクから設置先検出、停止・該当プロセス終了確認、バックアップ、3ファイル交換、既存設定へ不足項目のみ追加、再開、初回新ログ確認、切り戻し。
- `scripts/callcenter-agent/README.md`: 動作・設定・交換・切り戻し・1日の回数の追記。
- この報告ファイル。

日本語を含むps1はUTF-8 BOM付き、対象ファイルの改行はCRLFで整えました。gitの操作・参照、computer-use、ブラウザ操作は行っていません。FileMaker・Garden・Supabase等の外部サービスの実呼び出しも行っていません。

## 検証結果

- `npx.cmd tsc --noEmit --incremental false`: 成功、終了コード0。共有作業フォルダのtsbuildinfoを更新しないためincrementalを無効化。
- `npx.cmd vitest run src/app/api/system/call-ingest src/app/api/system/shineigyo-ingest`: 3ファイル・22テスト成功（既存completeテストを含む）。既存の非gzip成功テストも通過。
- Windows PowerShell / Pester 3.4.0: `Invoke-Pester -Path .\scripts\callcenter-agent\tests -EnableExit`、53成功・失敗0。
- `C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe` から同じPesterを実行し、32bitでも53成功・失敗0。
- 貼り付け手順はPowerShell ASTパーサーで構文確認。ホストでの実行・タスク停止・実ファイル交換は未実施。
- Next.js同梱の `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` を読んでから実装。

## 1回の送信・1日の削減見込み

通常の読み返しN行のうち変更がC行なら、送信はN行からC行へ減少します。未変更が95%なら読み返し行数は95%減、全行未変更なら読み返しPOSTは0回です。増分と1日1回の全送信は残ります。送る行はさらにgzip圧縮しますが、本番データの圧縮率・実転送量・料金削減額は未測定です。

既定300秒間隔なら処理時間を除き最大約288ポール/日。既存のfull読取は約24回/日、指定時刻での追加fullは最大1回/日（既存fullと重なれば追加0回）。成功済み未変更行の全再送は原則1回/日へ減ります。失敗した日次全送信は成功まで次ポールで再試行し、各POSTの通信リトライは従来どおり最大4回です。新営業は既存の毎朝5:30、1回/日のまま。cronや独立した定期取得は追加していません。

## 判断した点・制約

- 要約の保存は、同期全体がsuccessのときにまとめて行います。途中まで成功しても、その後の失敗・partialでは一切保存しません。安全に再送できる側へ寄せ、DryRun・MaxRows・明示backfillも対象外です。
- `fullResendHourJst` 以降の最初の通常ポールで日次全送信が必要ならfullへ昇格させます。1時間の周期を待たず修復でき、成功時だけJST実施日を保存します。
- 従来の7日範囲は「7日前以降（当日を含む）」です。期限削除も同じ境界を残します。
- SHA-256対象は、実際に取得・送信する列名配列と、その固定順の値配列をJSON化したUTF-8バイトです。区切り文字の曖昧さを避け、nullと空文字を区別します。要約ファイルには主キー・要約・コール日・実施日だけを保持します。
- APIでは展開後だけでなく受信した本文自体にも20MiB上限を設けました。ストリームで展開量を数え、上限超過時に展開を打ち切ります。認証は本文処理より先です。
- 変更範囲を守るため、共通本文処理は両route内に同じ実装を置きました。他の共通ライブラリや他APIは変更していません。
- 新営業の小さな `/complete` リクエストは従来の非gzipのままです。対応範囲外のcomplete受信処理を変更せず、主な転送量を占めるバッチだけを圧縮しています。
- API対応を先に反映する必要があります。ホストの旧configは保持し、新設定が既にあれば上書きしません。初回要約作成時・日次全送信時は省略数0でも正常です。
- 貼り付け手順は配布元と設置先が同一なら停止前に拒否します。その場合は配布物を別フォルダへ展開してDistributionを変更します。新営業が異なる設置先/configなら自動交換せず停止前にエラーにします。
- ホスト交換・本番API反映と実データでの効果確認は未実施です。手順ファイルを作成しただけで実行していません。

- 32bitのメモリ消費を抑えるため、明示backfillでは要約を計算せず、保存対象外実行や保持期限より古い行の要約候補を蓄積しません。この最終調整後も32bit Pester 53件が成功しました。
