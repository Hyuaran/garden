# Codex-370：マイページ（トス／クローザー／業務委託）をサイドバー式にし、「通話・録音」を追加。出勤時にその日の内線を登録し、自分の通話だけ見られるようにする（2026-10-09）

## 目的（東海林さんの言葉）
- 「今後従業員へマイページを展開する。自分の情報・勤怠打刻・シフト・前確依頼に『INNOVERA履歴・録音』も追加したい」
- 「上部タブ式になっているが、通常の System のように左側サイドバーにしたい。ロゴも縦に並べるが、画像のみ埋め込みでリンクやツールチップはつけない」「ロゴ画像は全て並べて、System 以外は少し薄め（グレーアウト）」
- 「トス／クローザーは固定席ではなく出勤ごとに内線が変わる。出勤するときにその日の内線番号を入力させ、その日のみ『自分の通話と録音』が確認できるようにしたい」
- 「出勤するときにしか内線番号は入力できない。変更する場合は管理者権限でパスワード入力が必要。内線番号が従業員で書き換えられると他の人の録音が聞き放題になるため」「退勤のときに無効化」
- 「以前と同じ座席でも内線番号は残さず、必ず自分で入力させる（間違いを減らすため）」
- 権限が無いときの文言を「この画面へアクセスする権限がありません／管理者へ問い合わせてください。」に変える

決まっていること（2026-10-09 東海林さん）：メニュー名＝「通話・録音」／対象＝トス・クローザー・業務委託（サイドバーが出ない 3 役職）／ロゴ列＝12 モジュール全部を縦に並べ System だけ通常・他は薄く・押せない・ツールチップ無し／内線は出勤時のみ・前回値を出さない・空では出勤できない／変更は責任者以上の社員番号＋パスワード／退勤で終了・押し忘れは当日 24:00 で終了

## 作業場所・禁止事項
- 作業ツリー：`C:\garden\a-bloom-008`（main 68c4cfd5）。**git の操作は一切しない**（commit・branch・stash も禁止）
- 触らない：`.env.local`・`vercel.json`・本物の外部サービス（INNOVERA・Kintone・Chatwork へは呼ばない。テストはモック）・`public/` の画像・既存の移行 SQL
- 流用する（中身は変えない）：`src/lib/innovera/client.ts`・`src/app/_components/layout/GardenShell/garden-shell-config.ts` の `GARDEN_SHELL_MODULES`（ロゴ画像のパス）・`src/app/_components/ModuleIcon`（`ModuleIcon`・`RailIcon`）・`src/lib/supabase/admin`
- 文言は日本語・開発者用語を画面に出さない・絵文字なし・アイコンは既存の SVG 線画に揃える
- 表の見出し行（th）は中央ぞろえ・日時は `2026-10-08 13:54:57` の形
- 既存のテストが落ちたら本体ではなくテストの期待値を直す（画面数の件数テスト・permission-registry のテストなど）

## 現状（Claude が実測・2026-10-09）
- サイドバーを出さない役職＝`SIDEBAR_HIDDEN_ROLES`（closer・toss・outsource）。`src/app/system/_components/ShachoShell/ShachoShell.tsx` が `hideSidebar` でロゴ列（`styles.rail`）とサイドバー（`styles.side`）を丸ごと出さず、`src/app/system/mypage/MyPageClient.tsx` が `tabbed=true` のとき上部タブ 4 つ（マイページ・勤怠打刻・シフト・前確依頼）を描く
- `/system/attendance`・`/system/shift`・`/system/zenkaku` は `MyPageSectionPage` 経由で同じ `MyPageClient` を描く（`src/app/system/mypage/_components/MyPageSectionPage.tsx`）
- INNOVERA 履歴・録音：`src/app/system/innovera-calls/page.tsx` → `requireCallAccess()`（`src/lib/innovera/calls.server.ts`）。本人判定は `root_employees.innovera_extension`／`innovera_mobile_extension`（固定）。権限の既定は `src/lib/innovera/call-access.ts` の `defaultCallRecordingAccess`（toss／closer＝none、outsource＝all_history_own_audio、cs＝own）。own のときは `InnoveraCallsClient.tsx` の `showAllControls=false` で担当選択などを隠す
- 自分の通話の絞り込み＝`src/app/api/system/innovera-calls/_lib.ts` の `filterCallsForAccess`／`applyUiFilters`（`ownExtensions` の集合だけで判定・時間帯は見ていない）。録音の再生可否＝`canPlayRecording(call, access, ownExtensions)`（`src/lib/innovera/calls.ts`）
- 打刻：`src/app/system/attendance/AttendanceClient.tsx`（出勤／退勤／休憩開始／休憩終了の 4 ボタン → `POST /api/system/attendance/punch`・`punch_type` は `clock_in`／`clock_out`／`break_start`／`break_end`・`client_punch_id` は UUID）。打刻は `system_attendance_punches` に入る
- 権限の一覧：`src/lib/auth/permission-registry.ts`（「サイドバーが出ない役職はマイページのタブ 4 画面」の記述とテスト）／役職の説明 `GARDEN_ROLE_NOTES`
- ログインは `signInUnified(社員番号またはID, パスワード)`（`src/app/login/page.tsx` から呼ぶ。実装は `src/app/_lib` 配下）。社員番号→メールの変換はここにある
- 内線の実態：INNOVERA の内線は 4 桁（例 2007・2014）。root_employees に固定内線があるのは一部（クローザー 8 人中 3 人）。トス 9 人は全員無し

