# Codex-428：Garden 全体の「選ぶ欄」を 3 種類にそろえる（プルダウン・ラジオ・複数選択）（2026-10-26）

## 目的
プルダウン・ラジオボタン・複数選択の見た目が画面ごとにバラバラ（東海林さん「毎回デザイン違うようにせず、統一して」）。
正本＝`C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\070_AI-Rules\050_Gardenスタイル・社長スタイル.md` §2.5「選ぶ欄」（先に読むこと）。

## 決まり（この 3 種類だけ）
```
① 入力フォームで 1 つ選ぶ ＝ 普通のプルダウン（select）
   所属法人
   ┌──────────────────────┐
   │ 選んでください          ⌄ │   高さ 44px・入力欄と同じ枠／角丸 8px・文字は左寄せ
   └──────────────────────┘   ⌄＝線画（ブラウザの矢印は appearance:none で消す）

② 選択肢が 2〜3 個で全部見せたい ＝ ラジオ（横並び）
   (●) 男性    ( ) 女性           丸＝ティール（accent-color）・丸と文字 6px・項目の間 16px
                                  ピル型（塗りのボタン風）にしない

③ 複数を選ぶ・表や一覧の上の絞り込み（1 つだけの絞り込みも）＝ BoxSelect（既存部品）
   ┌ 期間 ──────────┐
   │ 2026年10月       ⌄ │  押すとカードの一覧（複数＝チェック／1 つ＝丸）［OK］で反映
   └─────────────┘
```

## やること
1. **①②の共通の見た目を `src/app/globals.css` に 1 か所で書く**（末尾に追記・コメントは日本語）。
   - `select`：`appearance:none`・高さ 44px（`min-height`）・`padding:0 36px 0 12px`・`border:1px solid var(--line, #d8dee8)`・`border-radius:8px`・`background-color:var(--card, #fff)`・`color:var(--ink, #10233f)`・`text-align:left`・右端に線画の ⌄（SVG の data URI。ライト＝`#5a6b80`、ダーク＝`#b7c5d4`）。フォーカス＝ティールの枠。`disabled` は薄く。`select[multiple]` と `size>1` は対象外。
   - ダーク：`[data-theme="dark"]` と `.dark` と `@media (prefers-color-scheme: dark)`（`:root:not([data-theme="light"])` の中）の 3 つで色を切り替える。`option` の文字と背景もダークで読めること。
   - `input[type="radio"]`：`accent-color: var(--teal, #0f9f97)`・幅高さ 18px・`margin:0`。ラジオ＋文字の `label` は `inline-flex; align-items:center; gap:6px`（共通クラス `.garden-radio` と、まとめる `.garden-radio-group`（横並び・gap 16px・折り返し可）を作る）。
   - 詳細度は低く（`:where()` を使う）。各画面の独自の上書きは下の 2 で消す。
   - 既存の `@media (pointer: coarse)` の 16px ルール（iPhone の拡大防止）は消さない。
2. **各画面の独自の見た目を消して共通に寄せる**（`select` を使う約 51 ファイル・ラジオ 14 ファイル。`grep -rl "<select" src --include=*.tsx`／`type="radio"` で一覧）。
   - select に付いている独自の色・高さ・中央ぞろえ・独自の矢印のクラス／CSS を外す（幅・余白の配置は残してよい）。
   - ピル型・ボタン風のラジオ、塗りのトグルで「1 つ選ぶ」をしているものは ② の形に。
   - **入力フォームで 1 つ選ぶのに BoxSelect を使っているもの**（例：`src/app/root/employees/KotEmployeePanel.tsx` の KOT の所属・雇用区分）は ① の select に。使っていない `import BoxSelect` は消す（`src/app/system/onboarding/HireCandidatesClient.tsx` など）。
   - **表や一覧の上の絞り込みに普通の select を使っているもの**（例：`src/app/bud/transfers/_components/FilterBar.tsx`・`src/app/system/innovera-calls/InnoveraCallsClient.tsx`・`src/app/root/employees/page.tsx` の絞り込み等）は ③ BoxSelect（`multiple={false}` を含む）に。判断に迷うものは変えずに完了報告の「迷ったもの」に書く。
   - 複数選択を `select multiple` やチェックボックスの縦並びで独自に作っている絞り込みは ③ に。
3. **法人を選ぶ欄・法人の並びは全部「登記順」＝設立日の古い順**（東海林さん 2026-10-26「あいうえお順ではなく、登記順に」）。`root_companies.established_on`／`bud_corporations.established_on` の昇順で並べる（ヒュアラン→センターライズ→ARATA→リンクサポート→たいよう→壱→ストーンベース）。名前順・ID 順・コード順で並べている所（`from("root_companies")`／`from("bud_corporations")` を使う所＝約 20 ファイル、画面の中で並べ替えている所も）を直す。法人の選択肢を手書きの配列で持っている所も同じ順に。`src/app/system/onboarding/_lib/hire-candidates.server.ts` は直し済み。
4. テストを直す（select→BoxSelect にした所はテストの操作も合わせる）。

## 触らないもの
- `src/app/bud/bank/` 配下（人が作業中。`BankAccounts.tsx` 等は 1 文字も変えない）。
- `src/app/system/_components/BoxSelect/` の見た目（使い方を合わせるだけ）。
- 本番・DB・環境変数。**git は触らないでください。コミットは人間側が行います。** npm install はしない。

## 確認
`npx tsc --noEmit`・`npx vitest run`（変えたファイルのテスト）。日本語が「???」に化けていないこと（`grep -rn "???" ` で変えたファイルを確認）。

## 完了報告（コードブロックで）
変更ファイル（①②③のどれに寄せたか）／テスト結果／迷ったもの・変えなかったもの。
