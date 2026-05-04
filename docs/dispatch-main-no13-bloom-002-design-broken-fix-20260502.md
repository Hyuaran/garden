# main- No. 13 dispatch - a-bloom-002 Bloom Top Phase 1 デザイン破綻 修正依頼 - 2026-05-02

> 起草: a-main-010
> 用途: Bloom Top Phase 1 のデザインが視覚的に破綻、即修正
> 番号: main- No. 13
> 起草時刻: 2026-05-02(土) 15:05

---

## 投下用短文（東海林さんが a-bloom-002 にコピペ）

~~~
🔴 main- No. 13
【a-main-010 から a-bloom-002 への dispatch（Bloom Top Phase 1 デザイン破綻 即修正）】
発信日時: 2026-05-02(土) 15:05

東海林さん視覚確認結果：🔴 NG「デザインむちゃくちゃ」

【現象（スクショから読み取り）】

1. 巨大な桜花（ピンク）が画面中央を完全占拠
   - 1 輪の花が画面の 60-70% を占めている
   - prototype と全く違う表示

2. KPI cards 4 枚が見えない
   - 「¥12,680,000」が薄っすら見えるが背景の桜花に埋もれている
   - 完全に背景に飲まれている

3. ナビカード 4 枚が見えない
   - スクショ範囲外 or 背景に埋もれているか

4. ページタイトル「Bloom — 花咲く業務の庭」だけ左上に小さく表示
5. Topbar / Activity Panel は表示されている

【推定原因】

- 背景画像のサイズ / 位置 / opacity が想定外
- bg-overlay の彩り gradient が強すぎる、または別画像が誤って読み込まれた
- KPI cards / ナビカードの z-index が背景より低い、or 表示自体されていない
- 何らかの CSS 計算ミスで巨大な桜花が中央配置されている

【即修正依頼】

1. localhost:3000/bloom を a-bloom-002 側でも視覚確認（dev バイパス済）
2. F12 Elements で巨大ピンク花の element を特定
   - 桜花画像の実体は何か（img? background-image? svg?）
   - サイズ / position / z-index 確認
3. prototype（015_Gardenシリーズ/000_GardenUI_bloom/02_BloomTop/index.html）と比較
4. 原因特定 + 修正
5. commit + push（feature/bloom-6screens-vercel-2026-05 ブランチ）
6. 東海林さんに再視覚確認依頼

【修正方針候補（先回り）】

- A. 背景画像のサイズ縮小（例: width: 100% → max-width: 200px 等）
- B. 桜花画像の position / opacity 調整
- C. bg-overlay の z-index 修正（cards より低くする）
- D. KPI cards / ナビカードの z-index 上げる
- E. 別の画像が読み込まれている → 正しい画像 path に修正

【📋 確認項目】

1. prototype と既実装の compiled CSS を diff
2. KPI cards element の Computed display 値（none になっていないか）
3. bg-overlay の background-image url が prototype と一致するか
4. ライト / ダーク両モードで同じ現象か

【完了報告期待】

修正後 commit hash + push 状態 + 東海林さん再視覚確認待ち、で a-main-010 に報告
（v4 ヘッダー形式、接頭辞 bloom-002）。

【dispatch counter】

a-main-010: 次 main- No. 14
a-bloom-002: 確認後 +1 して報告

ご対応お願いします。
~~~

---

## 配布手順（東海林さん）

| Step | 内容 |
|---|---|
| 1 | 上記 ~~~ 内をコピー |
| 2 | a-bloom-002 / Garden Bloom 002 セッションに貼り付け投下 |

→ a-bloom-002 が即原因調査 + 修正。

## 改訂履歴

- 2026-05-02 初版（main- No. 13、Bloom Top Phase 1 デザイン破綻 即修正依頼）
