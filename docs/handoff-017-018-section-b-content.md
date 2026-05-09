# §B 前期違反 5 件 + 再発防止策具体動作 + マッピング表（a-main-017 期）

> 起草: a-main-017
> 用途: 改訂 handoff の §B セクション内容（018 が template に取り込み）
> 保持期間: **直前期のみ詳細記載**、それ以前は memory `feedback_my_weak_areas` / governance §12 に統合 + リンク
> 違反発生時の即追記原則 + 引越し時整理

---

## 違反 → 再発防止策 マッピング表（一目参照用）

| 違反パターン | 該当 memory | handoff 参照 | sentinel 参照 | 具体動作 |
|---|---|---|---|---|
| **既存実装把握漏れ**（Phase D 既完走見落とし等）| `feedback_check_existing_impl_before_discussion` v2 | §3-A + §3-B 必須項目 | sentinel # 5「既存実装関与？」 | dispatch 起草前に各モジュールの dispatch counter 履歴 + 直近 5 dispatch を Read |
| **mock 画像確認不足**（外部依頼前）| `feedback_check_existing_impl_before_discussion` v2 | — | sentinel # 5 + # 4 | 外部依頼 dispatch 起草前に mock 画像を Read で目視確認 |
| **状態認識揺らぎ**（一時停止中に「即実行」発言）| `feedback_gangan_pause_state_management` | — | sentinel # 1「状態確認」 | 応答冒頭に [一時停止中] / [稼働中] 明示 |
| **自己評価甘さ**（ラウンド 1 で「全部対処済」誤判定）| `feedback_strict_recheck_iteration` v2 | — | sentinel # 2「提案 / 報告？」 | 連続 3 ラウンド 0 件 + 東海林さん最終チェック必須 |
| **不得意分野抱え込み**（視覚評価を私単独実施）| `feedback_my_weak_areas` | — | sentinel # 5 | 視覚評価は a-review に委譲、画像 → text 化は claude.ai に直接添付 |

---

## 違反 1: main- No. 182 誤指示（D-06 / D-08 既完走見落とし）

**違反内容（事実）**:
- 5/9 21:30 a-bud-002 へ「Phase D 残 D-06 + D-08 順次着手で 100% 達成」と指示
- 実態: D-06（5/8 13:54、commit 44c6cb0、47 tests）+ D-08（5/8 13:58、commit 0623c23、8 tests）= 既完走、Phase D 12/12 = 100% 達成済
- a-bud-002 が直近 commit「参照スクショ配置」（5/8 14:00、dispatch-counter 23）= D-06/D-08 完走後の commit
- 私が「最終 commit = 29 時間前」と判定 → 「29 時間停滞、次タスク投下必要」と誤判定

**該当 memory**: `feedback_check_existing_impl_before_discussion` v2「外部依頼前」トリガー違反

**再発防止策具体動作**:
- handoff §3-A 直近 24h 各モジュール完走報告一覧を必須項目化（a-bud-002 提案採択）
- handoff §3-B 直近 PR URL + branch HEAD commit を必須項目化
- dispatch 起草前 self-check（dispatch-template.md）に「該当モジュールの dispatch counter 履歴 + 直近 5 dispatch を Read で確認」追加

**事故防止手段**: a-bud-002 が bud-002- No. 24 で訂正報告 → 不要再着手 2.5d を防いだ

---

## 違反 2: main- No. 180 で claude.ai に「レーダー縦積み」誤指示（mock v1 確認不足）

**違反内容（事実）**:
- 5/9 21:15 claude.ai chat に tab-2 修正指示で「レーダー独立配置（縦積み）」と指示
- 実態: mock v1 画像では「ワンビュー + レーダー横並び（左右）」が正解
- 私が mock v1 画像を Read で再確認せず、a-review review-9 の指摘（「ワンビュー下に独立カード配置」）を鵜呑み

**該当 memory**: `feedback_check_existing_impl_before_discussion` v2「外部依頼前」トリガー違反

**再発防止策具体動作**:
- 外部依頼 dispatch（claude.ai 等）起草前に mock 画像を Read で目視確認必須
- a-review review への鵜呑みを避ける（review にも誤判定リスクあり）

