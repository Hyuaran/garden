#!/usr/bin/env python3
"""
共通マスタ Excel → bud_master_rules SQL INSERT 生成スクリプト

入力:
  G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\001_仕訳帳\1_共通マスタ_v12.xlsx

出力:
  supabase/migrations/20260507000003_bud_master_rules_seed.sql

Excel カラム:
  Col 1: 区分     → category
  Col 2: 借方科目  → debit_account
  Col 3: 貸方科目  → credit_account
  Col 4: 税区分    → tax_class
  Col 5: 内容      → pattern (摘要マッチング)
  Col 6: 法人名    → 参考情報 (memo に格納)

実行方法:
  cd C:\garden\a-forest-002
  python scripts/generate-bud-master-rules-seed.py

依存:
  pip install openpyxl

注意:
  - パターンに含まれる全角空白 (　) は 半角空白に正規化
  - 同一 pattern が複数登録されている場合は最後の行のみ採用 (UNIQUE 制約)
  - pattern_kind = 'contains' (摘要に内容文字列が含まれていればマッチ)
  - direction = 'both' (借方/貸方 から自動判定する場合は要拡張)
"""
import os
import sys
import pathlib
import openpyxl

EXCEL_PATH = r"G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\001_仕訳帳\1_共通マスタ_v12.xlsx"
OUTPUT_PATH = pathlib.Path(__file__).parent.parent / "supabase" / "migrations" / "20260507000003_bud_master_rules_seed.sql"


def normalize_pattern(s: str) -> str:
    """全角空白 → 半角空白、前後 trim"""
    if s is None:
        return ""
    return str(s).replace("　", " ").strip()


def sql_escape(s: str) -> str:
    """シングルクォートを '' にエスケープ"""
    if s is None:
        return ""
    return str(s).replace("'", "''")


def main():
    if not os.path.exists(EXCEL_PATH):
        print(f"ERROR: Excel not found: {EXCEL_PATH}", file=sys.stderr)
        sys.exit(1)

    wb = openpyxl.load_workbook(EXCEL_PATH, read_only=True, data_only=True)
    ws = wb["Sheet1"]

    # 行ごとに dict 化
    rules_by_pattern = {}  # pattern → rule (重複除去用)
    skipped = 0
    total = 0

    for row_idx, row in enumerate(ws.iter_rows(values_only=True), start=1):
        if row_idx == 1:
            # ヘッダー行 skip
            continue
        total += 1

        category = normalize_pattern(row[0]) if len(row) > 0 else ""
        debit = normalize_pattern(row[1]) if len(row) > 1 else ""
        credit = normalize_pattern(row[2]) if len(row) > 2 else ""
        tax_class = normalize_pattern(row[3]) if len(row) > 3 else ""
        pattern = normalize_pattern(row[4]) if len(row) > 4 else ""
        corp_name = normalize_pattern(row[5]) if len(row) > 5 else ""

        # 必須項目チェック
        if not pattern:
            skipped += 1
            continue
        if not debit or not credit or not tax_class:
            skipped += 1
            continue

        rule = {
            "pattern": pattern,
            "pattern_kind": "contains",
            "direction": "both",
            "category": category,
            "debit_account": debit,
            "credit_account": credit,
            "tax_class": tax_class,
            "memo": corp_name if corp_name else "",
        }

        # 同一 pattern は後勝ち (UNIQUE 制約: pattern, pattern_kind, direction)
        rules_by_pattern[pattern] = rule

    # SQL 生成
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write("-- ============================================================\n")
        f.write("-- Garden Bud — 共通仕訳マスタ (bud_master_rules) 初期データ投入\n")
        f.write("-- ============================================================\n")
        f.write(f"-- 元データ: {EXCEL_PATH}\n")
        f.write(f"-- 行数: {len(rules_by_pattern)} 件 (Excel 全 {total} 行 / skip {skipped} 行)\n")
        f.write("-- 生成: scripts/generate-bud-master-rules-seed.py\n")
        f.write("-- 配置: 暫定 Forest, 5/17 以降に Bud に移行\n")
        f.write("--\n")
        f.write("-- 生成日時時に再生成して上書き可。冪等性は ON CONFLICT で確保。\n")
        f.write("-- ============================================================\n\n")

        for rule in rules_by_pattern.values():
            sql = (
                "insert into public.bud_master_rules "
                "(pattern, pattern_kind, direction, category, debit_account, credit_account, tax_class, memo) "
                "values ("
                f"'{sql_escape(rule['pattern'])}', "
                f"'{rule['pattern_kind']}', "
                f"'{rule['direction']}', "
                f"'{sql_escape(rule['category'])}', "
                f"'{sql_escape(rule['debit_account'])}', "
                f"'{sql_escape(rule['credit_account'])}', "
                f"'{sql_escape(rule['tax_class'])}', "
                f"'{sql_escape(rule['memo'])}'"
                ") on conflict (pattern, pattern_kind, direction) do nothing;\n"
            )
            f.write(sql)

    print(f"OK: {len(rules_by_pattern)} 件を {OUTPUT_PATH} に書き出しました (skip {skipped} 行)")


if __name__ == "__main__":
    main()
