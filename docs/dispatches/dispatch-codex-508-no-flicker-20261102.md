# Codex-508 画面のちらつきを共通部品から無くし、今後も出ないように点検を入れる（2026-11-02）

作業場所：C:\garden\a-bloom-008（main）
**git は触らない（add / commit / push / checkout / stash すべて禁止）。** ファイルを直すだけ。
**パソコン操作（computer-use）・ブラウザ操作は使わない。** 画面の確認は Claude がやる。Codex はテストまで。
**ファイルは UTF-8。日本語を書いたら読み直して「?」に化けていないことを確かめる。**
長い説明は不要・ファイルは必要な範囲だけ読む。

## 東海林さんの指示
「入社手続きに検索窓がタブ下に一瞬出る現象があります。このタブだけでなく Garden 全体も調査し、改善してください。仕様変更のあとに画面がちらつく現象は今回が初めてではありません。しっかり確認し、今後ちらつかないように改善せよ。」

## 原因（調査済み）
「最初は既定の見た目・仮の場所で描き、描いた後（useEffect）に保存値・URL・置き場所を読んで描き直す」作りが、共通部品と画面ごとにばらばらにある。

## 直すこと（この順で。共通部品から）
1. **DataTable の検索窓**（`src/app/system/_components/DataTable/DataTable.tsx` 33・87・89 行付近、`PageSearchSlot/PageSearchSlot.tsx` 28〜70 行付近）
   - 置き場所（右上）が無いうちは、**仮に表の上へ描かない**。パソコン幅では表の上の検索窓を CSS（メディアクエリ）で最初から隠し、サーバーで作る最初の画面からタブの下に出ないようにする。スマホ幅は今までどおり表の上。
   - 置き場所探し・幅の判定は画面に出す前に済ませる（useLayoutEffect／useSyncExternalStore で最初の値をブラウザから直接）。タブを切り替えて表を作り直しても出ない。
   - 右上の置き場所は、検索窓が入る前から高さ（今の検索窓と同じ）を取っておき、入った後に見出しの高さが変わらない（測り直しで下がずれない）。
   - 検索窓が移るときに入力欄を作り直さない（打ち始めたカーソルが外れない）。
2. **URL のタブ**：`src/app/system/_components/SystemTabs/useUrlTab.ts` と `src/app/_components/ScopedTabs.tsx`。最初に出すタブを、サーバーのページから渡す形にする（サーバーは searchParams を読める）。手本＝`src/app/system/innovera-calls/InnoveraCallsClient.tsx` 152〜154 行付近（初期タブを URL から）。使っている画面（Bud の useInjectedBudTabs・明細・振込の詳細・管理表・通話の集計・契約書・Sprout・Bloom・Forest・Tree・Leaf など）を全部その形に。画面ごとに後から読んでいる `line/LineManager.tsx`・`bud/bank/BankAccounts.tsx`・`bud/profit/broadband/BroadbandTable.tsx`・`list/_components/ListMasterClient.tsx` も同じ形に。
3. **右上の一覧／カードの切り替えボタン**（`HeaderViewToggle.tsx`）：描き終わるまで場所だけ取って中身は見せない（visibility:hidden）。仮の薄いボタンが一瞬出ない。
4. **明暗のボタン**（`_lib/theme/ThemeProvider.tsx`・`GardenHeaderActions.tsx`）：太陽と月の絵を両方描き、`[data-theme]` の CSS だけで出し分ける（後から描き替えない）。
5. **DataTable に「読み込み中」**：`loading` を受け取れるようにし、読み込み中は「該当する明細はありません。」を出さず、行の高さぶんの場所を取る。ブラウザでデータを取りに行く表の画面（入社手続き・開発ボード・チーム履歴・経費フォーム・公式 LINE・マイナンバー・銀行明細など）は全部 loading を渡す。
6. **保存値（ブラウザの localStorage）を読む共通の仕組み**を 1 つ作る（例 `src/lib/ui/useStoredView.ts`）：読めるまでは場所だけ取って見せない、読めたら出す。サーバーと最初の描画が食い違わない（hydration のずれを出さない）。乗せ替える画面：
   - 形 1（サーバーと食い違う・エラーが出る）：`forms/FormsHubClient.tsx`・`deliveries/DeliveriesHubClient.tsx`・`sites/SitesHubClient.tsx`（お知らせタブの選択も）
   - 形 2（描いた後に読む）：`contracts/page.tsx`・`line/LineManager.tsx`・`my/ApDailyReview.tsx`（グラフ／表・グラフの色）・`onboarding/HireCandidatesClient.tsx`（辞退・完了も表示）・`BroadbandTable.tsx`（開いた行）・`dev-board/BoardClient.tsx`・`ShachoShell/SidebarNavigation.tsx`（左メニューの「準備中」）
   - Bud の経費（`ExpenseReviewPanel.tsx` 212・233 行付近）も同じ形なら乗せ替える。
7. **入社予定者の一覧**は、サーバーのページ（`onboarding/page.tsx`）で一覧を読んで最初から渡す（空→行が並ぶ跳ねを無くす）。権限の判定は今のまま。
8. ほかに同じ形（描いた後に保存値・URL・window を読んで見た目を変える）を見つけたら、同じ方法で直す（レポートに一覧）。

## 今後ちらつかないための点検（テストとして入れる）
- **書き方の点検テスト**（今の `PageSearchLayout.test.ts` のようにファイルを読んで調べる形）：最初の見た目を決める useState の初期値や描画中に `localStorage`・`window`・`location`・`matchMedia` を直接読んでいたら失敗。後から読んで描き直す書き方は、6 の共通の仕組みと共通部品の中だけ許す（許す場所の一覧をテストに書く）。useUrlTab を使うのにサーバーから初期タブを渡していない画面も失敗にする。
- **DataTable のテスト**：サーバーと同じ描き方（`renderToString`）で、パソコン幅の表の上の検索窓に「隠す」指定が付いていること。読み込み中に「該当なし」が出ないこと。
- **最初の描画のテスト**：主な画面（入社手続き・公式 LINE・Root の社員一覧・Bud の口座残高・振込）を描いた直後（useEffect より前）の中身で、検索窓が表の上に無い・タブが URL どおり。
- ルールを `src/app/system/_components/DataTable/README.md`（無ければ作る）と、社長スタイルの正本の該当節（`C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\100_Projects\110_Garden\` の中の社長スタイル §2.5／§2.6 のファイル。見つからなければレポートに書く）の点検項目に 1 行ずつ足す：「仮の場所・既定の見た目で描いてから描き直さない。置き場所が無いうちは場所だけ取る。最初の見た目はサーバーで決められるもの（URL・権限・クッキー）で決める。保存値は useStoredView。表は loading を渡す」。

## テスト
- 上の点検テスト・DataTable のテスト・最初の描画のテストが通る。
- `npx tsc --noEmit`（`.next/` の古い型エラーは対象外）と `npx vitest run src --exclude '**/employment-contract-pdf-integrity.test.tsx'` が通ること（前から壊れている AppHeader・KpiCard・BackgroundCarousel は対象外）。

## 終わったら
`docs/dispatches/report-codex-508-no-flicker-20261102.md`（UTF-8）に、直した共通部品・乗せ替えた画面の一覧・8 で見つけた所・入れた点検テスト・テスト結果・直せなかった所と理由を書く。
