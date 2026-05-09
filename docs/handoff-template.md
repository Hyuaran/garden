# handoff template — a-main-N → a-main-(N+1) 引越し成果物 正典フォーマット

> 起草: a-main-018（5/9 → 5/10）
> 用途: a-main セッション引越し時の成果物（handoff-a-main-N-to-(N+1)-YYYYMMDD.md）の正典フォーマット
> 準拠 memory: `feedback_session_handoff_checklist` / `feedback_strict_recheck_iteration` v2
> 関連 docs: handoff-checklist.md（引越し前作業手順）/ handoff-template-with-sample.md（正典サンプル、017→018 後追い版）

---

## このテンプレートの位置づけ

| 区分 | ファイル | 用途 |
|---|---|---|
| **作業手順** | handoff-checklist.md | 引越し前に前期セッションが順番に実施するチェックリスト |
| **成果物テンプレ** | handoff-template.md（本ファイル）| 引越し成果物 handoff-a-main-N-to-(N+1)-*.md の正典フォーマット |
| **正典サンプル** | handoff-template-with-sample.md | 017→018 後追い版を実例として併走 |

---

## §0 起動時必読 docs ロック（最上段、強制装置）

> **新セッション (a-main-(N+1)) は本 §0 全項目 ☑ 完了 + 東海林さん最終 GO 受領前に dispatch 起草 / 即実行を禁止する。**
> 違反は構造的リセット（5/9 a-main-018 起動時症状）に直結する。

### §0-1 起動時 8 項目チェックリスト（並列 Read + 統合返答で context 節約）

| # | 必読対象 | 完了確認返答 | 備考 |
|---|---|---|---|
| 1 | 本 handoff（§0〜§12 全文）+ governance §1 ガンガン本質 3 軸定義 | 「Read 済 + ガンガン本質 3 軸（全モジュール並列 / 5h フル / 東海林作業時間無視）内化」| **抜け 2 対策**: ガンガン本質再読を必須化 |
| 2 | governance-rules-v1（全文）| 「Read 済」| 016 期教訓統合 |
| 3 | 直近 7 日追加 memory 全件（git log で `--since="7 days ago"` + §A 明示列挙）| 「Read 済」| **§A の人手起草で誤抽出防止**（17 RQ1 修正）|
| 4 | claudeai-instructions-snapshot + claudeai-procedures-snapshot | 「Read 済」| 三点セット同期起点 |
| 5 | §A 前期重要決定 summary | 「内化確認、適用準備完了」| 各決定の代替案 + 却下理由まで把握 |
| 6 | §B 前期違反 + 再発防止策 + マッピング表 | 「再発防止策内化完了」| 直前期分のみ詳細、それ以前は memory 参照 |
| 7 | sentinel 5 項目（`feedback_self_memory_audit_in_session`）通過確認 | 「sentinel 5 項目通過」| 既存 sentinel と同一、新規追加なし |
| 8 | 東海林さんに「起動時 8 項目チェックリスト完了」最終報告 → **東海林さん「稼働 GO」受領まで dispatch 禁止** | 東海林さん明示 GO 待ち | **抜け 3 対策**: 自己判定で勝手に進めない（17 RQ1 抜け 3）|

### §0-2 起動時 sentinel（既存と同一、新規追加なし）

`feedback_self_memory_audit_in_session` の 5 項目を起動時にも通す:
- 1. 状態確認 / 2. 提案-報告 / 3. dispatch / 4. ファイル参照 / 5. 既存実装

→ 新規 sentinel 増設は管理負担増のため不可。既存 5 項目を起動時にも適用。

### §0-3 dispatch 起草ロック（強度 3 段階）

| 強度 | 仕組み | 違反検知 |
|---|---|---|
| レベル 1 | 文章上の禁止（本 §0-3 明文化）| 自己規律 |
| レベル 2 | 応答前 sentinel での自動チェック（`feedback_self_memory_audit_in_session` 拡張）| sentinel # 3 dispatch sentinel で「§0 全 ☑ 完了？ NO → 禁止」 |
| レベル 3 | 東海林さん最終 GO 必須（人間ゲート）| 人間観測 |

**3 段階すべて通過後に dispatch 起草・即実行が許可される。**

### §0-4 失敗時フォールバック

§0 ロック自体が機能しない場合の緊急解除手順:
1. 東海林さん明示指示「§0 解除」を受領
2. 解除理由を `docs/section-0-bypass-log-YYYYMMDD.md` に記録
3. 解除中の動作を `feedback_section_0_emergency_bypass` に従う
4. 解除後速やかに §0 機能復旧

→ 解除は東海林さん明示指示でのみ可、自己判定 NG。

---

## §A 前期重要決定 summary

> **起草担当: 引越し前の前期セッション**（議論の重みを最も知る主体）
> **重要度判定基準**: ① 議論時間 30 分以上 / ② memory 新設に至った決定 / ③ 東海林さん明示指示で確定
> **ボリューム上限**: 最重要 7-10 件絞り、各 4-6 行（経緯 / 結果 / 代替案 / 適用 / 体内化確認）
> **復習動線（東海林さん向け、3 つ）**: ① 新セッション起動直後 / ② 週次振り返り / ③ 違反発生時

