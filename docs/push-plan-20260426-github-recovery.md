# 13 ブランチ push + PR 発行計画書 - 2026-04-26

> 本計画書は GitHub アカウント `ShojiMikoto`（shoji@hyuaran.com）suspended 復旧待機中の暫定運用として、新アカウント `ShojiMikoto-B`（shoji@centerrise.co.jp）で 13 ブランチ + 関連 commit を push + PR 発行する手順を定義する。

**作成日**：2026-04-26
**作成者**：a-main 006
**実行者**：a-main 006（一括）+ 必要に応じて各セッション
**前提**：槙さんによる Hyuaran org への新アカウント invite 受諾完了

---

## 0. 前提条件（push 開始前に必ず確認）

| # | 確認項目 | 確認コマンド | 期待結果 |
|---|---|---|---|
| 1 | gh auth 状態 | `gh auth status` | `Logged in to github.com account ShojiMikoto-B (Active)` |
| 2 | org member 確認 | `gh api user/orgs --jq '.[] \| .login'` | `Hyuaran` を含む |
| 3 | Garden repo push 権限 | `gh api repos/Hyuaran/garden --jq '.permissions.push'` | `true` |
| 4 | Anthropic API 制限解除 | a-auto-002 等が動作中か確認 | rate limit 解除済 |

→ 4 つすべて OK でなければ push 開始しない。

---

## 1. push 対象ブランチ（13 + α）

### 1.1 docs カテゴリ（4 本、低リスク優先）

| # | ブランチ | 所在 | 内容 | 先行 PR |
|---|---|---|---|---|
| 1 | `docs/handoff-a-main-005-to-006` | a-main-005 | 005 → 006 ハンドオフ | docs only |
| 2 | `docs/claude-md-modules-12` | a-main-005 | CLAUDE.md モジュール表 + §18 改訂 | docs only |
| 3 | `docs/kintone-fruit-sprout-analysis-20260426` | a-main-005 | Kintone 6 アプリ解析 | docs only |
| 4 | `docs/handoff-bloom-20260423`（必要に応じて）| a-bloom | bloom 系 handoff | docs only |

### 1.2 chore / fix カテゴリ（3 本、独立）

| # | ブランチ | 所在 | 内容 |
|---|---|---|---|
| 5 | `chore/bloom-effort-tracking-backfill-202604261` | a-bloom | A+C+後道さん資料 |
| 6 | `fix/develop-next-build-lockfile-sync` | a-bloom | npm install 手順書 |
| 7 | `feature/bloom-login-and-returnto-fix` | a-bloom | bloom 独立 login + returnTo |

### 1.3 feature カテゴリ（6 本 + 5 セッション継続分）

| # | ブランチ | 所在 | 内容 |
|---|---|---|---|
| 8 | `feature/cross-history-delete-specs-batch14-auto` | a-auto | #47 SQL injection 修正（重大指摘 5 件目最終）|
| 9 | `feature/leaf-a1c-task-d1-pr` | a-leaf | #65 Leaf SECURITY DEFINER 修正 |
| 10 | `feature/forest-t-f5-tax-files-viewer` | a-forest | #64 Forest ENUM typo 修正 |
| 11 | `feature/bud-phase-0-auth` | a-bud | #55 Bud RLS 修正 |
| 12 | `feature/bud-phase-d-specs-batch17-auto-fixes` | a-bud | #74 給与 PDF 修正 + Y 案整合 |
| 13 | `feature/sprout-fruit-calendar-specs-batch18-auto` | a-auto-002 | Sprout/Fruit/Calendar batch + Y 案整合 + Kintone 8 件 + 6 件 follow-up |
| 14 | `feature/soil-phase-b-specs-batch19-auto` | a-auto | Soil Phase B 7 spec |

### 1.4 新規追加（5 セッション稼働中、完走後に push）

5 セッションが今動作中のため、完走後に追加 commit が乗る予定：

| 対象 | 担当 | 想定 commit |
|---|---|---|
| `feature/sprout-fruit-calendar-specs-batch18-auto` | a-auto-002 | Kintone 残 6 件反映追加 commit |
| `feature/bud-phase-d-specs-batch17-auto-fixes` or 新規ブランチ | a-bud | Bud Phase D 5 件反映 + 新規 spec 2 本 |
| 新規 or 既存 root ブランチ | a-root | Root 6 件反映 |
| `feature/forest-t-f5-tax-files-viewer` | a-forest | Forest #21 注記追加 |
| `feature/leaf-a1c-task-d1-pr` | a-leaf | Leaf #22 type/business_id 反映 |

---

## 2. push 順序（推奨）

### Phase 1：docs カテゴリ先行（リスク最小）

```bash
# 1. handoff
cd C:/garden/a-main-005
git checkout docs/handoff-a-main-005-to-006
git push -u origin docs/handoff-a-main-005-to-006
sleep 30

# 2. CLAUDE.md modules
git checkout docs/claude-md-modules-12
git push -u origin docs/claude-md-modules-12
sleep 30

# 3. Kintone analysis
git checkout docs/kintone-fruit-sprout-analysis-20260426
git push -u origin docs/kintone-fruit-sprout-analysis-20260426
sleep 30
```

### Phase 2：fix / chore カテゴリ（独立）

