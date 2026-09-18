# Codex-348 出勤表・シフト連絡：名簿に未登録の人も並びに入れられるように＋名前は KOT を優先＋「並びにいない人」を画面から足す

作成日: 2026-09-19
作業ツリー: C:\garden\a-bloom-008
起点: main の最新（1f17aba 以降。`git log -1` で確認・完了報告に書く）
**git は触らないこと（commit するな）。本番のデータ・DB に触らないこと。開発サーバ・ブラウザを起動しないこと。migration は「書くだけ」（実行しない・Claude が本番に当てる）。触ってよいのは `src/app/system/forms/shukkin/`・`src/app/api/system/shukkin/`・新しい migration とそのテストだけ。**

必ず先に読むもの：
- 前の指示書：`docs/dispatches/dispatch-codex-347-system-forms-shukkin-text-20260919.md`
- 今のコード：`src/app/system/forms/shukkin/_lib/shukkin.ts`・`ShukkinClient.tsx`・`src/app/api/system/shukkin/members/route.ts`・`supabase/migrations/20260919000001_system_shukkin_member.sql`（本番に適用済み・26 人）

## 0. 何を直すか（Claude の本番データでの確認・2026-09-19 0:4x）

並びの表 `system_shukkin_member.employee_number` は `root_employees(employee_number)` への外部キー。ところが実際には：
- **梶野 恵園（KOT 1555）・藤田 悠誠（KOT 1556）** は Garden の従業員名簿（root_employees）に**まだ無い** → 並びに入れられず、出勤表から漏れる
- **谷本 結那（KOT 1510）** は名簿では旧姓の「萩原 結那」 → 名簿の名前を出すと旧姓になる
- 名簿は Kintone から毎朝写すので、入社直後・改姓直後はこうなる

## 1. 直し方

1. **migration（書くだけ）** `20260919000002_system_shukkin_member_free.sql`
   - 外部キー `system_shukkin_member_employee_number_fkey`（名前は `pg_constraint` から引いて落とす。無ければ何もしない）を外す
   - 列 `display_name text null` を足す（名簿に無い人のための名前。足したときの KOT の名前を入れる）
   - 初期データの追加（on conflict で更新）：`1510`・石原チーム・30・`谷本 結那`／`1555`・小泉チーム・20・`梶野 恵園`／`1556`・石原チーム・70・`藤田 悠誠`
2. **名前の決め方**（出勤表・シフト連絡・並びの設定の表示すべて）：**その日の KOT の行の名前 → 名簿（root_employees.name）→ display_name** の順で最初にあるもの。KOT の名前は「姓 名」（半角スペース）なので、出勤表では今の 5 文字そろえ、LINE では半角スペースのまま
3. **members API**：`root_employees(name)` の埋め込み（外部キー前提）をやめ、並びを読んだあと `root_employees` を `employee_number in (...)` で別に引いて名前を付ける。PUT は `display_name` も受け取る（任意）
4. **画面：「並びにいない人」から足す**：CSV を読み込んだあと、対象日に KOT にいるのに並びにいない人の一覧（今の警告）に、1 行ずつ ［区分 ▼］［並びに足す］（責任者以上だけ押せる）。足すと区分の最後に入り、`display_name` に KOT の名前を入れる。押したらすぐ文面に反映
   - SES 事業部など出勤表に出さない人も KOT にいるので、「並びにいない人」は **雇用区分が SES 事業部の人を除いて**出す（KOT の `雇用区分`）。除く区分は定数 1 か所にまとめる
5. 「並びにいるのに KOT にいない人」の警告は今のまま

## 2. テスト（vitest・全部緑にしてから完了報告）
- 名前の優先順：KOT の名前があればそれ（旧姓の名簿より KOT）／KOT に無い日は名簿／名簿に無ければ display_name
- 名簿に無い人（display_name だけ）でも出勤表・シフト連絡に出る
- members API：外部キーの埋め込みを使わずに名前が付く・PUT で display_name を保存・manager 未満は保存できない
- 「並びにいない人」に SES 事業部の人が出ない
- `npx tsc --noEmit`・`npx vitest run src/app/system/forms src/app/api/system/shukkin`

## 3. 完了報告（コードブロックで）

```
Codex-348 完了報告
- 起点の main（git log -1）
- 触ったファイル・migration のファイル名
- 名前の決め方・API の変更
- 「並びにいない人」から足す作り
- テスト結果
- Claude が確認する手順
- 気になった点
```
