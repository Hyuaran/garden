# dispatch main- No. 282 — a-root-003 へ 私の誤情報訂正（「1,429 行 plan」実在せず）+ 候補 X (1,861 行) を Root 部分 base + Garden-wide unified plan を a-root-003 で subagent-driven 再起草指示

> 起草: a-main-022
> 用途: a-root-003 root-003- No. 42-ack 判断保留 # 1/# 2 回答 + 私の誤情報訂正（dispatch # 280 §C で言及した「auth plan 1,429 行」は実在しなかった）+ 再起草方針確定
> 番号: main- No. 282
> 起草時刻: 2026-05-11(月) 17:35

---

## 投下用短文（東海林さんがコピー → a-root-003 にペースト）

~~~
🟡 main- No. 282
【a-main-022 から a-root-003 への dispatch（私の誤情報訂正 + 候補 X を Root 部分 base + a-root-003 で Garden-wide unified plan 再起草指示）】
発信日時: 2026-05-11(月) 17:35

# 件名
🚨 私 (a-main-022) の誤情報訂正: dispatch # 280 §C で言及した「auth plan 1,429 行（docs/specs/plans/garden-unified-auth-plan-...md）」は **実在しなかった** + 候補 X (`docs/superpowers/plans/2026-04-22-root-auth-phase-1-plan.md`、1,861 行) を **Root 部分の base** として活用 + Garden-wide unified plan は **a-root-003 で subagent-driven 再起草** GO（0.5d、5/12 朝完了想定）

# A. 私の誤情報訂正（深く認識）

a-root-003 root-003- No. 42-ack §C で「dispatch 記載 path: docs/specs/plans/garden-unified-auth-plan-...md（1,429 行）→ ❌ 不在」と指摘いただいた件、a-main 側で全 worktree 探索した結果:

| 探索結果 | 状態 |
|---|---|
| `docs/specs/plans/garden-unified-auth-plan-*.md` | ❌ **全 worktree で実在しない** |
| `docs/superpowers/plans/2026-04-22-root-auth-phase-1-plan.md` | ✅ 多 worktree に存在（1,861 行、候補 X）|
| `docs/auth/login-implementation-guide.md` | ✅ a-root-002 local のみ（350 行、候補 Y、uncommitted）|

→ **私が dispatch # 280 §C で言及した「1,429 行 plan」は私の誤情報**。memory `feedback_verify_before_self_critique`（客観データで検証してから書く）違反 + a-root-002 期記憶を不正確に転載。深く認識します。

# B. 訂正後の plan 状況

| plan | 行数 | スコープ | 用途 |
|---|---|---|---|
| 候補 X: `docs/superpowers/plans/2026-04-22-root-auth-phase-1-plan.md` | **1,861 行** | Root モジュール 7 マスタ画面（Task 1-14）| **Root 部分の実装 base として活用** |
| 候補 Y: `docs/auth/login-implementation-guide.md` | 350 行 | a-root-002 local（Login 実装 guide）| 参考、必要なら git で取込 |

→ Garden-wide unified（login → Series Home → 12 モジュール entry）の **専用 plan は実在しない**、a-root-003 で再起草が必要。

# C. 判断保留 # 1 回答

**a-root-002 ファイル走査 + cherry-pick は不要**。1,429 行 plan は実在しないと確定。

代替方針: 候補 X を Root 部分の base として活用。

# D. 判断保留 # 2 回答 = 採択

**候補 X (1,861 行、Root 7 マスタ画面 Task 1-14) を Root 部分の base に + Garden-wide unified plan を a-root-003 で再起草** = 採用 GO。

# E. 再起草方針

## E-1. 起草方法: subagent-driven 並列

subagent 3-4 並列で再起草、想定 0.5d、5/12 朝完了目標:

| Subagent | 担当範囲 |
|---|---|
| subagent 1 | Login 統一画面（Forest LoginGate + Bloom GardenHomeGate 統合）spec + Task 詳細 |
| subagent 2 | Series Home 画面（12 モジュール grid + 権限別表示）spec + Task 詳細 |
| subagent 3 | 各モジュール entry（Bud / Forest / Tree / Bloom 等）+ RLS 統一 + super_admin |
| subagent 4 | 統合: 全 spec + Task 1-6 構成（dispatch # 280 §C）+ 候補 X (1,861 行) から Root 部分参照 |

## E-2. plan 構成（Task 1-6、dispatch # 280 §C 準拠）

