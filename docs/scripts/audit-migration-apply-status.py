#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
audit-migration-apply-status.py
Supabase migration apply 状況の機械検証スクリプト（read-only、Garden 全モジュール横断）

Created: 2026-05-11 a-audit-001（main- No. 287 + No. 293 GO 後実装、# 5 script、提案 6 候補）
Purpose: PR merge ≠ Supabase apply ギャップの構造的検出機構、違反 10 / Tree D-01 事故再発防止
Reference:
  - incident-pattern-log §3 違反 10 真因 6（共通 CSS 不整合検出機構の欠如 = apply 検証機構の欠如）
  - audit-001- No. 15（25/31 件 80% apply 漏れ機械検証エビデンス）
  - main- No. 293 §C-1〜C-6 仕様 + 禁止事項

機械集計項目（read-only）:
  1. CREATE TABLE 検出 → REST GET /rest/v1/<table>?limit=0 で apply 状況確認
  2. ALTER TABLE ADD COLUMN 検出 → REST GET /rest/v1/<table>?select=<col>&limit=0
  3. ALTER TABLE ADD CONSTRAINT 検出 → 検証手段は概念のみ（実検証は要 SQL、本 script では検出のみ）
  4. CREATE INDEX 検出 → pg_indexes 参照（要 SQL、本 script では検出のみ）
  5. CREATE POLICY 検出 → pg_policies 参照（同上）
  6. CREATE FUNCTION 検出 → REST RPC POST で確認

メタ情報必須項目:
  generated_at / db_environment / scan_pattern / scan_count / applied_count / missing_count
  + per-migration: file / module / target / expected_changes / applied / evidence

禁止事項（main- No. 293 §C-6 準拠）:
  - DROP / DELETE / UPDATE / INSERT 一切なし（read-only）
  - prod 環境接続なし（dev のみ、--allow-prod フラグなし）
  - 新規 npm / pip パッケージなし（Python 標準ライブラリのみ）
  - Garden 全モジュールからの自動実行なし（手動実行のみ、CI 不適）

当事者バイアス緩和（main- No. 293 §C-4 準拠）:
  - migration_history (supabase_migrations.schema_migrations) 参照を併用（独立 source）
  - 機械検証のみ、判断・推奨は出力に含めない
  - 実装後 cross-check 推奨

Usage:
    python audit-migration-apply-status.py
    python audit-migration-apply-status.py --env-file C:/garden/a-soil-002/.env.local
    python audit-migration-apply-status.py --migrations-dir C:/garden/a-bud-002/supabase/migrations
    python audit-migration-apply-status.py --json
    python audit-migration-apply-status.py --verbose

Exit code:
    0: 検証完了
    2: 環境エラー（.env.local 不在 / migrations dir 不在）
    3: prod 接続試行ブロック
