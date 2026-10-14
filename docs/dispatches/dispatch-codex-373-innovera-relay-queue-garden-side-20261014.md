# Codex-373：INNOVERA 中継（Garden 側）＝社内ホスト PC が「取りに行く」仕事の表・API・`callInnovera` の切替・中継の生存監視（2026-10-14）

## 目的（東海林さんの決定）
- Vercel→INNOVERA の通信が間欠的に途切れる（INNOVERA 回答：AWS 帯は許可不可・固定 IP 218.219.200.7 からなら解消見込み）。**通信を社内ホスト PC（固定 IP）から出す**ため、Garden に「中継の仕事を積む表」と「ホスト PC が取りに来る API」を作り、`callInnovera` を環境変数 1 つで中継に切り替えられるようにする。
- 設計書（正本・必読）：`C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\100_Projects\110_Garden\150_System_システム\07_ホストPC中継\001_設計_INNOVERA中継とKOT自動送信_ホストPC_v1_20261014.md`（案 B＝取りに行く方式）。この指示書は設計書 §4-1 と §4-2 の Garden 側だけ。ホスト PC 側の常駐は Codex-374（`scripts/relay-agent/`・同時に別の Codex が作る＝**そのフォルダは読みも書きもしない**）
- 画面は変えない。録音の本体（`fetch(record.filepath)`）は今回は直通のまま（設計書 §4-3 第 1 段）

## 作業場所・禁止事項
- 作業ツリー：`C:\garden\a-bloom-008`。**git の操作は一切しない**（commit・branch・checkout・stash 禁止。コミットは人間側）
- 触らない：`.env.local`・`vercel.json`・`scripts/**`・`src/app/system/**`（画面）・`src/app/api/system/innovera-calls/**`。本物の外部サービス（INNOVERA・Supabase 本番・Chatwork）は呼ばない
- **前から落ちているテスト（`KpiCard` 2 本・`BackgroundCarousel` 5 本・`AppHeader` 5 本）は触らない。通すために `src/app/_lib/kpi-fetchers.ts`・`src/components/shared/garden-view/BackgroundCarousel.tsx`・`src/app/_components/AppHeader.tsx` を変えない**
- 文言は日本語・開発者用語を通知文に出さない・絵文字を足さない

## 現状（Claude が読んだ）
- `src/lib/innovera/client.ts`：`callInnovera(ckey, akey, params)` → `callInnoveraOnce` が `POST https://<INNOVERA_API_HOST>/pbx/api/front/index/?ckey=…&akey=…`（本文 `application/x-www-form-urlencoded`・`api_key`＋params・配列は `key[]`）。25 秒で打ち切り。`result:false` は `innovera_unreachable:<error_code>`、HTTP 不正は `innovera_unreachable:http <status>`、その他は `innovera_unreachable:fetch <name>`。`isTransientInnoveraError`（fetch／5xx）なら 2 秒→4 秒で 2 回やり直し。`stripPassword` で password を落として返す。`listInnoveraUsers`／`listInnoveraCircuits` は 10 分キャッシュ
- 管理用 DB クライアント：`getSupabaseAdmin()`（`@/lib/supabase/admin`）。cron の鍵の確かめ方：`verifyBearerRequest(request, "CRON_SECRET")`（`@/lib/cron-auth`・`Authorization: Bearer`）
- 番号同期の cron：`src/app/api/system/innovera-sync/cron/route.ts`（GET・5 分ごと・`maxDuration = 300`）→ `runInnoveraSync`。Chatwork 通知は `ChatworkClient(process.env.CHATWORK_API_TOKEN).sendMessage(process.env.GARDEN_NOTICE_CHATWORK_ROOM_ID || "450125458", 本文)`。失敗通知は「障害ごと 1 回＋回復時 1 回」（`isRepeatedFailure`・`findFailureStreakStart` が前例）
- migration の置き場・命名：`supabase/migrations/20261014000001_<内容>.sql`（直近 `20261009000003_…`）。表は RLS を有効にし、service_role だけが読める（ポリシーを書かない）

## 作るもの

