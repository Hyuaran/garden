# dispatch main- No. 297 — a-memory へ A-RP-1 新規 memory `feedback_migration_apply_verification` 起草 + C-RP-1 既存 memory `feedback_module_round_robin_check` 改訂 依頼

> 起草: a-main-023
> 用途: a-analysis-001 # 11 の即時 GO 採択された 2 件の memory 改訂を a-memory に正規ルートで依頼（main 直接編集の緊急 bypass 範囲外）
> 番号: main- No. 297
> 起草時刻: 2026-05-11(月) 17:30

---

## 投下用短文（東海林さんがコピー → a-memory にペースト）

~~~
🔴 main- No. 297
【a-main-023 から a-memory への dispatch（A-RP-1 新規 memory + C-RP-1 既存 memory 改訂 2 件 即時起草依頼、東海林さん即時 GO 採択済）】
発信日時: 2026-05-11(月) 17:30

# 件名
🔴 a-analysis-001 # 11 で起案された A-RP-1（新規 memory feedback_migration_apply_verification）+ C-RP-1（既存 memory feedback_module_round_robin_check 改訂、analysis/audit 含めて 10 セッション化）を即時起草依頼。東海林さん即時 GO 採択済（5/11 17:25）、緊急度 🔴

# A. 起草依頼背景

## A-1. 事故源
- 5/11 14:30-17:00 Tree D-01 apply 試行で 42830 エラー
- 真因 = root_employees.employee_number UNIQUE 制約が garden-dev に未適用
- PR #157 GitHub merge 完了 / Supabase apply 完了 = 別アクション、handoff §5「✅ merged + apply」記述が誤り
- audit-001 # 15 横断監査で全モジュール 25/31 件 = 80% apply 漏れ確定

## A-2. 関連 RP
- a-analysis-001 # 11 で 3 軸構造分析完了、RP 11 件起案
- 東海林さん採択: A-RP-1（🔴 緊急） + C-RP-1（🔴 緊急） を即時 GO（5/11 17:25）
- 他 RP は中期（B-RP, A-RP-2/3/4, C-RP-2/3 等）= 後続 dispatch で順次依頼

# B. 依頼内容 1: A-RP-1 新規 memory 起草

## B-1. memory 名
feedback_migration_apply_verification

## B-2. 目的
PR merge を「apply 完了」と誤認しないための運用ギャップ明文化 + 検証手順テンプレ提供

## B-3. 内化すべき要点
| 項目 | 内容 |
|---|---|
| 1 PR merge ≠ apply | GitHub merge と Supabase 実 DB 反映は別アクション。merge 後に必ず apply 検証必要 |
| 2 検証手段 | REST API（curl + .env.local SERVICE_ROLE_KEY）、psql、Supabase Dashboard スクショ、または audit script 出力 |
| 3 検証タイミング | PR merge 後 24h 以内 + handoff §5 記述前必須 + 同 dispatch 報告時 |
| 4 「apply 完了」記述要件 | 検証エビデンス必須（コマンド出力 or スクショ path or script 出力）|
| 5 silent NO-OP 罠 | `CREATE TABLE IF NOT EXISTS` で既存テーブル衝突時に schema 修正されない罠の検知手順 |
| 6 用語統一 | branch commit / push / PR merged / Supabase apply の 4 状態を明確に区別表記 |
| 7 違反検知時の即動作 | handoff 起草前 sentinel チェック + 違反時 memory 再読 + 内化確認返答 + 次タスク再現性検証 |

## B-4. 関連既存 memory
- feedback_session_handoff_checklist（§5 違反集計連動）
- feedback_check_existing_impl_before_discussion v2（議論前 / 修正前 / 外部依頼前 3 トリガー連動）
- feedback_strict_recheck_iteration（厳しい目で再確認 N ラウンド連動）

## B-5. 起草フォーマット
他 feedback 系 memory と同一（name / description / type / originSessionId / ルール / Why / How to apply / 関連 / 改訂履歴）

# C. 依頼内容 2: C-RP-1 既存 memory 改訂

## C-1. memory 名
feedback_module_round_robin_check

## C-2. 改訂要点
| 項目 | 内容 |
|---|---|
| 1 対象セッション拡張 | 8 セッション → 10 セッション（a-bloom / a-bud / a-soil / a-leaf / a-root / a-tree / a-forest / a-rill + **a-analysis-001** + **a-audit-001**）|
| 2 自己参照禁止抵触 自覚 | C-RP-1 は a-analysis-001 / a-audit-001 自身の運用変更（被監視対象化）= §7-1 抵触領域、a-audit 独立検証推奨 |
| 3 30 分巡回時の確認項目 | 既存（最終 commit 時刻 / 待機状態）+ 新規（analysis / audit の dispatch 投下件数 / 待機 30 分超過検知）|
| 4 sentinel # 8 連動 | 「a-analysis / a-audit 待機時間 30 分超過？」（C-RP-2 ペンディング、本改訂とは別件として後続依頼）|
| 5 改訂履歴 | 5/11 改訂、a-analysis-001 # 11 C-RP-1 採択、自己参照禁止抵触明示 |

