# Codex-403：MF の「自動取得が行なわれていない金融機関」メールを読んで、口座残高に注意の印（手動で消せる）（2026-10-21）

## 正本
- 社長スタイル `C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\070_AI-Rules\050_Gardenスタイル・社長スタイル.md` §2.5・§2.6（注意の印＝⚠ の形の線画。絵文字は使わない）
- 口座残高：`C:\garden\a-bloom-008\src\app\bud\bank\`・`src\lib\bud\mf\`・`src\app\api\bud\mf-accounts\`
- メールを読む既存の仕組み（流用）：`C:\garden\a-bloom-008\src\lib\mail-payment-check\graph-mail.ts`（Entra アプリ garden-bud-mail・MS_GRAPH_CLIENT_ID／SECRET／TENANT_ID）。**2026-10-21 に読み取りの制限を外した＝社内の全部の箱を読める**

## Claude が確かめた事実（2026-10-21）
- 差出人 `biz.feedback@moneyforward.com`、件名「【マネーフォワード クラウド会計・確定申告】自動取得が行なわれていない金融機関があります」。**週 1 回・火曜 8 時台（日本時間）**に shoji@hyuaran.com へ届く（MF にログインしている人宛て）。今日 10/21 は届いていない（止まっている口座が無い）
- 本文（text）は次の形の表：
```
連携口座    最終連携成功日 理由
みずほ銀行_MS        2026年09月18日     (認証)
PayPay銀行_HR     2026年09月03日     (認証)
京都銀行_MS 2026年08月11日     (認証)
取得停止の理由
(認証)    お客様による再連携操作が必要なため。
```
- メールの口座名（例「京都銀行_MS」）は Garden の口座名（「京都銀行｜HR」）と違う。帳簿の補助科目名（bud_mf_accounts.book_sub_account_name）は「京都銀行_MS難波支店…」のように**メールの名前で始まる**ものがある

## 東海林さんの決定（2026-10-21）
1. このメールを Garden が読み、口座残高の画面に **⚠ の形の線画**で出す：画面の上（グループ合計の上）に「マネーフォワードで自動取得が止まっている口座：京都銀行（ヒュアラン）　8/11 から・再連携が必要」。結び付いた口座の欄（法人×銀行）にも小さな ⚠
2. 次の週のメールでその口座が消えたら、または最後のメールから 8 日たって新しいメールが来なければ、印を消す
3. **手動でも消せる**：印の横に［消す］。押せるのはその口座を見てよい人（全権は全部）。誰がいつ消したかを残す。消したあと、**後のメールに同じ口座がまた載ったら再び出す**

## 作るもの
1. migration（**適用は Claude**）`supabase\migrations\20261021000005_bud_mf_link_alerts.sql`
   - `bud_mf_link_alerts`（id・message_id（メールの id）・received_at・mail_account_name（メールの口座名）・last_success_date・reason（「認証」など）・reason_text（「お客様による再連携操作が必要なため。」）・mf_account_id（結び付いた口座。null 可）・dismissed_at・dismissed_by（employee_id））。同じメール×同じ口座名は 1 行（一意）
   - `bud_mf_accounts` に `mail_alias text`（メールでの名前を手で結び付ける用・null 可）
   - RLS：読む＝口座を見てよい人（結び付かない行は全権だけ）／消す＝関数 `bud_mf_dismiss_link_alert(p_id)`（見てよい人・全権）
2. 読み込み：`src\lib\bud\mf\link-alerts.ts`
   - Graph で shoji@hyuaran.com と keiri@hyuaran.com の受信箱から、差出人 biz.feedback@moneyforward.com・件名に「自動取得が行なわれていない」を含む直近 30 日のメールを読む（読むだけ。既読にしない）
   - 本文の表を読み取り（口座名・最終連携成功日 YYYY年MM月DD日・理由（…））、理由の説明（「取得停止の理由」の段）も取る
   - 口座への結び付け：mail_alias が同じ → 帳簿の補助科目名がメールの名前で始まる → 結び付かない（画面の上の帯には生の名前で出す）
   - 出す条件：その口座名が**最新のメール**に載っている、かつ最新のメールが 8 日以内、かつ（消されていない、または消したより後のメールに載っている）
3. 定期の実行：`GET /api/bud/mf-accounts/link-alerts/cron`（CRON_SECRET）。**vercel.json にはまだ足さない**（初回は Claude が確かめる決まり。予定＝毎朝 9:30 日本時間）。画面を開いたときは保存済みの行を出すだけ
4. 画面：上の決定どおり。設定（全権）の口座ごとに「MF の知らせメールでの名前」（mail_alias）を入れられる
5. 文言に開発者用語を書かない

## テスト
- 本文の読み取り（3 行・1 行・表なし）・日付と理由
- 結び付け（mail_alias・補助科目名の前方一致・結び付かない）
- 出す／消える（次のメールに無い・8 日たった・手動で消した・消した後のメールに再び載った）
- 見てよい人だけ消せる
- テストの中に絵文字を書かない

## 守ること
- commit・push しない。DB・外部 API（Graph・MF）に接続しない
- `npx vitest run src/lib/bud src/app/bud/bank src/app/api/bud src/lib/mail-payment-check` と `npx tsc --noEmit -p .` が通ること（テスト時は .env.local の NEXT_PUBLIC_SUPABASE_URL／ANON_KEY を環境変数に入れて流す）

## 報告（日本語・コードブロック）
変えたファイル・テストの結果・Claude がやること（migration・初回の実行・cron の追加）だけ短く。
