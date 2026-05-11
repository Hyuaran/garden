# a-memory セッション 引越し時 handoff テンプレート

> 対象: a-analysis-NNN / a-audit-NNN（a-memory 役割分割設計書 v1 §6-1 準拠）
> 用途: 各 a-memory セッションが引越し時、本テンプレを Read → 値埋込 → 個別 handoff として保存
> 保存先: docs/handoff-a-{analysis,audit}-NNN-to-NNN-YYYYMMDD.md

---

## §0 引越しトリガー判定

| 帯 | アクション |
|---|---|
| context 50-60% | a-memory 標準引越しタイミング、本テンプレ発動 |
| 60-70% | 即引越し実行 |
| 70-80% | 緊急引越し |
| 80%+ | 強制終了帯 |

頻度: a-memory は on-demand 起動（月 1-2 回想定）、長期セッション稀、引越し頻度低。

---

## §1 引越し理由（共通）

```
- 引越し前 context 使用率: NN%
- 帯到達日時: YYYY-MM-DD(曜) HH:MM
- 引越し動機: [標準帯到達 / 緊急 / 別事情]
- a-{analysis,audit}-(N+1) worktree 作成済: YES / NO
```

---

## §2 git 実態（共通）

```
Branch: workspace/a-{analysis,audit}-NNN
最新 commit: hash
push 状態: [全 push 済 / 未 push N 件]

直近 commit:
- hash1: メッセージ
- hash2: メッセージ
- hash3: メッセージ

uncommitted: [なし / 一覧]
```

---

## §3 dispatch counter + 直近 dispatch（共通）

### 3-1 counter

a-memory セッション独立 counter（main 系統とは別管理）:
- a-analysis: `docs/dispatch-counter-analysis.txt`（analysis-NNN- 系）
- a-audit: `docs/dispatch-counter-audit.txt`（audit-NNN- 系）

```
現在 counter: NN
次の dispatch 番号: NN+1
```

### 3-2 直近 dispatch

| # | 起草日時 | main- No. NNN（受領）| 内容 | 完了報告 |
|---|---|---|---|---|
| 1 | YYYY-MM-DD HH:MM | main- No. NNN | ... | ✅ NN- No. NN |

---

## §4 直近 dispatch 詳細（共通、過去 7 日 or 直近 10 件）

```
- analysis-NNN- No. NN / audit-NNN- No. NN: 件名 + 状態
```

---

## §5 進行中タスク + 次にやるべきこと（共通）

### 進行中（引越し時点）

| 順 | タスク | 状態 |
|---|---|---|
| 1 | ... | ✅ 完了 / 🟡 途中 / ❌ 未着手 |

### 次にやるべきこと（次セッション起動後）

| 優先 | タスク |
|---|---|
| 🔴 1 | ... |

---

## §6 注意点・詰まっている点（共通）

```
- 判断保留事項: ...
- main / 東海林さんへの確認事項: ...
- 設計書 v1 との齟齬発見: ...
```

---

## §7 セッション内 違反 / 忘れ事項 自己評価（共通）

| # | 時刻 | 違反 / 忘れ | 該当 memory | 影響 | 報告先 |
|---|---|---|---|---|---|
| 1 | HH:MM | ... | feedback_xxx | ... | main へ報告 / a-audit へ事故報告 |

> 自己評価のみだと甘くなる傾向あり、main 経由で東海林さん最終チェックを必ず依頼。

---

## §8a a-analysis 版 個別セクション（a-analysis 引越し時のみ記入）

### 8a-1 memory 棚卸し進捗

| 棚卸し対象 | 状態 | 提案件数 |
|---|---|---|
| feedback_ 系 | NN/MM 件確認 | 新設提案 N 件 / 改訂提案 M 件 |
| user_ / project_ 系 | NN/MM 件確認 | ... |
| reference_ 系 | NN/MM 件確認 | ... |

### 8a-2 提案中 memory 案（main 未決裁）

