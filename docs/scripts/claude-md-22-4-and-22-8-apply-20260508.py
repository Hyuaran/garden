"""
CLAUDE.md §22-4 修正 + §22-8 追加 一括反映スクリプト - 2026-05-08
- §22-4 引っ越し手順 を branch 別 vs 同 branch 判断ルール明確化版に置換
- §22-8 自律的 token 使用率チェック（bud-20 学び反映）を新規追加
- 43 箇所の CLAUDE.md（親 Garden + 各子 + ローカルセッション + 個人）一括更新
"""

import sys
import io
import re
import shutil
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# §22-4 修正版（branch 別 vs 同 branch 判断ルール明確化）
SECTION_22_4_NEW = """### 22-4. 引っ越し手順（Claude Code が実施、main / モジュール 同手順、v2 修正）

| Step | 作業 | 主体 |
|---|---|---|
| 1 | **新ブランチ派生 + 新 worktree フォルダ作成**（git の制約上、同一 branch を複数 worktree で checkout 不可、必ず新 branch 派生）| **Claude Code（自動）** |
| 2 | ハンドオフメモ起草（`docs/handoff-[旧→新]-YYYYMMDD.md`）| Claude Code |
| 3 | **メモリー重複チェック + クリーンアップ判断**（§23 参照、a-main のみ必須）| Claude Code（main のみ）|
| 4 | dispatch counter 最新化 + handoff 記載 | Claude Code |
| 5 | 待機中ジョブ一覧 + 判断保留事項一覧化 | Claude Code |
| 6 | 次セッションへの **引き継ぎコピペテキスト** 発行 | Claude Code |
| 7 | git commit + push | Claude Code |
| 8 | **東海林さんが新セッション起動**（Claude Code デスクトップアプリで新 worktree フォルダを開く）+ コピペテキスト 1 回投下 | 東海林さん |

#### Step 1 詳細: branch 派生パターン

| 旧 → 新 | 派生 branch 命名 | worktree 命名 |
|---|---|---|
| a-main-NNN → a-main-NNN+1 | `workspace/a-main-NNN+1` | `C:/garden/a-main-NNN+1` |
| モジュール → モジュール-002（同 module 系統内）| `feature/<元 branch 名>-002` 等 | `C:/garden/<module>-002` |
| 例: a-bud → a-bud-002 | `feature/bud-phase-d-implementation-002`（feature/bud-phase-d-implementation から派生）| `C:/garden/a-bud-002` |

#### git worktree コマンド例

```bash
# Claude Code が a-main 内 bash で実行（git -C で対象 repo 指定）
git -C /c/garden/<旧 worktree> worktree add /c/garden/<新 worktree> -b <新 branch> <ベース branch>

# 例: a-bud → a-bud-002
git -C /c/garden/a-bud worktree add /c/garden/a-bud-002 -b feature/bud-phase-d-implementation-002 feature/bud-phase-d-implementation
```

#### 重要: 「複数セッション運用ルール」厳守

handoff §「複数セッション運用ルール」記載通り、**必ずセッションごとに独立したディレクトリで作業**すること。同じディレクトリを複数セッションで使うと、ブランチが勝手に切り替わる問題が発生する。
"""

# §22-8 新規追加（自律的 token 使用率チェック、bud-20 学び反映）
SECTION_22_8_NEW = """
### 22-8. 自律的 token 使用率チェック（2026-05-08 追加、bud-20 学び反映）

各セッションは以下のタイミングで **自発的に** token 使用率を確認し、§22-1 の段階別アラートを実行する:

#### チェックタイミング

| タイミング | アクション |
|---|---|
| **タスク完了時**（commit / push / 区切り報告 後）| `/cost` or `/context` で使用率確認、50/60/70% 閾値で自発アラート |
| **dispatch 受領時**（東海林さんから投下を受けた直後）| 受領直後に確認、60% 超過なら **タスク着手前に引っ越し優先** |
| **長時間処理前**（重い build / test / scan 実行前）| 事前に確認、70% 超過なら引っ越し検討 |

#### 自発アラート例（chat 内 main セッション内 / モジュールセッション内）

```
⚠️ コンテキスト使用率 [N]% 到達（自発チェック）
推奨アクション: [引っ越し準備 / 引っ越し開始 / 引っ越し必須]
詳細: §22-1 段階別アラート 参照
```

#### 背景: bud-20 学び（2026-05-08）

a-bud（旧）が 80% 最終ライン到達 → 緊急引っ越しを実行。
反省点として a-bud から提案された 2 件の改善案:
1. 各タスク完了時に token 使用率自己チェック
2. dispatch 受領後すぐ token 残量チェック → 60% 超過なら引っ越し優先

→ 80% 到達前の段階的対応で handoff 品質維持、緊急引っ越しを回避。

#### Garden 全モジュール共通課題

dispatch 受領タイミング（東海林さん投下）と §20-23 broadcast 等のメッセージ受領が重なると、60%/70% アラート機会を逃す構造的リスクあり。
**自発チェックの徹底**で構造的リスクを軽減する。
"""


