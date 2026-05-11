# dispatch main- No. 169 — claude.ai に画像直接添付フロー切替 + tab-1 再々起草指示（Claude Code text 化撤廃）

> 起草: a-main-016
> 用途: claude.ai chat に画像直接添付フローへ切替指示。tab-1 を再々起草（text spec 撤廃、ChatGPT mock 画像を東海林さんが直接アップロード、claude.ai が画像を直接見て HTML 化）
> 番号: main- No. 169
> 起草時刻: 2026-05-09(土) 11:40

---

## 投下用短文（東海林さんが claude.ai chat にコピペ + mock 画像を直接添付）

~~~
🔴 main- No. 169
【a-main-016 から claude.ai chat への dispatch（画像直接添付フロー切替 + tab-1 再々起草指示）】
発信日時: 2026-05-09(土) 11:40

# 件名
ワークフロー切替: Claude Code の text 化 spec を撤廃します。今回から東海林さんが ChatGPT mock 画像を直接 claude.ai chat にアップロードしますので、claude.ai は **画像を直接見て** HTML 化してください。tab-1 を再々起草。

# 0. 経緯と認識訂正

## これまでのフロー（5/9 朝〜午前）

| Step | 担当 | 結果 |
|---|---|---|
| 1 | Claude Code が ChatGPT mock 画像を Read で text 化 → spec 起草 | ⚠️ 不正確（§3 連携項目 / §4 列名 / §2 カレンダー構造 / §5 グラフ構成 で乖離） |
| 2 | claude.ai が text spec を Drive read → HTML 起草 | spec 通りに起草したが、mock 画像と相違 |
| 3 | tab-1 評価 → mock 画像と「全然違う」（東海林さん） | 9 件の相違確認 |

## 根本原因

**Claude Code の画像 → text 変換が不得意**。これまでの ChatGPT 画像 → claude.ai HTML 化フロー（Bud / Bloom 等）では「全然違う」例なし = **claude.ai の画像読み取り能力は信頼できる**。

→ Claude Code を間に挟むと劣化。**claude.ai が画像を直接見るのが正解**。

## 切替後のフロー（5/9 11:40〜）

| Step | 担当 | 内容 |
|---|---|---|
| 1 | 東海林さん | claude.ai chat に **ChatGPT mock 画像を直接アップロード** + 本 dispatch 短文をコピペ |
| 2 | claude.ai | **画像を直接見て** HTML 化（Claude Code 起草の text spec は無視）|
| 3 | claude.ai | dispatch 形式（~~~ ラップ + ```html ~ ``` ブロック）で HTML 全文転送 |
| 4 | a-main-016 | 配置代行（Drive Write）+ Read で**仕様レイヤーのみ評価**（CSS パス / 6 法人カラー / ウサギなし / precedent 流用）|
| 5 | 東海林さん | プレビュー視覚評価 → OK / 修正点を直接 claude.ai に指摘（対話で詰める）|

# 1. tab-1 再々起草の対象

| 項目 | 内容 |
|---|---|
| 対象画像 | **東海林さんが本 dispatch と同時にアップロードする tab-1-dashboard.png** |
| 対象 HTML | `tab-1-dashboard.html`（同名上書き）|
| 配置先 | `G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\garden-forest\html_drafts\tab-1-dashboard.html` |
| 既存版 | 1,168 行版（mock と相違）= **完全破棄** |

# 2. 厳守事項（標準 6 件のみ、これ以外は mock 画像踏襲）

| # | 厳守 | 由来 |
|---|---|---|
| 1 | **ウサギ描画なし**（mock 画像にウサギがあっても削除、`<img>` 後付けも禁止）| 5/8 東海林さん全面却下 |
| 2 | **6 法人カラー厳守**: ヒュアラン=#F4A6BD / センターライズ=#8E7CC3 / リンクサポート=#4A6FA5 / ARATA=#E8743C / たいよう=#F9C846 / 壱=#C0392B | 5/8 東海林さん変更指示 |
| 3 | **ヘッダー** = Bud / Bloom precedent 流用（`.topbar` クラス + 外部 CSS `../../../015_Gardenシリーズ/000_GardenUI_bloom/06_CEOStatus/css/style.css`、3 階層上）| 5/9 確定 |
| 4 | **左サイドバー** = `.sidebar.sidebar-dual` + `nav-apps`（12 モジュール）+ `nav-pages`（Forest 7 タブ + tab-8）構造踏襲 | 5/9 確定 |
| 5 | **右サイドバー（Activity Panel）** = `.activity-panel` 構造踏襲、内容は **Forest 用**（「今日の経営アクティビティ」、6 法人売上更新 / 試算表確定 / 残高警告 / 納税期限 / 決算進行 / 月次パッケージ等）| 5/9 main- No. 164 |
| 6 | **mock 画像踏襲（最重要）**: 添付 mock 画像の構成・レイアウト・データ表示を **忠実再現**、独自セクション追加禁止 | 5/9 a-main-015 終盤訂正 |

# 3. CSS / アニメーション流用（既存版から保持可）

| 流用可 | 理由 |
|---|---|
| `gf-*` プレフィックス（Forest 固有 class）| Bud (bud-*) / Bloom 同様の手法、precedent 整合 |
| Forest 緑系 CSS 変数（`--gf-deep` / `--gf-mid` / `--gf-bright` / `--gf-light` / `--gf-pale` / `--gf-mist` / `--gf-cream`）| Forest トーン定義 |
| `gfShinkouGlow` keyframe（進行期 glow アニメ）| Forest v9 踏襲 |
| `gfFadeUp` keyframe（カード fade-in アニメ）| 演出統一 |
| 6 法人カラー CSS 変数（`--corp-hyuaran` 等）| 厳守事項 #2 |