**事故防止手段**: claude.ai が forest-html-10 で「mock v1 では横並び」と判断保留応答 → 私が判断撤回

---

## 違反 3: a-review への dispatch # 176 + # 177 で self-prep 配慮不足（軽微）

**違反内容（事実）**:
- a-review に UI 視覚評価兼任承認（# 176）と tab-2 視覚評価依頼（# 177）を即時投下
- a-review が review-8 で self-prep（preview tool / Chrome MCP load + 接続テスト）が必要と提案
- 私が事前に self-prep 期間を確保していなかった

**該当 memory**: `feedback_my_weak_areas` # 2「視覚評価自己判定甘さ」(間接)

**再発防止策具体動作**:
- 新セッションへの初仕事投下時、self-prep 期間を意識的に確保
- 兼任承認 dispatch（# 176 系）と実タスク dispatch（# 177 系）の間に時間差を設ける

**影響**: 軽微、a-review が review-8 で self-prep 提案 → review-9 で実タスク完了

---

## 違反 4: 一時停止中に「ガンガン進めます」発言（状態認識違反）

**違反内容（事実）**:
- 5/9 19:30 東海林さんから「ガンガンモード一時停止中としてるのに、『即実行プラン（ガンガン進めます）』ってなってる？」指摘
- 私が議論中（一時停止中）に即実行モード宣言

**該当 memory**: `feedback_gangan_pause_state_management`（本違反を契機に新設）

**再発防止策具体動作**:
- 応答冒頭に [一時停止中] / [稼働中] 明示
- 状態切替トリガー（協議 / 議論 / 立ち止まって → 一時停止 / GO / 再開 → 稼働）を明文化
- sentinel # 1「状態確認」で応答前に毎回チェック

**事故防止手段**: 東海林さん指摘で即訂正、本 dispatch 起草中も慎重モード維持

---

## 違反 5: ラウンド 1 で「全部対処済」誤判定（複数回）

**違反内容（事実）**:
- 5/9 18:30 1 ラウンド目で「全部対処済」と判断、東海林さんに promote されて 2 ラウンド目で 12 件抜け発見
- 5/9 19:30 ラウンド 4 で 8 件抜け、ラウンド 5 で 3 件抜け（連続 3 ラウンド 0 件未達成）
- 自己評価の甘さが繰り返し発生

**該当 memory**: `feedback_strict_recheck_iteration` v2 + `feedback_my_weak_areas` # 7「自己評価の甘さ」

**再発防止策具体動作**:
- 終了条件を「連続 3 ラウンド 0 件 + 東海林さん最終チェック必須」（B+C ハイブリッド）に強化
- 各ラウンドに焦点持たせる（1: 対処済 / 2: 質 / 3: メタ / 4: 実装漏れ / 5: 矛盾検出）
- 東海林さん最終チェック時は専門用語禁止 + 盲点リスト併記

**事故防止手段**: 東海林さん最終チェックが構造的必須化 → 自己判定単独で「OK」と進めない

---

## 過去違反の参照（直前期以前）

直前期以前の違反は本 §B には記載しない（持続性確保）。以下を参照:

| 期 | 違反集計 | 参照先 |
|---|---|---|
| a-main-016 期 | 11 件違反 | governance-rules-v1 §12「私の不得意分野リスト」+ memory `feedback_my_weak_areas` |
| a-main-015 期 | 81% 強制終了（引越し基準ライン超過）| memory `feedback_main_session_50_60_handoff` |
| a-main-014 期以前 | (個別違反は memory 群に統合) | MEMORY.md 索引から検索 |

---

## 違反追記運用ルール（次期以降）

| タイミング | 動作 |
|---|---|
| 違反発生時（即時）| §B に違反内容 + 該当 memory + 再発防止策具体動作を即追記（記憶が薄れる前） |
| handoff 起草時 | §B 全件レビュー、解消した違反は次期へ申し送り（解消ステータス付き）or memory / governance に統合 |
| 引越し後（前期 = 次の §B 対象）| 直前期 = §B 詳細、それ以前は memory / governance 統合 + リンク |

---

## 改訂履歴

- 2026-05-09 23:05 初版（a-main-017、ステップ 3 着手、慎重モードで起草）
