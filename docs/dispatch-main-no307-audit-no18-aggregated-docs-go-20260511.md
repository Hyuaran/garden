~~~
# main- No. 307 / to: a-audit-001 / 緊急度: 🔴 高

発信日時: 2026-05-11 18:40
発信元: a-main-023
投下先: a-audit-001
件名: audit # 18 採否 4 件 全 GO + 集約 docs commit + push 即実行 GO + apply 漏れ 87.1% 対応スケジュール確定
添付: なし (集約 docs は a-audit-001 ローカル `docs/audit-migration-apply-status-all-modules-20260511.md` を参照)
関連: main- No. 304 (audit # 17 受領) / main- No. 295 (apply 漏れ 80% 報告) / audit # 18 (# 300 全節完走報告)

---

## A. audit # 18 採否 4 件 全 GO 通知

a-audit-001 から audit # 18 で挙げられた採否仰ぎ 4 件について、a-main-023 として 5/11 18:35 に判断確定した。結論は **4 件全て推奨通り GO** とする。

### A-1. 採否一覧

| # | 採否事項 | 推奨 | a-main-023 判断 | 実行タイミング |
|---|---|---|---|---|
| 1 | 集約 docs commit + push (戦略 A 案) | GO | **GO 即実行** | 5/11 中 (本 dispatch 受領後) |
| 2 | 5/12 朝 集約 docs review timeline | GO | **GO 確定** | 5/12 09:00-10:00 |
| 3 | 修復 apply 戦略 A + C 案採否 | 5/12 朝判断 | **5/12 朝判断 (一部 5/11 中先行)** | 5/11 中 + 5/12 朝 |
| 4 | 各モジュール apply 漏れ調査 dispatch 連動 | main 主導 | **既に起票済 + 連動明示** | 進行中 |

### A-2. 全 GO 判断の根拠

- audit # 18 で報告された apply 漏れ率 **80% → 87.1% への補正** (partial 8 件検出) は、main- No. 295 報告値より深刻度が増した重要発見である
- 致命度 🔴 5 件の修復順序提示も妥当 (Bud Phase D 13 件 + soil_call_history rename + Tree D-01 20% + Leaf 001 + Root auth)
- 追加発見 4 件 (applied 確定 2 件のみ / cross_rls_helpers partial / tree_phase_d_01 20% apply / Soil silent NO-OP 機械検証) は、main- No. 295 の構造課題仮説を機械検証で立証した価値あり
- 5/12 朝 review timeline は、Bud Phase D 先行修復の経過確認と他モジュール修復戦略議論の両立に適切

---

## B. 集約 docs commit + push 即実行 GO

### B-1. 即実行指示

a-audit-001 は、本 dispatch 受領後 **即座に** 以下を実行されたい:

| 手順 | 内容 |
|---|---|
| 1 | `docs/audit-migration-apply-status-all-modules-20260511.md` を git add |
| 2 | commit message: `docs(audit): apply 漏れ 87.1% 全モジュール集約 audit 報告 # 300 完走` |
| 3 | push origin (現ブランチ) |
| 4 | push 完了確認 → a-main-023 へ完了通知 (commit hash + push 先 branch 明記) |

### B-2. 戦略 A 案採用の理由

戦略 A 案 (集約 docs を即 commit + push して証跡化) を採用する理由:

- 5/11 中の Bud Phase D 修復作業の根拠資料として参照される必要がある
- 5/12 朝の review session で全員 (a-main-023 + 関連モジュール session) が同じ集約 docs を参照する必要がある
- partial / mismatch 検出ロジックを含む audit 結果は、後日の修復 apply 検証時に diff 対象として必要

### B-3. 戦略 A 案で **しない** こと

- 集約 docs の内容修正は本 commit には含めない (現状の audit 結果をそのまま証跡化)
- 5/12 朝 review で追加修正が必要になった場合は別 commit で対応
- v1.1 拡張 (migration_history + pg_* SELECT) は本 commit に含めない (5/12-13 別途判断)

---

## C. 重要発見 4 件 高評価

### C-1. 発見の総合評価

audit # 18 で追加報告された 4 件の発見は、いずれも main- No. 295 で報告した apply 漏れ 80% 仮説を **機械検証で立証** する価値ある成果である。a-main-023 として全件高評価とする。

| # | 発見 | 評価 | a-main-023 補強 |
|---|---|---|---|
| 1 | applied 確定 2 件のみ | 🔴 構造課題立証 | main- No. 295 補強 (audit 視点で再確認) |
| 2 | cross_rls_helpers partial | 🟡 漏れ範囲拡大 | 5/12 朝 review で個別議論 |
| 3 | tree_phase_d_01 20% apply | 🔴 致命度 5 件中 1 | a-tree 修復対象として確定 |
| 4 | Soil silent NO-OP 機械検証 | 🔴 main- No. 295 仮説立証 | 仮説 → 確定事実に格上げ |

### C-2. 特に評価する点

- **# 4 Soil silent NO-OP 機械検証**: main- No. 295 では「Soil session 内で apply 実行ログが残っていない可能性」として仮説段階だったが、audit # 18 で機械検証により確定事実として立証された。これは構造課題 (apply 実行プロセスの記録欠如) を根拠化する重要な進展である
- **# 1 applied 確定 2 件のみ**: 全 62 件中 applied 確定が 2 件のみという結果は、apply 漏れの広がりを示すと同時に、検証ロジック (migration_history が信頼できない状況での pg_* SELECT 代替) の必要性も示唆する

---

## D. apply 漏れ 87.1% への対応スケジュール

apply 漏れ 87.1% 全 54 件 (62 件中) に対して、致命度別の対応スケジュールを以下に確定する。

### D-1. 5/11 中 (本日中) — 先行修復進行中

| モジュール | 修復対象 | 状態 | dispatch # | 担当 session |
|---|---|---|---|---|
| Bud Phase D | 13 件 migration apply | 進行中 | main- No. 292 + 296 | a-bud |
| Soil | soil_call_history rename SQL | 進行中 | main- No. 293 | a-soil |

5/11 中はこの 2 件のみ先行で apply 実行する。他モジュールは 5/12 朝の集約 docs review + 戦略判断後に着手する。

### D-2. 5/12 朝 (09:00-10:00) — 集約 docs review + 戦略判断

| 議題 | 内容 | 判断者 |
|---|---|---|
| 1 | 集約 docs review (apply 漏れ 87.1% 全件確認) | a-main-023 + 全関連 session |
| 2 | Bud Phase D 修復経過確認 (5/11 中の結果) | a-main-023 + a-bud |
| 3 | Soil 残修復 戦略判断 (戦略 A or C 案) | a-main-023 + a-soil |
| 4 | Tree D-01 残 80% apply 戦略判断 | a-main-023 + a-tree |
| 5 | Leaf 001 修復戦略判断 | a-main-023 + a-leaf |
| 6 | Root auth migration apply 戦略判断 | a-main-023 + a-root |
| 7 | v1.1 拡張 (migration_history + pg_* SELECT) 採否 | a-main-023 + a-audit-001 |
| 8 | cross-check 着手判断 | a-main-023 + a-audit-001 |

### D-3. 5/12-13 — 各モジュール修復 apply 実行

| モジュール | 修復対象 | 関連 PR | 担当 session |
|---|---|---|---|
| Soil | a-soil PR #166 連動 | PR #166 | a-soil |
| Leaf 001 | a-leaf PR #165 連動 | PR #165 | a-leaf |
| Tree D-01 | Tree spec 修正 + 残 80% apply | (新規 PR 起票) | a-tree |
| Root | auth migration apply | (新規 PR 起票) | a-root |

### D-4. 致命度別優先順位

| 致命度 | モジュール | 件数 | 期限 |
|---|---|---|---|
| 🔴 1 | Bud Phase D | 13 | 5/11 中 |
| 🔴 2 | Soil (soil_call_history rename + 残) | 約 10 | 5/11-12 |
| 🔴 3 | Tree D-01 | 1 (残 80%) | 5/12-13 |
| 🔴 4 | Leaf 001 | 約 8 | 5/12-13 |
| 🔴 5 | Root auth | 約 5 | 5/12-13 |

---

## E. 5/12 朝 集約 docs review timeline

### E-1. timeline 確定

| 時刻 | 内容 | 参加 session |
|---|---|---|
| 5/12 08:30 | a-main-023 起動 + 各モジュール session 起動指示 | a-main-023 |
| 5/12 08:45 | 各 session git pull 完了 + 集約 docs 読込完了 | 全 session |
| 5/12 09:00 | 集約 docs review session 開始 | a-main-023 + 全関連 session |
| 5/12 09:30 | Bud Phase D 修復経過確認 + 他モジュール戦略判断 | 各モジュール session |
| 5/12 10:00 | 戦略判断確定 + 各 session に dispatch 投下 | a-main-023 |
| 5/12 10:00- | 各モジュール修復 apply 着手 | 各モジュール session |

### E-2. review 前提資料

a-audit-001 集約 docs (`docs/audit-migration-apply-status-all-modules-20260511.md`) を 5/12 08:45 までに各 session が git pull で取得することを前提とする。

### E-3. review 議題優先順位

1. Bud Phase D 修復経過 (5/11 中の結果) → 成功 or 失敗の確認 + 致命度 1 解消の判定
2. Soil 残修復戦略 → 戦略 A (全件即 apply) or 戦略 C (段階的 apply) の選択
3. 他モジュール (Tree / Leaf / Root) 修復戦略 → 戦略 A 一括採用 or モジュール別判断
4. v1.1 拡張 (migration_history + pg_* SELECT) → 後回し or 即着手
5. cross-check → 全モジュール検証優先で後回し (本 dispatch G 節参照)

---

## F. 各モジュール修復 dispatch との連動明示

### F-1. 既存 dispatch 一覧

| dispatch # | 内容 | 投下先 | 状態 |
|---|---|---|---|
| main- No. 292 | Bud Phase D 13 件修復起票 | a-bud | 進行中 |
| main- No. 293 | soil_call_history rename SQL 起票 | a-soil | 進行中 |
| main- No. 294 | Tree D-01 残 80% apply 起票 | a-tree | 起票済 |
| main- No. 295 | apply 漏れ 80% 一次報告 (main- No. 295 補強) | a-audit-001 | 完了 |
| main- No. 296 | Bud Phase D 修復 詳細指示 | a-bud | 進行中 |
| main- No. 302 | (関連連動) | (関連 session) | 進行中 |
| main- No. 303 | (関連連動) | (関連 session) | 進行中 |
| main- No. 304 | audit # 17 受領 + # 18 待ち | a-audit-001 | 完了 |
| main- No. 307 | **本 dispatch** | a-audit-001 | 投下中 |

### F-2. 連動方針

- 集約 docs (`docs/audit-migration-apply-status-all-modules-20260511.md`) を **全モジュール修復計画の根拠資料** として位置付ける
- 各モジュール session は 5/12 朝までに集約 docs を git pull で取得 + 自モジュール該当箇所を確認する
- 5/12 朝 review で戦略判断確定後、各モジュールに修復 apply 指示を改めて dispatch 投下する (詳細指示は 5/12 朝以降)

### F-3. 各モジュール session への前提通知 (a-main-023 担当)

a-main-023 は本 dispatch 投下後、各モジュール session (a-bud / a-soil / a-tree / a-leaf / a-root) に以下を通知する責務を負う:

- 集約 docs が a-audit-001 ローカルで push 完了予定 (5/11 中)
- 5/12 08:45 までに git pull で取得すること
- 5/12 09:00 から集約 docs review session 開始
- 自モジュール該当箇所を事前確認しておくこと

---

## G. v1.1 拡張 + cross-check の方針

### G-1. v1.1 拡張 (migration_history + pg_* SELECT)

| 項目 | 判断 | 理由 |
|---|---|---|
| v1.1 拡張採否 | **5/12-13 別途判断** | 5/12 朝 review で議題 # 7 として議論 |
| 即着手 | 不要 | 集約 docs (v1.0 結果) で十分な根拠が得られているため |
| 後回し条件 | 集約 docs review で追加検証必要と判断された場合のみ着手 | review 結果次第 |

### G-2. cross-check

| 項目 | 判断 | 理由 |
|---|---|---|
| cross-check 着手 | **後回し** | まずは全モジュール検証 (本集約 docs) を優先 |
| 着手条件 | 全モジュール修復 apply 完了後 (5/13 以降) | 修復 apply の結果検証として cross-check を実施 |
| スコープ | 修復後の applied 確定件数 vs spec 期待値の照合 | apply 漏れ率の収束確認 |

### G-3. 後回し判断の根拠

- v1.0 (現集約 docs) で apply 漏れ 87.1% が機械検証で確定済
- v1.1 拡張で得られる追加情報 (migration_history + pg_* SELECT) は、修復 apply の検証段階で必要になる可能性が高い
- 現段階で着手すると、5/11-12 の修復作業と並行になりリソース分散する
- cross-check も同様に、修復 apply 完了後に実施する方が効率的

---

## H. ACK 形式

a-audit-001 は本 dispatch 受領後、以下の ACK を a-main-023 に返信されたい。

### H-1. ACK 必須項目

| 項目 | 内容 |
|---|---|
| 1 | 本 dispatch (main- No. 307) 受領確認 |
| 2 | 採否 4 件 全 GO 了解 |
| 3 | 集約 docs commit + push 実行結果 (commit hash + push 先 branch) |
| 4 | 5/12 朝 review timeline 了解 (08:45 git pull 前提 / 09:00 review 開始) |
| 5 | v1.1 拡張 + cross-check 後回し方針 了解 |
| 6 | 重要発見 4 件 高評価通知 受領 |

### H-2. ACK フォーマット

a-audit-001 は ~~~ ラップ形式 + 表形式中心で、コードブロック禁止のフォーマット v5 準拠で返信されたい。

### H-3. ACK 期限

- 集約 docs commit + push 完了通知: 5/11 中 (本 dispatch 受領後 1 時間以内目安)
- 全 ACK 完了: 5/11 中

---

## I. self-check

### I-1. 本 dispatch の self-check 結果

| 項目 | 確認 | 結果 |
|---|---|---|
| 1 | dispatch 番号採番 (main- No. 307) | OK |
| 2 | 投下先明示 (a-audit-001) | OK |
| 3 | 緊急度明示 (🔴 高) | OK |
| 4 | 添付ファイル明示 (なし / ローカル docs 参照) | OK |
| 5 | フォーマット v5 準拠 (~~~ ラップ + 表形式 + コードブロック禁止) | OK |
| 6 | 章立て (A-I 9 章) 完備 | OK |
| 7 | 採否 4 件 全 GO 通知 完備 | OK |
| 8 | 即実行指示 (集約 docs commit + push) 完備 | OK |
| 9 | スケジュール (5/11 中 / 5/12 朝 / 5/12-13) 完備 | OK |
| 10 | ACK 形式指示 完備 | OK |

### I-2. 連動 dispatch との整合確認

| 連動先 | 整合性 | 備考 |
|---|---|---|
| main- No. 292 (Bud Phase D 起票) | OK | 本 dispatch D-1 で進行中明記 |
| main- No. 293 (soil rename) | OK | 本 dispatch D-1 で進行中明記 |
| main- No. 295 (一次報告) | OK | 本 dispatch C-1 + D-4 で補強関係明記 |
| main- No. 304 (audit # 17 受領) | OK | 本 dispatch 前提 dispatch として位置付け |

### I-3. 未確定事項 (5/12 朝持ち越し)

| 項目 | 判断期限 | 判断者 |
|---|---|---|
| 1 | Soil 残修復 戦略 A or C | 5/12 朝 | a-main-023 + a-soil |
| 2 | Tree / Leaf / Root 修復戦略 | 5/12 朝 | a-main-023 + 各 session |
| 3 | v1.1 拡張採否 | 5/12 朝 (or 後回し) | a-main-023 + a-audit-001 |
| 4 | cross-check 着手時期 | 5/13 以降 | a-main-023 + a-audit-001 |

---

以上、a-main-023 → a-audit-001 dispatch main- No. 307 終了。

a-audit-001 は本 dispatch 受領後 **即座に** 集約 docs commit + push を実行し、完了通知を a-main-023 に返信されたい。

a-main-023 は本 dispatch 投下完了後、各モジュール session (a-bud / a-soil / a-tree / a-leaf / a-root) に集約 docs 取得通知を投下する。

~~~
