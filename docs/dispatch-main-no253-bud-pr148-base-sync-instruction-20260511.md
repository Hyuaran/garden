~~~
🟡 main- No. 253
【a-main-021 から a-bud-002 への dispatch】
発信日時: 2026-05-11(月) 13:15

# 件名
PR #148 (Bud Phase D 100% 完成) base sync 指示 — 931 files / 30 commits spillover を純粋 Bud diff のみに整理 → PR 更新 → merge 容易化

# A. 経緯

a-bloom-006 # 9 (2026-05-11 12:50) review で PR #148 採用推奨 + **重要観察** あり:

| 項目 | 値 |
|---|---|
| PR title | "Phase D 100% 完成 — 給与処理 12 件統合" |
| 実 diff | **931 files / +177,162 / -245 / 30 commits** |
| 実 bud 実装 | ~30 files（12 migrations + zengin lib + bud-specific）|
| 残 ~900 files | Bloom legacy / avatar PNGs / bloom-003 dispatches / handoff docs 等 |
| 推測原因 | base (develop) が main から遅れていた時点で feature/bud-phase-d-implementation-002 を派生 → develop に他モジュール（特に Bloom）の commit が流入後、PR #148 内に spillover として混入 |

a-main-021 + 東海林さん協議結果: **base sync 後 merge** 採用（推奨 A、ロールバック容易性 + diff scope 整理）。

# B. 作業指示

## B-1. 目的

feature/bud-phase-d-implementation-002 ブランチ（PR #148 起源）を **最新 develop に合わせ直す** → PR #148 の diff から不要な ~900 files（Bloom legacy 等）を除外、**純粋 Bud diff（~30 files）のみ**に整理。

## B-2. 実施手順候補（推奨）

| 順 | コマンド | 内容 |
|---|---|---|
| 1 | `cd C:/garden/a-bud-002` | a-bud-002 worktree へ移動 |
| 2 | `git fetch origin` | 最新 develop 取得 |
| 3 | `git checkout feature/bud-phase-d-implementation-002` | 対象ブランチに切り替え |
| 4 | `git status` | uncommitted ない確認 |
| 5 | **方式 A**: `git merge origin/develop`<br>**方式 B**: `git rebase origin/develop` | spillover commit を base 統合（A 推奨、衝突解消が明示的）|
| 6 | （衝突あれば）衝突解消 → `git add` → `git commit` | merge コミット作成 |
| 7 | `git push origin feature/bud-phase-d-implementation-002`（merge 方式）<br>or `git push --force-with-lease`（rebase 方式）| PR #148 自動更新 |
| 8 | GitHub UI で PR #148 の diff 確認 | 純粋 Bud diff（~30 files）になっているか確認 |
| 9 | a-main-021 経由で東海林さんへ完了報告（dispatch bud-002- No. NN）| - |

## B-3. 衝突想定 + 解消ガイド

| ファイル種別 | 想定衝突 | 解消方針 |
|---|---|---|
| Bloom legacy （avatar PNGs / dispatches / handoff 等）| develop 側にのみ存在、feature/bud 側に重複 push 履歴あり | develop 側を採用（feature/bud 側の重複を破棄）|
| Bud migration / zengin lib | feature/bud 側のみ | feature/bud 側を採用（develop に未存在）|
| 共通設定ファイル（package.json / tsconfig.json 等）| 両側で更新 | merge 結果を慎重に確認、最新 develop + bud 新規依存を統合 |

衝突解消が複雑な場合は **即停止**、a-main-021 経由で東海林さんへ判断仰ぎ（無理に解消しない）。

## B-4. 期待される結果

- PR #148 の diff が **931 files → ~30 files** に削減
- 「+177,162 / -245」が「+10,000 程度 / -数百」に削減
- 30 commits の整理（merge 方式なら 1 merge commit 追加で 31 commits、rebase 方式なら ~30 commits → 線形化）
- a-bloom-006 + a-main-021 で再 review 容易化、東海林さん merge 判断容易化

# C. 緊急度・期限

🟡 中（後道さんデモ前 critical path への影響は低、本日中の base sync 完了推奨 + 完了報告期待）

# D. 完了報告フォーマット（bud-002- No. NN）

冒頭 3 行（🟢 bud-002- No. NN / 元→宛先 / 発信日時）+ ~~~ ラップ + ネスト不使用 + コードブロック不使用 + 冒頭 3 行 ~~~ 内配置（v5.1/v5.2 完全準拠）。

報告内容:
- 採用方式（merge / rebase）
- 衝突件数 + 解消サマリ
- PR #148 更新後の diff 件数（前: 931 → 後: ~XX）
- commit 履歴の変化
- PR #148 mergeStateStatus（CLEAN / DIRTY 等）
- 次アクション（東海林さん merge GO 待ち）

# E. 注意事項

| 注意 | 内容 |
|---|---|
| Garden 全体 .git 配下への影響 | feature/bud-phase-d-implementation-002 ブランチ限定の操作、他ブランチ（main / develop / feature/forest-* 等）への影響なし |
| force push 警告 | rebase 方式選択時は `--force-with-lease`（他人の push を上書きしない安全版）を必ず使用、`-f` 単独は禁止（memory `feedback_dispatch_powershell_rate_limit` 系の安全ルール） |
| 進行中 PR (#148) | open 状態のまま操作可、close 不要 |
| a-bud-002 既存作業 | 他作業（Phase E 起草等）と並行可、ただし feature/bud-phase-d-implementation-002 ブランチ操作中は他作業の同ブランチ push 禁止 |

# F. 補足: bloom-006 # 9 review 採用推奨

a-bloom-006 が PR #148 を 4 観点で採用推奨 + 重要観察 1 件:
- FK 整合 ✅ / 認証ロール 8 段階 + payroll 5 種 ✅ / Bloom 衝突なし ✅ / 旧版データ保持 ✅
- legacy パターン大量維持 (BloomNavGrid 4 / BloomTopbar 3 / BloomSidebar 3 versions 等) ← 本 base sync で整理見込み

→ Bud 実装 ~30 files の品質は OK、scope 整理のみが本作業の焦点。

# 緊急度

🟡 中（base sync 完了で PR #148 merge 容易化、Phase D 100% 完成の正式 merge への最終ステップ）

# 報告フォーマット（bud-002- No. NN 以降）

冒頭 3 行（🟢 bud-002- No. NN / 元→宛先 / 発信日時）+ ~~~ ラップ + ネスト不使用 + コードブロック不使用 + 冒頭 3 行 ~~~ 内配置（v5.1/v5.2 完全準拠）。

# self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1/v5.2 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A: 経緯（931 files spillover 確定値 + 推測原因）
- [x] B-1: 目的（純粋 Bud diff 整理）
- [x] B-2: 実施手順 9 step + 推奨方式（merge）
- [x] B-3: 衝突想定 + 解消ガイド
- [x] B-4: 期待される結果（before/after 数値）
- [x] D: 完了報告フォーマット
- [x] E: 注意事項（特に force push 安全ルール）
- [x] 緊急度 🟡 明示
- [x] 番号 = main- No. 253（counter 継続）
~~~
