# dispatch main- No. 168 — claude.ai に tab-2 起草指示（通常版 mock 忠実再現、修正点は対話で詰める）

> 起草: a-main-016
> 用途: claude.ai chat に tab-2-financial-summary.html 起草指示。通常版 mock を忠実に HTML 化、修正点は東海林さんが claude.ai と対話で直接詰める方針
> 番号: main- No. 168
> 起草時刻: 2026-05-09(土) 04:55

---

## 投下用短文（東海林さんが claude.ai chat にコピペ、tab-1 OK 判定後に投下）

~~~
🔴 main- No. 168
【a-main-016 から claude.ai chat への dispatch（tab-2 起草指示、通常版 mock 忠実再現、修正点は対話で詰める）】
発信日時: 2026-05-09(土) 04:55

# 件名
tab-2-financial-summary.html を通常版 mock 画像に忠実に HTML 化してください。修正点は a-main からは付与せず、東海林さんが直接対話で詰めます。

# 0. 方針（最重要、tab-1 と異なる点）

| 項目 | tab-1 | **tab-2（本 dispatch）** |
|---|---|---|
| mock | tab-1-dashboard.png | **tab-2-financial-summary.png（通常版、v2 ではない）** |
| 修正リスト | a-main が 6 件付与 | **a-main からは標準 6 件のみ。それ以外は東海林さんが直接対話で claude.ai に指摘** |
| 起草フロー | mock 忠実 + 修正適用 | **mock 忠実再現 → 東海林さん × claude.ai 対話で修正** |

→ tab-2 は**通常版 mock を素直に HTML 化**してください。東海林さんが起草版を見て、必要な修正点を直接指摘します。

# 1. tab-2 の 4 セクション + 3 カード構成（mock 画像踏襲）

mock 画像 `tab-2-financial-summary.png`（通常版）の構造:

| 位置 | セクション | 概要 |
|---|---|---|
| ページ上部 | **タイトル**「2. 財務サマリー」+ サブタイトル「6 法人の財務状況を統合した形で、月別・年度別で確認できるページです」 | |
| 上段左+中央 | **6 法人比較ワンビュー（最大スペース）** | 3 期分テーブル（横スクロール）× 6 法人。各セルに売上/営業利益/経常利益/当期純利益。法人列は固有カラー縞 |
| 上段右 | **6 法人比較レーダーチャート** | 6 軸（売上/経常利益/営業利益/自己資本比率/従業員数/粗利率）× 6 法人重ね表示（半透明 polygon）+ 凡例 |
| 中段 | **3 カード横並び** | 法人数 6 社 / 従業員数 248 名 / 総資産集計 ¥428,600,000 |
| 下段 | **売上・利益詳細** | 月次/四半期/年次タブ + 4 系列折れ線（売上/営業利益/経常利益/当期純利益）× 12 ヶ月（4-3 月）+ 期間フィルタ |

**重要**: mock 画像右下にウサギの装飾画像が描かれていますが、**ウサギは描画しないでください**（標準厳守事項 #1）。

# 2. 詳細 spec ファイル（claude.ai が Drive read で参照）

詳細な mock 画像 text 化 spec を Drive に配置します:

```
G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\015_Gardenシリーズ\08_Garden-Forest\spec_tab2_mock_text.md
```

→ Drive read で精読して、その内容に従って起草してください。

spec の主な内容:
- 全体レイアウト図
- 各セクションのヘッダー・テーブル列・チャート軸・凡例詳細
- 6 法人カラーマッピング厳守
- 標準厳守事項 6 件（ウサギなし含む）
- 修正点は対話で詰める方針

# 3. 標準厳守事項（6 件、tab-1 と同じ）

| # | 厳守 |
|---|---|
| 1 | **ウサギ描画なし**（mock 画像右下にあるが削除、`<img>` 後付けも禁止）|
| 2 | **6 法人カラー厳守**: ヒュアラン=#F4A6BD / センターライズ=#8E7CC3 / リンクサポート=#4A6FA5 / ARATA=#E8743C / たいよう=#F9C846 / 壱=#C0392B |
| 3 | **ヘッダー** = Bud / Bloom precedent 流用（`.topbar` クラス + 外部 CSS `../../../015_Gardenシリーズ/000_GardenUI_bloom/06_CEOStatus/css/style.css`）|
| 4 | **左サイドバー** = `.sidebar.sidebar-dual` + nav-apps + nav-pages 構造踏襲 |
| 5 | **右サイドバー（Activity Panel）** = `.activity-panel` 構造踏襲、内容は Forest 用 |
| 6 | **mock 画像踏襲**: §1 の 4 セクション + 3 カード構成厳守、独自セクション追加禁止 |

