# Codex-479：マイナンバーを暗号化して保存し、公式 LINE の中で提出できるようにする（番号確認は指定した人だけ）（2026-10-29）

## 東海林さんの話
- 公式 LINE の中で、従業員がマイナンバーを提出できるようにする（OK 済み）。
- 番号確認（番号とカードの写真を見比べる）は東海林さんが行う。

先に読む：`C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\070_AI-Rules\050_Gardenスタイル・社長スタイル.md` の §2.5〜§2.7（**社長スタイル §2.5 の型・§2.6 の点検に従う。表の行は全体を押す・小窓は共通 Modal・フォームは form-kit**）。画面の文字はきちんとした言い方。略称・開発者用語・絵文字なし。長い説明は不要・ファイルは必要な範囲だけ読む。

今の作り（読んでから作る）：
- 保存の表 `root_employee_my_numbers`（`supabase/migrations/20260826000001_mypage_employee_private_profile.sql`・service_role だけ・**今は平文**）
- 書いている所：名簿の取り込み `src/app/root/_lib/roster-sync.server.ts`（Kintone の番号を保存）・読んでいる所：`src/app/system/mypage/_lib/mypage-profile.server.ts`（提出済みかどうか）。ほかに `my_number` を扱う所（入社手続きの代行 `supabase/migrations/20261026000003_system_onboarding_proxy.sql` の伏せ字の扱い・Bud の年末調整 `20260508000004_bud_phase_d06_nenmatsu_integration.sql` など）を **全部探して**、平文で読み書きしないようにする
- LINE の中のページ：申告 `src/app/liff/forms/FormsPage.tsx`・本人確認 `src/lib/line/liff-verify.server.ts`・受け口 `src/app/api/liff/submissions/route.ts`・回数の上限 `supabase/migrations/20261029000475_liff_submission_limit.sql`

## 1. 暗号化して保存（migration `20261029000479_my_number_encrypt.sql`・ファイルの作成のみ・Claude が本番に当てる）
- アプリの側で AES-256-GCM で暗号化する（鍵は環境変数 `MY_NUMBER_ENCRYPTION_KEY`＝32 バイトを base64。Claude が作って本番と手元に登録する）。データベースには暗号文・初期化ベクトル・認証タグ・下 4 桁だけを置く（列を足す。例 `my_number_cipher`・`my_number_iv`・`my_number_tag`・`my_number_last4`・`key_version`）。
- 暗号化・復号の関数は 1 か所（`src/lib/my-number/crypto.server.ts` など）にまとめ、ほかから直接 Node の crypto を呼ばない。
- 今の平文の行を暗号化に移すスクリプト `scripts/encrypt-my-numbers.mjs`（`--dry-run` で件数だけ。本番では Claude が実行）。移し終わったら平文の列を空にする（列を消すのは次の段・今回は空にするだけ）。
- 名簿の取り込みも暗号化して保存する。Kintone から平文で来た番号を、そのまま平文の列に書かない。

## 2. 番号を見られる人と記録
- 表 `my_number_viewers(employee_id)`：番号を見られる人。最初は `EMP-0008`（東海林さん）だけを入れる。**全権管理者でも、この表に無い人は見られない**（デモ用の全権のアカウントがあるため）。
- 表 `my_number_access_logs`：だれが・いつ・だれの番号を表示したか／確認したか。画面で［表示する］を押すたびに 1 行。

## 3. 確認の画面（Root）`/root/my-numbers`
```
Root / マイナンバー
マイナンバー
 確認待ち 2   確認済み 15   未提出 8                      ← タブ（SystemTabs）
[検索]
┌────────┬────────┬──────────────────┬───────────┐
│ 社員番号 │  氏名   │       提出日時       │  番号      │   ← 行を押すと小窓
├────────┼────────┼──────────────────┼───────────┤
│  1495   │ 樋本 葵 │ 2026/10/30 10:12:33 │ ****-****-1234 │
└────────┴────────┴──────────────────┴───────────┘
```
- `my_number_viewers` に入っている人だけ開ける（ほかの人は見つからない扱い＝404）。左メニューにも、その人にだけ出す。
- 小窓：氏名・提出日時・番号（伏せ字）＋［表示する］（押すと全部見える・記録が残る）・提出された写真（カードの裏面か通知カード）・［確認しました］（確認済みにする・記録が残る）・［差し戻す］（理由を入力・本人の LINE に「もう一度提出してください」を送る。送る文は Claude が確認するまで送らない設定にしておく＝環境変数で止められる）。
- 名簿から取り込んだ番号は「写真なし・名簿から」と出し、確認は同じ流れ。

