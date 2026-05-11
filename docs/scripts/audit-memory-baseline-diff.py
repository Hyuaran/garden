#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
audit-memory-baseline-diff.py
baseline JSON との差分検出スクリプト（引越し時の差分 Read 起点）

Created: 2026-05-11 a-audit-001（main- No. 213 GO 後実装、# 2 script）
Purpose: 引越し時のキャッシュ差分 Read 高速化、設計書 §3-3 整合
Reference: incident-pattern-log §3 違反 8 対策（機械集計標準化）の延長

機械集計項目（5 件）:
  1. 追加 memory（baseline 未掲載 + 現在 active）
  2. 削除 memory（baseline 掲載 + 現在 active になし）
  3. 改訂 memory（mtime 差分 + frontmatter description 差分）
  4. 全件カウント比較（baseline NN vs 現在 NN）
  5. change-log 提案（差分各件について「追加 / 改訂 / 削除」+ filename + 要因推測）

メタ情報必須項目:
  集計方法 / サンプル数 / 実行コマンド / baseline 参照 / 検出日時 / 信頼性メモ
  baseline_created_at / baseline_file_mtime / active_count / baseline_count / script_version

Usage:
    python audit-memory-baseline-diff.py
    python audit-memory-baseline-diff.py --json
    python audit-memory-baseline-diff.py --baseline <path> --memory-dir <path>

Exit code:
    0: 検証完了（差分の有無に関わらず）
    2: 環境エラー（baseline / memory_dir 不在）