# 4. レーダーチャート実装方法

CSS / SVG / Chart.js 等で OK。HTML 内 `<svg>` での実装が望ましい:

```html
<svg viewBox="0 0 400 400" class="gf-radar">
  <!-- 6 軸の polygon -->
  <polygon class="gf-radar-poly gf-radar-hyuaran" points="..." />
  <polygon class="gf-radar-poly gf-radar-centerrise" points="..." />
  ...
</svg>
```

各 polygon に法人カラー（半透明 fill + 濃 stroke）。

# 5. 配置代行フロー（main- No. 165 確立済、tab-1 と同じ）

1. claude.ai が tab-2-financial-summary.html 起草完了
2. dispatch 形式（~~~ ラップ + ```html ~ ``` ブロック）で応答
3. 東海林さんが a-main-016 にコピペ転送
4. a-main-016 が `_chat_workspace/garden-forest/html_drafts/tab-2-financial-summary.html` 配置
5. a-main-016 が Read + 評価軸 10 項目で確認
6. OK → tab-3 同手順 / NG → 東海林さん修正指示 or 私から修正方向 dispatch

**東海林さんの修正指示は a-main を経由せず claude.ai chat に直接投下** されます。私は配置代行 + 評価のみ担当。

# 6. 期待する応答形式（forest-html-N、形式厳守）

self-check（応答送信前）:
- [ ] 冒頭 3 行 = 🟢 forest-html-N + 番号 + 発信日時 + 件名
- [ ] 全体を ~~~ でラップ
- [ ] 自然会話形式禁止
- [ ] HTML 全文を ```html ~ ``` ブロックで包含
- [ ] ~~~ 外の補足は最小限

# 7. 緊急度

🟡 tab-1 OK 判定後（5/12 までに全 7 タブ完成想定）

# 8. tab-1 との関係

- tab-1（main- No. 167）= 再起草指示、修正リスト 6 件を a-main から付与
- **tab-2（本 dispatch）= 通常版 mock 忠実再現のみ、修正は対話で詰める**

→ tab-3 以降は tab-2 と同じフローを採用予定（東海林さんの判断で都度切替可）。
~~~

---

## 詳細（参考）

発信日時: 2026-05-09(土) 04:55
発信元: a-main-016
宛先: claude.ai chat（Forest UI HTML mock 起草担当）
緊急度: 🟡 tab-1 OK 判定後

## a-main-016 の準備（投下前後）

### 投下前
1. ✅ tab-2-financial-summary.png（通常版）を Read で視覚確認
2. ✅ text 化 spec 起草: `docs/specs/2026-05-09-forest-tab-2-mock-text-spec.md`
3. **次**: spec を Drive 配置: `015_Gardenシリーズ\08_Garden-Forest\spec_tab2_mock_text.md`
4. dispatch counter 168 → 169

### 投下後（claude.ai 応答受領後）
1. ```html ブロックから HTML 全文抽出
2. `Write` tool で `_chat_workspace/garden-forest/html_drafts/tab-2-financial-summary.html` 配置
3. `Read` で評価軸 10 項目確認
4. OK → tab-3 進行 dispatch / NG → 東海林さんが claude.ai と直接対話で修正詰め

## 配置代行: spec ファイルを Drive へ

`docs/specs/2026-05-09-forest-tab-2-mock-text-spec.md` の内容を以下に配置:

```
G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\015_Gardenシリーズ\08_Garden-Forest\spec_tab2_mock_text.md
```

## 関連 dispatch / spec / docs

- main- No. 167（5/9 04:44）= tab-1 再起草指示（修正リスト 6 件付与版）
- **main- No. 168（本 dispatch）= tab-2 通常版 mock 忠実再現、修正は対話で詰める版**
- spec: `docs/specs/2026-05-09-forest-tab-2-mock-text-spec.md`
- spec: `docs/specs/2026-05-09-forest-tab-1-mock-text-spec.md`
- docs: `docs/handoff-a-main-015-to-016-20260509.md`
- 元画像: `_reference/garden-forest/ui-mocks/tab-2-financial-summary.png`（通常版）

## 改訂履歴

- 2026-05-09 04:55 初版（a-main-016、東海林さん指示「通常版で進める、修正点は claude.ai と対話で詰める」反映）
