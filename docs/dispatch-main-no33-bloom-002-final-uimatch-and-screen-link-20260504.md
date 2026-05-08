# main- No. 33 dispatch - a-bloom-002 視覚一致最終 4 項目 + 画面連結 - 2026-05-04

> 起草: a-main-011
> 用途: ① /bloom と ② /_proto/bloom-top の視覚一致を **真因 4 項目** で完全達成 + 画面連結（login → ② spin → bloom → ceostatus）
> 番号: main- No. 33
> 起草時刻: 2026-05-04(月) 17:56
> 緊急度: 🔴 5/8 デモまで残り 4 日、5/8 デモ向け最終仕上げ
> 背景: bloom-002- No. 15 完了報告後、a-main-011 が東海林さんスクショ + DOM 詳細比較で 3 つの真因特定

---

## 重要な前提（東海林さん 2026-05-04 指摘）

東海林さん指摘:
1. 「左側のサイドバーの幅が折り畳み箇所に届いていない」
2. 「右側のサイドバーはカード化したまま、その上に折り畳み箇所が重なってるでしょ」

a-main-011 が DOM 詳細比較で真因特定（数値付き）：

| 項目 | Bloom Top（NG）| 経営状況（OK）|
|---|---|---|
| Sidebar width | **210px**（toggle 236px から 26px 不足）| **236px**（toggle と接触）|
| Activity Panel borderRadius | **20px**（カード）| **0px**（フラット）|
| Activity Panel boxShadow | **影あり**（カード）| **none** |
| Activity Panel top | 193.99px（Topbar 余白）| 80px（Topbar 直下まで）|

加えて：

| 項目 | Bloom Top | Drive 公式 |
|---|---|---|
| garden_logo.png | **237KB / 500x500 正方形（木のみ）**| **122KB（公式フルロゴ：木 + Garden Series + tagline）**|

---

## 投下用短文（東海林さんが a-bloom-002 にコピペ）

~~~
🔴 main- No. 33
【a-main-011 から a-bloom-002 への dispatch（視覚一致最終 4 項目 + 画面連結）】
発信日時: 2026-05-04(月) 17:56

bloom-002- No. 15 受領、a-main-011 が DOM 詳細比較で真因 4 項目特定。
東海林さんスクショで「サイドバー幅 + Activity Panel カード化が経営状況と
違う」明示指摘あり。最終仕上げ依頼します。

【真因特定結果（DOM 値で完全比較済）】

| 項目 | Bloom Top（NG）| 経営状況（OK）|
|---|---|---|
| Sidebar width | **210px** | **236px** |
| Sidebar 右端 vs Toggle | 26px 隙間 ❌ | 接触 ✅ |
| Activity Panel borderRadius | **20px**（カード）| **0px** |
| Activity Panel boxShadow | **影あり** | **none** |
| Activity Panel top | 193.99px | 80px（Topbar 直下）|
| garden_logo.png サイズ | **237KB / 500x500 正方形** | **122KB / 横長フルロゴ** |

【# 1 Sidebar 幅拡大（🔴 必須）】

修正:

```css
.sidebar.sidebar-dual {
  width: 236px;  /* 210 → 236px、toggle (left:236px) と接触 */
}
```

ただし、nav-pages-collapsed 状態時は別の width が必要な可能性。
プロト（_proto/bloom-top/css/style.css）の値に厳密一致させてください。

確認: プロトの .sidebar.sidebar-dual width を grep で取得し、Bloom Top の
globals.css と比較・揃え。

【# 2 Activity Panel フラット化（🔴 必須）】

修正:

```css
.activity-panel {
  border-radius: 0;          /* 20px → 0、フラット化 */
  box-shadow: none;           /* カード影削除 */
  top: 80px;                 /* Topbar 直下まで広げる */
  height: calc(100vh - 80px); /* 高さ最大化 */
}
```

プロト準拠の値に厳密一致推奨。

【# 3 garden_logo.png 差し替え（🔴 必須）】

a-bloom-002 worktree の `public/images/logo/garden_logo.png` は
**237KB / 500x500 正方形（木のアイコンのみ）= 旧版**。

Drive 公式版（**122KB / 横長フルロゴ：木 + Garden Series + tagline**）に差替:

コピー元（同一画像が 3 箇所、どれでも OK）:
- `/g/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/015_Gardenシリーズ/000_GardenUI/images/logo/garden_logo.png`
- `/g/.../000_GardenUI_bloom/02_BloomTop/images/logo/garden_logo.png`
- `/g/.../000_GardenUI_bloom/06_CEOStatus/images/logo/garden_logo.png`

実行:

```bash
# 旧版 legacy 保持（削除禁止ルール準拠）
cp /c/garden/a-bloom-002/public/images/logo/garden_logo.png /c/garden/a-bloom-002/public/images/logo/garden_logo.legacy-square-20260504.png

# Drive 公式版に差替
cp "/g/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/015_Gardenシリーズ/000_GardenUI/images/logo/garden_logo.png" /c/garden/a-bloom-002/public/images/logo/garden_logo.png
```

