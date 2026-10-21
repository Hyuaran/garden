# Codex-404：期間を複数選べるように＋検索の「枠の中に枠」をやめる（2026-10-21）

## 正本
- 社長スタイル `C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\070_AI-Rules\050_Gardenスタイル・社長スタイル.md` §2.5・§2.6
- 今の作り：明細の一覧 `C:\garden\a-bloom-008\src\app\bud\bank\TransactionDetail.tsx`・カード利用のタブ `src\app\bud\bank\BankAccounts.tsx`・API `src\app\api\bud\mf-accounts\transactions\route.ts`・期間の計算 `src\lib\bud\mf\transactions.ts`（transactionRange・fiscalYearLabel・fy:YYYY）・共通の表 `src\app\system\_components\DataTable\`（検索の箱 searchBox・解除 clear）・CSS `src\app\bud\bank\bank.module.css`（statBox・controlBox）

## 東海林さんの決定（2026-10-21）
1. **期間のプルダウンを複数選べるように**（明細の一覧とカード利用のタブの両方）
2. **検索の箱の「枠の中に枠」は見づらい** → 中の入力欄の枠をなくし、箱そのものを入力欄に見せる

## 画面の絵
```
┌ 期間 ──────────────┐   ┌ 検索 ──────────────────┐
│ 2025年度・2024年度   ⌄      │   │ (虫眼鏡)  内容・金額             (漏斗×) │
└──────────────────┘   └──────────────────────┘
  期間の箱を押すと：
   ☐ 今月
   ☐ 先月
   ☐ 2026年度
   ☑ 2025年度
   ☑ 2024年度
   ☐ 2023年度 …
   ［すべて解除］        ［OK］
```
### 期間
- 箱（今の controlBox の見た目のまま・中の枠なし）を押すと、チェックの一覧が開く（DataTable の見出しメニューと同じ見た目・社長スタイルのカード）。選べるもの＝今月／先月／今年度（「2026年度」の表記）／明細がある過去の年度（今のプルダウンと同じ並び）
- **複数選べる**。［OK］で反映。何も選ばないと OK は押せない（グレー）
- 選んだ期間の**和**（重なる日は 1 回だけ）の明細を出す。数字の箱（入金・出金・件数・合計）も和で
- 箱の表示：1 つ＝その名前（例「今月」）／2 つ＝「2025年度・2024年度」／3 つ以上＝「3 つの期間」
- 既定は今のまま「今月」。URL の `period` は複数をカンマ区切り（例 `?period=fy:2025,fy:2024`）。古い 1 つの形（`?period=current`）もそのまま読める
- API：期間を複数受け付け、それぞれの範囲を合わせた行を返す（同じ取引は 1 回）
- キーボード（Enter／Esc）・メニューの外を押すと閉じる・スマホではみ出さない
### 検索
- 検索の箱の中の入力欄の枠・背景をなくす（`border:0; background:transparent`）。虫眼鏡・入力・解除（漏斗に×）が箱の中に横並び
- 解除ボタンも枠なしの線画アイコンだけ（押せないときはグレー・乗せるとティール）
- 入力中（:focus-within）は**箱の枠をティール**にして、入力していることが分かるように
- 期間の箱と同じ高さ・同じ角丸

## テスト
- 期間：複数選ぶと和になる（重なりは 1 回）・表示の文字（1 つ／2 つ／3 つ以上）・何も選ばないと OK できない・URL の複数と古い形
- 検索：入力欄に枠が無い（class で確かめる程度でよい）・解除が押せる／押せない
- テストの中に絵文字を書かない

## 守ること
- commit・push しない。DB・外部 API に接続しない
- `npx vitest run src/app/bud/bank src/app/api/bud src/lib/bud src/app/system/_components` と `npx tsc --noEmit -p .` が通ること（テスト時は .env.local の NEXT_PUBLIC_SUPABASE_URL／ANON_KEY を環境変数に入れて流す）

## 報告（日本語・コードブロック）
変えたファイル・テストの結果だけ短く。
