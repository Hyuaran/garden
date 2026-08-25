# Garden 前確 FileMaker ブリッジ

社内LANの FileMaker 営業マスタを読み、Gardenの前確確認依頼へ返す32bit PowerShell 5.1常駐エージェントです。営業マスタ本文はSupabaseに保存されず、APIが受信時にGardenチェックを実行して指摘だけを保存します。

## 設置

1. `scripts/zenkaku-agent` と `scripts/callcenter-agent/CallCenterAgent.Core.ps1` を同じ親構成のまま社内ホストへ配置します。
2. `config.example.json` を `config.json` にコピーします。
3. FileMaker実機でデータベース名、テーブル名、営業ID列名、各フィールド名を確認し、`fmDatabase`、`fmTable`、`salesIdColumn`、`fieldMap`、`duplicateFieldMap` を修正します。example内の名称はExcel由来の仮置きで、確定値ではありません。
4. マシン環境変数 `FM_ZENKAKU_PASSWORD` と `ZENKAKU_AGENT_SECRET` を設定します。ユーザー環境変数、引数、config、ログには秘密を書きません。
5. `apiBaseUrl`、FileMakerサーバー、ポート、ユーザー、ログ先を環境に合わせます。
6. 32bit PowerShellで `ZenkakuAgent.ps1 -Once` を実行し、依頼なし、正常取得、存在しない営業ID、FM停止時を確認します。
7. 管理者権限で `Register-ZenkakuAgentTask.ps1` を実行します。タスクはSYSTEM・起動時・無期限・多重起動なしで登録されます。
8. タスクを開始し、`C:\ProgramData\Garden\ZenkakuAgent\logs` のJSONLで依頼ID、営業ID、状態、所要時間だけが出ることを確認します。

## 実物を見て確定する項目

- `fmDatabase`: 営業マスタを持つFileMakerデータベース名
- `fmTable`: ODBCから見える営業マスタのテーブル名
- `salesIdColumn`: 営業ID検索列
- `fieldMap`: `SalesMasterRecord`キーと実フィールド名の対応

## 郵便番号データの初回・手動取り込み

先に `supabase/migrations/20260825000001_system_postal_addresses.sql` をSQL Editorで適用します。その後、Vercel production の `CRON_SECRET` をBearerトークンにして次を実行します（初回投入・月次処理の再実行とも同じです）。

```powershell
Invoke-RestMethod -Method Post -Uri 'https://<Gardenの本番ホスト>/api/system/postal-import' -Headers @{ Authorization = "Bearer $env:CRON_SECRET" }
```

レスポンスの `ok=true`、`count` が10万件以上であることを確認し、SQL Editorでactive版を確認してからアプリをマージします。

```sql
select id, source_date, imported_at, row_count, active
from public.system_postal_datasets
order by imported_at desc;
```
- `duplicateFieldMap`: 重複警告に出す案件ID、商材名、登録日の実フィールド名

FileMaker Proの「外部データソース管理」およびODBCスキーマ表示で綴りを確認してください。列名を直す際はコードではなくconfigだけを変更します。

## ハング・失敗時

親プロセスが各読取を子プロセスで実行し、60秒を超えると子を終了して `timeout` を返します。ODBCエラーは `fm_unreachable` を返し、親は3秒後の次依頼へ進みます。秘密や営業マスタ本文はログへ出しません。
