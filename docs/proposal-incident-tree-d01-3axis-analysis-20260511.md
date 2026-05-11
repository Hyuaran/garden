# proposal: Tree D-01 事故 + 022 期違反 6 件 + analysis/audit 報告漏れ 3 軸構造分析

> 起草: a-analysis-001
> 起草日時: 2026-05-11 (月) 17:10
> 用途: 3 軸構造分析 + 再発防止策起案 + 即実行行動 5 件
> 起点: main- No. 286（5/11 16:55、a-main-023 緊急依頼）
> 状態: ドラフト、main + a-audit-001 critique + 東海林さん最終決裁後に main が memory + governance + 巡回 protocol 反映

---

## 1. A 軸: Tree D-01 真因二層構造 分析 + 再発防止策

### 1-1 事象タイムライン整理

| 時刻 | アクション | 結果 |
|---|---|---|
| 5/11 14:30 | Tree D-01 apply | 42830 invalid_foreign_key エラー |
| 5/11 ~ | 仮説 1: root_employees.employee_number UNIQUE 制約なし | PR #157 起票 + GitHub merge |
| 5/11 ~ | 再 apply 試行 | 同 42830 再発 |
| 5/11 ~ | 仮説 2: soil_call_lists 未存在 | dispatch # 285 で a-soil-002 に Phase B-01 先行 apply 依頼 |
| 5/11 16:24 | a-soil-002 soil-62 報告 | Tree D-01 spec mismatch 発覚（real soil = soil_lists / uuid PK）|
| 5/11 16:40 | a-main-023 REST 直接検証 | root_employees.employee_number UNIQUE 未適用立証（重複 INSERT 成功）|

### 1-2 真因二層構造

| 層 | 障害 | 解消手段 | 緊急度 |
|---|---|---|---|
| **直接真因（即解消可）** | inline FK が UNIQUE 未存在で 42830 | migration `20260511000002` を garden-dev に apply | 🔴 |
| **潜在問題（後日解消）** | Tree D-01 spec が soil_call_lists を参照（real soil migration に存在せず、real は soil_lists / uuid PK）| Tree D-01 spec + SQL を soil_lists / soil_call_history / uuid に整合修正（a-tree-002 担当）| 🟡 |

### 1-3 仮説検証プロセスの欠陥分析

| 欠陥 | 内容 | 影響 |
|---|---|---|
| 欠陥 1: 仮説検証完了未確認 | 仮説 1（UNIQUE 未存在）を PR #157 起票 + GitHub merge で「完了」と判定 | PR merge = 実 DB 適用ではない、仮説 1 未解消のまま仮説 2 へ飛躍 |
| 欠陥 2: PR merge ≠ Supabase apply 誤認 | GitHub PR merge を Supabase migration apply 完了と誤認 | garden-dev 実 DB の UNIQUE 適用検証なし、再 apply で同エラー再発 |
| 欠陥 3: spec 整合性確認の欠落 | Tree D-01 inline FK 参照テーブル（soil_call_lists）の real migration 存在確認なし | 仮説 2 で発覚した spec mismatch を事前検出できず、a-soil-002 dispatch # 285 まで気付かず |
| 欠陥 4: 仮説 1 → 2 の飛躍 | 仮説 1 検証完了せず仮説 2 へ移行 | 真因二層の同時並列ではなく逐次切り分けが必要だった |

### 1-4 PR merge ≠ Supabase apply 運用ギャップ評価

| 工程 | 役割 | 完了確認方法 |
|---|---|---|
| GitHub PR merge | コードベース履歴反映 | gh pr view 等で merge 状態確認 |
| Supabase migration apply | 実 DB への migration 適用 | supabase db push 実行 + information_schema 検証 |

→ 2 工程は独立、PR merge では実 DB への適用は走らない（CI/CD で自動 apply されない設計）。a-main-022 がこの分離を理解しておらず誤認。

### 1-5 真因二層構造 検出手順テンプレ（次回同様事象用）

