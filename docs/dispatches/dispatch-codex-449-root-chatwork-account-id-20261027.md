# Codex-449：Chatwork の ID を Root の従業員に持たせ、バイトル通知の宛先を Root から読む＋名簿同期の「個人番号の提出状況」の毎朝重複を止める（2026-10-27）

あなたは Codex-449 です。作業場所は `C:\garden\a-bloom-008`（main）。**git の書き込み（ブランチ作成・add・commit・checkout）はしないでください。`git log`・`git status`・`git diff` の読み取りはしてよい。コミットは人間側が行います。**

## pre-flight（1 つでも違えば編集せずに中断して報告）
1. `pwd` が `C:\garden\a-bloom-008`
2. `git log --oneline -1` が `2466f208` 以降
3. `src/lib/sprout/baitoru.server.ts` に `s.mentions.replace(` がある／`src/app/root/_lib/roster-sync.server.ts` に `imported_at: importedAt` がある／`supabase/migrations/20261027000449_root_chatwork_account_id.sql` がまだ無い

## 触ってよい範囲（ほかのフォルダは読みもしない）
- `supabase/migrations/20261027000449_root_chatwork_account_id.sql`（新規）
- `src/app/root/`（`_constants/types.ts`・`_lib/employee-select.ts`・`_lib/validators.ts`・`_lib/roster-sync.server.ts`・`employees/page.tsx` とそのテスト・`_lib/__tests__/`）
- `src/app/api/root/employees/[employeeId]/chatwork-token/`・`src/app/api/root/chatwork-token-sync/`
- `src/app/system/forms/payroll-notice/_lib/chatwork-token-sync.server.ts`（とテスト）
- `src/lib/chatwork/`（新規ファイル 1 つ）
- `src/lib/sprout/baitoru*.ts`・`src/app/sprout/postings/baitoru-*`
- `docs/dispatches/report-codex-449-root-chatwork-account-id-20261027.md`（完了報告）

## 背景
- バイトル新規応募の Chatwork 通知の宛先（TO）は `sprout_baitoru_settings.mentions` に `[To:2746758][To:4958142]…` の文字で入っている。東海林さんの決定（開発ボード 2026-10-26）＝**Chatwork の ID は Root の従業員に持たせ、画面で直せるようにする**。
- Root の従業員 `root_employees`（主キー `employee_id` text）には Chatwork の列が `chatwork_api_token_enc`・`chatwork_account_name`・`chatwork_token_updated_at` だけで、ID（数字）の列が無い。
- 名簿同期は毎朝、個人番号の行（`my_number_status`）の payload に `imported_at: 今日` を入れるため、「同じ値なら足さない」が効かず在籍者分（約 26 行）を毎日足している（本番で確認・1 か月で約 1,000 行）。

## やること

### 1. migration（`20261027000449_root_chatwork_account_id.sql`・`begin; … commit;` を自分で持つ）
- `alter table root_employees add column if not exists chatwork_account_id text` ＋ check 制約 `chatwork_account_id is null or chatwork_account_id ~ '^[0-9]{1,12}$'`（名前 `root_employees_chatwork_account_id_digits`）。一意制約は付けない（退職と再入社で同じ人が 2 行ある）。`comment on column` ＝「Chatwork のアカウント ID（[To:ID] に使う数字）」
- `alter table sprout_baitoru_settings add column if not exists mention_employee_ids text[] not null default '{}'`。**`mentions` 列は消さない**（もう読まない。値の移し替えは人間側が行う）
- 値の投入はしない（人間側が行う）

### 2. Root の従業員（画面と保存）
- 型（`types.ts`）・読み込み列（`employee-select.ts`）・新規の初期値（`page.tsx`）に `chatwork_account_id` を足す。手本＝`innovera_mobile_extension` の足し方（型・select 列・初期値・入力欄・validator・テストの fixture）
- 編集画面（`page.tsx`）の Chatwork の欄（トークン登録の近く）に入力欄「Chatwork ID」（数字だけ・`inputMode="numeric"`）と、その下に小さな説明「通知の宛先（TO）に使う番号です。Chatwork のプロフィールに出る数字を入れます」。空欄可
- validator：空 or 数字 1〜12 桁。違えば「Chatwork ID は数字だけで入れてください」。前後の空白は落とす
- 一覧に列は足さない

