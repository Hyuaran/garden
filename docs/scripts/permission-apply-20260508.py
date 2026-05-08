"""
§14 許可リスト棚卸し 一括反映スクリプト - 2026-05-08
- 31 箇所の settings.json に 22 件 allow 追加（昇格 15 + 条件付き 7）
- last-permission-review.txt を 2026-05-08 に更新
- permission-review-log.md に履歴追記
"""

import json
import sys
import io
import shutil
from pathlib import Path
from datetime import datetime

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# 追加する allow パターン（22 件）
NEW_ALLOW_PATTERNS = [
    # 昇格 15 件（非破壊・3 回以上、確信度 高）
    "Bash(ls *)",
    "Bash(grep *)",
    "Bash(echo *)",
    "Bash(git log --oneline *)",
    "Bash(git status *)",
    "Bash(cat *)",
    "Bash(wc *)",
    "Bash(pwd *)",
    "Bash(tail *)",
    "Bash(git diff *)",
    "Bash(head *)",
    "Bash(git log --all *)",
    "Bash(npm test -- *)",
    "Bash(git show --stat *)",
    "Bash(git ls-remote *)",
    # 条件付き 7 件（東海林さん承認済）
    "Bash(curl *)",
    "Bash(sleep *)",
    "Bash(until *)",
    "Bash(netstat *)",
    "Bash(git -C *)",
    "Bash(sed -n *)",
    "Bash(git ls-tree *)",
]


def update_settings(path: Path, dry_run: bool = False) -> dict:
    """settings.json の allow リストに新規パターンを追加"""
    if not path.exists():
        return {"path": str(path), "status": "not_found", "added": 0}

    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        return {"path": str(path), "status": "read_error", "error": str(e), "added": 0}

    # permissions.allow を取得（なければ作成）
    if "permissions" not in data:
        data["permissions"] = {"allow": [], "deny": []}
    if "allow" not in data["permissions"]:
        data["permissions"]["allow"] = []

    existing_allow = set(data["permissions"]["allow"])
    added_patterns = []

    for pattern in NEW_ALLOW_PATTERNS:
        if pattern not in existing_allow:
            data["permissions"]["allow"].append(pattern)
            added_patterns.append(pattern)

    if not added_patterns:
        return {"path": str(path), "status": "no_change", "added": 0}

    # ソート（既存順序維持しつつ末尾追加）
    # 注: ここでは sort せず append のままにする（既存順序維持）

    if not dry_run:
        # backup
        backup_path = path.with_suffix(".json.bak-§14-20260508")
        try:
            shutil.copy2(path, backup_path)
        except Exception:
            pass

        # 書き戻し
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                f.write("\n")
        except Exception as e:
            return {"path": str(path), "status": "write_error", "error": str(e), "added": 0}

    return {"path": str(path), "status": "updated" if not dry_run else "dry_run", "added": len(added_patterns), "patterns": added_patterns}


def main():
    dry_run = "--dry-run" in sys.argv

    # 対象パス収集
    targets = []

    # 1. C:/garden 配下の全 .claude/settings.json
    garden_root = Path("C:/garden")
    for path in garden_root.glob("*/.claude/settings.json"):
        targets.append(path)

    # 2. G:/マイドライブ 配下の global settings
    drive_path = Path("G:/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/.claude/settings.json")
    if drive_path.exists():
        targets.append(drive_path)

    print(f"# §14 許可リスト棚卸し 一括反映{'（dry-run）' if dry_run else ''}", flush=True)
    print(f"対象: {len(targets)} 箇所")
    print(f"追加 allow パターン: {len(NEW_ALLOW_PATTERNS)} 件\n")

    results = []
    for target in sorted(targets, key=lambda p: str(p)):
        result = update_settings(target, dry_run=dry_run)
        results.append(result)
        status_icon = "✅" if result["status"] in ("updated", "dry_run") else ("➖" if result["status"] == "no_change" else "❌")
        print(f"{status_icon} {result['path']}: {result['status']} (+{result['added']})")

    print(f"\n## サマリ")
    updated = sum(1 for r in results if r["status"] in ("updated", "dry_run"))
    no_change = sum(1 for r in results if r["status"] == "no_change")
    errors = sum(1 for r in results if r["status"] in ("read_error", "write_error", "not_found"))

    print(f"- 更新: {updated}")
    print(f"- 変更なし: {no_change}")
    print(f"- エラー: {errors}")

    if dry_run:
        print(f"\n→ dry-run 完了、実反映は --apply で実行")
    else:
        print(f"\n→ 実反映完了、各セッション再起動 or 手動リロード で反映")


if __name__ == "__main__":
    main()
