# dispatch main- No. 319 — a-tree-002 へ npm install 5 種承認 GO + plan §0 Task 0 Step 0.2 軽微整合改訂 GO

> 起草: a-main-023
> 用途: tree # 31-ack3 質問 2 件への回答、東海林さん 19:06 採択 A（5 種全承認）+ 軽微 plan 改訂 GO
> 番号: main- No. 319
> 起草時刻: 2026-05-11(月) 19:06

---

## 投下用短文（東海林さんがコピー → a-tree-002 にペースト）

~~~
🟢 main- No. 319
【a-main-023 から a-tree-002 への dispatch（npm install 5 種承認 GO + plan §0 Task 0 Step 0.2 軽微整合改訂 GO）】
発信日時: 2026-05-11(月) 19:06

# 件名
🟢 tree # 31-ack3 質問 2 件 東海林さん 19:06 採択 A = npm install 5 種（sonner / @testing-library/user-event / @axe-core/playwright / @lhci/cli / k6）全承認 GO + plan §0 Task 0 Step 0.2 軽微整合改訂 GO

# A. 採択結果

| # | 質問 | 採択 |
|---|---|---|
| 1 | npm install 5 種承認 | 🟢 全承認 GO（5 種すべて）|
| 2 | plan §0 Task 0 Step 0.2 整合性対応 | 🟢 軽微 plan 改訂で対応（is_same_department → auth_employee_number + has_role_at_least 2 関数のみ確認に縮退）|

# B. npm install 5 種 全承認 GO 詳細

| パッケージ | 用途 | 承認 |
|---|---|---|
| sonner | 通知 UI ライブラリ | ✅ |
| @testing-library/user-event | 自動テスト操作シミュレータ | ✅ |
| @axe-core/playwright | アクセシビリティ自動テスト | ✅ |
| @lhci/cli | Lighthouse パフォーマンステスト | ✅ |
| k6 | 負荷テストツール | ✅ |

採択根拠:
- 5 種すべてテスト系 / UI 通知系で本番動作への影響なし
- §16 7 種テスト遂行（機能網羅 / エッジケース / 権限 / データ境界 / パフォーマンス / コンソールエラー / アクセシビリティ）に必要
- Tree（コールセンター業務）の品質確保 = 5/18 critical path ⑥ 完成に直結

# C. plan §0 Task 0 Step 0.2 軽微整合改訂

| 項目 | 内容 |
|---|---|
| 改訂対象 | plan v3.1 §0 Task 0 Step 0.2「is_same_department 関数存在確認」|
| 改訂後 | 「auth_employee_number + has_role_at_least 2 関数のみ確認」（is_same_department は PR #154 で縮退済）|
| 改訂タイプ | 軽微（plan v3.2 として軽微 commit）|
| 影響範囲 | §0 Task 0 進行に影響なし、本改訂で Task 0 Step 0.2 即着手可 |

# D. Task 0 即着手スケジュール（tree # 31-ack3 提示）

| 時刻 | Task | 内容 |
|---|---|---|
| 19:06-19:20 | Task 0 | 新ブランチ派生 + Batch 7 関数確認 + plan §0 Step 0.2 軽微改訂 |
| 19:20-19:30 | Task 1 環境変数 + npm install 5 種 | 承認済の 5 種実行 |
| 19:30-19:45 | Task 2 effort-tracking | 予定 11 行追記 |
| 19:45-19:50 | §0 完成 + 完成報告 | tree-002- No. NN |

→ §0 完走見込み 19:50（tree 提示 19:35-19:40 とほぼ同等）+ 5/12 朝 §1 D-01 schema migration 着手可能。

# E. ガンガン本質遵守

tree # 31-ack3 で「100 分遅延を素直に自己診断、Phase D 70 task 着手 GO 後 100 分実着手なし = ガンガン本質違反」と認知あり。本 dispatch 受領後の即着手で挽回 + 今後の遅延防止策（30 分巡回 v2 で監視継続）。

# F. ACK 形式（軽量、tree-002- No. NN）

| 項目 | 内容 |
|---|---|
| 1 | # 319 受領確認 |
| 2 | npm install 5 種承認内化 + 即実行宣言 |
| 3 | plan §0 Task 0 Step 0.2 軽微改訂着手宣言 |
| 4 | §0 完走 ETA |

# G. self-check
- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A 採択 / B npm 5 種詳細 / C plan 改訂 / D スケジュール / E ガンガン本質 / F ACK
- [x] 起草時刻 = 実時刻（19:06）
- [x] 番号 = main- No. 319
~~~

---

## 詳細（参考、投下対象外）

### 連動

- tree # 31-ack3（5/11 18:52、Phase D §0 進捗確認 + 質問 2 件提起）
- # 314（5/11 18:50、Phase D §0 進捗確認）
- # 290（5/11 17:10、Tree D-01 apply 完了 + Phase D §0 解放 + 70 task GO）