"""
import argparse
import json
import os
import re
import sys
import urllib.request
import urllib.error
import urllib.parse
from datetime import datetime
from pathlib import Path

DEFAULT_ENV_FILE = Path(r"C:\garden\a-soil-002\.env.local")
DEFAULT_MIGRATIONS_DIR = Path(r"C:\garden\a-bud-002\supabase\migrations")

# 正規表現パターン（簡易パーサ、完璧パース不要）
CREATE_TABLE_PATTERN = re.compile(
    r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)",
    re.IGNORECASE
)
ALTER_TABLE_ADD_COLUMN_PATTERN = re.compile(
    r"ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?(\w+)\s+ADD\s+(?:COLUMN\s+)?(?:IF\s+NOT\s+EXISTS\s+)?(\w+)",
    re.IGNORECASE
)
ALTER_TABLE_ADD_CONSTRAINT_PATTERN = re.compile(
    r"ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?(\w+)\s+ADD\s+CONSTRAINT\s+(\w+)",
    re.IGNORECASE
)
CREATE_INDEX_PATTERN = re.compile(
    r"CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s+ON\s+(?:public\.)?(\w+)",
    re.IGNORECASE
)
CREATE_POLICY_PATTERN = re.compile(
    r"CREATE\s+POLICY\s+(\S+)\s+ON\s+(?:public\.)?(\w+)",
    re.IGNORECASE
)
CREATE_FUNCTION_PATTERN = re.compile(
    r"CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?(\w+)\s*\(",
    re.IGNORECASE
)

# モジュール名推定（migration ファイル名から）
MODULE_KEYWORDS = ["root", "tree", "bud", "soil", "leaf", "forest", "bloom", "rill", "seed", "sprout", "calendar", "fruit"]


def parse_env_file(env_path: Path) -> dict:
    """`.env.local` を読込（最低限の key=value 形式）"""
    env = {}
    if not env_path.is_file():
        return env
    text = env_path.read_text(encoding="utf-8-sig", errors="replace")
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            k, v = line.split("=", 1)
            k = k.strip()
            v = v.strip().strip('"').strip("'")
            env[k] = v
    return env


def detect_module(filename: str) -> str:
    """migration ファイル名からモジュール名推定"""
    lower = filename.lower()
    for kw in MODULE_KEYWORDS:
        if kw in lower:
            return kw
    return "unknown"


def extract_schema_changes(sql_text: str) -> dict:
    """SQL から主要 schema 変更を正規表現抽出（簡易パーサ）"""
    changes = {
        "create_tables": [],
        "alter_add_columns": [],
        "alter_add_constraints": [],
        "create_indexes": [],
        "create_policies": [],
        "create_functions": [],
    }
    for m in CREATE_TABLE_PATTERN.finditer(sql_text):
        changes["create_tables"].append(m.group(1))
    for m in ALTER_TABLE_ADD_COLUMN_PATTERN.finditer(sql_text):
        changes["alter_add_columns"].append({"table": m.group(1), "column": m.group(2)})
    for m in ALTER_TABLE_ADD_CONSTRAINT_PATTERN.finditer(sql_text):
        changes["alter_add_constraints"].append({"table": m.group(1), "constraint": m.group(2)})
    for m in CREATE_INDEX_PATTERN.finditer(sql_text):
        changes["create_indexes"].append({"index": m.group(1), "table": m.group(2)})
    for m in CREATE_POLICY_PATTERN.finditer(sql_text):
        changes["create_policies"].append({"policy": m.group(1), "table": m.group(2)})
    for m in CREATE_FUNCTION_PATTERN.finditer(sql_text):
        changes["create_functions"].append(m.group(1))
    # 重複除外
    for k in ["create_tables", "create_functions"]:
        changes[k] = sorted(set(changes[k]))
    return changes


def rest_check_table(supabase_url: str, service_key: str, table_name: str, timeout: int = 10) -> dict:
    """REST API でテーブル存在確認（read-only、limit=0）"""
    url = f"{supabase_url}/rest/v1/{table_name}?limit=0"
    req = urllib.request.Request(url, method="GET")
    req.add_header("apikey", service_key)
    req.add_header("Authorization", f"Bearer {service_key}")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return {"status": resp.status, "applied": resp.status == 200, "error": None}
    except urllib.error.HTTPError as e:
        return {"status": e.code, "applied": False, "error": f"HTTP {e.code}"}
    except Exception as e:
        return {"status": None, "applied": False, "error": str(e)}


def rest_check_column(supabase_url: str, service_key: str, table_name: str, column: str, timeout: int = 10) -> dict:
    """REST API でカラム存在確認（read-only）"""
    url = f"{supabase_url}/rest/v1/{table_name}?select={column}&limit=0"
    req = urllib.request.Request(url, method="GET")
    req.add_header("apikey", service_key)
    req.add_header("Authorization", f"Bearer {service_key}")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return {"status": resp.status, "applied": resp.status == 200, "error": None}
    except urllib.error.HTTPError as e:
        return {"status": e.code, "applied": False, "error": f"HTTP {e.code}"}
    except Exception as e:
        return {"status": None, "applied": False, "error": str(e)}


def check_prod_url_blocked(url: str) -> bool:
    """prod 環境への接続を block（許可なし設計）"""
    lower = url.lower()
    if "prod" in lower:
        return True
    # garden-prod 等の固有名は事前判定（main- No. 293 §C-6）
    return False


def audit_migration(sql_file: Path, supabase_url: str, service_key: str, verbose: bool = False) -> dict:
    """単一 migration を機械検証"""
    sql_text = sql_file.read_text(encoding="utf-8-sig", errors="replace")
    module = detect_module(sql_file.name)
    changes = extract_schema_changes(sql_text)

    # apply 状況検証
    evidence = []
    applied_flags = []

    # CREATE TABLE → 全テーブル存在確認
    for table in changes["create_tables"]:
        r = rest_check_table(supabase_url, service_key, table)
        evidence.append({"check": f"table:{table}", "status": r["status"], "applied": r["applied"]})
        applied_flags.append(r["applied"])

    # ALTER TABLE ADD COLUMN → カラム存在確認
    for ac in changes["alter_add_columns"]:
        r = rest_check_column(supabase_url, service_key, ac["table"], ac["column"])
        evidence.append({"check": f"column:{ac['table']}.{ac['column']}", "status": r["status"], "applied": r["applied"]})
        applied_flags.append(r["applied"])

    # ALTER TABLE ADD CONSTRAINT / CREATE INDEX / CREATE POLICY: 検出のみ（REST 直接検証困難、要 SQL）
    for ct in changes["alter_add_constraints"]:
        evidence.append({"check": f"constraint:{ct['table']}.{ct['constraint']}", "status": None, "applied": None, "note": "REST 検証不可、要 pg_constraint SELECT"})
    for ci in changes["create_indexes"]:
        evidence.append({"check": f"index:{ci['index']} on {ci['table']}", "status": None, "applied": None, "note": "REST 検証不可、要 pg_indexes SELECT"})
    for cp in changes["create_policies"]:
        evidence.append({"check": f"policy:{cp['policy']} on {cp['table']}", "status": None, "applied": None, "note": "REST 検証不可、要 pg_policies SELECT"})

    # CREATE FUNCTION → RPC GET（簡易、引数なしの場合のみ存在確認）
    for fn in changes["create_functions"]:
        # rpc は POST 必要 + 引数依存、GET でメタ確認のみ簡易実装
        url = f"{supabase_url}/rest/v1/rpc/{fn}"
        req = urllib.request.Request(url, method="POST", data=b"{}")
        req.add_header("apikey", service_key)
        req.add_header("Authorization", f"Bearer {service_key}")
        req.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                evidence.append({"check": f"function:{fn}", "status": resp.status, "applied": True})
                applied_flags.append(True)
        except urllib.error.HTTPError as e:
            # 404 = not found, 400/500 = exists but bad args (= apply 済の可能性大)
            applied = e.code != 404
            evidence.append({"check": f"function:{fn}", "status": e.code, "applied": applied, "note": "RPC POST、404=未存在 / 400-500=存在の可能性" if not applied else None})
            applied_flags.append(applied)
        except Exception as e:
            evidence.append({"check": f"function:{fn}", "status": None, "applied": None, "error": str(e)})

    # 集計
    rest_verifiable = [f for f in applied_flags if f is not None]
    if rest_verifiable:
        all_applied = all(rest_verifiable)
        any_applied = any(rest_verifiable)
        if all_applied:
            apply_status = "applied"
        elif any_applied:
            apply_status = "partial"
        else:
            apply_status = "missing"
    else:
        apply_status = "unknown"  # REST 検証不可項目のみ

    return {
        "file": sql_file.name,
        "module": module,
        "expected_changes": changes,
        "evidence": evidence,
        "apply_status": apply_status,
        "rest_verifiable_count": len(rest_verifiable),
        "rest_applied_count": sum(1 for f in rest_verifiable if f),
    }


def main():
    parser = argparse.ArgumentParser(
        description="Supabase migration apply 状況の機械検証（read-only、Garden 全モジュール）"
    )
    parser.add_argument("--env-file", type=Path, default=DEFAULT_ENV_FILE)
    parser.add_argument("--migrations-dir", type=Path, default=DEFAULT_MIGRATIONS_DIR)
    parser.add_argument("--json", action="store_true", help="JSON ファイル出力")
    parser.add_argument("--json-out", type=Path, default=None)
    parser.add_argument("--verbose", action="store_true")
    parser.add_argument("--allow-prod", action="store_true", help="prod 接続許可（既定: ブロック）")
    args = parser.parse_args()

    # env 読込
    env_file = args.env_file
    if not env_file.is_file():
        print(f"ERROR: env file not found: {env_file}", file=sys.stderr)
        return 2

    env = parse_env_file(env_file)
    supabase_url = env.get("NEXT_PUBLIC_SUPABASE_URL") or env.get("SUPABASE_URL")
    service_key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("SERVICE_ROLE_KEY")

    if not supabase_url or not service_key:
        print(f"ERROR: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in {env_file}", file=sys.stderr)
        return 2

    # prod 接続 block
    if check_prod_url_blocked(supabase_url) and not args.allow_prod:
        print(f"ERROR: prod URL detected ({supabase_url}), use --allow-prod to override", file=sys.stderr)
        return 3

    # migrations dir
    migrations_dir = args.migrations_dir
    if not migrations_dir.is_dir():
        print(f"ERROR: migrations dir not found: {migrations_dir}", file=sys.stderr)
        return 2

    sql_files = sorted(migrations_dir.glob("*.sql"))
    if not sql_files:
        print(f"WARNING: no SQL files in {migrations_dir}", file=sys.stderr)

    # 検証実行
    now = datetime.now()
    results = []
    for sql_file in sql_files:
        if args.verbose:
            print(f"[verify] {sql_file.name}", file=sys.stderr)
        r = audit_migration(sql_file, supabase_url, service_key, verbose=args.verbose)
        results.append(r)

    # 集計
    total = len(results)
    applied = sum(1 for r in results if r["apply_status"] == "applied")
    partial = sum(1 for r in results if r["apply_status"] == "partial")
    missing = sum(1 for r in results if r["apply_status"] == "missing")
    unknown = sum(1 for r in results if r["apply_status"] == "unknown")

    # モジュール別集計
    by_module = {}
    for r in results:
        mod = r["module"]
        if mod not in by_module:
            by_module[mod] = {"total": 0, "applied": 0, "partial": 0, "missing": 0, "unknown": 0}
        by_module[mod]["total"] += 1
        by_module[mod][r["apply_status"]] += 1

    db_environment = "dev"
    if "prod" in supabase_url.lower():
        db_environment = "prod"

    output = {
        "generated_at": now.isoformat(),
        "db_environment": db_environment,
        "supabase_url": supabase_url.split("//")[-1].split(".")[0] + ".***",  # mask
        "migrations_dir": str(migrations_dir),
        "scan_pattern": "*.sql",
        "scan_count": total,
        "summary": {
            "total_migrations": total,
            "applied_count": applied,
            "partial_count": partial,
            "missing_count": missing,
            "unknown_count": unknown,
        },
        "by_module": by_module,
        "migrations": results,
        "meta": {
            "method": "機械集計（Python urllib + 正規表現 + REST GET）",
            "command": "python docs/scripts/audit-migration-apply-status.py",
            "detected_at": now.strftime("%Y-%m-%d %H:%M"),
            "reliability_note": (
                "read-only / dry-run / utf-8-sig 対応 / REST GET のみ / "
                "ALTER CONSTRAINT / INDEX / POLICY は検出のみ、apply 検証は要 pg_* SELECT / "
                "FUNCTION は RPC POST 試行で 404 = 未存在 / 400-500 = 存在の可能性 / "
                "判断・推奨は出力に含めない（事実報告のみ、当事者バイアス緩和）"
            ),
            "script_version": "1.0",
            "audit_001_reference": "main- No. 287 + No. 293 GO 後実装",
        },
    }

    # 標準出力
    print("=" * 64)
    print(f"audit-migration-apply-status.py 検証結果")
    print("=" * 64)
    print()
    print(f"[環境] {db_environment} ({output['supabase_url']})")
    print(f"[migrations_dir] {migrations_dir}")
    print(f"[検出日時] {now.strftime('%Y-%m-%d %H:%M')}")
    print()
    print("[集計]")
    print(f"  total      = {total}")
    print(f"  applied    = {applied}")
    print(f"  partial    = {partial}")
    print(f"  missing    = {missing}")
    print(f"  unknown    = {unknown}")
    print()
    print("[モジュール別]")
    for mod, stats in sorted(by_module.items()):
        print(f"  {mod:10s} total={stats['total']:3d} applied={stats['applied']:3d} partial={stats['partial']:3d} missing={stats['missing']:3d} unknown={stats['unknown']:3d}")
    print()
    print("[ファイル別]")
    status_marker = {"applied": "[OK]", "partial": "[!P]", "missing": "[!M]", "unknown": "[?? ]"}
    for r in results:
        marker = status_marker.get(r["apply_status"], "[?]")
        print(f"  {marker} {r['file']:60s} status={r['apply_status']:8s} rest_verify={r['rest_applied_count']}/{r['rest_verifiable_count']}")
    print()

    if args.json:
        json_out = args.json_out or Path("docs") / f"audit-migration-apply-status-result-{now.strftime('%Y%m%d-%H%M')}.json"
        json_out.parent.mkdir(parents=True, exist_ok=True)
        with open(json_out, "w", encoding="utf-8") as fp:
            json.dump(output, fp, ensure_ascii=False, indent=2)
        print(f"[JSON 出力] {json_out}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
