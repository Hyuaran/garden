# dispatch main- No. 302 — a-bud-002 へ Plan A 改採択（5/12 → 5/11 中修復 + 今夜仕訳帳本番運用） + 14 vs 13 件差分回答 + apply スケジュール

> 起草: a-main-023
> 用途: a-bud-002 への Plan A 改採択通知 + audit # 15「14 件」差分一括回答 + apply スケジュール提示 + 判断保留 5 件一括回答
> 番号: main- No. 302
> 起草時刻: 2026-05-11(月) 18:25
> 投下先: a-bud-002 (C:\garden\a-bud-002)
> 添付: なし
> 緊急度: 🔴 最緊急（5/11 中仕訳帳本番運用着地、Garden critical path ①）

---

## 投下用短文（東海林さんがコピー → a-bud-002 にペースト）

~~~
🔴 main- No. 302
【a-main-023 から a-bud-002 への dispatch（Plan A 改採択 = 5/11 中修復 + 今夜仕訳帳本番運用 + 14 vs 13 件差分回答 + apply スケジュール）】
発信日時: 2026-05-11(月) 18:25

# 件名
🔴 Plan A 改採択（5/12 → 5/11 中修復 + 今夜 19:30-20:00 仕訳帳本番運用開始）+ audit # 15「14 件」差分は cross_rls_helpers 混入カウント（実態 13 件確定）+ apply スケジュール 5/11 18:30-19:30 + 判断保留 5 件 一括回答

# A. Plan A 改採択経緯（5/12 → 5/11 中前倒し）

bud-002- No. 46 の Plan A 推奨「5/12 中に apply → 5/13 仕訳帳本番運用」を受領した。
ただし、a-main-023 (私) 側で自己分析した結果、以下の通り **5/11 中前倒しが技術的に可能** と判断した：

- a-bud-002 推奨「5/12」の前提 = 「a-main + 東海林さんレビューを朝に挟む」
- 実態 = レビューは並行可能、apply 本体は技術的に今日（5/11 夜）実行できる
- → memory `feedback_gangan_mode_default` の「保守的見通し違反」に該当（東海林さん作業時間最小化 + 5h フル活用の本質に照らすと、5/11 19:30-20:00 仕訳帳本番運用開始が正しい着地）

【採択】**Plan A 改 = 5/11 中修復 + 今夜 19:30-20:00 仕訳帳本番運用開始**

詳細スケジュールは下記 D セクション参照。

# B. audit # 15「14 件」差分回答（実態 13 件で確定）

a-audit-001 # 17 の dev test 結果で「14 件」と数えた根拠は、a-bud-002 worktree の supabase/migrations 22 件中：

- 「bud」keyword 含む 13 件
- 「unknown 1 件」= `cross_rls_helpers` を Bud 系に混入カウント

→ 計 14 件とカウントされたと推定。

【確定】Bud Phase D は **厳密に 13 件**：
- 20260507* = 7 件
- 20260508* = 4 件
- 20260511* = 2 件

`cross_rls_helpers` は Garden 横断共通基盤 (helpers) であり、Bud Phase D ではない。
→ audit 側の「14」は誤カウント、Bud 側の「13」が正。

# C. a-main-023 (私) が verify SQL Run 担当（a-bud-002 .env.local 不在 escalation 対応）

a-bud-002 # 44 / # 45 で .env.local が a-bud-002 worktree に不在のため Supabase 接続不可と escalation 受領済み。
→ verify SQL 一括 Run は **a-main-023 (私) が担当**（東海林さんに Supabase Dashboard SQL Editor で Run してもらう、私は順序ガイド + 結果解釈）。

a-bud-002 は **設計判断 + 順次 apply 用 SQL 整形** に集中してほしい。

# D. apply スケジュール（5/11 18:30-19:30）

## D-1. preflight + verify SQL 一括 Run（5/11 18:30-18:40、東海林さん 10 分）

私が以下 3 種類の verify SQL を集約して東海林さんに渡す → 東海林さん Supabase Dashboard で 1 回 Run：

1. **Root 前提テーブル確認** (root_employees / root_companies 存在チェック)
2. **拡張確認** (btree_gist / pgcrypto / pg_trgm 等の有効化チェック)
3. **既存 Bud schema 確認** (Phase A-1 / A-2 残存 table とのコンフリクト検出)

→ 結果を私が解釈し、apply 可否判断（B 案 (root_employees 名称統一) 採用、拡張不足あれば即 enable）。

