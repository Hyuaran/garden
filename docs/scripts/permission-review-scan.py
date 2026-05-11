"""
CLAUDE.md §14 許可リスト棚卸し scan script
- 直近 50 セッションの jsonl をスキャン
- Bash / MCP ツール呼び出しを集計
- 既存 allow / auto-allow にマッチしない頻出コマンド（3 回以上）を抽出
- 安全性判定で分類（昇格候補 / deny 強化候補 / 保留）
"""

import json
import os
import sys
import io
from pathlib import Path
from collections import Counter
from datetime import datetime

# Windows cp932 回避、stdout/stderr を UTF-8 に強制
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# 既存 allow リスト（C:/garden/a-main-014/.claude/settings.json から）
EXISTING_ALLOW_PATTERNS = [
    "cp", "date", "find", "gh api", "gh auth", "gh pr",
    "git add", "git branch", "git checkout", "git commit",
    "git fetch", "git merge", "git pull", "git push -u origin",
    "git push origin", "git worktree",
    "mkdir", "npm info", "npm list", "npm outdated",
    "npm run build", "npm run lint", "npm run test", "npm run typecheck",
    "npm view", "npx tsc", "powershell.exe", "python", "touch", "which",
]

# 既存 deny パターン（コマンド先頭マッチ）
EXISTING_DENY_PATTERNS = [
    "rm", "rmdir", "git reset --hard", "git push --force", "git push -f",
    "git clean -f", "git branch -D", "git push origin develop",
    "git push origin main", "git push -u origin develop", "git push -u origin main",
    "npm install", "npm uninstall", "npm update", "pip install",
    "Remove-Item", "del",
]

# 破壊的コマンド（deny 強化候補判定用）
DESTRUCTIVE_KEYWORDS = [
    "rm ", "rm:", "rmdir", "Remove-Item", "del ",
    "git reset --hard", "git push --force", "git push -f",
    "git clean -f", "git branch -D",
    "DROP TABLE", "DROP DATABASE", "TRUNCATE",
    "supabase db reset", "supabase stop --no-backup",
]

# 非破壊・読み取り系（昇格候補判定用）
SAFE_PREFIXES = [
    "ls", "cat", "head", "tail", "wc", "grep", "echo", "pwd",
    "git status", "git log", "git diff", "git show", "git config --get",
    "git remote", "git stash list", "git tag", "git branch -a",
    "git reflog", "git rev-parse", "git ls-remote", "git ls-files",
    "npm ls", "npm test --", "npm run dev", "npm run start",
    "node ", "deno ", "bun ",
    "supabase status", "supabase db dump",
    "vercel ls", "vercel inspect",
    "docker ps", "docker images",
    "ping", "nslookup", "whoami", "hostname", "id ",
    "test -f", "test -d", "stat ",
    "diff ", "cmp ",
    "tree ",
    "Get-Date", "Get-ChildItem", "Get-Content", "Get-Process",
    "Test-Path",
    "ssh-keygen -t",
    "tar -tf", "unzip -l",
]


def is_existing_allow(cmd: str) -> bool:
    """既存 allow パターンにマッチするか"""
    cmd_lower = cmd.lower()
    for pattern in EXISTING_ALLOW_PATTERNS:
        if cmd_lower.startswith(pattern.lower()):
            return True
    return False


def is_existing_deny(cmd: str) -> bool:
    """既存 deny パターンにマッチするか"""
    for pattern in EXISTING_DENY_PATTERNS:
        if pattern in cmd:
            return True
    return False


def classify_safety(cmd: str) -> str:
    """安全性判定: 'safe' / 'destructive' / 'uncertain'"""
    # 破壊的キーワード優先
    for keyword in DESTRUCTIVE_KEYWORDS:
        if keyword in cmd:
            return "destructive"
    # 安全プレフィックス
    for prefix in SAFE_PREFIXES:
        if cmd.startswith(prefix):
            return "safe"
    return "uncertain"


def normalize_command(cmd: str) -> str:
    """コマンドの先頭 2-3 語に正規化（パターン化）"""
    # 改行・複数空白を 1 つに
    cmd = " ".join(cmd.split())
    # rtk プレフィックス除去
    if cmd.startswith("rtk "):
        cmd = cmd[4:]
    # 先頭 2-3 語を抽出
    parts = cmd.split(" ", 3)
    if len(parts) <= 1:
        return parts[0]
    # 第 1 語が git/npm/gh/docker/supabase/vercel/python/node 等なら 2-3 語
    multi_word_cmds = {"git", "npm", "gh", "docker", "supabase", "vercel", "python", "node", "deno", "bun", "yarn", "pnpm"}
    if parts[0] in multi_word_cmds:
        if len(parts) >= 3 and parts[1] in {"run", "test", "config", "remote", "branch", "worktree", "stash", "log", "show"}:
            return " ".join(parts[:3])
        return " ".join(parts[:2])
    return parts[0]


