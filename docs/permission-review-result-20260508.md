Scanning 50 jsonl files (top 50 by mtime)...

Total Bash commands collected: 3898
Unique normalized commands: 160

## 昇格候補（非破壊・3 回以上、既存 allow 外）

22 件

| # | パターン | 回数 | サンプル |
|---|---|---|---|
| 1 | `Bash(ls *)` | 475 | `ls docs/handoff-a-main-013-to-014-* 2>&1 && echo "---" && cat docs/dispatch-coun` |
| 2 | `Bash(grep *)` | 211 | `grep -n "2026-05" docs/effort-tracking.md 2>&1 \| tail -20 && echo "---" && wc -l` |
| 3 | `Bash(echo *)` | 131 | `echo "=== 今日 5/7 のコミット ==="; for d in C:/garden/a-*; do if [ -d "$d/.git" ]; the` |
| 4 | `Bash(git log --oneline *)` | 85 | `git log --oneline -5 docs/effort-tracking.md 2>&1 && echo "---" && grep -n "a-ma` |
| 5 | `Bash(git status *)` | 80 | `git status && echo "---" && git pull origin workspace/a-main-014 2>&1 \| tail -5 ` |
| 6 | `Bash(cat *)` | 70 | `cat "G:/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/.claude/last-permission-review.txt" ` |
| 7 | `Bash(wc *)` | 53 | `wc -l docs/demo-rehearsal-bloom-20260508.md` |
| 8 | `Bash(pwd *)` | 36 | `pwd && echo "---" && git status && echo "---" && git branch --show-current` |
| 9 | `Bash(tail *)` | 34 | `tail -10 docs/effort-tracking.md 2>&1` |
| 10 | `Bash(git diff *)` | 13 | `git diff --stat HEAD` |
| 11 | `Bash(head *)` | 11 | `head -30 "C:/garden/a-tree-002/src/app/tree/breeze/page.tsx" 2>/dev/null` |
| 12 | `Bash(git log --all *)` | 11 | `git log --all --oneline \| head -10 && echo "---"; git branch -r \| head -20` |
| 13 | `Bash(npm test -- *)` | 10 | `npm test -- --run 2>&1 \| tail -100` |
| 14 | `Bash(git show --stat *)` | 9 | `git show --stat 873a257 \| head -30
echo "==="
git show --stat 16f7e42 \| head -30` |
| 15 | `Bash(npm run dev *)` | 7 | `npm run dev` |
| 16 | `Bash(git ls-remote *)` | 6 | `git ls-remote origin 2>&1 \| head -20 && echo "---" && git branch -r 2>&1 \| head ` |
| 17 | `Bash(git show feature/tree-phase-d-01-implementation-20260427:supabase/migrations/20260427000001_tree_phase_d_01.sql *)` | 6 | `git show feature/tree-phase-d-01-implementation-20260427:supabase/migrations/202` |
| 18 | `Bash(git remote -v *)` | 5 | `git remote -v 2>&1; echo "---"; mkdir -p docs/review-pending-202604260042 && cp ` |
| 19 | `Bash(git log origin/feature/tree-phase-d-02-implementation-20260427 *)` | 4 | `git log origin/feature/tree-phase-d-02-implementation-20260427 --oneline \| grep ` |
| 20 | `Bash(git status; *)` | 4 | `git status; echo "==="; ls src/app/_components/layout/ 2>&1; ls src/app/_compone` |
| 21 | `Bash(git show cfe1282:docs/handoff-root-phase-a-3-complete.md *)` | 3 | `git show cfe1282:docs/handoff-root-phase-a-3-complete.md` |
| 22 | `Bash(git show origin/develop:docs/specs/cross-cutting/spec-cross-audit-log.md *)` | 3 | `git show origin/develop:docs/specs/cross-cutting/spec-cross-audit-log.md \| head ` |

## deny 強化候補（破壊系・既存 deny 外）

0 件

| # | パターン | 回数 | サンプル |
|---|---|---|---|

## 保留（判断迷い・3 回以上）

33 件

