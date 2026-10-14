# Codex-376：シフト連絡を Garden から公式 LINE「スタッフ連絡用_official」で従業員へ届ける（受け口＝「連携 社員番号」で紐づけ／紐づけ一覧／「公式 LINE で送信」ボタン／送信記録）（2026-10-14）

## 目的（東海林さんの言葉）
- 「シフト連絡タブ：送る相手と文面をまとめてコピーの左にもうひとつボタン（公式 LINE で送信）を新設。『スタッフ連絡用_official』アカウントから該当従業員へ該当テキストをチャット送信したい」
- 「シフト間違いやシフト忘れのため『こちらから届ける』にしています」＝**プッシュ（Garden から届ける）で行く**。従業員の LINE は「連携 社員番号」と送ってもらって紐づける（決定 2026-10-14・記録 010_Daily/2026-10-14/020_Claude/014）
- 前提：LINE 公式アカウント「スタッフ連絡用_official」（@586gtqpd・友だち 51 人・未認証・コミュニケーションプラン）の Messaging API は有効化済み（Channel ID 2012019265・プロバイダー Garden）。鍵は Vercel 環境変数 `LINE_STAFF_CHANNEL_SECRET`／`LINE_STAFF_CHANNEL_ACCESS_TOKEN`（**NHK 用の `LINE_CHANNEL_SECRET`／`LINE_CHANNEL_ACCESS_TOKEN` とは別のアカウント・別の鍵**。混ぜない）

## 作業場所・禁止事項
- 作業ツリー：`C:\garden\a-bloom-008`。**git の操作は一切しない**（commit・branch・checkout・stash 禁止。コミットは人間側）
- 触らない：`.env.local`・`vercel.json`・`scripts/**`・`src/lib/relay/**`・`src/lib/innovera/**`・`src/app/api/system/line/webhook/**`（NHK の受け口＝参考に読むだけ）・`src/app/api/system/shukkin/chatwork/**`（出勤表の Chatwork 送信＝変えない）。本物の外部サービス（LINE・Supabase 本番）は呼ばない（テストは偽の fetch）
- **前から落ちているテスト（`KpiCard` 2 本・`BackgroundCarousel` 5 本・`AppHeader` 5 本）は触らない。通すために `src/app/_lib/kpi-fetchers.ts`・`src/components/shared/garden-view/BackgroundCarousel.tsx`・`src/app/_components/AppHeader.tsx` を変えない**
- 文言は日本語・開発者用語を画面に出さない（「LINE の ID」「紐づけ」のような言葉で）・絵文字を足さない・社長スタイル（`shukkin.module.css` の既存部品と色をそのまま）

## 現状（Claude が読んだ）
- 画面 `src/app/system/forms/shukkin/ShukkinClient.tsx`：タブ `attendance`／`line`／`members`。シフト連絡タブは `lineBlocks`（`buildLineShiftBlocks`・`src/app/system/forms/shukkin/_lib/shukkin.ts`）＝まとまりごとに `{ shift, people: ShukkinMember[], recipients: string[]（"1568 中山 聖也" の行）, message（LINE に送る文面）, summary }`。下に `<button className={styles.primary}>送る相手と文面をまとめてコピー</button>`。`ShukkinMember`＝`{ employeeNumber, name, displayName?, employmentType?, groupName, sortOrder, active? }`。`canEditMembers`＝manager 以上（`page.tsx`）
- 出勤表タブの Chatwork 送信（Codex-375・前例）：`ChatworkSendDialog`（`_components/`・`createPortal`・確認→送信中は `ListProcessingOverlay`→「送信しました」／失敗は赤字＋「もう一度」）。同じ作りでよい
- NHK の LINE 受け口（前例・読むだけ）：`src/app/api/system/line/webhook/route.ts`＝`x-line-signature` を `createHmac("sha256", secret).update(rawBody).digest("base64")` と `timingSafeEqual` で照合／`reply` は `POST https://api.line.me/v2/bot/message/reply`／できごと 1 つが失敗しても 200 を返す（LINE に送り直させない）
- 名簿：`root_employees`（`employee_id` 'EMP-0008' 形式・`employee_number` '0008'／'1568'・`name`・`is_active`・`deleted_at`・`garden_role`）。**`line_user_id` 列はまだ無い**（この指示書で足す）
- 管理用 DB：`getSupabaseAdmin()`。migration の置き場 `supabase/migrations/20261014000002_<内容>.sql`（`20261014000001` は使用済み）

