# Codex-397：口座残高に「銀行の残高を基準にする」出し方を足す（京都銀行 HR・PayPay銀行 HR）（2026-10-21）

## 背景（Claude が MF を読んで確かめた・2026-10-21）
- 今の残高の出し方 auto＝「帳簿の補助科目の期末残高＋今年度の未仕訳の入出金」。13 口座中 11 口座は MF の画面と一致
- **PayPay銀行｜HR**：帳簿の期首残高（2023 年度より前から）が銀行より 156,656 円多い。以後の入出金は利息だけで全部仕訳済み＝差が固定。MF 側の帳簿は経理が直す（Garden からは書けない）
- **京都銀行｜HR**：データ連携が戻った（8〜10 月の 10 件が届いた・全部未仕訳）。帳簿＋未仕訳＝3,842,520／MF の画面＝3,842,313（差 207 円）
- 東海林さん「正しく反映して」→ この 2 口座は**銀行の残高を基準に**出す

## 作るもの
1. migration `C:\garden\a-bloom-008\supabase\migrations\20261021000001_bud_mf_anchor_balance.sql`（**適用は Claude**）
   - `bud_mf_accounts` に `anchor_balance bigint`・`anchor_date date`（どちらも null 可）を足す
   - `balance_mode` に `anchor`（銀行の残高を基準）を足す（今の check 制約があれば広げる）
   - `bud_mf_save_settings` など設定を保存する関数があれば、anchor_balance・anchor_date も保存できるように
2. 計算（`C:\garden\a-bloom-008\src\lib\bud\mf\balances.ts`・`sync.ts`）
   - balance_mode=anchor：**残高＝anchor_balance＋（anchor_date の翌日〜今日の、その口座の入出金の合計。仕訳済みも未仕訳も全部）**。入金は＋・出金は−
   - 起点の日の入出金は起点の残高に含まれている扱い（翌日から足す）
   - 未仕訳の件数は今どおり数える
   - anchor_balance か anchor_date が空なら「残高は MF で確認」と同じ扱い（合計に入れない）
3. 画面の設定（全権だけ・`C:\garden\a-bloom-008\src\app\bud\bank\` の設定）
   - 残高の出し方に「銀行の残高を基準にする」を足す。選ぶと「起点の残高（円）」「起点の日」を入れる欄が出る
   - 表の欄は auto と同じ見た目（「MFで確認」にしない・合計に入れる）
4. 社長スタイルの決まり（正本 `C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\070_AI-Rules\050_Gardenスタイル・社長スタイル.md` §2.5・§2.6）に従う

## テスト
- anchor の計算（起点の翌日からの入金・出金・仕訳済み／未仕訳どちらも入る・起点の日の取引は入れない・起点が空なら MF で確認）
- 設定の保存（全権だけ）
- 既存の auto／manual_check の計算が変わらない

## 守ること
- commit・push しない。DB・本物の MF に接続しない
- `C:\garden\a-bloom-008\src\app\bud\expenses\` と各外枠（ShachoShell・BudShachoShell・Root の外枠）・`HeaderViewToggle` は触らない（直前の変更が未コミットで残っている）
- `npx vitest run src/lib/bud src/app/bud/bank src/app/api/bud` と `npx tsc --noEmit -p .` が通ること（テスト時は .env.local の NEXT_PUBLIC_SUPABASE_URL／ANON_KEY を環境変数に入れて流す）

## 報告（日本語・コードブロック）
変えたファイル・テストの結果・Claude がやること（migration の適用・2 口座の設定値）だけ短く。