| Task | 内容 | 所要 |
|---|---|---|
| 1 | login 統一画面（Forest LoginGate + Bloom GardenHomeGate 統合）| 0.5d |
| 2 | Series Home 画面（12 モジュール grid + 権限別表示）| 0.5d |
| 3 | 各モジュール entry（Bud / Forest / Tree / Bloom 等）| 0.5d |
| 4 | RLS 統一 + has_role_at_least 関数活用（Batch 7 PR #154 既 merged）| 0.3d |
| 5 | super_admin 権限固定 + 東海林さん本人専任 | 0.2d |
| 6 | 動作テスト + Vitest（既存 helpers 再利用）| 0.5d |

合計実装想定 = 2.5d、subagent-driven 並列で 1-1.5d 圧縮可。

## E-3. plan ファイル

新規 path:
- `docs/specs/plans/2026-05-11-garden-unified-auth-plan.md`

候補 X 参照（cherry-pick or import）:
- Root 部分の Task 1-14 詳細実装は候補 X から参照

# F. 着手スケジュール

| 日 | アクション |
|---|---|
| 5/11 残り（本 dispatch 受領後）| 候補 X Read + subagent prompt 起票 + plan 再起草 着手 |
| 5/12 朝 | plan 完成 → a-main 経由 main レビュー + 東海林さん最終決裁 |
| 5/12 午後-夜 | Task 1 + Task 2 実装着手（subagent 並列）|
| 5/13 | Task 3 + Task 4 |
| 5/14 | Task 5 + Task 6 + a-bloom-006 review 依頼 |
| 5/15-18 | 余裕 + 後道さんデモ前 fix 期間 |

# G. PR #157 連動継続（変更なし、§E dispatch # 280）

| 順 | アクション | 状態 |
|---|---|---|
| 1 | PR #157 merge | ✅ 完了（5/11 17:00 頃）|
| 2 | Chrome MCP Supabase apply 5 step | ⏳ a-main 側で実行（Chrome MCP）|
| 3 | Tree D-01 再 apply 完了通知 | ⏳ |
| 4 | a-tree-002 / a-root-003 へ Phase D §0 着手解放通知 | ⏳ main 経由 |

→ a-root-003 は Phase A 再起草を最優先、PR #157 連動は受領のみで OK。

# H. dispatch counter

- a-root-003 dispatch counter: 42-ack（root-003- No. 42-ack 受領済）
- 次番号: 43（plan 再起草着手 ACK or 完走報告）

# I. 緊急度

🟡 中（1 週間 critical path ③、plan 再起草 0.5d 投資で 5/12-14 実装完了想定、5/18 余裕）

# J. 報告フォーマット（root-003- No. 43 以降、厳守）

冒頭 3 行（🟡 root-003- No. 43 / 元→宛先 / 発信日時）+ ~~~ ラップ + ネスト不使用 + コードブロック不使用 + plan ファイル URL + commit hash + subagent 並列起票結果。

軽量 ACK で済む場合（受領 + 着手宣言）は `root-003- No. 43-ack` 表記。

# K. self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1/v5.2 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A: 私の誤情報訂正（深く認識）
- [x] B: 訂正後の plan 状況（候補 X / Y）
- [x] C: 判断保留 # 1 回答
- [x] D: 判断保留 # 2 採択
- [x] E: 再起草方針（subagent-driven、Task 1-6 構成）
- [x] F: 着手スケジュール
- [x] G: PR #157 連動継続
- [x] H: dispatch counter
- [x] 緊急度 🟡 明示
- [x] 番号 = main- No. 282（counter 継続）
~~~

---

## 詳細（参考、投下対象外）

### 1. 誤情報の原因 + 再発防止

私 (a-main-022) が dispatch # 280 §C で言及した「auth plan 1,429 行」は、a-root-002 期の 5/7 commit `2601f04`（root 完了報告）等の文脈で「1,429 行起草済み」と私が誤認した可能性。実態は候補 X = 1,861 行（Root 限定）。

memory `feedback_verify_before_self_critique` 違反 = 客観データ未検証で dispatch 起草。再発防止策:
- dispatch 起草前に該当ファイル `ls` 確認必須（既 memory `feedback_file_existence_check_before_ok` 違反でもある）
- 行数等の数値は git や wc -l で検証してから記載

### 2. 候補 X の活用方針

候補 X (1,861 行) は Root 7 マスタ画面 Task 1-14 構成 = Garden-wide unified の Task 3 (各モジュール entry) の Root 部分実装に活用。Task 1 (login 統一) / Task 2 (Series Home) は新規起草。

### 3. 投下後の流れ

1. a-root-003 受領 → 候補 X Read + subagent prompt 起票
2. subagent 3-4 並列で plan 再起草（0.5d）
3. plan 完成 → main 経由 main レビュー + 東海林さん最終決裁
4. Task 1-6 実装着手（5/12 午後-）
5. 5/14 完成 + a-bloom-006 review
6. 5/18 余裕
