# Codex-375：出勤表・シフト連絡の文面生成に「Chatwork へ送信」ボタン（出勤表タブ・確認モーダル・本人の Chatwork トークンで指定ルームへ）（2026-10-14）

## 目的（東海林さんの言葉）
- 「このテキストを Chatwork に送信や、公式 LINE で従業員へ送信するのをできるだけ Garden 内で完結させたい。出勤表タブ：コピーボタンの左にもうひとつボタン（Chatwork へ送信）を新設。Garden アカウントに紐づいている Chatwork API で指定ルームへ送信する。ボタンを押すとこの内容でいいかというモーダルを出し、送信するを押すと実際送信する流れで。まずは開発ルームへの送信で試して、完成したら本番ルームの ID を伝えます」
- この指示書は**出勤表タブの Chatwork 送信だけ**。シフト連絡タブの「公式 LINE で送信」は別の指示書（LINE 側の準備が先）

## 作業場所・禁止事項
- 作業ツリー：`C:\garden\a-bloom-008`。**git の操作は一切しない**（commit・branch・checkout・stash 禁止。コミットは人間側）
- 触らない：`.env.local`・`vercel.json`・`scripts/**`・`src/lib/relay/**`・`src/lib/innovera/**`。本物の外部サービス（Chatwork・Supabase 本番）は呼ばない（テストは偽の fetch）
- **前から落ちているテスト（`KpiCard` 2 本・`BackgroundCarousel` 5 本・`AppHeader` 5 本）は触らない。通すために `src/app/_lib/kpi-fetchers.ts`・`src/components/shared/garden-view/BackgroundCarousel.tsx`・`src/app/_components/AppHeader.tsx` を変えない**
- 文言は日本語・開発者用語を画面に出さない・絵文字を足さない・社長スタイル（既存の `shukkin.module.css` の部品と色をそのまま使う）

## 現状（Claude が読んだ）
- 画面：`src/app/system/forms/shukkin/ShukkinClient.tsx`（`/system/forms/shukkin`・業務管理ツール＞出勤表・シフト連絡）。タブ `attendance`（出勤表）／`line`（シフト連絡（LINE））／`members`。出勤表タブの操作行 `.controls.attendanceControls` の右端に `<button className={styles.copy} onClick={() => void copyText(attendanceText)}>コピー</button>`。文面は `attendanceText`（string・`<pre className={styles.preview}>` に表示）。対象日 `attendanceDate`・時刻 `attendanceTime`
- 本人の Chatwork トークンで送る既存の作り（**これに揃える**）：`src/app/api/system/payroll-notice/route.ts`＝`requireStaff()`（`@/app/system/mypage/_lib/submission-server`）→ `root_employees.chatwork_api_token_enc` を読む（無ければ `syncChatworkTokens({ kotEmployeeId })` で Kintone 名簿から取り込んで再読）→ `decryptToken`（`@/app/rill/mail/_lib/token-crypto`）→ `sendChatworkMessageWithToken({ token, roomId, text })`（`@/app/system/_lib/chatwork`）。文言 `TOKEN_MISSING_MESSAGE`＝「Chatwork の API トークンが従業員名簿に登録されていません。事務へ連絡してください」
- ルーム ID の決め方（既存の例）：`process.env.PAYROLL_NOTICE_CHATWORK_ROOM_ID || process.env.CHATWORK_DEV_ROOM_ID`
- 処理中の見た目（正本）：社長スタイルの全画面くるくる `src/app/system/list/_components/ListProcessingOverlay.tsx`（`createPortal` で body 直下・幕 濃紺 `rgba(16,35,63,.9)`・くるくる上ティール `#0ea5a0`／右白・注意帯 `#fff7e6`／`#8a5a00`・`role="status" aria-live="assertive"`）

## 作るもの

### 1. API `POST /api/system/shukkin/chatwork`（新規・`src/app/api/system/shukkin/chatwork/route.ts`・`runtime = "nodejs"`）
- 入口：`requireStaff()`（社員以上。無ければ 403）
- 本文：`{ text: string, date: string, time: string }`。`text` は空なら 400「送る文面がありません」。4,000 文字で打ち切らず 400「文面が長すぎます」（Chatwork の上限に近いので）
- ルーム：`process.env.SHUKKIN_CHATWORK_ROOM_ID || process.env.CHATWORK_DEV_ROOM_ID`。どちらも無ければ 500「送り先のルームが設定されていません」（**本番ルームの ID はあとで東海林さんが `SHUKKIN_CHATWORK_ROOM_ID` に入れる。コードに ID を書かない**）
- トークン：payroll-notice と同じ `ensureOwnToken` の流れ（共通化できるなら `src/app/system/_lib/chatwork-own-token.server.ts` に切り出して payroll-notice からも使う。無理に共通化しなくてよい）。無ければ 400 で `TOKEN_MISSING_MESSAGE`
- 送信：`sendChatworkMessageWithToken({ token, roomId, text })`。文面は**画面の `attendanceText` をそのまま**（先頭に `[info]` 等の Chatwork タグを足さない＝今のコピー貼り付けと同じ見た目）
- 返り：`{ ok: true, roomId, messageId?, sentAt }`／失敗 502 `{ ok: false, error: "Chatwork に送れませんでした。しばらくしてからもう一度お試しください" }`
- `console.info("[shukkin.chatwork]", { employeeId, date, time, roomId, ok, messageId })`（文面とトークンはログに出さない）

