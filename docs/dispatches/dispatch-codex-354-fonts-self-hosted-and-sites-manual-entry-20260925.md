# Codex-354 Garden 共通：フォントを Google Fonts から自前配信（同梱パッケージ）へ切り替える＋マニュアル画面に「コーポレートサイト」を登録

作成日: 2026-09-25
作業ツリー: C:\garden\a-bloom-008
起点: main の最新（`git log -1` で確認・完了報告に書く）
**git は触らないこと（commit するな）。本番のデータ・DB に触らないこと。開発サーバ・ブラウザを起動しないこと。`npm install` は不要（パッケージは Claude が入れ済み・package.json／package-lock.json は触らない）。触ってよいのは `src/app/layout.tsx`・`src/app/globals.css`（フォント変数の定義だけ）・新設する `src/app/_lib/fonts/`（あれば）・`src/app/system/manuals/_lib/manuals-registry.ts`・それらのテストだけ。見た目（どの場所にどのフォントが当たるか）は 1 か所も変えない。**

## 0. なぜ
本番の配備（Vercel のビルド）が、Google Fonts の取得失敗で 1 日に 3 回落ちた（コードは無関係・15 分待って出し直すと通る）。`next/font/google` は**ビルドのたびに Google へフォントを取りに行く**作りのため。フォントのファイルを Garden に同梱して、Google へ取りに行かない作りにする（東海林さん了承 2026-09-25）。

必ず先に読むもの：
- `src/app/layout.tsx`（`Geist`／`Geist_Mono`／`EB_Garamond`／`Cormorant_Garamond`／`Shippori_Mincho`／`Noto_Serif_JP` を `next/font/google` で読み、`variable` で CSS 変数 `--font-geist-sans` `--font-geist-mono` `--font-eb-garamond` `--font-cormorant` `--font-shippori` `--font-noto-serif-jp` を body の className に付けている）
- `src/app/globals.css` の `--font-sans` … `--font-numeric`（上の変数を参照している。**ここは変えない**）
- 入れてあるパッケージ（`node_modules`）：
  - `geist`（Vercel 公式。`import { GeistSans } from "geist/font/sans"`／`import { GeistMono } from "geist/font/mono"`＝**next/font/local で同梱**。`GeistSans.variable` が `--font-geist-sans` を、`GeistMono.variable` が `--font-geist-mono` を定義する）
  - `@fontsource-variable/noto-serif-jp`（`index.css`＝可変フォント・family 名 `"Noto Serif JP Variable"`・日本語サブセット分割 woff2）
  - `@fontsource/shippori-mincho`（`400.css` `500.css` `600.css`・family 名 `"Shippori Mincho"`）
  - `@fontsource-variable/eb-garamond`（`wght.css`＋`wght-italic.css`・family 名 `"EB Garamond Variable"`）
  - `@fontsource-variable/cormorant-garamond`（`wght.css`＋`wght-italic.css`・family 名 `"Cormorant Garamond Variable"`）

## 1. やること（A：フォント）
1. `layout.tsx` から `next/font/google` の import と 6 つの定義を**すべて外す**
2. Geist 2 つは `geist` パッケージに置き換える：`import { GeistSans } from "geist/font/sans"; import { GeistMono } from "geist/font/mono";` → body の className に `GeistSans.variable` と `GeistMono.variable`（今と同じ変数名になる）
3. 残り 4 つは CSS の import に置き換える。`layout.tsx` の先頭（`globals.css` より前）で：
   ```ts
   import "@fontsource-variable/noto-serif-jp";            // index.css
   import "@fontsource/shippori-mincho/400.css";
   import "@fontsource/shippori-mincho/500.css";
   import "@fontsource/shippori-mincho/600.css";
   import "@fontsource-variable/eb-garamond";              // wght.css（index）
   import "@fontsource-variable/eb-garamond/wght-italic.css";
   import "@fontsource-variable/cormorant-garamond";
   import "@fontsource-variable/cormorant-garamond/wght-italic.css";
   ```
4. 変数名を同じにする。`globals.css` の**先頭の `:root`（テーマ変数より前）**に次を足す（既存の `--font-sans` 等はそのまま）：
   ```css
   :root{
     --font-noto-serif-jp: "Noto Serif JP Variable", "Noto Serif JP";
     --font-shippori: "Shippori Mincho";
     --font-eb-garamond: "EB Garamond Variable", "EB Garamond";
     --font-cormorant: "Cormorant Garamond Variable", "Cormorant Garamond";
   }
   ```
   （`next/font` は変数に生成名を入れていたが、意味は同じ。参照側の `var(--font-…)` は 1 か所も変えない）
5. body の className から外した 4 つの `.variable` を消す（Geist 2 つは残す）。`display: "swap"` 相当は fontsource の CSS が `font-display: swap` を持っているので追加不要
6. **確認**：`grep -rn "next/font/google" src` が `layout_2026*.tsx`（古い控え・触らない）以外で 0 件。`npx tsc --noEmit` OK。`npx next build` は走らせなくてよい（Claude が本番配備で確認する）

## 2. やること（B：マニュアル画面の登録）
- `src/app/system/manuals/_lib/manuals-registry.ts` の `SYSTEM_MANUALS` に、`manual("system", "list", …)` の**次**（並びは左メニューと同じ＝「契約書管理」の次が「コーポレートサイト」だが、配列では `contracts` の次）に 1 行：
  `manual("system", "sites", "コーポレートサイト", "グループ各社の会社HPと商品ページの一覧。稼働状態・問い合わせの配線・旧サーバー契約の見方と、一覧の更新のしかた。"),`
  ※ `contracts` の次に入れる（`toss` の前）
- 既存テストで件数や並びを見ているものがあれば合わせる

## 3. テスト（vitest・全部緑にしてから完了報告）
- `src/app/layout` 周辺に既存テストがあれば緑。無ければ追加不要
- マニュアル登録：`getVisibleManuals("super_admin")` に `sites` が含まれ、`contracts` の直後にある

## 4. 完了報告（コードブロックで・コピーできる形）
- 起点の main のコミット／変えたファイル／`grep next/font/google` の結果／tsc・eslint・vitest の結果／気づいた点・やり残し