## 4. LINE の中の提出ページ `/liff/forms/my-number`
- 同じ LIFF（申告フォーム）の中の別のページ（`https://liff.line.me/{FORMS_ID}/my-number` で開く）。申告のページの下に［マイナンバーを提出する］の入口を置く。
```
山田さんのマイナンバーの提出
利用目的：給与・社会保険・税の手続きのために使います。
[ ] 利用目的を確認しました                      ← チェックしないと送信できない
1 マイナンバー（12 桁）  [            ]       ← 数字だけ・検査用の数字で確かめる
2 カードの写真         [写真を選ぶ]           ← マイナンバーカードの裏面か通知カード
         [送信する]
提出の状況：確認待ち（2026/10/30）
```
- 番号は 12 桁と検査用の数字（チェックデジット）を確かめる。写真は jpg／png、5MB まで、非公開の保存場所（Supabase Storage の非公開のバケット。署名つきの短い URL でだけ見る）。
- 送信後、本人の画面には番号を出さない（下 4 桁と状況だけ）。
- 回数の上限は申告と同じ関数を使う。

## 5. テスト
- 暗号化：同じ番号でも毎回違う暗号文・復号で元に戻る・鍵が違うと失敗・平文の列に書かない。
- 見られる人：表に無い全権管理者は 404・表示の記録が残る。
- 提出：同意なし・桁違い・検査用の数字違い・写真なしは送信できない。従業員でなければ 403。
- 名簿の取り込み：暗号化して保存される。

## 終わったら
- `npx tsc --noEmit` と関係するテストを通す。完了報告（コードブロック）。移し替えスクリプトと migration の実行手順を報告に書く。
- ファイルは UTF-8（BOM なし）。**git は触らない（commit しない）。npm install しない。本番の DB に当てない・スクリプトを本番で動かさない。LINE へ送らない。鍵を作らない（Claude が作る）。**

## 実装時の取得回数
- 新しい cron は無し（1 日 0 回）。ページを開いたとき 1 回、送信 1 回ごとに保存＋写真の保存。確認の画面は開いたとき 1 回、［表示する］のたびに 1 回。

## Codex-479 実装・適用手順
- 実装済み：暗号化、指定者のみの確認画面、監査記録、LINE 内提出、非公開写真、名簿・入社手続き（本人と扶養家族）の暗号化。Bud の旧復号関数は migration で実行権限を停止する（既存の暗号文は変更しない）。
- Claude が `MY_NUMBER_ENCRYPTION_KEY`（32 バイトの base64）を作り、同じ値をアプリと移行用環境に設定する。この作業では鍵を作成していない。
- 差し戻し通知は `MY_NUMBER_RETURN_LINE_ENABLED` が未設定または `false` なら送信しない。文面は「マイナンバーをもう一度提出してください。改行 理由：入力理由」。Claude が確認後に限り `true` にする。送信元は既存の従業員用公式 LINE（`LINE_STAFF_CHANNEL_ACCESS_TOKEN`）。
- 適用は Claude が実施：書き込みを止めてバックアップ → `supabase/migrations/20261029000479_my_number_encrypt.sql` を適用 → 新コードと環境変数を配置 → 下記の件数確認・移し替え・再確認 → 書き込みを再開。移行中は一般画面を公開しない。migration 自体は既存平文を変更しない。

```powershell
node --env-file=.env.local scripts/encrypt-my-numbers.mjs --dry-run
node --env-file=.env.local scripts/encrypt-my-numbers.mjs
node --env-file=.env.local scripts/encrypt-my-numbers.mjs --dry-run
```

- 移行用環境には `NEXT_PUBLIC_SUPABASE_URL`・`SUPABASE_SERVICE_ROLE_KEY`・上記暗号鍵を設定する。最後の件数が両方 0 になることを確認する。平文の列は削除せず、名簿の保管表では `NULL`、入社手続きでは下4桁の伏せ字に置き換える。想定外の番号形式・更新競合は停止し、平文を失わない。途中停止後の再実行は未移行行だけを対象とする。
- この作業では migration・スクリプトを実 DB に実行していない。LINE・Kintone の外部登録も実行していない。
- 取得回数：定期取得・cron は 0 回／日。本人画面は初回1回、提出1回につき1回。確認画面は初回1回（従業員・提出状況をそれぞれ1000件単位で読む）、小窓を開くたび写真用に1回、番号表示・確認・差し戻し操作ごとに1回。写真の署名 URL は60秒。自動更新なし。
