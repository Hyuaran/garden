# Codex-530b コール集計の更新マークを押したら、ホスト PC の係がすぐ取り直す（2026-11-13）

作業場所：`C:\garden\a-bloom-008`（main）。Codex-530（まだ commit していない差分）の続き。

**git は触らない（commit もしない）。computer-use・ブラウザ操作は使わない。本番に書き込まない（migration は作るだけ・適用は Claude）。FileMaker・Garden 本番 API・Supabase 本番を本当に呼ばない（テストはモック）。** ファイルは UTF-8（日本語入り ps1 は UTF-8 BOM 付き・CRLF＝Codex-530 に合わせる）。文字化け（??）を残さない。必要な範囲だけ読む。コードは周りと同じく読みやすく書く。

## 決め（東海林さん 2026-11-13）

「1 日 1 回（の全送り）だとしても、更新マークを押したときは強制的に取得するようにして」

- `/system/call-metrics` の「コール履歴 最終更新：…」の横の更新マーク（`UpdatedStamp`）は、今は `onRefresh` なし＝押せない（「自動で更新されます」）。これを押せるようにする。
- 押したら、ホスト PC の係（`scripts/callcenter-agent`）が **すぐ**、今日と昨日（`refreshWindowDays`）の行を **要約に関係なく全部** FileMaker から読み直して送る。終わったら画面の数字を読み直す。
- 通常の 5 分ごとの送り込み（変わった行だけ・Codex-530）と 1 日 1 回の全送りはそのまま。

## Vercel の料金を増やさない作り（`900_Rules/030` §3・AGENTS.md）

- 係が「押されたか」を見るのは **Vercel を通さず Supabase の関数を直接**（前確ブリッジの `supabase/migrations/20261113000531_zenkaku_agent_rpc.sql`・中継の `system_relay_agent_pull` と同じ形：anon キー＋係の秘密を sha256 で照合する security definer）。間隔 `forceCheckSeconds`（既定 10 秒）。
- 画面の待ち（押してから終わるまで）は `usePolling` で 3 秒ごと・最大 3 分だけ。待っていないときは聞かない。
- 1 日の回数の見積もりを報告に書く。

## やること

### 1. migration（作るだけ）

- 表 `system_call_sync_requests`（id uuid・requested_by（社員番号など）・requested_at・status：queued／running／done／failed・started_at・finished_at・error）。RLS 有効・ポリシーなし（読み書きは Garden の API＝service role と下の関数だけ）。
- 係の認証：`system_callcenter_agent_auth(id='host-pc', secret_hash, last_seen_at, agent_version)`（531 と同じ形）。秘密は今の `CALL_INGEST_SECRET` と同じ値を使ってよい（要約の登録は Claude）。
- `system_callcenter_agent_take_request(p_secret, p_agent_version) returns jsonb`：照合→last_seen_at 更新→queued の一番古い 1 件を running にして `{ id }` を返す（無ければ null）。10 分以上 running のままのものは failed（`stale`）にする。
- `system_callcenter_agent_finish_request(p_secret, p_id, p_ok, p_error) returns boolean`。
- anon に execute を grant、public から revoke。

### 2. Garden の API

- `POST /api/system/call-metrics/sync-request`：コール集計を見られる人（`canView("system-call-metrics", …)` の今の判定に合わせる）だけ。queued／running が既にあればそれを返す（重ねない）。係の last_seen_at が 2 分より古ければ 503 と「ホスト PC の係が止まっています。少し待ってからもう一度押してください。」。
- `GET /api/system/call-metrics/sync-request?id=…`：status を返す（done／failed なら finished_at・error も）。

### 3. 画面（`src/app/system/call-metrics/CallMetricsClient.tsx`）

- `UpdatedStamp` に `onRefresh`・`busy`・`refreshLabel="最新のコール履歴を取り直す"`。押したら POST → `usePolling`（3 秒・最大 3 分）で GET → done なら今の `load()` で読み直し、busy を外す。failed／時間切れ／503 は **画面の上** にエラーの知らせ（今の画面のエラーの出し方に合わせる）。
- 二重押しは busy 中に止める（UpdatedStamp の busy で押せない）。

### 4. 係（`scripts/callcenter-agent`）

- 常駐の待ちの間（`pollSeconds`＝300 秒の間）、`forceCheckSeconds` ごとに `system_callcenter_agent_take_request` を呼ぶ（`transport`／`SUPABASE_URL`／`SUPABASE_ANON_KEY` は 531 の前確ブリッジと同じ取り方・マシン環境変数）。SUPABASE の設定が無ければこの機能だけ動かさず、今の動きは続ける（ログに 1 回だけ出す）。
- 要求があれば、すぐ今日と昨日の読み返しを **要約を見ずに全部送る**（成功したら要約も更新）。終わったら finish（成功／失敗）。通常のポールと重ならないように（同じ実行の中で順番に）。
- `install-changed-only-paste.txt` に、マシン環境変数（SUPABASE_URL・SUPABASE_ANON_KEY）の設定（前確ブリッジで入れていれば不要と書く）と、要約の登録は Claude に依頼、を足す。README に追記。

## テスト

- 関数：秘密違いで unauthorized／一番古い queued を running にして返す／10 分超の running は failed（SQL テストを `supabase/tests` の形で）
- API：見られない人は 403／重ねない／係が止まっていれば 503／status を返す
- 画面：押す→busy→done で読み直し／failed は上に知らせ（既存の画面テストの形に合わせる）
- 係（Pester・32bit も）：要求があれば要約を見ずに全部送る／要求が無ければ何もしない／SUPABASE 設定が無ければ機能だけ止める／finish を呼ぶ
- `npx tsc --noEmit --incremental false`、`npx vitest run src/app/system/call-metrics src/app/api/system/call-metrics src/app/api/system/call-ingest` が通ること

## 終わったら

`docs/dispatches/report-codex-530b-call-metrics-force-refresh-20261113.md` に、直したファイル・migration のファイル名・テスト結果・1 日の回数の見積もり・迷って決めたこと。マニュアルは不要（Claude がやる）。
