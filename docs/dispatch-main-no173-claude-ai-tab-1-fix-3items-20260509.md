# dispatch main- No. 173 — claude.ai に tab-1 追加修正指示 3 件（背景パス修正 + セクション入替 + 法人アイコン画像化）

> 起草: a-main-016
> 用途: forest-html-5 視覚評価結果に基づく追加修正 3 件
> 番号: main- No. 173
> 起草時刻: 2026-05-09(土) 17:19

---

## 投下用短文（東海林さんが claude.ai chat にコピペ）

~~~
🟡 main- No. 173
【a-main-016 から claude.ai chat への dispatch（tab-1 追加修正 3 件）】
発信日時: 2026-05-09(土) 17:19

# 件名
forest-html-5 視覚評価結果。大枠 OK ですが、追加修正 3 件あります。同 tab-1-dashboard.html を上書き修正してください（forest-html-6 起草）。

# 修正 1: 背景画像パス（私の見落とし、即修正）

forest-html-5 で `../_reference/garden-forest/bg-forest-{light,dark}.png`（1 階層上）と書きましたが、配置先からの相対計算が **1 階層分間違い**:

| 項目 | 値 |
|---|---|
| 配置先 | `_chat_workspace/garden-forest/html_drafts/tab-1-dashboard.html` |
| 1 階層上 | `_chat_workspace/garden-forest/` |
| 2 階層上 | `_chat_workspace/` |
| ターゲット | `_chat_workspace/_reference/garden-forest/bg-forest-{light,dark}.png` |
| **正しい相対パス** | **`../../_reference/garden-forest/bg-forest-{light,dark}.png`**（2 階層上）|

→ 該当 2 箇所を修正:
1. `<style>` 内 `body.forest-page .bg-layer#bgLayer1` の `background-image: url('...')`
2. `<body>` 内 `<div class="bg-layer" id="bgLayer1" style="background-image: url('...')">` 

修正前: `../_reference/garden-forest/bg-forest-light.png`
修正後: `../../_reference/garden-forest/bg-forest-light.png`

ダーク版も同様（`bg-forest-dark.png`）。

# 修正 2: セクション 3-4 と 5-6 を入れ替え + 番号振り直し

東海林さんの実用判断による配置変更。グラフ・比較表（中段）→ 連携データ・決算書（下段）の方が運用上自然:

## 修正前（現状）

| 位置 | セクション |
|---|---|
| 上左 §1 | グループサマリー |
| 上右 §2 | 納税カレンダー |
| 中左 §3 | 税理士連携データ |
| 中右 §4 | 決算書ダウンロード |
| 下左 §5 | グループ全体合算利益推移 |
| 下右 §6 | 6 法人比較ワンビュー |

## 修正後（新配置）

| 位置 | セクション | 番号 |
|---|---|---|
| 上左 §1 | グループサマリー | **1.** |
| 上右 §2 | 納税カレンダー | **2.** |
| **中左 §3** | **グループ全体合算利益推移**（旧 §5） | **3.** |
| **中右 §4** | **6 法人比較ワンビュー**（旧 §6） | **4.** |
| **下左 §5** | **税理士連携データ**（旧 §3） | **5.** |
| **下右 §6** | **決算書ダウンロード**（旧 §4） | **6.** |

→ HTML 構造で `gf-grid-2x3` 内の `<div class="ceo-card">` 6 個の **3-4 番目と 5-6 番目を入れ替え**、各セクションの `<span class="gf-section-num">N.</span>` を新番号に更新。

CSS の `.gf-grid-2x3 > .ceo-card:nth-child(N) { animation-delay: ... }` は順序維持で OK（カード自体の順序が入れ替わるだけ、nth-child は新位置で適用）。

# 修正 3: 法人アイコンを花アイコン（既存アネモネ）に変更

§6 決算書ダウンロード（新）と §4 6 法人比較ワンビュー（新）の法人アイコン:

## 現状（文字テキスト）

```html
<span class="gf-corp-icon" style="background:#F4A6BD">ヒ</span>
<span class="gf-cmp-corp-mini" style="background:#E8743C">A</span>
```

