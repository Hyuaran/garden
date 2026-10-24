# Codex-424：KOT の従業員情報を Garden から変更する（所属・雇用区分ほか）（2026-10-24）

## 目的
KOT（KING OF TIME）に登録済みの従業員の所属・雇用区分などを、Garden の Root ＞ 従業員の編集から変えられるようにする（東海林さん「今後、変更もすることはあるので」）。
KOT の API は社内ホスト PC の中継からしか呼べない。今の中継（`scripts/relay-agent/agent.mjs`）は `kind=kot` で GET と `POST /employees` だけ許可している → **`GET /employees/{従業員コード}` と `PUT /employees/{employeeKey}` を足す**。

## KOT の API（公式）
- `GET /employees/{employeeCode}?includeResigner=true` → 応答の `key` が employeeKey
- `PUT /employees/{employeeKey}?updateDate=YYYY-MM-DD`：本文に入れた項目だけ更新（空文字を入れると消える＝入れない項目は本文に含めない）。`updateDate` は所属・雇用区分の変更がいつから効くか（既定は今日）
- 項目：divisionCode・typeCode・lastName・firstName・lastNamePhonetics・firstNamePhonetics・hiredDate・birthDate・resignationDate・emailAddresses・gender
- 8:30〜10:00・17:30〜18:30（日本時間）は API が使えない。並列で送らない

## 画面の絵（Root ＞ 従業員 の編集。super_admin のときだけ出す囲み）
```
┌ KOT の登録内容 ───────────────────────────────┐
│ KOT の従業員コード 1571                     ［KOT から読み直す］ │
│ 所属     [本社 ▼]   → 変更後 [事務 ▼]                          │
│ 雇用区分 [パート・アルバイト ▼]                                │
│ いつから [2026-10-24]（所属・雇用区分の変更が効く日）            │
│                                    ［KOT に反映する］           │
└──────────────────────────────────────┘
［KOT に反映する］→ 確認「後道 愛美さん（1571）の所属を 本社 → 事務 に変えます（2026-10-24 から）」［反映する］［やめる］
→ 結果「KOT に反映しました」／失敗理由（KOT が止まっている時間です 等）
```
- 選択肢は Codex-418 で作った KOT の所属・雇用区分の一覧（`GET /divisions`・`GET /working-types`）を使う。
- 今回の対象は **所属・雇用区分**（とその変更日）。氏名・退職日は今回は出さない（関数は項目を受けられる作りにしておく）。
- 置き場所は `src/app/root/employees/page.tsx` の編集の中（ファイルが大きいので、囲みは別の部品ファイルに切り出して差し込む）。見た目は社長スタイル（`BoxSelect` 等）。

## やること
1. 中継 `scripts/relay-agent/agent.mjs`：`kind=kot` で次だけ追加で許可 — `GET /employees/{英数字}`（クエリは includeResigner・date だけ）、`PUT /employees/{英数字と -}`（クエリは updateDate=YYYY-MM-DD だけ・本文 JSON 16KB まで・`Content-Type: application/json; charset=utf-8`）。PUT は再試行しない。テストを足す。README に追記。
2. 中継の型 `src/lib/relay/types.ts` に PUT を足す。`src/app/root/_lib/kot-api.ts` に `fetchKotEmployeeByCode(code)`・`updateKotEmployee(key, fields, updateDate)`（中継のみ・停止スイッチ `KOT_EMPLOYEE_UPDATE_ENABLED !== "true"` なら呼ばずに「KOT の変更は止めています」）。
3. API `src/app/api/root/employees/[employeeId]/kot/route.ts`：GET＝KOT の今の登録内容（所属・雇用区分）、PATCH＝`{ divisionCode?, typeCode?, updateDate }` を KOT に反映。super_admin のみ。従業員の `kot_employee_id`（数字）で KOT を引く。変更の記録を `root_audit_log` に 1 行（action='kot_employee_update'・変更前後の所属／雇用区分のコード）。
4. 画面：上の囲み。
5. テスト：中継の許可範囲（他のパス・メソッド・クエリは拒否）、停止スイッチ、super_admin 以外 403、本文に入れない項目は送らない、監査ログ。

## 触らないもの
- `src/app/bud/bank/`・`src/app/sprout/`・`src/lib/sprout/`・`src/app/system/onboarding/`・`scripts/baitoru-agent/`（別の作業中）。本番・KOT には触らない。**git は触らないでください。コミットは人間側が行います。** npm install はしない。

## 確認
`npx tsc --noEmit`・変更範囲の `npx vitest run <対象>`・`scripts/relay-agent` のテスト。画面の文言に開発者用語を出さない。日本語の文が「???」に化けていないこと。

## 完了報告（コードブロックで）
変更・追加ファイル／中継で増やした許可／テスト結果／気になった点。