| # | パターン | 回数 | サンプル |
|---|---|---|---|
| 1 | `Bash(cd *)` | 661 | `cd "G:/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/006_日報自動配信" && python -c "from queue_` |
| 2 | `Bash(curl *)` | 96 | `curl -s -o /dev/null -w "%{http_code} \| /bloom\n" --max-time 600 http://localhos` |
| 3 | `Bash(git push *)` | 51 | `git push origin "origin/feature/tree-phase-d-01-implementation-20260427:refs/hea` |
| 4 | `Bash(for *)` | 42 | `for f in docs/specs/2026-04-25-root-phase-b-*.md; do echo "=== $f ==="; grep -A1` |
| 5 | `Bash(# *)` | 32 | `# Check if the big bloom-002 PR exists (maybe via branch search)
gh pr list --st` |
| 6 | `Bash(sleep *)` | 29 | `sleep 30 && tail -20 dev.log` |
| 7 | `Bash(until *)` | 27 | `until grep -qE "Ready in\|✓ Ready\|started server\|error" "C:\Users\shoji\AppData\L` |
| 8 | `Bash(npx *)` | 25 | `npx vitest run src/app/bloom/kpi/_lib/__tests__/forest-fetcher.test.ts 2>&1 \| ta` |
| 9 | `Bash(init *)` | 25 | `rtk init --help 2>&1 \| head -30` |
| 10 | `Bash(--version *)` | 23 | `rtk --version 2>&1 && echo "---gain---" && rtk gain 2>&1 \| head -20 && echo "---` |
| 11 | `Bash(netstat *)` | 17 | `netstat -ano 2>&1 \| grep -i ":300" \| grep -i LISTENING \| head -5
echo "---"
curl` |
| 12 | `Bash(git -C *)` | 17 | `git -C /c/garden/a-leaf branch -v 2>&1 \| head -30` |
| 13 | `Bash(mv *)` | 15 | `mv /c/garden/_temp-leaf-002/dispatch-counter.txt /c/garden/a-leaf-002/docs/dispa` |
| 14 | `Bash(sed *)` | 13 | `sed -n '80,189p' scripts/root-auth-schema.sql` |
| 15 | `Bash(git ls-tree *)` | 13 | `git ls-tree -r feature/garden-common-ui-and-shoji-status --name-only 2>&1 \| grep` |
| 16 | `Bash(CHAT_WS="G:/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/_chat_workspace"; *)` | 11 | `CHAT_WS="G:/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/_chat_workspace"; ls -la "$CHAT_` |
| 17 | `Bash(: *)` | 8 | `: > dev.log && npm run dev > dev.log 2>&1 &
echo "dev server PID: $!"` |
| 18 | `Bash(V29="G:/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/015_Gardenシリーズ/000_GardenUI_bloom/06_CEOStatus/chat-ui-bloom-dev-progress-v3-preview-20260505-v29.html"; *)` | 8 | `V29="G:/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/015_Gardenシリーズ/000_GardenUI_bloom/06` |
| 19 | `Bash(gain *)` | 7 | `rtk gain --history 2>&1 \| head -20` |
| 20 | `Bash(rm *)` | 7 | `rm src/lib/shiwakechou/__tests__/debug-encoding.test.ts && git status --short` |
| 21 | `Bash(test *)` | 6 | `test -f .env.local && echo "env.local: yes" \|\| echo "env.local: no"; ls supabase` |
| 22 | `Bash(cmd.exe *)` | 6 | `cmd.exe //c 'schtasks /query /tn "日報Queue処理" 2>&1' \| head -5` |
| 23 | `Bash(git reset *)` | 5 | `git reset --soft HEAD~1` |
| 24 | `Bash(gh repo *)` | 4 | `gh repo view --json defaultBranchRef,nameWithOwner,parent 2>&1 \| head -20 && ech` |
| 25 | `Bash(npm install *)` | 4 | `npm install 2>&1 \| tail -20` |
| 26 | `Bash(SRC="/g/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/015_Gardenシリーズ/000_GardenUI_bloom/06_CEOStatus"; *)` | 4 | `SRC="/g/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/015_Gardenシリーズ/000_GardenUI_bloom/06` |
| 27 | `Bash(SRC="/g/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/015_Gardenシリーズ/000_GardenUI_bloom/06_CEOStatus" *)` | 4 | `SRC="/g/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/015_Gardenシリーズ/000_GardenUI_bloom/06` |
| 28 | `Bash(git stash push *)` | 4 | `git stash push -u -m "forestgate-login-unification-wip-20260428" -- src/app/fore` |
| 29 | `Bash(BASE="G:/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/006_日報自動配信"; *)` | 4 | `BASE="G:/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/006_日報自動配信"; echo "=== state.txt 行数` |
| 30 | `Bash(schtasks *)` | 3 | `schtasks /Query /TN "日報Queue処理" /FO LIST 2>&1 \| head -10` |