## C-3. 既存 memory パス
`C:\Users\shoji\.claude\projects\C--garden-a-main\memory\feedback_module_round_robin_check.md`

## C-4. 改訂時の留意
- 既存 8 モジュール記述を破壊せず、analysis / audit を追加する形
- 自己参照禁止抵触領域（C 軸 C-RP）の自覚を明示
- 30 分巡回ペースは既存と同じ、対象拡張のみ

# D. 起草成果物の納品先

| 項目 | パス |
|---|---|
| A-RP-1 新規 memory | `C:\Users\shoji\.claude\projects\C--garden-a-main\memory\feedback_migration_apply_verification.md`（新規）|
| C-RP-1 改訂 memory | `C:\Users\shoji\.claude\projects\C--garden-a-main\memory\feedback_module_round_robin_check.md`（既存上書き）|
| MEMORY.md 索引追加 | a-memory が新規 memory 行を追加 |
| 改訂履歴 | 各 memory 内に追記 |

# E. main + 東海林さん最終決裁

a-memory が起草完了 → main- No. NNN で main へ報告 → main + 東海林さん最終決裁 → main が登録（memory ファイル編集）。a-memory は起草・提案のみ、最終登録は main 主導（memory feedback_a_memory_session_collaboration § 5 準拠）。

# F. ACK 形式（a-memory → main）

冒頭 3 行（🔴 memory-001- No. NN / a-memory → a-main-023 / 発信日時）+ ~~~ ラップ + 表形式 + 起草成果物 2 件 + main + 東海林さん最終決裁仰ぎ + self-check。

# G. 緊急度

🔴 最緊急（Tree D-01 事故 + apply 漏れ 80% への構造的対処、5/12 以降の各モジュール apply 修復前提）

# H. 期待する応答（memory-001- No. NN）

| 順 | 内容 |
|---|---|
| 1 | memory-001- No. N-ack: 「297 受領、A-RP-1 + C-RP-1 起草着手」（軽量 ack）|
| 2 | memory-001- No. N+1: A-RP-1 + C-RP-1 起草完了報告（main + 東海林さん最終決裁仰ぎ）|
| 3 | main 採択 → main が memory ファイル登録 → a-memory に登録完了通知 |

# I. self-check
- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A 起草依頼背景（事故源 + 関連 RP）
- [x] B A-RP-1 新規 memory 詳細（B-1 名 / B-2 目的 / B-3 要点 7 項目 / B-4 関連 / B-5 フォーマット）
- [x] C C-RP-1 既存 memory 改訂詳細（C-1 名 / C-2 改訂要点 5 項目 / C-3 パス / C-4 留意）
- [x] D 納品先 明示
- [x] E main + 東海林さん最終決裁ルート明示
- [x] F ACK 形式
- [x] G 緊急度 🔴
- [x] H 期待する応答
- [x] 番号 = main- No. 297
~~~

---

## 詳細（参考、投下対象外）

### 1. 投下後の流れ
1. a-memory 受領 → A-RP-1 + C-RP-1 起草着手（subagent 並列推奨、2 件並列で 20-30 分想定）
2. memory-001- No. NN で main 報告 + 最終決裁仰ぎ
3. main + 東海林さん採択 → main 編集（または「軽微 bypass 範囲外」のため main 手動編集 + a-memory 確認）
4. MEMORY.md 索引更新（main が同時実施）

### 2. 連動 dispatch
- # 292 (a-analysis-001 引越し不要訂正 + A-RP-1 / C-RP-1 a-memory 経由起草支援)
- # 293 (a-audit-001 引越し不要訂正 + audit-migration-apply-status.py 実装着手)
- # 294 (a-soil-002 soil_call_history 衝突解消 + Phase B-01 8 件 apply 戦略起草)
- # 295 (a-bud-002 Phase D 14 件 apply 状況確認 + 修復計画起草)
- # 296 (a-leaf-002 Leaf 本体 migration 特定 + apply 状況確認 + 修復計画起草)

### 3. 起草時の留意（a-memory 内部用）
- 自己参照禁止抵触領域（C-RP-1 = a-analysis / a-audit 自身の運用変更）を明示
- B-3 # 5 silent NO-OP 罠は audit-001 # 15 発見の Tree D-01 + soil_call_history 2 件を実例として
- B-3 # 6 用語統一は audit-001 # 15 セクション 3-1 と整合（commit 済 / push 済 / PR merged / apply 完了 の 4 状態）

### 4. 5/18 1 週間 critical path 影響
- ⑥ Tree UI 移行 = Tree D-01 apply 完了済、本 memory 強化で再発防止
- 全モジュール = apply 漏れ修復が本 memory 起草後により確実に進行
