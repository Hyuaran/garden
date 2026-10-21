# Codex-402：明細を 2025 年度以前もさかのぼって見られるように（2026-10-21）

## 正本
- 社長スタイル `C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\070_AI-Rules\050_Gardenスタイル・社長スタイル.md` §2.5・§2.6
- 今の作り：`C:\garden\a-bloom-008\src\lib\bud\mf\`（sync.ts・transactions.ts）・`src\app\api\bud\mf-accounts\transactions\route.ts`・`src\app\bud\bank\TransactionDetail.tsx`・`BankAccounts.tsx`・migration `supabase\migrations\20261021000002_bud_mf_transactions.sql`・`20261021000003_bud_mf_arrival.sql`（bud_mf_apply_fetch の今の形）
- MF へは読むだけ

## 東海林さんの決定（2026-10-21）
- 明細の一覧（口座・カード）で、**2025 年度以前もさかのぼって見られる**ように
- 期間のプルダウン＝今月／先月／2026年度／**2025年度／2024年度／…**（その口座・カードに明細がある年度だけ出す。年度の表記は「YYYY年度」＝4/1〜翌 3/31）

## Claude が調べた事実（MF に残っている明細・件数）
- 年度ごとに最大 2,700 件程度（オリコカード HR）。全部で約 4 万件。古いものは 2019 年度から。
- 京都銀行 HR・セゾンカード HR・PayPay銀行 STB は 2025 年度以前の明細なし

## 作るもの
1. migration（**適用は Claude**）`supabase\migrations\20261021000004_bud_mf_past_years.sql`
   - `bud_mf_apply_fetch` を直す：銀行・カードの明細を「入れ替える」範囲を **p_since 以降だけ**にする（今は `delete ... where true` で全部消している → 過去年度が消えてしまう）。`delete from bud_mf_card_transactions where date >= p_since;` のように（WHERE 付き）。それ以外（bud_mf_bank_tx_seen・残高の計算・0 時の記録）は今のまま
   - 過去年度の取り込み用の関数 `bud_mf_store_past(p_since date, p_until date, p_card jsonb, p_bank jsonb)`：その期間の銀行・カードの明細を入れ替える（WHERE 付きの delete＋jsonb_populate_recordset でまとめて insert）。**bud_mf_bank_tx_seen には入れない**（過去の明細は残高・増減に使わない）。service_role だけ実行可
2. 過去年度の取り込みスクリプト（Claude が 1 回だけ流す）：`C:\garden\a-bloom-008\scripts\bud-mf-backfill-past-years.mjs`
   - .env.local の値（MF の鍵は環境変数 `MF_ACCOUNTING_API_KEY`、DB は `DATABASE_URL`）を使う。鍵の値を画面やログに出さない
   - 2019 年度〜今年度の前の年度まで、**半年ずつ**（4〜9 月・10〜3 月）MF の transactions をページ送り（per_page=500）で読み、銀行・カードに分けて `bud_mf_store_past` に渡す。進み具合（年度・件数）を 1 行ずつ出す。途中で失敗したらそこで止まり、もう一度流せば続きからやり直せる（年度ごとに入れ替えなので二重にならない）
   - 銀行かカードかの見分け・口座名の扱いは今の sync.ts と同じ関数を使う
3. API・画面
   - API：期間に `fy:YYYY`（例 fy:2025）を受け付け、その年度の 4/1〜翌 3/31 を返す。口座ごとに明細がある年度の一覧も返す
   - 明細の一覧（`TransactionDetail.tsx`）とカード利用のタブ（`BankAccounts.tsx`）の期間のプルダウンに、明細がある過去の年度を新しい順に出す（今月／先月／2026年度／2025年度／…）。今年度の表記は今の `fiscalYearLabel` を使う

## テスト
- apply_fetch が p_since より前の明細を消さない
- store_past が tx_seen に入れない・同じ期間を 2 回入れても二重にならない
- 期間 fy:2025 で 2025-04-01〜2026-03-31 の明細だけ返る／明細がある年度だけプルダウンに出る
- テストの中に絵文字を書かない

## 守ること
- commit・push しない。DB・本物の MF に接続しない（スクリプトはテストで中身だけ確かめる）
- `npx vitest run src/lib/bud src/app/bud/bank src/app/api/bud src/app/system/_components` と `npx tsc --noEmit -p .` が通ること（テスト時は .env.local の NEXT_PUBLIC_SUPABASE_URL／ANON_KEY を環境変数に入れて流す）

## 報告（日本語・コードブロック）
変えたファイル・テストの結果・Claude がやること（migration の適用・スクリプトの流し方）だけ短く。
