# dispatch main- No. 287 — a-audit-001 へ監査依頼（PR merge ≠ apply 完了 運用ギャップ + 他モジュール波及調査）

> 起草: a-main-023
> 用途: Tree D-01 事故の真因「PR merge ≠ Supabase apply 完了」運用ギャップを a-audit-001 で全モジュール横断監査依頼
> 番号: main- No. 287
> 起草時刻: 2026-05-11(月) 16:55

---

## 投下用短文（東海林さんがコピー → a-audit-001 にペースト）

~~~
🔴 main- No. 287
【a-main-023 から a-audit-001 への dispatch（PR merge ≠ Supabase apply 完了 運用ギャップ + 全モジュール波及調査依頼）】
発信日時: 2026-05-11(月) 16:55

# 件名
🔴 Tree D-01 事故で発覚した「PR merge ≠ Supabase apply 完了」運用ギャップを全モジュール横断で監査。同様の apply 漏れが他モジュール（Bud / Forest / Leaf / Root / Soil 等）に潜在していないか調査依頼

# A. 監査の発端

## A-1. 事象（Tree D-01 真因の一部）
- PR #157 (root_employees.employee_number UNIQUE) は GitHub で 5/11 merge 完了
- handoff §5 記述: 「✅ PR #157 merged + apply（root_employees.employee_number UNIQUE 制約追加完了）」
- 5/11 16:40 REST 直接検証: garden-dev に UNIQUE 制約が**未適用**（重複 INSERT 成功で立証）
- → handoff §5 記述は誤り。PR merge を完了とみなして apply を実施していなかった

## A-2. 構造的リスク
- migration ファイルが PR で merge されても、Supabase 本体 apply は別アクション
- 「PR merged」≠「DB に反映」を運用上区別できていない
- 他モジュールでも同様の apply 漏れが潜在している可能性

# B. 監査依頼内容

## B-1. 監査範囲

| 領域 | 監査ポイント |
|---|---|
| 全 migration ファイル | supabase/migrations/ 配下の全ファイルを garden-dev 実機状態と突合 |
| PR 履歴 | 過去 30 日の merged PR で migration 含むものを抽出、各 migration の apply 状況を実機検証 |
| 他モジュール波及 | Bud / Forest / Leaf / Root / Soil / Bloom / Tree 各モジュールの migration 適用状況 |
| handoff 記述 | a-main 系 handoff の「✅ apply 完了」記述の信頼性検証 |

## B-2. 検証手順（例）
- garden-dev 実機を REST or psql 直接接続で検証
- 既存 .env.local (例: C:/garden/a-soil-002/.env.local) の SERVICE_ROLE_KEY 経由 REST 検証
- information_schema / pg_constraint で制約・テーブル存在確認

## B-3. 期待する成果物

| 項目 | 内容 |
|---|---|
| 1 | apply 漏れ migration 一覧（モジュール別 / 重要度別） |
| 2 | apply 漏れの即時修復案（apply 順序 + 検証 SQL） |
| 3 | PR merge → apply 完了の運用ルールセット提案（チェックリスト / 自動検証スクリプト） |
| 4 | handoff 記述の信頼性改善案（「apply 完了」と書く前提条件の明確化） |
| 5 | 全モジュールへの横展開 dispatch 提案（各モジュールがやるべきアクション） |

# C. 既知情報（監査開始時の前提）

| 既知 apply 漏れ | 状態 |
|---|---|
| `20260511000002_root_employees_employee_number_unique.sql` | 🔴 未適用 立証済（a-main-023 5/11 16:40 REST 検証）|
| Soil migration 8 本（20260507000001-20260509000001）| 🔴 未適用 立証済（soil-62 + 私の REST 検証で soil_lists / soil_call_history 等の不存在確認）|
| 他 migration | 🟡 未検証（本監査スコープ）|

# D. Tree D-01 即解消との関係

- a-main-023 が 5/11 17:00 頃 to `20260511000002` UNIQUE migration を apply 予定（即実行中）
- 本監査はそれと**並行**して全モジュール横断で実施
- a-audit-001 が即時 apply 状況把握 → main へ報告 → 順次解消

# E. 緊急度

🔴 最緊急（apply 漏れ放置で他モジュール作業もブロックリスク）

# F. 工数想定

a-audit-001 想定: 3-4h（subagent 並列起票推奨、モジュール別並列監査）

# G. self-check
- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A 監査の発端 / B 監査依頼内容 / C 既知情報 / D Tree D-01 関係 / E 緊急度 / F 工数 明示
- [x] B-2 検証手順例 (REST + .env.local) 明示
- [x] B-3 期待する成果物 5 項目
- [x] 番号 = main- No. 287
~~~

---

## 詳細（参考、投下対象外）

### 1. 投下後の流れ

1. a-audit-001 受領 → 全モジュール横断監査開始
2. apply 漏れ一覧 + 修復案を audit-001- No. NN で main 報告
3. main が修復 dispatch を各モジュールへ起票
4. PR merge → apply 完了 運用ルールを governance に反映

### 2. 関連 dispatch

- dispatch # 286（a-analysis-001 事故構造分析、本件と連動）
- dispatch # 288（a-soil-002 # 285 撤回）
