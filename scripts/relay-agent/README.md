# Garden Relay Agent

社内ホスト PC から Supabase RPC を直接呼び、INNOVERA／KOT の仕事を処理する Node.js 常駐エージェントです。既定は supabase、切り戻し用に garden も利用できます。

## 置き場

ホスト PC では次へ置きます。

```powershell
C:\Garden\relay-agent\
```

このリポジトリでは `scripts/relay-agent/` が配布元です。`agent.mjs`、`config.example.json`、`Register-RelayAgentTask.ps1`、`README.md` を同じフォルダへコピーしてください。

## Node.js

Node.js 20 以上をインストールします。標準インストーラの既定パスは次です。

```powershell
C:\Program Files\nodejs\node.exe
```

npm パッケージの追加は不要です。Node.js 標準機能だけで動きます。

## 環境変数

秘密値は config やスクリプトに書きません。ホスト PC のシステム環境変数へ、東海林さんが台帳 070 の値を設定します。

- `SUPABASE_URL`: Supabase のプロジェクト URL（supabase のとき必須）
- `SUPABASE_ANON_KEY`: 公開用 anon key（supabase のとき必須。service_role は使わない）
- `RELAY_SECRET`: Garden 中継 API と共有する Bearer secret
- `INNOVERA_API_HOST`: INNOVERA の API ホスト名
- `INNOVERA_API_KEY`: INNOVERA の API key

設定後、タスクを再起動するか、新しい管理者 PowerShell を開いてください。SYSTEM タスクから読めるように、ユーザー環境変数ではなくシステム環境変数へ入れます。

## config.json

`config.example.json` を `config.json` にコピーします。秘密値は入れません。

```json
{
  "transport": "supabase",
  "apiBase": "https://garden-os.net",
  "pullWaitMs": 25000,
  "idleSleepMs": 2000,
  "errorSleepMs": 5000,
  "logDir": "logs",
  "logKeepDays": 7,
  "agentVersion": "1.2.0"
}
```

supabase では仕事がないとき idleSleepMs（既定 2000ms）待ちます。apiBase と pullWaitMs は garden 用です。ログは `logs\YYYYMMDD.log` に出ます。古いログは起動時に `logKeepDays` より古いものを削除します。

## 手動疎通

本番サービスを呼ぶ前に、Garden 側で仕事 0 件の状態で待ち受けだけ確認します。

```powershell
cd C:\Garden\relay-agent
node .\agent.mjs --config .\config.json --once
```

必要な環境変数が無ければ、起動時に日本語のエラーを出して終了コード 2 で止まります。INNOVERA のレスポンス JSON は加工せず、そのまま Garden の result へ返します。INNOVERA への接続失敗、HTTP エラー、JSON でない応答は `ok:false` として `innovera: ...` の短い理由を返します。

## タスク登録

管理者 PowerShell で実行します。

```powershell
& "C:\Garden\relay-agent\Register-RelayAgentTask.ps1"
Start-ScheduledTask -TaskName "GardenRelayAgent"
Get-ScheduledTaskInfo -TaskName "GardenRelayAgent"
```

Node.js の場所が違う場合だけ `--node` 相当として `-NodePath` を渡します。

```powershell
& "C:\Garden\relay-agent\Register-RelayAgentTask.ps1" -NodePath "D:\nodejs\node.exe"
```

停止、再開、登録解除は次です。

```powershell
Stop-ScheduledTask -TaskName "GardenRelayAgent"
Start-ScheduledTask -TaskName "GardenRelayAgent"
Unregister-ScheduledTask -TaskName "GardenRelayAgent"
```

タスクは Windows 起動時に SYSTEM・最高権限で起動し、落ちた場合は 1 分間隔で 3 回再起動します。多重起動は `IgnoreNew` です。

## ログ確認

```powershell
Get-Content -Tail 50 C:\Garden\relay-agent\logs\$(Get-Date -Format yyyyMMdd).log
```

ログには秘密値、API key、Bearer token、INNOVERA の本文は出しません。job id、kind、成功/失敗だけを記録します。

## 止まったとき

1. `Get-ScheduledTaskInfo -TaskName "GardenRelayAgent"` で最終実行結果を確認します。
2. 当日ログを確認します。
3. `RELAY_SECRET` の認証エラーが出ている場合は、ホスト PC のシステム環境変数と Garden 側の値が一致しているか確認します。
4. 復旧しない場合は Garden 側へ「中継が止まっています」と連絡してください。

Vercel 側の INNOVERA 鍵は、中継運用が 1 週間問題なく動いた後に外す段取りです。

KOT の読み取りを中継する場合は、ホスト PC のマシン環境変数 `KOT_API_TOKEN` に鍵を設定して常駐タスクを再起動します。未設定でも INNOVERA は動き続け、KOT の仕事だけ失敗します。鍵は config.json やログに書かないでください。Garden 側は `KOT_RELAY_MODE=queue` で切り替えます（既定は `direct`）。

KOT は POST /employees を許可します（JSON 16KB まで）。POST は再試行しません。

### 従業員の所属・雇用区分の変更
- GET `/employees/{英数字}`：クエリは `includeResigner` と `date` のみ。
- PUT `/employees/{英数字とハイフン}?updateDate=YYYY-MM-DD`：JSON オブジェクト 16KB まで。UTF-8 で送信し、失敗時も再試行しません。
- Garden 側の `KOT_EMPLOYEE_UPDATE_ENABLED=true` の場合のみ更新可能です。既定は停止。全権管理者の従業員編集から変更日を指定して操作します。
- 日本時間 8:30〜10:00、17:30〜18:30 は利用できません。ホスト側は既存の逐次実行を維持してください。
## 1.2.0 への入れ替え・切り戻し

1. Claude が migration を適用し、host-pc の agent_secret_hash を設定済みであることを確認します。
2. ホスト PC のシステム環境変数へ SUPABASE_URL と SUPABASE_ANON_KEY を追加します。秘密値をファイルへ書きません。
3. agent.mjs を差し替え、config.json を transport: "supabase"、agentVersion: "1.2.0"、idleSleepMs: 2000 にします。
4. タスク GardenRelayAgent を停止・開始し、ログに「取りに行く」が出て認証エラーがないことを確認します。
5. 戻す場合は transport を "garden" にし、同じタスクを再起動します。従来の API は残しています。