### 3. トークン登録で ID も入れる
- `api/root/employees/[employeeId]/chatwork-token/route.ts` と `chatwork-token-sync.server.ts`（一括）は今 `getChatworkMe(token)` の `name` だけ保存している。`/me` の `account_id` も `chatwork_account_id` に保存する（`src/app/system/_lib/chatwork.ts` の `accountId` を使う）。トークン削除のときは ID は消さない（ID は通知の宛先として残す）
- GET の応答に ID は足さなくてよい（画面は従業員の行の値を出す）

### 4. 宛先の共通部品（`src/lib/chatwork/mentions.server.ts`・新規）
- `export async function chatworkToLine(employeeIds: string[]): Promise<{ line: string; missing: string[] }>`：`root_employees` から `employee_id in (...)` かつ `deleted_at is null` の `chatwork_account_id` を読み（service_role の admin client。既存の作り方に合わせる）、**与えた順で** `[To:ID]` を空白なしで連結した 1 行を返す。ID が空の人・見つからない人は `missing` に社員番号を入れて飛ばす（送信は止めない）。重複 ID は 1 回だけ
- テスト（順序・重複・ID 無しの人・空配列で空文字）

### 5. バイトル通知の宛先を Root から
- `BaitoruSettings` の `mentions: string` を `mention_employee_ids: string[]` に置き換える（読み込み・保存・テストすべて）。`baitoru-actions.ts` の検証＝配列・各要素が `^EMP-[0-9A-Za-z-]+$`・最大 50
- `baitoru.server.ts` の `notificationBody` は、送る直前に `chatworkToLine(s.mention_employee_ids)` で作った行を最後に 1 行付ける（今の「最後に 1 行・名前なしの [To:id] を並べる」はそのまま。2026-10-24 東海林さん）。`notificationBody` 自体は純粋な関数のまま、引数で `to` の文字を受ける形にしてよい
- 設定画面（`baitoru-panel.tsx`）の「メンション」の textarea を **BoxSelect（`@/app/system/_components/BoxSelect/BoxSelect`・複数選択）「通知の宛先」** に替える。選択肢＝在籍中（`deleted_at is null` かつ `is_active`）で `chatwork_account_id` がある従業員（ラベル＝氏名・値＝employee_id。`loadBaitoru` の戻り値に `mention_candidates` を足す）。すでに選ばれているのに候補に無い人（ID を消した・退職）は「（ID 未登録）」を付けて選択肢に残す。下に小さく「宛先に出るのは Root の従業員で Chatwork ID を入れた人です」
- 画面文言に開発者用語（mention・ID のキー名・英語）を出さない

### 6. 名簿同期の個人番号の行（`roster-sync.server.ts`）
- `my_number_status` の「同じ値か」の比較で `imported_at` を無視する（`submitted` と `source` が同じなら足さない）。ほかの区分の比較は変えない
- テスト：同じ人で日付だけ違う 2 回の同期で 2 回目は 0 行・`submitted` が変われば 1 行

## 確認（自分で回す）
- `npx tsc --noEmit -p .` が 0 エラー
- `npx vitest run src/app/root src/lib/sprout src/lib/chatwork src/app/sprout src/app/api/root src/app/system/forms/payroll-notice` が緑（もともと壊れているテストがあれば名前を報告に書く）
- `src` の差分に `???`（文字化け）が無いこと

## 完了報告（`docs/dispatches/report-codex-449-root-chatwork-account-id-20261027.md`）
変更ファイル一覧・migration の中身・tsc／vitest の結果・気づいたこと。長い説明は不要。