## D-2. Phase D 13 件 順次 apply（5/11 18:40-19:30、東海林さん 35-60 分）

a-bud-002 が integrity_audit.md で確認済の timestamp 順で apply：

1. 20260507000001_bud_phase_d01_attendance_schema.sql (16.5K)
2. 20260507000002_bud_phase_d09_bank_accounts.sql (18.4K)
3. 20260507000003_bud_phase_d05_social_insurance.sql (13.8K)
4. 20260507000004_bud_phase_d02_salary_calculation.sql (20.2K)
5. 20260507000005_bud_phase_d03_bonus_calculation.sql (9.9K)
6. 20260507000006_bud_phase_d07_bank_transfer.sql (12.8K)
7. 20260507000007_bud_phase_d11_mfc_csv_export.sql (14.0K)
8. 20260508000001_bud_phase_d04_statement_distribution.sql (13.1K)
9. 20260508000002_bud_phase_d10_payroll_integration.sql (18.3K)
10. 20260508000003_bud_phase_d12_payroll_schedule_reminder.sql (12.7K)
11. 20260508000004_bud_phase_d06_nenmatsu_integration.sql (18.9K)
12. 20260511000010_bud_bank_accounts_balances.sql (9.3K)
13. 20260511000011_bud_journal_entries.sql (10.2K)

【運用方式】
- 私 (a-main-023) が 1 件ずつ「次は # N の `<filename>` を Run してください」と東海林さんに指示
- 東海林さんが Supabase Dashboard SQL Editor で Run
- エラー時は即停止 → 私 + a-bud-002 で原因解析 → fix → 再 Run
- 1 件あたり 2-5 分目安、計 35-60 分

## D-3. PR #160 / #161 merge 済確認（5/11 07:52 UTC 既 merge）

a-bud-002 # 46 で「PR #160 (Shiwakechou) merge タイミング不明」と判断保留に挙がっていた件：

→ **既に 5/11 07:52 UTC merge 済**（私が GitHub で確認済）。
→ a-bud-002 worktree で `git pull origin develop` してから apply 開始すれば、PR #160 内容も統合済の状態で動く。

## D-4. 集約検証 SQL 最終 Run（5/11 19:25-19:30、東海林さん 5 分）

13 件 apply 完了後、私が集約検証 SQL（table 数 / RLS 有効数 / 主要 FK 整合性）を渡す → 東海林さん Run → 私が結果解釈 → GO/NoGo 判定。

# E. 5/11 19:30-20:00 仕訳帳本番運用 動作確認（a-bud-002 + 東海林さん）

検証 SQL GO 判定後、即仕訳帳本番運用開始：

1. a-bud-002 が `/bud/journal` 画面 (Shiwakechou) を東海林さんに動作確認依頼
2. 東海林さんが本番アカウントで実 1 件入力（仕訳起票 → 保存 → 一覧表示）
3. a-bud-002 が動作 NG 検出 or 東海林さん UX 違和感報告時 → 即修正サイクル
4. 20:00 までに 1-3 件の実仕訳が本番 DB に入っていれば「Phase D 仕訳帳本番運用開始」着地

→ Garden critical path ① **5/11 中に着地**、明朝 5/12 から東海林さんが日常運用に組み込める。

# F. 判断保留 5 件 一括回答

## # 1: 14 vs 13 件差分 = cross_rls_helpers 混入、実態 13 件確定（B セクション参照）

## # 2: Root 前提テーブル (root_employees / root_companies) = verify SQL で一括検出

→ B 案 (root_employees 名称統一) 採用推奨。
→ verify SQL で前提テーブル存在を一括チェック、不在なら即 escalation。
→ Bud # 46 で挙がっていた A 案 (root_users 名称) は採用しない（Garden 横断で root_employees が標準）。

## # 3: 拡張 (btree_gist / pgcrypto) = verify SQL で一括検出

→ verify SQL で `pg_extension` を select して有効化状況を確認。
→ 不足あれば apply 前に `CREATE EXTENSION IF NOT EXISTS ...` を Run。

## # 4: PR #160 (Shiwakechou) merge タイミング = 既に merge 済（5/11 07:52 UTC、D-3 参照）

## # 5: 5/13 仕訳帳本番運用 Go/NoGo = 5/11 中前倒し（Plan A 改、A セクション参照）

# G. 並行進行 OK（Phase D-3/4/5 設計起草継続、a-bud-002 で）