## 修正後（既存 6 法人アネモネ画像）

```html
<span class="gf-corp-icon">
  <img src="../../_reference/garden-bloom/bloom-corporate-icons/hyuaran.png" alt="ヒュアラン">
</span>
<span class="gf-cmp-corp-mini">
  <img src="../../_reference/garden-bloom/bloom-corporate-icons/arata.png" alt="ARATA">
</span>
```

## 法人別ファイル名（全 6 法人）

| 法人 | ファイル名 |
|---|---|
| ヒュアラン | `hyuaran.png` |
| センターライズ | `centerrise.png` |
| リンクサポート | `linksupport.png` |
| ARATA | `arata.png` |
| たいよう | `taiyou.png` |
| 壱 | `ichi.png` |

配置先からの相対パス: `../../_reference/garden-bloom/bloom-corporate-icons/{name}.png`

## CSS 調整（img 表示用）

```css
.gf-corp-icon {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  overflow: hidden;
  /* background, color, font などは不要に */
}
.gf-corp-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.gf-cmp-corp-mini {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  overflow: hidden;
}
.gf-cmp-corp-mini img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
```

→ 既存 background:カラーコード スタイルは削除、画像 1 枚で表現。

# 既厳守事項（継続）

- 6 法人カラー（カラーコード）は**他箇所で継続使用**（納税カレンダー法人タグ、PDF ボタン、トレンドチャート等）
- ウサギなし、Forest 緑系 CSS 変数、gf-* プレフィックス、Activity Panel 内容（Forest 用 6 件）維持
- 左サイドバー dual nav、ヘッダー precedent 維持

# 期待する応答（forest-html-6）

self-check 同様（~~~ ラップ + ```html ~ ``` 全文転送）。

# 緊急度
🟡 中（視覚評価大枠 OK 後の細部調整）
~~~

---

## 詳細（参考）

発信日時: 2026-05-09(土) 17:19
発信元: a-main-016
宛先: claude.ai chat
緊急度: 🟡 中

## 経緯

forest-html-5 配置 + 視覚評価結果（東海林さん 5/9 17:15）:
- 大枠 OK ✅
- 背景画像反映なし → パス問題（私の相対計算ミス、forest-html-5 で `../_reference/...` と書いた箇所が 1 階層分不足）
- セクション §3-§4 と §5-§6 入替依頼（運用判断）
- 決算書ダウンロード + 6 法人比較ワンビューの法人アイコン → 既存アネモネ画像化

## a-main-016 の自己反省

- 背景パス問題: forest-html-4 の時点で既に同パス（誤）だったが、Read 評価で気付かなかった（仕様レイヤー評価で「CSS 参照パス OK」とした際に背景画像パスは別途確認しなかった）
- main- No. 169 のフロー切替後、配置代行 + 仕様レイヤー評価が役割だが、視覚評価の前段階（実画像が表示されるかどうか）も確認すべきだった
- 教訓: 「背景画像が表示されるか」= 仕様レイヤーでファイル存在 + パス整合確認が必要

## 既存資源

- `_chat_workspace/_reference/garden-bloom/bloom-corporate-icons/{hyuaran,centerrise,linksupport,arata,taiyou,ichi}.png`（6 法人アネモネ、5/8-5/9 ChatGPT 生成）
- `_chat_workspace/_reference/garden-forest/bg-forest-{light,dark}.png`（5/9 03:30 配置済）

## 関連 dispatch / docs

- main- No. 169（5/9 11:40）= 画像直接添付フロー切替
- forest-html-5（5/9 12:35）= 修正 4 件反映版 → **本 dispatch で追加修正 3 件**
- 元画像: `_reference/garden-forest/ui-mocks/tab-1-dashboard.png`
- 配置先: `_chat_workspace/garden-forest/html_drafts/tab-1-dashboard.html`

## 改訂履歴

- 2026-05-09 17:19 初版（a-main-016、視覚評価結果に基づく追加修正 3 件起草）
