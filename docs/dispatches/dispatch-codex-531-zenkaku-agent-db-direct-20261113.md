# Codex-531 前確 FileMaker ブリッジの「次の仕事」の問い合わせを Vercel を通さずデータベースへ（2026-11-13）

作業場所：`C:\garden\a-bloom-008`（main）。

**git は触らない（commit もしない）。computer-use・ブラウザ操作は使わない。本番に書き込まない（migration は作るだけ・適用は Claude）。FileMaker・Garden 本番 API・Supabase 本番を本当に呼ばない（テストはモック）。** ファイルは UTF-8（日本語入り ps1 は今と同じ UTF-8 BOM 付き）・既存の改行に合わせる。文字化け（??）を残さない。必要な範囲だけ読む。

## 背景（Claude が Vercel の画面で確かめたこと）

ホスト PC の `scripts/zenkaku-agent/ZenkakuAgent.ps1` は `pollSeconds`（3）ごとに `GET /api/system/zenkaku-agent/next` を呼ぶ。12 時間で約 1 万 5 千回・月に約 90 万回で、Vercel の「関数の呼び出し」「記録の件数（Observability Events・今の月 10.65 ドル）」の大半を占める。ほとんどは「仕事なし」の空振り。

同じ問題を、中継の係（`scripts/relay-agent`）は Vercel を通さず Supabase の関数を直接呼ぶ形で解いた（`supabase/migrations/20261027000455_relay_agent_rpc.sql` の `system_relay_agent_pull`：anon キー＋エージェントの秘密を sha256 で照合する security definer）。これと同じ形にする。

## やること

### 1. migration（作るだけ）

- 秘密の要約を置く場所を用意（例：小さな表 `system_zenkaku_agent_auth(id text primary key, secret_hash text, last_seen_at timestamptz, agent_version text)`・RLS 有効・ポリシーなし）。
- `public.system_zenkaku_agent_next(p_secret text, p_agent_version text) returns jsonb`（security definer・`search_path = public, extensions`）：秘密を照合（違えば `raise exception 'unauthorized'`）→ last_seen_at 更新 → 今の `/api/system/zenkaku-agent/next` と同じ順で `system_zenkaku_submit_claim_next()`、無ければ `system_zenkaku_claim_next()` を呼び、`{ id, salesId, operation: "submit" | "check" }` か null を返す。
- `anon` に execute を grant、`public` からは revoke（relay の migration に合わせる）。
- 既存の `/api/system/zenkaku-agent/next` は残す（入れ替え前のエージェントと、設定で戻したとき用）。

### 2. エージェント

- 設定 `transport`：`"supabase"`（新）／`"garden"`（今まで）。`supabase` のときは `SUPABASE_URL`・`SUPABASE_ANON_KEY`・秘密（今の `ZENKAKU_AGENT_SECRET` と同じ値を使ってよい）で RPC `system_zenkaku_agent_next` を `Invoke-RestMethod` で呼ぶ。結果の送信（`result`・`submit-result`）は今のまま Garden の API（件数が少ないため）。
- 仕事が無い間の間隔：`pollSeconds`（3）はそのまま（DB を直接見るので Vercel の料金に関係しない・前確の待ち時間を延ばさない）。
- 失敗が続くとき（DB に届かない等）は、今と同じログを出し、間隔を最大 30 秒まで伸ばす（成功したら戻す）。

### 3. ホスト PC での入れ替え手順

- `scripts/zenkaku-agent/install-db-direct-paste.txt`：①秘密の要約を DB に入れる SQL は Claude が流すので、手順には「Claude に依頼」とだけ書く ②タスク停止 ③ps1 置き換え・config に transport と SUPABASE_URL・SUPABASE_ANON_KEY を足す（値は貼る人が入れる欄にする・鍵をファイルに直書きしない今のやり方に合わせる）④タスク再開 ⑤ログで `transport=supabase` と仕事の取得が動くのを確かめる。戻し方（transport を garden に戻す）も書く。
- README に追記。

## テスト

- migration：秘密違いで unauthorized／submit を check より先に返す／仕事が無ければ null（既存の migration テストの形があれば合わせる。無ければ SQL の中身を報告に書く）
- エージェント：transport ごとの呼び先・失敗時の間隔の伸び縮み（今のテストの形に合わせる）
- 既存の `/api/system/zenkaku-agent/*` のテストが通ること
- `npx tsc --noEmit`、`npx vitest run src/app/api/system/zenkaku-agent` が通ること

## 終わったら

`docs/dispatches/report-codex-531-zenkaku-agent-db-direct-20261113.md` に、直したファイル・migration のファイル名・テスト結果・迷って決めたこと。マニュアルは不要（Claude がやる）。