apply 開始 (18:40) 〜 完了 (19:30) の間、a-bud-002 は以下を **並行で起草継続 OK**：

- Phase D-3 設計起草（給与計算ロジック詳細）
- Phase D-4 設計起草（賞与計算ロジック詳細）
- Phase D-5 設計起草（社会保険連携詳細）

→ apply エラー検出時は即中断して原因解析に切り替え、それ以外は手を止めず進めてほしい。

# H. ACK 形式（軽量、即 apply 開始に協力）

a-bud-002 から私への ACK は以下の最小フォーマットで OK：

~~~
bud-002- No. XX
【a-bud-002 → a-main-023 ACK】
発信日時: YYYY-MM-DD HH:MM

# Plan A 改 受領
- 5/11 中修復 + 今夜 19:30-20:00 仕訳帳本番運用 = 承知
- audit「14 件」差分 = 13 件確定で了解 (cross_rls_helpers 混入)
- verify SQL Run = a-main-023 担当で了解
- apply 順序ガイド受領待機

# 並行作業
- Phase D-3/4/5 設計起草継続中
~~~

→ 長文不要、上記 5 行程度で OK。即 D-1 (verify SQL Run) フェーズに移る。

# I. self-check

- [x] memory `feedback_dispatch_header_format` v5 準拠（投下情報先頭明示 + コピペ md 経由）
- [x] memory `feedback_gangan_mode_default` 違反訂正（5/12 → 5/11 中前倒し）
- [x] memory `feedback_reply_as_main_dispatch` 準拠（~~~ ラップ + 番号 + 発信日時）
- [x] memory `feedback_proposal_count_limit` 準拠（判断保留 5 件は既存論点回答のため上限例外）
- [x] memory `feedback_always_propose_next_action` 準拠（H で a-bud-002 の次アクション明示）
- [x] audit 差分回答（B セクション）= 客観データ (timestamp 順 13 件 + cross_rls_helpers の Garden 横断性) で裏付け
- [x] a-bud-002 .env.local 不在 escalation 対応 = a-main-023 が verify SQL Run 担当で明示
- [x] PR #160 merge タイミング = 5/11 07:52 UTC 既 merge で確定回答
- [x] 5/11 中着地スケジュール (18:30-20:00) = 90 分以内で実行可能、東海林さん作業実時間は 50-75 分 (Run + 動作確認)
~~~

---

## 起草メモ（東海林さん向け、投下用短文には含めない）

### この dispatch の位置づけ

- a-bud-002 # 46 への ACK 兼 Plan A 改採択通知
- audit # 15「14 件」差分の決着（cross_rls_helpers 混入カウントと判明、実態 13 件）
- 5/11 中仕訳帳本番運用着地のための apply スケジュール提示
- 判断保留 5 件を一括回答（# 2 B 案 / # 3 拡張 verify SQL 検出 / # 4 PR #160 merge 済 / # 5 5/11 中前倒し / # 1 audit 差分）

### 私 (a-main-023) の自己分析訂正点

bud-002- No. 46 受領時、私は「5/12 中 apply → 5/13 仕訳帳本番運用」をそのまま採択しかけた。
東海林さんの「今日はできない？」一言で、以下の保守的見通し違反に気付いた：

- a-bud-002 推奨「5/12」の根拠 = レビュー時間確保 (= 朝に挟む前提)
- 実態 = レビューは並行可能、apply 本体は技術的に今夜実行できる
- → memory `feedback_gangan_mode_default` の「5h フル活用 + 東海林さん作業時間最小化」本質に照らすと 5/11 中着地が正解
- → memory `feedback_strict_recheck_iteration` の「厳しい目で再確認 3 ラウンド」自発発動が今後の課題

### 次の自発アクション（東海林さん向け推奨 2 択）

【推奨】**A 案: 投下後即 D-1 (verify SQL 一括) を私が整形 → 東海林さんに渡す**
- 18:30 までに verify SQL 集約版が手元に届く → そのまま Supabase Dashboard で Run できる
- 19:30 仕訳帳本番運用開始の最短ルート

B 案: 投下後 a-bud-002 ACK を待ってから verify SQL 整形
- ACK 待ちで 5-10 分ロス、19:40 着地に後ろ倒し
- ACK 内容によっては設計判断が出るリスク有

→ A 案推奨（東海林さん「投下 OK」即 verify SQL 整形開始）。