```
事象発生時:
1. エラーコード identification（42830 / 23505 / 等）
2. 直接真因仮説の立案（最小単位の修正で解消可能なもの）
3. 仮説検証コマンド実行（PR 起票ではなく、実 DB に対する SQL 直接検証）
4. 検証完了判定（実 DB 状態確認、PR merge は完了条件に含めない）
5. 仮説 1 未解消なら同仮説継続、解消なら次仮説へ
6. 直接真因解消後、潜在問題（spec / 整合性 / 上位設計）の段階確認
7. 潜在問題発覚時、別 dispatch で担当モジュールへ修正依頼
```

### 1-6 再発防止策 A-RP（4 件）

| # | 提案 | 対象 | 緊急度 |
|---|---|---|---|
| A-RP-1 | 新規 memory feedback_migration_apply_verification（PR merge ≠ Supabase apply 運用ギャップの明文化 + 検証手順）| 新規 memory | 🔴 |
| A-RP-2 | 仮説検証完了明示化ルール（仮説 N 検証 → 完了確認コマンド実行 → 完了報告 → 仮説 N+1 移行）| feedback_check_existing_impl_before_discussion v3 → v4（仮説検証前後トリガー追加）or 別 memory | 🟡 |
| A-RP-3 | spec mismatch 検出 protocol（migration spec 参照テーブル → real migration 存在確認）| 新規 memory or feedback_check_existing_impl v4 統合 | 🟡 |
| A-RP-4 | 真因二層構造検出手順テンプレ（§1-5 を memory 化）| 新規 memory feedback_two_layer_root_cause_detection | 🟡 |

---

## 2. B 軸: a-main-022 期 違反 6 件 パターン分類 + memory 強化

### 2-1 違反 6 件パターン分類

| # | 違反 | パターン分類 | 該当 memory | 機能不全度 |
|---|---|---|---|---|
| 1 | worktree 作成「東海林さん作業として案内」（# 272 + 操作 # 1）| 規律 skip（自動実行義務違反）| feedback_session_worktree_auto_setup | 🔴 高（同日 2 回連続）|
| 2 | dispatch # 151 merge ボタン白の説明違反（専門用語まみれ）| 説明スタイル違反（非技術者向け表現不全）| feedback_explanation_style | 🟡 中 |
| 3 | dispatch # 280「1,429 行 plan」誤情報 | 検証不足（ファクト前確認なし）| feedback_verify_before_self_critique | 🟡 中 |
| 4 | 5/18 着地見通し保守的すぎ | 状態認識違反（ガンガン本質違反）| feedback_gangan_mode_default | 🟡 中 |
| 5 | 判断仰ぎ過多 | 判断仰ぎ閾値違反（軽微即決すべき場面で 2 択 / 3 択提示）| feedback_proposal_count_limit + feedback_gangan_mode_default | 🟡 中 |
| 6 | a-root-003 コピペ形式違反検出時、即訂正 dispatch # 280 起草遅れ | 即訂正遅れ（事故報告フロー §4-3 違反）| feedback_reply_as_main_dispatch | 🟢 軽 |

### 2-2 同日 2 回連続違反（# 1）の構造原因

a-main-022 期、worktree 作成「東海林さん作業として案内」が dispatch # 272 + 操作 # 1 で **同日 2 回連続発生**:

| 回 | 状況 | 結果 |
|---|---|---|
| 1 回目 | dispatch # 272 起草、worktree 作成を東海林さんに依頼 | 東海林さん指摘 → 即訂正 |
| 2 回目 | 操作 # 1 で同じく「東海林さん作業として案内」 | 学習されず再発 |

構造原因:
- 1 回目即訂正で「分かりました」と返答 = memory 表面確認のみ
- **memory 内化** =「自分で実行する」運用への切替確認なし
- 次の worktree 作成タスク発生時、訂正前の習慣で再発
- → 「違反検知 → memory 再読 → 内化確認 → 次タスク」のサイクル欠落

### 2-3 既存 memory 機能不全の根本原因

