# proposal: 020 → 021 引越し時 2 件構造課題 再発防止策

> 起草: a-analysis-001
> 起草日時: 2026-05-11 (月) 12:35
> 用途: a-main 引越し時の worktree docs 未取込 / dispatch-counter 不整合 構造的再発防止策
> 起点: main- No. 242（5/11 12:02 a-main-020 → 021 引越し時発見、暫定対応 commit 190347d 完了済）
> 状態: ドラフト、main + a-audit-001 critique + 東海林さん最終決裁後に main が memory + governance 反映

---

## 1. 問題の構造的整理

### 1-1 発生事実（main- No. 242 §B-1 受領）

| # | 課題 | 構造的原因 |
|---|---|---|
| 1 | 020 期成果物（handoff / dispatch # 203-241 / governance / snapshot / template 等）が 021 worktree に未取込 | git worktree add コマンドの base branch が `origin/develop`（古い）= 020 期成果物（workspace/a-main-020 branch 上）が未反映 |
| 2 | dispatch-counter.txt = 38（古い develop ベース）vs handoff = 242（実 counter） 不整合 | # 1 と同根、worktree base branch 選定問題 |

### 1-2 構造的真因

- a-main-(N+1) worktree 作成時、base branch を `origin/develop` ベースで作成すると、a-main-N 期の docs / counter が反映されない
- a-main 期間中の成果物は `workspace/a-main-N` branch にのみ存在、develop には merge されていない
- 新 worktree 作成時に `origin/workspace/a-main-N` を base にする手順が未明文化

### 1-3 暫定対応（5/11 12:14 完了済）

- `git checkout origin/workspace/a-main-020 -- docs/` で 020 docs/ ツリーを 021 に取込
- commit 190347d、293 files、push 済
- ただし暫定対応 = その場対処、構造的再発防止策ではない

---

## 2. 5 観点 再発防止策（main- No. 242 §B-3 起草依頼観点）

### 観点 1: 引越し前手順強化（feedback_session_handoff_checklist §A 改訂）

引越し前期セッション（a-main-N）が引越し起草時、**worktree 作成手順を必須化**:

#### §A 改訂版（既存 8 項目 + 新 9-10 項目追加）

| # | チェック項目 | 手順 | v1.1 新規？ |
|---|---|---|---|
| 1-8 | 既存 8 項目（git 実態 / counter / モジュール / memory 棚卸し / 違反集計 / N ラウンド / 三点セット / RTK）| 維持 | 既存 |
| **9** | **次セッション worktree 作成 + docs 継承手順実施** | `git worktree add C:/garden/a-main-(N+1) -b workspace/a-main-(N+1) origin/workspace/a-main-N`（**develop ベースではなく workspace/a-main-N ベース必須**）| **v1.1 新規** |
| **10** | **次セッション worktree への docs 継承検証** | 作成後 `ls C:/garden/a-main-(N+1)/docs/` で当期成果物（handoff / dispatch-counter.txt / governance / snapshot 等）が存在することを物理確認 | **v1.1 新規** |

### 観点 2: 引越し後 §0 ロック強化（feedback_session_handoff_checklist §B 改訂）

引越し受領した新セッション（a-main-(N+1)）が §0 起動時 8 項目に **docs アクセス確認 + counter 整合確認 を追加**:

#### §B 改訂版（既存 8 項目 + 新 9-10 項目追加）

| # | 必読対象 / チェック | 完了確認返答 | v1.1 新規？ |
|---|---|---|---|
| 1-8 | 既存 8 項目（handoff / governance / memory / snapshot / §A / §B / sentinel / 東海林さん GO）| 維持 | 既存 |
| **9** | **docs アクセス確認**: `ls docs/handoff-a-main-N-to-N+1-YYYYMMDD.md && ls docs/dispatch-counter.txt && ls docs/governance-rules-v1-YYYYMMDD.md` で前期成果物が物理存在することを確認 | 「docs 全件 アクセス可 確認済」/ 「未取込検出 → main 経由 docs 継承手順実施依頼」 | **v1.1 新規** |
| **10** | **dispatch-counter 整合確認**: `cat docs/dispatch-counter.txt` の値が handoff §2 で記載されている期待値と一致することを確認 | 「counter 値 NNN = handoff 期待値 NNN 一致確認」/ 「不整合検出 → docs 継承再実施 or 東海林さん判断仰ぎ」 | **v1.1 新規** |

### 観点 3: dispatch-counter.txt 同期メカ（handoff §3 テンプレ拡張）

handoff §3「dispatch counter + 直近 dispatch」セクションに **counter 期待値の明示 + 起動時実値検証手順** を追加:

#### handoff §3 改訂版テンプレ

```
## §3 dispatch counter + 直近 dispatch

### 3-1 counter
現在 counter: NNN
次の dispatch 番号: NNN+1

### 3-2 **次セッション起動時の検証手順**（v1.1 新規）
新セッション（a-main-(N+1)）は起動時に以下を実施:
- ls docs/dispatch-counter.txt（物理存在確認）
- cat docs/dispatch-counter.txt（値取得）
- 取得値が「NNN」と一致することを確認
- 不一致時 → docs 継承再実施（観点 1 § 9 / 観点 2 § 9-10 参照）

### 3-3 直近 dispatch
（既存テンプレ通り）
```

### 観点 4: worktree 作成手順の明文化（新規 memory）

新規 memory: `feedback_main_session_worktree_setup_procedure.md`

#### 改訂版 memory 全文（コピペ用、~~~ 外で提示）

##### frontmatter

- name: a-main セッション worktree 作成手順（base branch 選定 + docs 継承 + counter 整合性）
- description: a-main-(N+1) worktree 作成時、base branch を origin/workspace/a-main-N（前期 branch）にする必須手順 + docs/ 継承検証 + dispatch-counter.txt 整合確認。develop ベースで作成すると前期成果物未反映で起動時 §0 ロック中に発見 = 引越し効率低下事故（5/11 020→021 引越し時実発生）。
- type: feedback
- originSessionId: a-analysis-001-2026-05-11（main- No. 242 起源、5/11 12:02 020→021 引越し時発見）

##### 本文

###### ルール

a-main-(N+1) worktree 作成は以下手順を厳守:

| 順 | 手順 | コマンド例 |
|---|---|---|
| 1 | base branch 選定 | **origin/workspace/a-main-N**（前期 branch、develop ベース禁止）|
| 2 | worktree 作成 | git worktree add C:/garden/a-main-(N+1) -b workspace/a-main-(N+1) origin/workspace/a-main-N |
| 3 | docs 継承検証 | ls C:/garden/a-main-(N+1)/docs/handoff-a-main-N-to-N+1-YYYYMMDD.md（物理確認）|
| 4 | counter 整合確認 | cat C:/garden/a-main-(N+1)/docs/dispatch-counter.txt（handoff §3-1 期待値と一致確認）|
| 5 | 不整合時の対処 | git checkout origin/workspace/a-main-N -- docs/ で docs ツリー再取込 + commit + push |

###### Why

- 5/11 12:02 a-main-020 → 021 引越し時、worktree 作成 base branch が origin/develop（古い）だった
- 020 期成果物（handoff / dispatch # 203-241 / governance / snapshot / template 全件）が 021 worktree に未反映
- 021 起動時 §0 必読 docs Read 試行 → ファイル無し → 020 worktree から個別 Read 迂回
- dispatch-counter = 38（develop 当時の値）vs 実 counter = 242（020 期推移後）不整合
- 暫定対応 git checkout origin/workspace/a-main-020 -- docs/ で commit 190347d 293 files 取込で対処
- 構造的再発防止策 = base branch 必ず origin/workspace/a-main-N

###### How to apply

worktree 作成タイミング:
- 引越し前期セッション（a-main-N）が §A 引越し前チェック # 9 で実施（feedback_session_handoff_checklist §A v1.1）
- main 自身が PowerShell コマンド実行 or 東海林さんに依頼

NG パターン:
- git worktree add C:/garden/a-main-(N+1) -b workspace/a-main-(N+1) origin/develop（develop ベース、前期成果物未反映）
- base branch を指定せず作成（既存 branch にチェックアウト or HEAD ベース、状態不明）

OK パターン:
- git worktree add C:/garden/a-main-(N+1) -b workspace/a-main-(N+1) origin/workspace/a-main-N（前期 branch ベース、全成果物継承）

###### 関連

- memory feedback_session_handoff_checklist v1.1（§A 引越し前 # 9 連動、§B 起動時 # 9-10 連動）
- governance-rules-v1 §4 引越しチェックリスト（v1.1 改訂、本 memory 参照）
- handoff §3 dispatch counter テンプレ（counter 期待値明示 + 起動時検証）

###### 改訂履歴

- 2026-05-11 12:35 v1 ドラフト初版（a-analysis-001、main- No. 242 起源、5/11 020→021 引越し時発見、暫定対応 commit 190347d 完了済）

### 観点 5: governance 反映（governance-rules-v1 §4 改訂）

governance-rules-v1-20260509.md §4 引越しチェックリストに **worktree 作成手順 + docs 継承検証** を反映:

#### §4 改訂版

