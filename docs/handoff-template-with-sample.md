# handoff template with sample — 017→018 後追い版（正典サンプル）

> 起草: a-main-018（5/10、ステップ 1b 着手中）
> 用途: handoff-template.md の正典サンプル、017 期実例で fill した完全版
> 関連 docs: handoff-template.md（抽象テンプレ）/ handoff-a-main-017-to-018-20260509.md（実引越し handoff、§1-§11）

---

## このサンプルの位置づけ

handoff-template.md の各セクションを **017 期実例で fill した完全版**。新セッション起動時に「実例ベースでテンプレを理解する」ために併走配置。

| セクション | 内容のソース |
|---|---|
| §0 起動時必読 docs ロック | handoff-template.md §0 構造 + 017→018 期向け具体記述 |
| §A 前期重要決定 summary | [handoff-017-018-section-a-content.md](handoff-017-018-section-a-content.md)（017 起草、8 件、217 行）|
| §B 前期違反 + 再発防止策 | [handoff-017-018-section-b-content.md](handoff-017-018-section-b-content.md)（017 起草、5 件 + マッピング表、134 行）|
| §1-§11 既存セクション | [handoff-a-main-017-to-018-20260509.md](handoff-a-main-017-to-018-20260509.md)（017 起草、§1-§11）|
| §12 a-memory 連携プロトコル | handoff-template.md §12 構造（018 期から運用開始想定）|
| §13 関連情報 | 同上 |

---

## §0 起動時必読 docs ロック（017→018 期向け具体記述）

### §0-1 起動時 8 項目チェックリスト（017→018 期のサンプル）

| # | 必読対象 | 完了確認返答 | 017→018 期での具体 |
|---|---|---|---|
| 1 | 本 handoff（§0〜§12 全文）+ governance §1 ガンガン本質 3 軸定義 | 「Read 済 + ガンガン本質 3 軸内化」| handoff-a-main-017-to-018-20260509.md + governance-rules-v1-20260509.md §1 |
| 2 | governance-rules-v1（全文）| 「Read 済」| governance-rules-v1-20260509.md |
| 3 | 直近 7 日追加 memory 全件 | 「Read 済」| 017 期新設 11 件 + 改訂 3 件、§A 列挙参照 |
| 4 | claudeai-instructions-snapshot + claudeai-procedures-snapshot | 「Read 済」| claudeai-instructions-snapshot-20260509.md + claudeai-procedures-snapshot-20260509.md |
| 5 | §A 前期重要決定 summary | 「内化確認、適用準備完了」| handoff-017-018-section-a-content.md（8 件）|
| 6 | §B 前期違反 + 再発防止策 + マッピング表 | 「再発防止策内化完了」| handoff-017-018-section-b-content.md（5 件）|
| 7 | sentinel 5 項目通過確認 | 「sentinel 5 項目通過」| `feedback_self_memory_audit_in_session` |
| 8 | 東海林さんに「起動時 8 項目チェックリスト完了」最終報告 → 東海林さん「稼働 GO」受領まで dispatch 禁止 | 東海林さん明示 GO 待ち | 5/10 朝の起動時実装予定 |

### §0-2 起動時 sentinel（既存と同一）

`feedback_self_memory_audit_in_session` の 5 項目を起動時にも通す:
- 1. 状態確認 / 2. 提案-報告 / 3. dispatch / 4. ファイル参照 / 5. 既存実装

### §0-3 dispatch 起草ロック（強度 3 段階、017→018 期で実装）

| 強度 | 仕組み | 017→018 実装 |
|---|---|---|
| レベル 1 | 文章上の禁止 | handoff-template.md §0-3 + 本ファイル §0-3 明文化 |
| レベル 2 | 応答前 sentinel 自動チェック | `feedback_self_memory_audit_in_session` 改訂で「§0 全 ☑ 完了？」追加 |
| レベル 3 | 東海林さん最終 GO 必須 | §0-1 # 8 で人間ゲート |

### §0-4 失敗時フォールバック

§0 ロック自体が機能しない場合の緊急解除手順は handoff-template.md §0-4 参照。017→018 期から運用開始。

---

## §A 前期重要決定 summary

→ **完全な内容は [handoff-017-018-section-a-content.md](handoff-017-018-section-a-content.md) を参照**

### 8 件の概要（要約のみ、本文は別 docs）

| 決定 | タイトル | memory |
|---|---|---|
| 1 | ガンガンモード本質 v2（3 軸明示）| `feedback_gangan_mode_default` v2 |
| 2 | 厳しい目 N ラウンド焦点別 + 連続 3 ラウンド 0 件 + 東海林さん最終チェック必須 | `feedback_strict_recheck_iteration` v2 |
| 3 | 三点セット同期 v2（追記方式 → 完全版 .md 全置換方式）| `feedback_three_way_sync_cc_claudeai_procedure` v2 |
| 4 | dispatch 形式 v5.1（投下情報冒頭明示 + コピペ md 経由 + ~~~ 内コードブロック禁止）| `feedback_dispatch_header_format` v5.1 |
| 5 | ファイル存在確認（Read OK 判定前に ls 必須）| `feedback_file_existence_check_before_ok` |
| 6 | 既存実装把握 3 トリガー（議論前 / 修正前 / 外部依頼前）| `feedback_check_existing_impl_before_discussion` v2 |
| 7 | ガンガンモード一時停止状態管理（[一時停止中] / [稼働中] 明示）| `feedback_gangan_pause_state_management` |
| 8 | handoff 引き継ぎ強化（§3-A + §3-B 必須化）| handoff フォーマット改訂 |

