# Codex-390：ホスト PC の中継に KING OF TIME（KOT）を覚えさせる（2026-10-20）

## 背景
- KOT の Web API は**許可した固定 IP からしか使えない**。社内ホスト PC（固定 IP 218.219.200.7）は INNOVERA の中継で本番運転中（2026-10-19〜・523 件すべて成功）
- 東海林さん 2026-10-20「KOT の API をホスト PC で使える設定を進めよう」「おすすめ通り進めて OK」＝①中継に KOT を覚えさせる（今回）→②Root の従業員名簿の KOT 同期 →③管理表・出勤表の CSV の手入れをなくす →④勤怠打刻の自動登録

## 正本・手本（必ず読む）
- 設計：`C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\100_Projects\110_Garden\150_System_システム\07_ホストPC中継\001_設計_INNOVERA中継とKOT自動送信_ホストPC_v1_20261014.md`（§4・§5）
- 中継の手本：`src/lib/innovera/client.ts`（relayMode・heartbeat を見てから積んで待つ）、`src/lib/relay/queue.server.ts`（enqueueRelayJob・waitRelayJob・isRelayAlive）、`src/lib/relay/types.ts`（kind に kot・`{ api, params }` は型だけある）、`scripts/relay-agent/agent.mjs`（kind=kot は今「未対応」を返す）
- KOT の呼び出し：`src/app/root/_lib/kot-api.ts`（`kotFetch`・BASE_URL `https://api.kingtime.jp/v1.0`・GET・`Authorization: Bearer KOT_API_TOKEN`・429/5xx は再試行）。使っているのは従業員一覧 `/employees`・月別 `/monthly-workings/YYYY-MM`・日別 `/daily-workings/YYYY-MM-DD`

## 作るもの
1. **ホスト PC の常駐（scripts/relay-agent/agent.mjs）**：kind=kot を処理する
   - request＝`{ method: "GET", path: "/employees?date=2026-10-20", ... }`（path は `/` で始まる KOT API の相対パス。**GET だけ許す**＝今回は読み取りだけ。POST 等は「許可していません」で失敗を返す。path に `..` やホスト名を入れられないようにする）
   - `https://api.kingtime.jp/v1.0` + path に `Authorization: Bearer <環境変数 KOT_API_TOKEN>` で GET。応答の JSON をそのまま result に。HTTP エラーは `kot: <status> <短い理由>`、429/5xx は 3 回まで再試行
   - 起動時の必須の環境変数は今のまま（RELAY_SECRET・INNOVERA_API_HOST・INNOVERA_API_KEY）。**KOT_API_TOKEN が無いときは kot の仕事だけ「KOT の鍵がホスト PC にありません」で失敗を返す**（INNOVERA の中継は止めない）
   - ログに鍵・本文を出さない。テストを足す。agentVersion を 1.1.0 に
   - README・Register スクリプトはそのまま（README に KOT_API_TOKEN の説明を 1 段足す）
2. **Garden 側（src/app/root/_lib/kot-api.ts）**：`kotFetch` に切替を足す。環境変数 `KOT_RELAY_MODE=queue` なら中継（heartbeat が古ければ即 NETWORK_ERROR 相当の「中継が止まっています」、生きていれば `enqueueRelayJob("kot", { method:"GET", path }, "kot-api")` → `waitRelayJob`）。`direct`（既定）は今のまま。エラーは今の `KotApiClientError` の code・文言に写す（呼び出し側を変えない）
   - 1 回の応答が大きい月別（monthly-workings）は Vercel の受信上限（約 4.5MB）に近づくおそれ＝result が大きすぎて返せないときは agent が `kot: 応答が大きすぎます` で失敗を返す（上限 4MB）
   - waitRelayJob の待ち時間は KOT 用に 25 秒のまま。ジョブの期限 60 秒は今のまま
3. **確かめるための入口**（全権だけ）：`GET /api/root/kot-relay-check` で `/employees?date=今日` を 1 回呼び、件数と最初の 1 人の「従業員コード」だけを返す（氏名などは返さない）。`?dry` 不要（読み取りだけ）
4. テスト：agent（GET だけ・path の検査・鍵なし・429 再試行・大きすぎ）、kot-api（queue／direct の切替・中継停止・エラーの写し）、確かめる入口（権限）

## 守ること
- **commit・push しない。DB・本物の KOT・本物の Garden に接続しない**
- `src/app/bud/` の作業中の変更（Codex-389・未コミット）には触らない
- INNOVERA の中継の動き・テストを変えない
- `npx vitest run scripts/relay-agent src/lib/relay src/lib/innovera src/app/root src/app/api/root` と `npx tsc --noEmit -p .` が通ること（scripts/relay-agent は `npx vitest run --config scripts/relay-agent/vitest.config.mjs` も）

## 報告（日本語・コードブロック）
変えたファイルと、テストの結果と、Claude が本番で確かめる手順（ホスト PC に入れ直すファイル・環境変数・切替の順）だけ短く。
