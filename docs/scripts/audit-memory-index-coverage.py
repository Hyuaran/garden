#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
audit-memory-index-coverage.py
MEMORY.md 索引完全性検証スクリプト（機械集計標準化、検出値根拠メタ情報必須）

Created: 2026-05-10 a-audit-001（main- No. 210 GO 後実装）
Purpose: incident-pattern-log §3 違反 8 直接対策、feedback_verify_before_self_critique 準拠

機械集計項目（6 件）:
  1. 索引 entry 行数（grep -c '^- \\[' MEMORY.md と同等）
  2. 索引 unique filename 数（[name](file.md) の file.md を sort -u）
  3. 実 active memory 数（_archive / MEMORY.md 除外）
  4. 未収載差分（実 active で索引未収載）
  5. 死活リンク（索引内 link 先で実存しないファイル）
  6. 重複記載（索引内同一ファイル複数行）

メタ情報必須項目:
  集計方法 / サンプル数 / 実行コマンド / 検出日時 / 信頼性メモ

Usage:
    python audit-memory-index-coverage.py
    python audit-memory-index-coverage.py --json
    python audit-memory-index-coverage.py --memory-dir <path>

Exit code:
    0: 検証完了（OK / NG いずれも 0）
    2: 環境エラー（memory_dir / index_file 不在）