差替後、`.topbar-brand-img` の CSS は既存（max-height: 60px; width: auto;
object-fit: contain）で OK、横長ロゴは縦 60px に縮小されて
width 200-250px 程度になる見込み。Topbar 内に納まる。

【# 4 画面連結（🟡 5/8 デモ向け）】

5/8 後道さんデモ向け、4 画面連結:
- ログイン → ② spin 版ホーム → Bloom Top → 経営状況

配置:

```bash
# login.html を public/_proto/login/ にコピー
mkdir -p public/_proto/login
cp "/g/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/_chat_workspace/garden-ui-concept/login.html" public/_proto/login/index.html
# 関連アセット（CSS/JS/画像）も含めて一式コピー

# garden-home.html (② spin 版) を public/_proto/garden-home-spin/ にコピー
mkdir -p public/_proto/garden-home-spin
cp -r "/g/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/_chat_workspace/garden-ui-concept/" public/_proto/garden-home-spin/

# ① 事務用 (000_GardenUI/index.html) を public/_proto/garden-home/ にコピー
mkdir -p public/_proto/garden-home
cp -r "/g/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/015_Gardenシリーズ/000_GardenUI/" public/_proto/garden-home/
```

連結:

| 画面 | リンク先 |
|---|---|
| login.html Enter ボタン | `/_proto/garden-home-spin/index.html`（② spin デフォルト）|
| ② spin の Bloom アイコンクリック | `/bloom`（① React 本番）or `/_proto/bloom-top/index.html`（② プロト）|
| Bloom Top の経営状況リンク | `/_proto/ceostatus/index.html`（main- No. 32 で配置済）|
| 経営状況の戻るボタン | `/_proto/garden-home-spin/index.html`（or 元の画面）|
| ① 事務用 → Bloom リンク | 同上 |

5/8 デモ運用想定:
- ログイン画面で「demo」「demo」入力 → Enter → ② spin 表示
- ② spin で Bloom クリック → Bloom Top 表示
- Bloom Top で経営状況クリック → 経営状況 表示
- 戻る → ② spin or Bloom Top

①は別途東海林さんが「事務用バージョンもあります」と説明しながら表示。

【削除禁止ルール継続】

- 既存 .legacy-* ファイル保持
- 今回の修正で .tsx / .css 更新する場合、再度 legacy 保持
  例: BloomSidebar.legacy-uimatch-20260504.tsx
- garden_logo.png 旧版は `garden_logo.legacy-square-20260504.png` で保持
- Drive 元（_chat_workspace/, 015_Gardenシリーズ/）は読み取りのみ、編集不可

【視覚一致検証フロー】

a-main-011 が Chrome MCP で修正後再 DOM 取得 → 4 項目すべて経営状況と
一致確認。

検証項目:
1. Sidebar width = 236px
2. Activity Panel borderRadius = 0、boxShadow = none、top = 80px
3. garden_logo.png サイズ = 122KB（122,419 bytes）
4. login → ② spin → bloom → ceostatus 動作確認

【完了報告フォーマット】

bloom-002- No. 16 で:
- commit hash + push 状態
- # 1 Sidebar 修正内容（CSS 変更箇所）
- # 2 Activity Panel 修正内容
- # 3 ロゴ差替（旧版 legacy パス + 新版サイズ確認）
- # 4 画面連結（コピーしたファイル + リンク変更箇所）
- legacy 保持ファイル（追加分）
- 完了時刻

【補足: デモ品質 = 本番品質】

memory feedback_demo_quality_must_match_production.md 準拠:
5/8 デモで ② を見せた後、本番 ① /bloom が劣化していると東海林さんの
評価が下がる。本 dispatch で ① も完全に経営状況と視覚一致させる。

【dispatch counter】

a-main-011: 次 main- No. 34
a-bloom-002: bloom-002- No. 16 で完了報告予定

工数見込み: 2-3h（# 1-2 各 30 分、# 3 10 分、# 4 1-2h）

ご対応お願いします。
~~~

---

## 配布手順（東海林さん）

| Step | 内容 |
|---|---|
| 1 | 上記 `~~~` 内をコピー |
| 2 | a-bloom-002 / Garden Bloom 002 セッションに貼り付け投下 |

→ a-bloom-002 が修正 + 画面コピー + push → a-main-011 が Chrome MCP で再検証 → ① と ② 視覚一致達成 → 東海林さん最終 OK。

## 改訂履歴

- 2026-05-04 17:56 初版（a-main-011、bloom-002- No. 15 + 東海林さんスクショ + DOM 詳細比較で真因 4 項目特定後、画面連結含めて起草）
