# Codex-378：テレマ コール集計 v1.7 ①＝INNOVERA 通話履歴の写し（表・取込・5 分ごとの cron・過去分スクリプト）と集計 RPC 2 本、Root の「FileMaker 社員名」（2026-10-14）

## 目的
槙さんの仕様書 v1.7（`C:\Users\shoji\Downloads\仕様書①_テレマコール集計ポータル_4_仕様書_v1.7_LP系と通話時間を追加.md`・以下「仕様書①」）の **土台（DB・取込・RPC・Root の列）** を作る。画面・配信・PDF・kintone の読み取り・合流は次の Codex-379／380 で行う＝**この指示書では画面と配信を変えない**。

仕様書①の該当節＝§3（データモデル）・§4（経路）・§5.5.2（INNOVERA から作る数・RPC `system_innovera_metrics`）・§5.6.6（RPC `system_innovera_funnel_calls`）・§6.2（取込）・§7.2（最終取込の決め方）・§8（環境変数）・§13（検算値）。**仕様書①の該当節を先に読む**（長いので上の節だけ）。

### 仕様書①からの変更点（東海林さん決定 2026-10-14・②§4 の F・G・H）
- **ホスト PC に新しい常駐（`scripts/innovera-agent/`・PowerShell）は作らない**。5 分ごとの取込は **Garden の cron** が、既存の `callInnovera`（`src/lib/innovera/client.ts`）で INNOVERA を読む。`callInnovera` は `INNOVERA_RELAY_MODE=queue` にすると自動でホスト PC 中継（`scripts/relay-agent/`・`src/lib/relay/`）経由になるので、中継の切替後もコードを変えずに固定 IP から読める。
- **過去分（2026-01-01〜）だけ**は Node の単発スクリプト `scripts/innovera-backfill/backfill.mjs` で、INNOVERA を直接読んで取込 API へ送る（ホスト PC か東海林さんの PC で実行）。
- 環境変数の名前は既存の形に合わせる（§8 の `KINTONE_DOMAIN` 等は使わない）。この指示書で足すのは **`INNOVERA_INGEST_SECRET`** だけ（INNOVERA の鍵は既存の `INNOVERA_API_HOST`／`INNOVERA_API_KEY`）。

## 作業場所・禁止事項
- 作業ツリー：`C:\garden\a-bloom-008`。**git の操作は一切しない**（commit・branch・checkout・stash 禁止。コミットは人間側）
- **`vercel.json` は触らない**（cron の行は Claude が確認後に足す＝初回は止めて配備する決まり）。`.env.local`・`scripts/relay-agent/**`・`scripts/callcenter-agent/**`・`src/lib/relay/**`・`src/lib/innovera/client.ts`（呼び出し部品は読むだけ）・`src/app/system/call-metrics/**`・`src/app/api/system/call-report/**`・`src/app/api/system/call-metrics/**`（画面と配信は次の指示書）は触らない
- **前から落ちているテスト（`KpiCard` 2 本・`BackgroundCarousel` 5 本・`AppHeader` 5 本）は触らない。通すために `src/app/_lib/kpi-fetchers.ts`・`src/components/shared/garden-view/BackgroundCarousel.tsx`・`src/app/_components/AppHeader.tsx` を変えない**
- 本物の外部サービス（INNOVERA・Supabase 本番・kintone）は呼ばない（テストは偽の fetch／偽の client）。長い説明は不要・ファイルは必要な範囲だけ読む。画面文言・コメントは日本語

