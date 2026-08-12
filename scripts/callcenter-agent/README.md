# Garden Call Center Agent

## Incremental primary-key operation and watchdog

- A normal run without `last_max_primary_key` bootstraps from the narrow call-date window (`overlapDays`) and saves the greatest successfully processed primary key. It does not scan the full table to seed state.
- Later normal runs use `WHERE "主キー" > last_max_primary_key ORDER BY "主キー"`. Explicit date backfills retain call-date/month splitting and never modify primary-key state.
- The supervisor kills a 32-bit worker after `readStallTimeoutSeconds` without heartbeat progress (default 300). Continuous mode retries; `-Once` exits nonzero.
- Heartbeats are forced at batch boundaries and otherwise throttled by `heartbeatIntervalSeconds` (default 5); they contain only time and phase.
- Secrets remain inherited environment variables and are never placed in worker arguments, heartbeat files, or logs.

After copying the scripts/config to the host and adding the new config keys, recreate and start the always-on task:

```powershell
& "C:\garden\a-bloom-008\scripts\callcenter-agent\Register-CallCenterAgentTask.ps1"
Start-ScheduledTask -TaskName "GardenCallCenterAgent"
Get-ScheduledTaskInfo -TaskName "GardenCallCenterAgent"
```

FileMaker Server 11の「コール履歴」を32bit ODBCで取得し、Gardenの`POST /api/system/call-ingest`へ送るWindows常駐エージェントです。

## 重要な制約

- FileMaker ODBCドライバは32bit専用です。64bit PowerShellでは`IM014`になるため、必ず次を使います。

  `C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe`

- 増分判定はDATE型の「コール日」です。SQLは`{d 'YYYY-MM-DD'}`を使用し、`{ts ...}`や`MAX()`は使いません。
- 「作成日」「修正日」はVARCHARのため増分判定に使いません。
- コール日を過ぎてから古い行が書き換えられ、設定したオーバーラップ日数より古くなった場合、その変更は通常実行では拾えません。`-StartDate`/`-EndDate`で再走査するか、`overlapDays`を広げてください。
- FileMakerの事前集計列は監査用に保存しますが、Garden側の集計には使用しません。

## 必要な環境変数

値をスクリプトやconfigへ書かないでください。

- `FM_CALL_HISTORY_PASSWORD`: FileMakerユーザー`Garden`のパスワード
- `CALL_INGEST_SECRET`: APIと共有する取込専用Bearer secret
- Web API側には既存の`NEXT_PUBLIC_SUPABASE_URL`と`SUPABASE_SERVICE_ROLE_KEY`も必要です。

マシン環境変数の設定後は、タスク実行ユーザーで新しいPowerShellを起動するか、タスクを再起動してください。

## config.json

`config.example.json`を`config.json`へコピーし、`apiUrl`を実環境へ変更します。秘密値は入れません。

- `batchSize`: 1〜500、既定500
- `includeAggregateFields`: 既定false。falseでは保存対象19列だけを取得し、FileMakerの計算・集計25列を省いて高速化します。監査調査で必要な場合だけtrueにします。
- `overlapDays`: 通常3日
- `pollSeconds`: 常駐時の実行間隔
- `runContinuously`: タスクスケジューラ常駐時はtrue
- 状態とログの既定保存先: `C:\ProgramData\Garden\CallCenterAgent\`

## Supabase migration適用手順

GardenではmigrationをSupabase SQL Editorから手動適用します。最初の2本で取込テーブルを作成し、3本目でデータを保持したまま`soil_*`から`system_*`へ改名します。

1. Supabase Dashboardで対象プロジェクトを開き、SQL Editorを開く。
2. 次を順番どおり貼り付けて実行する。
   1. `supabase/migrations/20260811000001_soil_call_history_ingest.sql`
   2. `supabase/migrations/20260811000002_soil_call_sync_log.sql`
   3. `supabase/migrations/20260812000001_system_call_rename.sql`
3. SQL末尾の確認クエリを実行する。
4. `system_call_history.external_call_id`のunique制約、`list_name`/`call_date`のindex、両テーブルのRLS有効を確認する。
5. 疎通後、次でFileMaker主キー由来IDの一意性を確認する。

   `select count(*) as total, count(distinct external_call_id) as unique_ids from public.system_call_history;`

`20260812000001_system_call_rename.sql`は改名前の`soil_*`テーブルへ1回だけ実行してください。適用後の再実行はできません。

## 初回手動疎通（直近1日、10〜50行）

以下は32bit PowerShellを明示します。最初にDryRunで確認し、その後にAPI送信します。

```powershell
$ps32 = "$env:WINDIR\SysWOW64\WindowsPowerShell\v1.0\powershell.exe"
$agent = "C:\garden\a-bloom-008\scripts\callcenter-agent\CallCenterAgent.ps1"
$config = "C:\garden\a-bloom-008\scripts\callcenter-agent\config.json"
$start = (Get-Date).Date.AddDays(-1).ToString("yyyy-MM-dd")
$end = (Get-Date).Date.ToString("yyyy-MM-dd")

