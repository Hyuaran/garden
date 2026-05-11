~~~
🟡 main- No. 217
【a-main-020 から a-analysis-001 への dispatch】
発信日時: 2026-05-11(月) 09:58

# 件名
audit-001- No. 2 提案 1 + 2 + 3 統合起草依頼（v5.1 → v5.2 + 雛形ベストプラクティス + sentinel 6 項目化）

# 1. ガンガンモード再開通知

東海林さん明示 GO（2026-05-11 09:50 受領）でガンガンモード解除、Garden 開発再開。

# 2. 経緯

audit-001- No. 2（~~~ ネスト違反 critique）で提案 1-4 を提示。東海林さん決裁:
- 提案 1: ✅ 採用、標準フロー §4-1（a-analysis 起草経由）
- 提案 2: ✅ 採用、緊急 bypass 可だが提案 1 と統合推奨
- 提案 3: ✅ 採用、緊急 bypass 可だが提案 1 と統合推奨
- 提案 4: ✅ 採用済（a-audit が実装、incident-pattern-log §4-2 拡張完了）

提案 1-3 は内容が連動するため、本 dispatch で **a-analysis に統合起草依頼**。

# 3. 統合起草対象

## 3-1. 提案 1: v5.1 → v5.2 文言改訂

### 3-1-1. governance §5 改訂

現行（governance-rules-v1-20260509.md §5 dispatch 形式 v5）:
- 「投下用短文 ~~~ ラップ内に **コードブロック（バッククォート 3 個）を入れてはいけない**」
- 「~~~ 内のコードブロックを ~~~ 外へ」

改訂案 v5.2:
- 「~~~ 外ラップ内に、~~~ または **同記号繰返しブロック**（バッククォート 3 個含む）を入れることを禁止（コピペ分断防止）」
- 違反 7（~~~ ネスト）+ 違反 9（冒頭 3 行 ~~~ 外配置）の両方を文言上明示

### 3-1-2. memory feedback_dispatch_header_format 改訂

| 項目 | 改訂内容 |
|---|---|
| name | dispatch / セッション間メッセージ 標準ヘッダー形式 **v5.2** |
| description | v5.2 改訂内容反映 |
| ルール表 | 「投下用短文 ~~~ 内の禁止事項」セクションで v5.2 表現に更新 |
| 改訂履歴 | 2026-05-11 v5.2 改訂、a-audit-001 audit-001- No. 2 提案 1 起源、a-analysis 起草経由、東海林さん最終決裁 |

### 3-1-3. handoff §A 決定 4 同期

handoff §A 重要決定 4「dispatch 形式 v5.1（投下情報冒頭明示 + コピペ md 経由 + ~~~ 内コードブロック禁止）」の改訂版を起草:
- 「dispatch 形式 v5.2（投下情報冒頭明示 + コピペ md 経由 + ~~~ 内同記号繰返しブロック禁止 + 冒頭 3 行 ~~~ 内配置）」

## 3-2. 提案 2: 雛形ベストプラクティス memory 追記

memory feedback_dispatch_header_format への追記候補:

「dispatch 内に報告フォーマット雛形（audit-001- No. NN 等）を提示する場合、~~~ ネスト + コードブロックは使わず以下方式で記述する:
- ### サブヘッダーで構造を示す
- 例示部分は通常 markdown 記述（表 / 箇条書き / 引用）
- HTML / コード例を示す必要がある場合は、外ラップを撤廃してから提示」

## 3-3. 提案 3: sentinel 5 → 6 項目化

memory feedback_self_memory_audit_in_session の sentinel チェック表に # 6 新設:

| # | チェック | 不通過時の動作 |
|---|---|---|
| 6 | **dispatch 起草時、外ラップ ~~~ 内に同記号繰返しブロック（~~~ / バッククォート 3 個）が含まれていないか目視確認** | YES → 違反、内側ラップ撤廃 → インデント記法 or 通常 markdown 記述に変更 |

# 4. a-analysis 起草スコープ

a-analysis-001 は以下を起草:

