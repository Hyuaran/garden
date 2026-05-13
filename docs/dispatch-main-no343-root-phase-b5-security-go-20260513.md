# dispatch main- No. 343 — a-root-003 Phase B-5 セキュリティ強化着手 GO + cross_rls_helpers deleted_at filter 強化 + 銀行 CSV root_bank_* 受入

> 起草: a-main-024
> 用途: Garden unified auth plan 6/6 完成後の root-003 次タスク GO、Phase B-5 セキュリティ強化 + cross_rls_helpers deleted_at filter (P1) + 銀行 CSV テーブル root_bank_* 受け入れ（bud から rename 連動）、デモ延期 = 全完走後モード
> 番号: main- No. 343（counter 343、v6 規格 +1 厳守）
> 起草時刻: 2026-05-13(水) 10:15（実時刻基準、powershell.exe Get-Date 取得）

---

## 投下用短文（東海林さんがコピー → a-root-003 にペースト）

~~~
🟡 main- No. 343
【a-main-024 から a-root-003 への dispatch（Phase B-5 セキュリティ強化 GO + cross_rls_helpers 強化 + 銀行 CSV root_bank_* 受入 + 5/13 至急モード）】
発信日時: 2026-05-13(水) 10:15

# 件名
🟡 a-root-003 Phase B-5 セキュリティ強化着手 GO + cross_rls_helpers deleted_at filter 強化 (P1) + 銀行 CSV bud_bank_* → root_bank_* 受け入れ（bud rename 連動）

# A. 至急モード通知
東海林さん 5/13 10:14 明示: 「デモ延期、全完走後デモ」「至急進めましょう」。plan 6/6 完成後の root 次タスク即着手。

# B. Phase B-5 セキュリティ強化（root-003 No. 66-ack §G 候補 1）
| 項目 | 内容 |
|---|---|
| 内容 | 既存 root_can_access / root_can_write を has_role_at_least() wrapper に置換、Task 4 設計ガイド §5 Phase 2 |
| 想定工数 | 0.5-1d |
| 影響 | Garden 全モジュール RLS 統一強化、Bud Phase D の has_role_at_least 採用と整合 |
| 着手 | 即（5/13 朝-午前） |

# C. cross_rls_helpers deleted_at filter 強化（P1、bud-002 No. 56 副次影響）
| 項目 | 内容 |
|---|---|
| 内容 | auth_employee_number() / has_role_at_least() に deleted_at filter 追加 |
| 影響 | 退職者 (deleted_at not null) の RLS 通過防止 |
| 着手 | Phase B-5 と並行 or 単独 PR |
| 想定工数 | 30 分-1h |

# D. 銀行 CSV root_bank_* テーブル受け入れ（bud-002 から rename 連動、東海林さん 5/11 21:30 α GO）
| 項目 | 内容 |
|---|---|
| 内容 | bud_bank_accounts / bud_bank_balances / bud_bank_transactions → **root_bank_*** へ rename（PR #159 alpha = mock data のみ、本番影響なし）|
| 担当 | a-bud-002 が rename PR 起票、a-root-003 が受け入れ確認 |
| 連動 | a-bud-002 # 339 §D で rename PR 起票指示済、5/13 中完走想定 |
| 着手 | bud から rename PR 起票後（5/13 中） |

# E. 軽微改善 # 1（search_path、root-003 No. 66-ack §G 候補）
| 項目 | 内容 |
|---|---|
| 内容 | a-root-002 期で起草担当認識、main 起動指示待ち |
| 状態 | 起動指示待ち |
| 着手 | Phase B-5 完了後 or 並行 |

# F. 認証統一の人間検証フェーズ支援（main- No. 335、東海林さん復帰後）
| 項目 | 内容 |
|---|---|
| 内容 | 東海林さん Chrome MCP S1-S13 実施時の手順説明 / 結果記録支援 |
| 担当 | a-root-003 が support、a-main-024 が Chrome MCP 経由実行支援 |
| タイミング | 東海林さん明示後 |

# G. 着手順推奨
| 順 | タスク | 並行可能 | 想定 |
|---|---|---|---|
| 1 | Phase B-5 セキュリティ強化（最重要）| — | 5/13 朝-午前 |
| 2 | cross_rls_helpers deleted_at filter 強化 | Phase B-5 と並行 | 5/13 午前 |
| 3 | 銀行 CSV root_bank_* 受け入れ | bud rename PR 起票後 | 5/13 中 |
| 4 | 5/12 朝 audit review 出席（議題 12-15）| 並行 | 5/13 中 |
| 5 | 軽微改善 # 1（search_path）| 中期 | 5/14 以降 |

# H. ACK 形式（root-003- No. 67）
| 項目 | 内容 |
|---|---|
| 1 | # 343 受領確認 |
| 2 | Phase B-5 着手 ETA + 並行タスク方針 |
| 3 | cross_rls_helpers 強化 ETA |
| 4 | 銀行 CSV root_bank_* 受け入れ ETA（bud rename PR 起票後）|

# I. 緊急度
🟡 通常（plan 6/6 完成後の継続タスク、5/13 中完走目標）

# J. self-check
- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] 起草時刻 = 実時刻 10:15（powershell.exe Get-Date 取得済、2026-05-13 水曜）
- [x] 番号 = main- No. 343（v6 規格 +1 厳守）
- [x] A 至急 / B Phase B-5 / C deleted_at filter / D root_bank_* / E search_path / F 人間検証支援 / G 着手順 / H ACK
~~~

---

## 詳細（参考、投下対象外）

### 連動
- root-003 No. 66-ack §G（次タスク候補 4 件、Phase B-5 推奨）
- main- No. 333-rep-2（plan 6/6 完成 + 次タスク Phase B-5 候補）
- bud-002 No. 56（cross_rls_helpers deleted_at filter P1 副次影響）
- main- No. 339（bud_bank_* → root_bank_* rename PR 起票指示）
- 東海林さん 5/11 21:30 「テーブル名 Bud → Root に変えるで OK」
- 東海林さん 5/13 10:14 「至急進めましょう」