"""
import argparse
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path

DEFAULT_BASELINE = Path(r"C:\garden\a-audit-001\docs\memory_baseline_91-20260510.json")
DEFAULT_MEMORY_DIR = Path(r"C:\Users\shoji\.claude\projects\C--garden-a-main\memory")
INDEX_FILE = "MEMORY.md"
FRONTMATTER_DESC_PATTERN = re.compile(r"^description:\s*(.+?)\s*$", re.MULTILINE)


def read_text(path: Path) -> str:
    """utf-8-sig で読み込み（BOM 有無両対応）"""
    return path.read_text(encoding="utf-8-sig")


def load_baseline(baseline_path: Path):
    """baseline JSON Read"""
    with open(baseline_path, "r", encoding="utf-8-sig") as fp:
        data = json.load(fp)
    return data


def extract_frontmatter_description(memory_file: Path) -> str:
    """memory ファイル冒頭の frontmatter description を抽出"""
    try:
        text = read_text(memory_file)
    except (OSError, UnicodeDecodeError):
        return ""
    # frontmatter ブロック (--- で囲まれた最初のブロック) を取得
    if not text.startswith("---"):
        return ""
    end = text.find("\n---", 3)
    if end == -1:
        return ""
    frontmatter = text[:end]
    m = FRONTMATTER_DESC_PATTERN.search(frontmatter)
    return m.group(1).strip() if m else ""


def list_active_memory(memory_dir: Path):
    """active memory ファイル名一覧（_archive / MEMORY.md 除外）"""
    files = []
    for path in memory_dir.glob("*.md"):
        if path.name == INDEX_FILE:
            continue
        files.append(path.name)
    return sorted(files)


def main():
    parser = argparse.ArgumentParser(
        description="baseline JSON との差分検出（引越し時の差分 Read 起点）"
    )
    parser.add_argument("--baseline", type=Path, default=DEFAULT_BASELINE)
    parser.add_argument("--memory-dir", type=Path, default=DEFAULT_MEMORY_DIR)
    parser.add_argument("--json", action="store_true", help="JSON ファイル出力")
    parser.add_argument("--json-out", type=Path, default=None)
    args = parser.parse_args()

    baseline_path = args.baseline
    memory_dir = args.memory_dir

    if not baseline_path.is_file():
        print(f"ERROR: baseline not found: {baseline_path}", file=sys.stderr)
        return 2
    if not memory_dir.is_dir():
        print(f"ERROR: memory_dir not found: {memory_dir}", file=sys.stderr)
        return 2

    # baseline load
    baseline_data = load_baseline(baseline_path)
    baseline_by_filename = {e["filename"]: e for e in baseline_data}
    baseline_count = len(baseline_data)
    baseline_filenames = set(baseline_by_filename.keys())

    # baseline file mtime
    baseline_mtime_ts = os.path.getmtime(baseline_path)
    baseline_mtime = datetime.fromtimestamp(baseline_mtime_ts).strftime("%Y-%m-%d %H:%M:%S")

    # active memory
    active_files = list_active_memory(memory_dir)
    active_filenames = set(active_files)
    active_count = len(active_files)

    # 差分検出
    added = sorted(active_filenames - baseline_filenames)
    deleted = sorted(baseline_filenames - active_filenames)
    common = sorted(active_filenames & baseline_filenames)

    # 改訂検出（mtime + description）
    revised_mtime = []
    revised_desc = []
    description_unchanged = 0
    for filename in common:
        path = memory_dir / filename
        if not path.is_file():
            continue
        file_mtime_ts = os.path.getmtime(path)
        # mtime 差分（baseline 作成時刻と file mtime 比較）
        if file_mtime_ts > baseline_mtime_ts:
            revised_mtime.append({
                "filename": filename,
                "file_mtime": datetime.fromtimestamp(file_mtime_ts).strftime("%Y-%m-%d %H:%M:%S"),
                "baseline_mtime": baseline_mtime,
            })
        # description 差分
        current_desc = extract_frontmatter_description(path)
        baseline_desc = baseline_by_filename[filename].get("description", "")
        if current_desc and current_desc != baseline_desc:
            revised_desc.append({
                "filename": filename,
                "baseline_description": baseline_desc[:120] + ("..." if len(baseline_desc) > 120 else ""),
                "current_description": current_desc[:120] + ("..." if len(current_desc) > 120 else ""),
            })
        else:
            description_unchanged += 1

    # change-log 提案
    change_log = []
    for f in added:
        change_log.append({"action": "added", "filename": f, "reason": "baseline 未掲載 + 現在 active"})
    for f in deleted:
        change_log.append({"action": "deleted", "filename": f, "reason": "baseline 掲載 + 現在 active になし"})
    for entry in revised_mtime:
        change_log.append({"action": "revised(mtime)", "filename": entry["filename"], "reason": f"file_mtime {entry['file_mtime']} > baseline_mtime {entry['baseline_mtime']}"})
    for entry in revised_desc:
        change_log.append({"action": "revised(description)", "filename": entry["filename"], "reason": "frontmatter description 差分検出"})

    now = datetime.now()

    diff_exists = bool(added or deleted or revised_mtime or revised_desc)

    result = {
        "meta": {
            "method": "機械集計（Python pathlib + json + 正規表現 frontmatter description 抽出）",
            "sample_size_active": f"全件 {active_count} / {active_count}",
            "sample_size_baseline": f"全件 {baseline_count} / {baseline_count}",
            "command": "python docs/scripts/audit-memory-baseline-diff.py",
            "baseline_path": str(baseline_path),
            "baseline_file_mtime": baseline_mtime,
            "memory_dir": str(memory_dir),
            "detected_at": now.strftime("%Y-%m-%d %H:%M"),
            "reliability_note": (
                "utf-8-sig 対応 / pathlib / _archive サブフォルダ除外 / "
                "frontmatter description は --- ブロックから正規表現 ^description:\\s*(.+?)$ で抽出 / "
                "mtime 比較は file ctime/atime ではなく getmtime / "
                "description 差分は厳密 string compare（normalize 不要）"
            ),
            "script_version": "1.0",
            "incident_pattern_log_reference": "§3 違反 8 対策延長、設計書 §3-3 キャッシュ差分 Read 起点",
        },
        "summary": {
            "added_count": len(added),
            "deleted_count": len(deleted),
            "revised_mtime_count": len(revised_mtime),
            "revised_description_count": len(revised_desc),
            "description_unchanged_count": description_unchanged,
            "baseline_total": baseline_count,
            "active_total": active_count,
            "diff_exists": diff_exists,
        },
        "details": {
            "added": added,
            "deleted": deleted,
            "revised_mtime": revised_mtime,
            "revised_description": revised_desc,
        },
        "change_log_proposal": change_log,
    }

    # 標準出力
    print("=" * 64)
    print("audit-memory-baseline-diff.py 検証結果")
    print("=" * 64)
    print()
    print("[メタ情報]")
    for k, v in result["meta"].items():
        print(f"  {k}: {v}")
    print()
    print("[機械集計サマリ]")
    s = result["summary"]
    print(f"  追加 memory                  = {s['added_count']}")
    print(f"  削除 memory                  = {s['deleted_count']}")
    print(f"  改訂 memory (mtime)          = {s['revised_mtime_count']}")
    print(f"  改訂 memory (description)    = {s['revised_description_count']}")
    print(f"  description 維持             = {s['description_unchanged_count']}")
    print(f"  baseline 件数                = {s['baseline_total']}")
    print(f"  active 件数                  = {s['active_total']}")
    print(f"  差分存在                     = {'YES' if s['diff_exists'] else 'NO（完全一致）'}")
    print()
    print("[詳細]")
    if added:
        print(f"  追加 ({len(added)} 件):")
        for f in added:
            print(f"    + {f}")
    else:
        print("  追加: なし")
    if deleted:
        print(f"  削除 ({len(deleted)} 件):")
        for f in deleted:
            print(f"    - {f}")
    else:
        print("  削除: なし")
    if revised_mtime:
        print(f"  改訂 (mtime, {len(revised_mtime)} 件):")
        for entry in revised_mtime:
            print(f"    ~ {entry['filename']} (file: {entry['file_mtime']}, baseline: {entry['baseline_mtime']})")
    else:
        print("  改訂 (mtime): なし")
    if revised_desc:
        print(f"  改訂 (description, {len(revised_desc)} 件):")
        for entry in revised_desc:
            print(f"    ~ {entry['filename']}")
            print(f"      baseline: {entry['baseline_description']}")
            print(f"      current:  {entry['current_description']}")
    else:
        print("  改訂 (description): なし")
    print()

    if args.json:
        json_out = args.json_out or Path("docs") / f"audit-memory-baseline-diff-result-{now.strftime('%Y%m%d-%H%M')}.json"
        json_out.parent.mkdir(parents=True, exist_ok=True)
        with open(json_out, "w", encoding="utf-8") as fp:
            json.dump(result, fp, ensure_ascii=False, indent=2)
        print(f"[JSON 出力] {json_out}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