## 作るもの

### A. サイドバー式のマイページ（3 役職）
画面（幅 1680 の例。760px 以下は今の System と同じ引き出し式）：
```
┌──┬──────────────┬─────────────────────────────────────────┐
│🌳│ 🌳 Garden     │ System / マイページ          テスト（トス）さん │
│  │ System／社内   │ マイページ                                │
│🌸│              │                                         │
│🍎│ ▸ マイページ   │   （今の中身そのまま）                     │
│🌱│ ▸ 勤怠打刻    │                                         │
│🌲│ ▸ シフト      │                                         │
│🌿│ ▸ 前確依頼    │                                         │
│🍃│ ▸ 通話・録音   │                                         │
│🌳│              │                                         │
│…│              │                                         │
│  │ テスト（トス）  │                                         │
│  │ 所属会社・役職  │                                         │
└──┴──────────────┴─────────────────────────────────────────┘
```
- `ShachoShell.tsx`：`hideSidebar` の役職でもロゴ列とサイドバーを出す。ただし
  - ロゴ列：先頭に System（今と同じ見た目・押せない `<span>`・ツールチップ無し）→ 区切り → `GARDEN_SHELL_MODULES` の 12 個を順に `ModuleIcon` で縦に並べる。**全部押せない（`Link` ではなく `span`／`div`）・`railTip` を付けない・`aria-hidden`**。System 以外は薄く（`opacity: .35` 程度＋`filter: grayscale(1)`。ライト／ダーク両方で見て決める）
  - サイドバー上部の「Garden」ブランド：押せない（`Link` にしない。これらの役職は `/` に行けないため）。「System ／ 社内システム」の表示は同じ
  - メニュー：5 つだけ（マイページ `/system/mypage`・勤怠打刻 `/system/attendance`・シフト `/system/shift`・前確依頼 `/system/zenkaku`・通話・録音 `/system/innovera-calls`）。`shacho-shell-config.ts` に `LIMITED_MENU_ITEMS`（または同等）を足し、`SIDEBAR_HIDDEN_ROLES` のときはそれを使う。ホーム・資料・入社手続き・準備中の項目は出さない。アイコンは既存の `MenuIcon` のもの（通話・録音は `message`）
  - 下部の利用者カード（名前・所属・役職）は今の System と同じ
  - 引き出し式（760px 以下）も同じ 5 メニュー＋同じロゴ列（押せない）
- `MyPageClient.tsx`／`MyPageSectionPage.tsx`：上部タブを廃止（`tabbed` の分岐を外し、常に標準の見出し＝「自分の情報」「勤怠打刻」…）。`/system/mypage` の見出しはサイドバーの表記に合わせ「マイページ」に統一（CS 以上も同じ表記でよい）
- `permission-registry.ts`：「タブ 4 画面」→「サイドバー 5 画面」に説明と `source` を直し、`GARDEN_ROLE_NOTES`（toss・closer・outsource）も「マイページのメニュー（マイページ・勤怠打刻・シフト・前確依頼・通話・録音）と入社手続きだけ」に。テストの期待値も直す
- `/system` のホーム（カード一覧）と `/system/onboarding` は 3 役職には今までどおり直 URL で開ける（メニューには出さない）

