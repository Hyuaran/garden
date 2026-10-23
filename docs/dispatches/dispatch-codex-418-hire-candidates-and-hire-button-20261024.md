# Codex-418：入社予定者の登録と［出社を確認して入社にする］（2026-10-24）

## 目的
設計書 C:\Claude\000_Garden\150_System_システム\02_入社手続き\004_設計_入社の流れの自動化_20261024.md の §2・§3-1・§5・§10（順番 B）を作る。
事務が Garden に「入社予定者」を登録し（KOT の料金がかからないよう番号は付けない）、本当に出社したら［出社を確認して入社にする］を 1 回押すと、
① 社員番号を決める ② KOT に従業員登録 ③ Kintone 従業員名簿へレコード作成 ④ その 1 件を Garden へ同期（既存の syncRootRoster でアカウント作成まで）が順に進む。
**本番では当面、全権管理者（super_admin）だけが見られる・使える**。**KOT 登録は環境変数 `KOT_EMPLOYEE_CREATE_ENABLED=true` のときだけ実行**（未設定なら②の手前で「KOT 登録は停止中」と止まる）。

## 画面の絵
```
System ／ 入社手続き（事務）
[入社予定者] [入社手続き]                                   [＋ 入社予定者を登録]
┌────────────────────────────────────────────────────┐
│ 入社日      氏名         雇用形態     状態              操作                            │
│ 2026-10-27  山田 太郎    アルバイト   入社予定          [出社を確認して入社にする] [来なかった] │
│ 2026-10-24  佐藤 花子    アルバイト   入社済み（1571）   ─                                │
│ 2026-10-20  鈴木 一郎    アルバイト   KOT 登録待ち      [続きから]                       │
│ 2026-10-19  高橋 二郎    アルバイト   来なかった        ─                                │
└────────────────────────────────────────────────────┘
［＋ 入社予定者を登録］→ 画面内の入力欄（モーダル可）：
  姓・名・セイ・メイ／生年月日／性別（男性・女性）／入社日／雇用形態（今の名簿と同じ選択肢）／所属法人（root_companies）／
  KOT の所属（KOT の所属一覧から選ぶ）／KOT の雇用区分（KOT の雇用区分一覧から選ぶ）
［出社を確認して入社にする］→ 確認「山田 太郎さんを社員番号 1571 で KOT と Garden に登録します。KOT はこの時点から料金の対象になります。」［登録する］［やめる］
  → 進み具合を 4 行で表示（社員番号を決める／KOT に登録／Kintone 名簿に登録／Garden に反映）。済み＝✓、失敗＝理由＋［続きから］
```
- 見た目は社長スタイルの型（`SystemBreadcrumb`・`SystemTabs`・`DataTable`・`BoxSelect`）。今の「入社手続き（事務）」一覧はタブ「入社手続き」の中にそのまま置く。
- 「入社予定者」タブは super_admin のときだけ出す（責任者などには今の画面のまま）。

## やること
1. **migration** `supabase/migrations/20261024000001_system_hire_candidates.sql`（begin/commit・BOM なし）
   - 表 `system_hire_candidates`：id uuid、last_name、first_name、last_name_kana、first_name_kana、birthday date、gender（'male'/'female'）、hire_date date、employment_type text、company_id text、kot_division_code text、kot_type_code text、status（'planned'/'no_show'/'hiring'/'hired'）、employee_number text（決めた番号）、employee_id text（Garden の従業員）、kintone_roster_record_id text、steps jsonb（各段階の済み・時刻・失敗理由）、created_by uuid、created_at、updated_at。RLS 有効・super_admin だけ select/insert/update（`bud_is_super_admin()` と同等の判定。System 側に既存の super_admin 判定関数があればそれを使う）。
