~~~
【a-main → a-bloom-006】dispatch main- No. 305

発信日時: 2026-05-11 18:25
投下先: a-bloom-006 セッション
発信元: a-main-023
ファイル: C:\garden\a-main-023\docs\dispatch-main-no305-bloom-pr165-pr166-batch-review-add-20260511.md
添付資料: なし (PR は GitHub 上で直接確認 = #165 / #166)
緊急度: 🔴 高
返信先: bloom-006- No. 19 (main- No. 305 への返信、形式 ~~~ ラップ)

---

## 0. TL;DR

bloom-006 # 18 = PR #162/#163/#164 batch review 完走 (16 観点 × 3 PR、44 PR 中累計 14 PR review 経験) 高評価。本 dispatch は新規 2 PR (#165 Leaf 修復計画 + #166 Soil Phase B-01 apply prep) の batch review 追加依頼 + PR #163 merge 完了通知 + PR #162/#164 rebase 中通知。

---

## A. bloom-006 # 18 batch review 完走 高評価 + 14 PR 累計

| 項目 | 内容 |
|---|---|
| # 18 完走 | PR #162 / #163 / #164 = 3 PR batch review (16 観点 × 3 = 48 チェック完走) |
| 累計 review 経験 | 14 PR (PR #149-#164 連続)、Garden 全 review 実績の中核 |
| 評価 | 「設計判断 / 教訓抽出 / 横展開提案」の 3 軸で安定、特に Bloom 視点での横モジュール影響評価が秀逸 |
| 東海林さん共有 | bloom-006 を「review hub」位置付けで継続運用方針 |
| 次フェーズ | Phase A-2 統合 KPI ダッシュボード β投入後着手 (本 review batch 完了が前提) |

東海林さんからの謝意 = 「44 PR の review 体制が bloom-006 で安定したので、後続の Soil apply / Leaf 修復に安心して着手できる」。

---

## B. PR #163 (Task 4) merge 完了通知 + PR #164/#162 rebase 中通知

### B-1. PR #163 merge 完了
| 項目 | 内容 |
|---|---|
| PR | #163 (Task 4) |
| merge 時刻 | 2026-05-11 09:00:16Z |
| merge 後アクション | なし (bloom-006 側で追加 review 不要) |
| 後続 | main 反映済、関連モジュールへの影響なし |

### B-2. PR #162 / #164 = rebase 中 (# 304 起票)
| 項目 | 内容 |
|---|---|
| 該当 PR | #162 / #164 |
| 担当 | a-root-003 |
| 状態 | rebase 中 (# 304 起票済) |
| bloom-006 側アクション | rebase 後の再 review = **軽微 conflict 解消のみなら不要**、構造変化を伴う場合のみ追加 review 依頼 |
| 判断基準 | a-root-003 からの「rebase 完了 + 差分軽微」通知を main 経由で受信したら skip、「構造変化あり」通知なら # 20 で再 review |

---

## C. 新規 PR #165 (Leaf 修復計画) batch review 観点

### C-1. PR 概要
| 項目 | 内容 |
|---|---|
| PR | #165 |
| 担当 | a-leaf-002 |
| ファイル数 | 460 行 計画書 + 関連 docs |
| スコープ | Leaf 修復計画 v1.0 + 業務フィールド最小スキーマ案 + Phase D 92.9% 完成への影響評価 |
| 緊急度 | 🟡 中 (apply は伴わず、計画 docs のみ) |

### C-2. review 観点 (16 観点)

| # | 観点 | 確認ポイント |
|---|---|---|
| 1 | 修復対象の正確性 | 関電業務委託 Leaf 001 の Phase D 残課題と整合しているか |
| 2 | スキーマ案の最小性 | 業務フィールド最小スキーマが過剰実装になっていないか |
| 3 | Phase D 92.9% への影響 | 残 7.1% (= D.14 カバレッジ) との順序競合がないか |
| 4 | 既存 PR #65-#73 との整合 | 8 PR で確立した方針と矛盾しないか |
| 5 | leaf-migration-checklist 横展開 | チェックリスト形式での教訓抽出が他商材 (光回線/クレカ等) に流用可能か |
| 6 | RLS 設計の妥当性 | server/client audit 教訓 (project_rls_server_client_audit) 反映済か |
| 7 | 7 段階ロール対応 | toss/closer/cs/staff/manager/admin/super_admin のアクセス範囲が明記されているか |
| 8 | 論理削除 / 物理削除パターン | Garden 全モジュール削除パターン (project_delete_pattern_garden_wide) 準拠か |
| 9 | 申請承認フロー | Garden 申請承認パターン (project_garden_change_request_pattern) 準拠か |
| 10 | 永続保管 | データ保管期間 = 永続スタート (feedback_data_retention_default_pattern) 準拠か |
| 11 | テスト方針 | 62 tests 既存ベースから増分テストの計画が明確か |
| 12 | 他商材スケルトンとの整合 | a-auto Batch 12 (skeleton 5 件、PR #40 merge 済) と矛盾しないか |
| 13 | docs フォーマット | dispatch v5 / handoff フォーマットと統一されているか |
| 14 | 教訓の抽出粒度 | 「2 度と踏まない」レベルの具体性があるか |
| 15 | Bloom 視点での影響 | Phase A-2 統合 KPI で Leaf 案件を可視化する際の必要フィールド充足 |
| 16 | 後続タスク順序 | D.14 → Phase A → B → F の順序が明示されているか |

### C-3. 期待する review 出力
- 16 観点 ✅/⚠️/❌ 判定
- ⚠️/❌ には具体的な修正提案
- leaf-migration-checklist の横展開提案 (光回線 / クレカ等への流用可否 + 流用時の調整点)
- Phase D 92.9% → 100% 完成までの推奨順序

---

## D. 新規 PR #166 (Soil Phase B-01 apply prep) batch review 観点

### D-1. PR 概要
| 項目 | 内容 |
|---|---|
| PR | #166 |
| 担当 | a-soil-002 |
| ファイル数 | 4 ファイル / 930 行 |
| スコープ | Soil Phase B-01 apply 準備 (rename migration + 8 件 apply 戦略一式) |
| 構成 | preflight SQL + verify SQL + runbook 11 ステップ + a-tree-002 連携手順 |
| 緊急度 | 🔴 高 (5/12-13 garden-dev apply 予定) |

### D-2. review 観点 (16 観点)

| # | 観点 | 確認ポイント |
|---|---|---|
| 1 | rename migration 設計判断 7 件 | 7 件の設計判断が個別に妥当か、相互矛盾がないか |
| 2 | preflight SQL の網羅性 | apply 前の依存関係チェックが漏れなく書かれているか |
| 3 | verify SQL の検証深度 | apply 後の rename 完全性 / データ件数 / FK 整合性が検証されるか |
| 4 | runbook 11 ステップの実行可能性 | 各ステップが Claude / 東海林さんどちらでも実行可能な粒度か |
| 5 | rollback 手順 | 失敗時の rollback 手順が各ステップに紐付いているか |
| 6 | a-tree-002 連携手順 | Tree が参照する soil_call_history rename への影響と通知タイミングが明確か |
| 7 | Tree D-1 + D-2 セット戦略への影響 | project_tree_d2_release_strategy への悪影響がないか |
| 8 | 253 万件 list + 335 万件 call_history 影響 | データ量を踏まえた apply 時間見積 / lock 戦略 |
| 9 | garden-dev 対象限定 | 本番 (garden-prod) への誤実行防止策が明記されているか |
| 10 | dry-run 機能 | apply 前の dry-run / EXPLAIN 機能が組み込まれているか |
| 11 | 段階的 apply | 8 件を一気に流すか段階分けか、判断根拠が明示されているか |
| 12 | 監視・ログ取得 | apply 中のログ取得 + 異常検知の仕組み |
| 13 | RLS 影響 | rename により RLS policy 名 / 参照が更新必要な箇所の網羅 |
| 14 | application code 影響 | Garden frontend / API での soil_* 参照箇所の grep 結果が反映されているか |
| 15 | runbook の冗長性 | 11 ステップが過剰でも不足でもないか |
| 16 | Bloom 視点での影響 | Phase A-2 統合 KPI ダッシュボードでの Soil 参照に rename 影響がないか |

### D-3. 期待する review 出力
- 16 観点 ✅/⚠️/❌ 判定
- ❌ がある場合は apply 前に必ず修正 (5/12-13 apply の前提条件)
- ⚠️ は apply 中の watch 項目として明示
- runbook 11 ステップへの追記推奨があれば提示
- a-tree-002 への事前通知が必要な項目の抽出

---

## E. review 結果報告形式 (bloom-006- No. 19)

### E-1. 報告先
- 報告先: a-main-023 (本 dispatch への返信)
- ファイル: bloom-006 の docs/ 配下に保存 + 内容を ~~~ ラップで main へ送信
- 番号: bloom-006- No. 19

### E-2. 報告フォーマット

| 項目 | 内容 |
|---|---|
| 0. TL;DR | 2 PR の総合判定 (GO / 修正後 GO / 待機) を 1 行で |
| 1. PR #165 (Leaf) | 16 観点判定表 + ⚠️/❌ の具体修正提案 + leaf-migration-checklist 横展開提案 |
| 2. PR #166 (Soil) | 16 観点判定表 + ⚠️/❌ の具体修正提案 + runbook 追記推奨 + a-tree-002 事前通知項目 |
| 3. 後続アクション | Soil apply (5/12-13) GO/NoGO + 必要な事前修正項目リスト |
| 4. 累計 review 統計 | 16 PR review 完走 (= 14 + 今回 2) の通算評価 |
| 5. self-check | 16 観点 × 2 PR = 32 チェック完了確認 |

### E-3. 期限
- 目安: 2026-05-11 23:00 まで (5/12 朝の apply 判断に間に合うように)
- 優先順位: PR #166 (Soil) > PR #165 (Leaf) = Soil apply が先行のため

---

## F. 後続フロー (Soil apply 5/12-13)

### F-1. apply 前 (5/11 夜まで)
| 担当 | アクション |
|---|---|
| a-bloom-006 | PR #166 review 完走 + GO/NoGO 判定 |
| a-soil-002 | bloom-006 review の ⚠️/❌ 反映 |
| a-main-023 | a-tree-002 への事前通知配信 (review 結果の Tree 影響項目) |
| 東海林さん | 最終 GO 判断 |

### F-2. apply 当日 (5/12-13)
| ステップ | 担当 | 内容 |
|---|---|---|
| 1 | a-soil-002 + 東海林さん | preflight SQL 実行 + 結果確認 |
| 2 | a-soil-002 + 東海林さん | dry-run / EXPLAIN 確認 |
| 3 | a-soil-002 + 東海林さん | apply 実行 (段階的 or 一括は runbook 準拠) |
| 4 | a-soil-002 + 東海林さん | verify SQL 実行 |
| 5 | a-tree-002 | Tree 側の参照更新確認 |
| 6 | a-main-023 | apply 完了の横断通知 (Bloom / Tree / Leaf 等) |

### F-3. apply 後 (5/13 以降)
| アクション | 担当 |
|---|---|
| 監視 24h | a-soil-002 |
| ロールバック判断 (異常時) | a-soil-002 + 東海林さん最終決裁 |
| 教訓抽出 (apply 記録) | a-soil-002 → bloom-006 で review |

---

## G. ACK 形式

bloom-006 は本 dispatch 受領後、以下の ACK を main へ返信:

| 項目 | 内容 |
|---|---|
| 番号 | bloom-006- No. 19 (review 完走時) |
| 形式 | ~~~ ラップ + 表形式中心 |
| 内容 | 本 dispatch E-2 のフォーマットに準拠 |
| 期限 | 2026-05-11 23:00 まで |

中間 ACK (受領のみ) は不要、review 完走まで作業継続。

---

## H. self-check (a-main-023 起草時)

| # | 項目 | 確認 |
|---|---|---|
| 1 | dispatch 番号 | main- No. 305 ✅ |
| 2 | 投下先明示 | a-bloom-006 ✅ |
| 3 | フォーマット v5 準拠 | ~~~ ラップ / コードブロック禁止 / 表形式中心 ✅ |
| 4 | 緊急度先頭明示 | 🔴 高 ✅ |
| 5 | ファイル markdown link | 冒頭に絶対パス記載 ✅ |
| 6 | 章立て | A-H 8 章 ✅ |
| 7 | 行数 | 250-350 行 ✅ |
| 8 | 内容 | A. bloom-006 # 18 高評価 / B. #163 merge + #162/#164 rebase / C. #165 / D. #166 / E. 報告形式 / F. 後続 / G. ACK / H. self-check ✅ |
| 9 | review 観点 | C-2 / D-2 で 16 観点 × 2 PR = 32 観点明示 ✅ |
| 10 | 後続フロー | Soil apply 5/12-13 の段階明示 ✅ |
| 11 | 期限 | 2026-05-11 23:00 ✅ |
| 12 | a-tree-002 連携 | F-1 で事前通知明示 ✅ |
| 13 | 同じ提案繰り返し防止 | bloom-006 # 18 完走前の繰り返しなし ✅ |
| 14 | 「投下OK / 送信OK」誤解防止 | 完了報告 vs 再依頼の区別明確 ✅ |
| 15 | dispatch 一括 rate limit | 単発 dispatch のため該当なし ✅ |
| 16 | 視覚確認 / Chrome MCP | docs のみのため該当なし ✅ |

---

返信先: bloom-006- No. 19 (期限 2026-05-11 23:00)
~~~
