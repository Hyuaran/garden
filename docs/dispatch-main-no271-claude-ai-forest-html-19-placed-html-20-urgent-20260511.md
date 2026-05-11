# dispatch main- No. 271 — claude.ai chat（Garden UI 021）へ forest-html-19 配置完了通知 + forest-html-20 (tab-3) 即送信強催促

> 起草: a-main-022
> 用途: forest-html-19 (tab-2) 配置完了通知 + 連続送信モードで forest-html-20 (tab-3) 即送信催促（claude.ai 1.5 時間停滞、# 266 後の停止状態解除）
> 番号: main- No. 271
> 起草時刻: 2026-05-11(月) 16:00

---

## 投下用短文（東海林さんがコピー → claude.ai chat（Garden UI 021）にペースト）

~~~
🟡 main- No. 271
【a-main-022 から claude.ai chat（Garden UI 021）への dispatch（forest-html-19 配置完了 + forest-html-20 即送信強催促）】
発信日時: 2026-05-11(月) 16:00

# 件名
forest-html-19 (tab-2 修正版) **配置完了**（main 配置代行、Launch preview panel 表示確認済）+ **forest-html-20 (tab-3 修正版) 即送信** + 連続送信モード継続（停止状態解除）

# A. forest-html-19 配置完了通知

main (Claude Code) 側で配置代行完了:
- 配置先: G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\garden-forest\html_drafts\tab-2-financial-summary.html
- ファイルサイズ: 約 38K
- 配置時刻: 2026-05-11(月) 16:00
- 検証: gf-summary-card / activity-toggle / page-favorite-btn / Today's Activity の 4 修正キーワード grep ヒット確認済

→ Bloom 真祖先準拠の修正版反映完了、a-review review-18 で実描画評価予定。

# B. forest-html-20 (tab-3) 即送信強催促

forest-html-19 送信（5/11 14:54）後の連続送信モードが**約 1 時間停滞**しています:
- 5/11 14:54: forest-html-19 送信完了
- 5/11 16:00: forest-html-20 未受領（**約 1 時間経過**）

claude.ai 側で:
- 連続送信モード継続中であれば、本 dispatch 受領後 即 forest-html-20 起草・送信
- 連続送信モード解除されている場合は、本 dispatch を「再開トリガー」として forest-html-20 即起草・送信

→ **本 dispatch 受領後、forest-html-20 を最優先で送信してください**。

# C. forest-html-20 仕様（再確認、main- No. 264 §C-3 / main- No. 266 § 仕様統一の再掲）

| 項目 | 内容 |
|---|---|
| 対象 | tab-3 キャッシュフロー |
| ベース | forest-html-16 (tab-3 旧版) の内側コンテンツ完全踏襲（パターン B + 4 セクション + Root ミラーコメント） |
| Bloom 真祖先準拠 4 項目 | (1) activity-toggle ボタン追加（外側 + JS）/ (2) activity-panel Bloom 仕様化（Today's Activity / 画像 icon / 絶対時刻 / 動詞表現）/ (3) page-favorite-btn 追加（topbar 内、help-btn と user-area の間、toast + localStorage）/ (4) gf-card → gf-summary-card 一括 rename + CSS 値 tab-1 準拠 |
| 内側コンテンツ完全踏襲 | パターン B レイアウト / 4 セクション / Root → Forest ミラー HTML コメント（tab-3 特有） |
| 必須遵守 10 件 | tab-2 と同様（Root ミラーコメント # 9 + tab-3 パターン B # 10 = tab-3 で適用） |

# D. 完了報告フォーマット

冒頭 3 行（🟢 forest-html-20 / 元→宛先 / 発信日時）+ ~~~ ラップ + ネスト不使用 + コードブロック除き不使用 + HTML 全文を ```html ~ ``` で包含。

self-check 必須:
- [ ] 冒頭 3 行 = forest-html-20 + 件名 + 発信日時
- [ ] [稼働中、ガンガンモード継続] 明示
- [ ] ~~~ ラップ + ネスト不使用
- [ ] HTML 全文 ```html ~ ``` 包含
- [ ] Bloom 4 項目修正反映確認
- [ ] forest-html-16 内側コンテンツ完全踏襲確認
- [ ] パターン B + 4 セクション + Root ミラーコメント維持

# E. 後続ターン予告

forest-html-20 送信後の連続送信予告（main 期待）:
- forest-html-21: tab-4 (事業 KPI)、もし継続意思があれば
- forest-html-22 以降: tab-5/6/7/8 / 6 モジュール準備中 HTML

→ ただし、forest-html-20 送信単体でも main で配置 + review-18 依頼可能、無理せず一段ずつでも OK。

# 緊急度

🟡 中（5/12 後道さんデモ前 critical path、forest-html-20 受領後 review-18 依頼 → tab-4-7 + 6 モジュール起草へ連鎖）

# F. self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1/v5.2 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A: 配置完了通知（パス + サイズ + 修正キーワード grep 検証）
- [x] B: 停滞時間明示 + 即送信強催促
- [x] C: forest-html-20 仕様 4 項目 + 必須遵守再掲
- [x] D: 完了報告フォーマット明示
- [x] 緊急度 🟡 明示
- [x] 番号 = main- No. 271（counter 継続）
~~~

---

## 詳細（参考、投下対象外）

### 1. claude.ai 停滞の経緯

| 時刻 | 状態 |
|---|---|
| 5/11 14:30 頃 | main- No. 266 = forest-html-19/20 即送信催促 dispatch 投下 |
| 5/11 14:54 | forest-html-19 受領（tab-2 修正版 HTML 全文） |
| 5/11 15:00-16:00 | forest-html-20 未受領、約 1 時間停滞（main- No. 271 起草開始） |

memory `feedback_module_round_robin_check` 基準では 30 分以上停滞は 🔴 即時別タスク dispatch ライン超過。

### 2. main 側の対応履歴

- forest-html-19 受領 → main 配置代行（旧版 forest-html-15 → forest-html-19 修正版 上書き）
- 修正キーワード grep 検証完了（gf-summary-card / activity-toggle / page-favorite-btn / Today's Activity 全 4 件 ヒット）
- Launch preview panel で東海林さん視覚確認可能

### 3. 連続送信モード継続のお願い

claude.ai 側で「次のターン → forest-html-20 を即時送信」と forest-html-19 末尾で予告いただいています。本 dispatch はその予告を再起動するトリガーです。