## 既存の部品（読むだけ）
- INNOVERA 呼び出し：`src/lib/innovera/client.ts` の `callInnovera(ckey, akey, params)`（やり直し 2 回・中継モード対応・結果は `data` 配列）。`cdr/search` の引数は `start_time_start`／`start_time_end`（`YYYY-MM-DD HH:MM:SS`・JST）／`page`／`limit`。**既存の `searchInnoveraCalls` は `limit=50000`・5 ページまで・キャッシュつき＝取込には使わず、`callInnovera` を直接 `limit=1000` のページ送りで呼ぶ**（§6.2）。履歴 1 件の形＝`src/lib/innovera/types.ts` の `InnoveraCallRaw`（`id,uniqid,linkedid,circuit_id,circuit_name,circuit_num,caller_num,callee_num,call_type,dial_status,talk_time,start_time,answer_time,end_time,who_hangup,record_file_flg,…`。2026-10-13 実測＝1 日 2,725 件・全列あり）
- cron の認証：`src/lib/cron-auth.ts` の `verifyCronRequest`。手本＝`src/app/api/system/innovera-sync/cron/route.ts`（GET・`runtime="nodejs"`・`dynamic="force-dynamic"`）
- 取込 API の手本：`src/app/api/system/call-ingest/route.ts`（Bearer `CALL_INGEST_SECRET`・`{ rows: [...] }`・500 件上限・upsert・sync_log）
- Root 従業員編集：`src/app/root/employees/page.tsx`（「外部ID連携」の枠に `innovera_extension` がある）・`src/app/root/_lib/validators.ts`（`RE_INNOVERA_EXTENSION` の並び）・`src/app/root/_lib/queries.ts`（46 行目の列一覧）・`src/app/api/root/employees/route.ts`。**名簿同期（`src/app/api/root/roster-sync/**`）が `root_employees` を上書きするときに新しい列を消さないこと**（同期が触る列を確かめ、`filemaker_employee_name` は同期の対象外にする）
- 管理用 DB：`getSupabaseAdmin()`。migration の置き場 `supabase/migrations/20261014000004_<内容>.sql`（`…000003` まで使用済み）
- 日ごとの内線：`system_innovera_daily_extension`（`src/lib/innovera/daily-extension.ts`・migration `20261009000002`・列＝`employee_id text,work_date date,extension text,started_at timestamptz,ended_at timestamptz`）
- `root_employees.employee_id` は **text（'EMP-0001' の形）**

## 作るもの

### 1. migration `supabase/migrations/20261014000004_system_innovera_call.sql`（1 回で貼って実行できる形・`begin; … commit;`）
1. **`system_innovera_call`**（仕様書①§3 のとおり）：`innovera_id text primary key`／`uniqid text`／`linkedid text`／`circuit_id integer not null default 0`／`circuit_name text`／`circuit_num text`／`caller_num text`／`callee_num text`／`call_type smallint`／`dial_status smallint`／`talk_seconds integer not null default 0`／`start_time timestamptz not null`／`answer_time timestamptz`／`end_time timestamptz`／`who_hangup text`／`record_file_flg text`／`raw jsonb`（API の 1 件をそのまま・参考）／`imported_at timestamptz not null default now()`／**`caller_num_norm text generated always as (system_innovera_norm_number(caller_num)) stored`・`callee_num_norm text generated always as (system_innovera_norm_number(callee_num)) stored`**。
   - 関数 `system_innovera_norm_number(text) returns text immutable`＝数字だけにし、先頭が `81` で 11 桁以上なら先頭の `81` を `0` に（§5.6.1）。空は null
   - インデックス＝`(start_time)`・`(circuit_id, start_time)`・`(callee_num, start_time)`・`(caller_num, start_time)`・`(callee_num_norm, start_time)`・`(caller_num_norm, start_time)`
   - RLS 有効・ポリシー無し（service_role だけ）。列コメント（日本語）
