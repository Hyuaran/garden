# Codex-334 Root：雇用形態に「役員」を追加（名簿の 役員 を Root でもそのまま持つ）

作成日: 2026-09-16
作業ツリー: C:\garden\a-bloom-008
起点: main 4286801（`git log -1` で一致を確認してから着手。**Codex-314 が同じ作業ツリーで `src/app/system/list`・`src/app/api/soil/list` を編集中。そこは読みも書きもしない**）
**git は触らないこと（commit するな）。本番のデータ・DB・Kintone に触らないこと。開発サーバ・ブラウザを起動しないこと。migration は supabase/migrations に書くだけで実行しない（実行は Claude）。**

必ず先に読むもの：
- ④ Root 従業員情報の履歴：C:\Claude\000_Garden\040_Root_組織マスタ\00_マニュアル\01_従業員情報の履歴と収集\Garden_Root_従業員情報の履歴と収集_4_仕様書_Claude読み込み用.md（§2-4 employment・§3-1 名簿同期）
- 名簿同期：C:\garden\a-bloom-008\src\app\root\_lib\roster-sync.server.ts（`normalizeEmploymentType`・`roleFromRoster`・`mapRosterRecordToRoot`）
- 今の 3 値の決め：C:\garden\a-bloom-008\supabase\migrations\20260425000002_root_employees_outsource_extension.sql（`root_employees_employment_type_check`＝'正社員'／'アルバイト'／'outsource'）
- 値を並べている場所：C:\garden\a-bloom-008\src\app\root\_lib\validators.ts（176 行付近）・src\app\root\employees\page.tsx（38 行付近の選択肢と 142 行の初期値）・src\app\root\_constants\types.ts（97／121 行のコメント・225 行付近）・src\app\system\mypage\tabs\ProfileTab.tsx（基本情報の「雇用形態」表示）・src\app\system\onboarding\_lib\onboarding-admin.ts（給与の区分・交通費の決まり）
- 交通費の決まり（社員＝定期代／アルバイト＝往復×日数）：C:\Users\shoji\.claude\projects\C--garden-main028\memory\project_commute_payment_rule.md

## 0. 何を直すか（東海林さん 2026-09-16「役員の項目を増やそう」）

Kintone 従業員名簿の雇用形態は パート／役員／正社員／パートナー／アルバイト／準社員／派遣 の 7 値。Root は 正社員／アルバイト／outsource の 3 値に丸めているため、後道 翔太（名簿＝役員）が Root では「正社員」になる。**Root に「役員」を足し、名簿の 役員 はそのまま 役員 として持つ**。ほかの丸め（パート・準社員→アルバイト、パートナー・派遣→外注扱い？）は今回は変えない（今の `normalizeEmploymentType` の判定のまま。役員だけ先に判定する）。

## 1. データ（migration 1 本・`supabase/migrations/20260917000005_root_employees_employment_type_officer.sql`）

```sql
alter table public.root_employees drop constraint if exists root_employees_employment_type_check;
alter table public.root_employees add constraint root_employees_employment_type_check
  check (employment_type in ('正社員', 'アルバイト', 'outsource', '役員'));
comment on column public.root_employees.employment_type is '正社員 / アルバイト / outsource（外注） / 役員。名簿同期が名簿の雇用形態から決める';
```
- `root_employee_profile_history` の `employment` 区分は payload に名簿の値をそのまま持っているので変更なし
- 他の表で employment_type の check を持つものが無いか `git grep employment_type -- supabase/migrations` で確認し、あれば同じく 役員 を足す

## 2. コード

1. `normalizeEmploymentType`：**最初に `/役員/` を見て `"役員"` を返す**。残りは今のまま
2. `roleFromRoster`：役員は アルバイト の判定に入らない（既存の garden_role を維持・新規なら staff）＝今の else 側と同じ動き。変えなくてよいが、テストで「役員 → staff」を固定する
3. `validators.ts`：許す値に "役員" を足す。エラー文言は「正社員 / アルバイト / 外注 / 役員 のいずれか」
4. Root 従業員一覧（`employees/page.tsx`）の雇用形態の選択肢に「役員」を足す（並び：役員・正社員・アルバイト・外注）。絞り込みや表示で雇用形態を日本語に直している場所（outsource→外注 など）があれば 役員 はそのまま表示
5. マイページの基本情報「雇用形態」はそのまま値を出しているだけなら変更なし。outsource を「外注」に直している対応表があれば 役員 を通す
6. **雇用形態で分岐している場所を全部洗う**（`git grep -n "employment_type" -- src`）。分岐は「役員＝正社員と同じ扱い」にする：交通費（定期代）・給与の区分の初期値・権限（`view-roles.ts`／`permission-registry.ts` に雇用形態の判定があれば）・入社手続きの事務入力。**変えた場所を完了報告に全部列挙**
7. 型：`RootEmployee.employment_type` のコメントと、もし union 型（"正社員" | "アルバイト" | "outsource"）があれば "役員" を足す

## 3. テスト（vitest）
- `normalizeEmploymentType("役員") === "役員"`／`"パート"`→アルバイト／`"外注"`→outsource／空→正社員 は今のまま
- `mapRosterRecordToRoot` で名簿の 雇用形態=役員 の行が `employment_type: "役員"`・`is_active` などは変わらない
- validators：役員が通る・"社長" は通らない
- 既存テストを壊さない（`npx vitest run src/app/root src/lib/auth` と `npx tsc --noEmit`）

## 4. 完了報告（コードブロックで）

```
Codex-334 完了報告
- 触ったファイル（全パス）
- migration の内容
- 雇用形態で分岐していた場所と、役員をどちらに寄せたか（全部）
- テスト結果
- Claude が確認する手順（migration 適用 → 名簿同期 → EMP-0000 が 役員 になる → Root 従業員一覧・マイページの表示）
```