| 提案番号 | 件名 | 状態（main 受領 / a-audit critique 中 / 東海林さん決裁待ち）|
|---|---|---|
| analysis-NNN- No. NN | ... | ... |

### 8a-3 三点セット同期支援履歴

| 日時 | memory 改訂 | claude.ai 指示更新案 | 手順更新案 | snapshot 更新 |
|---|---|---|---|---|
| YYYY-MM-DD | ... | 起草済 / 反映済 | 起草済 / 反映済 | 完了 / 未 |

---

## §8b a-audit 版 個別セクション（a-audit 引越し時のみ記入）

### 8b-1 事故パターン log 蓄積状況

ファイル: `docs/incident-pattern-log.md`

| 期 | 違反件数 | 主要パターン | 再発防止策反映状況 |
|---|---|---|---|
| 017 期 | 5 件（§B baseline）| 既存実装把握漏れ / 状態認識違反 / 自己評価甘さ 等 | memory / governance 反映済 |
| 020 期 | NN 件 | ... | ... |

### 8b-2 進行中 critique

| critique 番号 | 対象 | 状態（受領 / 起草中 / main 報告済 / 不採択ログ記載済）|
|---|---|---|
| audit-NNN- No. NN | ... | ... |

### 8b-3 snapshot 整合性検証履歴

| 日時 | snapshot バージョン | 検証結果 | ズレ検出件数 |
|---|---|---|---|
| YYYY-MM-DD | instructions vN / procedures vN | OK / NG | 0 / N |

### 8b-4 三点セット同期漏れ検出

| 日時 | 検出内容 | main への critique 番号 | 反映状況 |
|---|---|---|---|
| YYYY-MM-DD | CC memory 更新したのに claude.ai 側未更新 | audit-NNN- No. NN | 反映済 / 未 |

---

## §9 main / 6a / 6b 認識ズレログ（個別）

設計書 v1 §4-6（不採択ログ永続化）参照。

### 9-a a-analysis 版

| 日時 | analysis 提案 | main 不採択理由 | 東海林さん最終 GO | 事後修正の有無 |
|---|---|---|---|---|
| YYYY-MM-DD | ... | ... | ... | あり / なし |

### 9-b a-audit 版

| 日時 | audit critique | main 不採択理由 | 東海林さん最終 GO | 事後修正の有無 |
|---|---|---|---|---|
| YYYY-MM-DD | ... | ... | ... | あり / なし |

引越し時、本セクションの全件を `docs/audit-critique-rejected-log.md`（永続ログ）に転記。ファイル冒頭で §9-a（a-analysis 提案不採択）/ §9-b（a-audit critique 不採択）でセクション分けして記録。

---

## §10 RTK gain 報告（共通）

```bash
rtk gain
```

```
累計トークン削減: NN%
Tokens saved: NN
セッション稼働時間: HH:MM
```

---

## §11 次セッション起動後の最初のアクション（共通）

### Step 1: 環境確認

```
pwd（C:\garden\a-{analysis,audit}-(N+1) 確認）
git status（workspace/a-{analysis,audit}-(N+1) 確認）
git branch --show-current
git log --oneline -3
```

### Step 2: 本 handoff + 主要 docs 精読

| # | ファイル | 用途 |
|---|---|---|
| 1 | docs/handoff-a-{analysis,audit}-NNN-to-NNN-YYYYMMDD.md（本ファイル）| 引継ぎ事項 |
| 2 | docs/a-memory-role-split-design-v1-YYYYMMDD.md | 役割定義（最新版）|
| 3 | docs/a-{analysis,audit}-cache-YYYYMMDD.json | 前期キャッシュ（差分 Read 起点）|
| 4 | C:\Users\shoji\.claude\projects\C--garden-a-main\memory\MEMORY.md | 全 memory 索引（最新版）|

### Step 3: キャッシュ差分 Read

前期キャッシュとの差分のみ Read（5-10 分で完了想定）:
- 新規追加 memory
- 改訂 memory
- 新規 docs