## LINE Messaging API（使う 4 本・すべて `Authorization: Bearer <LINE_STAFF_CHANNEL_ACCESS_TOKEN>`）
| 用途 | 呼び方 |
|:---:|:---:|
| 返信（無料） | `POST https://api.line.me/v2/bot/message/reply` `{ replyToken, messages:[{type:"text",text}] }` |
| 届ける（有料枠） | `POST https://api.line.me/v2/bot/message/multicast` `{ to:[userId…（最大 500）], messages:[{type:"text",text}] }`。1 人 1 通で数える |
| 表示名 | `GET https://api.line.me/v2/bot/profile/{userId}` → `{ displayName }` |
| 今月の枠 | `GET https://api.line.me/v2/bot/message/quota` → `{ type:"limited", value:200 }`／`GET …/quota/consumption` → `{ totalUsage }` |
- 共通部品を `src/lib/line/staff-client.ts` に（`replyLineStaff`・`pushLineStaff(userIds, text)`・`getLineStaffProfile`・`getLineStaffQuota`。`fetchImpl` 差し替え可・失敗は `Error("line_staff:http 4xx")` 形式）

## 作るもの

### 1. 表（migration `supabase/migrations/20261014000002_line_staff_link.sql`）
- `root_employees` に列追加：`line_user_id text unique`（null 可）／`line_display_name text`／`line_linked_at timestamptz`／`line_link_source text`（'self'＝本人が連携・'admin'＝管理者が選んだ）。コメント（日本語）
- `system_line_staff_pending`（紐づけ前に送ってきた人）：`line_user_id text pk`／`display_name text`／`last_text text`／`first_seen_at`／`last_seen_at timestamptz`。RLS 有効・ポリシー無し
- `system_line_staff_message`（送信記録）：`id uuid pk`／`work_date date`／`shift text`／`employee_id text`／`employee_number text`／`line_user_id text`／`message text`／`status text check in ('sent','failed','unlinked')`／`error text`／`sent_by_employee_id text`／`sent_at timestamptz default now()`。索引 `(work_date, sent_at)`。RLS 有効・ポリシー無し

### 2. 受け口 `POST /api/system/line/staff/webhook`（新規・`runtime="nodejs"`・`dynamic="force-dynamic"`）
- 署名＝`LINE_STAFF_CHANNEL_SECRET` で NHK と同じ照合。違えば 401。本文が JSON でなければ 400。できごとごとに try/catch で 200
- `follow`（友だち追加）：返信「スタッフ連絡用です。シフト連絡を受け取るために、『連携 社員番号』（例：連携 1568）と送ってください。」
- `message`（text）：
  - 本文が `連携` ＋ 社員番号（全角・半角の空白、全角数字も許す。3〜5 桁）に一致 →
    - `root_employees` で `employee_number`（左ゼロ埋めの揺れは **4 桁に揃えて** 照合。'0008' と '8' は同じ）かつ `is_active=true`・`deleted_at is null` を探す
    - 見つからない → 返信「社員番号 1568 が名簿に見つかりません。番号を確かめて、もう一度『連携 社員番号』と送ってください。」
    - その社員番号が **別の LINE** に紐づいている → 返信「この社員番号はすでに別の LINE と紐づいています。事務へ連絡してください。」（上書きしない）
    - 同じ LINE が **別の社員番号** に紐づいている → 付け替える（`line_link_source='self'`・`line_linked_at` 更新）＝本人の送り直しを優先
    - 紐づけ成功 → `GET profile` で `line_display_name`（取れなくても続ける）→ `root_employees` 更新 → `system_line_staff_pending` から削除 → 返信「中山 聖也さんとして登録しました。これからシフト連絡はこの LINE に届きます。」（名簿の `name` を使う）
  - それ以外の text：送り主が未紐づけなら `system_line_staff_pending` を upsert（`display_name` は profile・`last_text` は先頭 100 文字）し、返信「シフト連絡を受け取るために、『連携 社員番号』（例：連携 1568）と送ってください。」を **1 人 1 日 1 回まで**（`last_seen_at` が今日なら返信しない＝うるさくしない）。紐づけ済みなら何もしない（返信なし）
