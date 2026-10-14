# Codex-374：INNOVERA 中継（ホスト PC 側）＝社内ホスト PC に置く常駐プログラム `scripts/relay-agent/`（Node.js・依存なし）（2026-10-14）

## 目的（東海林さんの決定）
- Garden（Vercel）→INNOVERA の通信を、社内ホスト PC（固定 IP 218.219.200.7・Win11）から出す。ホスト PC の常駐が Garden に「仕事はあるか」と聞きに行き（長く待つ問い合わせ）、あれば INNOVERA へ投げて結果を返す。
- 設計書（正本・必読）：`C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\100_Projects\110_Garden\150_System_システム\07_ホストPC中継\001_設計_INNOVERA中継とKOT自動送信_ホストPC_v1_20261014.md` §4-2。Garden 側の表・API は Codex-373 が同時に作っている（`src/**`・`supabase/**` は**読みも書きもしない**。API の仕様はこの指示書に書いた形を正とする）
- 先例＝`scripts/callcenter-agent/`（PowerShell 常駐・タスクスケジューラ・SYSTEM 実行・秘密はマシン環境変数）。**読んでよいが変えない**。同じ作法（登録スクリプト・README の書き方）に揃える

## 作業場所・禁止事項
- 作業ツリー：`C:\garden\a-bloom-008`。**git の操作は一切しない**（commit・branch・checkout・stash 禁止。コミットは人間側）
- 触るのは `scripts/relay-agent/**` だけ。`src/**`・`supabase/**`・`.env.local`・`vercel.json`・`package.json` は触らない（npm パッケージを足さない＝Node.js 標準だけで書く）。本物の外部サービス（Garden 本番・INNOVERA）は呼ばない
- **前から落ちているテスト（`KpiCard`・`BackgroundCarousel`・`AppHeader`）は触らない**
- 文言は日本語（ログ・README）。鍵の値はどこにも書かない

## Garden 側 API（Codex-373 が作る・この形を正とする）
- 共通：`Authorization: Bearer <RELAY_SECRET>`・`Content-Type: application/json`。鍵違いは 401
- `POST https://garden-os.net/api/system/relay/pull`　本文 `{ "agentVersion": "1.0.0", "waitMs": 25000 }`
  - 返り `{ "ok": true, "job": { "id": "<uuid>", "kind": "innovera", "request": { "ckey": "users", "akey": "search", "params": { … } } } }` または `{ "ok": true, "job": null }`（仕事なし＝待ち時間が過ぎた）
  - `kind` は `innovera`｜`kot`。`kot` は今回は**受けたら「未対応」で failed にして返す**（第 2 段で実装）
- `POST https://garden-os.net/api/system/relay/result`　本文 `{ "id": "<uuid>", "ok": true, "result": <INNOVERA の JSON そのまま> }` または `{ "id": "<uuid>", "ok": false, "error": "<短い理由>" }`
- INNOVERA の呼び方（Garden の `src/lib/innovera/client.ts` と同じ）：`POST https://<INNOVERA_API_HOST>/pbx/api/front/index/?ckey=<ckey>&akey=<akey>`、本文 `application/x-www-form-urlencoded`＝`api_key=<INNOVERA_API_KEY>` ＋ `request.params` の各項目（配列は `key[]` で複数・null/undefined は送らない）。応答は JSON `{ result, error_code, data }` をそのまま result に入れる（加工しない。password を落とすのは Garden 側）。25 秒で打ち切り

