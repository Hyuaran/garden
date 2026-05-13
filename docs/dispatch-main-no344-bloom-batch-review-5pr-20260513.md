# dispatch main- No. 344 — a-bloom-006 5 PR batch review 依頼 (#170/#171/#172/#173/#174)

> 起草: a-main-024
> 用途: 5/13 朝 1h で 5 PR 一気起票（root Phase B-5 + cross_rls deleted_at filter + bud bank rename + forest B-min + tree spec mismatch fix）、bloom batch review 依頼で連続 admin merge → apply フローに乗せる
> 番号: main- No. 344（counter 344、v6 規格 +1 厳守）
> 起草時刻: 2026-05-13(水) 10:41（実時刻基準、powershell.exe Get-Date 取得）

---

## 投下用短文（東海林さんがコピー → a-bloom-006 にペースト）

~~~
🟡 main- No. 344
【a-main-024 から a-bloom-006 への dispatch（5 PR batch review 依頼、Garden 全方位進展、5/13 至急モード継続）】
発信日時: 2026-05-13(水) 10:41

# 件名
🟡 a-bloom-006 5 PR batch review 依頼（#170 tree spec / #171 bud bank rename / #172 forest B-min / #173 cross_rls deleted_at / #174 root Phase B-5）= 5/13 朝 1h で全モジュール並列稼働の成果、軽量 batch review 推奨

# A. 5 PR 一覧
| PR | モジュール | タイトル | 規模 | 状態 |
|---|---|---|---|---|
| **#170** | a-tree | spec D-01 soil 参照修正（spec docs のみ、SQL なし）| 1 ファイル / +12 -11 | OPEN |
| **#171** | a-bud | bud_bank_* → root_bank_* rename | 2 ファイル / +88 | MERGEABLE |
| **#172** | a-forest | B-min Phase 1 仕訳帳 全 5 タスク完成 | 13 commits + migration 3 + parser 5 + UI 3 + tests 9 | OPEN |
| **#173** | a-root | cross_rls_helpers deleted_at filter 強化（退職者 RLS 通過防止 P1）| 1 migration + 145 行 | OPEN |
| **#174** | a-root | Phase B-5 — root_can_* を has_role_at_least() wrapper 化 | 3 ファイル / +145 -9 | OPEN |

# B. 各 PR 観点（軽量 batch review）
| PR | 観点 | 期待 |
|---|---|---|
| #170 | spec docs 修正のみ、Tree D-01 schema 整合性確認 | 採用 |
| #171 | ALTER TABLE RENAME 3 件、metadata 変更のみ、data/RLS/FK 不変 | 採用 |
| #172 | 13 commits batch、A-RP-1 §2/§4 PR description 反映、silent NO-OP 罠 4 種防御確認 | 採用 |
| #173 | cross_rls deleted_at filter 追加、退職者 RLS 通過防止副次効果（全 Garden 横断）| 採用 |
| #174 | root_can_* wrapper 化、behavior 互換、内部経由が deleted_at filter 通過済 helper | 採用 |

# C. apply 順序推奨（merge 後、東海林さん経由 Supabase Studio）
| 順 | PR | 理由 |
|---|---|---|
| 1 | **#171** bud bank rename | 既存テーブル rename、Phase D 完成後の整理 |
| 2 | **#173** cross_rls deleted_at filter | 退職者 RLS 通過防止が即時発動 |
| 3 | **#174** Phase B-5 wrapper 化 | #173 通過済 helper 経由で deleted_at filter 自動継承 |
| 4 | **#170** tree spec docs | SQL なし、merge のみ（apply 不要）|
| 5 | **#172** forest B-min 3 migration | 仕訳帳 7 テーブル + 12 口座 seed + 714 マスタ seed |

# D. review 依頼内容（軽量、同 # 323/#328/#334 運用）
| # | 項目 | 期待 |
|---|---|---|
| 1 | 5 PR 一括 採用判定 | 全件採用想定 |
| 2 | bloom 側影響（#173/#174 で has_role_at_least 経由 RLS 整合性、Bloom Phase A-2 連動）| 採用判定 |
| 3 | merge 後 bloom 動作影響（あれば）| 報告 |

# E. ACK 形式（bloom-006- No. 29）
| 項目 | 内容 |
|---|---|
| 1 | # 344 受領確認 |
| 2 | 5 PR batch review 結果（採用 / 修正提案 / 却下、PR 別）|
| 3 | bloom 側影響共有（あれば）|
| 4 | review 完走 ETA（軽量想定 30 分以内）|

# F. 緊急度
🟡 通常（軽量 batch review、admin merge → apply で連続稼働 → 全モジュール完走）

# G. self-check
- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] 起草時刻 = 実時刻 10:41（powershell.exe Get-Date 取得済、2026-05-13 水曜）
- [x] 番号 = main- No. 344（v6 規格 +1 厳守）
- [x] A 5 PR 一覧 / B 観点 / C apply 順序 / D review 依頼 / E ACK / F 緊急度
~~~

---

## 詳細（参考、投下対象外）

### 連動
- root-003 No. 68（PR #173/#174 並列完成）
- bud-002 No. 59（PR #171 rename 完成）
- forest-002 No. 36（PR #172 B-min 完成）
- tree-002 No. 35（PR #170 spec mismatch fix 完成）
- analysis-001 No. 17（違反 30 件構造分析完成、議題 15 visibility matrix 補助所見）