def extract_bash_commands(jsonl_path: Path) -> list:
    """jsonl から Bash tool 呼び出しのコマンドを抽出"""
    commands = []
    try:
        with open(jsonl_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue
                # message.content[].name == 'Bash' を探す
                msg = obj.get("message", {})
                content = msg.get("content")
                if not isinstance(content, list):
                    continue
                for item in content:
                    if not isinstance(item, dict):
                        continue
                    if item.get("type") == "tool_use":
                        name = item.get("name", "")
                        if name == "Bash":
                            inp = item.get("input", {})
                            cmd = inp.get("command", "")
                            if cmd:
                                commands.append(cmd)
    except Exception as e:
        print(f"  warn: {jsonl_path}: {e}", file=sys.stderr)
    return commands


def main():
    # Windows native Python なので / なし、~/.claude/projects を直接探索
    home = Path.home()
    projects_dir = home / ".claude" / "projects"
    all_jsonl = list(projects_dir.rglob("*.jsonl"))
    # mtime 降順で 50 件
    all_jsonl.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    jsonl_files = [str(p) for p in all_jsonl[:50]]

    print(f"Scanning {len(jsonl_files)} jsonl files (top 50 by mtime)...", file=sys.stderr)

    counter = Counter()
    full_commands = {}  # normalized -> sample full command
    for path in jsonl_files:
        cmds = extract_bash_commands(Path(path))
        for cmd in cmds:
            normalized = normalize_command(cmd)
            counter[normalized] += 1
            if normalized not in full_commands:
                full_commands[normalized] = cmd[:100]

    # 集計結果
    print(f"\nTotal Bash commands collected: {sum(counter.values())}")
    print(f"Unique normalized commands: {len(counter)}")

    # 分類
    promotion = []   # 昇格候補（safe + 既存 allow 外 + 3 回以上）
    deny_strengthen = []  # deny 強化候補（destructive + 既存 deny 外 + 1 回以上）
    pending = []     # 保留（uncertain + 既存 allow 外 + 3 回以上）

    for cmd, count in counter.most_common():
        if is_existing_allow(cmd):
            continue
        safety = classify_safety(cmd)
        if safety == "destructive":
            if not is_existing_deny(cmd) and count >= 1:
                deny_strengthen.append((cmd, count, full_commands.get(cmd, "")))
        elif safety == "safe":
            if count >= 3:
                promotion.append((cmd, count, full_commands.get(cmd, "")))
        else:  # uncertain
            if count >= 3:
                pending.append((cmd, count, full_commands.get(cmd, "")))

    # 出力
    print("\n## 昇格候補（非破壊・3 回以上、既存 allow 外）")
    print(f"\n{len(promotion)} 件")
    print("\n| # | パターン | 回数 | サンプル |")
    print("|---|---|---|---|")
    for i, (cmd, count, sample) in enumerate(promotion[:30], 1):
        sample_short = sample[:80].replace("|", "\\|")
        print(f"| {i} | `Bash({cmd} *)` | {count} | `{sample_short}` |")

    print("\n## deny 強化候補（破壊系・既存 deny 外）")
    print(f"\n{len(deny_strengthen)} 件")
    print("\n| # | パターン | 回数 | サンプル |")
    print("|---|---|---|---|")
    for i, (cmd, count, sample) in enumerate(deny_strengthen[:30], 1):
        sample_short = sample[:80].replace("|", "\\|")
        print(f"| {i} | `Bash({cmd} *)` | {count} | `{sample_short}` |")

    print("\n## 保留（判断迷い・3 回以上）")
    print(f"\n{len(pending)} 件")
    print("\n| # | パターン | 回数 | サンプル |")
    print("|---|---|---|---|")
    for i, (cmd, count, sample) in enumerate(pending[:30], 1):
        sample_short = sample[:80].replace("|", "\\|")
        print(f"| {i} | `Bash({cmd} *)` | {count} | `{sample_short}` |")


if __name__ == "__main__":
    main()
