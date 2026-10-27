# Codex-451：タブの決まりを全画面にそろえる ①共通の守り＋System・Sprout・Bud（2026-10-27）

## 決まり（2026-10-27 東海林さん決定・社長スタイル正本 §2.5「タブを使うかどうか」）
- **1 つの画面の中で切り替える中身が 2 つ以上ならタブ必須（SystemTabs）・1 つならタブなし。**
- 画面の中の切り替えを、自前のタブ・ボタンの並び・セグメント・プルダウン・［開く］で別ページへ移る一覧で作らない。全部 SystemTabs。
- タブが 1 つだけになる画面はタブの行を出さない。そのとき歯車などの操作は `SystemViewHeading`（`src/app/system/_components/ViewPermissionButton/SystemViewContext.tsx`）で見出しの文字の右に出す。
- 選んでいるタブは URL の `?tab=` に持つ（読み込み直しても同じタブ）。見られないタブは出さない。
- 絞り込み（期間・法人・全員／自分だけ など、同じ中身を絞るだけ）と一覧／カードの切り替え（HeaderViewToggle）はタブにしない。今のまま。

先に読む：`C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\070_AI-Rules\050_Gardenスタイル・社長スタイル.md` の §2.5・§2.6。**社長スタイル §2.5 の型・§2.6 の点検に従う。**

## やること
### A. 共通の守り（SystemTabs）
- `src/app/system/_components/SystemTabs/SystemTabs.tsx`：中のタブ（`React.Children.toArray` で null・false を除いた数）が **1 つ以下ならタブの行を描かない**。`actions` があるときは、タブの行の代わりに actions だけを右端に置く行にせず、**何も描かない**（呼ぶ側が SystemViewHeading に歯車を出す）。
- そのため、タブが権限で減る画面（下の一覧）は、見られるタブが 1 つ以下のとき `SystemViewHeading` に歯車を出すように直す。見本＝マニュアル画面（`src/app/system/manuals/`）。
  - /system/onboarding・/system/manuals・/system/manuals/[module]/[slug]（資料のタブ：社員は「操作マニュアル」だけ＝タブなしで本文だけ）・/sprout・/system/call-metrics・/system/contracts・/system/sites・/system/kanri・/system/list・/system/forms・/bud/expenses（ExpenseFrame は HTML を差し込んでいるので、数え方を壊さないこと。数えられないなら呼ぶ側でタブの数を渡す）
- タブが 1 つで決まっている画面：/sprout/postings（「バイトル」1 つ）→ タブを消す。

### B. Bud の自前タブを SystemTabs に
- /bud/dashboard：自前の `role=tablist`（「全体」1 つ）→ 消す。法人の行は絞り込みなので今のまま。
- /bud/transfers/[transfer_id]：自前の TabButton（3 つ）→ SystemTabs・`?tab=`。
- BudFaithfulFrame の HTML `.tab-nav`（/bud/transfers・/audit・/invoices・/journal・/settings・/profit・/masters・/payroll）→ HTML の中のタブの行を隠し、React 側で SystemTabs を描いて、押すと今までと同じ中身に切り替わるようにする。**見本＝ExpenseFrame.tsx（経費精算はもうこの形）**。`filterBudViewHtml` の権限の絞り込みはそのまま効かせる。中のカテゴリのチップ（絞り込み）は触らない。
- /bud/statements・/bud/statements/summary・/bud/statements/imports：見出しのリンク（月次集計／取込履歴／← 明細一覧）で別ページへ移る形 → **/bud/statements の 1 画面に SystemTabs「明細一覧／月次集計／取込履歴」**（`?tab=list|summary|imports`）。古い 2 つの URL は `?tab=` へ redirect（ブックマークを壊さない）。

### 画面の絵（Bud 明細の例）
```
Bud / 明細
明細
                                   明細最終更新：2026/10/27(火) 18:00 (↻)
 明細一覧   月次集計   取込履歴                                 [歯車]
━━━━━━─────────────────────────────────────────────
（選んだタブの中身＝今の各ページの中身そのまま）
```

## 触らないもの
- Bloom・Forest・Leaf・Tree の画面（Codex-452 が同時に作業中。**そのファイルは開いても直さない**）。
- 本番 DB・Storage・環境変数・vercel.json。**git は触らないでください。コミットは人間側が行います。** npm install はしない。

## テスト（FAIL 0）
- SystemTabs：子が 0・1 のときタブの行が出ない／2 つで出る。
- 権限で 1 つになる画面の代表（onboarding・manuals の資料・sprout）：タブなし＋見出しの右に歯車。
- Bud：transfers 詳細・BudFaithfulFrame の画面・statements の 3 タブが `?tab=` で切り替わる／古い URL が redirect。
- 自分が直したファイルのテスト＋ `npx tsc --noEmit`。最後に `npx vitest run src/app/system src/app/bud src/app/sprout`。

## 確認
日本語が「???」に化けていないこと（Python で数える）。BOM を付けないこと。

## 完了報告（コードブロックで）
変更したファイル／直した画面の数と一覧／テスト結果（件数・FAIL 0）／判断に迷ったところ。
