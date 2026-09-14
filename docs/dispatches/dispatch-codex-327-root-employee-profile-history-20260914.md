# Codex-327 Root 従業員情報の履歴：表の新設＋従業員名簿の全項目集約＋口座一覧の取り込み

作成日: 2026-09-14
作業ツリー: C:\garden\a-bloom-008
起点: main 9ad5fbd（`git log -1` で一致を確認してから着手）
**git は触らないこと（commit するな）。本番のデータ・DB・Kintone に触らないこと。開発サーバ・ブラウザを起動しないこと。migration は supabase/migrations に書くだけで実行しない（実行は Claude が SQL OK の後に行う）。**

必ず先に読むもの：
- ④設計：C:\Claude\000_Garden\040_Root_組織マスタ\00_マニュアル\01_従業員情報の履歴と収集\Garden_Root_従業員情報の履歴と収集_4_仕様書_Claude読み込み用.md（**§2 データモデル・§2-4 区分ごとのキーと名簿のフィールドコード・§3-1／3-2 収集・§7 落とし穴**。この指示書と食い違ったら ④ を優先し、§8「既知の差分」に書く）
- 今の名簿同期：C:\garden\a-bloom-008\src\app\root\_lib\roster-sync.server.ts（`ROSTER_SYNC_FIELDS`・`mapRosterRecordToRoot`・`syncRoster`・`root_roster_sync_log` への記録）、API C:\garden\a-bloom-008\src\app\api\root\roster-sync\route.ts と cron\route.ts（vercel.json で毎朝 6:00＝`0 21 * * *` UTC）、テスト（同フォルダの *.test.ts）
- Kintone の読み方：C:\garden\a-bloom-008\src\lib\kintone\records.ts（`getAllRecords`。**GET に Content-Type を付けない**）
- 既存の migration の作法：C:\garden\a-bloom-008\supabase\migrations\20260909000001_root_roster_sync.sql・20260826000001_mypage_employee_private_profile.sql（RLS 有効・ポリシーなし・service_role のみ、`root_update_updated_at` トリガ）
- マイナンバー：`root_employee_my_numbers`（employee_id・my_number・submitted_at）。マイページは行の有無だけ見る（C:\garden\a-bloom-008\src\app\system\mypage\_lib\mypage-profile.server.ts）
- 名簿のフィールド一覧（96 項目・コード＝ラベル）：C:\Users\shoji\AppData\Local\Temp\claude\C--garden-main028\34670387-590e-4f39-8696-1b92307cceec\scratchpad\fields_56.txt（読めなければ ④ §2-4 の対応表で足りる）
- 口座一覧（app92）の列：支店コード・支店名・口座番号・レコード番号・支払予定時期・文字列__1行_（社員番号？）・支払日・支払用途・文字列__1行__0（氏名）・更新日時・種別（普通/当座）・支払頻度・銀行名・口座名義カナ・リンク（メール）・ルックアップ_0（**KOTID＝root_employees.kot_employee_id**）・作成日時。環境変数 `KINTONE_BANK_ACCOUNTS_APP_ID`／`KINTONE_BANK_ACCOUNTS_TOKEN`（.env.local に既にある名前）

## 0. 何を作るか（東海林さん 2026-09-14）

マイページ一斉展開の前提として、従業員の情報を Root に集約し、**上書きではなく履歴で持つ**。今回は「表の新設」「名簿の全項目集約（毎朝）」「口座一覧の取り込み」まで。画面（初回確認・履歴タブ）は Codex-328 で別に。

```
Kintone 従業員名簿（96 項目・在籍中 31） ─毎朝 6:00─▶ root_employee_roster_snapshot（全項目の写し・変わった日だけ 1 行）
                                         └─────────▶ root_employee_profile_history（区分ごと・行を足すだけ）
Kintone 口座一覧（支払いごとに 1 行）    ─毎朝 6:00─▶ root_employee_profile_history（bank_account・人ごとの最新 1 行）
                                                            │
                                                            ▼
                                     root_employee_profile_current（ビュー＝区分ごとの最新行）
                                                            │ トリガで写す
                                                            ▼
                                     root_employees の既存列（email・bank_*・commute_daily_allowance・commute_monthly_cap）
```

## 1. migration（1 本・`20260914000001_root_employee_profile_history.sql`）
- `root_employee_roster_snapshot`（④ §2-1）：id bigserial・employee_id text（root_employees 参照）・roster_record_id text・snapshot jsonb・snapshot_hash text・taken_at timestamptz。索引（employee_id, taken_at desc）。RLS 有効・ポリシーなし・service_role のみ
- `root_employee_roster_field_labels`（コード → ラベルの対応表・96 行。名簿の fields.json を同期のたびに upsert）：field_code text PK・label text・field_type text・updated_at
- `root_employee_profile_history`（④ §2-2）：id uuid・employee_id・category text（**check で 8 区分に限定**：address／contact／emergency_contact／bank_account／commute／employment／dependents／my_number_status）・payload jsonb・source text（check：roster／bank_list／transfer_group／mf_contract／employee_confirm／submission／onboarding／admin）・source_ref text・source_document_url text・effective_from date・recorded_at timestamptz default now()・recorded_by text・confirmed_by_employee_at timestamptz・note text。索引（employee_id, category, recorded_at desc）。**update／delete を禁止するトリガ**（raise exception '履歴は上書き・削除しません'）。RLS：本人（root_employees.user_id = auth.uid()・is_active・deleted_at is null）は自分の行を select 可／責任者以上（`public.root_can_write()`）は全員分 select 可／insert・update・delete は authenticated に与えない（service_role のみ）
- ビュー `root_employee_profile_current`：employee_id × category の最新行（recorded_at desc, id desc）。security_invoker
- トリガ関数 `root_employee_profile_apply_current()`：履歴に insert が入ったら、その employee_id の最新行から root_employees の既存列へ写す：`bank_account` → bank_name／bank_code／branch_name／branch_code／account_type／account_number／account_holder／account_holder_kana、`commute` → commute_daily_allowance（=one_way×2。④ §4-5 の規則「日額＝片道×2」）／commute_monthly_cap、`contact` → email（空なら触らない）。**それ以外の列は触らない**。写すのは「値が変わったときだけ」（updated_at が毎回動かないように）
- コメント（comment on）を日本語で。既存の表・列は変えない