### 1. 表（migration `supabase/migrations/20261014000001_system_relay_jobs.sql`）
- `system_relay_jobs`：`id uuid pk default gen_random_uuid()`／`kind text not null check (kind in ('innovera','kot'))`／`request jsonb not null`／`status text not null default 'queued' check (status in ('queued','running','done','failed','expired'))`／`result jsonb`／`error text`／`requested_by text`（'screen'｜'cron'｜'manual'）／`created_at timestamptz default now()`／`started_at timestamptz`／`finished_at timestamptz`／`expires_at timestamptz not null`。索引 `(status, created_at)`。コメント（日本語）
- `system_relay_heartbeat`：`id text pk`（'host-pc' の 1 行）／`last_seen_at timestamptz not null`／`agent_version text`／`notified_down_at timestamptz`（止まった通知を出した時刻・回復で null）／`updated_at timestamptz`
- 両方 `alter table … enable row level security;`（ポリシー無し＝service_role のみ）

### 2. 部品 `src/lib/relay/`（新規）
- `types.ts`：`RelayKind`・`RelayJobRow`・`RelayRequest`（innovera は `{ ckey, akey, params }`、kot は `{ api, params }`＝今回は型だけ）・`RelayResult`
- `queue.server.ts`（`server-only`）：
  - `enqueueRelayJob(kind, request, requestedBy)` → 行を作る（`expires_at = now + 60 秒`）
  - `waitRelayJob(id, { timeoutMs = 25_000, intervalMs = 1_000 })` → 1 秒ごとに行を読み、`done` なら result、`failed` なら error を投げる、時間切れなら `expired` に更新して投げる
  - `pullRelayJob({ waitMs = 25_000 })` → `queued` かつ `expires_at > now` の最古 1 件を `running`（`started_at`）にして返す。無ければ 1 秒ごとに見直し、`waitMs` で `null`。取り合いは `update … where id = (select id … for update skip locked)` が使えないので **`update … set status='running' where id=? and status='queued'` の更新件数で勝ち負けを決める**（0 件なら次へ）。`expires_at` を過ぎた `queued` は `expired` にする
  - `completeRelayJob(id, { ok, result?, error? })` → `done`／`failed`・`finished_at`
  - `touchRelayHeartbeat(agentVersion)`／`getRelayHeartbeat()`
  - `isRelayAlive(heartbeat, now)`＝`last_seen_at` が 2 分以内
- `monitor.server.ts`：`checkRelayHeartbeat(now)`＝`INNOVERA_RELAY_MODE === "queue"` のときだけ。heartbeat が 5 分より古く `notified_down_at` が null なら Garden通知へ「中継が止まっています」を 1 回送って `notified_down_at` を記録。生きていて `notified_down_at` があれば「回復しました」を 1 回送って null に戻す。Chatwork が無くても結果は変えない。通知文（[info][title]…[/title]…[/info] 形式・番号同期の文に合わせる）：
  - 止まった：`[info][title]ホスト PC の中継（Garden → INNOVERA）[/title]<時刻> 自動\n中継が止まっています。最後に応答があったのは <時刻> です。ホスト PC の電源・ネットワーク・タスク「GardenRelayAgent」を確認してください。\n\n確認：https://garden-os.net/system/innovera[/info]`
  - 回復：`…回復しました。<時刻> から止まっていた中継が応答しています。…`

### 3. API（新規・鍵は `RELAY_SECRET`＝`verifyBearerRequest(request, "RELAY_SECRET")`）
- `POST /api/system/relay/pull`（`src/app/api/system/relay/pull/route.ts`・`runtime = "nodejs"`・`dynamic = "force-dynamic"`・`maxDuration = 60`）：本文 `{ agentVersion?: string, waitMs?: number }`。`touchRelayHeartbeat` → `pullRelayJob({ waitMs: min(waitMs ?? 25000, 25000) })` → `{ ok: true, job: { id, kind, request } | null }`。鍵違いは 401・未設定は 500
- `POST /api/system/relay/result`：本文 `{ id, ok, result?, error? }` → `completeRelayJob` → `{ ok: true }`。無い id は 404。`error` は 200 文字で切る
- どちらも Supabase 失敗は 500 で `{ ok: false, error: "…" }`（日本語）

