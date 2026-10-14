# Garden Relay Agent

社内ホスト PC から Garden の中継 API を pull し、INNOVERA へ問い合わせて結果を Garden へ返す Node.js 常駐エージェントです。第 1 段は `kind: "innovera"` だけを処理し、`kind: "kot"` は未対応として失敗を返します。

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

- `RELAY_SECRET`: Garden 中継 API と共有する Bearer secret
- `INNOVERA_API_HOST`: INNOVERA の API ホスト名
- `INNOVERA_API_KEY`: INNOVERA の API key

設定後、タスクを再起動するか、新しい管理者 PowerShell を開いてください。SYSTEM タスクから読めるように、ユーザー環境変数ではなくシステム環境変数へ入れます。

## config.json

`config.example.json` を `config.json` にコピーします。秘密値は入れません。

```json
{
  "apiBase": "https://garden-os.net",
  "pullWaitMs": 25000,
  "idleSleepMs": 1000,
  "errorSleepMs": 5000,
  "logDir": "logs",
  "logKeepDays": 7,
  "agentVersion": "1.0.0"
}
```

通常は `apiBase` だけ確認します。ログは `logs\YYYYMMDD.log` に出ます。古いログは起動時に `logKeepDays` より古いものを削除します。

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