## 2. 名簿同期の拡張（`roster-sync.server.ts`・毎朝 6:00 と手動）
- 読む項目を **全項目**に（`fields` を指定しない＝全部）。`ROSTER_SYNC_FIELDS` は「root_employees に写す項目」の意味で残す
- 同期のたびに：
  1. fields.json を読んで `root_employee_roster_field_labels` を upsert（コード・ラベル・型）
  2. 在籍中＋退職 90 日以内の各人について、`snapshot`＝レコードの全 value（**マイナンバーだけ `"***"` に伏せる**・`$id`／`$revision` も入れる）、`snapshot_hash`＝JSON を安定化（キー順）した sha256。前回の最新と同じ hash なら行を足さない
  3. 区分ごとの payload を ④ §2-4 の対応表で作り（無い項目は null・電話はハイフンなし・郵便番号は数字 7 桁・金額は数値）、**その区分の最新行（source を問わず）と payload が同じなら足さない**。違えば `source='roster'`・`source_ref=レコード番号`・`effective_from=今日`・`recorded_by='system:roster-sync'` で insert。区分＝address／contact／bank_account（口座_1 を slot 1・口座_2 があれば slot 2 の 2 行）／commute／employment／dependents は名簿に無いので作らない／my_number_status（下記）
  4. マイナンバー：値があり `root_employee_my_numbers` に行が無いか値が違うときだけ upsert（submitted_at＝今日）。履歴には `my_number_status` として `{ submitted: true, source: "roster", imported_at }`（**番号は履歴に入れない**）。値が空なら何もしない
  5. `root_roster_sync_log` に snapshot_rows／history_rows／my_number_rows を足す（列追加は同じ migration で）
- 突合キーは今と同じ（打刻ID＝kot_employee_id・無ければ社員番号）。root_employees に無い人は今の同期が作る（その後に履歴も入る）
- 初回一括：手動 API（`POST /api/root/roster-sync`）を 1 回叩けば同じコードで全員分が入る形にする（別スクリプト不要）。dry-run（今の `dryRun`）では履歴も書かず件数だけ返す

## 3. 口座一覧の取り込み（同じ同期の中・名簿の後）
- app92 を全件読み、`ルックアップ_0`（KOTID）で root_employees.kot_employee_id と突合。人ごとに **更新日時 desc・同じなら支払日 desc で 1 行**を採る
- payload（bank_account）：bank_name／bank_code（無ければ null）／branch_name／branch_code／account_type（普通→"ordinary"、当座→"current"）／account_number／holder_kana／slot=1／paid_on（支払日）／kintone_record（レコード番号）。`source='bank_list'`・`source_ref=レコード番号`・`effective_from=支払日 or 更新日`。最新行と同じなら足さない
- 名簿の口座（source=roster）と口座一覧（source=bank_list）の**両方が履歴に残る**のは仕様（今の値＝recorded_at が新しいほう。同期の順番＝名簿 → 口座一覧なので、口座一覧があれば口座一覧が今の値になる＝東海林さんの「口座一覧の最新 → 無ければ名簿」）
- 口座一覧に無い人・KOTID が root に無い行は件数だけ記録（エラーにしない）

## 4. テスト（vitest）
- migration は SQL のレビューのみ（実行しない）
- roster-sync：同じレコードで 2 回同期しても snapshot／history が増えない／1 項目変えると該当区分だけ 1 行増える／マイナンバーが snapshot で伏せられる・履歴に番号が入らない／dry-run では書かない／退職 90 日超は対象外
- 口座一覧：1 人 3 行のうち更新日時が最新の 1 行が採られる／KOTID が無い行はスキップ／同じ値なら足さない
- 区分ごとの payload 変換（名簿のフィールドコード → キー）の単体テスト（④ §2-4 の全キー）
- 既存テスト（src/app/root・src/app/api/root）は全部通す

## 5. 変えてはいけないもの
- root_employees の既存列の意味・既存の同期の動き（作成・更新・アカウント発行・BAN）・garden_role の扱い
- マイページ・Bud の給与口座（bud_employee_bank_accounts）・入社手続き

## 6. 受け入れ基準
1. vitest（src/app/root・src/app/api/root）が通る　2. tsc に今回の変更由来のエラーが無い　3. eslint（変更ファイル単位）が通る
4. Claude が：migration を本番に適用 → 手動同期を 1 回 → 在籍 31 名の snapshot 31 行・history（address 31／contact 31／bank_account 名簿 31＋口座一覧 n／commute n／employment 31／my_number_status 21）・root_employees の commute／email が変わっていないこと（同じ値の写し）・2 回目の同期で増えないこと、を実測

## 7. 完了報告（コードブロックで出力）
- 「未コミット」と明記／変更・追加ファイルのフルパス／migration のパス／受け入れ基準 1〜3 の結果（実行したコマンドと結果）／本番データ・DB・Kintone・git に触っていないことの明記

## 8. 既知の差分（Codex が追記する）
