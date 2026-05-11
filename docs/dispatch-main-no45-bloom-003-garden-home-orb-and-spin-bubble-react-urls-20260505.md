# main- No. 45 dispatch - a-bloom-003 garden-home orb 11 個 + spin bubble 11 個 dead-link 整理 - 2026-05-05

> 起草: a-main-012
> 用途: 5/8 デモ向け 6 画面レビューの 🟡 残課題 #3 + #4 をまとめて修正
> 番号: main- No. 45
> 起草時刻: 2026-05-05(火) 17:20
> 緊急度: 🟡 5/8 デモ向け（3 日前、後道さんがクリックしても 404 にならない状態に）

---

## 投下用短文（東海林さんが a-bloom-003 にコピペ）

~~~
🟡 main- No. 45
【a-main-012 から a-bloom-003 への dispatch（garden-home orb 11 個 + spin bubble 11 個 dead-link 整理）】
発信日時: 2026-05-05(火) 17:20

5/8 デモ向け 6 画面レビューの 🟡 残課題 2 件まとめて修正依頼。両 proto の Bloom 以外 11 module を React 本番 URL に置換すれば、全 12 module が 200 到達可能（main- No. 44 で /leaf も 200 化済）。

【検出した問題と置換マップ（DOM 検証済）】

# 3: /_proto/garden-home/ orb 11 個が href="#"（dead-link）

| name | 現状 | 置換 → |
|---|---|---|
| Bloom | /bloom | （変更なし）|
| Fruit | # | /fruit |
| Seed | # | /seed |
| Forest | # | /forest |
| Bud | # | /bud |
| Leaf | # | /leaf |
| Tree | # | /tree |
| Sprout | # | /sprout |
| Soil | # | /soil |
| Root | # | /root |
| Rill | # | /rill |
| Calendar | # | /calendar |

# 4: /_proto/garden-home-spin/ bubble 11 個が ./xxx.html（404）

| name | 現状 | 置換 → |
|---|---|---|
| Bloom | /bloom | （変更なし）|
| Bud | ./bud.html | /bud |
| Calendar | ./calendar.html | /calendar |
| Fruit | ./fruit.html | /fruit |
| Leaf | ./leaf.html | /leaf |
| Rill | ./rill.html | /rill |
| Seed | ./seed.html | /seed |
| Soil | ./soil.html | /soil |
| Sprout | ./sprout.html | /sprout |
| Tree | ./tree.html | /tree |
| Forest | ./forest.html | /forest |
| Root | ./root.html | /root |

【修正依頼】

### # 3 対応: public/_proto/garden-home/index.html の orb 11 箇所

各 orb-card の `<a href="#">` を React URL に Edit 置換。
`replace_all` ではなく、orb 名（Fruit, Seed, ... Calendar）を含む箇所を 1 つずつ正確に Edit（# が他用途で使われている可能性に注意）。

推奨: name と組み合わせた context で正確に Edit:
- 例: `<a class="orb-card" href="#">` で Fruit を含むブロック → `<a class="orb-card" href="/fruit">`
- 既存 Bloom orb は `<a class="orb-card" href="/bloom">` のため、構造同一。

### # 4 対応: public/_proto/garden-home-spin/index.html の bubble 11 箇所

各 bubble の `./<module>.html` を `/<module>` に置換。
sed 一括も可（`./` を全部消すと他で副作用ありうるので慎重）:

```bash
sed -i \
  -e 's|href="\./bud\.html"|href="/bud"|g' \
  -e 's|href="\./calendar\.html"|href="/calendar"|g' \
  -e 's|href="\./fruit\.html"|href="/fruit"|g' \
  -e 's|href="\./leaf\.html"|href="/leaf"|g' \
  -e 's|href="\./rill\.html"|href="/rill"|g' \
  -e 's|href="\./seed\.html"|href="/seed"|g' \
  -e 's|href="\./soil\.html"|href="/soil"|g' \
  -e 's|href="\./sprout\.html"|href="/sprout"|g' \
  -e 's|href="\./tree\.html"|href="/tree"|g' \
  -e 's|href="\./forest\.html"|href="/forest"|g' \
  -e 's|href="\./root\.html"|href="/root"|g' \
  /c/garden/a-bloom-003/public/_proto/garden-home-spin/index.html
```

【検証フロー（a-main-012 が再実施）】

修正後 push 受領 → Chrome MCP で:
1. /_proto/garden-home/ の orb 12 個全て href が /<module>（# が 0 件）
2. /_proto/garden-home-spin/ の bubble 12 個全て href が /<module>（./xxx.html が 0 件）
3. 任意で 1〜2 リンク実クリック → React 本番遷移確認（Bloom 以外）

【削除禁止ルール】

新規 legacy 2 件:
- public/_proto/garden-home/index.legacy-orb-react-url-20260505.html
- public/_proto/garden-home-spin/index.legacy-bubble-react-url-20260505.html

（main- No. 41/42/44 で作成済 legacy も継続保持）

【完了報告フォーマット】

bloom-003- No. 29 で:
- commit hash + push 状態
- # 3 garden-home の置換 11 箇所 before/after
- # 4 spin の置換 11 箇所 before/after
- legacy 保持ファイル一覧
- 完了時刻

【dispatch counter】

a-main-012: 次 main- No. 46（残課題は 5/8 デモ後 post-デモ対応に回す）
a-bloom-003: bloom-003- No. 29 で完了報告予定

工数見込み: 20〜30 分（garden-home 11 Edit + spin sed 一括 + 確認）

ご対応お願いします。
~~~

---

## 改訂履歴

- 2026-05-05 17:20 初版（a-main-012、5/8 デモ向け 6 画面レビュー 🟡 残課題 #3 + #4 まとめ、両 proto の 12 orb/bubble 完全把握後）