### B. 出勤時の内線登録（固定内線が Root に無い 3 役職の人だけ）
出勤ボタンを押したときの小窓：
```
┌ 出勤 ─────────────────────────────┐
│ 今日の内線番号                       │
│ [            ]  ← 空欄・数字だけ・自動フォーカス │
│ 座った席の電話機の内線（4 桁）です       │
│ （エラーはここに赤字）                 │
│            [ やめる ] [ 出勤する ]     │
└───────────────────────────────────┘
```
- 対象＝`garden_role` が toss／closer／outsource で、`root_employees.innovera_extension` と `innovera_mobile_extension` が両方空の人。それ以外（固定席・CS 以上）は今までどおり小窓なしで打刻
- サーバから `needsExtension: boolean` を渡す（`MyPageSectionPage` → `AttendanceTab` → `AttendanceClient`。`/system/attendance/page.tsx` 側も同じ）
- 小窓の内線欄は**毎回空**（前回の値を出さない・`localStorage` にも残さない・`autocomplete="off"`）。3〜5 桁の数字だけ受け付ける
- 「出勤する」→ `POST /api/system/attendance/punch` に `extension` を付けて送る。サーバ側：
  1. `needsExtension` の人なのに `extension` が無い → 400「今日の内線番号を入力してください」（打刻しない）
  2. 形式（3〜5 桁の数字）でない → 400「内線番号は数字で入力してください」
  3. 他の人の固定内線（`root_employees.innovera_extension`／`innovera_mobile_extension` に一致・本人以外・在籍中）→ 409「この内線は固定席の番号です。管理者へ問い合わせてください」
  4. 同じ内線を別の人が**今・使用中**（`system_innovera_daily_extension` に `ended_at is null` かつ `work_date`＝今日 JST の行がある）→ 409「この内線は ○○さんが使用中です。管理者へ問い合わせてください」（名前は姓だけでよい）
  5. 本人が今日すでに使用中の登録を持っている → その登録をそのまま使う（二重に作らない。小窓は出すが、同じ番号なら成功、違う番号なら 409「今日は 2007 を登録済みです。変更は管理者へ」）
  6. 通れば **登録→打刻** の順に書く。打刻の insert が失敗したら登録を削除して元に戻す
- 退勤（`clock_out`）のとき：本人の今日の使用中の登録に `ended_at=now()`・`ended_reason='clock_out'` を書く（登録が無ければ何もしない）
- 「当日 24:00 で終了」は cron を作らず、**読むときに** `ended_at` が空なら `work_date` の 24:00（JST）を終了時刻とみなす

### C. 記録表（新設・移行 SQL `supabase/migrations/20261009000002_system_innovera_daily_extension.sql`）
`system_innovera_daily_extension`
| 列 | 内容 |
|---|---|
| `id` bigint identity PK | |
| `employee_id` text not null | root_employees.employee_id |
| `work_date` date not null | JST の日付 |
| `extension` text not null | 内線（数字の文字列） |
| `started_at` timestamptz not null default now() | 出勤（または管理者変更）の時刻 |
| `ended_at` timestamptz | 退勤・管理者変更で終了した時刻。空＝使用中（読むときは当日 24:00 を上限） |
| `ended_reason` text | `clock_out`／`admin_change`／空 |
| `source` text not null | `clock_in`／`admin_change` |
| `approved_by_employee_id` text | 管理者変更のときの承認者 |
| `punch_id` bigint | 対応する出勤の打刻（あれば） |
| `created_at` timestamptz default now() | |
索引：`(employee_id, work_date)`・`(extension, work_date)`。部分一意：`(extension) where ended_at is null`（同じ内線の使用中は 1 人）・`(employee_id) where ended_at is null`（本人の使用中は 1 つ）。RLS は他の `system_` 表にならう（service_role だけ）。