2. **`system_innovera_ingest_log`**（★仕様書①の `system_innovera_sync_log` は **INNOVERA番号の同期がすでに同じ名前で使っている**（`20261007000001`）ので、取込の記録は **`system_innovera_ingest_log`** にする。既存の `system_innovera_sync_log`・`system_innovera_call_logs`（`20261008000002`・通話画面の記録）は触らない）：`id uuid pk default gen_random_uuid()`／`run_id text`／`mode text`（`poll`／`daily`／`backfill`）／`range_from timestamptz`／`range_to timestamptz`／`fetched integer`／`sent integer`／`upserted integer`／`skipped integer`／`status text check (status in ('success','failed'))`／`error text`／`started_at timestamptz default now()`／`finished_at timestamptz`。索引 `(status, finished_at desc)`。RLS 有効・ポリシー無し
3. **`root_employees.filemaker_employee_name text`**（null 可・**空文字は入れない**＝check `(filemaker_employee_name is null or length(btrim(filemaker_employee_name)) > 0)`・**null 以外は一意** `create unique index … where filemaker_employee_name is not null`）。コメント「FileMaker コール履歴の社員名と同じ文字。テレマ集計で FileMaker・INNOVERA・kintone を 1 行に合わせる鍵」
4. **RPC `system_innovera_metrics(p_from date, p_to date, p_lp_circuit_ids integer[], p_employee_id text default null)`**（`security definer`・`search_path` 固定・実行許可＝`auth.role()='service_role'` または staff 以上＝既存 `system_call_metrics` の許可の書き方をそのまま使う。返り jsonb）。**`p_employee_id` の型は `root_employees.employee_id` と同じ型にする**（text 'EMP-1394' の形・仕様書①の uuid は誤り）
   - 対象行＝`start_time` が `p_from` 00:00 JST 以上・`p_to` の翌日 00:00 JST 未満
   - **内線→人**（§5.5.2）：担当の内線＝発信（`call_type` 2）なら `caller_num`、着信（1）なら `callee_num`。(a) `root_employees` の `innovera_extension`／`innovera_mobile_extension`（`is_active=true`・`deleted_at is null`）に一致 → (b) 無ければ `system_innovera_daily_extension`（列＝`employee_id text`・`work_date date`・`extension text`・`started_at timestamptz`・`ended_at timestamptz`＝`20261009000002`）で `extension` が一致し `started_at <= start_time < coalesce(ended_at, work_date の翌日 00:00 JST)` の従業員 → (c) どちらにも無い＝「内線未登録」（内線ごとに集計）
   - 返り＝`{ employee_metrics: [{ employee_id, talk_seconds_other, lp_answered, lp_outbound, lp_talk_seconds }], unassigned: [{ extension, talk_seconds_other, lp_answered, lp_outbound, lp_talk_seconds }], circuit_metrics: [{ circuit_id, inbound, answered, missed, voicemail, outbound, outbound_answered, talk_seconds }], last_sync_at, has_rows, authorized: true }`
     - `talk_seconds_other`＝`call_type` 1・2 で **`circuit_id` が `p_lp_circuit_ids` に無い**行の `talk_seconds` 合計／`lp_answered`＝LP 回線の着信で `dial_status` 1／`lp_outbound`＝LP 回線の発信（全部）／`lp_talk_seconds`＝LP 回線の 1・2 の `talk_seconds` 合計
     - `circuit_metrics`＝`p_lp_circuit_ids` の回線だけ：`inbound`＝1 の全部／`answered`＝1 かつ `dial_status` 1／`missed`＝1 かつ `dial_status` 2 または 3／`voicemail`＝`call_type` 8／`outbound`＝2 の全部／`outbound_answered`＝2 かつ 1／`talk_seconds`＝1・2 の合計
     - `last_sync_at`＝`system_innovera_ingest_log` の `status='success'` の最後の `finished_at`（期間に関係なく最新）／`has_rows`＝期間に行が 1 件でもあるか
     - `p_employee_id` が指定されたら `employee_metrics` はその人だけ（`unassigned`・`circuit_metrics` は変えない）
5. **RPC `system_innovera_funnel_calls(p_from date, p_to date, p_as_of timestamptz, p_lp_circuit_ids integer[], p_numbers text[])`**（§5.6.6・同じ許可）：返り `{ inbound: [...], outbound: [...], authorized: true }`。`inbound`＝期間内の LP 回線の着信（`circuit_id, caller_num_norm, start_time, dial_status, callee_num`）。`outbound`＝`p_from` 00:00 JST から `p_as_of` までの、`caller_num` が 3〜5 桁の数字の発信（`callee_num_norm, start_time, dial_status, caller_num, circuit_id`）のうち、宛先が inbound の発信元か `p_numbers` に含まれる行だけ（回線は絞らない）
6. 末尾に検算用の `select`（表と関数の存在確認）。**既存の表・RPC・ポリシーは変えない**