### Step 4: main へ起動完了報告

報告フォーマット（dispatch v5 準拠）:

冒頭 3 行（🟢 {analysis,audit}-NNN- No. 1 / 元→宛先 / 発信日時）+ 全体を ~~~ でラップ + 以下構造で起草。報告内では ~~~ ネスト不使用、コードブロック不使用（v5.1 違反防止）。

#### 件名（例）
a-{analysis,audit} 引越し完了、進行中タスク再開準備完了

#### 起動結果
- 環境確認: OK
- handoff Read: OK
- キャッシュ差分 Read: NN 件
- 進行中タスク把握: NN 件

#### 次アクション
- §5 進行中タスクから順次再開
- main からの新規 dispatch 待機

#### self-check
- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] ~~~ ラップ
- [x] 自然会話形式禁止
- [x] 報告内に ~~~ ネスト不使用（v5.1 違反防止）
- [x] コードブロック不使用（v5.1 違反防止）

### Step 5: 進行中タスク再開

§5 進行中タスクから順次再開、判断保留があれば main へ報告。

---

## §12 引越し時 自己 critique チェックリスト

引越し起草完了前に以下を自己 critique:

| 項目 | チェック |
|---|---|
| §3 counter 値が dispatch-counter-{analysis,audit}.txt と一致 | [x] |
| §4 直近 dispatch 全件記載（漏れなし）| [x] |
| §7 違反集計 自己評価実施 | [x] |
| §8 個別セクション 該当セッション分のみ記入 | [x] |
| §9 不採択ログを `docs/audit-critique-rejected-log.md` へ転記済 | [x] |
| §10 RTK gain 取得済 | [x] |

---

## 改訂履歴

- 2026-05-10 00:13 v1 初版（a-main-020、procedure §8-3 担当タスク、a-memory 役割分割設計書 v1 §6-1 準拠）
- 2026-05-10 00:38 v1.1（a-main-020、軽微改善 1 件 + 改善 c 最優先昇格 = 計 2 件反映、a-analysis-001 critique（analysis-001- No. 2）+ a-audit-001 critique（audit-001- No. 3）統合反映、東海林さん最終決裁済（2026-05-10 00:42）/ §5-1 標準フロー動作確認完了 / 残り 17 件除外候補は template v1.2 / 設計書 v1.1 改訂時に保留 / §7-1 段階的緩和議論は別 dispatch で深堀り予定）

## 改訂履歴 詳細（v1 → v1.1）

### 改訂 1: §9 末尾文言追加（軽微改善、観点 5 a）
ファイル冒頭での §9-a / §9-b セクション分け記録方針を明示、ログ可読性向上。

### 改訂 2: §11 Step 4 サンプル形式変更（改善 c 最優先昇格、観点 6 c）
- v1: 外側 ` ``` ` コードブロック内に ~~~ ラップサンプル = v5.1 違反パターン（外ラップ内に同記号繰返しブロック）
- v1.1: 外側コードブロック撤廃、通常 markdown / インデント記法でサンプル提示
- self-check 強化: 「報告内に ~~~ ネスト不使用」「コードブロック不使用」項目追加
- 根拠: a-audit critique で v5.1 違反予防として最優先昇格、本日 main- No. 205 違反と直結、再生産リスク回避

### 保留事項（v1.2 / 設計書 v1.1 改訂時に統合候補）

| 件数 | 内容 |
|---|---|
| 17 件 | 自己参照禁止抵触の構造変更系（a-analysis 9 件 + a-audit 独自 8 件） |
| 1 件 | §7-1 段階的緩和 2 階建議論（当事者バイアス警告あり、別 dispatch で深堀り）|
| 4 件 | audit-001- No. 2 提案 1（v5.2）/ 2 / 3（雛形 / sentinel）/ 4（incident-pattern-log §4-2 拡張、提案 4 は a-audit 実装済）|