```
## 4. 引越しチェックリスト

docs/handoff-checklist.md 参照（v1.1 で 10 セクション化、worktree 作成手順 + docs 継承検証 追加）。

- §A 引越し前 10 項目: §1 git 実態 / §2 dispatch counter / §3 各モジュール稼働 / §4 memory 棚卸し / §5 違反集計（東海林さん追記欄）/ §6 厳しい目 3 ラウンド / §7 三点セット同期 / §8 RTK 報告 / **§9 worktree 作成（origin/workspace/a-main-N ベース必須、v1.1 新規）/ §10 docs 継承検証（v1.1 新規）**
- §B 起動時 10 項目: §B-1 通り（v1.1 で docs アクセス確認 + counter 整合確認 追加）

詳細: memory feedback_session_handoff_checklist v1.1 + feedback_main_session_worktree_setup_procedure v1
```

---

## 3. 統合改訂 4 ファイル（最終確定後 main 反映）

| # | 対象 | 改訂内容 | 自己参照禁止 |
|---|---|---|---|
| 1 | memory feedback_session_handoff_checklist | v1 → v1.1（§A # 9-10 追加 / §B # 9-10 追加 / Why に 5/11 020→021 引越し事故追記 / 改訂履歴）| 抵触なし |
| 2 | 新規 memory feedback_main_session_worktree_setup_procedure | v1 新規作成（全文起草済）| 抵触なし |
| 3 | governance-rules-v1 §4 | v1.1（§A / §B 各 10 項目化反映 + 関連 memory 参照追加）| 抵触なし |
| 4 | handoff テンプレ §3 | dispatch counter 整合検証手順追加（v1.1 新規）| 抵触なし |

---

## 4. 自己参照禁止 抵触検証

| # | 改訂対象 | 抵触判定 | 当事者性 |
|---|---|---|---|
| 1 | feedback_session_handoff_checklist | 全 session 共通 = a-analysis 自身の運用変更ではない、抵触なし | あり（a-analysis 自身も引越し時適用、ただし a-main 系の引越し手順）|
| 2 | 新規 memory worktree_setup_procedure | a-main セッション固有 = a-analysis 自身の運用変更ではない、抵触なし | 低（a-analysis 引越しは別 template、a-memory-handoff-template 参照）|
| 3 | governance-rules-v1 §4 | 全 session 共通 governance、抵触なし | あり |
| 4 | handoff テンプレ §3 | 同上 | あり |

総合: 全 4 件、a-analysis 自身の運用ルール変更には抵触しない。a-main 系の引越し手順改訂が主。a-analysis 自身の引越し手順は a-memory-handoff-template 別途参照（020 期で起草済）。

---

## 5. main / a-audit / 東海林さん 採否仰ぎ事項

| # | 判断事項 | 推奨 |
|---|---|---|
| 1 | 観点 1+4 統合（新規 memory worktree_setup_procedure 新設）| ✅ 採用推奨、独立 memory で worktree 作成の構造的問題を専門化 |
| 2 | 観点 2 (§B # 9-10 追加 docs アクセス + counter 整合) | ✅ 採用推奨、§0 ロック強化で構造的再発防止 |
| 3 | 観点 3 handoff §3 テンプレ拡張 | ✅ 採用推奨、counter 期待値明示で起動時検証可能化 |
| 4 | 観点 5 governance §4 改訂 | ✅ 採用推奨、10 項目化で governance 整合 |
| 5 | 即時反映タイミング | 5/11 中即時反映推奨（次回 021 → 022 引越し時に効果発揮、再発防止 critical path）|
| 6 | a-audit critique 依頼可否 | 推奨、a-audit 同時依頼（main- No. 243）で独立検証 + incident-pattern-log 蓄積 |

---

## 6. 関連 incident-pattern-log 候補（a-audit へ申し送り）

a-audit 起動時に `docs/incident-pattern-log.md` 蓄積候補:

| Pattern | 内容 |
|---|---|
| 引越し時 worktree base branch 選定誤り | a-main-(N+1) worktree 作成時、develop ベース選定で前期成果物未反映、起動時 §0 ロック中に発見、暫定対応で commit 取込 |
| dispatch-counter.txt 不整合 | base branch 選定誤りの派生事故、counter 値が古い値（38）vs 実 counter（242）|
| 構造的再発リスク | 今後の 021 → 022 等で同様再発、本 memory + governance 改訂で構造的再発防止 |

---

## 7. 改訂履歴

- 2026-05-11 12:35 v1 ドラフト初版（a-analysis-001、main- No. 242 起源、5/11 020→021 引越し時事故、暫定対応 commit 190347d 完了済、構造的再発防止策 5 観点 + 4 改訂対象統合）