### 2. 取込 API `POST /api/system/innovera-ingest`（`src/app/api/system/innovera-ingest/route.ts`）
- 認証＝`Authorization: Bearer <INNOVERA_INGEST_SECRET>`（env 未設定なら 503・違えば 401）。body＝`{ rows: InnoveraCallRaw[], mode?: "poll"|"daily"|"backfill", run_id?: string }`。1 回 500 件まで（超えたら 400）
- 行の変換＝共通部品 `src/lib/innovera/ingest.ts` に `normalizeInnoveraRow(raw)`：`innovera_id=String(id)`／`talk_seconds`＝`HH:MM:SS` を秒（空・null は 0）／`start_time`・`answer_time`・`end_time`＝INNOVERA の文字列を **JST として読み UTC に**（`0000-00-00 00:00:00`・空は null。`start_time` が無い・不正・`id` が無い行は捨てて `skipped` に数える）／`circuit_id`＝数値（無ければ 0）／`call_type`・`dial_status`＝数値／`raw`＝元の 1 件
- upsert＝`innovera_id` で `on conflict do update`（`ignoreDuplicates:false` 明示・mutable 列を全部上書き・`imported_at=now()`）。結果 `{ ok, received, upserted, skipped }`。sync_log への記録は呼び出し側（cron・スクリプト）が行う＝この API は書かない（1 回の run で複数バッチがあるため）
- テスト：認証／500 件超／変換（`talk_time` → 秒・JST→UTC・不正行スキップ）／upsert の呼び方

### 3. 5 分ごとの取込 `GET /api/system/innovera-ingest/cron`（`verifyCronRequest`）と深夜の読み返し `GET /api/system/innovera-ingest/daily`
- 共通部品 `src/lib/innovera/ingest.server.ts` に `runInnoveraIngest({ mode, from, to })`：
  1. `callInnovera<InnoveraCallRaw[]>("cdr","search",{ start_time_start, start_time_end, page, limit: 1000 })` を **1,000 件未満になるまでページ送り**（`page` と `limit` は両方指定）
  2. 変換→500 件ごとに upsert（API を HTTP で呼ばず、同じ `ingest.ts` の関数で直接 DB へ）
  3. `system_innovera_ingest_log` に 1 行（`run_id`・`mode`・`range`・`fetched`・`sent`・`upserted`・`skipped`・`status`・`error`・`finished_at`）。失敗（INNOVERA のエラー・HTTP 429・接続失敗）は `failed` で記録して 200 を返す（cron を落とさない）
- `cron`（5 分ごと）：`from`＝**最後に成功した run の `range_to` − 180 分**（無ければ **いま − 7 日**）、`to`＝いま（JST の文字列に変換して渡す）。§6.2 の「重なり 180 分」＝取込時点で通話中だった行（`end_time` 空）を次回以降に上書きするため
- `daily`（深夜 3:00 JST に 1 回）：`from`＝前日 0:00 JST、`to`＝当日 3:00 JST を丸ごと読み返す（遅れて確定した `end_time`・`talk_time`・録音フラグの追従）
- **`vercel.json` には足さない**（Claude が確認後に `{ path: "/api/system/innovera-ingest/cron", schedule: "*/5 * * * *" }` と `{ path: "/api/system/innovera-ingest/daily", schedule: "0 18 * * *" }`（UTC 18:00＝JST 3:00）を足す）。README かコメントに書いておく
- テスト：from/to の決め方（初回・2 回目・180 分重なり）／ページ送り／失敗時に `failed` で記録して 200／偽の `callInnovera`（`vi.mock("@/lib/innovera/client")`）

