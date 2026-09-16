# Codex-333 銀行台帳（金融機関・支店コード）の月次更新 ＋ 廃止の扱い ＋ 後継の対応表 ＋ 口座の点検

作成日: 2026-09-16
作業ツリー: C:\garden\a-bloom-008
起点: main bcc81c5（`git log -1` で一致を確認してから着手）
**git は触らないこと（commit するな）。本番のデータ・DB・Kintone・Vercel に触らないこと。開発サーバ・ブラウザを起動しないこと。migration は supabase/migrations に書くだけで実行しない（実行は Claude）。外部サイトへの取得（GitHub）はコードに書くだけで、この作業中に実際に取りに行かないこと。**

必ず先に読むもの：
- ④ 入社手続き：C:\Claude\000_Garden\150_System_システム\00_マニュアル\04_入社手続き\Garden_System_入社手続き_4_仕様書_Claude読み込み用.md（§2-2 の 7「給与の受取口座」・§3-4 の `system_bank_master`／`system_bank_branches`）
- ④ Root 従業員情報の履歴：C:\Claude\000_Garden\040_Root_組織マスタ\00_マニュアル\01_従業員情報の履歴と収集\Garden_Root_従業員情報の履歴と収集_4_仕様書_Claude読み込み用.md（§2-2 履歴表・§2-3 current ビュー・§2-4 bank_account の payload キー・§8「事務の手入力（admin）をどの画面から入れるか」＝本件で 1 つ答えを作る）
- 今の台帳の表と検索：C:\garden\a-bloom-008\scripts\system-onboarding-add-fields-migration.sql（表の定義）／C:\garden\a-bloom-008\src\app\api\system\onboarding\lookup\bank\route.ts・lookup\branch\route.ts／C:\garden\a-bloom-008\src\app\system\onboarding\_lib\bank-search.ts（打った言葉の直し方）
- 月次取り込みの先例（この形に揃える）：C:\garden\a-bloom-008\src\app\api\system\postal-import\route.ts・_lib.ts（郵便番号データ。JSZip で zip を開く・1,000 行ずつ insert・件数の下限で失敗判定・cron は Bearer `CRON_SECRET`）
- 履歴の読み書き部品：C:\garden\a-bloom-008\src\app\root\_lib\profile-history.server.ts（`getCurrentProfile`／`insertProfileHistoryIfChanged`）
- Root 従業員一覧と「履歴」モーダル：C:\garden\a-bloom-008\src\app\root\employees\page.tsx（見た目・部品の使い方を揃える）
- Root のサイドバー・権限：C:\garden\a-bloom-008\src\lib\auth\permission-registry.ts（新しい画面はここに登録。権限一覧 /root/permissions はこの正本から自動生成される）
- cron の登録：C:\garden\a-bloom-008\vercel.json／C:\garden\a-bloom-008\src\lib\cron-auth.ts

## 0. 何を作るか（東海林さん 2026-09-16「対応して」）

銀行・支店の台帳は 2026-09-02 に全国銀行協会のデータ（zengin-code/source-data・MIT・データ日付 2026-08-24）を 1 回入れたきりで、**更新の仕組みが無い**。銀行や支店は毎月どこかが統合・廃止・改称されるので、放っておくと「台帳に無い支店」「無くなった支店に振り込もうとする」が起きる。今回つくるのは次の 4 つ。

1. **月次更新**：毎月 6 日の朝に元データを見に行き、変わっていれば台帳を更新する（変わっていなければ何もしない）。更新の記録を残す
2. **廃止の扱い（有効期限）**：元データから消えた銀行・支店は**消さずに「廃止日」を入れる**（過去の口座・振込明細が指しているため）。検索には出さない。コードで引いたときは「（廃止）」と分かるようにする
3. **後継の対応表**：廃止された銀行・支店が「どこに引き継がれたか」を事務が登録できる表（元データに後継の情報は無いので手で入れる）。点検のときに候補として出す
4. **口座の点検（月次＋振込前）**：在籍者の今の給与口座（Root の履歴の current）と Bud の口座表を台帳と突き合わせ、「コード無し／台帳に無い／廃止済み／名前が台帳と違う」を一覧にする。事務はその場で［この値で登録］（履歴に事務入力の行を足す）か［後継を登録］ができる。台帳の更新直後にも自動で点検して件数を記録に残す

**2026-09-16 時点の実測（在籍 33 名・root_employees の値）**：金融機関コードが空 21 名（ほとんど「楽天銀行」の名前だけ）／支店名が空でコードだけ 6 名（上田・萩尾・宮永・東海林・石原・高木）／名前の書き方違い（「楽天銀行」vs 台帳「楽天」、「テナー支店」vs「テナー」）多数。点検画面の初回はこれらが並ぶ。**Bud の口座表 `bud_employee_bank_accounts` は 12 行・`bud_payment_recipients` は 0 行**（給与の振込ファイル生成はまだ本番で使っていない。`src/lib/zengin` は部品だけ）。

