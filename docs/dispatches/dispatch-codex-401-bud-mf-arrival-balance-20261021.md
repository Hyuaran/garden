# Codex-401：口座残高を「届いた入出金」だけで動かす（仕訳で残高が動かない）＋グループ合計の増減の内訳（2026-10-21）

## 正本
- 社長スタイル `C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\070_AI-Rules\050_Gardenスタイル・社長スタイル.md` §2.5・§2.6
- 今の作り：`C:\garden\a-bloom-008\src\lib\bud\mf\`（balances.ts・sync.ts・transactions.ts）・`src\app\bud\bank\`・`src\app\api\bud\mf-accounts\`・migration `supabase\migrations\20261020000002_bud_mf_accounts.sql`・`20261021000001_bud_mf_anchor_balance.sql`・`20261021000002_bud_mf_transactions.sql`

## 背景（Claude が本番で確かめた・2026-10-21）
- 今の出し方 auto＝帳簿の補助科目の期末残高＋未仕訳。**経理が仕訳を入れる・直すと残高が動く**（東海林さん「仕訳をしても残高が狂わないようにしたい」）
- 楽天銀行は前日（10/20 付）の入出金が当日 0 時を過ぎてから MF に届いた。**取引の日付で数えると、0 時からの増減と内訳が合わない**
- 今の残高は 13 口座ともMF のホームの残高と一致（グループ合計 108,377,893 円＝MF の残高合計）

## 東海林さんの決定（2026-10-21）
1. **全口座を「届いた入出金」だけで残高を動かす**。帳簿（試算表）は見ない
   - 残高＝起点の残高＋**起点の時刻より後に Garden に初めて届いた入出金**の合計（入金＋・出金−）。取引の日付ではなく**届いた時刻**で数える（前日付けの明細が今日届いても今日の分に入る）
2. グループ合計の横は「0 時から」の文字をやめて **`↓ ▲907,175（入金 358,600・出金 1,265,775）`** の形。内訳＝今日 0 時より後に届いた入出金の合計（全口座・見てよい口座だけ）。増減＝内訳の入金−出金と**必ず一致**すること

## 作るもの
1. migration（**適用は Claude**）`supabase\migrations\20261021000003_bud_mf_arrival.sql`
   - 届いた記録の表 `bud_mf_bank_tx_seen`（mf_transaction_id 主キー・mf_account_id・date・side・value・first_seen_at timestamptz）。**消さない・上書きしない**（最初に見た時の金額で固定）。RLS は bud_mf_bank_transactions と同じ
   - `bud_mf_accounts` に `anchor_at timestamptz` を足す。`balance_mode` に `arrival` を足す
   - `bud_mf_apply_fetch`：受け取った銀行の入出金のうち、まだ `bud_mf_bank_tx_seen` に無いものを `first_seen_at = now()` で入れる（**今年度の範囲外の古い日付も入れてよい**）。WHERE の無い DELETE は使わない・record 変数は使わない（jsonb_populate_recordset でまとめて）
   - **初回の扱い**：表を作った直後は、今 MF にある取引を全部「起点より前から見えていたもの」として入れる（first_seen_at＝migration の時刻）。各口座の anchor_balance＝今の balance、anchor_at＝migration の時刻、balance_mode＝arrival にする（今の残高は MF と一致済み）
2. 計算（`src\lib\bud\mf\balances.ts`・`sync.ts`）：balance_mode=arrival は `anchor_balance＋Σ(first_seen_at > anchor_at の入出金)`。auto・anchor・manual_check は残す（設定で選べる）
3. 増減の内訳：0 時の記録（bud_mf_balance_snapshots）は今のまま。画面の API で「今日 0 時（日本時間）より後に届いた入出金」の入金合計・出金合計を口座ごと・全体で返す。グループ合計の横に上の形で出す。各欄（法人×銀行）の増減は今の表示のまま（内訳は出さない）
4. 設定（全権）：残高の出し方に「届いた入出金で動かす（おすすめ）」を足し、起点の残高と起点の時刻を入れ直せる（MF とずれたときに合わせ直すため）。「起点を今の MF の残高に合わせる」は手で金額を入れる
5. 画面の文言に開発者用語を書かない

## テスト
- 届いた時刻で数える（前日付けで今日届いた取引が今日の増減・内訳に入る）
- 仕訳の状態が変わっても残高が変わらない
- 同じ取引を 2 回受け取っても二重に数えない／MF 側で金額が変わっても最初の金額のまま
- グループ合計の増減＝内訳の入金−出金
- 初回の移行で残高が変わらない

## 守ること
- commit・push しない。DB・本物の MF に接続しない
- `npx vitest run src/lib/bud src/app/bud/bank src/app/api/bud src/app/system/_components` と `npx tsc --noEmit -p .` が通ること（テスト時は .env.local の NEXT_PUBLIC_SUPABASE_URL／ANON_KEY を環境変数に入れて流す）

## 報告（日本語・コードブロック）
変えたファイル・テストの結果・Claude がやること（migration の適用・確かめ方）だけ短く。