### 決定テンプレ（コピペ穴埋め式）

```
## 決定 N: タイトル

**経緯（議論の重み）**:
- (議論時刻 + 東海林さん発言 / 私の旧理解 / 訂正契機)

**結果**:
- (memory 新設 / 改訂、具体ルール内容)

**代替案 + 却下理由**:
- 代替案 A: (内容) → 却下、(理由)
- 代替案 B: (内容) → 却下、(理由)

**適用範囲**: (どのセッション / どの操作で適用されるか)

**体内化確認方法**:
- (新セッションが起動時に「内化済」と判定できる具体動作)
```

→ N = 7-10 件、各決定で上記 5 セクション必須記載。

---

## §B 前期違反 N 件 + 再発防止策具体動作 + マッピング表

> **保持期間**: 直前期のみ §B 詳細記載、それ以前は memory / governance 統合 + 参照リンク
> **追記タイミング**: 違反発生時に即追記（記憶が薄れる前）+ 引越し時に整理

### §B-1 違反 → 再発防止策 マッピング表（一目参照用、必須）

```
| 違反パターン | 該当 memory | handoff 参照 | sentinel 参照 | 具体動作 |
|---|---|---|---|---|
| パターン 1 | memory_xxx | §3-A / §3-B | sentinel # N | (具体動作) |
| パターン 2 | ... | ... | ... | ... |
```

### §B-2 違反詳細テンプレ（コピペ穴埋め式）

```
## 違反 N: タイトル

**違反内容（事実）**:
- (発生時刻 + 具体内容 + 影響)

**該当 memory**: `memory_xxx` （違反したルール）

**再発防止策具体動作**:
- (handoff §X / memory §Y / sentinel §Z の具体参照先)

**事故防止手段**: (実際に事故を防いだ手段、なければ未然防止策)
```

### §B-3 過去違反の参照テンプレ

```
| 期 | 違反集計 | 参照先 |
|---|---|---|
| a-main-(N-1) 期 | M 件違反 | governance §X / memory `feedback_xxx` |
| a-main-(N-2) 期 | (要約) | 索引 / 統合先 |
| a-main-(N-3) 期以前 | (個別違反は memory 群に統合) | MEMORY.md 索引から検索 |
```

### §B-4 違反追記運用ルール

| タイミング | 動作 |
|---|---|
| 違反発生時（即時） | §B に違反内容 + 該当 memory + 再発防止策を即追記（記憶が薄れる前）|
| handoff 起草時 | §B 全件レビュー、解消した違反は次期へ申し送り（解消ステータス付き）or memory / governance に統合 |
| 引越し後 | 直前期 = §B 詳細、それ以前は memory / governance 統合 + リンク |

---

## §1 git 実態

```
Branch: workspace/a-main-N
最新 commit (push 済):
- (hash) (要約)
- (hash) (要約)
...

uncommitted: なし / あり（具体）
```

---

## §2 dispatch counter + 直近 dispatch

dispatch counter: **NNN**（次は main- No. NNN から起草）

直近 dispatch 13 件:

| # | 投下先 | 内容 | 状態 |
|---|---|---|---|
| ... | ... | ... | ✅ 完了 / 🔄 進行中 / ❌ 未投下 |

---

## §3 各モジュール稼働状況

| モジュール | 最終 commit | 状態 |
|---|---|---|
| a-bloom-NNN | (時刻) | 🟢 稼働中 / 🟡 待機 / ⛔ 別ブランチ |
| ... | ... | ... |

### §3-A 直近 24h 各モジュール完走報告一覧（必須項目、a-bud-002 提案）

| モジュール | 完走報告 | dispatch 番号 | commit hash | 内容 |
|---|---|---|---|---|
| a-NNN | bud-NNN- No. NN | 5/X HH:MM | hash | (内容) |

### §3-B 直近 PR URL + branch HEAD commit（必須項目）

| モジュール | branch | HEAD commit | 関連 PR | 状態 |
|---|---|---|---|---|
| a-NNN | feature/xxx | hash | **PR #NNN** (内容) | OPEN / MERGEABLE |

---

## §4 進行中タスク + 次にやるべきこと

### 進行中
| 順 | タスク | 担当 | 状態 |
|---|---|---|---|

### 次にやるべきこと（a-main-(N+1) 起動後）
| 優先 | タスク |
|---|---|
| 🔴 | (緊急) |
| 🟡 | (推奨) |
| 🟢 | (軽微) |

---

## §5 注意点 / 詰まっている点

### 私の盲点 + 重要訂正
1. (具体)
2. (具体)

### 待機中の調査タスク
- (具体)

---

## §6 セッション内 違反 / 忘れ事項（自己評価）

§B 用の前段階記録。引越し時に §B に整理。

| # | 違反 / 忘れ | 該当 memory | 影響 |
|---|---|---|---|
| 1 | ... | ... | ... |

> **東海林さんへ**: §6 に追加違反 / 忘れあれば追記お願いします。