"""
import argparse
import json
import re
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path

DEFAULT_MEMORY_DIR = Path(r"C:\Users\shoji\.claude\projects\C--garden-a-main\memory")
INDEX_FILE = "MEMORY.md"
ARCHIVE_DIR = "_archive"
INDEX_PATTERN = re.compile(r"^- \[([^\]]+)\]\(([^)]+\.md)\)")


def read_text(path: Path) -> str:
    """utf-8-sig で読み込み（BOM 有無両対応）"""
    return path.read_text(encoding="utf-8-sig")


def parse_index(memory_md_text: str):
    """索引から (name, filename) のタプルリストを抽出"""
    entries = []
    for line in memory_md_text.splitlines():
        m = INDEX_PATTERN.match(line)
        if m:
            entries.append((m.group(1), m.group(2)))
    return entries


def list_active_memory(memory_dir: Path):
    """active memory ファイル名一覧（_archive サブフォルダ / MEMORY.md 除外）"""
    files = []
    for path in memory_dir.glob("*.md"):
        if path.name == INDEX_FILE:
            continue
        files.append(path.name)
    return sorted(files)


def main():
    parser = argparse.ArgumentParser(
        description="MEMORY.md 索引完全性検証（機械集計標準化）"
    )
    parser.add_argument(
        "--memory-dir", type=Path, default=DEFAULT_MEMORY_DIR,
        help=f"memory ディレクトリ（既定: {DEFAULT_MEMORY_DIR}）"
    )
    parser.add_argument(
        "--json", action="store_true",
        help="結果を JSON ファイルに出力（docs/audit-memory-index-coverage-result-YYYYMMDD-HHMM.json）"
    )
    parser.add_argument(
        "--json-out", type=Path, default=None,
        help="JSON 出力先（既定: docs/audit-memory-index-coverage-result-YYYYMMDD-HHMM.json）"
    )
    args = parser.parse_args()

    memory_dir = args.memory_dir
    if not memory_dir.is_dir():
        print(f"ERROR: memory_dir not found: {memory_dir}", file=sys.stderr)
        return 2

    index_path = memory_dir / INDEX_FILE
    if not index_path.is_file():
        print(f"ERROR: index file not found: {index_path}", file=sys.stderr)
        return 2

    # 索引解析
    index_text = read_text(index_path)
    entries = parse_index(index_text)
    entry_lines = len(entries)
    index_filenames = [f for _, f in entries]
    index_unique_files = sorted(set(index_filenames))
    index_unique_count = len(index_unique_files)

    # 実 active memory
    active_files = list_active_memory(memory_dir)
    active_count = len(active_files)

    # 差分検出
    not_indexed = sorted(set(active_files) - set(index_unique_files))
    dead_links = sorted(set(index_unique_files) - set(active_files))

    # 重複記載
    counter = Counter(index_filenames)
    duplicates = {f: c for f, c in counter.items() if c > 1}
    duplicate_excess = sum(c - 1 for c in duplicates.values())

    now = datetime.now()

    # 結論判定
    integrity_ok = (
        len(not_indexed) == 0
        and len(dead_links) == 0
    )

    result = {
        "meta": {
            "method": "機械集計（Python pathlib + 正規表現 INDEX_PATTERN）",
            "sample_size_active": f"全件 {active_count} / {active_count}",
            "sample_size_index": f"全件 {entry_lines} 行 / unique {index_unique_count}",
            "command": "python docs/scripts/audit-memory-index-coverage.py",
            "detected_at": now.strftime("%Y-%m-%d %H:%M"),
            "reliability_note": (
                "utf-8-sig 対応（BOM 有無両対応）/ Windows pathlib / "
                "_archive サブフォルダ除外 / MEMORY.md 自体は active 対象から除外 / "
                "正規表現 ^- \\[name\\]\\(file\\.md\\) の line head match"
            ),
            "memory_dir": str(memory_dir),
            "index_file": str(index_path),
            "script_version": "1.0",
            "incident_pattern_log_reference": "§3 違反 8（機械集計未使用検出値誤判定）対策",
        },
        "summary": {
            "index_entry_lines": entry_lines,
            "index_unique_filenames": index_unique_count,
            "active_memory_count": active_count,
            "not_indexed_count": len(not_indexed),
            "dead_links_count": len(dead_links),
            "duplicate_records_count": duplicate_excess,
            "integrity_ok": integrity_ok,
        },
        "details": {
            "not_indexed": not_indexed,
            "dead_links": dead_links,
            "duplicates": duplicates,
        },
    }

    # 標準出力
    print("=" * 64)
    print("audit-memory-index-coverage.py 検証結果")
    print("=" * 64)
    print()
    print("[メタ情報]")
    for k, v in result["meta"].items():
        print(f"  {k}: {v}")
    print()
    print("[機械集計サマリ]")
    print(f"  索引 entry 行数         = {result['summary']['index_entry_lines']}")
    print(f"  索引 unique filename 数 = {result['summary']['index_unique_filenames']}")
    print(f"  実 active memory 数     = {result['summary']['active_memory_count']}")
    print(f"  未収載差分              = {result['summary']['not_indexed_count']}")
    print(f"  死活リンク              = {result['summary']['dead_links_count']}")
    print(f"  重複記載超過数          = {result['summary']['duplicate_records_count']}")
    print(f"  索引完全性              = {'OK' if integrity_ok else 'NG'}")
    print()
    print("[詳細]")
    if not_indexed:
        print(f"  未収載ファイル ({len(not_indexed)} 件):")
        for f in not_indexed:
            print(f"    - {f}")
    else:
        print("  未収載ファイル: なし（索引完全性 OK）")
    print()
    if dead_links:
        print(f"  死活リンク ({len(dead_links)} 件):")
        for f in dead_links:
            print(f"    - {f}")
    else:
        print("  死活リンク: なし")
    print()
    if duplicates:
        print(f"  重複記載 ({len(duplicates)} 種類、超過数 {duplicate_excess}):")
        for f, c in sorted(duplicates.items(), key=lambda x: -x[1]):
            print(f"    - {f}: {c} 回")
    else:
        print("  重複記載: なし")
    print()

    # JSON 出力
    if args.json:
        if args.json_out:
            json_out = args.json_out
        else:
            json_out = Path("docs") / f"audit-memory-index-coverage-result-{now.strftime('%Y%m%d-%H%M')}.json"
        json_out.parent.mkdir(parents=True, exist_ok=True)
        with open(json_out, "w", encoding="utf-8") as fp:
            json.dump(result, fp, ensure_ascii=False, indent=2)
        print(f"[JSON 出力] {json_out}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
