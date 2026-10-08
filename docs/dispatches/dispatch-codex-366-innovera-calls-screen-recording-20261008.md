# Codex-366：画面「INNOVERA履歴・録音」＝通話履歴の閲覧・録音の再生（Garden が中継）・自分の発信番号の変更（2026-10-08）

## 目的（東海林さんの言葉）
「自分の SIP で架電/着信した録音音声は切断してから Garden 内で確認できるようにする。あくまで確認するだけで録音音声の削除や履歴の削除はさせない。現状は INNOVERA 管理画面からサブ管理者を作成し聞かせている。アカウント発行の手間もあるので Garden 内で完結させたい。どれだとしても、自分だけ絞って表示できる仕組みがほしい」「自分の SIP アカウントの発信番号を変更するのは API からはできなさそうですか？（いまは管理画面でユーザ固有初期回線を変えている）」→ 設計承認済み。画面名は「**INNOVERA履歴・録音**」（東海林さん指定）。

前提＝Codex-365（Root に `innovera_extension`・`call_recording_access`、`src/lib/innovera/call-access.ts`）が入っていること。

## 作業場所・禁止事項
- 作業ツリー：`C:\garden\a-bloom-008`。**git の操作は一切しない**
- 触ってよい場所：`src/lib/innovera/`（新規 `client.ts`・`calls.ts`・`calls.server.ts` とテスト）・`src/app/api/system/innovera-calls/`（新規）・`src/app/system/innovera-calls/`（新規）・`src/app/system/_components/ShachoShell/shacho-shell-config.ts`（メニュー 1 行）・`src/app/system/forms/_data/gyomu-tools.json`（1 件追加）・`supabase/migrations/`（新規 1 本）・`src/lib/auth/permission-registry.ts`（表記の確認のみ）
- 触らない：`.env.local`・`vercel.json`・`src/lib/innovera/sync.server.ts`（INNOVERA番号の同期。動いている本番機能なので変えない。共通化もしない）・本物の INNOVERA／Supabase／Chatwork（テストはモックだけ）
- **Garden が INNOVERA に書くのは「初期回線一括設定」だけ**。履歴削除・ユーザ編集／削除・回線編集・着信拒否は呼ばない（コードにも入れない）
- 画面の文言に開発者用語を出さない。絵文字なし。色の直書きなし（社長スタイル＝`src/app/system/call-metrics/call-metrics.module.css` を手本に）

## 相手の仕様（INNOVERA 2.0 Web API・実測済み）
共通：`POST https://${INNOVERA_API_HOST}/pbx/api/front/index/?ckey=<ckey>&akey=<akey>`、本文 `application/x-www-form-urlencoded`（`api_key=${INNOVERA_API_KEY}`＋パラメータ・配列は `name[]=`）。返り `{ result, error_code, data }`。5 分 200 回まで。fetch は 25 秒で打ち切る

| 用途 | ckey／akey | 渡すもの | 返るもの（使う項目） |
|---|---|---|---|
| ユーザ（内線）一覧 | users／search | なし | `id`・`name`・`number`（内線番号）・`default_circuit_id`・`section_ids`。**`password` も返るので、画面・ログ・API の返りに絶対に出さない**（取り込んだら捨てる） |
| 回線一覧 | circuit／search | なし | `id`・`name`・`number`・`free_number`・`circuit_num`・`out_users_id`（例 `"#1#3#4#"`＝発信を許されたユーザ ID）・`in_users_id` |
| 電話履歴 | cdr／search | `start_time_start`・`start_time_end`（`YYYY-MM-DD HH:MM:SS`）・`page`・`limit`（最大 50,000）・任意で `uniqid`・`cdr_call_type`・`cdr_dial_status`・`cdr_number`（部分一致） | `id`・`uniqid`・`circuit_id`・`circuit_name`・`caller_num`・`caller_name`・`callee_num`・`callee_name`・`call_type`（1 着信 2 発信 3 内線 4 保留 5 manager 間 6 自動応答 7 自動転送 8 自動留守録 9 会議）・`dial_status`（1 通話成功 2 切断(通話中) 3 切断(不在)）・`talk_time`（`00:00:51` か null）・`start_time`・`answer_time`・`end_time`（`0000-00-00 00:00:00` は未設定）・`record_file_flg`（1 あり 2 なし）・`who_hangup` |
| 録音ファイル URL | cdr／record | `cdr_id` | `data.filepath`（`https://rec03.innov-era.com/.../xxx.wav`・認証なしで開ける・`audio/x-wav`・Range 対応）・`record_type`（1 モノラル 2 ステレオ）。**通話中に呼ぶと録音が壊れる**と仕様書に明記 |
| 初期回線の変更 | users／bulk_initial_circuit | `circuit_id`・`users_ids[]` | 空 |

