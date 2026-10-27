# Codex-455：ホストPCの中継（relay-agent）を Vercel を通さずデータベースを直接見る形に（2026-10-27）

## なぜ
Vercel の使用量のメール（2026-10-27）で「関数のメモリの時間」が前の月の 16 倍。原因＝ホストPCの係（`scripts/relay-agent/agent.mjs`）が `POST /api/system/relay/pull` を 1 回最大 25 秒つなぎっぱなしで待つのを 24 時間くり返し、Vercel の関数が一日中 1 本動き続けている（直近 12 時間：2,000 回・1 回 26 秒）。
→ 係が **Supabase の関数（RPC）を直接呼ぶ**形にし、Vercel の関数を通さない。待ち行列の表（`system_relay_jobs`）と生存確認（`system_relay_heartbeat`）は今のまま使う。

## やること
### A. migration（`supabase/migrations/20261027000455_relay_agent_rpc.sql`・作るだけ。本番には Claude が当てる）
1. `system_relay_heartbeat` に `agent_secret_hash text` を足す（中身は Claude が入れる。ホストPCの合言葉 RELAY_SECRET の sha256 の 16 進）。
2. `public.system_relay_agent_pull(p_secret text, p_agent_version text) returns jsonb`（security definer・`set search_path = public, extensions`）：
   - `encode(extensions.digest(p_secret,'sha256'),'hex')` が `system_relay_heartbeat`（id='host-pc'）の `agent_secret_hash` と違う、またはハッシュが空なら `raise exception 'unauthorized'`。
   - 生存確認を今の `touchRelayHeartbeat`（`src/lib/relay/queue.server.ts`）と同じ列で更新する（同じ値の意味にそろえる。読んで合わせること）。
   - 期限切れを今の `expireQueuedJobs` と同じ条件で expired に。
   - 今の `findQueuedJob`＋`claimQueuedJob` と同じ条件で 1 件を取る。**`for update skip locked`** で 2 重取りを防ぎ、`status='running', started_at=now()`。
   - 返り値：仕事があれば `{"id":…,"kind":…,"request":…}`、無ければ `null`。
3. `public.system_relay_agent_result(p_secret text, p_id uuid, p_ok boolean, p_result jsonb, p_error text) returns boolean`：合言葉の確かめ方は同じ。中身は今の `completeRelayJob` と同じ（ok なら done・result、だめなら failed・error 既定 'relay_failed'・finished_at）。見つからなければ false。
4. 2 つの関数は `revoke all … from public` のあと **`grant execute … to anon`**（係は公開用の鍵＝anon で呼ぶ。合言葉は関数の中で確かめる）。表への直接の権限は anon に与えない。

### B. 係（`scripts/relay-agent/agent.mjs`・版 1.2.0）
- 設定 `transport`：`"supabase"`（新しい既定）／`"garden"`（今の Vercel の受け口。戻すとき用に残す）。
- `transport:"supabase"` のとき：
  - 環境変数 `SUPABASE_URL`・`SUPABASE_ANON_KEY`（公開用の鍵）と今の `RELAY_SECRET` を使う。`validateEnvironment` もこれに合わせる（garden のときは今のまま）。
  - 取りに行く＝`POST {SUPABASE_URL}/rest/v1/rpc/system_relay_agent_pull`（ヘッダー `apikey` と `Authorization: Bearer <anon>`、本文 `{"p_secret":…, "p_agent_version":…}`）。仕事が無ければ `idleSleepMs`（既定 **2000**）待ってまた聞く。仕事があれば今と同じに INNOVERA／KOT を呼び、`system_relay_agent_result` で結果を返す。
  - 401/403・`unauthorized` は今の `pull:unauthorized` と同じ扱い（ログ＋ errorSleepMs）。
- `config.example.json`・`README.md`（ホストPCでの入れ替え手順：環境変数 2 つを足す→ agent.mjs を差し替え→タスク GardenRelayAgent を再起動→ログに「取りに行く」が出るのを確かめる／戻し方＝`transport` を `garden` に）を直す。
- テスト（`scripts/relay-agent/tests/agent.test.mjs`）：supabase のとき正しい URL・ヘッダー・本文で呼ぶ／仕事なし→ idleSleepMs 待つ／結果を返す呼び方／garden のときは今のまま。

### C. Garden 側
- Vercel の受け口（`/api/system/relay/pull`・`/result`）は**消さない**（戻すとき用）。見張り（`monitor.server.ts`）は heartbeat を見ているので、そのまま動くことをテストで確かめる。
- migration のテスト（文字列で）：2 関数・`for update skip locked`・`grant execute … to anon`・表への anon 権限を与えていない。

## 触らないもの
本番 DB・Storage・Vercel の環境変数・vercel.json・ホストPC。**git は触らないでください。コミットは人間側が行います。** npm install はしない。秘密の値（RELAY_SECRET など）をファイルやテストに書かない。

## 確認
`npx tsc --noEmit`・`npx vitest run src/lib/relay src/app/api/system/relay`・`npx vitest run --config scripts/relay-agent/vitest.config.mjs`。日本語が「???」に化けていないこと。BOM を付けないこと。

## 完了報告（コードブロックで）
変更したファイル／テスト結果（件数・FAIL 0）／ホストPCで入れ替える手順（3〜5 行）。