- `unfollow`：`line_user_id` が一致する `root_employees` の `line_user_id` を null にせず、`line_link_source='unfollowed'` を記録（送信時に「ブロック中」として扱う）

### 3. 紐づけの一覧と手動の紐づけ（シフト連絡タブの中・`canEditMembers`＝manager 以上だけ表示）
- シフト連絡タブの対象日の行の下に折りたたみ「LINE の紐づけ（済み 31 ／ 未 20）」：
  - 表 1＝並びの設定のメンバー全員：社員番号・名前・状態（「済み（LINE の表示名）」「未」「ブロック中」）・済みの行には「外す」（確認→`line_user_id` を null・`line_link_source='admin_unlink'`）
  - 表 2＝`system_line_staff_pending`（連携前に送ってきた人）：LINE の表示名・最後の文・最後に送ってきた日時（`2026-10-14 18:32:46` の形）・「この人は」プルダウン（未紐づけのメンバーだけ）＋「紐づける」→ `POST /api/system/shukkin/line-link { lineUserId, employeeNumber }`（manager 以上・`line_link_source='admin'`・pending から削除）
- API：`GET /api/system/shukkin/line-link`（manager 以上）＝メンバーの状態と pending の一覧／`POST`＝手動紐づけ／`DELETE`＝外す

### 4. 「公式 LINE で送信」（シフト連絡タブ・社員以上）
- `［送る相手と文面をまとめてコピー］` の **左** に `［公式 LINE で送信］`（`styles.primary` と同じ大きさ・主ボタン）。`lineBlocks` が 0 件なら disabled
- 押す → 確認モーダル `LineSendDialog`（`_components/`・`ChatworkSendDialog` と同じ作り）：
  - 見出し「この内容で公式 LINE に送信します」／送り先「スタッフ連絡用_official から、対象日 2026/10/15 のシフト連絡を届けます」
  - **今月の枠**：`GET /api/system/shukkin/line-send` が `{ quota: 200|null, used: 123, remaining, needed }` を返す。`needed`（今回送る人数）が `remaining` を超えるなら赤字「今月の送信枠が足りません（残り 12 通・今回 18 通）。プランの変更が要ります。」で送信ボタンを disabled
  - まとまりごとの表：シフト／送れる人（紐づけ済みの名前）／**届かない人（未紐づけ・ブロック中の名前を赤字）**／文面（折りたたみ）
  - チェック「自分だけに試し送り」（ログイン中の本人の `line_user_id` が無ければ disabled・注記「自分の LINE を先に連携してください」）＝全まとまりの文面を本人 1 人に送る（記録は `shift` に「試し送り」）
  - ボタン：「やめる」／「送信する」。送信中は `ListProcessingOverlay`（「公式 LINE に送信しています…」）。`finally` で必ず閉じる・二重押し防止
- `POST /api/system/shukkin/line-send`（社員以上）本文 `{ date, blocks:[{ shift, employeeNumbers:[…], message }], testOnly?: boolean }`：
  - サーバで `root_employees` から `employeeNumbers` → `line_user_id`（4 桁揃えで照合・`is_active`・`line_link_source<>'unfollowed'`）
  - まとまりごとに **multicast 1 回**（最大 500）。失敗（HTTP 4xx/5xx）はそのまとまり全員を `failed`
  - 記録：1 人 1 行を `system_line_staff_message`（`sent`／`failed`／`unlinked`）
  - 返り `{ ok, sent:[{employeeNumber,name,shift}], unlinked:[…], failed:[…], sentAt }`
  - `testOnly` のときは本人の `line_user_id` 1 件にだけ全文面（まとまりごとに 1 通ずつ）
