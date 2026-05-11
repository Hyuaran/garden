# dispatch main- No. 180 — claude.ai に tab-2 修正指示（v1 mock 基準、6 件修正）

> 起草: a-main-017
> 用途: a-review review-9 で特定された tab-2 修正項目（# 3-8）を claude.ai に依頼、v1 mock 基準
> 番号: main- No. 180
> 起草時刻: 2026-05-09(土) 21:15

---

## 投下用短文（東海林さんが claude.ai chat「Garden UI 021」にコピペ + tab-2 mock v1 画像直接添付）

~~~
🟡 main- No. 180
【a-main-017 から claude.ai chat（Garden UI 021）への dispatch（tab-2 修正指示、v1 mock 基準 6 件）】
発信日時: 2026-05-09(土) 21:15

# 件名
tab-2-financial-summary.html を v1 mock 基準で 6 件修正してください。a-review 視覚評価 review-9 で特定された mock 整合性違反 + UX 改善項目。

# 1. 修正対象ファイル

既存配置: G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\garden-forest\html_drafts\tab-2-financial-summary.html

# 2. 添付画像（東海林さんがアップロード時に使用）

- 必須: G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\_reference\garden-forest\ui-mocks\tab-2-financial-summary.png（**v1 通常版、確定 mock**）

→ v1 のみ参照、v2 は使わない。東海林さん 5/9 確定。

# 3. 修正項目 6 件

## 🔴 重要 4 件（mock 整合性違反、絶対修正）

### 3-1. KPI 順序修正（最優先）
mock では KPI 3 カードが上段、HTML では中段。mock 通り KPI を最上段に移動。
HTML 構造順:
- 旧: tab2-grid（ワンビュー + レーダー横並び）→ tab2-kpi-row → tab2-chart-row
- 新: tab2-kpi-row（KPI 3 カード）→ tab2-grid（ワンビュー + レーダー）→ tab2-chart-row（売上/利益詳細）

### 3-2. レーダーチャート配置修正
mock ではレーダーがワンビューの「下」に独立カード配置。HTML ではワンビューの「右」に横並び。
修正:
- tab2-grid を縦積みレイアウトに変更（grid-template-columns: 1fr）
- ワンビューカードを上、レーダーカードを下に配置
- または section 分離（ワンビュー section + レーダー section の 2 つに）

### 3-3. 6 法人アイコンを実 PNG に置換
旧: emoji（🌸🌷🌼🌻🌺🌹）で代替
新: 実 PNG ファイル参照
- 相対パス: ../../_reference/garden-bloom/bloom-corporate-icons/{法人名}.png
- 法人 → ファイル対応:
  - ヒュアラン → hyuaran.png
  - センターライズ → centerrise.png
  - リンクサポート → linksupport.png
  - ARATA → arata.png
  - たいよう → taiyou.png
  - 壱 → ichi.png

該当箇所: tab-2-financial-summary.html の .gf-corp-icon 内 <span>🌸</span> 等を <img> に置換。

### 3-4. ワンビュー初期スクロール位置 0 化
横スクロール時に法人名カラムが見えない問題への対処。
JS で document.getElementById('oneview-scroll').scrollLeft = 0; を初期化、
または .gf-corp-col に position: sticky; left: 0; を付与して固定。

## 🟡 推奨 1 件（UX 改善）

### 3-5. レーダー軸順序を mock 通りに
mock 通常版の軸順: 売上 / 成長率 / 営業利益 / 自己資本比率 / 従業員数 / 粗利率
HTML 現状: ['売上', '営業利益', '粗利率', '従業員数', '自己資本比率', '成長率']

修正後: ['売上', '成長率', '営業利益', '自己資本比率', '従業員数', '粗利率']
データ配列も同じ順序で並び替え（6 法人 × 6 値）。

## 🟢 軽微 1 件（許容範囲、できれば修正）

### 3-6. v1 数値スケール維持
HTML は v1 ベースなので現状維持で OK（v2 ではない）。
- y: { max: 25000000 } 月次スケール維持
- 月次/四半期/年次トグル UI のみで、データ実装は後続

# 4. 流用継続（変更なし、tab-1 同一）

- ヘッダー（.topbar、外部 CSS 参照 ../../../015_Gardenシリーズ/000_GardenUI_bloom/06_CEOStatus/css/style.css）
- 左サイドバー（.sidebar.sidebar-dual、active を tab-2 に）
- 右 Activity Panel（Forest 内容 6 件）
- CSS 変数（gf-* / 6 法人カラー）
- gfShinkouGlow / gfFadeUp keyframe
- MutationObserver JS（背景保持）
- 背景レイヤー（Forest 画像）
- Chart.js CDN

# 5. 厳守事項

- ウサギ描画なし
- 6 法人カラー厳守（ヒュアラン #F4A6BD / センターライズ #8E7CC3 / リンクサポート #4A6FA5 / ARATA #E8743C / たいよう #F9C846 / 壱 #C0392B）
- mock v1 踏襲（独自セクション追加禁止）

# 6. 配置先（変更なし、上書き）

G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\garden-forest\html_drafts\tab-2-financial-summary.html

# 7. 期待する応答形式（forest-html-10）

冒頭 3 行: 番号 + 元→宛先 + 発信日時
ラップ: ~~~（投下用短文部分）
本体:
- 件名（簡潔）
- 修正概要（表形式、6 件の修正内容と該当箇所）
- HTML 全文（コードブロックで包含）
- self-check 項目（mock 踏襲 / ウサギなし / 6 法人カラー / MutationObserver 含有 / 6 法人アイコン PNG 化）

形式厳守、自然会話形式禁止。

# 8. 緊急度
🟡 中（5/12 デモ前推奨、tab-3 起草前に tab-2 完成）
~~~

---

## 詳細（参考、投下対象外）

発信日時: 2026-05-09(土) 21:15
発信元: a-main-017
宛先: claude.ai chat（Garden UI 021）
緊急度: 🟡 中

## 経緯

- 5/9 17:58 forest-html-9 で tab-2 初版起草
- 5/9 18:00 main 配置代行
- 5/9 20:25 東海林さん視覚確認 →「むちゃくちゃ」評価
- 5/9 19:25 main- No. 176 で a-review に UI 視覚評価兼任依頼 → review-8 受諾
- 5/9 20:30 main- No. 177 で a-review に tab-2 視覚評価依頼
- 5/9 21:15 review-9 で 8 件修正項目特定（# 1, # 2 は誤判定、# 3-8 妥当）
- 5/9 21:15 main- No. 180（本 dispatch）= claude.ai に v1 mock 基準で 6 件修正依頼

## review-9 # 1, # 2 誤判定について

a-review が「外部 CSS 06_CEOStatus/ 物理不在」と判定したが、a-main-017 確認結果:
- ls で `015_Gardenシリーズ/000_GardenUI_bloom/06_CEOStatus/` 実在確認
- tab-1 完成版が同じパスで動作中
- → a-review 誤判定、main- No. 181 で再評価指示中

## 関連 dispatch

- main- No. 175（5/9 17:47）= tab-2 初版起草指示
- forest-html-9（5/9 17:58）= tab-2 初版起草完了
- main- No. 177（5/9 20:30）= a-review に tab-2 視覚評価依頼
- review-9（5/9 21:15）= 視覚評価結果
- main- No. 181（5/9 21:20 起草予定）= a-review に # 1, # 2 誤判定指摘 + 再評価依頼
- main- No. 180（本 dispatch）= claude.ai に修正指示

## 改訂履歴

- 2026-05-09 21:15 初版（a-main-017、v5.1 ルール準拠 = ~~~ 内コードブロックなし）
