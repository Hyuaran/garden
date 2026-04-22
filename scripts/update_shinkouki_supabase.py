"""
Garden-Forest 進行期データ自動更新スクリプト (Supabase版)

D_税理士連携データのPDFから売上・外注費・利益を抽出し、
Supabase の shinkouki テーブルを UPDATE する。

使い方:
  # Dry-run（実際には書き込まず、抽出結果だけ表示）
  python scripts/update_shinkouki_supabase.py --dry-run

  # 本番実行
  python scripts/update_shinkouki_supabase.py

前提:
  - .env.local に NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が設定済み
  - pip install -r scripts/requirements.txt 済み
"""

import argparse
import io
import os
import re
import sys
from pathlib import Path

import pdfplumber
import requests
from dotenv import load_dotenv

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

# ===== 設定 =====
PROJECT_ROOT = Path(__file__).parent.parent
ENV_PATH = PROJECT_ROOT / ".env.local"
PDF_DIR = Path(
    r"G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴"
    r"\001_仕訳帳\D_税理士連携データ"
)

# 法人名（PDF内テキスト） → Supabase companies.id
COMPANY_MAP = {
    "ヒュアラン": "hyuaran",
    "センターライズ": "centerrise",
    "リンクサポート": "linksupport",
    "ＡＲＡＴＡ": "arata",
    "ARATA": "arata",
    "たいよう": "taiyou",
    "壱": "ichi",
}


def is_financial_statement(pdf_path: Path) -> bool:
    """PDFが残高試算表 / 損益計算書 / 貸借対照表のどれかを先頭ページで判定"""
    try:
        with pdfplumber.open(pdf_path) as pdf:
            if not pdf.pages:
                return False
            text = pdf.pages[0].extract_text() or ""
            t = re.sub(r"\s+", "", text)
            return ("残高試算表" in t) or ("損益計算書" in t) or ("貸借対照表" in t)
    except Exception as e:
        print(f"⚠️  判定失敗 {pdf_path.name}: {e}")
        return False


def extract_with_tables(pdf_path: Path) -> dict:
    """PDFのテーブル抽出で損益計算書の主要数値を取得"""
    result = {
        "uriage": None,
        "gaichuhi": None,
        "rieki": None,
        "period": None,
        "company_id": None,
    }

    with pdfplumber.open(pdf_path) as pdf:
        full_text = ""
        all_tables = []
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                full_text += text + "\n"
            all_tables.extend(page.extract_tables())

    # 会社名を特定
    for company_name, cid in COMPANY_MAP.items():
        if company_name in full_text:
            result["company_id"] = cid
            break

    # 対象期間を抽出（至 令和X年Y月）
    m = re.search(r"至\s*令和\s*(\d+)年\s*(\d+)月", full_text)
    if m:
        reiwa = int(m.group(1))
        month = int(m.group(2))
        result["period"] = f"{reiwa + 2018}/{month}"

    # 前期比較残高試算表かどうか判定
    text_no_space = full_text.replace(" ", "").replace("　", "")
    is_comparative = ("前期比較" in text_no_space) or (
        "前期比較" in pdf_path.name
    )

    def get_number(cell):
        if cell is None:
            return None
        s = str(cell).replace(",", "").replace(" ", "").strip()
        if not s:
            return None
        try:
            return int(s)
        except ValueError:
            try:
                f = float(s)
                if "." in s:
                    return None  # 構成比・対売上比はスキップ
                return int(f)
            except ValueError:
                return None

    def get_target_value(row, is_comp):
        ncols = len(row)
        if is_comp:
            # 前期比較: 当期金額 = index 4 (8列テーブル)
            if ncols >= 5:
                v = get_number(row[4])
                if v is not None:
                    return v
            if ncols >= 4:
                return get_number(row[-4])
        else:
            # 残高試算表: 期間残高 = index -2
            if ncols >= 3:
                v = get_number(row[-2])
                if v is not None:
                    return v
            if ncols > 5:
                return get_number(row[5])
        return None

    for table in all_tables:
        if not table:
            continue
        for row in table:
            if not row:
                continue
            row_text = "".join([str(c or "") for c in row])
            row_clean = row_text.replace(" ", "").replace("　", "")

            if "売上高合計" in row_clean:
                v = get_target_value(row, is_comparative)
                if v and v > 0:
                    result["uriage"] = v

            if "外注費" in row_clean and "営業外" not in row_clean:
                v = get_target_value(row, is_comparative)
                if v and v > 0:
                    result["gaichuhi"] = v

            if "当期純損益金額" in row_clean:
                v = get_target_value(row, is_comparative)
                if v is not None:
                    result["rieki"] = v

    return result


def extract_pl_from_pdf(pdf_path: Path) -> dict:
    """テキストベース抽出（テーブル抽出失敗時のフォールバック）"""
    result = {
        "uriage": None,
        "gaichuhi": None,
        "rieki": None,
        "period": None,
        "company_id": None,
    }

    with pdfplumber.open(pdf_path) as pdf:
        full_text = ""
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                full_text += text + "\n"

    for company_name, cid in COMPANY_MAP.items():
        if company_name in full_text:
            result["company_id"] = cid
            break

    m = re.search(r"至\s*令和\s*(\d+)年\s*(\d+)月", full_text)
    if m:
        result["period"] = f"{int(m.group(1)) + 2018}/{int(m.group(2))}"

    def extract_numbers(text: str):
        nums = re.findall(r"-?[\d,]+", text)
        candidates = []
        for n in nums:
            try:
                val = int(n.replace(",", ""))
                if abs(val) > 0:
                    candidates.append(val)
            except ValueError:
                pass
        return candidates

    for line in full_text.split("\n"):
        line_clean = re.sub(r"\s+", "", line)

        if "売上高合計" in line_clean:
            for n in extract_numbers(line):
                if n > 0:
                    result["uriage"] = n
                    break

        if "外注費" in line_clean and "営業外" not in line_clean:
            for n in extract_numbers(line):
                if n > 0 and (
                    result["gaichuhi"] is None or n > result["gaichuhi"]
                ):
                    result["gaichuhi"] = n

        if "当期純損益金額" in line_clean:
            nums = extract_numbers(line)
            if nums:
                result["rieki"] = nums[-1]

    return result


def format_amount(value) -> str:
    """金額を表示用にフォーマット（None対応）"""
    if value is None:
        return "なし"
    return f"{value:,}"


def load_env():
    """環境変数を .env.local から読み込む"""
    if not ENV_PATH.exists():
        print(f"❌ .env.local が見つかりません: {ENV_PATH}")
        sys.exit(1)
    load_dotenv(ENV_PATH)

    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        print("❌ NEXT_PUBLIC_SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が未設定")
        sys.exit(1)

    return url, key


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="DB書き込みをスキップ")
    args = parser.parse_args()

    print("=== Garden-Forest 進行期データ自動更新 ===\n")
    if args.dry_run:
        print("🔍 Dry-run モード（書き込みなし）\n")

    url, key = load_env()
    print(f"Supabase URL: {url}")
    print(f"PDF ディレクトリ: {PDF_DIR}")
    print()


if __name__ == "__main__":
    main()