& $ps32 -NoProfile -ExecutionPolicy Bypass -File $agent -ConfigPath $config -StartDate $start -EndDate $end -MaxRows 10 -DryRun -Once
& $ps32 -NoProfile -ExecutionPolicy Bypass -File $agent -ConfigPath $config -StartDate $start -EndDate $end -MaxRows 10 -Once
```

10行で成功後、`-MaxRows 50`に広げます。Supabaseで次を確認します。

```sql
select external_call_id, call_date, call_time, employee_name, result_flag, list_name, imported_at
from public.system_call_history
order by imported_at desc
limit 50;

select run_id, batch_index, status, records_fetched, records_inserted, records_updated, records_rejected
from public.system_call_sync_log
order by triggered_at desc
limit 20;
```

同じ日付範囲を再送し、`system_call_history`の件数が増えず、同期ログの`records_updated`が増えることを確認します。

## 過去データの段階バックフィル

既定の`includeAggregateFields: false`では、Gardenが通常カラムへ保存・集計する19列だけをFileMakerから取得します。計算・集計25列はSELECTしないため、新規取込行の`fm_aggregate_raw`では該当監査値がnullになります。集計RPCはこのJSONを参照しないため、コール集計への影響はありません。従来の監査値も取得する必要がある場合は、`config.json`を一時的に次のように変更します。

```json
{
  "includeAggregateFields": true
}
```

trueではFileMakerの計算列評価により大幅に遅くなる可能性があります。通常運用とバックフィルではfalseを推奨します。

`-StartDate`または`-EndDate`を明示した実行はバックフィルとして扱われ、対象範囲を月単位に分割します。各月は独立したODBC readerで取得され、最大500件ずつAPIへ送信されます。ログの`month started`、`batch completed`、`month completed`、`sync completed`で、月別件数、送信件数、累計件数、直近コール日、所要時間を確認できます。

古いFileMakerデータにコール日が空、または`yyyy-MM-dd`として解釈できない行が含まれる場合、その行はAPIへ送らず自動的にスキップします。`month completed.skipped_invalid_date`で月別件数、`sync completed.skipped_invalid_date`で累計件数を確認できます。行本文や電話番号はログへ出しません。不正日付行は受け側でも保存対象外であり、有効な行の集計とstate更新には影響しません。

バックフィル中は二重取得を避けるため、増分タスクを停止したままにします。

```powershell
Disable-ScheduledTask -TaskName "GardenCallCenterAgent"

