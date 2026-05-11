# proposal v5.2: claude.ai snapshot 同期案（instructions / procedures v5.1 → v5.2）

> 起草: a-analysis-001
> 起草日時: 2026-05-11 (月) 10:48
> 用途: claudeai-instructions-snapshot-20260509.md / claudeai-procedures-snapshot-20260509.md の v5.1 → v5.2 関連箇所改訂案
> 起点: main- No. 217（claude.ai snapshot 同期案 起草依頼）
> 状態: ドラフト、main + a-audit-001 critique + 東海林さん最終決裁後に main が完全版 .md 発行 → 東海林さんが claude.ai 指示・手順を全置換ペースト

---

## 同期方針

三点セット同期 v2（memory feedback_three_way_sync_cc_claudeai_procedure）準拠:
- ブロック 1: Claude Code memory 改訂（feedback_dispatch_header_format v5.2 + feedback_self_memory_audit_in_session sentinel # 6）
- ブロック 2: claude.ai「Claudeへの指示」全置換ペースト用 v4 完全版 .md（main 発行）
- ブロック 3: claude.ai プロジェクト「手順」全置換ペースト用 v4 完全版 .md（main 発行）

本ドラフトでは **ブロック 2 / 3 の v5.1 → v5.2 関連箇所のみ diff 提示**。完全版 v4 .md 発行は main + 東海林さん最終決裁後に。

---

## ブロック 2: claudeai-instructions-snapshot v5.1 → v5.2 改訂箇所

### 改訂箇所 # 1: `## dispatch 形式 v5（2026-05-09 強化）` セクション

#### 現行（v5.1 相当、snapshot 行 113-131）

```
## dispatch 形式 v5（2026-05-09 強化）

main から claude.ai への dispatch は冒頭に以下を明示する形式に変更:

```
🚨 dispatch 発行 🚨 緊急度: 🟡

投下先: claude.ai chat「Garden UI 021」
ファイル: [filename.md](path)
別途添付必要データ: なし / あり（あり時はフルパス記載）
```

コピペ本体は md ファイル経由でコピー（チャット内に出さない）。

claude.ai が main へ報告する dispatch（report-、forest-html- 等）は:
- 冒頭 3 行: 番号 + 元→宛先 + 発信日時
- ~~~ ラップ
- 自然会話形式禁止
- 緊急度マーク 🟢🟡🔴 併記
- 末尾に self-check 項目
```

#### 改訂版（v5.2）

```
## dispatch 形式 v5.2（2026-05-11 強化、v5.1 から拡張）

main から claude.ai への dispatch は冒頭に以下を明示する形式:

🚨 dispatch 発行 🚨 緊急度: 🟡

投下先: claude.ai chat「Garden UI 021」
ファイル: [filename.md](path)
別途添付必要データ: なし / あり（あり時はフルパス記載）

コピペ本体は md ファイル経由でコピー（チャット内に出さない）。

claude.ai が main へ報告する dispatch（report-、forest-html- 等）は v5.2 形式:
- 冒頭 3 行（番号 + 元→宛先 + 発信日時）は **~~~ 内配置必須**（違反 9 禁止）
- ~~~ ラップ
- ~~~ 内に **同記号繰返しブロック（~~~ / バッククォート 3 個）禁止**（違反 7 / 7-b、コピペ分断防止）
- 自然会話形式禁止
- 緊急度マーク 🟢🟡🔴 併記
- 末尾に self-check 項目
- HTML / コード例を提示する場合は外ラップ ~~~ を撤廃してから ` ```html ~ ``` ` ブロック使用、または別 md ファイル化（dispatch 本体と分離）

雛形ベストプラクティス（v5.2 新規）:
- dispatch 内に報告フォーマット雛形を提示する場合、### サブヘッダー + 通常 markdown（表 / 箇条書き / 引用ブロック `>`）で記述
- ~~~ ネスト + コードブロックは雛形提示でも使わない
```

---

## ブロック 3: claudeai-procedures-snapshot v5.1 → v5.2 改訂箇所

