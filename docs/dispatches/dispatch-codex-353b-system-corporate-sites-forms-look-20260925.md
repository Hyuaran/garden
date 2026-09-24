# Codex-353b コーポレートサイト画面：見た目を「フォーム一覧」と同じカード／表に作り直す（東海林さん 2026-09-25「フォームみたいな感じで」）

作成日: 2026-09-25
作業ツリー: C:\garden\a-bloom-008
起点: main の最新（`git log -1` で確認・完了報告に書く）
**git は触らないこと（commit するな）。本番のデータ・DB に触らないこと。開発サーバ・ブラウザを起動しないこと。触ってよいのは `src/app/system/sites/SitesHubClient.tsx`・`sites.module.css`・`SitesHubClient.test.tsx` だけ。`_lib/sites-registry.ts`・`_data/corporate-sites.json`・`page.tsx`・メニュー定義は変えない。**

必ず先に読むもの：
- **手本＝フォーム一覧**：`src/app/system/forms/FormsHubClient.tsx`・`forms.module.css`（`.header` `.listHeading` `.viewToggle` `.formGrid` `.formCard` `.cardHeading` `.iconPlate` `.cardFooter` `.tableWrap`）。**見た目はこれと同じにする**（余白・枠・影・アイコン枠・見出しの大きさ・［開く］ボタン・表の形）。CSS はフォームのものを写して `sites.module.css` に置く（共通化はしない）
- 今のコード：`src/app/system/sites/SitesHubClient.tsx`（作り直す）・`_lib/sites-registry.ts`（`groupSitesByCompany`／`statusLabel`／`countByStatus`／型はそのまま使う）
- `src/app/system/_components/ShachoShell/ShachoShell.tsx` の `MenuIcon`（`icon: "folder"` を使う。新しいアイコンは作らない）

## 0. 何を変えるか
今の画面は 1 サイト 2〜3 行の「項目を全部並べた表」になっていて、東海林さんの指示「フォームみたいな感じで、サイトへ飛べる」と違う。**フォーム一覧と同じカード（グリッド）と表（リスト）**にする。会社ごとのまとまりは残す。

## 1. 画面（グリッド表示＝既定）

```
 System ／ コーポレートサイト
 コーポレートサイト
 グループ各社の会社HPと商品ページ。稼働中のサイトは［開く］で開けます。

 サイトの一覧（稼働 4／移管待ち 4／新規作成待ち 5）        更新日 2026/09/24   [≡][▦]
 ▸ 共通の仕組み（ホスティング・DNS・問い合わせの流れ）                      ← 折りたたみ（既定＝閉）

 株式会社ヒュアラン                                                        ← 会社見出し（h3・小さめ）
 ┌────────────────────────────┐ ┌────────────────────────────┐
 │ [folder] 会社HP                  │ │ [folder] 商品ページ SMART BREAKER │
 │ hyuaran.com                      │ │ denshibreaker.com                │
 │ 問い合わせ→Kintone app242        │ │ WordPress・お名前メール（要移行） │
 │ TO 金亜奈・東海林美琴            │ │ 後回し（他デザイン担当者との兼ね合い）│
 │ ▸ 配線・契約の詳細               │ │ ▸ 配線・契約の詳細               │
 │ ●稼働 2026-09-24〜        [開く] │ │ ●移管待ち              （未公開）│
 └────────────────────────────┘ └────────────────────────────┘
 株式会社たいよう
 ┌ 会社HP ──┐ ┌ 事業LP 不動産アライアンス ──┐ ┌ 商品LP JUST光 ──┐
 …（ストーンベース／ARATA／株式会社壱／株式会社almalio／リンクサポート／株式会社センターライズ）…

 対象外・解約：ms-support-osaka.com（…）／kanden.biz／…                      ← 小さく 1 行
```

- ページ見出し・説明文＝フォームと同じ `.header`（右に余白 112px・共通ヘッダーと重ねない）
- 「サイトの一覧（稼働 n／移管待ち n／新規作成待ち n）」＝フォームの「フォームの一覧」と同じ `.listHeading`。右に「更新日 YYYY/MM/DD」（薄い文字）と表示切替（フォームと同じ 2 ボタン・localStorage `garden.sites.viewMode`・既定＝**グリッド**）
- 共通の仕組み＝`<details>`（今のまま。見た目は薄い枠）
- 会社見出し＝`h3`（15px・太字・上に 18px 余白）。その下に `.formGrid` と同じグリッド（`repeat(auto-fill, minmax(min(300px,100%),1fr))`）
- **カード**＝フォームの `.formCard` と同じ：
  - 上段：`.iconPlate` に `MenuIcon icon="folder"`＋見出し `h2`＝`kind`＋（`product` があれば「 商品名」）。会社名はカードに書かない（見出しで分かる）
  - 説明 `p`（13px・行間 1.75・最大 3 行）：1 行目＝ドメイン（`domain`／無ければ「ドメイン未定」）。2 行目＝問い合わせ先（`kintone_app` があれば「問い合わせ→Kintone app242」、無ければ `stack`・`mail` を「・」で）。3 行目＝`chatwork_to` があれば「TO 金亜奈・東海林美琴」、無ければ `notes[0]`
  - `<details class="wiring">`「配線・契約の詳細」（既定＝閉）：`dl` で GitHub／Vercel／流入元／メール／旧サーバー（plan・contract・年額・action・別ID）／備考（notes 全部）。無い項目は出さない
  - 下段 `.cardFooter`：左＝状態バッジ（`statusLabel`：稼働＝緑 `.active`／移管待ち＝黄／新規作成待ち＝グレー）＋ `live_since` があれば「2026-09-24〜」。右＝`url` があれば `<a href target="_blank" rel="noopener noreferrer">開く</a>`（フォームの［開く］と同じボタン）、無ければ薄い文字「未公開」
- 対象外・解約＝一番下に小さく（今のまま）

## 2. 画面（リスト表示）
フォームの `.tableWrap` と同じ表。列＝**会社｜サイト（kind＋product）｜ドメイン｜状態｜問い合わせ先（Kintone app・TO）｜（開く）**。会社は同じ会社が続くときも毎行書く（並び替えなし・会社→会社HP→商品の順は `groupSitesByCompany` の順）。`url` があれば［開く］、無ければ空

## 3. スマホ幅（760px 以下）
フォームと同じ：カードは 1 列、見出しの右余白 0、表は横スクロール（`min-width: 640px`）。文字を切らない

## 4. テスト（vitest・全部緑にしてから完了報告）
- グリッド：会社見出し 8 つ、カード 13 枚、稼働サイトのカードに `target="_blank"` の「開く」、ドメイン未定のカードに「ドメイン未定」と「未公開」、`details` の中に「GitHub Hyuaran/hyuaran」
- リスト：表の見出し 6 列、行 13、「開く」が 4 つ
- 「サイトの一覧（稼働 4／移管待ち 4／新規作成待ち 5）」と「更新日 2026/09/24」
- 表示切替で localStorage に保存・既定はグリッド

## 5. 完了報告（コードブロックで・コピーできる形）
- 起点の main のコミット／変えたファイル／テスト本数と結果／tsc・eslint の結果／気づいた点・やり残し