各決定の **経緯 / 結果 / 代替案 + 却下理由 / 適用範囲 / 体内化確認方法** は別 docs を参照。

---

## §B 前期違反 + 再発防止策

→ **完全な内容は [handoff-017-018-section-b-content.md](handoff-017-018-section-b-content.md) を参照**

### 5 件の概要 + マッピング表（要約のみ、本文は別 docs）

| 違反 | タイトル | 該当 memory |
|---|---|---|
| 1 | main- No. 182 誤指示（D-06 / D-08 既完走見落とし）| `feedback_check_existing_impl_before_discussion` v2 |
| 2 | main- No. 180 で claude.ai に「レーダー縦積み」誤指示（mock v1 確認不足）| 同上 |
| 3 | a-review への dispatch # 176 + # 177 で self-prep 配慮不足（軽微）| `feedback_my_weak_areas` |
| 4 | 一時停止中に「ガンガン進めます」発言（状態認識違反）| `feedback_gangan_pause_state_management` |
| 5 | ラウンド 1 で「全部対処済」誤判定（複数回）| `feedback_strict_recheck_iteration` v2 |

### マッピング表（一目参照用）

完全版は別 docs §B-1 参照。要約:

| 違反パターン | sentinel 参照 | 具体動作 |
|---|---|---|
| 既存実装把握漏れ | sentinel # 5 | dispatch 起草前に各モジュールの dispatch counter 履歴 + 直近 5 dispatch を Read |
| mock 画像確認不足 | sentinel # 5 + # 4 | 外部依頼 dispatch 起草前に mock 画像を Read で目視確認 |
| 状態認識揺らぎ | sentinel # 1 | 応答冒頭に [一時停止中] / [稼働中] 明示 |
| 自己評価甘さ | sentinel # 2 | 連続 3 ラウンド 0 件 + 東海林さん最終チェック必須 |
| 不得意分野抱え込み | sentinel # 5 | 視覚評価は a-review に委譲、画像 → text 化は claude.ai に直接添付 |

### 過去違反の参照（直前期以前）

| 期 | 違反集計 | 参照先 |
|---|---|---|
| a-main-016 期 | 11 件違反 | governance-rules-v1 §12 + memory `feedback_my_weak_areas` |
| a-main-015 期以前 | 個別違反は memory 群に統合 | MEMORY.md 索引から検索 |

---

## §1-§11 既存引越し情報（017→018 期）

→ **完全な内容は [handoff-a-main-017-to-018-20260509.md](handoff-a-main-017-to-018-20260509.md) を参照**

### 概要（章立てのみ）

- §1 git 実態
- §2 dispatch counter + 直近 dispatch（189 起点）
- §3 各モジュール稼働状況
  - §3-A 直近 24h 完走報告（必須）
  - §3-B 直近 PR URL + HEAD commit（必須）
- §4 進行中タスク + 次にやるべきこと
- §5 注意点 / 詰まり
- §6 セッション内 違反 / 忘れ事項
- §7 memory 棚卸し結果（11 件新設 + 3 件改訂）
- §8 厳しい目 N ラウンド結果
- §9 三点セット同期発行履歴（v3）
- §10 RTK gain（56.6% 節約継続）
- §11 起動後の最初のアクション（§0 完了後）

---

## §12 a-memory セッション連携プロトコル

→ **完全な仕様は handoff-template.md §12 を参照**

### 概要（018 期から運用開始想定）

| 項目 | 内容 |
|---|---|
| 役割 | memory 新設 / 改訂 / 違反検出 / 整合性確認 / 棚卸し / MEMORY.md 索引管理 |
| 起動方法 | on-demand + キャッシュ機構（差分のみ Read）|
| dispatch flow | main → a-memory → main（main が最終登録）|
| 緊急 bypass | 軽微 memory 更新（typo / 表現微調整 / 索引追加 / 改訂履歴）は main 直接編集 OK |
| 認識ズレエスカレーション | main / a-memory 不合意 → 東海林さん最終決裁 + ログ記録 |
| 場所 | `C:\garden\a-memory\`、新 worktree |
| 自身の handoff loop | 独自 handoff、軽量で頻度低 |

### 6 重防御の位置づけ

| 層 | 仕組み |
|---|---|
| 1-5 | 既存（sentinel / N ラウンド / 完了報告 / §0 ロック / 定期チェック）|
| **6** | **a-memory による別セッション視点（memory 判断専門）** |

---

## §13 関連情報

### ブランチ
- a-main-017（旧）: `workspace/a-main-017`
- **a-main-018（新）**: `workspace/a-main-018`

### 主要 docs（017 期起源）
- handoff-template.md（本サンプルの抽象テンプレ）
- handoff-template-with-sample.md（本ファイル）
- handoff-checklist.md（引越し前作業手順）
- governance-rules-v1-20260509.md
- claudeai-instructions-snapshot-20260509.md / claudeai-procedures-snapshot-20260509.md
- dispatch-template.md / dispatch-status.md
- handoff-017-018-section-a-content.md / handoff-017-018-section-b-content.md（§A / §B 内容）
- handoff-a-main-017-to-018-20260509.md（実引越し handoff、§1-§11）

---

## 改訂履歴

- 2026-05-10 00:00 初版（a-main-018、ステップ 1b 着手、§A / §B 取り込み + 参照リンク中心の軽量サンプル）
