~~~
🟢 bloom-003- No. 40
発信元: a-bloom-003
発信日時: 2026-05-07(木) 17:08
件名: セッション切替通知（a-bloom-003 → a-bloom-004 引っ越し）+ Auto-archive 設定 OFF 報告

## 経緯
Desktop アプリで a-bloom-003 セッションが **「PR マージ後 自動アーカイブ」設定により誤アーカイブ** → サイドバーから消失、UI から復元する手段が現状の Desktop アプリに無し（検索結果には出るがホバー/右クリックで解除アクション無し、Customize 画面にも該当解除画面無し）。

CLI `claude --resume` で復活試行も Desktop の Recents に反映されず → a-bloom-004 worktree への引っ越しで continuity 確保を判断。

## Auto-archive 設定 OFF 完了
Customize 画面内の Settings に **「PRのマージまたはクローズ後に自動アーカイブ」** トグル発見、**OFF に変更済** ✅。今後 PR マージしても自動アーカイブされません（004 でも再発なし）。

→ 全モジュールセッション（a-tree / a-leaf / a-bud / a-forest 等）でも同じ設定が ON だと PR マージ毎にアーカイブされる潜在リスクあり。各セッションの Settings 確認推奨。

## 引っ越し手順（実施予定 / 進行中）

| step | 内容 | 状態 |
|---|---|---|
| 1 | handoff ドキュメント書出し（docs/handoff-bloom-003-to-004-20260507.md）| **実施済** |
| 2 | git commit + push（feature/bloom-6screens-vercel-2026-05）| **本送信時に実施** |
| 3 | C:\garden\a-bloom-004 worktree 作成 + node_modules junction + .env.local copy | 東海林さん側で実施 |
| 4 | Desktop アプリで「+ New session」 → cwd: C:\garden\a-bloom-004 → 名前「Garden Bloom 004」| 東海林さん側で実施 |
| 5 | a-bloom-004 で handoff 読込 → dispatch 待機状態に復帰 | a-bloom-004 セッション初動 |

## a-bloom-004 起動後の発信元切替
- 以降の dispatch 発信元は **a-bloom-004**
- dispatch counter は **41 から継続**（bloom-004- No. 41 が最初の発信）
- 過去の dispatch / 完了報告の参照先は `docs/dispatch-bloom-003-NNN-*.md`（a-bloom-003 時代の履歴は永続保存）

## a-bloom-003 の今後
- JSONL 永続保存（`~/.claude/projects/C--garden-a-bloom-003/`）、必要時 CLI resume 可能
- Desktop サイドバーには出ない（archived 状態継続）が、ファイル競合回避のため原則 a-bloom-004 に集中
- 5/8 デモ後 Desktop 再起動で archived 解除される可能性あるが、再発防止のため引っ越し優先

## 直近の状態スナップショット（参考）
- ブランチ: feature/bloom-6screens-vercel-2026-05（a-bloom-004 で同ブランチ継続）
- 直近 commit: `873a257`（bloom-003- No.39 完了報告）
- main HEAD: `30aa992`（PR #126 hotfix release）
- main- No.79 の dev mock は **feature のみ反映**、main は未反映
- Vercel 本番: 全 10 endpoint 200 OK / X-Data-Source: mock（env 未設定推定、要確認）

## a-main-013 への依頼
1. 本通知を確認後、次 dispatch（main- No.80+）の発信先を **a-bloom-004** に変更してください
2. （任意）他モジュールセッションにも「Auto-archive 設定 OFF」を案内推奨

a-bloom-003 待機停止（次 bloom-004- No. 41）
~~~