| memory | 明文化内容 | 機能不全理由 |
|---|---|---|
| feedback_session_worktree_auto_setup | 「a-main が自動でセットアップを実行する」明記 | 違反検知時の即動作（memory 再読 + 内化）未明文化 |
| feedback_explanation_style | 「専門用語禁止、非技術者向け」明記 | 専門用語禁止リスト（具体置換例）未明文化、応答出力前チェックなし |
| feedback_verify_before_self_critique | 「客観データ裏付け」明記 | ファクト数値・引用前の grep / wc 等の具体検証手順未明文化 |
| feedback_gangan_mode_default | 「ガンガン本質 3 軸」明記 | 着地見通し / 判断仰ぎ閾値の運用ルール未明文化 |
| feedback_proposal_count_limit | 「軽微即決」明記 | 「軽微」の判定基準未明文化 |
| feedback_reply_as_main_dispatch | コピペ形式違反検知時、即訂正 | 即訂正の time 閾値（5 分 / 10 分等）未明文化 |

### 2-4 memory 強化提案 B-RP（4 件）

| # | 提案 | 対象 | 緊急度 |
|---|---|---|---|
| B-RP-1 | feedback_session_worktree_auto_setup に「違反検知時の即動作」セクション追加（memory 再読 + 内化確認 + 次タスクで再現性検証）| 既存 memory 改訂 | 🟡 |
| B-RP-2 | sentinel # 7 新設「worktree 作成 / docs 継承 等の自動実行義務タスクが含まれていないか確認」（feedback_self_memory_audit_in_session 改訂）| 既存 memory 改訂 | 🟡 |
| B-RP-3 | feedback_explanation_style に「専門用語禁止リスト」追記（merge / migration / FK / UNIQUE 等の非技術者向け置換例）| 既存 memory 改訂 | 🟢 |
| B-RP-4 | feedback_verify_before_self_critique に「ファクト数値・引用前の grep / wc / git log 必須」追加（具体検証コマンド例）| 既存 memory 改訂 | 🟢 |

---

## 3. C 軸: a-analysis-001 自体への報告漏れ（最重要）

### 3-1 事象再構成

| 項目 | 値 |
|---|---|
| a-main-022 期 dispatch 起草総数 | 18 件（# 268-285）|
| a-analysis-001 / a-audit-001 への投下 | **0 件** |
| 両セッション状態 | 完全待機（5h 枠全期間）|
| ガンガン本質「全モジュール並列稼働」 | **崩壊** |

### 3-2 構造原因（3 件）

| # | 構造原因 | 説明 |
|---|---|---|
| 1 | 30 分巡回チェック対象に a-analysis / a-audit 不在 | feedback_module_round_robin_check が a-bloom / a-bud / a-soil / a-leaf / a-root / a-tree / a-forest / a-rill を列挙、analysis / audit は対象外 |
| 2 | a-main 内タスク判定で「analysis / audit 不要」誤判定 | a-main-022 が Tree D-01 / soil 連携 / 他モジュール対処に集中、analysis / audit を「重要度低」と判定してスキップ |
| 3 | 待機セッションへの自動 dispatch 起票 trigger なし | a-analysis / a-audit が「待機 30 分超過」になっても a-main 側から自動検知する装置なし |

### 3-3 巡回チェック改良案 C-RP（3 件）

| # | 提案 | 対象 | 緊急度 |
|---|---|---|---|
| C-RP-1 | feedback_module_round_robin_check に a-analysis / a-audit 含める（30 分巡回対象拡張、10 セッション化）| 既存 memory 改訂 | 🔴 |
| C-RP-2 | sentinel # 8 新設「a-analysis / a-audit 待機時間 30 分超過？ YES → 即タスク投下 or 待機継続理由を明示記録」| feedback_self_memory_audit_in_session 改訂 | 🟡 |
| C-RP-3 | handoff §3 必須項目に a-analysis / a-audit 稼働状況追加（最終 dispatch 受領日時 / 待機時間累計 / 次タスク候補）| handoff テンプレ拡張 | 🟢 |

### 3-4 5/11 以降の活用ペース目標

