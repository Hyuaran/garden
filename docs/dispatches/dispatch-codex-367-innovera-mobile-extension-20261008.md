# Codex-367：INNOVERA の内線を「PC 版」と「モバイル版」の 2 つ持てるようにする（2026-10-08）

## 目的（東海林さんの言葉）
「PC 版と MOBILE 版の内線があります。自分だけを絞って見るときはどちらも見たいです。発信は PC 版のアカウントで発信でかまいません」

INNOVERA のユーザ一覧には、1 人につき PC 用（例 2040）とモバイル用（例 1003「◆1003 石原mobile」）の内線がある。いまは Root に内線 1 つ（`innovera_extension`）しか持てない。

## 作業場所・禁止事項
- 作業ツリー：`C:\garden\a-bloom-008`（main 25a3763f）。**git の操作は一切しない**
- 触ってよい場所：`src/app/root/`（従業員編集・型・queries・validators とテスト）・`src/lib/innovera/`（call-access は触らない。calls.ts・calls.server.ts・テスト）・`src/app/api/system/innovera-calls/`・`src/app/system/innovera-calls/`・`supabase/migrations/`（新規 1 本）
- 触らない：`.env.local`・`vercel.json`・`src/lib/innovera/sync.server.ts`・`src/lib/innovera/client.ts`・本物の外部サービス（テストはモック）

## 1. 列（`supabase/migrations/20261008000003_root_employees_innovera_mobile_extension.sql`）
```sql
alter table public.root_employees add column if not exists innovera_mobile_extension text;
create index if not exists root_employees_innovera_mobile_extension_idx on public.root_employees (innovera_mobile_extension) where innovera_mobile_extension is not null;
comment on column public.root_employees.innovera_extension is 'INNOVERA の内線番号（PC 版）。発信番号の変更はこちらのユーザで行う';
comment on column public.root_employees.innovera_mobile_extension is 'INNOVERA の内線番号（モバイル版）。履歴・録音の本人判定に PC 版と合わせて使う';
```
（本番への適用は Claude がやる）

## 2. Root（従業員編集）
- `types.ts` の Employee／RootEmployee に `innovera_mobile_extension?: string | null`、`queries.ts` の `ROOT_EMPLOYEE_SELECT_FIELDS` に追加、新規作成の初期値 null
- `page.tsx`：「INNOVERA 内線番号」のラベルを「**INNOVERA 内線番号（PC）**」に変え、その直下に「**INNOVERA 内線番号（モバイル）**」を足す。形のチェックは同じ（空か 2〜6 桁の数字）。文言「INNOVERA 内線番号（モバイル）は 2〜6 桁の数字で入力してください」

## 3. 本人判定を「内線の集まり」にする
- `calls.server.ts` の `CallAccessContext`：`ownExtension: string | null` を残しつつ `ownExtensions: string[]`（PC・モバイルの空でないもの。重複なし）を足す。`access !== "all"` で `ownExtensions` が空なら従来どおり「内線番号が登録されていません…」。`ownExtension` には PC 版（無ければモバイル版）を入れる＝発信番号の変更に使う
- `calls.ts`：`filterCallsForAccess(calls, access, ownExtensions: string[])`・`canPlayRecording(call, access, ownExtensions: string[])` に変える（配列に含まれるか）。既存の呼び出し元とテストを直す。`string` を渡していた箇所は配列にする
- `_lib.ts` の `applyUiFilters`：`mine=1` は `ownExtensions` のどれかに一致する行。`employeeNameByExtension`：`innovera_extension` と `innovera_mobile_extension` の両方で名前を引く（モバイルの行も本人名で出る）。`loadAllowedCallsForDate` の `canPlay` も配列で
- 履歴 API の返り：`ownExtension` に加えて `ownExtensions` も返す
- 録音 API：`canPlayRecording(raw, ctx.access, ctx.ownExtensions)`
- 発信番号（line）API：対象の INNOVERA ユーザは **PC 版の内線（`innovera_extension`）** で引く。PC 版が空でモバイルだけの人は「PC 版の内線番号が登録されていないため、発信番号は変更できません」（400）
- 紐づけ確認（mapping）API：従業員側は PC・モバイルの両方を「紐づき済み」の判定に使う。「内線が紐づいていない従業員」＝両方とも空、または入っている番号が INNOVERA に無い。「従業員に紐づいていない内線」＝どの従業員の PC／モバイルにも無い内線

## 4. 画面
- 「自分だけ」は PC・モバイル両方の行が出る（API 側で判定済み。画面は変えなくてよいが、担当の選択肢で本人名が 2 つの内線にまたがるので、担当の選択肢は「従業員名」単位にまとめる＝選ぶと該当する内線すべてを含める。選択肢の値は内線をカンマ区切りで持ち、API には `extension` を複数回（`extension=2040&extension=1003`）渡す。`applyUiFilters` の `extension` は複数対応にする）
- 自分の発信番号の枠：「（PC 内線 2040 ／ モバイル内線 1003）」のように両方を表示。PC 版が無い人には上の 400 の文言を出す

## テスト（vitest）
- `calls.test.ts`：配列での判定（自分の PC・自分のモバイル・他人）
- API：`own` の人に PC とモバイル両方の行が返る／モバイル内線の録音を本人が聞ける／`mine=1` で両方／line は PC 版で引く・PC 版なしは 400／mapping の判定
- Root：モバイル欄の形チェック
- 最後に `npx.cmd vitest run src/lib/innovera src/app/api/system/innovera-calls src/app/system/innovera-calls src/app/root` と `npx.cmd tsc --noEmit -p .`

## 完了報告（この形で・コードブロックで出力）
```
Codex-367 完了報告
1. 変えた・足したファイル：
2. 追加・変更したテストの本数と結果（vitest の PASS/FAIL 数）：
3. tsc のこの範囲に関するエラー数：
4. 指示と違う作りにした点・迷った点：
5. 触っていないこと（git・.env.local・client.ts・sync.server.ts・本物の外部サービス）の確認：
```
