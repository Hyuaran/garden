# Codex-450：入社した人の FileMaker アカウントを自動で作る（Garden ＋ ホストPC の小さな係）

あなたは Codex-450 です。作業場所は C:\garden\a-bloom-008（main）。**commit・push はしない**（Claude が確認してから行う）。長い説明は不要、ファイルは必要な範囲だけ読む。日本語の文字列は必ず UTF-8 で書き、終わったら `src` と `scripts` を `???` で検索して文字化けが無いことを確かめる。

## 背景（決まっていること）
- 入社の流れ：System ＞ 入社手続き（事務）の「入社予定者」で［入社］→ `src/app/system/onboarding/_lib/hire-candidates.server.ts` の `hireCandidate()` が stage `number`→`kot`→`roster`→`garden` を順に進め `status:"hired"` にする。画面は `src/app/system/onboarding/HireCandidatesClient.tsx`。チェック欄 `checklist.filemaker_added`（`_lib/hire-candidates.ts` の `CHECKLIST_KEYS`）は今は手で付けている。
- FileMaker Server 11（社内 192.168.1.100:2399）の 3 ファイル **「【新】営業」「社員情報」「コール履歴」** に、表 `gardenaccountrequest`（項目はすべてテキスト：`requestid` `password` `accountname` `status` `result` `processedat`）を作成済み。FileMaker 側の定時スクリプトが `status='pending'` の行を見つけて「アカウントを追加」し、`status` に FileMaker のエラー番号（**`0`＝成功**）を書き、`password` を空にする（Claude が設定済み・Garden からは触らない）。
- 権限セットはファイルごとに FileMaker のスクリプト側で固定（【新】営業＝AP／社員情報＝閲覧のみ／コール履歴＝AP）。Garden は権限を送らない。
- ホストPC から ODBC（32bit・DSN なし）で、アカウント「Garden」（パスワード＝マシン環境変数 `FM_CALL_HISTORY_PASSWORD`。3 ファイル共通）を使い、この表に INSERT／SELECT／UPDATE できることを 2026-10-27 に実機で確認済み。DELETE の権限は無い。
- アカウント名＝**姓＋全角スペース＋名**（`system_hire_candidates.last_name` + "　" + `first_name`）。初期パスワード＝**`gd`＋誕生日の月日 4 桁**（`src/app/root/_lib/roster-sync.server.ts` の `initialPassword` と同じ規則。共有の関数にして両方から使う）。**パスワードは Garden の DB に保存しない**（ホストPC が受け取るときに誕生日から作って渡す）。
- ホストPC の係は既存の `scripts/callcenter-agent/CallCenterAgent.ps1`（ODBC・32bit PowerShell・config.json・Bearer 認証）と同じ作り。認証は既存の環境変数 **`RELAY_SECRET`**（ホストPC にも Vercel にもある）を `verifyBearerRequest(req, "RELAY_SECRET")`（`src/lib/cron-auth.ts`）で照合。
- 失敗の知らせは Chatwork「Garden｜通知」（ルーム 450125458・`GARDEN_NOTICE_CHATWORK_ROOM_ID`／`CHATWORK_API_TOKEN`）。`src/lib/relay/monitor.server.ts` の `sendGardenNotice` を export して使う（同じ内容を二重に作らない）。**障害ごとに 1 回＋直ったら 1 回**。

## 作るもの

### 1. DB（`supabase/migrations/20261027000001_system_filemaker_account_requests.sql`）
表 `system_filemaker_account_requests`：
- `id uuid pk default gen_random_uuid()`、`hire_candidate_id uuid not null references system_hire_candidates(id) on delete cascade unique`、`employee_id`（root_employees の id と同じ型・null 可）、`account_name text not null`
- `files jsonb not null default '{}'`：キー＝`eigyo`／`shain`／`call`、値＝`{status:'waiting'|'sent'|'done'|'failed', fm_status?:string, at:timestamptz文字列, error?:string}`
- `status text not null default 'waiting' check (status in ('waiting','sent','done','failed'))`（全体。3 つとも done→done、どれか failed→failed、どれか sent→sent）
- `failure_notified_at timestamptz`、`stuck_notified_at timestamptz`、`requested_by text`、`created_at`／`updated_at`
- RLS 有効・super_admin だけ読める（`system_hire_candidates` と同じ書き方に合わせる）。書き込みは service_role。