- 結果表示：モーダルを「送信しました」＋「届けた 18 人／届かなかった 3 人（未紐づけ：○○・○○／ブロック中：○○）」＋時刻（秒まで）＋「閉じる」に差し替え。失敗は赤字＋「もう一度」

### 画面の絵（シフト連絡タブ）
```
対象日 [2026/10/15 ▼]   対象：宮永チーム・小泉チーム・石原チーム・新人チームの全員
▸ LINE の紐づけ（済み 31 ／ 未 20）            ← manager 以上だけ・折りたたみ
┌ 14-21（8 人）                         [コピー] ┐
│ 1568 中山 聖也 … （送る相手）                   │
│ 【14-21】の勤務シフトです。…（文面）            │
└───────────────────────────────────────────┘
…
[公式 LINE で送信]  [送る相手と文面をまとめてコピー]

確認モーダル
┌────────────────────────────────────────────┐
│ この内容で公式 LINE に送信します              │
│ スタッフ連絡用_official から 2026/10/15 のシフト連絡 │
│ 今月の枠：残り 180 通／今回 18 通              │
│ ┌ シフト │ 送れる人 │ 届かない人 │ 文面 ┐        │
│ │ 14-21 │ 中山・西野…（7）│ 大塚（未）│ ▸ │        │
│ └──────────────────────────────┘        │
│ □ 自分だけに試し送り                          │
│                        [やめる] [送信する]   │
└────────────────────────────────────────────┘
```

### 5. 環境変数の案内
- `LINE_STAFF_CHANNEL_SECRET`／`LINE_STAFF_CHANNEL_ACCESS_TOKEN`（Vercel・人間が入れる）。`.env.example` があれば 2 行足す（無ければ作らない）

## テスト（vitest）
1. 受け口：署名違い 401／`連携 1568` で紐づけ＋返信（名簿の名前入り）／全角「連携　１５６８」も可／番号違い（見つからない）の返信／別の LINE に紐づけ済みの番号は上書きしない／同じ LINE の付け替え／紐づけ前の雑談は pending に入り案内は 1 日 1 回／紐づけ済みの雑談は何もしない／`follow` の案内／できごと 1 つが失敗しても 200
2. `line-send`：未紐づけは `unlinked` に／multicast がまとまりごとに 1 回・`to` が紐づけ済みの `line_user_id` だけ／HTTP 失敗はまとまり全員 `failed`／`testOnly` は本人 1 件だけ／記録が 1 人 1 行
3. `line-link`：manager 未満 403／手動紐づけで pending から消える／外す
4. 画面：「公式 LINE で送信」がまとめてコピーの左／モーダルに枠と送れる人・届かない人が出る／枠不足で送信ボタン disabled／試し送りチェック／送信後の結果表示／紐づけの折りたたみは manager だけ
5. 既存テスト（`src/app/system/forms/shukkin/**`・`src/app/api/system/shukkin/**`・`src/app/api/system/line/**`）は緑のまま。**KpiCard・BackgroundCarousel・AppHeader の 12 本は前から落ちている＝対象外**

## 完了報告（コードブロックで。東海林さんがそのまま読む）
1. 変えたファイル一覧（新規／変更）
2. `npx tsc --noEmit` と `npx vitest run src/app/system/forms/shukkin src/app/api/system/shukkin src/app/api/system/line src/lib/line` の結果（件数）
3. 本番に適用する SQL（migration のパス）と、Vercel に足す環境変数の名前（値は書かない）、LINE Developers に設定する Webhook URL
4. 迷った点・決め打ちした点
