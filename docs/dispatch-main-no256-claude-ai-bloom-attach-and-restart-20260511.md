~~~
🔴 main- No. 256
【a-main-021 から claude.ai（Garden UI 021 chat）への dispatch】
発信日時: 2026-05-11(月) 13:50

# 件名
forest-html-17 受領（一時停止中、Bloom 添付待機）+ 案 A 採用（Bloom 2 ファイル全文添付）+ 番号再付番 OK（17=判断仰ぎ消費、18/19/20=tab-1/2/3 修正本体）+ 添付完了次第 forest-html-18 から起草開始

# A. forest-html-17 受領

[一時停止中] 明示 + 厳しい目で再確認 6 ラウンド実施 + Bloom 真祖先 baseline 2 件添付待機、ありがとうございます。

main- No. 249 §D「claude.ai 側で直接参照」の前提が claude.ai 環境（Drive コネクタ書き込み専用）と不整合、添付ルート必要との指摘 = 妥当。main- No. 226 時と同じ制約、東海林さん添付ルートで解決。

# B. 案 A 採用（全文添付 2 件）

判断 1 への回答: **案 A（推奨）採用**。

| # | ファイル | 用途 | 添付方法 |
|---|---|---|---|
| 1 | `G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\015_Gardenシリーズ\000_GardenUI_bloom\03_Workboard\index.html` | **主参照**（activity-panel + activity-toggle + topbar + sidebar、line 248-345 重要）| 東海林さんが claude.ai chat に直接アップロード |
| 2 | `G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\015_Gardenシリーズ\000_GardenUI_bloom\06_CEOStatus\index.html` | 副参照（page-favorite-btn line 255-258 + JS line 1510）| 同上 |

# C. 番号再付番 OK

判断 2 への回答: **番号再付番 OK**。

| 番号 | 内容 |
|---|---|
| forest-html-17 | 本受領確認 + 判断仰ぎ消費（5/11 13:34 発信）|
| **forest-html-18**（予約）| **tab-1 修正版**（既存 tab-1-dashboard.html を 4 項目修正で上書き）|
| **forest-html-19**（予約）| **tab-2 修正版**（forest-html-15 ベースに 4 項目修正）|
| **forest-html-20**（予約）| **tab-3 修正版**（forest-html-16 ベースに 4 項目修正、パターン B + 4 セクション保持）|

a-review 側も同パターンで番号調整（review-15/16 = 受領確認消費、review-17 = 修正版評価）= 整合性 OK。

# D. tab-1 既稼働の再添付について

判断 3 への回答: **tab-1 既稼働は既メモリで OK**（再添付不要）。forest-html-14 で添付済の tab-1-dashboard.html を baseline として使用、`gf-summary-card` 定義値も既メモリで保持。

ただし、起草中に tab-1 既稼働の特定箇所（例: page-favorite-btn の topbar 内具体配置）の確認が必要な場合、claude.ai 側で明示要請 → 東海林さん経由で再添付（main- No. 後続候補）。

# E. 必要な情報まとめ（Bloom 添付完了後の起草に必要なもの）

main- No. 249 v2 + 本 dispatch + Bloom 2 ファイル添付 = 全件揃う:

| 必要情報 | source |
|---|---|
| 修正 4 項目仕様 | main- No. 249 v2（既受領）|
| Bloom 真祖先 baseline 構造（03_Workboard + 06_CEOStatus）| **本 dispatch + 東海林さん添付（次メッセージ）**|
| tab-1 既稼働構造 | forest-html-14 既メモリ |
| パターン B データ + 4 セクション保持 | forest-html-16 既メモリ |
| 6 法人カラー + Forest 緑系 + レスポンシブ | forest-html-15/16 既メモリ |

# F. 起草手順（3 ターン分割、添付完了後）

| ターン | dispatch | 内容 |
|---|---|---|
| 1 | forest-html-18 | tab-1 修正版（tab-1-dashboard.html を 4 項目修正で上書き）+ ~~~ + ` ```html` 全文転送 + self-check 10 項目 |
| 2 | forest-html-19 | tab-2 修正版（forest-html-15 ベースに 4 項目修正）+ 同 |
| 3 | forest-html-20 | tab-3 修正版（forest-html-16 ベースに 4 項目修正、パターン B + 4 セクション保持）+ 同 |

各 dispatch = 1 tab、応答長制限抵触回避のため 3 ターン分割、main 側で順次配置 + 物理確認 + a-review review-17 依頼の流れ。

# G. 必須遵守事項（main- No. 249 v2 §F の 10 件、再確認）

| # | 項目 |
|---|---|
| 1 | activity-toggle ボタン追加（Bloom 03_Workboard line 285-288 + JS line 16/34 完全踏襲）|
| 2 | activity-title「Today's Activity」**英語化** |
| 3 | activity-icon **画像 `<img>` 化**（bloom_xxx.png アイコンパック使用）|
| 4 | activity-time **絶対時刻化**（「11:30」形式）|
| 5 | page-favorite-btn 追加（Bloom 06_CEOStatus line 255-258 完全踏襲）|
| 6 | gf-card → gf-summary-card 一括 rename + CSS 定義値 tab-1 準拠 |
| 7 | tab-1 既稼働構造維持（forest-html-15/16 維持）|
| 8 | 6 法人カラー / Forest 緑系 / レスポンシブ @max 1280px 維持 |
| 9 | Root → Forest ミラー HTML コメント保持（tab-3 `<main>` 直前）|
| 10 | tab-3 パターン B データ修正 + 4 セクション完全保持 |

# H. 緊急度

🔴 高（後道さんデモ前 critical path、5/12 デモ前完成必須、Bloom 添付次第即起草着手）

# I. 報告フォーマット（forest-html-18/19/20）

各 forest-html- 報告で:
- 冒頭 3 行 = 番号 + 元→宛先 + 発信日時、~~~ 内配置（v5.2 準拠）
- ~~~ ラップ + ネスト不使用 + コードブロック以外不使用
- HTML 全文を ` ```html ~ ``` ` ブロック内
- 必須遵守 10 件チェックリスト（§G）+ self-check
- 状態冒頭明示（[稼働中、ガンガンモード継続]、~~~ 外）
- Bloom 03_Workboard / 06_CEOStatus 参照済明示

# self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1/v5.2 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A: forest-html-17 受領
- [x] B: 案 A 採用（Bloom 2 ファイル添付、フルパス明示）
- [x] C: 番号再付番 OK（17 消費、18/19/20 で tab 修正）
- [x] D: tab-1 既稼働 再添付不要
- [x] E: 必要情報 source 整理
- [x] F: 3 ターン分割起草手順
- [x] G: 必須遵守 10 件再確認
- [x] 緊急度 🔴 明示
- [x] 番号 = main- No. 256（counter 継続）
~~~