### 4. `callInnovera` の切替（`src/lib/innovera/client.ts`）
- 環境変数 `INNOVERA_RELAY_MODE`：`direct`（既定・未設定も同じ）＝今のまま／`queue`＝中継
- `queue` のとき `callInnoveraOnce` は：
  1. `getRelayHeartbeat()` を見て 2 分以上古ければ即 `innovera_unreachable:relay_down`（待たない）
  2. `enqueueRelayJob("innovera", { ckey, akey, params }, "screen")` → `waitRelayJob(id, { timeoutMs: 25_000 })`
  3. 戻りは中継（ホスト PC）が INNOVERA の JSON をそのまま返す前提（`{ result, error_code, data }`）。`result === false` は `innovera_unreachable:<error_code>`、`data` を `stripPassword` して返す（直通と同じ形）
  4. 中継側の失敗（`failed` の error）は `innovera_unreachable:relay <error>`、時間切れは `innovera_unreachable:relay_timeout`
- `queue` では `api_key` を本文に入れない（ホスト PC が自分の環境変数から足す）。`getConfig` は `queue` のとき `INNOVERA_API_KEY` 無しでも通す（`INNOVERA_API_HOST` も不要・ホスト PC が持つ）
- やり直し（`callInnovera` の 2 回）は `queue` でも同じ。ただし `relay_down`・`relay_timeout` はやり直さない（`isTransientInnoveraError` を false に）
- `listInnoveraUsers` 等のキャッシュはそのまま

### 5. 生存監視の呼び出し
- `src/app/api/system/innovera-sync/cron/route.ts` の `GET` で `runInnoveraSync` の前に `await checkRelayHeartbeat()`（失敗しても同期は続ける＝try/catch）。vercel.json は触らない（5 分ごとの既存 cron に相乗り）

### 6. 環境変数の案内（コードに書くのは読む側だけ・値は人間が入れる）
- `RELAY_SECRET`（Vercel と ホスト PC で共有）／`INNOVERA_RELAY_MODE`（direct｜queue）。`.env.example` があればそこに 2 行足す（無ければ作らない）

## テスト（vitest・既存の流儀＝`sync.server.test.ts` の `vi.mock("@/lib/supabase/admin")` を参考）
1. `queue.server.test.ts`：enqueue→pull で同じ行が `running` になる／`pull` は `queued` 0 件なら `waitMs` 後に null（タイマーは `vi.useFakeTimers`）／`complete` で `done`・`failed`／`waitRelayJob` が `done` で result を返し、`failed` で投げ、時間切れで `expired` にして投げる／取り合いで更新 0 件なら次の行へ
2. `monitor.server.test.ts`：5 分超・未通知→1 回通知＋記録／通知済みなら送らない／回復で 1 回送って null／`direct` モードは何もしない
3. `client.test.ts` に追加：`queue` モードで enqueue→wait の結果が直通と同じ形で返る（password が落ちる）／heartbeat が古いと `relay_down` で即失敗しやり直さない／`result:false` が `innovera_unreachable:<code>`
4. `pull`／`result` の route テスト：鍵なし 401・鍵違い 401・未設定 500・正常 200
5. 既存テスト（`src/lib/innovera/**`・`src/app/api/system/innovera-sync/**`）は緑のまま。**KpiCard・BackgroundCarousel・AppHeader の 12 本は前から落ちている＝対象外**

## 完了報告（コードブロックで。東海林さんがそのまま読む）
1. 変えたファイル一覧（新規／変更）
2. `npx tsc --noEmit` と `npx vitest run src/lib/relay src/lib/innovera src/app/api/system/relay src/app/api/system/innovera-sync` の結果（件数）
3. 本番に適用する SQL（migration のパス）と、Vercel に足す環境変数の名前（値は書かない）
4. 迷った点・決め打ちした点（特に取り合いの決め方・時間切れの扱い）
