# Codex-365：Root に「INNOVERA 内線番号」と「通話録音の権限」の欄を足し、権限の判定を作る（2026-10-08）

## 目的（東海林さんの言葉）
「社員以上または該当の権限あり従業員に対して Garden アカウントにイノベラの SIP 番号（内線番号）を紐づけ。権限を付けて、全員の発信・着信の履歴・音声を確認できるものと、全員の履歴・自分の音声しか確認できないもの、自分の履歴・音声しか確認できないものの段階を付けたい」→ 権限の段階は確定済み。これは第 1 弾（Root 側）。画面と録音の中継は Codex-366。

## 作業場所・禁止事項
- 作業ツリー：`C:\garden\a-bloom-008`（main 21523a34）。**git の操作は一切しない**（add / commit / push / stash / checkout すべて禁止）
- 触ってよい場所：`src/app/root/employees/page.tsx`・`src/app/root/_constants/types.ts`・`src/app/root/_lib/queries.ts`・`src/app/root/_lib/validators.ts`・`src/lib/innovera/`（新規 `call-access.ts` とテスト）・`src/lib/auth/permission-registry.ts`・`supabase/migrations/`（新規 1 本）・それぞれのテスト
- 触らない：`.env.local`・`vercel.json`・本物の Supabase／INNOVERA（テストはモックだけ）・`src/app/root/_lib/roster-sync.server.ts`（名簿同期は決まった列だけ書くので新しい列は上書きされない。確認だけして変えない）
- 画面の文言に開発者用語を出さない。絵文字なし

## 1. 列（移行ファイル `supabase/migrations/20261008000001_root_employees_innovera_call_access.sql`）
```sql
alter table public.root_employees
  add column if not exists innovera_extension text,
  add column if not exists call_recording_access text not null default 'default';
alter table public.root_employees
  drop constraint if exists root_employees_call_recording_access_check;
alter table public.root_employees
  add constraint root_employees_call_recording_access_check
  check (call_recording_access in ('default','all','all_history_own_audio','own','none'));
create index if not exists root_employees_innovera_extension_idx
  on public.root_employees (innovera_extension) where innovera_extension is not null;
comment on column public.root_employees.innovera_extension is 'INNOVERA（クラウドPBX）の内線番号。通話履歴・録音の本人判定に使う';
comment on column public.root_employees.call_recording_access is '通話録音の権限の上書き。default=役職どおり / all=全員の通話と録音 / all_history_own_audio=全員の履歴・自分の録音 / own=自分の通話と録音 / none=使わせない';
```
（本番への適用は Claude がやる）

## 2. 権限の判定（新規 `src/lib/innovera/call-access.ts`・純粋関数・テストあり）
```ts
export type CallRecordingAccess = "all" | "all_history_own_audio" | "own" | "none";
export type CallRecordingOverride = "default" | CallRecordingAccess;
export const CALL_RECORDING_ACCESS_LABELS: Record<CallRecordingAccess, string> = {
  all: "全員の通話と録音",
  all_history_own_audio: "全員の履歴・自分の録音",
  own: "自分の通話と録音",
  none: "使わせない",
};
export const CALL_RECORDING_OVERRIDE_LABELS: Record<CallRecordingOverride, string> = { default: "既定（役職どおり）", ...CALL_RECORDING_ACCESS_LABELS };
// 役職ごとの既定（東海林さん確定 2026-10-08）
export function defaultCallRecordingAccess(role: GardenRole): CallRecordingAccess
//   manager / admin / super_admin → "all"
//   staff / outsource            → "all_history_own_audio"
//   cs                           → "own"
//   closer / toss                → "none"
export function resolveCallRecordingAccess(role: GardenRole, override: CallRecordingOverride | null | undefined): CallRecordingAccess
//   override が "default"・null・不正値 → 既定。それ以外は override をそのまま
export function canSeeAllCalls(access): boolean      // all / all_history_own_audio
export function canPlayAllRecordings(access): boolean // all のみ
export function canUseCallScreen(access): boolean     // none 以外
```
- `GardenRole` と `isRoleAtLeast` は `src/app/root/_constants/types.ts` のもの。役職の並び＝toss → closer → cs → staff → outsource → manager → admin → super_admin
- テスト（`call-access.test.ts`）：8 役職すべての既定／上書き 4 種／`default`・null・不正値は既定に戻る／3 つの can 関数

## 3. Root の従業員編集（`src/app/root/employees/page.tsx` ほか）
- `types.ts` の `Employee`（と `RootEmployee`）に `innovera_extension?: string | null` と `call_recording_access?: CallRecordingOverride | null` を足す
- `queries.ts` の `ROOT_EMPLOYEE_SELECT_FIELDS` に 2 列を足す（無いと読み込まれない）
- `page.tsx`：新規作成の初期値に `innovera_extension: null, call_recording_access: "default"`。「外部ID連携」の「キングオブタイムID」の下に 2 つ足す：

```
外部ID連携
  キングオブタイムID   [ 0004 ]
  INNOVERA 内線番号     [ 2040 ]        ← 数字だけ・2〜6 桁。空欄可
  MFクラウド給与ID      [ ... ]

通話履歴・録音
  通話録音の権限  [ 既定（役職どおり） ▼ ]   ← 既定（役職どおり）／全員の通話と録音／全員の履歴・自分の録音／自分の通話と録音／使わせない
  （説明文）既定では マネージャー以上＝全員の通話と録音、社員・業務委託＝全員の履歴と自分の録音、CS＝自分の通話と録音、クローザー・トス＝使わない。ここで変えると役職より優先されます。
```
- `validators.ts`：内線番号は空か `^\d{2,6}$`。違えば「INNOVERA 内線番号は 2〜6 桁の数字で入力してください」。`call_recording_access` は 5 値のどれか
- 保存 API（`/api/root/employees`）は届いた内容をそのまま upsert するので変更不要のはず。**確認だけ**して、列名が通ることをテストで押さえる
- 一覧表示（従業員一覧の表）には列を増やさない

## 4. 権限一覧（`src/lib/auth/permission-registry.ts`）
手で書く行を 3 つ足す（group "System"・kind "操作"）：
- `calls.view_all`「通話履歴・録音：全員の履歴を見る」＝ staff 以上（既定ベース。個別の上書きは注記）
- `calls.play_all`「通話履歴・録音：全員の録音を聞く」＝ manager 以上
- `calls.own`「通話履歴・録音：自分の履歴と録音」＝ cs 以上
`source` は `src/lib/innovera/call-access.ts`。既存の権限一覧テストの件数が変わるなら直す

## テスト（vitest）
- `src/lib/innovera/call-access.test.ts`（上記）
- Root：既存の `page.test.tsx`／`validators` のテストを壊さない。内線番号の形チェック 3 件（空・2040・abc）と権限 5 値の検証を足す
- 最後に `npx.cmd vitest run src/lib/innovera src/app/root src/lib/auth` と `npx.cmd tsc --noEmit -p .` を実行し、結果を報告に書く（AppHeader のテストは前から壊れている＝対象外）

## 完了報告（この形で・コードブロックで出力）
```
Codex-365 完了報告
1. 変えた・足したファイル：
2. 追加・変更したテストの本数と結果（vitest の PASS/FAIL 数）：
3. tsc のこの範囲に関するエラー数：
4. 指示と違う作りにした点・迷った点：
5. 触っていないこと（git・.env.local・roster-sync・本物の外部サービス）の確認：
```
