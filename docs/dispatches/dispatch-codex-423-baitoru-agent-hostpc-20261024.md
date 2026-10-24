# Codex-423：バイトル応募の取り込み（ホスト PC 側・段階 2）（2026-10-24）

## 目的
設計書 C:\Claude\000_Garden\150_System_システム\02_入社手続き\006_設計_バイトル応募の取り込みをGardenへ_20261024.md の段階 2。
社内ホスト PC（Windows・Node.js v24・固定 IP）で、10 分おきにバイトル代理店管理画面から応募 CSV を取り、行を Garden の受け口（Codex-422 の `POST https://garden-os.net/api/sprout/baitoru/ingest`）へ送る常駐を作る。
元の Cloud Run 版の仕様：C:\Claude\000_Garden\150_System_システム\02_入社手続き\005_参考_バイトル自動化_仕様書_AI向け_20261024.md の §6（CSV 取得・セッション切れの見分け方・**自動再ログインは context を作り直す方式**・autoLogin のセレクタ候補）と §8-1（cp932・BOM・ヘッダー名で読む・`""` エスケープ）。元のソースは無いので仕様書から作る。

## 置き場（リポジトリ）
`scripts/baitoru-agent/`（`scripts/relay-agent/` と同じ作り）：
- `package.json`（依存は `playwright`（1.59 系）と `iconv-lite` だけ。type=module）
- `agent.mjs`（本体）／`config.example.json`（apiBase・intervalMinutes=10・logDir・logKeepDays=7・storageStatePath=`C:\Garden\baitoru-agent\storageState.json`・dryRun=true）
- `Register-BaitoruAgentTask.ps1`（タスク スケジューラ「GardenBaitoruAgent」を 10 分おき・SYSTEM で登録。`scripts/relay-agent/Register-RelayAgentTask.ps1` を手本に）
- `README.md`（設置手順：`npm install`→`npx playwright install chromium`→環境変数→config→`node agent.mjs --once --dry-run` で確認→タスク登録）
- `tests/`（`scripts/relay-agent/tests` と同じ vitest の形。CSV パーサ・cp932 デコード・セッション切れ判定・送信本文）

## 動き（1 回分＝`--once`）
1. 二重起動防止（ロックファイル）。
2. storageState（Cookie）を読み、headless Chromium の context を作る（viewport 1400×900・ja-JP・acceptDownloads）。無ければ最初からログイン。
3. 応募一覧 `https://agent.baitoru.com/entry?mode=1` を開く → `#bb-download-submit` を押して download を最大 30 秒待つ → 一時ファイル → cp932 デコード → 行を `{ 見出し名: 値 }` の配列に。
4. セッション切れ（URL に `/login`、または `ERR_TOO_MANY_REDIRECTS`）なら **今の context を close して storageState 無しの新しい context で** ログイン（`BAITORU_LOGIN_URL` 既定 `https://agent.baitoru.com/login`・ID/PW はシステム環境変数 `BAITORU_ID`／`BAITORU_PW`・セレクタ候補は元仕様 §6-3）→ 一覧へもう一度。同じ page で Cookie を消してやり直す方式は**禁止**（元仕様に失敗の実績）。
5. 成功したら storageState を保存。
6. 行を Garden へ `POST /api/sprout/baitoru/ingest`（`Authorization: Bearer <RELAY_SECRET>`・本文 `{ rows, dryRun }`。1 回の本文は 2MB まで、超えたら分ける）。応答を 1 行ログに。
7. どの失敗も握りつぶさない：失敗したら理由をログに残し、Garden の受け口へ `{ rows: [], error: "理由（ID・パスワードは含めない）" }` を送って Garden 側の「続けて失敗」の数に乗せる（受け口がこの形を受けないなら、受け口に `error` を受けて失敗回数を数える処理を足す＝`src/app/api/sprout/baitoru/ingest` と `src/lib/sprout/baitoru.server.ts`）。
8. Chromium は必ず close（try/finally）。
- 常駐ではなく、タスク スケジューラが 10 分おきに `node agent.mjs --once` を起動する形にする（Chromium の残骸を出さないため）。
- ログは `logs\YYYYMMDD.log`（UTF-8）。ID・パスワード・Cookie の中身は出さない。

## 触らないもの
- `src/app/bud/bank/` 配下。本番・バイトル・Garden に実際にはアクセスしない（テストはモック）。**git は触らないでください。コミットは人間側が行います。** npm install はしない（package.json に書くだけ）。

## 確認
`scripts/baitoru-agent` のテスト（`npx vitest run --root scripts/baitoru-agent` など relay-agent と同じ方法）と、受け口を直した場合は `npx tsc --noEmit`・`npx vitest run src/lib/sprout src/app/api/sprout`。

## 完了報告（コードブロックで）
変更・追加ファイル／ホスト PC での設置手順の要約／テスト結果／気になった点。
