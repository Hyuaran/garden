# Codex-530b 作業報告（2026-11-13）

指示書の範囲で、更新マークからホストPCに強制取り直しを依頼する処理を実装しました。git操作・commit・computer-use・ブラウザ操作は行っていません。外部サービスの実呼び出し、本番への書き込み、migration適用、ホストへの設置・環境変数設定は行っていません。

## 変更したファイル

- `supabase/migrations/20261113000532_call_metrics_force_refresh.sql`（新規）
- `supabase/tests/system_callcenter_agent_requests.sql`（新規）
- `src/app/api/system/call-metrics/sync-request/route.ts`（新規）
- `src/app/api/system/call-metrics/sync-request/route.test.ts`（新規）
- `src/app/system/call-metrics/CallMetricsClient.tsx`
- `src/app/system/call-metrics/page.test.tsx`
- `scripts/callcenter-agent/CallCenterAgent.ps1`
- `scripts/callcenter-agent/CallCenterAgent.Core.ps1`
- `scripts/callcenter-agent/tests/CallCenterAgent.ChangedOnly.Tests.ps1`
- `scripts/callcenter-agent/tests/CallCenterAgent.ForceRefresh.Tests.ps1`（新規）
- `scripts/callcenter-agent/install-changed-only-paste.txt`
- `scripts/callcenter-agent/README.md`
- この報告ファイル

日本語入りps1はUTF-8 BOM付き・CRLFに揃えました。共用のusePollingや他機能のファイルは変更していません。

## 実装

RLS有効・ポリシーなしの要求表と係の認証表を追加。SHA-256照合を行うsecurity definerのtake/finish RPCを作り、publicの実行権限を取り消しanonに付与しました。takeは認証行をロックしてlast_seen_atを更新し、10分以上のrunningをstaleで失敗にした上で、最古のqueuedをrunningにします。

APIは既存コール集計と同じログイン・在籍・タブ閲覧権限を確認します。POSTは係が2分以内に応答していることを確認し、既存queued/runningを再利用。GETはstatus・finished_at・errorを返します。DB障害の詳細は画面に渡しません。

画面は更新ボタンをbusyにし、待機中だけusePollingで3秒ごとに確認、doneで既存loadを実行します。失敗・503・3分の時間切れは画面上部に表示します。通信が未完了でも3分でbusyを解除する単発タイマーを併用しています。配列・関数の依存による再取得は追加していません。

ホストは通常ポール間の待機でSupabase RPCを直接確認し、要求を受けたら同じ監督プロセスから32bitワーカーを順番に実行します。強制取り直しでは通常の主キー増分を省き、refreshWindowDaysの読み返しを要約に関係なく送信します。成功時に要約を保存しfinish。partial・無効日付・例外は失敗としてfinishします。通常同期と日次全送信の判定は維持します。

## テスト結果

- `npx --no-install tsc --noEmit --incremental false`：成功。
- `npx --no-install vitest run src/app/system/call-metrics src/app/api/system/call-metrics src/app/api/system/call-ingest`：5ファイル・45件成功。
- Windows PowerShell 64bit / Pester 3.4：59件成功。
- `C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe` / Pester 3.4：59件成功。
- API：403、既存要求再利用、同時insert競合、503、各statusをモックで検証。
- 画面：押下→busy→running→done→再集計、二重押下防止、終了後の確認停止、failed・503・時間切れの上部表示を検証。
- ホスト：変更のない行の強制再送、日次実施日を更新しないこと、partial失敗、要求なし、Supabase設定なし、成功／失敗finishをモックで検証。実際のFileMaker接続・HTTP送信なし。
- SQLテストを作成済み：秘密違いのtake/finish拒否、queued取得、heartbeat、二重取得防止、完了、stale失敗を検証するトランザクション・rollback形式。ローカルのPostgreSQL / psql / Supabase CLI / Dockerが見つからず、SQLテストは未実行。migrationも未適用です。

## 1日あたりの回数

- ホストの要求確認：既定10秒、24時間待機として最大約8,640回/日。通常処理・通信時間分は減ります。全てSupabase直結でVercel呼び出し0回。
- 通常ポール：既定300秒で最大約288回/日。既存の増分＋recent/full読み返しと日次全送りを維持。
- 手動要求をM件処理すると、追加の強制読み返しM回、finish RPC M回。takeは上記の確認内です。
- 読み返しN行、batchSize=Bなら、手動取り直しの送信は概ねceil(N/B)回/件（N=0なら0回）。既存の通信失敗時リトライは最大4回/POST。
- 画面：押したときだけ開始POST 1回＋3秒ごとのGET最大約60回/3分（期限判定が先なら59回）、成功時に集計GET 1回。M回押下なら上限目安は約62Mリクエスト/日。待機していない画面の定期確認は0回。
- cron追加なし。

## 判断したこと・引き継ぎ

- 同時に複数人が押しても重複しないよう、queued/running全体に部分ユニークインデックスを付けました。POSTの競合は既存要求を再読して返します。常時有効な要求は最大1件です。
- 手動要求は日次全送信の代わりとして数えず、日次実施日を更新しません。
- `transport`未設定時も手動要求はSupabase直結。指定する場合は`supabase`。設定不足・診断実行では手動要求だけを無効化します。
- エラー本文に秘密やFileMaker接続情報が混ざらないよう、finishの失敗理由は`refresh_failed`に固定しました。
- 通常処理の実行中は順番待ちになります。通常処理が長引いて最終heartbeatが2分より古い場合も、指定どおりPOSTは503です。
- Claudeに依頼するもの：migration適用、既存CALL_INGEST_SECRETのSHA-256要約を認証表のhost-pc行へ登録、必要なマシン環境変数設定、ホスト配布・実機確認、ローカル検証用DBでのSQLテスト実行。

手順の補足は指示されたREADMEと既存貼り付け用ファイルに追記しました。独立したマニュアルは作成していません。
