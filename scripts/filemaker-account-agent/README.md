# FileMaker アカウント作成の係

`roster`（社員情報の名簿）は「社員情報」表に社員の行を直接 INSERT します。
打刻ID（社員番号）が既にあれば追加せず、その社員IDで完了します。社員IDは降順の先頭＋1、入社日は OdbcType.Date で渡します。自動計算欄は変更せず、Garden の作成権限のみを使用します。
旧依頼で roster がない場合は待機扱いです。社員番号・カナなどの不備は Garden で失敗、ODBC 例外はログのみで次回再試行します。

ホストPC の `C:\Garden\filemaker-account-agent\` にこのフォルダーをコピーする。
FileMaker 11 の 32bit ODBC ドライバーが必要。ファイルごとの権限は FileMaker 側で設定する。

1. `config.example.json` を `config.json` にコピーし、apiBase と接続先を確認する。
2. 既存のマシン環境変数 `RELAY_SECRET` と `FM_CALL_HISTORY_PASSWORD` を確認する。値を設定ファイルやログへ書かない。
3. 管理者 PowerShell で `./Register-FilemakerAccountAgentTask.ps1` を実行する。SYSTEM で1分おきに1回動作する。
4. `Start-ScheduledTask -TaskName GardenFilemakerAccountAgent` で確認し、Garden の入社後の確認で「自動：作成済み」になることを確認する。

ログは `C:\ProgramData\Garden\FilemakerAccountAgent\logs\yyyy-MM-dd.log`。パスワード・SQL・例外本文は記録しない。
接続・ODBC の例外時はログだけを残し、結果を送らず waiting/sent のまま次回に自動再試行する。30分以上止まると Garden 側で通知する。
FileMaker が pending・0 以外のエラー番号を返した場合は失敗として送信する。原因を確認して Garden の［もう一度］を押す。成功済みファイルは再作成しない。
送信後に API が応答しなかった場合も、同じ requestid を確認して二重 INSERT を避ける。
失敗した FileMaker 行は同じ requestid のまま UPDATE で再依頼する。

停止：`Disable-ScheduledTask -TaskName GardenFilemakerAccountAgent` と `Stop-ScheduledTask -TaskName GardenFilemakerAccountAgent`。
再開：`Enable-ScheduledTask -TaskName GardenFilemakerAccountAgent`。
削除：`Unregister-ScheduledTask -TaskName GardenFilemakerAccountAgent`。

Garden 側は migration の適用が必要。停止検知の GET `/api/system/filemaker-accounts/cron` は `CRON_SECRET` 認証。
初回配備では停止しておくため vercel.json には登録していない。確認後に15分おきで登録する。