実測（10/7）：1 日 3,586 件・録音あり 2,531 件。内線は 48。発信の `caller_num` が内線番号、着信の `callee_num` が内線番号（着信で誰も取らないと空）。

## 1. 共通部品（`src/lib/innovera/client.ts`・`calls.ts`）
- `client.ts`：`callInnovera<T>(ckey, akey, params)`（上の共通仕様。失敗は `innovera_unreachable:http 503` / `innovera_unreachable:999` / `innovera_unreachable:fetch TimeoutError` の形で throw）。`listInnoveraUsers()`（password を落として返す）・`listInnoveraCircuits()`・`searchInnoveraCalls({ from, to, uniqid?, number? })`・`getInnoveraRecordingUrl(cdrId)`・`setInnoveraDefaultCircuit(userId, circuitId)`
- 短い記憶（同じ Lambda の中だけ）：ユーザ一覧と回線一覧は 10 分、電話履歴は「同じ日付・同じ条件」で 60 秒。5 分 200 回の上限対策
- `calls.ts`（純粋関数・テスト）：
  - `normalizeCall(raw)`：画面用の形に（時刻・発着の表記・相手番号・担当の内線・通話時間の秒・結果の表記・録音あり・通話中かどうか）。`相手番号`＝発信なら `callee_num`、着信なら `caller_num`。`担当の内線`＝発信なら `caller_num`、着信なら `callee_num`
  - `isCallFinished(raw, now)`：`end_time` が入っていて、**終了から 60 秒以上**たっている
  - `filterCallsForAccess(calls, access, ownExtension)`：`own` なら担当の内線＝自分だけ。それ以外は全部
  - `canPlayRecording(call, access, ownExtension)`：`all` は誰のでも／`all_history_own_audio`・`own` は担当の内線＝自分のときだけ。かつ 録音あり かつ 終了済み
  - `allowedCircuitsForUser(circuits, userId)`：`out_users_id` に `#<userId>#` を含む回線
  - `formatCallType`／`formatDialStatus`：日本語（発信／着信／内線／保留／自動応答／自動転送／自動留守録／会議、通話成功／通話中切断／不在）
- `calls.server.ts`：ログイン中の従業員（`root_employees` の `employee_id`・`garden_role`・`innovera_extension`・`call_recording_access`）→ `resolveCallRecordingAccess` で権限を決める `requireCallAccess()`。`innovera_extension` が空の人は、`all` 以外は「内線番号が登録されていません。管理者へ問い合わせてください」（画面に出す文言・API は 403）

## 2. 記録（移行ファイル `supabase/migrations/20261008000002_system_innovera_call_logs.sql`）
```sql
create table if not exists public.system_innovera_recording_play_log (
  id bigint generated always as identity primary key,
  played_at timestamptz not null default now(),
  employee_id text not null,
  access text not null,              -- そのときの権限
  cdr_id text not null,
  uniqid text,
  call_started_at text,
  own_extension text,
  call_extension text,               -- 録音の担当の内線
  counterpart_number text
);
create index if not exists system_innovera_recording_play_log_played_idx on public.system_innovera_recording_play_log (played_at desc);
alter table public.system_innovera_recording_play_log enable row level security;

create table if not exists public.system_innovera_line_change_log (
  id bigint generated always as identity primary key,
  changed_at timestamptz not null default now(),
  changed_by_employee_id text not null,
  target_employee_id text not null,
  innovera_user_id text not null,
  from_circuit_id text,
  from_circuit_name text,
  to_circuit_id text not null,
  to_circuit_name text,
  ok boolean not null,
  error text
);
alter table public.system_innovera_line_change_log enable row level security;
```
サービスロールだけが書く（ポリシーは足さない）。本番への適用は Claude がやる

