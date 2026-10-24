# バイトル応募エージェント（Windows / Node.js 24）

固定 IP のホストへこのディレクトリを C:\Garden\baitoru-agent に配置する。

1. ホストで `npm install`、`npx playwright install chromium` を実行。
2. SYSTEM のタスクが使えるシステム環境変数 `BAITORU_ID`、`BAITORU_PW`、`RELAY_SECRET` を設定。必要なら `BAITORU_LOGIN_URL` を設定。秘密の値をコマンド履歴やログへ残さない。
3. `config.example.json` を `config.json` にコピーし、apiBase とパスを確認。相対パスは config の場所を基準に解決する。dryRun は初期 true。
4. `node agent.mjs --once --dry-run` で確認。dry-run もバイトルへのアクセス・Cookie 更新・Garden への送信を行う。失敗報告は監視に記録される。
5. Chromium のインストール先は実行ユーザーで異なるため、共有の `PLAYWRIGHT_BROWSERS_PATH` をシステム環境変数に設定してからブラウザをインストールし、SYSTEM に読み取り・実行権限を付与する。
6. 管理者 PowerShell で `./Register-BaitoruAgentTask.ps1` を実行。SYSTEM・10 分間隔で `--once` を起動する。config の intervalMinutes は 10 固定。
7. dry-run の結果確認後、人間が config の dryRun を false にして本稼働に切り替える。

ログは logs/YYYYMMDD.log、7 日保存。CSV・応募者情報・認証情報・受信本文は記録しない。storageState.json は Cookie を含むため SYSTEM と管理者だけが読める ACL にし、config・ログも同様に保護する。CSV 一時ファイルは処理後に削除する。

二重起動は storageStatePath + `.lock` で防止。強制終了・停電時はロックが残る。タスクを停止し node/Chromium が稼働していないことを確認した人間がロックを削除して再開する。ログの failure-report-failed は Garden に障害を届けられていない状態のためホスト側の監視でも確認する。

テスト（リポジトリルート、既存 vitest を使用）:
`node node_modules/vitest/vitest.mjs run --root scripts/baitoru-agent`

この実装作業では npm install・タスク登録・実サービスへの接続は実行していない。