---

## §7 memory 棚卸し結果

### 新設 memory（N 件）
- (memory_xxx) — 1 行説明

### 改訂 memory（N 件）
- (memory_yyy) v2 — 1 行説明

### 矛盾 / 重複検出

なし / あり（具体）

---

## §8 厳しい目で再確認 N ラウンド結果

最終ラウンド結果:
- 連続 3 ラウンド 0 件達成: ✅ / ❌
- 東海林さん最終チェック完了項目: (具体)

---

## §9 三点セット同期テキスト発行履歴

- 完全版 vN「Claudeへの指示」: (ファイルパス) → (時刻) 東海林さん貼付済
- 完全版 vN「手順」: (ファイルパス) → 同上
- snapshot 更新済: (ファイルパス)

---

## §10 RTK gain 報告

```
Total commands:    NNN
Tokens saved:      NNN K (NN.N%)
```

---

## §11 a-main-(N+1) 起動後の最初のアクション

> **§0 ロックを通過して以下のステップへ進む。**

### Step 1: §0 起動時 8 項目チェックリスト完了
- §0-1 # 1〜# 8 すべて並列 Read + 統合返答 + 東海林さん最終 GO 受領

### Step 2: rtk gain 取得 + handoff §10 追記

### Step 3: 即実行タスク
| 順 | アクション |
|---|---|
| 1 | (タスク) |
| ... | ... |

### Step 4: 各モジュール巡回（30 分ルール）

### Step 5: 東海林さんに「a-main-(N+1) 起動完了 + §0 完了 + 即実行タスク N 件着手」と返答

---

## §12 a-memory セッション連携プロトコル（新設、6 重防御層 6）

> **a-memory セッション**は memory 判断専門の別 Claude セッション
> **役割**: memory 新設 / 改訂 / 違反検出 / 整合性確認 / 棚卸し / MEMORY.md 索引管理

### §12-1 役割線引き（main / a-memory）

| 操作 | a-memory 必須 | main 直接 OK |
|---|---|---|
| memory 新設 | ✅ | — |
| memory 内容改訂 | ✅ | — |
| 違反検出 / 棚卸し | ✅ | — |
| memory 統合判断 | ✅ | — |
| typo 修正 | — | ✅ |
| 表現微調整 | — | ✅ |
| 索引追加（MEMORY.md）| — | ✅ |
| 改訂履歴更新 | — | ✅ |

### §12-2 dispatch flow

```
main → a-memory（検討依頼）→ a-memory（判断 + 提案）→ main（登録）
```

### §12-3 起動方法（on-demand + キャッシュ機構）

- on-demand 起動: memory 関連判断発生時のみ
- キャッシュ機構: `~/.claude/.../memory/_cache/memory-summary.json` に各 memory の name + description + last_modified を保持
- 起動時動作: キャッシュ + 差分のみ Read（全件 Read 不要、初回のみ全件 Read）
- 初回起動コスト: 30-60 分（1 回限り）
- 2 回目以降: 5-10 分（差分のみ）

### §12-4 認識ズレエスカレーション手順

1. main 提案
2. a-memory 反対意見
3. 1 往復で合意
4. 不合意なら東海林さん最終決裁
5. 結果を `docs/memory-disagreement-log-YYYYMMDD.md` 永続記録

### §12-5 a-memory 自身の handoff loop

- 独自 handoff（context 配慮で 50-60% 引越し帯）
- 軽量で頻度低（memory 専門のため）
- handoff 成果物: handoff-a-memory-N-to-(N+1)-YYYYMMDD.md

### §12-6 セッション場所 + 起動

```
C:\garden\a-memory\
git worktree add C:\garden\a-memory -b workspace/a-memory
```

### §12-7 5 重防御 → 6 重防御の位置づけ

| 層 | 仕組み | 担当 |
|---|---|---|
| 1 | sentinel 5 項目 | Claude（main 自走）|
| 2 | N ラウンド焦点別 | Claude（main 自走）|
| 3 | 完了報告 + 東海林さん最終チェック | 人間ゲート |
| 4 | §0 ロック + ガンガン本質再読 | 起動時自動 |
| 5 | 東海林さん定期チェックテンプレ | 外部観測 |
| **6** | **a-memory による別セッション視点** | **別 Claude セッション** |

---

## §13 関連情報

### ブランチ
- a-main-N（旧）: `workspace/a-main-N`
- **a-main-(N+1)（新）**: `workspace/a-main-(N+1)`（origin/develop ベース）

### 主要 docs
- handoff-template.md（本テンプレ）
- handoff-template-with-sample.md（正典サンプル）
- handoff-checklist.md（引越し前作業手順）
- governance-rules-v1-YYYYMMDD.md
- claudeai-instructions-snapshot-YYYYMMDD.md / claudeai-procedures-snapshot-YYYYMMDD.md
- dispatch-template.md / dispatch-status.md

---

## 改訂履歴

- 2026-05-09 23:55 初版（a-main-018、ステップ 1b 着手、6 重防御 + 14 論点組込、§0 / §A / §B / §12 新設）
