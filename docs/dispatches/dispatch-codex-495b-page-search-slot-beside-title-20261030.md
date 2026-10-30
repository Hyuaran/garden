# Codex-495b 右上の検索窓を「タイトルの右の空き」に置く（495 の手直し・2026-10-30）

作業場所：C:\garden\a-bloom-008（main）
**git は触らない（add / commit / push / checkout / stash すべて禁止）。** ファイルを直すだけ。
前提：Codex-495 の変更（PageSearchSlot・DataTable・各外枠）は作業ツリーにある。これを手直しする。

## 直す点
495 では、検索があるとき `shacho-shell.module.css` の
`.hasSidebar .actions:has([data-page-search-slot]:not(:empty)) { position:relative; ... }`
で右上のボタン列をふつうの並びにしたため、**タイトル・タブがまるごと検索の行の分だけ下に下がった**。
東海林さんの希望は「**タイトルの右の空き**（ボタン列の下〜タブの行の上）に検索窓を置く」なので、ページは下げない。

## やること
1. **ボタン列は今までどおり右上に浮かせたまま（`position:absolute`）、その下に検索窓をぶら下げる。** 上の `:has(...) { position:relative ... }` の規則は消す（Bud・My・Rill で同じく下へ押し下げている規則があれば同じ考えで直す。Bud は topbar の高さが増えないように）。
2. **検索窓の高さは 36px、ボタン列との間は 6px。** 右端はボタン列の右端にそろえ、幅はボタン列と同じ。
3. **タブの行・歯車・「最終更新」に重ならないようにする。** 検索窓の下端が、ページの一番上の部品の並び（System の SystemTabs の行、Root の `PageHeader` の右端の歯車など）より上で終わること。
   - 外枠は、置き場に検索が入っている間だけ、`<main>` に CSS 変数 `--page-search-width`（置き場の実際の幅＋16px）と `--page-search-bottom`（main の上端から検索窓の下端までの px）を入れる（ResizeObserver で幅の変化に追従。取り直しや定期の処理は足さない）。
   - **Root の `PageHeader`**（`src/app/root/_components/PageHeader.tsx`）：右の部品（`pageHeaderActions`＝歯車など）が検索窓の下に入らないよう、検索があるときは `margin-right: var(--page-search-width)` で検索窓の左へずらす。
   - **ページの見出しのかたまりの次の行**（タブの行など）が検索窓の下端より上に来る画面では、見出しのかたまりに `min-height`（`--page-search-bottom` から main の上の余白を引いた値）を付けて、次の行を検索窓の下へ送る。タイトルの位置そのものは動かさない。
   - System の画面で SystemTabs の行の右端に歯車がある画面（`/system/onboarding` など）は、タブの行が検索窓の下端より下にあることを確かめる。上に食い込むなら、同じく見出しのかたまりの min-height で送る。
4. 幅 801px 以上だけの話。800px 以下は 495 のとおり表の上に横いっぱい（変えない）。

## 確かめる（数値で）
テストの中で、各外枠と次の画面の組み立てで「検索窓の矩形」と「歯車・タブの行・最終更新の矩形」が重ならないことを、レイアウトを持つ環境が無いなら少なくとも CSS 変数と margin/min-height が付くことを確かめる。
対象：`/system/onboarding`（入社予定者・入社後の確認）、`/system/line`（人とタグ）、`/root/employees`、Bud の表がある画面 1 つ。

## テスト
- 495 で足したテストはそのまま通ること。検索が入ると main に 2 つの CSS 変数が付く・消えると外れることを足す。
- `npx tsc --noEmit` と `npx vitest run src/app/system/_components src/app/root src/app/system/onboarding src/app/system/line --exclude '**/employment-contract-pdf-integrity.test.tsx'` が通ること。

## やらないこと
- Garden 全体の検索は作らない／表の中身・並べ替え・絞り込みは変えない／git は触らない

## 終わったら
`docs/dispatches/report-codex-495b-page-search-slot-beside-title-20261030.md` に、直したファイル・テスト結果・迷った所を書く。
