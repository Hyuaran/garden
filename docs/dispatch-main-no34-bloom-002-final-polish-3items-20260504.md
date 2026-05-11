# main- No. 34 dispatch - a-bloom-002 視覚一致最終仕上げ 3 項目 - 2026-05-04

> 起草: a-main-011
> 用途: bloom-002- No. 16 後の残課題 3 件（boxShadow 削除 + Series ロゴ全画面統一 + Activity Panel toggle 挙動）
> 番号: main- No. 34
> 起草時刻: 2026-05-04(月) 19:09
> 緊急度: 🔴 5/8 デモ向け視覚一致最終仕上げ
> 背景: 東海林さん目視確認 + a-main-011 DOM 検証で 3 項目残課題特定

---

## 検証結果サマリ（main- No. 33 後）

| 項目 | 状態 |
|---|---|
| Sidebar 幅 236px | ✅ 完璧（toggle と接触）|
| Activity Panel 配置（top/width/height/borderRadius）| ✅ 完璧 |
| **Activity Panel boxShadow** | 🔴 **残存（経営状況 none、Bloom Top に影あり）**|
| ロゴ /bloom Topbar | ✅ 480×160 公式フルロゴ表示 |
| **Series ロゴ全画面統一** | 🔴 **/_proto/login/, /_proto/garden-home-spin/, ① 事務用が古い可能性**|
| **Activity Panel 閉じ開き挙動** | 🔴 **Bloom Top: toggle と panel が別々動き / 経営状況: 一体動き** |

---

## 投下用短文（東海林さんが a-bloom-002 にコピペ）

~~~
🔴 main- No. 34
【a-main-011 から a-bloom-002 への dispatch（最終仕上げ 3 項目：boxShadow + Series ロゴ統一 + toggle 挙動）】
発信日時: 2026-05-04(月) 19:09

bloom-002- No. 16 + 東海林さん目視確認 + a-main-011 DOM 検証で残課題 3 件特定。
最終仕上げ依頼します。

【# A: Activity Panel boxShadow 削除（🔴 必須）】

a-bloom-002 報告で「box-shadow: none」と記述ありましたが、実機 DOM では
依然として影が残存:

```
boxShadow: "rgba(120, 100, 70, 0.18) 0px 12px 40px 0px"  ← 残存
期待: none（経営状況と一致）
```

考えられる原因:
1. LEGACY セクション内の旧 rule が specificity で勝っている
2. 別ファイル（bloom-page.css 等）の rule が優先
3. `!important` 付きの古い rule

修正手順:
1. DevTools で .activity-panel の Computed styles 確認、box-shadow を上書きしている rule 特定
2. 該当 rule 削除 or `box-shadow: none !important` で強制上書き
3. 修正後 DOM で `boxShadow: "none"` 確認

【# B: Series ロゴ全画面統一（🔴 必須、東海林さん指摘）】

東海林さん指摘:「Seriesロゴがかわっていない」

a-main-011 検証:
- /bloom の Topbar: ✅ 480×160 公式フルロゴ表示済（main- No. 33 で完了）
- /_proto/login/, /_proto/garden-home-spin/, ① 事務用: **未確認、古いロゴの可能性大**

修正手順:
1. 各画面のロゴ画像 path 確認:
   - `public/_proto/login/index.html` 内のロゴ（topbar-brand or header）
   - `public/_proto/garden-home-spin/index.html` 内のロゴ
   - `public/_proto/garden-home/index.html`（① 事務用）内のロゴ
   - `public/_proto/bloom-top/index.html`（② プロト）内のロゴ
   - `public/_proto/ceostatus/index.html` 内のロゴ（main- No. 32 で配置済、確認のみ）
2. 各画面で表示される Series ロゴ画像を **Drive 公式版（122KB / 480×160）** に統一:

```bash
# Drive 公式版（同一ファイル、3 箇所に存在）
SRC="/g/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/015_Gardenシリーズ/000_GardenUI/images/logo/garden_logo.png"

# 各 _proto/ 配下の logo を上書き（旧版 legacy 保持）
for dir in login garden-home-spin garden-home bloom-top ceostatus; do
  TARGET="public/_proto/$dir/images/logo/garden_logo.png"
  if [ -f "$TARGET" ]; then
    cp "$TARGET" "${TARGET%.png}.legacy-square-20260504.png"
    cp "$SRC" "$TARGET"
  fi
done
```

3. 各画面で `Ctrl+Shift+R` 後に Topbar ロゴが横長フルロゴ（木 + Garden Series + tagline）になっているか確認

【# C: Activity Panel 閉じ開き挙動（🔴 必須、東海林さん指摘）】

東海林さん指摘:「右サイドバーの閉じ開きのときの見た目が、閉じる部分と Today's Activity が
別々に分かれて閉じ開きしている。経営状況のページのサイドバーは正常な動き」

現状（Bloom Top）:
- activity-toggle ボタンと activity-panel 本体が **別々のアニメーション**
- 視覚的に「分離」して動く

期待（経営状況準拠）:
- toggle ボタンと panel が **一体的に動く**（同じ transition / transform）
- 視覚的に滑らかな閉じ開き

修正手順:
1. プロト `public/_proto/bloom-top/css/style.css` and `public/_proto/ceostatus/css/style.css` で
   `.activity-toggle` と `.activity-panel` の transition / transform 設定を確認
2. Bloom Top の globals.css で同じ設定を再現
3. JS（toggle クリック時の class 切り替えタイミング）を比較
4. 経営状況の挙動と完全一致まで調整

確認ポイント:
- toggle と panel に同じ `transition-duration` / `transition-timing-function`
- toggle の position（panel 内 fixed positioning か、panel 外 absolute か）
- collapse class の付与位置（共通 parent or 個別）

【削除禁止ルール継続】

- 既存 .legacy-* ファイル保持
- 今回の修正で .tsx / .css 更新する場合、再度 legacy 保持
  例: globals.legacy-final-polish-20260504.css
- Drive 元（_chat_workspace/, 015_Gardenシリーズ/）は読み取りのみ

【視覚一致検証フロー】

a-main-011 が Chrome MCP で修正後再 DOM 取得 + 動作確認。

検証項目:
1. # A: /bloom の Activity Panel boxShadow = "none"
2. # B: 全 _proto/ 配下の Series ロゴが naturalW 480 / naturalH 160
3. # C: Activity Panel toggle クリック時の閉じ開きが滑らか（経営状況と同等）

【完了報告フォーマット】

bloom-002- No. 17 で:
- commit hash + push 状態
- # A boxShadow 削除（CSS 変更箇所 + DOM 確認）
- # B Series ロゴ統一（差替ファイル一覧）
- # C toggle 挙動修正（CSS / JS 変更箇所 + 動作確認）
- legacy 保持ファイル（追加分）
- 完了時刻

【補足: 5/8 デモ品質保証】

memory feedback_demo_quality_must_match_production.md 準拠。
本 dispatch 完了で「① /bloom が経営状況と完全視覚一致」+「全画面 Series ロゴ統一」
達成。5/8 後道さんデモ品質保証。

【dispatch counter】

a-main-011: 次 main- No. 35
a-bloom-002: bloom-002- No. 17 で完了報告予定

工数見込み: 1.5-2h（# A 30 分、# B 30 分、# C 30-60 分）

ご対応お願いします。
~~~

---

## 配布手順（東海林さん）

| Step | 内容 |
|---|---|
| 1 | 上記 `~~~` 内をコピー |
| 2 | a-bloom-002 / Garden Bloom 002 セッションに貼り付け投下 |

→ a-bloom-002 が修正 + push → a-main-011 が Chrome MCP で再検証 → 視覚一致達成 → 東海林さん最終 OK。

## 改訂履歴

- 2026-05-04 19:09 初版（a-main-011、bloom-002- No. 16 + 東海林さん目視確認後、boxShadow 残存 + Series ロゴ未統一 + Activity Panel toggle 挙動 の 3 件を一括起草）