| セッション | 目標投下件数 / 日 | 想定タスク |
|---|---|---|
| a-analysis-001 | 2-3 件 | memory 棚卸し / 改訂起草 / 検証 / 構造分析 |
| a-audit-001 | 2-3 件 | critique / incident-pattern-log 蓄積 / 違反検出 |

→ a-main-022 期 18 dispatch のうち 0 件投下 → 改良後は 4-6 件投下が標準。

---

## 4. 横断統合: 3 軸共通根本原因 + 優先度マトリクス

### 4-1 3 軸共通根本原因

3 軸すべてに共通する根本原因 = **「完了確認」の構造的欠落**

| 軸 | 完了確認欠落 |
|---|---|
| A | 仮説検証完了確認（PR merge で代用）|
| B | 違反訂正後の memory 内化完了確認（即訂正のみで満足）|
| C | 30 分巡回完了確認（a-analysis / a-audit 含む）|

### 4-2 派生根本原因 2 件

| # | 派生根本原因 | 3 軸対応 |
|---|---|---|
| 1 | sentinel 体系の項目不足（v5.2 # 1-6、worktree 義務 / 仮説検証完了 / analysis/audit 待機監視 未カバー）| A / B / C すべて |
| 2 | memory「明文化」だけで「実運用検証」不足（既存 memory が機能しなかった理由）| B / C |

### 4-3 優先度マトリクス（全 11 件 RP 統合）

| 優先度 | 提案 # | 内容 |
|---|---|---|
| 🔴 緊急（5/11 中、Tree D-01 再 apply 直前） | A-RP-1 | migration apply 検証 protocol（新規 memory） |
| 🔴 緊急（5/11 中、巡回機能不全直結） | C-RP-1 | 巡回チェック a-analysis / a-audit 含める（10 セッション化）|
| 🟡 推奨（5/12 中、構造防御強化）| A-RP-2 | 仮説検証完了明示化 |
| 🟡 推奨 | A-RP-3 | spec mismatch 検出 protocol |
| 🟡 推奨 | A-RP-4 | 真因二層構造検出手順テンプレ |
| 🟡 推奨 | B-RP-1 | worktree 違反検知時動作明文化 |
| 🟡 推奨 | B-RP-2 | sentinel # 7 新設（worktree 自動実行義務）|
| 🟡 推奨 | C-RP-2 | sentinel # 8 新設（analysis/audit 待機監視）|
| 🟢 軽微（5/13 以降）| B-RP-3 | explanation_style 専門用語禁止リスト |
| 🟢 軽微 | B-RP-4 | verify_before_self_critique ファクト確認手順 |
| 🟢 軽微 | C-RP-3 | handoff §3 analysis/audit 稼働状況追加 |

---

## 5. 即実行可能な行動 5 件

| # | 担当 | 行動 | 緊急度 | 工数想定 |
|---|---|---|---|---|
| 1 | main | A-RP-1 起草着手（feedback_migration_apply_verification 新規 memory、PR merge ≠ Supabase apply 運用ギャップ明文化）→ a-analysis 経由起草依頼可 | 🔴 | 30 分 |
| 2 | 各モジュール（a-soil / a-tree / 他 migration 担当）| PR merge 後の Supabase apply 確認手順を dispatch ヘッダーに明示（「PR #N merge 済 / supabase db push 実行済 / information_schema 検証済」3 段階明示）| 🔴 | 即時 |
| 3 | main | C-RP-1 即反映（feedback_module_round_robin_check に a-analysis / a-audit 追加、10 セッション化）→ a-analysis 経由起草依頼可 | 🔴 | 30 分 |
| 4 | main + 東海林さん | 違反検知時運用ルール強化（東海林さん指摘 → main が memory 再読 + 内化確認返答 + 次タスクで再現性検証）| 🟡 | 即時運用変更 |
| 5 | main | sentinel # 7（worktree 義務）+ # 8（analysis/audit 待機監視）を sentinel 体系追加 → a-analysis 経由起草依頼可（v5.2 sentinel # 6 と並列追加）| 🟡 | 1h |