## 作るもの（`scripts/relay-agent/`）
### 1. `agent.mjs`（Node.js 20 以上・標準モジュールだけ・単一ファイル）
- 起動引数 `--config <path>`（既定＝同じフォルダの `config.json`）、`--once`（1 回 pull して終わる＝動作確認用）
- `config.json`：`{ "apiBase": "https://garden-os.net", "pullWaitMs": 25000, "idleSleepMs": 1000, "errorSleepMs": 5000, "logDir": "logs", "logKeepDays": 7, "agentVersion": "1.0.0" }`（`config.example.json` を置く）
- 秘密はマシン環境変数から：`RELAY_SECRET`・`INNOVERA_API_HOST`・`INNOVERA_API_KEY`。無ければ起動時に日本語で理由を出して終了コード 2
- ループ：`pull` → 仕事があれば実行して `result` → すぐ次の `pull`。仕事なしなら `idleSleepMs` 待って次。Garden に届かない・5xx・鍵違いは `errorSleepMs` 待って続ける（鍵違い 401 はログに「鍵が違います」）。1 件ずつ直列（INNOVERA の制限 5 分 200 回／IP に収める）
- INNOVERA への問い合わせが失敗（接続不可・HTTP 不正・JSON でない）→ `ok:false, error:"innovera: <短い理由>"`。`result:false` の JSON は**そのまま ok:true で返す**（判定は Garden 側）
- 終了の合図（Ctrl+C・SIGTERM）で実行中の 1 件を待ってから止まる
- ログ：`logs/YYYYMMDD.log`（JST・1 行 1 件・`時刻 レベル メッセージ`・秘密は書かない・本文は id と kind と所要ミリ秒だけ）。起動時に `logKeepDays` より古いログを消す。標準出力にも同じ
- 例外で落ちない（最上位で捕まえてログ→`errorSleepMs`→続行）

### 2. `Register-RelayAgentTask.ps1`
- `scripts/callcenter-agent/Register-CallCenterAgentTask.ps1` と同じ形：タスク名 `GardenRelayAgent`・起動時トリガー・SYSTEM・最高権限・`-RestartCount 3 -RestartInterval 1分`・`-ExecutionTimeLimit 0`・`-MultipleInstances IgnoreNew`。実行＝`node.exe`（引数 `--node <path>` 既定 `C:\Program Files\nodejs\node.exe`）で `agent.mjs --config <config.json>`。UTF-8 BOM で保存（日本語を含むため）
- `Unregister` は書かない（`Unregister-ScheduledTask -TaskName GardenRelayAgent` を README に書く）

### 3. `README.md`（日本語・東海林さんが設置するときに読む）
- 置き場 `C:\Garden\relay-agent\`／Node.js の入れ方（LTS・インストーラ）／マシン環境変数 3 つの名前（値は台帳 070）と設定のしかた（システムのプロパティ→環境変数→システム環境変数。**貼るのは東海林さん**）／`node agent.mjs --once` で疎通確認（期待する出力例）／タスク登録・停止・再開・ログの見方／止まったときに Garden通知へ知らせが来ること（Garden 側）
- 「INNOVERA の鍵をホスト PC に置くので、Vercel 側の鍵は 1 週間問題なければ外す」の段取り（設計書 §4-4）

### 4. テスト `scripts/relay-agent/tests/agent.test.mjs`（vitest で動く・`npx vitest run scripts/relay-agent`）
- `agent.mjs` は本体のループと「1 件を処理する関数」を分け、後者を `export` してテストする：`handleJob(job, { fetch })` に偽の `fetch` を渡し、①innovera の仕事で INNOVERA へ正しい URL・本文（`api_key`＋params・配列は `key[]`）が送られ、JSON がそのまま result になる ②INNOVERA 接続失敗で `ok:false` ③`kind:"kot"` は未対応で `ok:false` ④`result:false` の JSON は ok:true のまま返す
- `buildPullRequest`／`parsePullResponse` の小さな関数も `export` して、401・5xx・JSON でない応答を正しく分類することを確かめる
- vitest の設定で `scripts/**` が対象外なら、`scripts/relay-agent/vitest.config.mjs` を置いて `npx vitest run --config scripts/relay-agent/vitest.config.mjs` で動く形にする（ルートの設定は触らない）

## 完了報告（コードブロックで。東海林さんがそのまま読む）
1. 作ったファイル一覧
2. テストの実行コマンドと結果（件数）。`node --check scripts/relay-agent/agent.mjs` の結果
3. 設置手順の要約（README の見出しだけ）
4. 迷った点・決め打ちした点