def update_claude_md(path: Path, dry_run: bool = False) -> dict:
    """CLAUDE.md の §22-4 を置換 + §22-8 を §22-7 後に追加"""
    if not path.exists():
        return {"path": str(path), "status": "not_found"}

    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception as e:
        return {"path": str(path), "status": "read_error", "error": str(e)}

    # §22-4 置換: 既存の "### 22-4. 引っ越し手順..." から次の "### 22-5." までを置換
    pattern_22_4 = re.compile(
        r'### 22-4\. 引っ越し手順.*?(?=### 22-5\.)',
        re.DOTALL
    )
    if not pattern_22_4.search(content):
        return {"path": str(path), "status": "no_22_4_section"}

    new_22_4 = SECTION_22_4_NEW + "\n\n"
    content = pattern_22_4.sub(new_22_4, content)

    # §22-8 追加: §22-7 の終わり（次の "## 23." or "---" 直前）に挿入
    # §22-7 の末尾を見つける
    pattern_after_22_7 = re.compile(
        r'(### 22-7\..*?)(?=\n## 23\.)',
        re.DOTALL
    )
    if pattern_after_22_7.search(content):
        # §22-8 が既に存在しないか確認
        if "### 22-8." not in content:
            content = pattern_after_22_7.sub(r'\1' + SECTION_22_8_NEW, content)
        else:
            return {"path": str(path), "status": "22_8_already_exists"}
    else:
        return {"path": str(path), "status": "no_22_7_section"}

    if dry_run:
        return {"path": str(path), "status": "dry_run"}

    # backup
    backup_path = path.with_suffix(".md.bak-22-4-22-8-20260508")
    try:
        shutil.copy2(path, backup_path)
    except Exception as e:
        return {"path": str(path), "status": "backup_error", "error": str(e)}

    try:
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
    except Exception as e:
        return {"path": str(path), "status": "write_error", "error": str(e)}

    return {"path": str(path), "status": "updated"}


def main():
    dry_run = "--dry-run" in sys.argv

    # 対象パス収集
    targets = []

    # 親 Garden CLAUDE.md
    parent = Path("G:/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/015_Gardenシリーズ/CLAUDE.md")
    if parent.exists():
        targets.append(parent)

    # Drive Garden 子 CLAUDE.md
    drive_garden_dir = Path("G:/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/015_Gardenシリーズ")
    for child in drive_garden_dir.glob("*/CLAUDE.md"):
        targets.append(child)

    # ローカル Garden 各セッション CLAUDE.md
    local_garden_dir = Path("C:/garden")
    for child in local_garden_dir.glob("*/CLAUDE.md"):
        if "_backup" in str(child):
            continue
        targets.append(child)

    # 重複除去
    targets = list(set(targets))
    targets.sort(key=lambda p: str(p))

    print(f"# §22-4 修正 + §22-8 追加 一括反映{'（dry-run）' if dry_run else ''}")
    print(f"対象: {len(targets)} 件\n")

    results = []
    for target in targets:
        result = update_claude_md(target, dry_run=dry_run)
        results.append(result)
        icon = "✅" if result["status"] in ("updated", "dry_run") else (
            "➖" if result["status"] in ("22_8_already_exists",) else "❌"
        )
        print(f"{icon} {result['path']}: {result['status']}")

    print(f"\n## サマリ")
    updated = sum(1 for r in results if r["status"] in ("updated", "dry_run"))
    skipped = sum(1 for r in results if r["status"] == "22_8_already_exists")
    no_section = sum(1 for r in results if r["status"] in ("no_22_4_section", "no_22_7_section"))
    errors = sum(1 for r in results if r["status"] in ("read_error", "write_error", "not_found", "backup_error"))

    print(f"- 更新: {updated}")
    print(f"- スキップ（22-8 既存）: {skipped}")
    print(f"- §22 セクション欠如: {no_section}")
    print(f"- エラー: {errors}")


if __name__ == "__main__":
    main()