| # | 対象 | 起草内容 |
|---|---|---|
| 1 | governance-rules-v1-20260509.md §5 改訂版 | v5.2 文言（差分 diff 明示）|
| 2 | memory feedback_dispatch_header_format 改訂版 | v5.2 全文（既存 memory 上書き、改訂履歴追記）|
| 3 | memory feedback_self_memory_audit_in_session 改訂版 | sentinel # 6 追加（既存 memory 上書き）|
| 4 | handoff §A 決定 4 改訂版 | 既存 §A セクション（docs/handoff-017-018-section-a-content.md）の決定 4 部分のみ改訂 |
| 5 | claude.ai snapshot 同期案 | claudeai-instructions-snapshot / claudeai-procedures-snapshot の v5.1 → v5.2 関連箇所改訂案（東海林さん貼付指示テキスト併記）|

# 5. critique フロー（標準フロー §4-1 後段）

a-analysis-001 起草完了 → analysis-001- No. 4 で main 報告 → main → a-audit-001 critique 依頼（main- No. 218 候補）→ audit-001- No. 8 critique 受領 → main 決裁 → 東海林さん最終決裁 → 一括反映（governance / memory / handoff / snapshot 4 種同期）。

# 6. 自己参照禁止 抵触整理

a-analysis 自身の運用変更には抵触しない（a-analysis は governance / 全 session 共通 memory / handoff / claude.ai snapshot を起草、これは「a-analysis 自身の運用変更」ではなく「全 session 共通ルール改訂」）。

ただし審理する立場として:
- 提案 1-3 は a-audit 自身の運用にも関わる（特に提案 3 sentinel は audit 自身も適用対象）→ a-audit critique で抵触判断仰ぎ
- 提案 2 雛形ベストプラクティスは a-analysis / a-audit 両者の起草で適用 → 当事者性あり

# 7. 報告フォーマット（analysis-001- No. 4）

冒頭 3 行（🟢 analysis-001- No. 4 / 元→宛先 / 発信日時）+ 全体を ~~~ でラップ + 以下構造で起草。報告内では ~~~ ネスト不使用、コードブロック不使用、冒頭 3 行 ~~~ 内配置（v5.1 完全準拠 = まだ v5.1 運用中、本起草で v5.2 化）。

### 件名
提案 1 + 2 + 3 統合起草完了 + v5.2 改訂案 4 種 + claude.ai snapshot 同期案

### 起草成果物サマリ
| # | 対象ファイル | 行数 / 差分 | 状態 |
|---|---|---|---|
| 1 | governance-rules-v1 §5 改訂版 | NN 行 | 起草完了 |
| 2 | memory feedback_dispatch_header_format v5.2 | NN 行 | 起草完了 |
| 3 | memory feedback_self_memory_audit_in_session sentinel # 6 追加 | NN 行 | 起草完了 |
| 4 | handoff §A 決定 4 改訂版 | NN 行 | 起草完了 |
| 5 | claude.ai snapshot 同期案 | NN 行 | 起草完了 |

### 各起草成果物の詳細
- 起草配置先（docs/proposal-v52-*.md 等のドラフトファイル想定）
- main / a-audit / 東海林さんが Read で確認可能

### 自己参照禁止 抵触検証結果
- 抵触なし（全 session 共通ルール改訂、a-analysis 自身の運用変更ではない）
- 当事者性ある論点（提案 2 / 3）は a-audit critique で抵触判断仰ぎ

### main / a-audit / 東海林さん 採否判断仰ぎ事項
- 各 5 種の採用 / 改善 / 却下
- 一括反映タイミング（template 確定済 + ガンガン解除後、5/11 中の即時反映 or 5/12 以降の慎重反映）

### self-check
- [x] 冒頭 3 行 + ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] 5 種起草成果物 全件明示
- [x] 自己参照禁止 抵触検証実施

# 8. 緊急度

🟡 中（中規模改訂、template 確定済 + audit 検証完了済の流れで進める）

# self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] 提案 1 + 2 + 3 統合起草指示明示
- [x] 起草スコープ 5 種明示
- [x] 標準フロー §4-1 後段（a-audit critique → main 決裁 → 東海林さん最終決裁）明示
- [x] 自己参照禁止 抵触整理明示
- [x] 報告フォーマット (analysis-001- No. 4) 雛形提示（v5.1 完全準拠）
- [x] 番号 = main- No. 217（counter 継続）
~~~