### 改訂箇所 # 1: シナリオ 2-4「mock 画像直接添付フロー」内 dispatch 形式記述

#### 現行（snapshot 行 79-86）

```
手順:
1. 東海林さんが ChatGPT で mock 画像生成
2. 東海林さんが claude.ai chat に mock 画像を直接アップロード + main からの dispatch 短文をコピペ
3. claude.ai が画像を直接見て HTML 起草
4. dispatch 形式（~~~ ラップ + ` ```html ~ ``` ` ブロック）で全文転送
5. main が配置代行 + 仕様レイヤー評価
6. 東海林さん視覚評価 → OK / 修正点を直接対話で詰める
```

#### 改訂版（v5.2）

```
手順:
1. 東海林さんが ChatGPT で mock 画像生成
2. 東海林さんが claude.ai chat に mock 画像を直接アップロード + main からの dispatch 短文をコピペ
3. claude.ai が画像を直接見て HTML 起草
4. HTML 全文転送方法（v5.2、最重要）:
   - 外ラップ ~~~ 内に HTML を直接記述しない（違反 7、コピペ分断防止）
   - HTML 全文は **別 md ファイル化**（_chat_workspace 配下、命名規則 chat-ui-...）で配置 → dispatch 本体は配置済 md へのファイルパス言及のみ
   - or 外ラップ ~~~ を撤廃 → 通常 markdown 文書として ` ```html ~ ``` ` で HTML 提示
5. main が配置代行 + 仕様レイヤー評価
6. 東海林さん視覚評価 → OK / 修正点を直接対話で詰める
```

### 改訂箇所 # 2: シナリオ 4-3「報告フォーマット（main への返信、v5 形式）」

#### 現行（snapshot 行 140-162）

```
## 4-3. 報告フォーマット（main への返信、v5 形式）

```
🟢 report- No. N
【作業日報セッション or claude.ai から a-main-NNN への [完了報告 / 質問 / 受領確認]】
発信日時: YYYY-MM-DD(曜) HH:MM

# 件名
（簡潔な件名）

# 内容（表形式・要点）
...

# self-check
- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] ~~~ ラップ
- [x] 自然会話形式禁止
- [x] HTML 全文を ```html ~ ``` で包含（HTML 起草時）
- [x] 添付画像のフルパス参照（dispatch 内に明記された場合）

判断保留 / 質問: なし or [内容]
```
```

#### 改訂版（v5.2）

```
## 4-3. 報告フォーマット（main への返信、v5.2 形式）

報告 dispatch は以下構造（雛形ベストプラクティス v5.2 準拠）:

### 構造（外ラップ ~~~ 内に通常 markdown のみ、~~~ ネスト + コードブロック禁止）

- 冒頭 3 行（外ラップ ~~~ 内に配置必須、違反 9 禁止）:
  - 行 1: 🟢 report- No. N（or forest-html-N / review-N 等の番号）
  - 行 2: 【作業日報セッション or claude.ai から a-main-NNN への [完了報告 / 質問 / 受領確認]】
  - 行 3: 発信日時: YYYY-MM-DD(曜) HH:MM
- 本文:
  - 件名（# 見出し）
  - 内容（表形式・要点、通常 markdown）
  - self-check（- [x] 箇条書き）
  - 判断保留 / 質問（なし or 内容、通常 markdown）

### HTML 全文転送が必要な場合（雛形ベストプラクティス）

- 外ラップ ~~~ 内に ` ```html ~ ``` ` 含めるのは v5.1 違反 → 禁止
- HTML 全文は別 md ファイル化（_chat_workspace 配下、chat-ui-... 命名）で配置 → dispatch 本体はパス言及のみ
- or 外ラップ ~~~ を撤廃 → 通常 markdown 文書として ` ```html ~ ``` ` で提示

### self-check（v5.2）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時、~~~ 内配置
- [x] ~~~ ラップ + ~~~ ネスト不使用 + コードブロック不使用
- [x] 自然会話形式禁止
- [x] HTML 全文は別 md ファイル化 or ~~~ 外配置
- [x] 添付画像のフルパス参照（dispatch 内に明記された場合）

判断保留 / 質問: なし or [内容]
```

