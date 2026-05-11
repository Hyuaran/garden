~~~
🟡 main- No. 228
【a-main-020 から a-audit-001 への dispatch】
発信日時: 2026-05-11(月) 10:53

# 件名
事故報告（緊急 bypass §4-4）: 違反 10 候補 = review-11 採用判定が実描画未確認 + 共通 CSS 不整合見落とし

# 1. 事故概要

## 1-1. 発生時刻
2026-05-11 10:15（review-11 起草）→ 10:50 頃（東海林さん実描画確認で崩壊判明）

## 1-2. 違反内容
a-review が review-11（main- No. 216 への返答）で tab-2 修正版 forest-html-10 を「採用推奨」と判定。

main（a-main-020）も review-11 受領後「✅ 採用推奨」と承認（main- No. 217 起草時に「tab-2 修正版完了 → tab-3 起草へ展開」と進行）。

しかし、東海林さんが tab-2 + tab-3 を実描画確認したところ、ヘッダー + 左右サイドバーが崩壊。tab-1 既稼働は正常表示。

→ review-11 採用判定 + main 承認の両方が **実描画未確認** + **共通 CSS 不整合見落とし** の重大判定誤り。

## 1-3. 該当 memory
- memory `feedback_self_visual_check_with_chrome_mcp` = 視覚確認は Chrome MCP で Claude 自身が実施
- memory `feedback_file_existence_check_before_ok` = Read で OK 判定前に ls 物理存在検証必須（HTML / CSS / 画像参照すべて）
- memory `feedback_check_existing_impl_before_discussion` v2 = 議論前 / 修正前 / 外部依頼前 3 トリガー（tab-2 修正版起草前に tab-1 既稼働構造を grep + Read で確認すべきだった）
- memory `feedback_my_weak_areas` # 2「視覚評価自己判定甘さ」

## 1-4. 影響範囲
- tab-2 修正版（forest-html-10）配置済（5/9 21:35）= 業務影響あり、東海林さんが実描画で気付くまで「採用」状態のまま継続
- tab-3 起草版（forest-html-11、5/11 10:42）= tab-2 を踏襲したため同じ構造問題を継承
- main- No. 224（a-review tab-3 視覚評価依頼）= 同じ問題で評価不能
- 5/11 朝 09:50 ガンガン解除〜10:50（約 1h）の Forest UI シフト方針起草フェーズで構造問題に気付かず進行

# 2. main 自己分析（真因 + 暫定対処）

## 2-1. 真因（複合）

| # | 真因 | 詳細 |
|---|---|---|
| 1 | 実描画確認の欠落 | review-11 の self-prep 評価で「構造比較で完結」と書かれたが、main 側でも実描画確認を促さず受領。memory feedback_self_visual_check_with_chrome_mcp 違反 |
| 2 | 共通 CSS 想定構造の確認欠落 | tab-2 修正版の起草指示時、tab-1 既稼働の HTML 構造を grep + Read で確認すべきところを「外側 ~~~ + 内側コードブロック」の v5.1 違反訂正に集中し、HTML 構造整合性を確認していなかった |
| 3 | review への過信 | a-review review-11「採用推奨」を受領後、独立検証なしで承認。これは「a-review = UI 視覚評価兼任」(memory 上の役割)を前提とした信頼関係への過依存 |
| 4 | 共通テンプレート抽出順序の誤り | tab-3 起草（main- No. 221）と共通テンプレート抽出（docs/templates/）を並行進行、template 完成後に claude.ai に渡す手順を踏まなかった。tab-2 修正版が構造不整合のまま tab-3 にも伝播 |

## 2-2. 暫定対処（main 単独編集、緊急 bypass §4-4 範囲、東海林さん GO 済）

| # | アクション | 状態 |
|---|---|---|
| 1 | main- No. 226: claude.ai に tab-2 + tab-3 修正版起草依頼（docs/templates/ + tab-1 既稼働 HTML 参照） | ✅ 起草済 |
| 2 | main- No. 227: a-review に review-11 訂正評価依頼（実描画確認必須） | ✅ 起草済 |
| 3 | 本 dispatch（main- No. 228）で a-audit に事後報告 | ✅ 起草中 |

# 3. a-audit へのお願い

## 3-1. 客観分析依頼

- main 自己分析（4 真因）の妥当性検証
- 別の構造的真因がないか検証
- 訂正対処（main- No. 226 + 227）が「軽微 OK 流す」/「critique 必要」/「重大エスカレーション」のいずれか判定

## 3-2. 再発防止策提案

- memory feedback_self_visual_check_with_chrome_mcp の強化案（review judgment が「構造比較で完結」と書いた場合、main 側で実描画確認の追加要求を sentinel 化）
- 共通 CSS 想定構造の確認 sentinel 追加案（HTML 起草 / 修正前に既存稼働 HTML の class 構造を grep + Read で確認）
- review への過信 sentinel 追加案（review 評価受領時、main 側で 1 件以上の独立検証実施）
- 共通テンプレート抽出順序の運用ルール化（共通構造関連の HTML 起草は template 完成 → claude.ai 依頼の順、並行禁止）

## 3-3. incident-pattern-log §3 違反 10 として追記判断

- 020 期 違反 6（counter リセット）/ 7（~~~ ネスト）/ 8（検出値乖離）/ 9（冒頭 3 行 ~~~ 外）に続く 5 件目
- 重大度: 🟡 中規模（業務影響あり、ただし東海林さん検出で訂正可能）

# 4. §4-4 緊急 bypass フロー動作確認

- main → audit 即時報告（本 dispatch、main- No. 228） ✅
- audit 判定返答（audit-001- No. 11 候補で「軽微 OK 流す」/「critique 必要」/「重大エスカレーション」）待機 ✅

# 5. 報告フォーマット（audit-001- No. 11）

冒頭 3 行（🟢 audit-001- No. 11 / 元→宛先 / 発信日時）+ 全体を ~~~ でラップ + 以下構造で起草。報告内では ~~~ ネスト不使用、コードブロック不使用、冒頭 3 行 ~~~ 内配置（v5.1 完全準拠）。

### 件名
違反 10 候補（review-11 採用判定 + 共通 CSS 不整合見落とし）事故 critique 結果

### 判定
- 軽微 OK / critique 必要 / 重大エスカレーション

### 真因分析（main 自己分析の妥当性検証）
- main 4 真因の妥当性
- 別の構造的真因（あれば）

### 再発防止策提案
- visual_check_with_chrome_mcp 強化案
- 共通 CSS 想定構造確認 sentinel
- review 過信 sentinel
- 共通テンプレート抽出順序の運用ルール化

### incident-pattern-log §3 違反 10 として追記
- パターン名
- 類似検出ルール 10 シグナルとの照合

### self-check
- [x] 冒頭 3 行 + ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] 判定 1 種選択
- [x] 真因 + 再発防止策 + incident 追記 全て記述

# 6. 緊急度

🟡 中（業務影響あり、訂正対処済、a-audit 客観分析 + 再発防止策確定が次必要）

# self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] 事故内容 + 該当 memory 4 件 + 影響範囲 + main 自己分析 4 真因 明示
- [x] a-audit へのお願い 3 件明示
- [x] §4-4 緊急 bypass フロー動作確認兼任宣言
- [x] 報告フォーマット (audit-001- No. 11) 雛形提示
- [x] 番号 = main- No. 228（counter 継続）
~~~
