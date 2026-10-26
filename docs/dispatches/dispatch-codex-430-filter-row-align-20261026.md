# Codex-430：絞り込みの行を「同じ高さの箱」でそろえる（Codex-428 の仕上げ）（2026-10-26）

## 目的
Codex-428 で表や一覧の上の絞り込みを BoxSelect（箱）にした結果、箱（背が高い）と普通の入力欄（日付・番号・キーワード・低い）が同じ行に混ざり、高さ・位置がそろわない画面が出た（Claude が画面で確認）。
- `/system/list`（リストマスタ）：箱の高さ・上下の位置がバラバラ、説明文が箱の横で細く折り返す、1 つだけ次の行に落ちる。
- `/system/innovera-calls`：「担当」の箱だけで 1 行使う。日付・時刻の欄（低い）と回線・発着・結果の箱（高い）が混在、「番号」の欄だけ低い。
正本＝`C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\070_AI-Rules\050_Gardenスタイル・社長スタイル.md` §2.5（「選ぶ欄」「表」）。見本＝Bud の口座残高・事業の収支の表の上（数字の箱・期間の箱・検索の箱が同じ高さで横に並ぶ）。

## 決まり（絞り込みの行）
```
┌ 期間 ───────┐ ┌ 担当 ───────┐ ┌ 回線 ─────┐ ┌ 番号 ─────────┐
│ 2026/10/26〜10/26 │ │ 全員          ⌄ │ │ すべて      ⌄ │ │ 🔍 番号で探す        │
└──────────┘ └──────────┘ └────────┘ └────────────┘
  ↑ どれも同じ高さ（BoxSelect と同じ）・上の辺も下の辺もそろう・横に並び、入らなければ折り返す（折り返しても高さは同じ）
（説明文は箱の中や横に置かない。必要なら行の下に 1 行だけ・小さな補助色）
```
- 絞り込みの行の部品は**全部「箱」の形**：小さな見出し（1 行目）＋値（2 行目）。
  - 選ぶもの＝BoxSelect（今のまま）。
  - 日付・期間・時刻・番号・キーワードの入力も**同じ箱の形**にする（見出し＋中に枠の無い入力。検索は DataTable の検索の箱と同じ＝虫眼鏡・枠の中に枠を作らない）。日付の範囲は 1 つの箱に「開始〜終了」をまとめてよい。
  - ボタン（今日・昨日・今週・検索・表示を保存 など）は箱の行の右端に、箱の下の辺にそろえる。
- 並びは `display:flex; flex-wrap:wrap; gap:12px; align-items:stretch`（または grid）。箱の幅は中身に合わせ、最小 160px。
- 1384px（左メニューあり）で 1〜2 行に収まること。768px・390px では折り返して崩れない（はみ出さない）。
- 共通部品にする：`src/app/system/_components/FilterBox/`（見出し＋子要素を箱で囲む部品）を作り、BoxSelect と同じ高さ・枠・角丸・明暗の色にそろえる。BoxSelect 本体は変えない（高さを合わせるのは FilterBox 側）。

## 対象（Codex-428 で絞り込みが箱になった画面。全部見てそろえる）
`git grep -l "<ChoiceFilter\|<MultiSelectFilter\|<BoxSelect" -- src` の画面（`src/app/bud/bank/` は除く）：
NoticeList・Bloom ProgressDashboard・Bud expenses（Booking／Done／Final／Review の各パネル）・Bud broadband・Bud statements（一覧・imports）・Bud transfers（FilterBar・Approval・PaymentCategory）・/p/toss/board・Root（bank-accounts・bank-check・employees・inbox・kot-sync-history・permissions）・Sprout・System（innovera-calls・list）。
特に崩れが大きい `/system/list` と `/system/innovera-calls` を最初に。

## 触らないもの
- `src/app/bud/bank/` 配下・`src/app/system/_components/BoxSelect/`。本番・DB。**git は触らないでください。コミットは人間側が行います。** npm install はしない。

## 確認
`npx tsc --noEmit`・変えたファイルのテスト。日本語が「???」に化けていないこと。

## 完了報告（コードブロックで）
変更ファイル／テスト結果／そろえきれなかった画面と理由。