## 3. API（`src/app/api/system/innovera-calls/`）
すべてログイン必須・`requireCallAccess()`。`runtime = "nodejs"`・`dynamic = "force-dynamic"`
1. `GET /api/system/innovera-calls?date=YYYY-MM-DD&mine=1&extension=&circuit=&type=&status=&number=`：その日の履歴（日本時間 0:00〜23:59:59）を INNOVERA から読み、`filterCallsForAccess` で絞り、担当の内線 → 従業員名（`root_employees.innovera_extension` で引く。無ければ内線番号のまま）を付けて返す。返りに `password` や録音 URL を含めない。各行に `canPlay`（`canPlayRecording` の結果）と `inProgress` を付ける。`counts`（件数・通話成功・不在・通話中）も返す。`date` は今日から 1 年前まで（INNOVERA の録音保存期間＝1 年。それより前は 400「1 年より前は表示できません」）
2. `GET /api/system/innovera-calls/recording/[cdrId]?uniqid=<uniqid>&date=YYYY-MM-DD`：**権限の確認は API 側でやり直す**（画面の判定を信じない）：①その日の履歴から `uniqid` で 1 件引く（`searchInnoveraCalls({ uniqid })`）②`canPlayRecording` が真でなければ 403 ③`isCallFinished` でなければ 409「通話中は再生できません」④録音 URL を取り、**Garden が中継して返す**：上流へ `Range` をそのまま渡し、`Content-Type: audio/wav`・`Accept-Ranges: bytes`・`Content-Length`／`Content-Range` を写す・`Cache-Control: private, no-store`・`Content-Disposition: inline`。本文は `upstream.body` をそのまま `Response` に渡す（丸ごとメモリに読まない）⑤成功したら `system_innovera_recording_play_log` に 1 行（Range の続きの要求は同じ `cdr_id`・同じ従業員・5 分以内なら記録しない）。**URL を JSON で返す入口は作らない**
3. `GET /api/system/innovera-calls/line`：自分の INNOVERA ユーザ（内線番号で引く）・いまの初期回線（`default_circuit_id` → 回線名と番号）・選べる回線（`allowedCircuitsForUser`）。`manager` 以上は `?employeeId=` で他人の分も見られる
4. `POST /api/system/innovera-calls/line` `{ circuitId, employeeId? }`：対象は自分。`employeeId` を指定できるのは `manager` 以上（東海林さん確定 2026-10-08）。`circuitId` が選べる回線に無ければ 400。`setInnoveraDefaultCircuit` を呼び、結果を `system_innovera_line_change_log` に記録（失敗も記録）
5. `GET /api/system/innovera-calls/mapping`（`admin` 以上）：INNOVERA のユーザ一覧と `root_employees` を内線番号で突き合わせ、「内線が紐づいていない従業員（在籍中）」「従業員に紐づいていない内線」「両方ある」を返す

## 4. 画面（`src/app/system/innovera-calls/`・社長スタイル・`page.tsx`＋`InnoveraCallsClient.tsx`＋`innovera-calls.module.css`）
- メニュー（`shacho-shell-config.ts`）：「テレマ コール集計」の**直後**に `{ label: "INNOVERA履歴・録音", description: "INNOVERA の通話履歴を見て、切断後の録音をその場で聞けます。自分の発信番号の切り替えもここから。", icon: "message", href: "/system/innovera-calls", minRole: "cs" }`。画面側は `requireCallAccess` で `none` なら「この画面を使う権限がありません。管理者へ問い合わせてください」（クローザー・トスで Root の上書きがある人は URL から開ける）
- 業務管理ツールの登録簿 `gyomu-tools.json` に 1 件（group "auto" ではなく "kintone" でもない＝**入力する側ではないので `group: "auto"` に入れ**、`name: "INNOVERA履歴・録音"`・`description: "INNOVERA の通話履歴の閲覧、切断後の録音の再生、自分の発信番号の切り替え。"`・`runsOn: "Garden"`・`target: "INNOVERA"`・`href: "/system/innovera-calls"`・`since: "2026-10-08"`）
- タイトル `INNOVERA履歴・録音 | Garden`。パンくず System ／ INNOVERA履歴・録音