## 1. 元データ（zengin-code/source-data）

- 場所：`https://github.com/zengin-code/source-data`（MIT）。更新は不定期・おおむね隔月（実測：2026-06-30、2026-08-24）
- 取り方は **zip 1 本**（郵便番号と同じ形）：`https://codeload.github.com/zengin-code/source-data/zip/refs/heads/master` → 中の `source-data-master/data/banks.json`（1,146 件・`{"0036":{"code":"0036","name":"楽天","kana":"ラクテン","hira":"らくてん","roma":"rakuten"},…}`）と `data/branches/{金融機関コード}.json`（1,000 ファイル・`{"244":{"code":"244","name":"オンプ","kana":"オンプ","hira":"おんぷ","roma":"onpu"},…}`）
- 変わったかどうかの判定は zip を落とす前に **`https://raw.githubusercontent.com/zengin-code/source-data/master/data/updated_at`（中身 `20260824`）と `data/md5`（32 文字）** を取り、前回取り込んだ md5 と同じなら「変更なし」で終わる（zip は落とさない）
- 件数の下限：金融機関 1,000 未満・支店 25,000 未満なら**取り込まず失敗**（郵便番号の 100,000 と同じ考え）
- 台帳に入れる列は今のまま `bank_code／bank_name／bank_kana`・`bank_code／branch_code／branch_name／branch_kana`（`hira`／`roma` は入れない）

## 2. データ（migration 1 本・`supabase/migrations/20260917000002_system_bank_master_validity.sql`）

```sql
-- 有効期間（廃止＝valid_to に日付が入る。行は消さない）
alter table public.system_bank_master
  add column if not exists valid_from date not null default '2026-08-24',
  add column if not exists valid_to date,
  add column if not exists source_date date not null default '2026-08-24',
  add column if not exists updated_at timestamptz not null default now();
alter table public.system_bank_branches
  add column if not exists valid_from date not null default '2026-08-24',
  add column if not exists valid_to date,
  add column if not exists source_date date not null default '2026-08-24',
  add column if not exists updated_at timestamptz not null default now();
create index if not exists idx_system_bank_master_valid on public.system_bank_master (valid_to);
create index if not exists idx_system_bank_branches_valid on public.system_bank_branches (bank_code, valid_to);

-- 取り込みの記録（1 回 1 行）
create table if not exists public.system_bank_datasets (
  id uuid primary key default gen_random_uuid(),
  source_date date not null,                 -- data/updated_at（20260824 → 2026-08-24）
  source_md5 text not null,                  -- data/md5
  status text not null check (status in ('ok','skipped_same','failed')),
  bank_count int, branch_count int,
  banks_added int, banks_expired int, banks_renamed int,
  branches_added int, branches_expired int, branches_renamed int,
  check_findings int,                        -- 取り込み直後の口座の点検の件数
  note text,
  imported_at timestamptz not null default now(),
  imported_by text not null default 'system:bank-master-import'
);

-- 後継の対応表（事務が手で登録。元データに後継情報は無い）
create table if not exists public.system_bank_successors (
  id uuid primary key default gen_random_uuid(),
  old_bank_code text not null,
  old_branch_code text,                      -- null＝銀行ごと引き継ぎ
  new_bank_code text not null,
  new_branch_code text,                      -- null＝支店は同じコードのまま
  effective_date date,
  note text,
  created_by text not null,                  -- 社員番号
  created_at timestamptz not null default now(),
  unique (old_bank_code, old_branch_code)
);
```
- RLS：`system_bank_datasets`＝select は authenticated・書き込みは service_role のみ。`system_bank_successors`＝select は authenticated・書き込みは `public.root_can_write()`（今の台帳表と同じ）
- 既存の 1,146／28,944 行は default で `valid_from＝2026-08-24`・`valid_to＝null` になる。初回の取り込み記録は Claude が本番適用のときに `status='ok'・source_date=2026-08-24・md5=5b96133dbdbae57337e1630ba3022bda` を 1 行入れる（migration に insert を書いておいてよい）

## 3. 月次更新（API＋cron）