```bash
# 4-7. bloom 系
cd C:/garden/a-bloom
git checkout chore/bloom-effort-tracking-backfill-202604261
git push -u origin chore/bloom-effort-tracking-backfill-202604261
sleep 30

git checkout fix/develop-next-build-lockfile-sync
git push -u origin fix/develop-next-build-lockfile-sync
sleep 30

git checkout feature/bloom-login-and-returnto-fix
git push -u origin feature/bloom-login-and-returnto-fix
sleep 30
```

### Phase 3：重大指摘 5 件（既存 PR に追加 commit）

```bash
# 8. cross-history #47
cd C:/garden/a-auto
git checkout feature/cross-history-delete-specs-batch14-auto
git push origin feature/cross-history-delete-specs-batch14-auto
sleep 30

# 9. leaf #65
cd C:/garden/a-leaf
git push origin feature/leaf-a1c-task-d1-pr
sleep 30

# 10. forest #64
cd C:/garden/a-forest
git push origin feature/forest-t-f5-tax-files-viewer
sleep 30

# 11. bud #55
cd C:/garden/a-bud
git checkout feature/bud-phase-0-auth
git push origin feature/bud-phase-0-auth
sleep 30

# 12. bud #74 + Y 案 + Kintone 5 件（完走後）
git checkout feature/bud-phase-d-specs-batch17-auto-fixes
git push -u origin feature/bud-phase-d-specs-batch17-auto-fixes
sleep 30
```

### Phase 4：大規模 spec batch（5 セッション完走後）

```bash
# 13. Sprout/Fruit/Calendar batch 18 + Y 案 + Kintone 14 件
cd C:/garden/a-auto-002
git push -u origin feature/sprout-fruit-calendar-specs-batch18-auto
sleep 30

# 14. Soil Phase B batch 19
cd C:/garden/a-auto
git checkout feature/soil-phase-b-specs-batch19-auto
git push -u origin feature/soil-phase-b-specs-batch19-auto
sleep 30
```

→ 各 push 後 30 秒間隔（GitHub suspension 再発防止）。total 約 7-10 分。

---

## 3. PR 発行戦略

### 3.1 一括発行スクリプト（push 完了後）

```bash
# Phase 1: docs PRs
gh pr create --base develop --head docs/handoff-a-main-005-to-006 \
  --title "docs(a-main): 005 → 006 ハンドオフ + 教訓 memory" \
  --body "$(cat docs/handoff-a-main-005-to-006.md | head -40)"

gh pr create --base develop --head docs/claude-md-modules-12 \
  --title "docs(claude): CLAUDE.md モジュール表 + §18 Phase 配置改訂" \
  --body "..."

# ... 13 PR 順次発行
```

### 3.2 PR ボディテンプレ

各 PR で以下を最低限明記：
- 概要（何を変更したか）
- 関連 issue / 確定ログ参照
- テスト結果（該当する場合）
- レビュー観点（a-review が見るべき点）

### 3.3 base ブランチ

**全 PR の base = `develop`**（main に直接 push しない、CLAUDE.md §運用ルール準拠）

### 3.4 merge 順序（推奨）

1. **docs PR 3 本を先行 merge**（影響なし）
2. **重大指摘 5 件 PR を merge**（セキュリティ優先）
3. **その他 feature PR を a-review 確認後 merge**

---

## 4. 安全装置・チェック

### 4.1 push 中に GitHub から異常を感じたら

- `gh api rate_limit` で残量確認
- 30 秒 → 60 秒 → 120 秒に間隔拡大
- 場合により**一時停止 + Anthropic API も含めて全停止 5 分**

### 4.2 push 失敗時のリトライ

```bash
# 認証エラーの場合
gh auth refresh

# レート制限の場合
sleep 600 && retry
```

### 4.3 元アカウント `ShojiMikoto` 復旧時のロールバック

```bash
# 全 13 セッション
gh auth login  # 元 ShojiMikoto で再認証
git config user.email "shoji@hyuaran.com"  # 維持していれば変更不要
```

→ 元アカウント復旧後の merge / 続作業はそのまま継続可能。

---

## 5. 進捗管理

push 中の進捗は本ファイルの末尾に追記：

```markdown
## 6. 実行ログ

### 2026-04-26 HH:MM 〜
- ✅ docs/handoff-a-main-005-to-006 push @ HH:MM
- ✅ docs/claude-md-modules-12 push @ HH:MM
- ⏳ docs/kintone-fruit-sprout-analysis-20260426 push 待機中
...
```

---

## 6. 前提リスク・既知課題

| # | リスク | 対処 |
|---|---|---|
| 1 | 新アカウント `ShojiMikoto-B` も同様に suspended される | 30 秒間隔遵守、burst 回避 |
| 2 | 一部ブランチに conflict 発生（develop と乖離） | a-bloom / a-auto 等で **develop pull → rebase or merge** で解消 |
| 3 | 大規模 PR の Vercel build 失敗（spec 改訂のみは影響なし） | docs only PR は build 失敗無視で merge OK |
| 4 | a-review レビュー逐次依頼で時間消費 | 重大指摘優先、軽微 PR は self-review でも可（東海林さん許可） |
| 5 | 5 セッション完走遅延 | Phase 4 を切り離して先に Phase 1-3 完了させる |

---

## 7. 完了基準

- 13 ブランチすべて push 完了（`gh pr list --state open` で全件可視）
- 13 PR 発行完了（Vercel build 状態確認）
- a-review 着手依頼（重大指摘 PR 優先）
- a-main 006 で本ファイル更新 + 完了報告

---

## 改訂履歴

- 2026-04-26 初版（a-main 006）