# 4. 期待する応答形式（forest-html-N、形式厳守）

self-check（応答送信前）:
- [ ] 冒頭 3 行 = 🟢 forest-html-N + 番号 + 発信日時 + 件名
- [ ] 全体を ~~~ でラップ（コピーボタン保持）
- [ ] 自然会話形式禁止
- [ ] HTML 全文を ```html ~ ``` ブロックで包含
- [ ] ~~~ 外（コピペ対象外）の補足は最小限

# 5. 緊急度

🔴 即実施（5/12 までに全 7 タブ完成想定、tab-1 が起点）

# 6. tab-2 以降のフロー

tab-2〜tab-7 も同フローで進めます:

| Step | 担当 |
|---|---|
| 1 | 東海林さんが mock 画像（tab-N-XXX.png）を claude.ai chat に直接アップロード + 短文 dispatch（main- No. NNN）コピペ |
| 2 | claude.ai が画像直接見て HTML 化 |
| 3 | a-main-016 が配置代行 + 仕様レイヤー評価 |
| 4 | 東海林さんが視覚評価 → OK / 修正対話 |

→ main- No. 168（tab-2 通常版 mock、text spec 採用）は **本 dispatch（No. 169）方針で上書き**。tab-2 投下時は東海林さんが画像直接添付してください。

# 7. 配置パスの整合（CSS / 画像参照、再確認）

| 用途 | 相対パス（tab-N-*.html から）|
|---|---|
| Bloom 外部 CSS | `../../../015_Gardenシリーズ/000_GardenUI_bloom/06_CEOStatus/css/style.css` |
| Bloom 外部 JS | `../../../015_Gardenシリーズ/000_GardenUI_bloom/06_CEOStatus/js/script.js` |
| Forest 背景画像（ライト）| `../../../015_Gardenシリーズ/themes/garden-forest/bg-forest-light.png` |
| Forest 背景画像（ダーク）| `../../../015_Gardenシリーズ/themes/garden-forest/bg-forest-dark.png` |
| 6 法人アイコン | `../../../015_Gardenシリーズ/themes/corporate-icons/{hyuaran,centerrise,linksupport,arata,taiyou,ichi}.webp` |
| 12 モジュールアイコン | `../../../015_Gardenシリーズ/000_GardenUI_bloom/06_CEOStatus/images/icons_bloom/orb_*.png` |

これらは画像参照のみで OK（実画像は実装時に解決）。

# 8. 既存 1,168 行版との関係

forest-html-3 で起草した 1,168 行版は **完全破棄** してください。新規起草で同名上書きしてください。CSS / アニメーションは §3 通り流用 OK。
~~~

---

## 詳細（参考）

発信日時: 2026-05-09(土) 11:40
発信元: a-main-016
宛先: claude.ai chat（Forest UI HTML mock 起草担当）
緊急度: 🔴 即実施

## ワークフロー切替の根本理由

| 試行 | 結果 |
|---|---|
| 5/9 朝 Claude Code text 化 → claude.ai HTML 化 | mock と 9 件相違（§1 装飾欠落 / §2 構造違い / §3 項目違い / §4 列名違い / §5 グラフ構成違い 等）|
| Bud / Bloom 等 過去フロー（東海林さんが画像を chat に貼って claude.ai HTML 化）| 「全然違う」例なし、安定実績 |

→ Claude Code 経由が **品質劣化工程**だったと判明。

## a-main-016 の役割再定義

| 項目 | 役割 |
|---|---|
| ❌ mock 画像 text 化 | **撤廃** |
| ❌ 詳細 spec 起草（mock 構造記述）| **撤廃** |
| ✅ dispatch 起草（厳守事項 6 件 + Activity Panel 内容例）| 継続 |
| ✅ 配置代行（Drive Write）| 継続 |
| ✅ 仕様レイヤー評価（CSS パス / 6 法人カラー / ウサギなし / precedent 流用 / Forest 緑系 CSS）| 継続 |
| ❌ 視覚評価（mock との整合確認）| **撤廃**（東海林さん専管）|

## memory 候補（後続更新）

- 新規 feedback memory: **「ChatGPT mock 画像は claude.ai chat に直接添付。Claude Code の text 化を経由しない」**
  - Why: Claude Code の画像 → text 変換が不得意で品質劣化、claude.ai は画像直接読み取りで正確
  - How to apply: 全モジュール mock 画像 → HTML 化フローに適用、Claude Code は text 化せず配置代行 + 仕様評価のみ

## 関連 dispatch / spec / docs

- main- No. 167（5/9 04:44）= tab-1 再起草（text spec 付与版、不成果）
- main- No. 168（5/9 04:55）= tab-2 通常版 mock + 修正対話方針（text spec 付与版、本 dispatch で方針上書き）
- **main- No. 169（本 dispatch）= 画像直接添付フロー切替 + tab-1 再々起草**
- 既存 HTML: `_chat_workspace/garden-forest/html_drafts/tab-1-dashboard.html`（1,168 行、破棄対象）
- 元画像: `_reference/garden-forest/ui-mocks/tab-1-dashboard.png`（東海林さんが直接添付）

## 改訂履歴

- 2026-05-09 11:40 初版（a-main-016、東海林さん指摘「Claude Code 画像読み取り力弱い」を受けてフロー切替）