```
System ／ INNOVERA履歴・録音
INNOVERA履歴・録音
INNOVERA の通話履歴を見て、切断してから 1 分たった通話の録音をその場で聞けます。録音や履歴は消せません。

┌ 自分の発信番号 ──────────────────────────────────────────────┐
│ いま：【トス発信】0800-805-4052            変更先 [ 【クローザー発信】0800-805-4054 ▼ ] [変更する] │
│ （内線 2040 ／ 桐井 大輔）  選べるのは、あなたに発信が許されている回線だけです。          │
└──────────────────────────────────────────────────────┘

日付 [2026-10-08]  [✓] 自分だけ   担当 [全員 ▼]  回線 [すべて ▼]  発着 [すべて ▼]  結果 [すべて ▼]  番号 [________]  [表示]
2026-10-08 の通話 312 件（通話成功 221・不在 88・通話中 3）

時刻   発着  相手の番号      回線                担当        通話時間  結果      録音
10:21  発信  090-1234-5678   【トス発信】0800…   桐井 大輔   0:51      通話成功  [▶ 再生]
10:19  発信  06-1234-5678    【トス発信】0800…   桐井 大輔   —         不在      —
10:15  着信  080-1234-5678   【電気WEB｜LP】…    （内線 2037）2:10     通話成功  [▶ 再生]
10:12  発信  …               …                   桐井 大輔   通話中    —         通話中
（権限が「自分の通話と録音」の人は、担当の選択肢と「自分だけ」の切り替えを出さず、自分の行だけ）

▶ 再生 を押すと、その行の下に音声プレーヤーが開く（<audio controls controlsList="nodownload" src="/api/system/innovera-calls/recording/<id>?uniqid=…&date=…">）。ダウンロードや削除のボタンは置かない。
自分の録音でない行（権限が「全員の履歴・自分の録音」の人）は「録音」欄に「—」（押せない）。

[内線の紐づけ]（admin 以上だけに出るタブ）
内線が紐づいていない従業員（在籍中）： 山田 太郎 ／ … → Root の従業員編集で「INNOVERA 内線番号」を入れてください
従業員に紐づいていない内線： 2051（テスト） ／ 2060（佐藤） …
```

- 「自分だけ」は既定 ON。`own` の人は常に自分だけ
- 日付の既定＝今日（日本時間）。前日／翌日ボタン。1 年より前は選べない
- 行の並び＝時刻の新しい順。通話中（`inProgress`）の行は「通話時間：通話中」「録音：通話中」
- 再生中に別の行の再生を押したら前のプレーヤーは止める。再生に失敗（403／409／5xx）したらその行に日本語で理由（「通話中は再生できません」「この録音は聞けません」「INNOVERA に接続できませんでした」）
- 発信番号の変更：「変更する」で確認（「【トス発信】→【クローザー発信】に変えます。よろしいですか」）→ 成功したら「変更しました」と「いま」の表示を更新。内線が紐づいていない人には枠ごと「内線番号が登録されていません。管理者へ問い合わせてください」
- 幅：375／768／1024／1440 で表が縦に潰れない（狭い幅では行をカードに）。ライト／ダーク両方（見出しは `--heading` 系、コントラストは本文 4.5:1 以上）
- 履歴の取得に失敗したら赤い 1 行「INNOVERA に接続できませんでした。少し待ってからもう一度押してください」

## 環境変数（既存をそのまま使う）
`INNOVERA_API_HOST`・`INNOVERA_API_KEY`（本番・.env.local とも登録済み）

## テスト（vitest・fetch と Supabase はモック）
- `calls.test.ts`：normalizeCall（発信・着信・未応答）／isCallFinished（end_time 空・30 秒前・2 分前）／filterCallsForAccess（own／all_history_own_audio／all）／canPlayRecording（権限 3 種×自分・他人×録音あり無し×終了済み・通話中）／allowedCircuitsForUser（`#1#3#4#` の解釈）
- `client.test.ts`：配列パラメータの形（`users_ids[]`）／password を落とす／result:false は throw／タイムアウト
- API：履歴 GET が `own` の人に他人の行を返さない／録音 GET が他人の録音で 403・通話中で 409・成功時に Range と Content-Type を写し記録が 1 行入る／URL を JSON で返す入口が無い／line POST が選べない回線で 400・manager 未満の employeeId 指定で 403・成功と失敗の両方で記録が入る／mapping が admin 未満で 403
- 画面：自分だけ ON の既定／再生ボタンの出し分け／通話中の表示／発信番号の変更の確認と成功表示／権限 none の文言
- 最後に `npx.cmd vitest run src/lib/innovera src/app/api/system/innovera-calls src/app/system/innovera-calls src/app/system/forms src/app/system/_components` と `npx.cmd tsc --noEmit -p .` を実行し、結果を報告に書く

## 完了報告（この形で・コードブロックで出力）
```
Codex-366 完了報告
1. 変えた・足したファイル：
2. 追加・変更したテストの本数と結果（vitest の PASS/FAIL 数）：
3. tsc のこの範囲に関するエラー数：
4. 指示と違う作りにした点・迷った点：
5. 触っていないこと（git・.env.local・vercel.json・sync.server.ts・本物の外部サービス）の確認：
```
