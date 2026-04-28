# PR merge 計画 - GitHub Team プラン課金 解除後 一括実行 - 2026-04-27

> 起草: a-main-009
> 用途: 4/27 GitHub crisis 後、Team プラン課金 48h block 解除（4/29 夕方 想定）後の PR merge 順序 + 手順
> 前提: a-review APPROVE 済 PR + a-bloom-002 ローカル commit を一括 push + merge

## 現状の PR 状態（4/27 19:50 時点）

| PR | branch | 最新 SHA | a-review 判定 | conflict | merge 可否 |
|---|---|---|---|---|---|
| **#85** | feature/bud-phase-0-auth-v2 | (merged) | ✅ APPROVE | - | ✅ 完了（4/27 17:16）|
| **#82** | feature/bud-phase-d-specs-batch17-auto-fixes | `19f2151` | ✅ APPROVE 条件付（comment-4324851017）| 解消済 | 🟡 待機 |
| **#101** | feature/soil-phase-b-specs-batch19-auto | `db5255a` | ✅ APPROVE（comment-4325349139）| 不要 | 🟡 待機 |
| **#87** | feature/cross-history-delete-specs-batch14-auto-v2 | `03dbd2d` | ⏸ コメント未投稿（a-review GitHub block）| 解消済 | 🟡 待機 |
| **#81** | workspace/a-main-006 | `11321e4` | CONDITIONAL（a-review）| 解消済 | 🟡 待機 |
| **#109** | feature/tree-phase-d-01-implementation-20260427 | (a-tree push 済) | ⏸ レビュー待機 | - | 🟡 |
| **#110** | feature/tree-phase-d-02-implementation-20260427 | (a-tree push 済) | ⏸ レビュー待機 | - | 🟡 |
| **#106** | feature/garden-common-ui-and-shoji-status | (a-bloom-002、ローカル 8 commits 未 push) | - | - | ⏸ push 必要 |
| **#100** など他 | 各 a-auto / cross-ui 系 | ✅ APPROVE 多数 | - | 一部 | 🟡 一括 |

## Team プラン適用後 即実行 タスク

### Step 1: a-bloom-002 ローカル commit 一括 push（最優先）

```bash
cd /c/garden/a-bloom-002
git log --oneline -10
git push origin feature/garden-common-ui-and-shoji-status
```

push commits:
- ababd29 (V7-A、push 済)
- 500538d (V7-B)
- 353e5d1 (V7-C)
- 82b7223 (V7-D)
- a4fe66a (v4 image)
- 7021195 (V7-D-fix)
- e2f7570 (V7-D-fix2)
- 41f51bc (merge develop)
- 0ab9aa0 (V7-E Coming Soon)

→ 8 commits push、PR #106 が一気に最新化。

### Step 2: a-review に #106 + #87 再レビュー依頼

PR #106（dispatch v7 完成形）を a-review に priority 1 でレビュー依頼:
- 5/5 デモ用最重要
- 12 モジュール ホーム画面 + Coming Soon + 認証 / 動的データ
- 全 commits 整合性 + 4 KPI / 12 module / Today's Activity の機能テスト

PR #87 は a-review が disk 保存した review を投稿（GitHub block 解除後手動）。

### Step 3: 全 PR merge 順序

5 分間隔遵守（memory `feedback_main_session_lessons_005.md` §4.1）:

| 順 | PR | 待機時間 | 備考 |
|---|---|---|---|
| 1 | #82 | - | a-bud 給与 PDF + Y 案 |
| 2 | #101 | 5 分後 | a-soil Phase B |
| 3 | #87 | 5 分後 | cross-history NEW.id 修正 |
| 4 | #109 | 5 分後（a-review APPROVE 後）| Tree D-01 schema migration |
| 5 | #110 | 5 分後 | Tree D-02 オペレーター UI（D-01 merge 後）|
| 6 | #81 | 5 分後 | a-main-006 ハンドオフ |
| 7 | #106 | 5 分後（a-review APPROVE 後）| dispatch v7 完成、5/5 デモ用 |
| 8〜 | 他 | 5 分間隔 | a-auto 系 / cross-ui 系 等 |

合計 PR 件数: ~10-15 件、所要時間 50-75 分（5 分間隔遵守）。

### Step 4: develop → main reflect（5/5 デモ用）

5/5 デモ前に main 最新化:

```bash
gh pr create --repo Hyuaran/garden \
  --base main \
  --head develop \
  --title "release: 5/5 後道さんデモ用 develop → main reflect" \
  --body "..."
```

main → Vercel production deploy。

### Step 5: Vercel preview / production 動作確認

| 環境 | URL | 確認 |
|---|---|---|
| Production | https://garden.vercel.app（or 本番 URL）| 5/5 デモ前最終確認 |
| Preview | PR #106 自動 deploy URL | 各 PR の動作確認 |

## C 垢 (shoji-hyuaran) 認証切替（並行）

Team プラン適用と同時に gh auth login で C 垢に切替:

```bash
# 既存 token 削除
gh auth logout -h github.com -u ShojiMikoto-B
gh auth logout -h github.com -u ShojiMikoto

# C 垢ログイン
gh auth login
# プロンプト: github.com / HTTPS / Y / browser
# 表示コードを Edge で貼り付け → 認可

# git credential 同期
gh auth setup-git

# 全 9 worktree git config 切替
for w in /c/garden/a-main /c/garden/a-main-005 /c/garden/a-main-006 /c/garden/a-main-007 /c/garden/a-main-008 /c/garden/a-main-009 /c/garden/a-bloom-002 /c/garden/a-review; do
  cd "$w"
  git config user.name "Mikoto Shoji"
  git config user.email "shoji-dev@hyuaran.com"
done
git config --global user.name "Mikoto Shoji"
git config --global user.email "shoji-dev@hyuaran.com"
```

## 注意事項

- **5 分間隔厳守**（memory `feedback_main_session_lessons_005.md` §4.1）
- 1 日 PR merge 上限 10-15 件目安（4/27 同様の連投で再 ban 回避）
- 全 PR は a-review APPROVE 確認後 merge（一部のみ APPROVE 待機なら別途）
- conflict 残あれば事前解消（先に push、merge は CI green 後）
- **東海林さん本人の操作（merge ボタンクリック）が必須**（a-main-009 経由ではなく GitHub UI 直接）

## Team プラン課金 解除確認方法

```
https://github.com/orgs/Hyuaran/settings/billing/overview
```

| 表示 | 状態 |
|---|---|
| Current plan: GitHub Team | ✅ 解除完了 |
| Current plan: GitHub Free + 「billing issue」 | ⚠️ まだ block 中 |

## Sophia Hayes 復旧返答後の対応

Sophia から「reinstated」or「guidance only」or「rejected」のいずれか返信が来たら:

| 返答 | 対応 |
|---|---|
| ✅ B 垢 reinstated | 旧 B 垢 (ShojiMikoto-B) を gh auth で復活、ただし C 垢のまま運用継続が安全 |
| 📋 guidance only（運用指針）| 指針を memory に追記、C 垢で運用継続 |
| ❌ rejected | C 垢で正規運用継続、Team プラン適用で安心材料 |

## 改訂履歴

- 2026-04-27 初版（a-main-009、Team プラン課金解除後の一括 merge 計画）