- 置き場所：`src/app/api/system/bank-master-import/route.ts`＋`_lib.ts`（郵便番号の `postal-import` と同じ作り）。`GET`／`POST` どちらも Bearer `CRON_SECRET`（`verifyBearerRequest(request, "CRON_SECRET")`）。`maxDuration = 300`
- 手順：
  1. `updated_at`・`md5` を取る → 直近の `status='ok'` の `source_md5` と同じなら `system_bank_datasets` に `skipped_same` を 1 行足して終了（zip は落とさない）
  2. zip を落として JSZip で開く → banks.json と branches/*.json を読む（件数の下限チェック）
  3. 差分を出す（純関数 `diffBankMaster(current, incoming)`・テスト必須）：**追加**（台帳に無いコード）→ insert（`valid_from＝source_date`）／**改称**（name または kana が違う）→ update／**復活**（台帳では `valid_to` あり・元データに戻ってきた）→ `valid_to＝null`／**廃止**（台帳にあって元データに無い・`valid_to` がまだ null）→ `valid_to＝source_date`。**delete は書かない**
  4. 書き込みは 1,000 行ずつ（upsert は部分更新に使えないので、update する列を全部渡すか `.update().eq()` で。C:\Users\shoji\.claude\projects\C--garden-main028\memory\reference_supabase_upsert_partial.md の落とし穴）
  5. 取り込み後に §5 の点検を走らせ、件数を `check_findings` に入れて `ok` の行を書く。途中で失敗したら `failed`＋note（部分的に書けた分は残してよい。次回の取り込みで揃う）
- `vercel.json` に `{ "path": "/api/system/bank-master-import", "schedule": "40 1 6 * *" }`（UTC 01:40 ＝ JST 10:40・毎月 6 日。郵便番号の 5 日の翌日）
- `bank-search.ts` の「名前が変わった金融機関」の言い換え表はそのまま残す（元データは改称後の名前しか持たないため）

## 4. 廃止の扱い（検索・逆引き）

- `lookup/bank`・`lookup/branch` の**名前検索は `valid_to is null` だけ**を返す
- **コードで引いたとき**（金融機関コード 4 桁・支店コード 3 桁の逆引き）は廃止済みでも返し、応答に `expired: true, validTo: "2026-08-24"` を足す。入社手続きの画面（`OnboardingClient.tsx`）は名前の横に「（廃止）」を赤字で出し、注記「この支店は台帳で廃止になっています。通帳・アプリの表示をご確認ください」。**送信は止めない**（必須にしない方針と同じ。事務が点検で拾う）
- マイページの届出（`SubmissionModal` の 口座変更）は今回触らない

## 5. 口座の点検（Root ／ 口座の点検）

### 5-1 画面 `/root/bank-check`（新規・Root のサイドバーに「口座の点検」・**admin 以上**。口座番号は出さない）

```
Root ／ 口座の点検
台帳：全銀協データ 2026-08-24 版（金融機関 1,146・支店 28,944）　最終確認 2026-10-06 10:40 変更なし　[台帳をいま更新]

┌ 点検結果 12 件（在籍 33 名の給与口座 ＋ Bud の口座 12 件）──────────────────────────────────┐
│ 指摘で絞る： [すべて ▼]  すべて／コード無し／台帳に無い／廃止済み／名前が違う／支店名なし      │
│                                                                                                  │
│ 氏名        ｜ 出どころ   ｜ 登録されている値                 ｜ 指摘       ｜ 候補                    ｜              │
│ 川中 美来   ｜ 履歴(名簿) ｜ 三菱ＵＦＪ銀行 ／ （支店なし）     ｜ コード無し ｜ 0005 三菱ＵＦＪ（支店は要確認）｜ [この値で登録] │
│ 上田 基人   ｜ 履歴(事務) ｜ 楽天銀行 0036 ／ （支店名なし）223 ｜ 支店名なし ｜ 223 ラテン                ｜ [この値で登録] │
│ 毛利 祐星   ｜ 履歴(名簿) ｜ 楽天銀行 0036 ／ テナー支店 241    ｜ 名前が違う ｜ 楽天 ／ テナー             ｜ [この値で登録] │
│ 廣門 彩季   ｜ Bud 口座   ｜ ゆうちょ 9900 ／ 四〇八 408       ｜ 廃止済み   ｜ 後継：未登録               ｜ [後継を登録]   │
│ …                                                                                                │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
点検の物差し：①金融機関コード・支店コードが空　②台帳に無いコード　③台帳で廃止（廃止日あり）　④名前が台帳と違う（「銀行」「支店」・全角半角・空白を除いて比べる）　⑤支店名が空
```

- 対象：(a) 在籍者（`root_employees.is_active`・`deleted_at is null`・デモと外注は除く）の **履歴 current の `bank_account`**（`getCurrentProfile`。`sub_account` も見る）／(b) `bud_employee_bank_accounts` の全行（表示のみ。Bud 側の直しは給与④の課題なので［この値で登録］は出さない）
- 判定は純関数 `checkBankAccount(payload, masterLookup)`（`src/lib/bank-master/check.ts`・テスト必須）。名前の比較は `bank-search.ts` の `normalizeBankSearchTerm`／`normalizeBranchSearchTerm`＋全角化を使って「銀行」「支店」・全半角・空白を落として比べる
- **候補**：コード無し → 名前で台帳を引いて 1 件に決まればそのコード（複数なら「要確認」）／支店名なし → コードから名前／名前が違う → 台帳の名前／廃止済み → `system_bank_successors` にあれば後継、無ければ「未登録」
- ［この値で登録］→ `POST /api/root/bank-check/apply {employee_id, payload}` → `insertProfileHistoryIfChanged` で **`source='admin'`・`recorded_by=事務の社員番号`・`note='口座の点検で補正（指摘：名前が違う）'`** の行を足す（payload＝今の bank_account の payload に候補を上書きしたもの。口座番号・名義は触らない）。current ビュー→ root_employees の bank_* はトリガで写る（既存の仕組み）。押したあと一覧から消える
- ［後継を登録］→ 小さなモーダル（銀行名［調べる］／金融機関コード／支店名［調べる］／支店コード／適用日／メモ。検索部品は入社手続きの lookup を再利用）→ `system_bank_successors` に 1 行 → 一覧の候補が「後継：0036 楽天 ／ 244 オンプ」になり、その行にも［この値で登録］が出る
- ［台帳をいま更新］→ `POST /api/system/bank-master-import` を**画面からは呼ばない**（Bearer が要る）。代わりに `POST /api/root/bank-check/refresh`（admin 以上）を作り、その中で同じ `_lib` の関数を呼ぶ。実行中は Loading スタイル（二重押し防止）。終わったら「変更なし」か「追加 n・改称 n・廃止 n」を出す
- 取り込み記録（`system_bank_datasets` の新しい順 12 件）を画面の下に小さな表で出す：日時／元データの日付／結果／追加・改称・廃止／点検の件数

### 5-2 振込前チェック（運用＋API）
- 給与の振込は今は楽天銀行の画面で東海林さんが手で行っている（Garden で振込ファイルはまだ作っていない）。**振込前チェック＝振込準備の手順の最初にこの画面を開いて「点検結果 0 件」を確認する**、で足りる。Claude 側の「給与振込準備の定型」に組み込む（Codex の作業ではない）
- 将来の振込ファイル生成（`src/lib/zengin`）から呼べるように、`checkBankAccount` は **DB を知らない純関数**にし、台帳の引き当て（`masterLookup`）は `src/lib/bank-master/lookup.server.ts` に分ける

## 6. 権限・登録

- `permission-registry.ts` に `/root/bank-check`（admin 以上・Root）を登録。Root のサイドバーの並びは「従業員一覧」の下
- API：`GET /api/root/bank-check`（点検結果・admin 以上）／`POST /api/root/bank-check/apply`／`POST /api/root/bank-check/successors`／`POST /api/root/bank-check/refresh`。判定は各入口で（`requireRootRole('admin')` 相当の既存部品を使う）
- 監査：apply と successors は `root_audit_log` に 1 行（action＝`bank_check_apply`／`bank_successor_add`。口座番号は入れない）

## 7. 画面の文言

- 開発者用語を出さない（migration・RPC・upsert・cron は書かない）。「台帳」「元データ（全国銀行協会）」「廃止」「後継」「点検」で統一
- 空の一覧：「点検結果はありません。登録されている口座はすべて台帳と合っています。」
- 更新ボタンの失敗：「台帳を更新できませんでした。時間をおいてもう一度お試しください。続くときは管理者へお問い合わせください。」

## 8. テスト（vitest・全部緑にしてから完了報告）

1. `diffBankMaster`：追加／改称／廃止／復活／変更なし の 5 ケース＋支店は銀行ごとにファイルが分かれていること
2. 件数の下限で失敗（banks 999／branches 24,999）
3. md5 が同じなら `skipped_same` で zip を取りに行かない（fetch をモック）
4. `checkBankAccount`：コード無し／台帳に無い／廃止／名前違い（「楽天銀行」＝「楽天」は一致、「テナー支店」＝「テナー」は一致、「難波」≠「難波南」は不一致）／支店名なし／後継あり の候補
5. lookup の名前検索が廃止行を返さない・コード逆引きは `expired: true` を返す
6. apply が `source='admin'` の履歴行を 1 行だけ足す（同じ値なら足さない）

## 9. 完了報告（コードブロックで・コピーできる形）

```
Codex-333 完了報告
- 触ったファイル（新規／変更を分けて全パス）
- migration の内容（列・表・RLS・初回の insert）
- vercel.json の cron 行
- テスト結果（vitest の件数）
- 画面の確認手順（Claude が Chrome で見る順番）
- 気になった点・決めきれなかった点
```
