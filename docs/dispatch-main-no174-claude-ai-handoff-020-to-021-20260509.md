# dispatch main- No. 174 — Garden UI 020 → 021 引き継ぎプロンプト（claude.ai セッション切替）

> 起草: a-main-016
> 用途: claude.ai chat セッション「Garden UI 020」が容量限界 → 「Garden UI 021」起動時の初期投下プロンプト（永続ファイル参照型、context 引き継ぎ）
> 番号: main- No. 174
> 起草時刻: 2026-05-09(土) 17:43

---

## 投下用短文（東海林さんが claude.ai chat「Garden UI 021」**新規起動直後の最初**にコピペ）

~~~
🟢 main- No. 174
【a-main-016 から claude.ai chat（Garden UI 021、新規セッション）への引き継ぎ + 初期コンテキスト】
発信日時: 2026-05-09(土) 17:43

# 件名
Garden UI 020 が容量限界のため 021 へ引き継ぎ。Forest UI 7 タブ HTML mock 起草を継続してください。永続ファイル参照型で context 再生成します。

# 0. これまでの経緯（要約）

「Garden UI 020」セッションで Forest dashboard tab-1-dashboard.html を 6 回繰り返し起草（forest-html-1 〜 forest-html-6）し完成。残り tab-2〜tab-7（6 タブ）を「021」で継続。

# 1. 確立済の作業フロー（厳守）

| Step | 担当 | 内容 |
|---|---|---|
| 1 | 東海林さん | claude.ai chat に **mock 画像を直接アップロード** + a-main-016 起草の dispatch 短文をコピペ |
| 2 | claude.ai（あなた） | 画像を直接見て HTML 起草 |
| 3 | claude.ai | dispatch 形式（~~~ ラップ + ` ```html ~ ``` ` ブロック）で HTML 全文転送 |
| 4 | a-main-016 | 配置代行（Drive Write）+ 仕様レイヤー評価 |
| 5 | 東海林さん | プレビュー視覚評価 → OK / 修正点を直接対話で詰める |

# 2. 応答番号（次は forest-html-7 から開始）

「Garden UI 020」では **forest-html-1 〜 forest-html-6** まで進行。「Garden UI 021」では **forest-html-7 から続番** で開始してください（リセットしない）。

# 3. 応答形式（毎回厳守、self-check 必須）

```
🟢 forest-html-N
【claude.ai chat（Forest UI 起草担当） から a-main-016 への dispatch（件名）】
発信日時: 2026-05-09(土) HH:MM

# 件名
（簡潔な件名）

# 内容（表形式・要点）

# HTML 全文
```html
<!DOCTYPE html>
...
```

# 次の作業
（待機 or 次タスク）

# self-check
- [x] 冒頭 3 行 = 🟢 forest-html-N + 番号 + 発信日時 + 件名
- [x] ~~~ ラップ
- [x] 自然会話形式禁止
- [x] HTML 全文を ```html ~ ``` ブロックで包含
- [x] ~~~ 外（コピペ対象外）の補足は最小限
```

# 4. 完成済 tab-1 の参照（永続ファイル）

tab-1-dashboard.html は完成して既に Drive 配置済。Drive read で内容参照可:

| 項目 | パス |
|---|---|
| 完成 tab-1 HTML | `G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\garden-forest\html_drafts\tab-1-dashboard.html` |

→ 構造（gf-* CSS / 6 セクション / ヘッダー / 左 dual サイドバー / 右 Activity Panel / 進行期 glow）はこれを **テンプレートとして踏襲**してください。tab-2〜7 で再記述しなくてよいので、新規セクションのみ集中起草。

# 5. 厳守事項 6 件（全 7 タブ共通、絶対遵守）

| # | 厳守 |
|---|---|
| 1 | **ウサギ描画なし**（mock 画像にあっても削除、`<img>` 後付け禁止）|
| 2 | **6 法人カラー厳守**: ヒュアラン=#F4A6BD / センターライズ=#8E7CC3 / リンクサポート=#4A6FA5 / ARATA=#E8743C / たいよう=#F9C846 / 壱=#C0392B |
| 3 | **ヘッダー** = `.topbar` クラス + 外部 CSS 参照 `../../../015_Gardenシリーズ/000_GardenUI_bloom/06_CEOStatus/css/style.css`（3 階層上） |
| 4 | **左サイドバー** = `.sidebar.sidebar-dual` + `nav-apps`（12 モジュール）+ `nav-pages`（Forest 7 タブ + tab-8） |
| 5 | **右サイドバー（Activity Panel）** = `.activity-panel` 構造踏襲、内容は **Forest 用** |
| 6 | **mock 画像踏襲（最重要）**: 添付 mock 画像の構成・レイアウト・データ表示を **忠実再現**、独自セクション追加禁止 |

# 6. 配置パス（全タブ共通、相対パス基準）

| 用途 | パス |
|---|---|
| Forest 背景画像（ライト）| `../../_reference/garden-forest/bg-forest-light.png`（**2 階層上**、tab-1 で確定）|
| Forest 背景画像（ダーク）| `../../_reference/garden-forest/bg-forest-dark.png` |
| Bloom 外部 CSS | `../../../015_Gardenシリーズ/000_GardenUI_bloom/06_CEOStatus/css/style.css`（3 階層上）|
| Bloom 外部 JS | `../../../015_Gardenシリーズ/000_GardenUI_bloom/06_CEOStatus/js/script.js` |
| 6 法人アネモネアイコン | `../../_reference/garden-bloom/bloom-corporate-icons/{hyuaran,centerrise,linksupport,arata,taiyou,ichi}.png` |
| 12 モジュールアイコン | `../../../015_Gardenシリーズ/000_GardenUI_bloom/06_CEOStatus/images/icons_bloom/orb_*.png` |