### D. 「通話・録音」画面（3 役職・日ごとの内線の人）
- `requireCallAccess()`：固定内線が無く、役職が 3 役職なら **今日の登録**（`work_date`＝今日 JST の行すべて）を読み、`ownWindows: Array<{ extension, from, to }>`（`to`＝`ended_at` または当日 24:00）を ctx に持たせる。登録が 0 件でも **403 にしない**（画面は出す）。`ownExtensions` は窓の内線の集合
- 既定の権限：`defaultCallRecordingAccess` を toss／closer／outsource＝`own` に変える（Root の個人ごとの上書きはそのまま効く）
- 自分の通話の判定（`filterCallsForAccess`・`applyUiFilters`・`canPlayRecording` の 3 か所）：`ownWindows` があるときは **内線が一致し、かつ通話開始時刻が窓の中**のものだけを自分の通話とする。窓の外の通話は一覧にも出さず録音も再生させない（履歴の取得も今日の範囲に限る）
- 画面（own ＋ 日ごとの内線の人）：
```
System / 通話・録音
通話・録音                               INNOVERA最終更新：2026/10/09(金) 16:15 [↻]
┌ 今日の内線 ───────────────────────────────────────────┐
│ 2007（出勤 14:02 から）              [ 内線を変更（管理者） ] │
└──────────────────────────────────────────────────────┘
┌ 自分の発信番号 ──（今の部品そのまま。内線 2007 の回線を表示・切替）─┐
└──────────────────────────────────────────────────────┘
［回線 ▼］［発着 ▼］［結果 ▼］［番号      ］[ 検索 ]      ← 期間の欄は出さない（今日に固定）
2026-10-09 00:00 〜 23:59 の通話 12 件（成功 9・不在 3）
┌ 日時 │ 発着 │ 相手の番号 │ 回線 │ 担当 │ 通話時間 │ 録音 ┐
└──────────────────────────────────────────────────┘
```
  - 登録が無い日：「今日の内線」の枠に「出勤の打刻で今日の内線番号を登録すると、自分の通話と録音が見られます」と出し、一覧は読まない
  - 退勤後：「本日の内線登録は終了しました（退勤 18:32）」。退勤までの通話は見られる
  - 見出しは「通話・録音」（3 役職のとき）。CS 以上は今までどおり「INNOVERA履歴・録音」
  - 「内線を変更（管理者）」の小窓：
```
┌ 内線の変更（管理者） ───────────────┐
│ 新しい内線番号   [        ]          │
│ 管理者の社員番号 [        ]          │
│ 管理者のパスワード [        ]        │
│ （エラーはここに赤字）               │
│            [ やめる ] [ 変更する ]    │
└───────────────────────────────────┘
```
    `POST /api/system/innovera-calls/daily-extension/change`（本人のログイン必須）：
    1. 管理者の社員番号＋パスワードで **ログインと同じ仕組み**（`signInUnified` が使う社員番号→メールの変換と Supabase の `signInWithPassword`）を**別のクライアント**（セッションを保存しない・現在のログインを壊さない）で本人確認する。失敗 → 401「管理者の社員番号またはパスワードが違います」
    2. その人が在籍中で役職が責任者以上（`isRoleAtLeast(role, "manager")`）でなければ 403「責任者以上の権限が必要です」
    3. 新しい内線を B の 2〜4 と同じ検査にかける
    4. 本人の使用中の登録に `ended_at=now()`・`ended_reason='admin_change'` を書き、新しい行（`source='admin_change'`・`approved_by_employee_id`＝管理者）を作る
    5. 失敗も成功も `console.info` に「誰が・何番→何番・承認者・結果」を残す（パスワードは絶対に残さない）
- 責任者以上の画面（all）の担当名：`extensionNames` で名前を引くとき、固定内線に加えて **通話時刻に当たる日ごとの登録**からも名前を引く（通話の日の `system_innovera_daily_extension` を読み、内線と時間帯が合う行の従業員名）。固定が優先

### E. 文言
- `src/app/system/innovera-calls/page.tsx` の拒否表示と `calls.server.ts` の 403 の文言を次に統一：
```
この画面へアクセスする権限がありません
管理者へ問い合わせてください。
```
  （「内線番号が登録されていません。管理者へ問い合わせてください。」は固定席向けに残す。日ごとの内線の人には出さない）

## テスト（vitest・既存の流儀に合わせる）
- 打刻 API：対象者が内線なしで出勤→400／形式違い→400／他人の固定内線→409／使用中→409／正常→登録＋打刻の 2 件・順序／退勤→`ended_at` が入る／固定席の人は `extension` 無しで今までどおり
- 自分の通話の判定：窓の中は見える・窓の外（前の時間帯・退勤後・別の日）は見えない・録音も同じ
- 管理者変更 API：パスワード違い 401／責任者未満 403／正常で旧行の終了＋新行
- ShachoShell：3 役職でサイドバーとロゴ列が出る・ロゴが押せない（`a` が無い）・ツールチップが無い・メニューが 5 つ・CS 以上は今までどおり
- MyPageClient：上部タブが無い
- permission-registry・manuals の件数テストの期待値更新

## 完了報告（コードブロックで。東海林さんがそのまま読む）
1. 変えたファイル一覧（新規／変更）
2. `npx tsc --noEmit` と `npx vitest run` の結果（件数）
3. 移行 SQL のファイル名（Claude が本番へ適用する）
4. 画面の確認手順（トス役職で：出勤→小窓→登録→通話・録音→退勤→終了表示／管理者変更）
5. 迷った点・決め打ちした点