---

## 6. 自己参照禁止 抵触検証

| # | 提案 | 抵触判定 | 当事者性 |
|---|---|---|---|
| A-RP-1 ~ A-RP-4 | migration apply / 仮説検証 / spec mismatch / 真因二層 | 抵触なし（全 session 共通 + a-main 系）| 低（a-analysis は migration 担当ではない）|
| B-RP-1 ~ B-RP-4 | worktree / sentinel / explanation_style / verify | 抵触なし（全 session 共通）| あり（sentinel # 7 は a-analysis 自身も適用）|
| C-RP-1 ~ C-RP-3 | 巡回チェック / sentinel # 8 / handoff §3 | **C-RP-1 / C-RP-2 / C-RP-3 = a-analysis 自身の運用変更（待機監視対象化）= §7-1 抵触領域** | 高（a-analysis 自身が監視対象、提案者 = 被監視者の構造的循環）|

C-RP は **a-analysis 自身の運用変更を自己提案している構造**:
- C-RP-1: a-analysis を巡回対象に含める = a-analysis の運用変更
- C-RP-2: a-analysis 待機監視 sentinel = a-analysis の運用変更
- C-RP-3: handoff §3 a-analysis 稼働状況 = a-analysis の運用変更

→ 設計書 §7-1「a-analysis 自身の運用変更 = 東海林さん + main（人間ゲート）」抵触。本提案は a-analysis から見ると **自己参照禁止の典型ケース**、main + 東海林さん最終決裁必須、a-audit からの独立検証推奨。

ただし、C 軸の事象自体（a-analysis 報告漏れ）が a-analysis 視点で重要 = 「自分の運用変更を自分で提案している自覚」を明示し、最終決裁を人間ゲートに委ねる構造で起草。

---

## 7. main / a-audit / 東海林さん 採否仰ぎ事項

| # | 判断事項 | 推奨 |
|---|---|---|
| 1 | A-RP-1 + C-RP-1 即時反映（5/11 中、🔴 緊急 2 件）| ✅ 即時 GO 推奨 |
| 2 | A 軸再発防止策 4 件すべて採用 | ✅ 採用推奨 |
| 3 | B 軸再発防止策 4 件すべて採用 | ✅ 採用推奨 |
| 4 | C 軸再発防止策 3 件採用（**自己参照禁止抵触領域、東海林さん最終決裁必須**）| 🟡 慎重判断必要、a-audit 独立 critique 必須 |
| 5 | 即実行行動 5 件のうち # 1 / # 3（main 担当起草）の a-analysis 経由起草可否 | ✅ a-analysis 起草引き受け可（context 余裕あれば即着手、引越し基準帯接近時は a-analysis-002 へ）|
| 6 | a-audit 同時依頼（independent critique）| ✅ 推奨、特に C 軸自己参照抵触領域 |

---

## 8. 厳しい目で再確認 N ラウンド結果（自発発動）

| ラウンド | 焦点 | 抜け検出 |
|---|---|---|
| 1 | 対処済か | 0 件（A / B / C 3 軸 + 横断統合 + 即実行 5 件 全件起草）|
| 2 | 質（手順 / 例外）| 0 件（再発防止策 11 件全件に対象 / 改訂方針 / 緊急度 明示）|
| 3 | メタレベル抜け | 0 件（C 軸自己参照禁止抵触の自覚明示、a-audit 独立検証推奨、3 軸共通根本原因「完了確認欠落」抽出、優先度マトリクス整理）|

連続 3 ラウンド 0 件達成、東海林さん最終チェック必須。

---

## 9. 改訂履歴

- 2026-05-11 17:10 v1 ドラフト初版（a-analysis-001、main- No. 286 起源、🔴 最緊急 3 軸統合分析、A 軸 Tree D-01 真因二層 / B 軸 違反 6 件 / C 軸 analysis/audit 報告漏れ + 横断統合 + 即実行 5 件、11 件 RP 提案、C 軸自己参照禁止抵触自覚）