# 7. CSS / アニメーション流用可（tab-1 の `<style>` から継続）

- `gf-*` プレフィックス（Forest 固有 class）
- Forest 緑系 CSS 変数: `--gf-deep` (#1b4332) / `--gf-mid` (#2d6a4f) / `--gf-bright` (#40916c) / `--gf-light` (#52b788) / `--gf-pale` (#74c69d) / `--gf-mist` (#95d5b2) / `--gf-cream` (#f6f1e7)
- 6 法人カラー CSS 変数: `--corp-{hyuaran,centerrise,linksupport,arata,taiyou,ichi}`
- `gfShinkouGlow` keyframe（進行期 glow アニメ、Forest v9 踏襲）
- `gfFadeUp` keyframe（カード fade-in）

# 8. 残作業（tab-2〜tab-7 の 6 タブ）

| タブ | mock 画像 | 起草想定タイミング |
|---|---|---|
| tab-2 財務サマリー | `tab-2-financial-summary.png`（または v2）| **次タスク**（東海林さんが 021 起動後に最初に投下）|
| tab-3 キャッシュフロー | `tab-3-cashflow.png` | 後続 |
| tab-4 事業 KPI | `tab-4-business-kpi.png` | 後続 |
| tab-5 予実比較 | `tab-5-budget-vs-actual.png` | 後続 |
| tab-6 アラート・リスク | `tab-6-alerts-risks.png` | 後続 |
| tab-7 レポート・分析 | `tab-7-reports-analysis.png` | 後続 |

各タブ起草フローは tab-1 と同じ:
1. 東海林さんが mock 画像 + dispatch 短文 投下
2. claude.ai が画像を直接見て HTML 化
3. forest-html-N で全文転送
4. a-main-016 配置代行 + 仕様評価
5. 東海林さん視覚評価 → OK or 修正対話

# 9. 配置先（全タブ共通）

```
G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\garden-forest\html_drafts\tab-N-{name}.html
```

# 10. 起動時の初動

「Garden UI 021」起動直後は本 dispatch（main- No. 174）を受領 → **forest-html-7 として「引き継ぎ受領 + 待機モード」応答**してください:

```
🟢 forest-html-7
【claude.ai chat（Forest UI 起草担当、Garden UI 021）から a-main-016 への dispatch（引き継ぎ受領 + 待機）】
発信日時: 2026-05-09(土) HH:MM

# 件名
main- No. 174 受領、Garden UI 020 → 021 引き継ぎ完了。tab-2 mock 画像投下待機モード。

# 受領内容
- 確立済フロー（画像直接添付 + dispatch 形式）
- 厳守事項 6 件
- 配置パス・CSS 流用ルール
- forest-html-7 から続番
- 残 6 タブ（tab-2〜7）

# 次の作業
東海林さんが mock 画像 + tab-2 起草指示 dispatch 投下を待機。

# self-check
- [x] 冒頭 3 行 ...
- [x] ~~~ ラップ
- [x] 自然会話形式禁止
- [x] ~~~ 外の補足最小限
```

# 11. 緊急度
🟡 中（セッション容量切替、業務継続のため）
~~~

---

## 詳細（参考）

発信日時: 2026-05-09(土) 17:43
発信元: a-main-016
宛先: claude.ai chat（Garden UI 021、新規セッション）
緊急度: 🟡 中

## a-main-016 側の準備（投下前後）

### 投下前
1. ✅ tab-1-dashboard.html 完成版が `_chat_workspace/garden-forest/html_drafts/` に配置済（forest-html-6、5/9 17:30）
2. ✅ 6 法人アネモネアイコン 6 枚配置済（`_reference/garden-bloom/bloom-corporate-icons/`）
3. ✅ Forest 背景画像 light/dark 配置済（`_reference/garden-forest/`）
4. ✅ tab-2〜7 の mock 画像 7 枚配置済（`_reference/garden-forest/ui-mocks/`、tab-2 通常版/v2 両方含む）
5. ✅ 9 モジュール背景画像配置完了（17 枚、Bud ダーク + 8 モジュール × ライト/ダーク）

### 投下後（claude.ai forest-html-7 受領後）
- 待機モード受領確認 → 東海林さんが tab-2 mock 画像 + 起草指示 dispatch 投下準備
- tab-2 起草指示 dispatch（main- No. 175 になる想定）= 短文（mock 踏襲 + 修正は対話で詰める方針）

## 関連 dispatch / docs

- main- No. 169（5/9 11:40）= 画像直接添付フロー切替
- main- No. 173（5/9 17:19）= tab-1 修正 3 件（forest-html-6 で完結）
- **main- No. 174（本 dispatch）= Garden UI 020 → 021 引き継ぎ**
- 完成 tab-1: `_chat_workspace/garden-forest/html_drafts/tab-1-dashboard.html`
- mock 画像: `_reference/garden-forest/ui-mocks/tab-{1-7}-*.png`

## memory 候補

- feedback `feedback_chat_session_switch_main_first` 適用（永続ファイル経由 context 再生成）
- 本 dispatch は適切な「永続ファイル参照型ハンドオフプロンプト」の **テンプレート例**

## 改訂履歴

- 2026-05-09 17:43 初版（a-main-016、東海林さん「Garden UI 020 → 021 引き継ぎ」要請）
