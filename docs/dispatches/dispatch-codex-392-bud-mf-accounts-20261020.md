# Codex-392：Bud「口座残高・カード利用」（マネーフォワード連携・社長スタイル）（2026-10-20）

## 正本（必ず全文を読む）
- 設計：`C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\100_Projects\110_Garden\070_Bud_経理収支\040_設計_口座残高とカード利用_MF連携_v1_20261020.md`（画面の絵あり）
- 社長スタイル：`C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\070_AI-Rules\050_Gardenスタイル・社長スタイル.md`・手本 `src/app/system/call-metrics/call-metrics.module.css`
- Bud の外枠（社長スタイル・本番済み）：`src/app/bud/_components/BudShachoShell/`
- MF の API の仕様（参考）：https://developers.api-accounting.moneyforward.com/v3/openapi.yaml

## 決まったこと（東海林さん 2026-10-19〜20）
- 見る人＝後道さん・東海林さん・上田さん。**口座・カードごとに「見てよい人」**を付けられる。全権は全部見られる
- **並び順は全員共通**。並び替え・見てよい人・表示しないの設定は全権だけ
- **銀行口座＝残高＋未仕訳の件数（小さく）**／**クレジットカード＝使った履歴だけ**（残高は出さない）
- MF の鍵＝今の鍵（台帳 070・Claude が Vercel に `MF_ACCOUNTING_API_KEY` として入れる）。事業者番号 `2918-5520`
- **MF へは読むだけ**（GET だけ。書き込み系は呼ばない）

## MF の読み方（Claude が本物で確かめた・2026-10-20）
- 認証：`POST https://api.biz.moneyforward.com/auth/exchange`（`Authorization: Bearer <MF_ACCOUNTING_API_KEY>`）→ 応答の access_token（1 時間有効）。以降 `https://api-accounting.moneyforward.com/api/v3/...` に `Authorization: Bearer <token>`、`office_code=2918-5520` を付ける
- 口座・カードの一覧：`GET connected_accounts` → `connected_accounts[]`（id・name 例「みずほ銀行｜HR」・`connected_sub_accounts[]`（name 例「四ツ橋支店 普通 1252992」））。**カードは name に「カード」を含むもの**
- 取引：`GET transactions?start_date&end_date&per_page=500&page=` → `transactions[]`（connected_account_id・date・content・value・side INCOME/EXPENSE・journalizing_status＝`none` が未仕訳）・`metadata.total_pages`
- 試算表：`GET reports/trial_balance_bs?with_sub_accounts=true` → rows の入れ子（type `account`「普通預金」の下の type `sub_account`、values＝[期首, 借方, 貸方, **期末残高**, 構成比]）。応答の start_date＝会計年度の始まり
- **銀行口座の残高＝試算表の対応する補助科目の期末残高＋（会計年度の始まり〜今日の未仕訳の入金合計−未仕訳の出金合計）**＝13 口座中 11 口座が MF のホーム画面の残高と 1 円単位で一致（PayPay銀行｜STB は帳簿に科目が無く 0＋未仕訳で一致）
- 注意：手元では Node の fetch が MF 会計サーバーにつながらないことがあった（2026-10-02）。fetch で作り、つながらないときは「MF に接続できませんでした」で失敗を記録する（Claude が本番で確かめる）

## 作るもの
1. **migration**（適用は Claude）`supabase/migrations/20261020000002_bud_mf_accounts.sql`
   - `bud_mf_accounts`：mf_account_id（主キー）・name・kind（bank／card）・sub_account_label（支店・口座番号）・sort_order・hidden・visible_employee_ids text[]・**book_sub_account_name**（帳簿の補助科目名。空＝帳簿に科目なし＝0 として計算）・**balance_mode**（auto＝計算する／manual_check＝「残高は MF で確認」と出す）・balance_note（MF で確認の理由）・balance・unjournalized_count・fetched_at
   - `bud_mf_card_transactions`：mf_transaction_id 主キー・mf_account_id・date・content・value・side・journalizing_status・fetched_at（直近 3 か月）
   - `bud_mf_fetch_runs`：ran_at・trigger（cron／button）・ok・error・counts
   - RLS：読む＝全権、または visible_employee_ids に本人の employee_id（root_employees.employee_id＝text）が入っている口座だけ。書く＝service role（読み込み）／並び・設定の更新＝全権だけ
2. **読み込み** `src/lib/bud/mf/`（client.ts・balances.ts・sync.ts・テスト）：上の方法で口座・カード一覧を upsert（**新しい口座は末尾に・既定の見てよい人＝後道・東海林・上田**＝employee_id は設定値 `BUD_MF_DEFAULT_VIEWERS`（カンマ区切り）から）、銀行口座の残高と未仕訳件数、カードの取引（直近 3 か月）を保存。失敗は記録して止める（前の値は残す＝画面は前の時刻のまま出る）
   - `GET /api/bud/mf-accounts/cron`（CRON_SECRET・**vercel.json にはまだ足さない**＝初回は人が確かめる決まり）／`POST /api/bud/mf-accounts/refresh`（「読み直す」ボタン・見てよい人なら誰でも・1 分に 1 回まで）
3. **画面** `/bud/bank`（今の見本 BudFaithfulFrame を置き換え）：社長スタイル・明暗・4 幅（スマホ 1 列）
   - タブ［口座残高］［カード利用］・右上に「最終読み込み 2026-10-20 09:30:12」と［読み直す］
   - 口座残高：上に**残高合計**（balance_mode=auto の合計）、下にカード式の口座（名前「みずほ銀行｜HR」・残高・小さく「未仕訳 45 件」）。manual_check は「残高は MF で確認」＋理由（小さく）
   - カード利用：絞り込み［カード▼］［期間：今月／先月／3 か月］・表（日付・カード・内容・金額）。表の見出しは中央ぞろえ
   - 全権だけ［並び替え］（つかんで動かす。スマホは上下の矢印）・［設定］（口座ごとに見てよい人＝root_employees から選ぶ・表示しない・帳簿の補助科目名・残高の出し方）
   - 体感を止めない（並び替えは押した瞬間に並びが変わり、保存は裏で）
   - 画面の文言に開発者用語を書かない。絵文字なし（アイコンは線画）
4. Bud のメニューの「銀行口座管理」の名前を「口座残高・カード利用」に
5. テスト：残高の計算（帳簿＋未仕訳・科目なし・manual_check）・カードの判定・新しい口座が末尾に入る・見てよい人の絞り込み・並び替えの保存・画面の表示

## 守ること
- **commit・push しない。DB・本物の MF に接続しない**（確かめは Claude）
- Bud のほかの画面（経費精算・振込管理など）の動きを変えない
- `npx vitest run src/app/bud src/lib/bud src/app/api/bud` と `npx tsc --noEmit -p .` が通ること（前から落ちているテストは触らない）

## 報告（日本語・コードブロック）
作った・変えたファイル・テストの結果・Claude が本番で確かめる手順（環境変数・migration・初回の読み込みの呼び方）だけ短く。
