# dispatch main- No. 328 — a-bloom-006 へ PR #168 (Task 3 ModuleGate 統一) 単体 review 依頼

> 起草: a-main-023
> 用途: root-003 # 59 Task 3 完成 + 判断保留 # 1 (a-bloom-006 単体 review GO) 採択
> 番号: main- No. 328
> 起草時刻: 2026-05-11(月) 19:38

---

## 投下用短文（東海林さんがコピー → a-bloom-006 にペースト）

~~~
🟡 main- No. 328
【a-main-023 から a-bloom-006 への dispatch（PR #168 Task 3 ModuleGate 統一 単体 review 依頼）】
発信日時: 2026-05-11(月) 19:38

# 件名
🟡 a-root-003 # 59 Task 3 (ModuleGate 統一) 完成（PR #168 OPEN / MERGEABLE / tsc 0 エラー / 1h 完走 = 75% 圧縮）+ 単体 review 依頼（# 168 単独、Task 1-3 直線依存で batch 不適、5/12 朝 Task 6 着手前提）

# A. PR #168 概要

| 項目 | 値 |
|---|---|
| PR | #168 |
| タイトル | feat(garden): Garden unified auth Task 3 — ModuleGate 統一 + 12 module layout 装着 |
| base | develop |
| head | feature/garden-unified-auth-task3-module-gate |
| 状態 | OPEN / MERGEABLE |
| commit 数 | 5 (Step 単位) |

# B. review 観点

| # | 観点 |
|---|---|
| 1 | ModuleGate.tsx 共通基盤（useAuthUnified + isRoleAtLeast + redirect 統一）|
| 2 | module-min-roles.ts (12 module minRole 一元管理、Phase B-2 TODO）|
| 3 | AuthLoadingScreen.tsx（絵文字スピナー 12 module）|
| 4 | ForestGate ラッパー化（IN-4 遵守、rename しない、中身書換のみ）|
| 5 | BloomGate ラッパー化（git mv legacy + ModuleGate）|
| 6 | TreeAuthGate ラッパー化（legacy + 誕生日 2 段判定）|
| 7 | 残り 9 module layout 装着（soil/root/leaf/bud/seed/rill/fruit/sprout/calendar）|
| 8 | /access-denied ページ + 12 module ラベル |
| 9 | module-min-roles.test.ts + tsc 0 エラー検証 |
| 10 | redirect 仕様（未認証 + role 不足）の整合性 |
| 11 | IN-4 (Task 3 は ForestGate を rename しない) 遵守 |
| 12 | 後方互換: legacy `forest/login/page.legacy-20260511.tsx` 等の動作維持 |

# C. review 結果報告形式

軽量 batch review（bloom-006 # 18/#19/#22/#23 系列と同様）で OK。採否 1 行 + 軽量根拠で十分。

# D. MODULE_MIN_ROLES 一覧（参考）

| module | minRole |
|---|---|
| soil | admin |
| root | manager |
| tree | toss |
| leaf | staff |
| bud | manager |
| bloom | staff |
| seed | staff |
| forest | manager |
| rill | admin |
| fruit | manager |
| sprout | staff |
| calendar | staff |

# E. 後続フロー

| 順 | 担当 | 内容 |
|---|---|---|
| 1 | a-bloom-006 | PR #168 単体 review |
| 2 | a-main-023 | review 結果受領 → gh CLI で PR #168 admin merge（Vercel rate limit FAILURE skip 想定）|
| 3 | a-main-023 | a-root-003 へ Task 6 着手 GO 通知（# 330+、5/12 朝）|
| 4 | a-root-003 | Task 6 (Vitest + E2E) subagent 並列着手 |
| 5 | 5/12 朝 中 plan 全完成見込み（plan 5/14 想定の 2 日前倒し）|

# F. 連動

| 項目 | 値 |
|---|---|
| 連動 dispatch | # 324（PR #167 merge + Task 3 着手 GO）/ # 329（root-003 # 59 判断保留採択）|
| Vercel Pro 既契約済 認知 | 維持（rate limit でも本番 deploy 別経路）|

# G. ACK 形式（軽量、bloom-006- No. NN）

| 項目 | 内容 |
|---|---|
| 1 | # 328 受領確認 |
| 2 | PR #168 review 採否 + 軽量根拠 |
| 3 | 既存遡及検証 ETA 21:00 維持 |

# H. self-check
- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A PR 概要 / B 観点 12 件 / C 報告形式 / D MODULE_MIN_ROLES / E 後続 / F 連動 / G ACK
- [x] 起草時刻 = 実時刻（19:38）
- [x] 番号 = main- No. 328
~~~

---

## 詳細（参考、投下対象外）

### 連動

- root-003 # 59（5/11 Task 3 完成報告 + 判断保留 3 件）
- # 324（5/11 18:42、PR #167 merge + Task 3 着手 GO）
- # 329（同時起票、a-root-003 へ判断保留 3 件採択）
