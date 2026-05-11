# dispatch main- No. 167 — claude.ai に tab-1 再起草指示（mock 画像忠実再現、独自設計禁止）

> 起草: a-main-016
> 用途: claude.ai chat に tab-1-dashboard.html 再起草指示。既存 1,036 行版（独自設計）破棄、ChatGPT mock 画像踏襲の正規 6 セクション構成で再起草
> 番号: main- No. 167
> 起草時刻: 2026-05-09(土) 04:44

---

## 投下用短文（東海林さんが claude.ai chat にコピペ）

~~~
🔴 main- No. 167
【a-main-016 から claude.ai chat への dispatch（tab-1 再起草指示、ChatGPT mock 画像忠実再現、独自設計禁止）】
発信日時: 2026-05-09(土) 04:44

# 件名
tab-1-dashboard.html 再起草指示。既存 1,036 行版は独自設計で mock 画像と乖離しているため破棄。ChatGPT mock 画像の 6 セクション構成を text 化した spec を提供するので、それを忠実に HTML 化してください。

# 0. 背景認識訂正（最重要）

これまで私（a-main-015 期）が「8 タブ構成 + 各タブ内容」を独自設計で claude.ai に伝えていましたが、これは誤りでした。

**正しい認識**:

| 役割 | 担当 |
|---|---|
| **設計図** | ChatGPT が事前生成した mock 画像（東海林さんと既に承認済）|
| **HTML 化** | claude.ai は mock 画像を **忠実に HTML 化**（独自設計禁止）|
| **画像 → text 変換** | claude.ai は画像を直接 read できないので、a-main-016 が text 化した spec を提供 |

→ 既存 tab-1-dashboard.html（1,036 行、グループサマリー 5 カード + マクロチャート + 月次キャッシュフロー要約 + 東海林さん活動）= **mock 画像と全く異なる独自設計** = 破棄。

# 1. 再起草対象の正規 6 セクション構成（mock 画像踏襲）

mock 画像 `tab-1-dashboard.png` の 2 列 × 3 行グリッドに、以下 6 セクションを配置:

| 位置 | セクション | 概要 |
|---|---|---|
| 上左 | **1. グループサマリー** | 4 大カード（売上/営業利益/経常利益/当期純利益、各前年同月比 + スパークライン）+ 4 小ミニメトリクス（法人数/従業員数/総資産/自己資本比率）|
| 上右 | **2. 納税カレンダー** | 月カレンダー（< 2026年5月 >、日月火水木金土）+ 「今月の納税スケジュール」予定リスト |
| 中左 | **3. 税理士連携データ** | 最終取得日時 + 連携サービス（MoneyForward）+ データ再取得ボタン + 連携データ状況メーター（仕訳/試算表/賃金台帳/税申告）|
| 中右 | **4. 決算書ダウンロード** | 6 法人 × 3 PDF（貸借対照表/損益計算書/株主資本）テーブル |
| 下左 | **5. グループ全体合算利益推移** | 4 系列折れ線グラフ（売上/営業利益/経常利益/当期純利益）× 6 ヶ月（4月-9月）|
| 下右 | **6. 6 法人比較ワンビュー** | 6 法人比較表（売上/営業利益/利益率/経常利益/当期純利益）+ グループ合計行 |

**含めない（独自設計）**:
- マクロチャート（既存 1,036 行版にあった）
- 月次キャッシュフロー要約（同上）
- 東海林さんの活動（同上、Bloom 連携系）
- グループサマリー 5 カード版（4 大 + 4 小ミニが正解）

# 2. 詳細 spec ファイル（claude.ai が Drive read で参照）

詳細な mock 画像 text 化 spec を Drive に配置済みです:

```
G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\015_Gardenシリーズ\08_Garden-Forest\spec_tab1_mock_text.md
```

→ a-main-016 が次のステップでこのパスに spec を配置します。配置後 claude.ai は Drive read で精読して、その内容に従って起草してください。

spec の主な内容:
- 全体レイアウト図
- 各セクションのヘッダー・テキスト・カード構造・テーブル列・凡例
- 6 法人カラーマッピング（厳守）
- 修正適用リスト 6 件
- 評価軸 8 項目

# 3. 厳守事項（修正適用リスト 6 件）

| # | 厳守 | 由来 |
|---|---|---|
| 1 | **ウサギ描画なし**（全タブ共通、`<img>` 含む装飾としても入れない）| 5/8 東海林さん全面却下 |
| 2 | **6 法人カラー厳守**: ヒュアラン=#F4A6BD ピンク / センターライズ=#8E7CC3 紫 / リンクサポート=#4A6FA5 青 / ARATA=#E8743C 橙 / たいよう=#F9C846 黄 / 壱=#C0392B 赤 | 5/8 東海林さん変更指示 |
| 3 | **ヘッダー** = Bud / Bloom precedent 流用（外部 CSS 参照、相対パス: `../../../015_Gardenシリーズ/000_GardenUI_bloom/06_CEOStatus/css/style.css`）+ HTML 構造は `.topbar` クラス踏襲 | 5/9 確定 |
| 4 | **左サイドバー** = Bud / Bloom precedent（`.sidebar.sidebar-dual` + `nav-apps` + `nav-pages` 構造）| 5/9 確定 |
| 5 | **右サイドバー（Activity Panel）** = Bud / Bloom precedent 流用、内容は **Forest 用**（「今日の経営アクティビティ」など）| 5/9 main- No. 164 |
| 6 | **mock 画像踏襲（最重要）**: spec の §1-8 に記載の 6 セクション構成を厳守、独自セクション追加禁止、独自レイアウト変更禁止 | 5/9 a-main-015 終盤訂正 |