### 4. 過去分スクリプト `scripts/innovera-backfill/backfill.mjs`（Node 20・追加パッケージ無し・`README.md` つき）
- 使い方：`node backfill.mjs --from 2026-01-01 --to 2026-10-13 [--dry] [--api https://garden-os.net]`。環境変数＝`INNOVERA_API_HOST`・`INNOVERA_API_KEY`・`INNOVERA_INGEST_SECRET`（値はスクリプトに書かない）
- **1 日単位**に分割して INNOVERA を直接読み（`https://<host>/pbx/api/front/index/?ckey=cdr&akey=search`・POST form・`api_key`・`start_time_start/end`・`page`・`limit=1000`＝`client.ts` の `callInnoveraOnce` と同じ呼び方）、500 件ごとに `POST <api>/api/system/innovera-ingest`（`mode:"backfill"`・`run_id`＝日付）へ送る。日ごとに `同期ログ` を `POST <api>/api/system/innovera-ingest/log`（Bearer 同じ・`{ run_id, mode, range_from, range_to, fetched, sent, upserted, skipped, status, error }`）で 1 行書く＝この log 用の小さな API も作る
- 落ちた日から再開できるよう、進んだ日を `state.json` に書く（`--from` 省略時は state の翌日から）。429（5 分 200 回）は 60 秒待って同じ日をやり直す（3 回まで）。個人の電話番号はログに出さない（件数だけ）
- テスト（`scripts/innovera-backfill/tests/`・vitest）：日の分割／ページ送り／429 の待ち／state の前進

### 5. Root の「FileMaker 社員名」
- 従業員編集（`src/app/root/employees/page.tsx`）の「外部ID連携」に **「FileMaker 社員名」** の欄（`innovera_extension` の近く・説明「テレマ集計で FileMaker のコール履歴と合わせる名前。コール履歴の社員名と同じ文字で」）。保存は既存の `PUT/POST /api/root/employees` の流れに乗せる（`queries.ts` の列一覧・`validators.ts`＝前後の空白を取り、空なら null、他の人と同じ文字なら「この FileMaker 社員名は別の従業員に登録されています」）
- 一覧の表示列には足さない（編集画面だけ）
- 名簿同期（roster-sync）が `root_employees` を更新するとき `filemaker_employee_name` を **触らない**ことをコードで確かめ、必要なら除外。テスト 1 本
- 権限一覧（`src/lib/auth/permission-registry.ts`）は変えない

### 6. 環境変数の案内
- Vercel：`INNOVERA_INGEST_SECRET`（新規・Claude が生成して登録）。`.env.example` があれば 1 行足す
- ホスト PC／東海林さん PC（過去分スクリプト用）：`INNOVERA_API_HOST`・`INNOVERA_API_KEY`・`INNOVERA_INGEST_SECRET`

## テスト（vitest）
- 上の各項目のテスト＋既存テスト（`src/lib/innovera/**`・`src/app/api/system/**`・`src/app/root/**`・`src/app/api/root/**`）は緑のまま。**KpiCard・BackgroundCarousel・AppHeader の 12 本は前から落ちている＝対象外**
- migration の SQL は手で読んで検算（`begin;…commit;` で 1 回貼りに耐えること・既存の表に `alter` するのは `root_employees` の列追加だけ）

## 完了報告（コードブロックで。東海林さんがそのまま読む）
1. 変えたファイル一覧（新規／変更）
2. `npx tsc --noEmit` と `npx vitest run src/lib/innovera src/app/api/system/innovera-ingest src/app/root src/app/api/root scripts/innovera-backfill` の結果（件数）
3. 本番に適用する SQL（migration のパス）／Vercel に足す環境変数の名前（値は書かない）／`vercel.json` に Claude が足す cron の 2 行／過去分スクリプトの実行手順（1 行）
4. 迷った点・決め打ちした点（特に「内線→人」の (b) の列名・`p_employee_id` の型）