### 2. Garden の処理（`src/app/system/onboarding/_lib/filemaker-accounts.server.ts` など）
- `requestFilemakerAccount(client, hireCandidateId, requestedBy)`：hired の候補者から 1 行作る（あれば files を waiting に戻す＝やり直し。done のファイルは戻さない）。
- `hireCandidate()` の `garden` stage が成功した直後に呼ぶ。**失敗しても入社の処理は失敗にしない**（steps に `filemaker:{done:false,error}` を書くだけ・画面の steps 表示に「FileMaker に依頼」を足す）。
- 全部 done になったら `checklist.filemaker_added = {checked_at, checked_by:'自動（FileMaker）'}` を付ける（既存の checklist の形に合わせる）。
- どれか failed になったら Garden通知へ 1 回（本文例：「FileMaker のアカウントを作れませんでした：山田　太郎（社員情報：エラー 1702）。入社手続き（事務）の画面から［もう一度］を押すか、FileMaker で手で作ってください。」）。［もう一度］で依頼し直して done になったら「作れました」を 1 回。
- 止まっている検知：`sent` か `waiting` のまま 30 分を超えた依頼があれば Garden通知へ 1 回（「ホストPC か FileMaker の定時処理が止まっていないか」）。既存の cron（`src/app/api/system/innovera-sync/cron/route.ts` など 5〜15 分おきのもの）に相乗りするか、`vercel.json` に GET の cron を 1 本足す（`*/15 * * * *`・`verifyBearerRequest(req,"CRON_SECRET")`）。**cron を足す場合は vercel.json への追加はしないで、route だけ作る**（初回は止めて配備するため Claude が後で足す）。

### 3. ホストPC 用 API（`src/app/api/system/filemaker-accounts/agent/route.ts`）
- `GET`：Bearer `RELAY_SECRET`。返すもの＝`{ jobs: [{ id, accountName, password, files: ['eigyo','shain','call'] のうち waiting のもの }], checks: [{ id, files: sent のもの }] }`。password はここで誕生日から作る。
- `POST`：Bearer `RELAY_SECRET`。本文＝`{ results: [{ id, file, step:'sent'|'checked', fmStatus?:string, error?:string }] }`。`sent` で files[file]=sent。`checked` で fmStatus==='0'→done、空→そのまま sent、それ以外→failed（error に「エラー {番号}」）。ODBC の失敗（error）→ failed。処理後に全体 status と checklist・通知を更新。
- `export const runtime="nodejs"; dynamic="force-dynamic"`。

### 4. 画面（`HireCandidatesClient.tsx` の「書類・FileMaker」列）
- FileMaker の行に、手のチェックはそのまま残し、横に自動の状態を小さく出す：「自動：依頼中」「自動：作成済み」「自動：失敗（社員情報）［もう一度］」。［もう一度］は `POST /api/system/hire-candidates/{id}/filemaker`（新設・super_admin・`requestFilemakerAccount` を呼ぶ）。
- 一覧 API（`src/app/api/system/hire-candidates/route.ts`）で依頼の状態も一緒に返す。社長スタイルの既存の見た目・部品に合わせ、新しい色を直書きしない。

### 5. ホストPC の係（`scripts/filemaker-account-agent/`）
- `FilemakerAccountAgent.ps1`（**UTF-8 BOM 付き**・32bit で動く・64bit で起動されたら SysWOW64 の powershell.exe で自分を起動し直す）：1 回動いて終わる作り。
  1. `GET {apiBase}/api/system/filemaker-accounts/agent`（`Authorization: Bearer $env:RELAY_SECRET`、マシン環境変数も読む）
  2. jobs：ファイルごとに ODBC で `INSERT INTO gardenaccountrequest (requestid, accountname, password, status) VALUES (?, ?, ?, 'pending')`（**値は OdbcParameter で渡す・文字列の連結で SQL を作らない**）。requestid は `{id}-{file}`。成功→`step:'sent'`、例外→`step:'checked', error`。
  3. checks：ファイルごとに `SELECT status FROM gardenaccountrequest WHERE requestid = ?` → `step:'checked', fmStatus`（`pending` のままなら送らない）
  4. まとめて POST。ログは `C:\ProgramData\Garden\FilemakerAccountAgent\logs\` に日付ごと（**パスワードは書かない**）。
- `config.example.json`：`apiBase`、`fmServer`(192.168.1.100)、`fmPort`(2399)、`fmUser`(Garden)、`files`：`{"eigyo":"【新】営業","shain":"社員情報","call":"コール履歴"}`。
- `Register-FilemakerAccountAgentTask.ps1`：タスク名 `GardenFilemakerAccountAgent`・SYSTEM・5 分おき・32bit の powershell.exe で `-NoProfile -ExecutionPolicy Bypass -File`。既存の `scripts/callcenter-agent/Register-CallCenterAgentTask.ps1` の書き方に合わせる。
- `README.md`：置き場所 `C:\Garden\filemaker-account-agent\`、入れ方、動作確認、止め方。
- 純粋な部分（JSON の組み立て・requestid の作り方）は `FilemakerAccountAgent.Core.ps1` に分けてよい。

## テスト
- `filemaker-accounts.server.ts` の状態の決め方（files→全体 status、fmStatus の解釈、通知 1 回）と、API の認証（Bearer なし→401）と GET/POST の形、パスワードの作り方（`gd`+MMDD、`initialPassword` と一致）を vitest で。
- `HireCandidatesClient.test.tsx` に「自動：作成済み」「自動：失敗［もう一度］」の表示を足す。
- `npx tsc --noEmit` と関係するテストが通ること。既存の壊れているテスト（AppHeader・KpiCard・BackgroundCarousel）は触らない。

## 完了報告（この形で）
- 変更・追加したファイルの一覧
- migration の中身の要点
- tsc／テストの結果（コマンドと件数）
- `???` 検索の結果
- 迷って決めたこと
