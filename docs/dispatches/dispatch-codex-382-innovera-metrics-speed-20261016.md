# Codex-382：INNOVERA の集計 RPC を速くする（結果は 1 文字も変えない）（2026-10-16）

## 背景
- `public.system_innovera_metrics(p_from date, p_to date, p_lp_circuit_ids integer[], p_employee_id text)`（定義＝`supabase/migrations/20261014000004_system_innovera_call.sql` の 102 行目〜）が、2026-01〜10 の過去分を取り込んで `system_innovera_call` が約 66 万件になった結果、REST（service_role）経由で **1 か月＝約 2 秒・3 か月以上＝8 秒の statement timeout で失敗**する。
- 遅い主因：`assigned` で **通話 1 件ごとに** `root_employees` と `system_innovera_daily_extension` を lateral で引いている。

## やること
1. 新しい migration `supabase/migrations/20261016000001_system_innovera_metrics_fast.sql` を作る（**適用は Claude がする。Codex は DB に繋がない**）。
   - 今の関数の中身をそのまま `public.system_innovera_metrics_v1(...)`（同じ引数・同じ返り値・同じ権限）として残す（比較とロールバック用）。
   - `public.system_innovera_metrics(...)` を **同じ引数・同じ返り値の形（jsonb のキー・並び順・型・数値）** のまま、速い書き方に置き換える。方針：
     - 通話を先に **(extension, circuit_id, call_type, dial_status) 単位で集計**（件数と talk_seconds の合計）してから、内線→社員の結び付けを **内線の数だけ** 行う（`root_employees` の直接の内線 `innovera_extension`／`innovera_mobile_extension`。同じ内線に複数いれば今と同じく employee_id の昇順で 1 人）。
     - `system_innovera_daily_extension`（その日の内線＝時刻で変わる）を使うのは、**直接の内線で社員が決まらず、かつ daily_extension にその内線の行がある通話だけ**、今と同じ条件（started_at ≤ start_time < coalesce(ended_at, 翌日 0:00 JST)・started_at の新しい順で 1 件）で 1 件ずつ引く。それ以外は集計済みの値を使う。
     - `employee_metrics`・`unassigned`・`circuit_metrics`・`last_sync_at`・`has_rows`・`authorized` の中身と並び順（order by）を今と完全に同じにする。権限の判定（service_role か staff 以上）も同じ。
     - 必要なら索引を足してよい（例：`(start_time) include (...)` など）。足したら理由をコメントに書く。
   - 権限（revoke／grant）は今と同じものを v1 と新しい関数の両方に付ける。
2. 比較用スクリプト `scripts/innovera-metrics-verify/verify.mjs` を作る（Claude が実行する）。
   - `.env.local` の `DATABASE_URL` に `pg` で接続し、トランザクション内で `select set_config('request.jwt.claims', '{"role":"service_role"}', true)` を入れてから、**v1 と新しい関数の結果（jsonb）を比べる**。比べる範囲：2026-01-01〜2026-10-15 の **毎日**／**毎月**／**全期間**／`p_employee_id` に実在の社員 3 人を入れた全期間。`p_lp_circuit_ids` は `[164,165]` と、`system_innovera_call` に実際に出てくる LP 回線（引数で渡せるように）。
   - jsonb は `JSON.stringify` で並びも含めて完全一致で比べ、違ったらその範囲と最初の差分を出して終了コード 1。最後に「一致 n 件／不一致 n 件」と、新しい関数の全期間の所要時間（ms）を出す。
   - DB は読むだけ（関数を呼ぶだけ）。
3. `supabase/migrations` の命名・書き方は既存に合わせる（`begin; … commit;` で包む）。

## 守ること
- **commit しない・push しない**。DB に接続しない（migration の適用・スクリプトの実行は Claude）。
- `src/` のアプリのコードは変えない（RPC の名前・引数・返り値が同じなので不要）。
- 前から落ちているテストは無いはずだが、関係の無いファイルは触らない。

## 報告（日本語・コードブロックで）
- 新しい関数の考え方（どこで速くしたか）
- 作ったファイル
- 結果が今と同じになると言える理由（特に daily_extension の扱い）