# 4. 既存 1,036 行版に対する操作

| 操作 | 内容 |
|---|---|
| 既存 1,036 行版 | 破棄（グループサマリー 5 カード + マクロチャート + 月次キャッシュフロー要約 + 東海林さん活動 = 独自設計）|
| **CSS / アニメーション流用可** | `gf-*` プレフィックス、`gfShinkouGlow` keyframe、Forest 緑系 CSS 変数 (`--gf-deep` 等) は再利用 OK |
| 新規起草 | 本 dispatch §1 の 6 セクション構成 + spec ファイル詳細に従って |
| 上書き | `tab-1-dashboard.html` で同名上書き |

# 5. 配置代行フロー（main- No. 165 確立済）

1. claude.ai が tab-1-dashboard.html 再起草完了
2. claude.ai が dispatch 形式（~~~ ラップ）で応答、HTML 全文を ```html ~ ``` ブロックで包含
3. 東海林さんが a-main-016 にコピペ転送
4. a-main-016 が ```html ~ ``` ブロックから HTML 抽出 + Write tool で配置
5. a-main-016 が Read + 評価軸 8 項目で確認
6. OK → tab-2 同手順 / NG → 修正方向 dispatch（main- No. NNN）

# 6. 期待する応答形式（forest-html-N、形式厳守）

self-check（応答送信前に確認）:
- [ ] 冒頭 3 行 = 🟢 forest-html-N + 番号 + 発信日時 + 件名
- [ ] 全体を ~~~ でラップ（コピーボタン保持）
- [ ] 自然会話形式（「dispatch 受領しました」等）になっていない
- [ ] HTML 全文を ```html ~ ``` ブロックで包含
- [ ] ~~~ 外（コピペ対象外）の補足は最小限

# 7. 緊急度

🔴 即実施（5/12 までに全 7 タブ完成想定、tab-1 再起草が起点）

# 8. 次タブへの展開

tab-1 OK 判定後、tab-2 同手順:
- a-main-016 が tab-2-financial-summary.png（修正版含む）を Read で text 化 → spec 提供 → claude.ai 起草

mock 画像 7 枚（tab-1 〜 tab-7）すべて配置済:
`G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\_reference\garden-forest\ui-mocks\`

→ 各タブ毎に a-main-016 が text 化 spec 提供 → claude.ai が忠実 HTML 化、の繰り返し。
~~~

---

## 詳細（参考）

発信日時: 2026-05-09(土) 04:44
発信元: a-main-016
宛先: claude.ai chat（Forest UI HTML mock 起草担当）
緊急度: 🔴 即実施

## a-main-016 の準備（投下前後）

### 投下前
1. ✅ tab-1-dashboard.png を Read で視覚確認
2. ✅ text 化 spec 起草: `docs/specs/2026-05-09-forest-tab-1-mock-text-spec.md`
3. **次**: spec を Drive 配置: `015_Gardenシリーズ\08_Garden-Forest\spec_tab1_mock_text.md`
4. dispatch counter 168 に更新 + commit

### 投下後（claude.ai 応答受領後）
1. ```html ブロックから HTML 全文抽出
2. `Write` tool で `_chat_workspace/garden-forest/html_drafts/tab-1-dashboard.html` 上書き
3. `Read` で評価軸 8 項目確認:
   - 6 セクション構成（グループサマリー / 納税カレンダー / 税理士連携 / 決算書DL / 利益推移 / 6法人ワンビュー）
   - グループサマリー = 4 大 + 4 小ミニ（5 カード版ではない）
   - マクロチャート / 月次キャッシュフロー要約 / 東海林さん活動 = 含まれない
   - 6 法人カラー正しいマッピング
   - ウサギ描画なし
   - ヘッダー / サイドバー precedent 流用
   - Forest 緑系 CSS 変数定義
   - ボタニカル世界観（角丸 14-20px、シャドウ、blur）
4. OK → tab-2 進行 dispatch / NG → 修正方向 dispatch

## 配置代行: spec ファイルを Drive へ

`docs/specs/2026-05-09-forest-tab-1-mock-text-spec.md` の内容を以下に配置:

```
G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\015_Gardenシリーズ\08_Garden-Forest\spec_tab1_mock_text.md
```

claude.ai は Drive コネクタ経由で text read 可能（既に source-html ディレクトリ等で実績あり）。

## 関連 dispatch / spec / docs

- main- No. 162-166（5/9 03:25-04:00、a-main-015 起草、claude.ai G 案フロー確立）
- spec: `docs/specs/2026-05-09-forest-tab-1-mock-text-spec.md`（本 dispatch 起草と並行で a-main-016 起草）
- spec: `docs/specs/2026-05-09-forest-ui-claude-ai-html-prompt.md`（旧 8 タブ概要、本 dispatch で部分的に上書き）
- docs: `docs/handoff-a-main-015-to-016-20260509.md`（本 dispatch の起点）
- docs: `docs/forest-ui-unification-research-20260509.md`（事前調査）
- 元画像: `_reference/garden-forest/ui-mocks/tab-1-dashboard.png`
- 既存 HTML: `_chat_workspace/garden-forest/html_drafts/tab-1-dashboard.html`（1,036 行、破棄対象）

## 改訂履歴

- 2026-05-09 04:44 初版（a-main-016、ChatGPT mock 画像 = 承認済設計図 認識訂正後の再起草指示）