$ps32 = "$env:WINDIR\SysWOW64\WindowsPowerShell\v1.0\powershell.exe"
$agent = "C:\garden\a-bloom-008\scripts\callcenter-agent\CallCenterAgent.ps1"
$config = "C:\garden\a-bloom-008\scripts\callcenter-agent\config.json"
```

必ず最初に`-DryRun`で範囲と件数を確認し、その後、同じ引数から`-DryRun`だけを外して本実行します。

### 直近3ヶ月

```powershell
& $ps32 -NoProfile -ExecutionPolicy Bypass -File $agent -ConfigPath $config -StartDate 2026-05-13 -EndDate 2026-08-12 -DryRun -Once
& $ps32 -NoProfile -ExecutionPolicy Bypass -File $agent -ConfigPath $config -StartDate 2026-05-13 -EndDate 2026-08-12 -Once
```

性能再計測では、変更前と同じ日付範囲・同じ`batchSize`でDryRunを実行します。ログの`batch completed.elapsed_seconds`で各500件の取得時間を、`month completed.elapsed_seconds`で月全体を比較してください。DryRunはAPIへPOSTしないため、FileMaker ODBC読取性能の比較に使えます。

### 今年分

直近3ヶ月の取込結果、ポータルの体感、Supabase負荷を確認してから広げます。範囲の重複は`external_call_id`のupsertにより安全です。

```powershell
& $ps32 -NoProfile -ExecutionPolicy Bypass -File $agent -ConfigPath $config -StartDate 2026-01-01 -EndDate 2026-08-12 -DryRun -Once
& $ps32 -NoProfile -ExecutionPolicy Bypass -File $agent -ConfigPath $config -StartDate 2026-01-01 -EndDate 2026-08-12 -Once
```

### 1年ずつ遡る

```powershell
& $ps32 -NoProfile -ExecutionPolicy Bypass -File $agent -ConfigPath $config -StartDate 2025-01-01 -EndDate 2025-12-31 -DryRun -Once
& $ps32 -NoProfile -ExecutionPolicy Bypass -File $agent -ConfigPath $config -StartDate 2025-01-01 -EndDate 2025-12-31 -Once
```

途中失敗時は、最後に`month completed`となった月の次月、または`month failed`となった月の初日へ`-StartDate`を狭めて再実行します。同じ月を再送してもupsertされるため重複行は作られません。

明示範囲の最大コール日が既存stateより古い、または同日の場合、`state.json`は更新されません。既存stateより新しく、全バッチがsuccessの場合だけ前進します。partial・失敗・DryRunではstateを進めません。バックフィル完了とSupabase側の確認後に増分タスクを再開します。

```powershell
Enable-ScheduledTask -TaskName "GardenCallCenterAgent"
Start-ScheduledTask -TaskName "GardenCallCenterAgent"
```

## ODBC列型と主キー一意性の確認

```powershell
& $ps32 -NoProfile -ExecutionPolicy Bypass -File $agent -ConfigPath $config -ShowSchema -Once
& $ps32 -NoProfile -ExecutionPolicy Bypass -File $agent -ConfigPath $config -CheckPrimaryKeyUniqueness -DryRun -Once
```

一意性確認はFileMaker全件に対する`COUNT(*)`と`COUNT(DISTINCT "主キー")`を比較します。FileMaker側が当該集計を拒否した場合は、別途日付レンジごとの重複検査に切り替えます。

## タスクスケジューラ登録

管理者PowerShellから次を実行します。登録されるアクションは32bit `powershell.exe`です。

```powershell
& "C:\garden\a-bloom-008\scripts\callcenter-agent\Register-CallCenterAgentTask.ps1"
Start-ScheduledTask -TaskName "GardenCallCenterAgent"
Get-ScheduledTaskInfo -TaskName "GardenCallCenterAgent"
```

タスクはWindows起動時に開始し、`runContinuously=true`の場合はプロセス内で定期実行します。多重起動は`IgnoreNew`です。

## 状態・ログ・障害復旧

- 状態: `C:\ProgramData\Garden\CallCenterAgent\state.json`
- ログ: `C:\ProgramData\Garden\CallCenterAgent\logs\agent-YYYYMMDD.jsonl`
- partialまたは失敗時は状態日付を進めません。通常増分は次回オーバーラップ範囲を再送し、バックフィルは失敗月へ範囲を狭めて再実行します。どちらもAPIのupsertで重複を防ぎます。
- 状態ファイルが壊れた場合、内容を保全して別名へ移動してから`-StartDate`を指定して復旧します。
- ログにはFMパスワード、Bearer token、電話番号、受信行本文を出しません。
