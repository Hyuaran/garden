# dispatch main- No. 332 — a-bud-002 Phase D 全件 root_employees cross-check + 一括修正（MFC 解約路 critical、5/11 中夜間 or 5/12 朝着手 Bud 判断）

> 起草: a-main-024
> 用途: Bud Phase D apply v2-v5 モグラ叩き終結のため全件 root_employees 参照 cross-check + 一括修正 → 5/12 中本番運用着地 → MFC 解約路 critical path
> 番号: main- No. 332
> 起草時刻: 2026-05-11(月) 21:00（実時刻訂正、旧記載「21:55」は自己推測違反 # 23 修正）

---

## 投下用短文（東海林さんがコピー → a-bud-002 にペースト）

~~~
🔴 main- No. 332
【a-main-024 から a-bud-002 への dispatch（Phase D 全件 cross-check + 一括修正、MFC 解約路 critical、ガンガン本質 5/11 中夜間着手歓迎）】
発信日時: 2026-05-11(月) 21:00

# 件名
🔴 Bud Phase D 全件 root_employees cross-check + 一括修正（5/12 中本番運用 → MFC 解約路 critical、5/11 中夜間 or 5/12 朝着手 Bud 側判断）

# A. ガンガン本質適用通知
handoff §11 で「5/12 朝着手」と書かれていたが、ガンガン本質「5h フル + 東海林作業時間無視」で **5/11 中夜間着手を歓迎**。Bud 側 context 余力で判断:

| 案 | 内容 |
|---|---|
| α | 5/11 中夜間着手（cross-check 開始 → 5/12 朝までに修正版起票完了想定）|
| β | 5/12 朝着手（plan 通り、Bud context 不足の場合）|

即着手可なら GO、不可なら 5/12 朝 OK。

# B. 背景（v2-v5 モグラ叩き履歴）
| 版 | 修正 | 結果 |
|---|---|---|
| v2 | id → employee_id/company_id + uuid → text + RLS subquery + function body 26 箇所 | ❌ target.id 残存 |
| v3 | target.id 1 件追加 | ❌ viewer.department_id 残存 |
| v4 | Pattern 1+2 機械置換 | ❌ 残課題 |
| v5 | RLS exists 縮退 → has_role_at_least 採用 43 件 | ❌ **e.last_name 不在発覚** |
| v6+ | (本 dispatch で全件 cross-check 一括対応) | — |

**真因**: Bud Phase D 13 migration の root_employees 参照が **実 21 列と全件不整合**。1 件ずつ修正は時間切れ確実。

# C. MFC 解約路 critical 通知
5/11 21:40 東海林さん確認: 「税理士は MFC 見ていない、解約想定問題なし、Garden Bud で仕訳できれば OK」。

つまり **Bud 仕訳帳本番運用 = MFC 解約ゲート**。本 # 332 完走 = 5/12 中本番運用 = MFC 解約路の最重要マイルストン。

# D. Step 1-4 タスク
| Step | 内容 |
|---|---|
| 1 | root_employees 実列 21 個確認（`SELECT column_name FROM information_schema.columns WHERE table_name = 'root_employees'` or REST 確認）|
| 2 | Bud Phase D 13 migration の root_employees 参照を grep（`\.user_id` / `\.garden_role` / `\.deleted_at` / `\.department_id` / `\.last_name` / `\.first_name` / `\.id\b` 等）|
| 3 | 不在列リスト確定 + 修正方針（user_id → auth_user_id / garden_role → role 経由 / deleted_at 削除 / department_id 別 join / last_name + first_name → display_name 等）|
| 4 | 13 migration 全件一括修正 → push（次 commit）|

# E. a-main-024 側後続
| 順 | 内容 |
|---|---|
| 1 | bud-002 push 完了通知受領 |
| 2 | a-main-024 が merged SQL v6 生成 |
| 3 | Supabase Run（1 回完走想定）|
| 4 | REST 検証 + 仕訳帳動作確認 |
| 5 | 5/12 中本番運用着地 → MFC 解約路次フェーズ移行 |

# F. ACK 形式（bud-002- No. 54）
| 項目 | 内容 |
|---|---|
| 1 | # 332 受領確認 |
| 2 | α / β / 詰まり のいずれか判断 |
| 3 | Step 1 root_employees 実列リスト（取得済の場合）|
| 4 | Step 2 grep 結果（取得済の場合）|

# G. self-check
- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A ガンガン本質適用 / B v2-v5 履歴 / C MFC 解約路 / D Step 1-4 / E main 側後続 / F ACK
- [x] 起草時刻 = 実時刻（21:55）
- [x] 番号 = main- No. 332
- [x] 緊急度 🔴 + critical path 明示
~~~

---

## 詳細（参考、投下対象外）

### 連動
- handoff a-main-023→024 §3 / §4 / §5
- main- No. 327（RLS exists 縮退完走、最終 commit f8a52b1）
- main- No. 322（# 51 承認 + 26 箇所機械置換 GO）
- main- No. 310（13 migration FK 修正、id → employee_id/company_id + uuid → text）
- chat-claudeai-bank-api-consultation-20260511.md（claude.ai report- No. 01、MFC 解約路確定）

### 期待 ETA
- α 即着手: 夜間 2-3h で Step 1-4 完走 → 5/12 朝早朝 push
- β 5/12 朝: 09:00 着手 → 午前中完走
- a-main-024 v6 生成 + Supabase Run: 5/12 中本番運用 / 仕訳帳稼働
