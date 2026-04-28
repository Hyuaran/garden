# C 垢稼働後の gh CLI 切替 + 全 worktree git config 統一手順 - 2026-04-27

> 起草: a-main-009
> 用途: 槙さんの org 招待 accept 後、C 垢で Garden に push 可能にする一連の操作
> 前提: C 垢 = shoji-hyuaran (shoji-dev@hyuaran.com)、Hyuaran org Team プラン化、招待 accept 済み

## 実行順序（30 分目安）

| Step | 内容 | 工数 |
|---|---|---|
| 1 | 旧 token 削除（B 垢 / A 垢）| 1 分 |
| 2 | C 垢で gh auth login | 5 分 |
| 3 | gh auth setup-git で Windows 資格情報マネージャ更新 | 1 分 |
| 4 | 全 9 worktree の git config 一括切替 | 3 分 |
| 5 | test push で動作確認 | 5 分 |
| 6 | 5 分待機 → 通常運用再開 | 待機 |

## Step 1: 旧 token 削除

```bash
gh auth logout -h github.com -u ShojiMikoto-B
gh auth logout -h github.com -u ShojiMikoto
```

両方とも「No active token」のエラーが出ても OK（既に invalid のため）。

## Step 2: C 垢で gh auth login

```bash
gh auth login
```

対話プロンプト回答:

| 質問 | 回答 |
|---|---|
| Where do you use GitHub? | `GitHub.com` |
| What is your preferred protocol for Git operations? | `HTTPS` |
| Authenticate Git with your GitHub credentials? | `Y` |
| How would you like to authenticate GitHub CLI? | `Login with a web browser` |
| One-time code | 表示された 8 桁コードをコピー |

ブラウザで:

1. https://github.com/login/device に移動（自動で開く場合あり）
2. **C 垢 (shoji-hyuaran) でログイン済の Edge** で開く
3. 表示された 8 桁コードを貼り付け
4. 認可ボタン押下 → CLI 側で `Authentication complete.` 表示

## Step 3: gh auth setup-git

```bash
gh auth setup-git
```

→ Windows 資格情報マネージャの GitHub 関連 entry を C 垢 token で更新（旧 B 垢 token を上書き）。

## Step 4: 全 9 worktree の git config 一括切替

a-main-009 から下記を実行:

```bash
for w in /c/garden/a-main /c/garden/a-main-005 /c/garden/a-main-006 /c/garden/a-main-007 /c/garden/a-main-008 /c/garden/a-main-009 /c/garden/a-bloom-002 /c/garden/a-review; do
  if [ -d "$w/.git" ] || [ -f "$w/.git" ]; then
    cd "$w"
    git config user.name "Mikoto Shoji"
    git config user.email "shoji-dev@hyuaran.com"
    echo "✓ $w: $(git config user.email) / $(git config user.name)"
  else
    echo "✗ $w: not a git worktree"
  fi
done
cd /c/garden/a-main-009
```

※ `/c/garden/a-main` 以外の worktree は git ファイル（テキスト）参照型のため `[ -f .git ]` 判定。

global config も統一推奨:

```bash
git config --global user.name "Mikoto Shoji"
git config --global user.email "shoji-dev@hyuaran.com"
```

## Step 5: test push 動作確認

最も影響少ない docs 変更で test:

```bash
cd /c/garden/a-main-009
echo "" >> docs/effort-tracking.md
git add docs/effort-tracking.md
git commit -m "test(c-account): C 垢稼働確認 (空行追加 only)"
git push origin workspace/a-main-009
```

成功時の表示例:
```
To https://github.com/Hyuaran/garden.git
   xxxxxxx..yyyyyyy  workspace/a-main-009 -> workspace/a-main-009
```

失敗時:
- `403 Your account is suspended` → C 垢も即 ban の異常事態 → Team プラン適用前の可能性、槙さんに確認
- `403 Permission denied` → org 招待 accept 未完了 or Member 権限なし、槙さんに確認
- 認証エラー → Step 2-3 やり直し

## Step 6: 5 分待機 + 通常運用再開

test push 成功後 **最低 5 分待機**してから次の push。

連投厳禁（再 ban の最大要因）。

## ⚠️ 動作確認後の運用ルール（厳守）

memory `project_github_account_crisis_20260427.md` 7 教訓の適用:

| ルール | 内容 |
|---|---|
| **24h 静か運用** | C 垢稼働最初の 24 時間は test push 1 件 + 必要最小限の push のみ |
| **5 分間隔** | push 間隔最低 5 分、burst 禁止 |
| **1 日上限** | PR 5-10 件 / push 10-20 件 |
| **commit message** | AI 生成風を避け、日本語で意図明示 |
| **2FA 維持** | 解除しない |
| **conflict 解消も間隔** | 連続 conflict 解消 push は ban 引き金になる、1 件 5 分 |

## 改訂履歴

- 2026-04-27 初版（a-main-009、C 垢稼働後の自動化手順、槙さん招待 accept 後即実行用）