### 改訂箇所 # 3: シナリオ 10「応答出力前 5 項目セルフチェック」→ 6 項目化

#### 現行（snapshot 行 262-276）

```
# シナリオ 10: 応答出力前 5 項目セルフチェック（2026-05-09 追加）

## 10-1. 起点

すべての応答テキスト書き始める前。

## 10-2. 5 項目チェック

1. 状態確認: ガンガン稼働中 / 一時停止中？
2. 提案 / 報告？ → ラウンド点検発動
3. dispatch 起草？ → 投下情報冒頭明示
4. ファイル参照ある？ → 実物存在確認
5. 既存実装関与？ → 議論前 / 修正前 / 外部依頼前確認

5 項目通過 → 応答出力可。
```

#### 改訂版（v5.2、6 項目化）

```
# シナリオ 10: 応答出力前 6 項目セルフチェック（2026-05-11 v5.2、5 項目から拡張）

## 10-1. 起点

すべての応答テキスト書き始める前。

## 10-2. 6 項目チェック（v5.2、a-audit-001 audit-001- No. 2 提案 3 起源）

1. 状態確認: ガンガン稼働中 / 一時停止中？
2. 提案 / 報告？ → ラウンド点検発動
3. dispatch 起草？ → 投下情報冒頭明示
4. ファイル参照ある？ → 実物存在確認
5. 既存実装関与？ → 議論前 / 修正前 / 外部依頼前確認
6. **dispatch 起草時、外ラップ ~~~ 内に同記号繰返しブロック（~~~ / バッククォート 3 個）が含まれていないか目視確認 + 冒頭 3 行が ~~~ 内配置になっているか確認**（v5.2、違反 7-b / 9 防止）

6 項目通過 → 応答出力可。
```

---

## 東海林さん貼付指示テキスト（main + 東海林さん最終決裁後、完全版 v4 .md 発行時に併記）

main が claude.ai に提示する完全版 v4 .md（instructions + procedures）に以下指示を併記推奨:

「claude.ai プロジェクトの『Claudeへの指示』と『手順』を v3 から v4 に全置換ペーストでお願いします。

- ブロック 1（CC memory）: a-main-020 が確認した上で memory ファイル 3 件を上書き済
- ブロック 2（claude.ai 指示）: 添付の claudeai-instructions-v4-20260511.md を全文コピー → claude.ai プロジェクトの『Claudeへの指示』を全選択削除 → 全文ペースト
- ブロック 3（claude.ai 手順）: 添付の claudeai-procedures-v4-20260511.md を全文コピー → claude.ai プロジェクトの『手順』を全選択削除 → 全文ペースト

3 ブロック完了報告後、main が snapshot ファイル 2 件（claudeai-instructions-snapshot-20260511.md / claudeai-procedures-snapshot-20260511.md）を上書き → _archive/claudeai-versions/ に v3 を退避」

---

## 差分サマリ

| ブロック | 改訂箇所数 | 内容 |
|---|---|---|
| ブロック 2（instructions）| 1 | dispatch 形式 v5 → v5.2 セクション拡張 |
| ブロック 3（procedures）| 3 | mock 画像直接添付フロー手順 4 改訂 / 報告フォーマット 4-3 改訂 / 5 項目 → 6 項目化（シナリオ 10）|

---

## 自己参照禁止 抵触検証

- claude.ai snapshot 改訂 = 全 session 共通ルール改訂、a-analysis 自身の運用変更ではない（抵触なし）
- ただし claude.ai が a-analysis / a-audit を直接補佐するシナリオは現状なし、a-analysis 起草の dispatch が claude.ai 起点ではない = 当事者性低
- 例外: 三点セット同期 v2 で「a-analysis が claude.ai 指示・手順更新案を併起草」と設計書 §4-5 で規定 = a-analysis 機能の本旨 = 抵触なし

---

## 改訂履歴

- 2026-05-11 10:48 ドラフト初版（a-analysis-001、main- No. 217 起源、提案 1+2+3 統合のうちブロック 2/3 同期分担当）