2. **社員番号の決め方**：`root_employees` の `employee_number` のうち数字だけで 9000 未満のものの最大＋1（9001〜・9997〜9999・999991 などのテスト／外注番号を除く）。さらに KOT の従業員一覧（GET /employees）の code とも重ならないことを確かめる。決めた番号は表に保存し、［続きから］では同じ番号を使い続ける（番号を取り直さない）。
3. **KOT**（`src/app/root/_lib/kot-api.ts` と中継）
   - 一覧取得：`GET /divisions`（code・name）と `GET /working-types`（code・name）を中継経由で読む関数（登録画面の選択肢）。KOT は 8:30〜10:00・17:30〜18:30（日本時間）に API を使えない → その時間は「KOT が止まっている時間です（10:00／18:30 以降に使えます）」と表示。
   - 登録：`POST /employees`（必須＝code・lastName・firstName・divisionCode・typeCode・gender、任意＝lastNamePhonetics・firstNamePhonetics・hiredDate・birthDate。日付は YYYY-MM-DD）。中継の型 `src/lib/relay/types.ts` に `{ method: "POST"; path: "/employees"; body: {...} }` を足す。**POST は再試行しない**（二重登録を防ぐ。失敗したら次に［続きから］で GET /employees で同じ code があるか確かめてから登録し直す）。
   - ホスト PC の中継 `scripts/relay-agent/agent.mjs`：`kind=kot` で **POST は path が `/employees` ちょうどのときだけ**許可し、本文は JSON・16KB まで・`Content-Type: application/json; charset=utf-8`。POST は 429／5xx でも再試行しない。テスト（`scripts/relay-agent/` の既存テストの形）も足す。README に「POST /employees を許可」を追記。
   - 停止スイッチ：`KOT_EMPLOYEE_CREATE_ENABLED !== "true"` なら KOT 登録を呼ばず、段階を「KOT 登録は停止中（東海林さんの OK 待ち）」で止める。
4. **Kintone 従業員名簿へ作成**：`src/app/root/_lib/roster-sync.server.ts` の名簿→Garden の変換（mapRosterRecordToRoot など）が読んでいる項目コードを逆に使い、氏名（姓名・カナ）・生年月日・入社日・雇用形態・社員番号（`社員番号`）・打刻ID（`打刻ID`）・従業員ステータス（在籍中）・所属法人など、同期で Garden の従業員が正しく作られるのに必要な項目を入れて `POST /k/v1/record.json`（トークン `KINTONE_EMPLOYEE_ROSTER_TOKEN`）。名前＋生年月日で同じ人の在籍中レコードが既にあれば作らずにそれを使う（二重登録防止）。作れたら record id を保存。名簿トークンに追加の権限が無くて 403 になったら「Kintone 名簿に登録できませんでした（名簿の API トークンに『レコード追加』の権限が必要です）」と表示。
5. **Garden へ反映**：作った record id で `syncRootRoster({ dryRun: false, recordIds: [id] })` を呼び、作られた `root_employees` の employee_id を保存（アカウントもここで作られる＝初期パスワードは今の規約どおり）。
6. **［来なかった］**：status を no_show にして残す（消さない）。［取り消す］は作らない。
7. API：`src/app/api/system/hire-candidates/route.ts`（GET 一覧・POST 登録）、`[id]/route.ts`（PATCH 修正・来なかった）、`[id]/hire/route.ts`（POST＝入社にする／続きから）、`kot-options/route.ts`（GET＝所属・雇用区分）。すべて super_admin 以外は 403。
8. テスト：番号の決め方（テスト番号を除く・KOT と重ならない）、停止スイッチで KOT を呼ばない、POST を再試行しない、続きからで番号を取り直さない、名簿の二重登録防止、super_admin 以外 403、中継の POST 許可範囲。

## 触らないもの
- `src/app/bud/bank/` 配下（別件の作業中）。
- 本番 DB・Vercel 環境変数・Kintone・KOT には触らない（migration は人間が当てる）。
- **git は触らないでください。コミットは人間側が行います。**

## 確認
`npx tsc --noEmit` と変更範囲の `npx vitest run <対象>`、`scripts/relay-agent` のテストが通ること。画面の文言に開発者用語を出さない。

## 完了報告（コードブロックで）
変更・追加ファイル／migration の要点／Kintone 名簿へ入れる項目コードの一覧／テスト結果／気になった点。長い説明は不要。
