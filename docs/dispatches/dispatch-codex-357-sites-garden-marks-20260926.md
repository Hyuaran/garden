# Codex-357 各社サイト側：会社情報の欄とお知らせ欄に Garden の印を付ける（1 リポジトリずつ）

作成日: 2026-09-26
対象: 各社サイトのリポジトリ（Garden とは別。1 サイトずつ作業ツリーを clone して実施）
**git は Claude が扱う（Codex は clone 済みの作業ツリーの HTML を編集するだけ・commit しない）。Garden 側（Codex-356）が本番に乗ってから着手。**

必ず先に読むもの：
- 設計書 §5・§7：C:\garden\a-bloom-008\docs\superpowers\specs\2026-09-26-corporate-sites-company-sync-design.md
- Garden の共通 JS の仕様：C:\garden\a-bloom-008\public\garden-company.js（印の名前・`<template>` の置換語・`data-garden-news-mode`）

## 0. 共通の直し方（全サイト同じ）
1. `</head>` の直前に 1 行：`<script src="https://garden-os.net/garden-company.js" data-company="<slug>" defer></script>`
2. 会社情報の欄：値の文字を `<span data-garden="…">` で包む。**「代表取締役 」などの肩書は span の外**に残す（Root の代表者名には肩書が無い）。住所は `<br>` で分けてあっても、値全体を 1 つの span に入れる（Root の 1 行の住所に置き換わる。改行は無くなる）。電話は `<a href="tel:…">` の中の文字を span で包む（JS が href も直す）
3. お知らせ欄：一覧の親要素に `data-garden-news data-garden-news-limit="3"`（または 5）を付け、その中に `<template>` で 1 件分の雛形（既存の 1 件の HTML を写し、日付を `{{published_on_ja}}`（または `{{published_on}}`）、見出しを `{{title}}`、本文を `{{body}}` に）。既存の「差し替え用」「Coming Soon」「日付未定」の仮の行は**消す**（実物のお知らせが Garden に無い間は空欄になるので、Garden 側に「サイト公開のお知らせ」を 1 件入れておく＝Claude）。**ヒュアラン HP とストーンベースの既存の実物のお知らせは残す**（`data-garden-news-mode="prepend"`＝Garden の分を先頭に足す）
4. 見た目（CSS）は変えない。文字が変わるだけ

## 1. サイトごとの場所

| slug | リポジトリ／ファイル | 会社情報の欄 | お知らせ欄 | 備考 |
|---|---|---|---|---|
| hyuaran | Hyuaran/hyuaran `site/index.html` | `.company-table .co-row` の `.co-val`（会社名／代表者／設立／電話／所在地） | `#newsTrack` のカード（`.news-card`）。**prepend**。雛形＝`.news-card` 1 枚（`nc-vol` は「HYUARAN」、`nc-date`＝`{{published_on_ym}}`（2026.09）、`nc-label`＝`{{title}}`、`nc-text`＝`{{body}}`、`nc-bg-num` は空） | スライダーの初期化（dots・maxIndex）がカード数で決まる → 差し込み後に `garden:news-updated` を受けて再初期化するよう、スライダーの即時関数を `initNewsSlider()` に切り出して 2 回目以降は dots を作り直す |
| centerrise | Hyuaran/centerise `site/index.html` | `table.company-table`（会社名 td の先頭テキスト／代表者「代表取締役 」の後／所在地 td 全体／電話 a の中／設立 time） | `ul.news-list`（仮 3 行）。雛形＝`<li><span class="news-date">{{published_on_ja}}</span><span>{{title}}</span></li>` | **郵便番号がサイト 558-0053・Root 558-0013 で違う**＝Root が正（法人名簿）。反映で直る |
| arata | Hyuaran/arata `site/index.html` | 同上（`table.company-table`） | `ul.news-list`（`<li><time>…</time><h3>…</h3></li>`）雛形＝同じ形 | |
| link-support | Hyuaran/link-support `site/company/index.html`（会社HP）と `site/index.html`（LP のフッター・会社名／住所があれば） | `table.company-table` | `ul.news-list`（span 2 つ） | |
| taiyou | **Hyuaran/taiyou-corp** `site/index.html`（sunsun-taiyou.com/company/ の実体＝rewrite）と Hyuaran/sunsun-taiyou `site/index.html`（LP フッター）、Hyuaran/just-hikari `site/infomation.html`（所在地・販売元） | `table.company-table`／just-hikari は `dl` の `dd` | `ul.news-list`（span 2 つ） | just-hikari の所在地は誤字あり（東大阪府成区）＝Root で直る |
| ichi | Hyuaran/ichi `site/company/index.html`（会社HP）と `site/index.html` ほか Ichi光ページのフッター | `table.company-table` | `ul.news-list`（time＋h3） | |
| stonebase | Hyuaran/stonebase `30_自社サイト/site/index.html` | `.profile-card` の `dl`（所在地／設立／代表者 の `dd`） | `.news-grid` の `article.news-card`（実物 1 件＋Coming Soon 2 件）。**prepend**・Coming Soon は消す。雛形＝`article.news-card`（time／h3／p。「詳しく見る」リンクは無し） | |

## 2. 進め方
1. ヒュアラン HP を先に（一番複雑）。Claude が clone → Codex が編集 → Claude が tsc 無しの静的チェック（HTML の閉じタグ・script 1 行）→ push → Vercel 自動配備 → Chrome で「Root の値どおりか」「お知らせが出るか」「スライダーが動くか」
2. 残り 6 社（7 リポジトリ）を同じ手順で

## 3. 完了報告（1 リポジトリごと・コードブロックで）
- 変えたファイル／印を付けた項目の一覧／雛形の中身／気づいた点（Root の値と今の表示の違い）