### 2. 画面（`ShukkinClient.tsx`・出勤表タブだけ）
- 操作行の右端を `［Chatwork へ送信］［コピー］` の並びに（**送信ボタンはコピーの左**）。見た目は `styles.copy` と同じ大きさ・ティール地の主ボタン（`styles.primary` 相当）。`attendanceText` が空なら disabled
- 押す → **確認モーダル**（画面中央・白カード・最大幅 640px・社長スタイル。`createPortal` で body 直下）：
  - 見出し「この内容で Chatwork に送信します」
  - 送り先の行「送り先：開発ルーム（テスト）」＝API の `GET /api/system/shukkin/chatwork` で `{ roomLabel }` を返して出す（`SHUKKIN_CHATWORK_ROOM_ID` があれば「本番ルーム」・無ければ「開発ルーム（テスト）」。ルーム ID の数字は画面に出さない）
  - 文面のプレビュー（`<pre>`・最大高さ 50vh・縦スクロール・読み取り専用）
  - ボタン：左「やめる」（閉じる）／右「送信する」（主ボタン）。Esc と幕のクリックで閉じる。送信中は両方 disabled
- 「送信する」→ 全画面くるくる（`ListProcessingOverlay` と同じ作り・文言「Chatwork に送信しています…」＋「この画面を閉じないでください」。`finally` で必ず閉じる・二重押し防止）→ 成功ならモーダルの中身を「送信しました」（送り先・時刻 `2026-10-14 15:30:12` の形）＋「閉じる」に差し替え（自動では閉じない）／失敗なら理由の赤字と「もう一度」「やめる」
- モーダルは新しい部品 `src/app/system/forms/shukkin/_components/ChatworkSendDialog.tsx`（＋`.module.css` か `shukkin.module.css` に追記）。くるくるは `ListProcessingOverlay` をそのまま import して使ってよい（System 配下同士）

### 画面の絵（出勤表タブ・操作行）
```
┌ 席数 … ──────────────────────────────────────────────────────┐
│ 対象日 [2026/10/15 ▼]  時刻 (○)14:00   □出勤の確認を付ける   [Chatwork へ送信] [コピー] │
├──────────────────────────────────────────────────────────────┤
│ （文面のプレビュー）                                            │
└──────────────────────────────────────────────────────────────┘

確認モーダル
┌──────────────────────────────────────────┐
│ この内容で Chatwork に送信します            │
│ 送り先：開発ルーム（テスト）                 │
│ ┌──────────────────────────────────────┐ │
│ │ 10/15（水）出勤表 …（文面・スクロール）  │ │
│ └──────────────────────────────────────┘ │
│                      [やめる]  [送信する]  │
└──────────────────────────────────────────┘
```

### 3. 環境変数の案内
- `SHUKKIN_CHATWORK_ROOM_ID`（本番ルーム・あとで人間が入れる）。`.env.example` があれば 1 行足す（無ければ作らない）

## テスト（vitest・既存 `ShukkinClient.test.tsx`／`payroll-notice/route.test.ts` の流儀）
1. route：未ログイン 403／`text` 空 400／ルーム未設定 500／トークン無し 400（文言一致）／正常は `sendChatworkMessageWithToken` が `roomId`・`text` そのままで呼ばれ 200／Chatwork 失敗は 502。`GET` は env の有無で `roomLabel` が変わる
2. 画面：出勤表タブに「Chatwork へ送信」がコピーの左にある／押すとモーダルに文面と送り先が出る／「やめる」で閉じる／「送信する」で `POST /api/system/shukkin/chatwork` に `attendanceText` が送られ、成功で「送信しました」／失敗で理由が出て「もう一度」で再送できる／シフト連絡タブ・並びの設定タブは変わらない
3. 既存テスト（`src/app/system/forms/shukkin/**`・`src/app/api/system/shukkin/**`・`src/app/api/system/payroll-notice/**`）は緑のまま。**KpiCard・BackgroundCarousel・AppHeader の 12 本は前から落ちている＝対象外**

## 完了報告（コードブロックで。東海林さんがそのまま読む）
1. 変えたファイル一覧（新規／変更）
2. `npx tsc --noEmit` と `npx vitest run src/app/system/forms/shukkin src/app/api/system/shukkin src/app/api/system/payroll-notice` の結果（件数）
3. 画面の確認手順（手元 dev：`/system/forms/shukkin` → 出勤表タブ → 文面を出す → ［Chatwork へ送信］→ モーダル → 送信する → 開発ルーム 433894375 に届く。※実際の送信は Claude が行う。Codex は送らない）
4. 迷った点・決め打ちした点
